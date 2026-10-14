import {
  appendEvent,
  applyEvent,
  createRecord,
  isCheckpoint,
  stateHash,
  lastSeq,
  resolveLogged,
  stateAt,
  pendingReactions,
  type GameEvent,
  type GameRecord,
  type GameState,
  type Intent,
  type LoggedEvent,
  type Rng,
} from "../core";
import { jsonProblem } from "../core/validate";
import { hookIntents } from "../core/macro";
import type { Check, NetMessage, SideMessage, Transport } from "./transport";
import { buildInfo, MY_BUILD, type BuildInfo } from "../protocol";

/** Spectators receive the game like clients but never send intents. */
export type Role = "host" | "client" | "spectator";

/** Who is connected and who is host, for the reconnecting banner. */
export interface NetStatus {
  role: Role;
  hostId: string | null;
  /** Peers connected right now. */
  peers: string[];
  /** The host has left and the room is choosing (or waiting for) a new one. */
  migrating: boolean;
  /**
   * This peer's state stopped matching the host's after event `seq` (the
   * checksums differ); `count` is how many times it has happened this game.
   */
  desync: { seq: number; count: number; host: number; mine: number } | null;
  /** A spectator: how far behind the game the host sends it events (ms), 0 for live. */
  hostDelay?: number;
  /** Connected peers running another build than this one (docs/compatibility.md). */
  otherBuilds: ({ peer: string } & BuildInfo)[];
}

/** Hooks set off by hooks stop after this many runs deep. */
const MAX_HOOK_DEPTH = 4;

/** Checkpoints kept for comparing against the host's checksums. */
const KEEP_CHECKS = 32;

/**
 * Intents the host hands to the rules-package sandbox (src/sandbox): the
 * router returns how to resolve one there, or null to resolve it here. The
 * host draws a seed from its rng for the sandbox's dice.
 */
type IntentRouter = (
  intent: Intent,
  from: string,
  state: GameState,
) => ((seed: number) => Promise<GameEvent | null>) | null;

let router: IntentRouter | null = null;
const routerListeners = new Set<() => void>();

export function setIntentRouter(r: IntentRouter | null): void {
  if (router === r) return;
  router = r;
  for (const listener of routerListeners) listener();
}

interface SessionOptions {
  transport: Transport;
  role: Role;
  onChange: (state: GameState, record: GameRecord) => void;
  record?: GameRecord;
  rng?: Rng;
  now?: () => number;
  /**
   * A host resuming a saved game. It takes the room back from a host that
   * replaced it only if its log is at least as long; otherwise it rejoins as
   * a client.
   */
  resumed?: boolean;
  /** How long peers wait for a departed host to come back before choosing a new one. */
  graceMs?: number;
  /** Told when this peer's role, the host or the connected peers change. */
  onNet?: (status: NetStatus) => void;
  /**
   * Whether this peer holds every rules package the game names, so it could
   * take over as host. Peers that aren't ready never win an election.
   */
  ready?: (state: GameState) => boolean;
  /** A spectator: how far behind the game it watches (ms); the host holds the events back. */
  delay?: number;
}

/** A short fingerprint of the log up to `seq`, so a peer can tell it holds the same history. */
function tailOf(record: GameRecord, seq = lastSeq(record)): string {
  const e = record.events.find((x) => x.seq === seq);
  return e ? `${e.seq}:${e.at}:${e.by}:${e.event.type}` : "";
}

/** Host order: the longer log wins, then a host resuming its own game, then the lower peer id. */
function beats(
  a: { id: string; seq: number; resumed?: boolean },
  b: { id: string; seq: number; resumed?: boolean },
) {
  if (a.seq !== b.seq) return a.seq > b.seq;
  if (!!a.resumed !== !!b.resumed) return !!a.resumed;
  return a.id < b.id;
}

/**
 * Keeps one peer's copy of the game log in sync.
 *
 * The host resolves every intent (its own and other players') into a logged
 * event, appends it and broadcasts it. Everyone else forwards intents to the
 * host and only changes when the host's event comes back. Peers joining or
 * coming back say how much of the log they hold and get only what they
 * missed (or the whole record if their history differs).
 *
 * If the host leaves, the players left wait `graceMs` for it, then the one
 * with the longest log (lowest peer id on a tie) takes over; every peer
 * works this out the same way, and should two hosts ever meet, the lesser
 * one stands down. Each logged event records which host logged it.
 */
