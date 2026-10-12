import { describe, expect, it } from "vitest";
import { type GameRecord } from "../core";
import { createLoopbackNetwork } from "./loopback";
import { Session, type NetStatus, type Role } from "./session";
import type { NetMessage, Transport } from "./transport";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const GRACE = 10;
const settle = () => sleep(GRACE * 4);

/** A transport that remembers the kinds of message it received. */
function spied(t: Transport, got: string[]): Transport {
  return {
    ...t,
    selfId: t.selfId,
    onMessage: (h) => t.onMessage((m: NetMessage, from) => (got.push(m.t), h(m, from))),
  };
}

type Net = ReturnType<typeof createLoopbackNetwork>;

function join(net: Net, id: string, role: Role, record?: GameRecord, resumed = false, ready = true) {
  const got: string[] = [];
  const net$: { status?: NetStatus } = {};
  const session = new Session({
    transport: spied(net.connect(id), got),
    role,
    onChange: () => {},
    graceMs: GRACE,
    onNet: (s) => (net$.status = s),
    ...(record ? { record } : {}),
    resumed,
    ready: () => ready,
  });
  return { session, got, net: net$ };
}

const bytes = (r: GameRecord) => JSON.stringify(r);

describe("reconnect and host migration", () => {
  it("sends a returning client only the events it missed, and it takes its seat back", async () => {
    const net = createLoopbackNetwork();
    const host = join(net, "h", "host").session;
    host.dispatch({ type: "player/join", player: { id: "h", name: "Ann", color: "#00f", seat: 0 } });
    const first = join(net, "c", "client");
    await settle();
    first.session.dispatch({ type: "player/join", player: { id: "c", name: "Bo", color: "#f00", seat: 1 } });
    first.session.dispatch({ type: "dice/roll", count: 1, sides: 6 });
    const saved = first.session.log;
    first.session.leave();
    host.dispatch({ type: "dice/roll", count: 2, sides: 6 });
    host.dispatch({ type: "dice/roll", count: 3, sides: 6 });

    // The tab comes back with a new peer id and the log it saved.
    const back = join(net, "c2", "client", saved);
    await settle();
    expect(back.got).toContain("events");
    expect(back.got).not.toContain("record");
    expect(bytes(back.session.log)).toBe(bytes(host.log));
    back.session.dispatch({ type: "player/claim", player: "c" });
    expect(host.current.players.c2?.name).toBe("Bo");
    expect(host.current.players.c).toBeUndefined();
  });

  it("picks one new host among equal players: the lowest peer id", async () => {
    const net = createLoopbackNetwork();
    const h = join(net, "h", "host");
    const b = join(net, "b", "client");
    const a = join(net, "a", "client");
    await settle();
    h.session.dispatch({ type: "dice/roll", count: 1, sides: 6 });
    h.session.leave();
    await settle();
    expect(a.net.status?.role).toBe("host");
    expect(b.net.status).toMatchObject({ role: "client", hostId: "a" });
    b.session.dispatch({ type: "dice/roll", count: 1, sides: 6 });
    expect(bytes(a.session.log)).toBe(bytes(b.session.log));
  });

  it("never hands the room to a peer missing the game's rules packages", async () => {
    const net = createLoopbackNetwork();
    const h = join(net, "h", "host");
    const b = join(net, "b", "client");
    const a = join(net, "a", "client", undefined, false, false);
    await settle();
    h.session.dispatch({ type: "dice/roll", count: 1, sides: 6 });
    h.session.leave();
    await settle();
    // "a" has the lower id but lacks a package, so "b" takes over.
    expect(b.net.status?.role).toBe("host");
    expect(a.net.status).toMatchObject({ role: "client", hostId: "b" });
  });

  it("lets a returning host take the room back when its log is at least as long", async () => {
    const net = createLoopbackNetwork();
    const h = join(net, "h", "host");
    const c = join(net, "c", "client");
    await settle();
    h.session.dispatch({ type: "dice/roll", count: 1, sides: 6 });
    const saved = h.session.log;
    h.session.leave();
    await settle();
    expect(c.net.status?.role).toBe("host");
    const back = join(net, "h2", "host", saved, true);
    await settle();
    expect(back.net.status?.role).toBe("host");
    expect(c.net.status).toMatchObject({ role: "client", hostId: "h2" });
    c.session.dispatch({ type: "dice/roll", count: 1, sides: 6 });
    expect(bytes(back.session.log)).toBe(bytes(c.session.log));
  });
});
