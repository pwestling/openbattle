import { describe, expect, it, vi } from "vitest";
import type { GameRecord, GameState } from "../core";
import { createLoopbackNetwork } from "./loopback";
import { Session } from "./session";
import type { NetMessage, Transport } from "./transport";
import { PROTOCOL } from "../protocol";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function peer() {
  const seen: { state?: GameState; record?: GameRecord } = {};
  return { seen, onChange: (state: GameState, record: GameRecord) => Object.assign(seen, { state, record }) };
}

describe("Session", () => {
  it("keeps host, client and spectator on the same log, with the host rolling dice", async () => {
    const net = createLoopbackNetwork();
    const h = peer();
    const c = peer();
    const s = peer();

    const host = new Session({
      transport: net.connect("host"),
      role: "host",
      onChange: h.onChange,
      rng: () => 0.99,
    });
    host.dispatch({
      type: "model/add",
      model: {
        id: "m1",
        owner: "host",
        label: "Trooper",
        position: { x: 0, y: 0 },
        facing: 0,
        base: { shape: "round", diameterMm: 32 },
      },
    });

    const client = new Session({ transport: net.connect("client"), role: "client", onChange: c.onChange });
    const spectator = new Session({
      transport: net.connect("spec"),
      role: "spectator",
      onChange: s.onChange,
    });
    await flush();

    // Late joiners received the existing history.
    expect(c.seen.state?.models.m1).toBeDefined();

    client.dispatch({ type: "model/move", id: "m1", to: { x: 5, y: 2 } });
    client.dispatch({ type: "dice/roll", count: 2, sides: 6 });
    spectator.dispatch({ type: "dice/roll", count: 1, sides: 6 }); // ignored
    client.dispatch({ type: "undo", seq: 2 });

    expect(c.seen.record).toEqual(h.seen.record);
    expect(s.seen.record).toEqual(h.seen.record);
    expect(h.seen.record?.events.map((e) => [e.seq, e.by, e.event.type])).toEqual([
      [1, "host", "model/add"],
      [2, "client", "model/move"],
      [3, "client", "dice/roll"],
      [4, "client", "undo"],
    ]);
    expect(c.seen.state?.models.m1?.position).toEqual({ x: 0, y: 0 });
  });

  it("holds a watcher's events back on the host, so its copy never runs ahead of the delay", async () => {
    vi.useFakeTimers();
    try {
      let now = 1_000_000;
      const net = createLoopbackNetwork();
      const h = peer();
      const s = peer();
      const c = peer();
      const host = new Session({
        transport: net.connect("host"),
        role: "host",
        onChange: h.onChange,
        now: () => now,
      });
      host.setSpectatorFloor(30_000);
      const roll = () => host.dispatch({ type: "dice/roll", count: 1, sides: 6 });
      roll();
      now += 40_000;
      roll();
      new Session({ transport: net.connect("client"), role: "client", onChange: c.onChange });
      new Session({ transport: net.connect("spec"), role: "spectator", onChange: s.onChange });
      await vi.advanceTimersByTimeAsync(10);
      // The first roll is old enough; the second, 0 s old, isn't sent yet.
      expect(s.seen.record?.events.map((e) => e.seq)).toEqual([1]);
      expect(c.seen.record?.events.map((e) => e.seq)).toEqual([1, 2]);
      roll();
      await vi.advanceTimersByTimeAsync(300);
      expect(s.seen.record?.events.map((e) => e.seq)).toEqual([1]);
      now += 31_000;
      await vi.advanceTimersByTimeAsync(300);
      expect(s.seen.record?.events.map((e) => e.seq)).toEqual([1, 2, 3]);
      expect(c.seen.record?.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes side-channel messages between any peers, outside the log", async () => {
    const net = createLoopbackNetwork();
    const host = new Session({ transport: net.connect("host"), role: "host", onChange: () => {} });
    const client = new Session({ transport: net.connect("client"), role: "client", onChange: () => {} });
    const got: string[] = [];
    host.listenSide((m, from) => got.push(`${m.t} ${from}`));
    await flush();
    client.sendSide({ t: "asset/want", id: "abc" });
    await flush();
    expect(got).toEqual(["asset/want client"]);
    expect(host.log.events).toHaveLength(0);
  });

  it("dresses only the named profiles with a figure and lifts its bands onto the base", () => {
    const host = new Session({
      transport: createLoopbackNetwork().connect("host"),
      role: "host",
      onChange: () => {},
    });
    const base = { shape: "round", diameterMm: 32 } as const;
    const model = (id: string, name: string) => ({
      id,
      owner: "host",
      label: name,
      position: { x: 0, y: 0 },
      facing: 0,
      base,
      unitId: "u",
      profile: { name, chars: {} },
    });
    host.dispatch({
      type: "unit/add",
      unit: { id: "u", owner: "host", name: "Squad", modelIds: ["a", "b"], formation: { kind: "skirmish" } },
      models: [model("a", "Sergeant"), model("b", "Trooper")],
    });
    const figure = { asset: "f", name: "trooper.stl", yaw: 0, scale: 2 };
    host.dispatch({
      type: "unit/figure",
      id: "u",
      keys: ["Trooper"],
      figure,
      bands: [{ r: 0.3, z0: 0, z1: 1 }],
    });
    expect(host.current.models.a!.figure).toBeUndefined();
    expect(host.current.models.b!.figure).toEqual(figure);
    expect(host.current.models.b!.bands).toEqual([
      { r: 0.63, z0: 0, z1: 0.2 },
      { r: 0.6, z0: 0.2, z1: 2.2 },
    ]);
    host.dispatch({ type: "unit/figure", id: "u", keys: ["Trooper"], figure: null });
    expect(host.current.models.b!.figure).toBeUndefined();
    expect(host.current.models.b!.bands).toBeUndefined();
  });
});

describe("builds (docs/compatibility.md)", () => {
  it("tells each side when the other runs another build", async () => {
    const net = createLoopbackNetwork();
    const host = new Session({ transport: net.connect("host"), role: "host", onChange: () => {} });
    // An old client (no build info) and a client from another build, sending by hand.
    const old = net.connect("old");
    const other = net.connect("other");
    await flush();
    expect(host.status.otherBuilds).toEqual([]);
    old.send({ t: "hello", seq: 0, role: "client" }, "host");
    other.send(
      { t: "hello", seq: 0, role: "client", v: { protocol: PROTOCOL, build: "9.9.9+fork" } },
      "host",
    );
    await flush();
    expect(host.status.otherBuilds).toEqual([{ peer: "other", protocol: PROTOCOL, build: "9.9.9+fork" }]);
    // The same build is no news.
    const same = new Session({ transport: net.connect("same"), role: "client", onChange: () => {} });
    await flush();
    expect(host.status.otherBuilds.map((b) => b.peer)).toEqual(["other"]);
    expect(same.status.otherBuilds).toEqual([]);
  });

  it("parks a peer on another protocol: no log for it, no intents from it", async () => {
    const net = createLoopbackNetwork();
    const host = new Session({ transport: net.connect("host"), role: "host", onChange: () => {} });
    const got: unknown[] = [];
    const future = net.connect("future");
    future.onMessage((m) => got.push(m));
    await flush();
    future.send({ t: "hello", seq: 0, role: "client", v: { protocol: 99, build: "9.0.0+x" } }, "host");
    await flush();
    const before = host.log.events.length;
    future.send(
      {
        t: "intent",
        intent: { type: "player/join", player: { id: "future", name: "F", color: "#000", seat: 0 } },
      },
      "host",
    );
    host.dispatch({
      type: "model/add",
      model: {
        id: "m1",
        owner: "host",
        label: "T",
        position: { x: 0, y: 0 },
        facing: 0,
        base: { shape: "round", diameterMm: 32 },
      },
    });
    await flush();
    expect(host.status.otherBuilds).toEqual([{ peer: "future", protocol: 99, build: "9.0.0+x" }]);
    expect(host.log.events.some((e) => e.by === "future")).toBe(false);
    expect(got.filter((m) => (m as { t: string }).t !== "host")).toEqual([]);
    expect(host.log.events.length).toBe(before + 1);
  });

  it("ignores messages it can't read, so a newer peer can add message types (docs/protocols)", async () => {
    const net = createLoopbackNetwork();
    const h = peer();
    const host = new Session({
      transport: net.connect("host"),
      role: "host",
      onChange: h.onChange,
      rng: () => 0.5,
    });
    const newer = net.connect("newer");
    await flush();
    for (const m of [{ t: "future/thing", x: 1 }, { t: 42 }, {}, null])
      expect(() => newer.send(m as never)).not.toThrow();
    host.dispatch({ type: "dice/roll", count: 1, sides: 6 });
    expect(h.seen.record?.events.length).toBe(1);
  });

  it("a joiner that missed the host's announcement asks again and joins (naive players 12)", async () => {
    vi.useFakeTimers();
    try {
      const net = createLoopbackNetwork();
      // The connection opens lossy: the host's first announcement and the joiner's first sync are lost.
      const lossy = (t: Transport, type: string): Transport => {
        let dropped = false;
        return {
          ...t,
          send(message, to) {
            if (message.t === type && !dropped) {
              dropped = true;
              return;
            }
            t.send(message, to);
          },
        };
      };
      const h = peer();
      const c = peer();
      const host = new Session({
        transport: lossy(net.connect("host"), "host"),
        role: "host",
        onChange: h.onChange,
      });
      host.dispatch({ type: "dice/roll", count: 1, sides: 6 });
      new Session({ transport: lossy(net.connect("client"), "sync"), role: "client", onChange: c.onChange });
      await vi.advanceTimersByTimeAsync(100);
      expect(c.seen.record?.events.length ?? 0).toBe(0);
      // A few seconds on, it asked again, heard the host and caught up.
      await vi.advanceTimersByTimeAsync(3500);
      expect(c.seen.record?.events.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Joining a table over a connection that misbehaves as it opens (#85b, naive players 12): three tables at
 * once on a busy machine left a friend on "Looking for the game's host" while the host counted them as
 * watching. Each case drops or reorders one message, or one peer event, and the friend still sits down.
 */
describe("joining over a lossy connection (#85b)", () => {
  const joinAs = (id: string) => ({
    type: "player/join" as const,
    player: { id, name: id, color: "#f00", seat: 1 },
  });

  /** A transport that loses messages `drop` picks out (it is asked about each one sent). */
  const dropping = (t: Transport, drop: (message: NetMessage, to?: string) => boolean): Transport => ({
    ...t,
    send(message, to) {
      if (!drop(message, to)) t.send(message, to);
    },
  });

  /** Drops the first `n` messages of a type, and only those. */
  const first = (type: string, n = 1) => {
    let left = n;
    return (message: NetMessage) => {
      if (left <= 0 || message.t !== type) return false;
      left--;
      return true;
    };
  };

  /** Run `body` with fake timers and a host that has logged one event. */
  async function table(
    body: (ctx: {
      net: ReturnType<typeof createLoopbackNetwork>;
      h: ReturnType<typeof peer>;
      host: Session;
    }) => Promise<void>,
    hostDrop: (message: NetMessage, to?: string) => boolean = () => false,
  ) {
    vi.useFakeTimers();
    try {
      const net = createLoopbackNetwork();
      const h = peer();
      const host = new Session({
        transport: dropping(net.connect("host"), hostDrop),
        role: "host",
        onChange: h.onChange,
      });
      host.dispatch({ type: "dice/roll", count: 1, sides: 6 });
      await body({ net, h, host });
    } finally {
      vi.useRealTimers();
    }
  }

  it("a join asked for before the host is known waits, and goes once the lost announcement is heard again", () =>
    table(
      async ({ net, h }) => {
        const c = peer();
        const client = new Session({
          transport: net.connect("client"),
          role: "client",
          onChange: c.onChange,
        });
        client.dispatch(joinAs("client"));
        await vi.advanceTimersByTimeAsync(100);
        expect(h.seen.record?.events.length).toBe(1);
        await vi.advanceTimersByTimeAsync(3500);
        expect(h.seen.record?.events.map((e) => e.event.type)).toEqual(["dice/roll", "player/join"]);
        expect(c.seen.record).toEqual(h.seen.record);
      },
      // Its announcement on meeting the joiner, and the one answering the joiner's first sync.
      first("host", 2),
    ));

  it("a joiner's intent that reaches the host before the host hears it join is still logged", async () => {
    // The host's own transport is driven by hand, to deliver the joiner's intent before its join.
    const on: { message?: (m: NetMessage, from: string) => void; join?: (id: string) => void } = {};
    const sent: [NetMessage, string | undefined][] = [];
    const h = peer();
    const host = new Session({
      transport: {
        selfId: "host",
        send: (m, to) => void sent.push([m, to]),
        onMessage: (f) => void (on.message = f),
        onPeerJoin: (f) => void (on.join = f),
        onPeerLeave: () => {},
        leave: () => {},
      },
      role: "host",
      onChange: h.onChange,
    });
    on.message!({ t: "intent", intent: joinAs("early") }, "early");
    expect(h.seen.record?.events.map((e) => e.by)).toEqual(["early"]);
    on.join!("early");
    expect(sent.some(([m, to]) => m.t === "host" && to === "early")).toBe(true);
    expect(host.status.peers).toEqual(["early"]);
  });

  /**
   * The joiner's side of a Trystero room on a busy machine (#85b): it meets the host, then a stale "leave"
   * (from a handshake the host gave up on while the joiner's tab was too busy to answer) drops the host a
   * moment later, and Trystero finds it again only on the host's next announcement, a minute apart. The
   * host's side keeps the joiner all along, and counts them as watching. `when`: right on meeting the host,
   * or just after the host announced itself. `rejoin` joins the room afresh, as trysteroTransport does.
   */
  function flapping(net: ReturnType<typeof createLoopbackNetwork>, when: "join" | "host") {
    let inner = net.connect("client");
    const on: {
      message?: (m: NetMessage, from: string) => void;
      join?: (id: string) => void;
      leave?: (id: string) => void;
    } = {};
    let detached = false;
    let flapped = false;
    const counts = { rejoins: 0 };
    // As Trystero does, nothing reaches the joiner from a peer it hasn't met (or has dropped).
    const met = new Set<string>();
    // Nothing more from the host gets through from here; its leave is told once `then` has run.
    const drop = (id: string, then: () => void) => {
      flapped = detached = true;
      then();
      met.delete(id);
      on.leave?.(id);
    };
    const wire = () => {
      met.clear();
      inner.onMessage((m, from) => {
        if (detached || !met.has(from)) return;
        if (when === "host" && !flapped && m.t === "host") drop(from, () => on.message?.(m, from));
        else on.message?.(m, from);
      });
      inner.onPeerJoin((id) => {
        met.add(id);
        if (when === "join" && !flapped) drop(id, () => on.join?.(id));
        else on.join?.(id);
      });
      inner.onPeerLeave((id) => {
        met.delete(id);
        on.leave?.(id);
      });
    };
    wire();
    const transport: Transport = {
      selfId: "client",
      send: (m, to) => inner.send(m, to),
      onMessage: (f) => void (on.message = f),
      onPeerJoin: (f) => void (on.join = f),
      onPeerLeave: (f) => void (on.leave = f),
      leave: () => inner.leave(),
      rejoin() {
        counts.rejoins++;
        inner.leave();
        detached = false;
        inner = net.connect("client");
        wire();
      },
    };
    return { transport, counts };
  }

  it("a joiner whose transport drops the host right after meeting it joins the room again and sits down", () =>
    table(async ({ net, h, host }) => {
      const { transport, counts } = flapping(net, "join");
      const c = peer();
      const client = new Session({ transport, role: "client", onChange: c.onChange });
      client.dispatch(joinAs("client"));
      await vi.advanceTimersByTimeAsync(100);
      // The stall as players saw it: the host holds the joiner, the joiner holds nobody.
      expect(host.status.peers).toEqual(["client"]);
      expect(client.status.peers).toEqual([]);
      expect(client.status.hostId).toBeNull();
      await vi.advanceTimersByTimeAsync(3500);
      expect(counts.rejoins).toBe(1);
      expect(client.status.hostId).toBe("host");
      expect(h.seen.record?.events.map((e) => e.event.type)).toEqual(["dice/roll", "player/join"]);
      expect(c.seen.record).toEqual(h.seen.record);
      // Once seated it stops asking.
      await vi.advanceTimersByTimeAsync(30_000);
      expect(counts.rejoins).toBe(1);
    }));

  it("a joiner dropped from its host before it got the game joins again, instead of hosting an empty table", () =>
    table(async ({ net, h }) => {
      const { transport, counts } = flapping(net, "host");
      const c = peer();
      const client = new Session({ transport, role: "client", onChange: c.onChange });
      client.dispatch(joinAs("client"));
      await vi.advanceTimersByTimeAsync(100);
      expect(client.status.hostId).toBeNull();
      // Past the grace a departed host gets: a joiner without the game never stands in for it.
      await vi.advanceTimersByTimeAsync(5000);
      expect(client.status.role).toBe("client");
      expect(counts.rejoins).toBe(1);
      expect(client.status.hostId).toBe("host");
      expect(h.seen.record?.events.map((e) => e.event.type)).toEqual(["dice/roll", "player/join"]);
      expect(c.seen.record).toEqual(h.seen.record);
    }));
});