/** How long a joiner waits for its host's announcement before asking again. */
const ASK_HOST_MS = 3000;

export class Session {
  private record: GameRecord;
  private state: GameState;
  private hostId: string | null = null;
  private hostInfo: { seq: number; resumed?: boolean } = { seq: 0 };
  private role: Role;
  private resumed: boolean;
  private migrating = false;
  private readonly peers = new Map<string, { role?: Role; seq?: number; ready?: boolean }>();
  /** What each peer said about its build when it greeted us. */
  private readonly builds = new Map<string, BuildInfo>();
  private readonly isReady: (state: GameState) => boolean;
  private queue: Intent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** A joiner that hasn't heard its host yet asks again (see askForHost). */
  private asking: ReturnType<typeof setTimeout> | null = null;
  /** A host has sent this peer its log: until then, a host that drops it was never really found (#85b). */
  private heardLog = false;
  /** Peers that greeted the host: until one does, it may have missed the host's announcement. */
  private readonly greeted = new Set<string>();
  private left = false;
  /** Invalidates a resolution whenever this session loses its execution authority. */
  private authority = 0;
  private readonly routerChanged = () => {
    this.invalidateResolution();
    queueMicrotask(() => this.runHooks());
  };
  private readonly transport: Transport;
  private readonly onChange: SessionOptions["onChange"];
  private readonly onNet: SessionOptions["onNet"];
  private readonly rng: Rng;
  private readonly now: () => number;
  private readonly graceMs: number;
  /** Side-channel listeners by owner (rules packages). */
  private readonly side = new Map<
    string,
    { onSide: (message: SideMessage, from: string) => void; onPeer: ((peerId: string) => void) | null }
  >();
  /** States at recent checkpoints, hashed lazily (off the hot path). */
  private readonly checks = new Map<number, { state: GameState; hash?: number }>();
  /** Host: the checkpoint whose hash rides on the next event sent. */
  private pendingCheck: number | null = null;
  private desync: NetStatus["desync"] = null;
  private desyncs = 0;
  /** Recent checksums, the host's and this peer's, for a problem report. */
  private readonly checkLog: { seq: number; host?: number; mine?: number }[] = [];
  /**
   * Host: spectators watching behind the game, and the last event each was sent. Their events
   * are held back here, never sent early, so a watcher's own copy can't run ahead of its view.
   */
  private readonly behind = new Map<string, { ms: number; sent: number }>();
  private behindTimer: ReturnType<typeof setInterval> | null = null;
  /** Host: every spectator watches at least this far behind (a public game on Live now). */
  private spectatorFloorMs = 0;
  /** Spectator: how far behind it asked to watch; the host's answer is `hostDelay`. */
  private readonly delay: number;
  private hostDelay = 0;

  constructor({
    transport,
    role,
    onChange,
    record,
    rng,
    now,
    resumed,
    graceMs,
    onNet,
    ready,
    delay,
  }: SessionOptions) {
    this.delay = Math.max(0, Math.round(delay ?? 0));
    this.isReady = ready ?? (() => true);
    this.transport = transport;
    this.role = role;
    this.resumed = !!resumed && role === "host";
    this.onChange = onChange;
    this.onNet = onNet;
    this.rng = rng ?? Math.random;
    this.now = now ?? Date.now;
    this.graceMs = graceMs ?? 4000;
    this.record = record ?? createRecord();
    // A peer coming back with the game's log has had it from a host before.
    this.heardLog = lastSeq(this.record) > 0;
    this.state = stateAt(this.record);
    if (role === "host") this.hostId = transport.selfId;

    transport.onPeerJoin((peerId) => {
      if (!this.peers.has(peerId)) this.peers.set(peerId, {});
      // Hosts say so; everyone else says how much log it holds (used to pick a new host).
      if (this.role === "host") this.announce(peerId);
      else {
        this.transport.send(this.sync(), peerId);
        this.askForHost();
      }
      for (const l of this.side.values()) l.onPeer?.(peerId);
      this.notify();
    });

    transport.onPeerLeave((peerId) => {
      this.peers.delete(peerId);
      this.greeted.delete(peerId);
      this.builds.delete(peerId);
      this.behind.delete(peerId);
      if (peerId === this.hostId && this.role !== "host") {
        this.hostId = null;
        // A joiner the host dropped before sending it the game looks for it again rather than host an empty one.
        if (this.heardLog) this.startMigration();
        else this.askForHost();
      }
      this.notify();
    });

    transport.onMessage((message, from) => this.receive(message, from));
    routerListeners.add(this.routerChanged);
    // Recovery starts after the caller has installed its session and sandbox replica.
    queueMicrotask(() => this.runHooks());
  }

  get selfId(): string {
    return this.transport.selfId;
  }

  get current(): GameState {
    return this.state;
  }

  get log(): GameRecord {
    return this.record;
  }

  get status(): NetStatus {
    return {
      role: this.role,
      hostId: this.hostId,
      peers: [...this.peers.keys()],
      migrating: this.migrating,
      desync: this.desync,
      hostDelay: this.hostDelay,
      otherBuilds: [...this.builds.entries()]
        .filter(
          ([peer, v]) =>
            this.peers.has(peer) && (v.protocol !== MY_BUILD.protocol || v.build !== MY_BUILD.build),
        )
        .map(([peer, v]) => ({ peer, ...v })),
    };
  }

  /**
   * Ask for an intent. The host may act `as` another player, which is how a
   * hotseat game on one screen plays both sides. While the room has no host
   * (it is choosing a new one), intents wait and go to the new host.
   */
  dispatch(intent: Intent, as?: string): void {
    if (this.left) return;
    if (this.role === "host") {
      this.hostApply(intent, as ?? this.selfId);
    } else if (this.role === "client") {
      if (this.hostId) this.transport.send({ t: "intent", intent }, this.hostId);
      else this.queue.push(intent);
    }
  }

  /** Receive side-channel messages (see SideMessage) and hear when peers connect. Null to stop. */
  listenSide(
    onSide: ((message: SideMessage, from: string) => void) | null,
    onPeer: ((peerId: string) => void) | null = null,
    key = "packages",
  ): void {
    if (onSide) this.side.set(key, { onSide, onPeer });
    else this.side.delete(key);
  }

  /** Send a side-channel message to one peer, or everyone. */
  sendSide(message: SideMessage, to?: string): void {
    this.transport.send(message, to);
  }

  /**
   * Replace this peer's table with the host's after a checksum mismatch. A
   * player's resync is logged (it is evidence of a bug or mismatched code);
   * a spectator just asks for the record again.
   */
  resync(): void {
    if (this.left || this.role === "host" || !this.hostId) return;
    if (this.role === "client")
      this.transport.send({ t: "intent", intent: { type: "player/resync" } }, this.hostId);
    else this.transport.send({ t: "hello", role: this.role }, this.hostId);
  }

  /** The latest checksums sent (as host) or compared (as a client), oldest first. */
  get checkHistory(): { seq: number; host?: number; mine?: number }[] {
    return [...this.checkLog];
  }

  private logCheck(entry: { seq: number; host?: number; mine?: number }): void {
    this.checkLog.push(entry);
    if (this.checkLog.length > 64) this.checkLog.shift();
  }

  checksumAt(seq: number): number | undefined {
    const c = this.checks.get(seq);
    if (!c) return undefined;
    c.hash ??= stateHash(c.state);
    return c.hash;
  }

  leave(): void {
    // Watchers behind the game get the rest of it before the host goes (PX).
    this.flushBehind();
    this.left = true;
    routerListeners.delete(this.routerChanged);
    this.invalidateResolution();
    if (this.timer) clearTimeout(this.timer);
    if (this.asking) clearTimeout(this.asking);
    this.transport.leave();
  }

  private receive(message: NetMessage, from: string): void {
    if (this.left) return;
    // A message this build can't read is ignored, never an error (docs/protocols/peer-protocol.md).
    if (typeof (message as { t?: unknown } | null)?.t !== "string") return;
    if (message.t.startsWith("package/")) {
      for (const l of this.side.values()) l.onSide(message as SideMessage, from);
      return;
    }
    switch (message.t) {
      case "hello":
        this.peers.set(from, { role: message.role, seq: message.seq });
        this.greeted.add(from);
        this.heardBuild(from, message.v);
        if (this.role !== "host" || this.parked(from)) return;
        if (message.role === "spectator") {
          const ms = Math.min(600_000, Math.max(this.spectatorFloorMs, Number(message.delay) || 0));
          if (ms > 0) return this.catchUpBehind(from, ms, message.seq, message.tail);
          this.behind.delete(from);
        }
        this.catchUp(from, message.seq, message.tail);
        return;
      case "delay":
        if (this.role === "spectator" && from === this.hostId && Number.isFinite(message.ms)) {
          this.hostDelay = Math.max(0, message.ms);
          this.notify();
        }
        return;
      case "sync":
        this.peers.set(from, { role: message.role, seq: message.seq, ready: message.ready !== false });
        // A joiner that hasn't greeted us may have missed our announcement (naive players 12: a friend sat
        // on "Looking for the game's host" while the host counted them as watching): say it again.
        if (this.role === "host" && message.role !== "host" && !this.greeted.has(from) && !this.parked(from))
          this.announce(from);
        return;
      case "intent":
        if (this.role !== "host" || this.parked(from)) return;
        this.hostApply(message.intent, from);
        // A resync is logged first, so the record sent includes it.
        if (message.intent.type === "player/resync")
          this.transport.send({ t: "record", record: this.record }, from);
        return;
      case "host":
        this.heardBuild(from, message.v);
        // A host on another protocol would send a log this build folds wrongly: don't follow it.
        if (this.parked(from)) return;
        this.heardHost(from, message.seq, message.resumed);
        return;
      case "yield":
        if (this.role !== "host" && from === this.hostId) this.follow(message.to, { seq: 0 });
        return;
      case "record":
        if (this.role === "host") return;
        if (this.hostId === null) this.follow(from, { seq: lastSeq(message.record) }, false);
        if (from !== this.hostId) return;
        this.heardLog = true;
        this.record = message.record;
        this.state = stateAt(this.record);
        // A fresh copy of the host's table: earlier checkpoints no longer apply.
        this.checks.clear();
        if (this.desync) {
          this.desync = null;
          this.notify();
        }
        this.onChange(this.state, this.record);
        return;
      case "events":
        if (this.role === "host" || from !== this.hostId) return;
        this.heardLog = true;
        for (const logged of message.events) if (!this.take(logged, from)) return;
        if (message.check) this.verify(message.check);
        return;
      case "event":
        if (this.role !== "host" && from === this.hostId && this.take(message.logged, from) && message.check)
          this.verify(message.check);
        return;
    }
  }

  /** Append the host's next event; on a gap, ask for what is missing. False when it asked. */
  private take(logged: LoggedEvent, from: string): boolean {
    const last = lastSeq(this.record);
    if (logged.seq <= last) return true;
    if (logged.seq === last + 1) {
      this.append(logged);
      return true;
    }
    this.transport.send(this.hello(), from);
    return false;
  }

  private hello(): NetMessage {
    const seq = lastSeq(this.record);
    return {
      t: "hello",
      seq,
      tail: tailOf(this.record, seq),
      role: this.role,
      ...(this.role === "spectator" && this.delay ? { delay: this.delay } : {}),
      v: MY_BUILD,
    };
  }

  /** Remember a peer's build, and say so when it's news. */
  private heardBuild(from: string, raw: unknown): void {
    const v = buildInfo(raw);
    if (!v) return;
    const had = this.builds.get(from);
    this.builds.set(from, v);
    if (had?.build !== v.build || had?.protocol !== v.protocol) this.notify();
  }

  /**
   * A spectator watching `ms` behind: the game as it stood then (what it lacks of it), then
   * each later event once it is that old. The checksums don't go: they'd say what's ahead.
   */
  private catchUpBehind(to: string, ms: number, seq?: number, tail?: string): void {
    this.transport.send({ t: "delay", ms }, to);
    const cut = this.now() - ms;
    const due = this.record.events.filter((e) => e.at <= cut);
    const last = due.at(-1)?.seq ?? this.record.initial.seq;
    if (seq !== undefined && seq > 0 && seq <= last && tailOf(this.record, seq) === tail)
      this.transport.send({ t: "events", events: due.filter((e) => e.seq > seq) }, to);
    else this.transport.send({ t: "record", record: { ...this.record, events: due } }, to);
    this.behind.set(to, { ms, sent: Math.max(last, seq !== undefined && seq <= last ? seq : last) });
    this.behindTimer ??= setInterval(() => this.sendBehind(), 250);
  }

  /** Host: watchers of this game run at least `ms` behind it from now on (0: as they ask). */
  setSpectatorFloor(ms: number): void {
    this.spectatorFloorMs = Math.max(0, ms);
  }

  /** A peer that doesn't get events as they happen: a watcher behind, or anyone not known as a player yet. */
  private heldBack(peer: string): boolean {
    return (
      this.behind.has(peer) ||
      this.parked(peer) ||
      (this.spectatorFloorMs > 0 && this.peers.get(peer)?.role !== "client")
    );
  }

  /** A peer on another protocol (docs/compatibility.md): it gets no events and its intents are dropped. */
  private parked(peer: string): boolean {
    const v = this.builds.get(peer);
    return !!v && v.protocol !== MY_BUILD.protocol;
  }

  /** The game is over (or the host is going): every watcher behind it gets the rest now. */
  private flushBehind(): void {
    if (this.role !== "host") return;
    for (const [peer, b] of this.behind) {
      const events = this.record.events.filter((e) => e.seq > b.sent);
      if (events.length) this.transport.send({ t: "events", events }, peer);
    }
    this.behind.clear();
  }

  /** Send each watcher behind the game the events that have come of age for it. */
  private sendBehind(): void {
    if (this.role !== "host" || !this.behind.size) {
      if (this.behindTimer) clearInterval(this.behindTimer);
      this.behindTimer = null;
      if (this.role !== "host") this.behind.clear();
      return;
    }
    const now = this.now();
    for (const [peer, b] of this.behind) {
      const events = this.record.events.filter((e) => e.seq > b.sent && e.at <= now - b.ms);
      if (!events.length) continue;
      b.sent = events.at(-1)!.seq;
      this.transport.send({ t: "events", events }, peer);
    }
  }

  /**
   * A joiner that met peers but no host yet: ask again every few seconds (a sync, which a host answers with
   * its announcement), in case the first announcement was lost as the connection opened. One left with no
   * peers at all has had its transport drop them (#85b: Trystero can, while the host still holds the
   * joiner): it joins the room again.
   */
  private askForHost(tries = 10): void {
    if (this.role === "host" || this.hostId || this.asking || this.left || tries <= 0) return;
    this.asking = setTimeout(() => {
      this.asking = null;
      if (this.role === "host" || this.hostId || this.migrating || this.left) return;
      if (this.peers.size) this.transport.send(this.sync());
      else this.transport.rejoin?.();
      this.askForHost(tries - 1);
    }, ASK_HOST_MS);
  }

  private greet(peerId: string): void {
    this.transport.send(this.hello(), peerId);
  }

  private announce(to?: string): void {
    this.transport.send({ t: "host", seq: lastSeq(this.record), resumed: this.resumed, v: MY_BUILD }, to);
  }

  /** Send a peer the events after `seq` if its log matches ours that far, else the whole record. */
  private catchUp(to: string, seq?: number, tail?: string): void {
    if (seq !== undefined && seq > 0 && seq <= lastSeq(this.record) && tailOf(this.record, seq) === tail) {
      const latest = Math.max(-1, ...[...this.checks.keys()].filter((k) => k > seq));
      const hash = latest > 0 ? this.checksumAt(latest) : undefined;
      this.transport.send(
        {
          t: "events",
          events: this.record.events.filter((e) => e.seq > seq),
          ...(hash !== undefined ? { check: { seq: latest, hash } } : {}),
        },
        to,
      );
    } else this.transport.send({ t: "record", record: this.record }, to);
  }

  /** Another peer says it is host. */
  private heardHost(from: string, seq: number, resumed?: boolean): void {
    const them = { id: from, seq, resumed };
    if (this.role === "host") {
      const me = { id: this.selfId, seq: lastSeq(this.record), resumed: this.resumed };
      if (beats(them, me)) this.standDown(from, them);
      // Make sure the other host hears us too, so it stands down.
      else this.announce(from);
      return;
    }
    if (from === this.hostId) {
      this.hostInfo = { seq, resumed };
      return;
    }
    const current = this.hostId && this.peers.has(this.hostId) ? { id: this.hostId, ...this.hostInfo } : null;
    if (!current || beats(them, current)) this.follow(from, { seq, resumed });
  }

  /** Make `hostId` our host: ask it for what we miss and send it anything we held back. */
  private follow(hostId: string, info: { seq: number; resumed?: boolean }, greet = true): void {
    this.hostId = hostId;
    this.hostInfo = info;
    this.migrating = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (greet) this.greet(hostId);
    if (this.role === "client")
      for (const intent of this.queue.splice(0)) this.transport.send({ t: "intent", intent }, hostId);
    this.notify();
  }

  private standDown(winner: string, info: { seq: number; resumed?: boolean }): void {
    this.invalidateResolution();
    this.role = "client";
    this.resumed = false;
    this.transport.send({ t: "yield", to: winner });
    this.follow(winner, info);
  }

  /** The host has gone: tell everyone how much log we hold, wait, then pick the new host. */
  private startMigration(): void {
    this.migrating = true;
    if (this.role !== "spectator") this.transport.send(this.sync());
    this.schedule();
  }

  private sync(): NetMessage {
    return { t: "sync", seq: lastSeq(this.record), role: this.role, ready: this.isReady(this.state) };
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.elect(), this.graceMs);
  }

  private elect(): void {
    this.timer = null;
    if (this.left || this.hostId !== null || this.role === "host") return;
    // Only a peer holding every rules package can host; if none can, the room waits.
    const candidates = [...this.peers.entries()]
      .filter(([id, p]) => p.role === "client" && p.ready !== false && !this.parked(id))
      .map(([id, p]) => ({ id, seq: p.seq ?? 0 }));
    if (this.role === "client" && this.isReady(this.state))
      candidates.push({ id: this.selfId, seq: lastSeq(this.record) });
    const best = candidates.reduce<{ id: string; seq: number } | null>(
      (a, c) => (a === null || beats(c, a) ? c : a),
      null,
    );
    if (best?.id === this.selfId) {
      this.role = "host";
      this.hostId = this.selfId;
      this.migrating = false;
      this.announce();
      for (const intent of this.queue.splice(0)) this.hostApply(intent, this.selfId);
      this.runHooks();
      this.notify();
      return;
    }
    // Waiting on someone else (or on a player to come back): ask again later.
    if (this.role !== "spectator") this.transport.send(this.sync());
    this.schedule();
  }

  /** Intents waiting while the sandbox resolves one, so events keep their order. */
  private waiting: [Intent, string][] = [];
  private resolving = false;
  private drainingHooks = false;

  private invalidateResolution(): void {
    this.authority++;
    this.resolving = false;
    this.waiting = [];
  }

  private hostApply(intent: Intent, from: string): boolean {
    if (this.left || this.role !== "host" || jsonProblem(intent)) return false;
    if (this.resolving) {
      this.waiting.push([intent, from]);
      return true;
    }
    // Package composition cannot change while execution still owns it.
    if (
      (intent.type === "game/packages" || intent.type === "game/system") &&
      (this.state.macro || pendingReactions(this.record).length) &&
      (intent.type === "game/system"
        ? intent.system !== this.state.system
        : JSON.stringify({ app: intent.app, system: intent.system, packages: intent.packages }) !==
          JSON.stringify(this.state.packages))
    )
      return false;
    const routed = router?.(intent, from, this.state);
    if (routed) {
      this.resolving = true;
      const authority = this.authority;
      const seed = Math.floor(this.rng() * 2 ** 32);
      void routed(seed)
        .catch(() => null)
        .then((event) => {
          if (this.left || this.role !== "host" || authority !== this.authority) return;
          if (event)
            this.hostLog({
              seq: lastSeq(this.record) + 1,
              by: from,
              at: this.now(),
              event,
            });
          this.resolving = false;
          for (const [i, f] of this.waiting.splice(0)) this.hostApply(i, f);
          // A refused/unavailable reaction remains owed; don't spin on it.
          if (event || intent.type !== "macro/start" || !intent.reaction) this.runHooks();
        });
      return true;
    }
    const resolved = resolveLogged(this.record, intent, from, this.rng, this.now(), this.state);
    if (!resolved) return false;
    this.hostLog(resolved);
    return true;
  }

  /** Depth follows recorded reaction identity, not a volatile host queue. */
  private hookDepth(event: GameEvent): number {
    if (event.type !== "macro/step" || !event.reaction) return 0;
    for (const logged of this.record.events)
      for (const reaction of logged.reactions ?? [])
        if (reaction.id === event.reaction) return reaction.depth;
    return 0;
  }

  private runHooks(): void {
    if (this.drainingHooks || this.left || this.role !== "host") return;
    this.drainingHooks = true;
    try {
      while (!this.resolving && !this.state.macro) {
        const reaction = pendingReactions(this.record)[0];
        if (!reaction || reaction.system !== this.state.system) return;
        if (
          !this.hostApply(
            {
              type: "macro/start",
              macro: reaction.macro,
              args: reaction.args,
              cause: reaction.cause,
              reaction: reaction.id,
            },
            reaction.by,
          )
        )
          return;
      }
    } finally {
      this.drainingHooks = false;
    }
  }

  private hostLog(resolved: LoggedEvent): void {
    if (this.left || this.role !== "host") return;
    const before = this.state;
    const after =
      resolved.event.type === "undo"
        ? stateAt(appendEvent(this.record, resolved))
        : { ...applyEvent(before, resolved.event), seq: resolved.seq };
    const depth = this.hookDepth(resolved.event);
    const reactions =
      depth < MAX_HOOK_DEPTH
        ? hookIntents(before, after, resolved.event, resolved.seq).flatMap((intent, ordinal) =>
            intent.type === "macro/start"
              ? [
                  {
                    id: `${resolved.seq}:${ordinal}`,
                    system: after.system ?? "",
                    macro: intent.macro,
                    args: intent.args ?? {},
                    by: resolved.by,
                    cause: resolved.seq,
                    depth: depth + 1,
                  },
                ]
              : [],
          )
        : [];
    const logged: LoggedEvent = {
      ...resolved,
      host: this.selfId,
      ...(reactions.length ? { reactions } : {}),
    };
    // The previous checkpoint's hash rides along with this event.
    const due = this.pendingCheck;
    this.pendingCheck = null;
    this.append(logged);
    const hash = due !== null ? this.checksumAt(due) : undefined;
    if (hash !== undefined) this.logCheck({ seq: due!, host: hash });
    const message: NetMessage = {
      t: "event",
      logged,
      ...(hash !== undefined ? { check: { seq: due!, hash } } : {}),
    };
    // Watchers behind the game get it later (sendBehind); everyone else now.
    if (!this.behind.size && !this.spectatorFloorMs && ![...this.builds.keys()].some((p) => this.parked(p)))
      this.transport.send(message);
    else for (const peer of this.peers.keys()) if (!this.heldBack(peer)) this.transport.send(message, peer);
    // Battle over: nothing is left to keep from watchers, and they shouldn't miss the end (PX).
    if (this.behind.size && this.state.pointer.over === true) {
      this.flushBehind();
      this.spectatorFloorMs = 0;
    }
    // The trigger already records the work; recovery never re-evaluates its hook table.
    this.runHooks();
  }

  /** Compare the host's checksum with ours at the same point. */
  private verify(check: Check): void {
    const mine = this.checksumAt(check.seq);
    this.logCheck({ seq: check.seq, host: check.hash, ...(mine !== undefined ? { mine } : {}) });
    if (mine === undefined) return;
    if (mine === check.hash) {
      // The tables agree again: the earlier mismatch no longer holds.
      if (this.desync && check.seq > this.desync.seq) {
        this.desync = null;
        this.notify();
      }
      return;
    }
    if (this.desync) return;
    this.desyncs++;
    this.desync = { seq: check.seq, count: this.desyncs, host: check.hash, mine };
    this.notify();
  }

  /** Keep the state after a checkpoint event and hash it when the browser is idle. */
  private checkpoint(logged: LoggedEvent): void {
    if (!isCheckpoint(logged.seq, logged.event)) return;
    this.checks.set(logged.seq, { state: this.state });
    if (this.checks.size > KEEP_CHECKS) this.checks.delete(this.checks.keys().next().value!);
    if (this.role === "host") this.pendingCheck = logged.seq;
    const seq = logged.seq;
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (idle) idle(() => this.checksumAt(seq));
  }

  private append(logged: LoggedEvent): void {
    this.record = appendEvent(this.record, logged);
    // Undo changes history, so rebuild; everything else folds in directly.
    this.state =
      logged.event.type === "undo"
        ? stateAt(this.record)
        : { ...applyEvent(this.state, logged.event), seq: logged.seq };
    this.checkpoint(logged);
    this.onChange(this.state, this.record);
  }

  private notify(): void {
    this.onNet?.(this.status);
  }
}
