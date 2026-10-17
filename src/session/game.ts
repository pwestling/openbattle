// One game as this browser takes part in it: as its host, as a player, or watching.
//
// The host's browser keeps the log. It checks and appends every action, sends each new entry to
// every browser with the table's fingerprint, and sends the whole log to a browser that says hello.
// Everyone else asks the host to add their actions, checks what the host sends against the record,
// and keeps their own copy, so they can save the game and see it while the host is away.
// Rolls and shuffled draws use the sealed exchange (ADR-008), with the other player's value signed
// (ADR-022); every browser checks those signatures as entries arrive. With no other player connected,
// the host rolls or draws alone (ADR-023); a player's browser flags any it sees while connected.
import * as archive from "../archive/index.ts";
import { verify, type BrowserId, type Json, type Link } from "../link/index.ts";
import {
  append,
  check,
  checkLog,
  fingerprint,
  guestStatement,
  tableAt,
  type Action,
  type CardId,
  type DeckId,
  type Entry,
  type Fingerprint,
  type Log,
  type PlayerId,
  type RollAction,
  type ShuffledDrawAction,
  type Table,
  type Target,
} from "../record/index.ts";
import { isMessage, type Ask, type FromHost, type Message, type ToHost } from "./wire.ts";

export interface Me {
  name: string;
  colour: string;
}

/** The colours a player can pick. A joiner whose colour is taken gets the first of these that is free. */
export const colours = ["#d1453b", "#2f6fd6", "#2e9e55", "#d69a1f", "#8a4fd1", "#1aa3a3", "#e0e0e0", "#333333"];

/** The colour a joiner gets: theirs, unless another player has it already. */
function freeColour(table: Table, wanted: string): string {
  const taken = new Set(Object.values(table.players).map((p) => p.colour.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  return colours.find((c) => !taken.has(c)) ?? wanted;
}

/** Everything the screen reads, handed over whole after every change (ADR-016). */
export interface Snapshot {
  /** The game's link, as an address to share. */
  link: string;
  /** Who this browser is in the game. */
  who: { player: PlayerId; host: boolean } | { watching: true };
  log: Log;
  table: Table;
  connection: "connecting" | "playing" | "host away";
  /** This browser's table differs from the host's. */
  disagreement: boolean;
  /** Log numbers of rolls and draws whose other player's signature does not check: shown as tampered. */
  badSignatures: number[];
  /** Log numbers of rolls and draws the host took alone while this browser was connected as a player (ADR-023). */
  aloneWhileHere: number[];
  /** Rolls and draws this browser signed a value for that the host never logged. */
  unusedValues: Ask[];
  /** False when the browser refuses storage, so the game is not being kept here. */
  kept: boolean;
}

type Waiting = { resolve: (n: number) => void; reject: (e: Error) => void };

/** A sealed exchange the host has started and is waiting on the other player for. */
type Pending = { ask: Ask; by: PlayerId; guest: BrowserId; hostValue: string; seal: string };

/** A value this browser signed and sent the host, not yet seen in the log. */
type Given = { id: string; ask: Ask; seal: string };

const isSealed = (a: Action): a is RollAction | ShuffledDrawAction => a.kind === "roll" || (a.kind === "draw" && "seal" in a);

const encoder = new TextEncoder();

export function randomValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sealOf(hostValue: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(hostValue)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};

const fromBase64 = (text: string, type: string) => new Blob([Uint8Array.from(atob(text), (c) => c.charCodeAt(0))], { type });

/** Every file a table names: terrain and model meshes, card pictures. */
function filesOf(table: Table): Fingerprint[] {
  const out = new Set<Fingerprint>();
  for (const t of Object.values(table.terrain)) if (t.shape.kind === "mesh") out.add(t.shape.mesh);
  for (const m of Object.values(table.models)) if (m.mesh) out.add(m.mesh);
  for (const c of Object.values(table.cards)) if (c.picture) out.add(c.picture);
  return [...out];
}

export class Game {
  private listeners = new Set<(now: Snapshot) => void>();
  private waiting = new Map<string, Waiting>();
  private pending = new Map<string, Pending>();
  private connected: BrowserId[] = [];
  private caughtUp: boolean;
  private disagreement = false;
  private kept = true;
  private checked = new Map<number, boolean>();
  private aloneWhileHere: number[] = [];
  private given: Given[] = [];
  private unusedValues: Ask[] = [];
  /** The host finishes exchanges in the order the values arrived, so a value's guest can tell when one was skipped. */
  private finishing: Promise<void> = Promise.resolve();
  /** Which whole log this browser asked the host for; any other is ignored, since a log may only extend this one. */
  private expecting: "hello" | "resync" | null = null;
  private stops: (() => void)[] = [];
  private nextId = 0;

  private link: Link;
  private log: Log;
  /** This browser's player id, or "watch". A browser joining is "watch" until its join arrives. */
  private me: PlayerId | "watch";
  private readonly address: string;
  /** What to say in hello: how this browser joins when it first reaches the host. */
  private joining: Me | "watch" | "back";

  constructor(link: Link, log: Log, me: PlayerId | "watch", address: string, joining: Me | "watch" | "back") {
    this.link = link;
    this.log = log;
    this.me = me;
    this.address = address;
    this.joining = joining;
    this.caughtUp = this.hosting;
    this.stops.push(link.onMessage((message, from) => void this.receive(message, from)));
    this.stops.push(link.onChange((connected) => this.change(connected)));
    void this.checkSignatures();
  }

  get hosting(): boolean {
    return this.link.me === this.log.host;
  }

  get id(): string {
    return this.log.link;
  }

  snapshot(): Snapshot {
    const table = tableAt(this.log);
    const player = this.me !== "watch" && table.players[this.me] ? this.me : null;
    return {
      link: this.address,
      who: player ? { player, host: this.hosting } : { watching: true },
      log: this.log,
      table,
      connection: this.hosting ? "playing" : !this.connected.includes(this.log.host) ? (this.caughtUp ? "host away" : "connecting") : this.caughtUp ? "playing" : "connecting",
      disagreement: this.disagreement,
      badSignatures: [...this.checked].filter(([, ok]) => !ok).map(([n]) => n).sort((a, b) => a - b),
      aloneWhileHere: [...this.aloneWhileHere],
      unusedValues: [...this.unusedValues],
      kept: this.kept,
    };
  }

  watch(listener: (now: Snapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  /** Resolves once the log holds this browser's join (or, watching, once it has caught up), or the host stays away for a while. */
  ready(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        stop();
        resolve();
      };
      const timer = setTimeout(done, 5000);
      const stop = this.watch((now) => {
        const joined = this.joining === "watch" || this.joining === "back" || "player" in now.who;
        if (this.caughtUp && joined) done();
      });
    });
  }

  private changed() {
    const now = this.snapshot();
    archive.save(this.id, { log: this.log, me: this.me }).then(
      () => this.setKept(true),
      () => this.setKept(false),
    );
    for (const l of this.listeners) l(now);
  }

  private setKept(kept: boolean) {
    if (this.kept === kept) return;
    this.kept = kept;
    const now = this.snapshot();
    for (const l of this.listeners) l(now);
  }

  private send(message: Message, to?: BrowserId) {
    this.link.send(message as unknown as Json, to);
  }

  private toHost(message: ToHost) {
    this.send(message, this.log.host);
  }

  // ——— Taking part ———

  private player(): PlayerId {
    if (this.link.replaced) throw new Error("This game is open in another tab of this browser.");
    if (this.me === "watch" || !tableAt(this.log).players[this.me]) throw new Error("Spectators can't change the game.");
    return this.me;
  }

  private hostHere() {
    if (!this.hosting && !this.connected.includes(this.log.host)) throw new Error("The host is away, so the game is paused.");
  }

  /** Waits for the host's answer to a request, then until this browser has the entry it made. */
  private request(make: (id: string) => ToHost): Promise<number> {
    const id = `${this.link.me}.${this.nextId++}`;
    return new Promise<number>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.toHost(make(id));
    });
  }

  async act(action: Action): Promise<void> {
    if (action.kind === "roll" || action.kind === "draw" || action.kind === "join")
      throw new Error(`Use ${action.kind === "join" ? "open or enter" : action.kind} for a ${action.kind}.`);
    const by = this.player();
    this.hostHere();
    if (this.hosting) {
      this.hostAppend(action, by);
      return;
    }
    await this.request((id) => ({ t: "act", id, action }));
  }

  async roll(dice: number, sides: number, label?: string, about?: Target[]): Promise<number[]> {
    const ask: Ask = { kind: "roll", dice, sides, ...(label === undefined ? {} : { label }), ...(about === undefined ? {} : { about }) };
    const n = await this.exchange(ask);
    const roll = tableAt(this.log).rolls.find((r) => r.at === n);
    if (!roll) throw new Error("The roll is not in the log.");
    return roll.result;
  }

  async draw(deck: DeckId, cards: number, to: "hand" | "table"): Promise<CardId[]> {
    const table = tableAt(this.log);
    const pile = table.decks[deck];
    if (!pile) throw new Error(`There is no deck "${deck}".`);
    if (pile.cards.length < cards) throw new Error(pile.cards.length ? `The deck has only ${pile.cards.length} cards.` : "The deck is empty.");
    if (pile.order === "ordered") {
      const by = this.player();
      this.hostHere();
      const action: Action = { kind: "draw", deck, cards, to };
      const n = this.hosting ? this.hostAppend(action, by) : await this.request((id) => ({ t: "act", id, action }));
      return tableAt(this.log).draws.find((d) => d.at === n)?.cards ?? [];
    }
    const n = await this.exchange({ kind: "draw", deck, cards, to });
    return tableAt(this.log).draws.find((d) => d.at === n)?.cards ?? [];
  }

  /** A roll or shuffled draw: the sealed exchange, with the other player's value signed. */
  private async exchange(ask: Ask): Promise<number> {
    const by = this.player();
    this.hostHere();
    if (!this.hosting)
      return this.request((id) => {
        this.myAsks.set(id, ask);
        return { t: "ask", id, ask };
      });
    const table = tableAt(this.log);
    const guest = this.connected.find((b) => b !== this.log.host && table.players[b]);
    if (!guest) return this.alone(ask, by);
    const id = `${this.link.me}.${this.nextId++}`;
    return new Promise<number>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      void this.startExchange(id, ask, by, guest);
    });
  }

  async resync(): Promise<void> {
    if (this.hosting) return;
    this.hostHere();
    await new Promise<void>((resolve, reject) => {
      this.resyncing?.reject(new Error("Another resync took its place."));
      this.resyncing = { resolve: () => resolve(), reject };
      // A hello's log already on its way answers this resync too, and keeps a hello's meaning.
      if (this.expecting === "hello") return;
      this.expecting = "resync";
      this.toHost({ t: "resync" });
    });
  }

  private resyncing: Waiting | null = null;
  /** What this player asked the host to roll or draw, by request id, so it signs only that. */
  private myAsks = new Map<string, Ask>();

  private resynced(problem?: string) {
    const r = this.resyncing;
    this.resyncing = null;
    if (problem) r?.reject(new Error(problem));
    else r?.resolve(0);
  }

  async addFile(source: Blob | URL): Promise<Fingerprint> {
    this.player();
    const blob = source instanceof URL ? await download(source) : source;
    const fingerprint = await archive.keepFile(this.id, blob);
    const message: ToHost = { t: "file", fingerprint, bytes: await toBase64(blob), type: blob.type };
    this.send(message);
    return fingerprint;
  }

  leave(): void {
    for (const stop of this.stops) stop();
    this.link.close();
    for (const w of this.waiting.values()) w.reject(new Error("This browser left the game."));
    this.waiting.clear();
    this.listeners.clear();
  }

  // ——— The host's side ———

  /** The host's own join, when it opens a game it is not yet a player in. */
  joinAsHost(me: Me, publicKey: string) {
    this.hostAppend({ kind: "join", name: me.name, colour: freeColour(tableAt(this.log), me.colour), publicKey }, this.link.me);
  }

  /** Checks and appends an action, sends the entry to everyone, and returns its number. Throws the record's problem. */
  private hostAppend(action: Action, by: PlayerId): number {
    const problem = check(this.log, action, by);
    if (problem) throw new Error(problem.problem);
    this.log = append(this.log, action, by);
    const entry = this.log.entries.at(-1)!;
    this.send({ t: "entry", entry, fingerprint: fingerprint(tableAt(this.log)) });
    void this.checkSignatures();
    this.changed();
    return entry.n;
  }

  /** With no other player connected, the host makes both values, and the record marks it as taken alone. */
  private async alone(ask: Ask, by: PlayerId): Promise<number> {
    const hostValue = randomValue();
    const sealed = { link: this.log.link, seal: await sealOf(hostValue), hostValue, guestValue: randomValue(), guestBy: null };
    const action: RollAction | ShuffledDrawAction = ask.kind === "roll" ? { ...ask, ...sealed } : { ...ask, ...sealed };
    return this.hostAppend(action, by);
  }

  private async startExchange(id: string, ask: Ask, by: PlayerId, guest: BrowserId) {
    const hostValue = randomValue();
    const seal = await sealOf(hostValue);
    this.pending.set(id, { ask, by, guest, hostValue, seal });
    this.send({ t: "seal", id, ask, link: this.log.link, seal }, guest);
  }

  private finishExchange(id: string, from: BrowserId, guestValue: string, guestSignature: string) {
    this.finishing = this.finishing.then(() => this.finishOne(id, from, guestValue, guestSignature));
    return this.finishing;
  }

  private async finishOne(id: string, from: BrowserId, guestValue: string, guestSignature: string) {
    const p = this.pending.get(id);
    if (!p || p.guest !== from) return;
    this.pending.delete(id);
    const sealed = { link: this.log.link, seal: p.seal, hostValue: p.hostValue, guestValue, guestBy: from, guestSignature };
    const action: RollAction | ShuffledDrawAction = p.ask.kind === "roll" ? { ...p.ask, ...sealed } : { ...p.ask, ...sealed };
    const key = tableAt(this.log).players[from]?.publicKey;
    const fine = typeof guestValue === "string" && key !== undefined && (await verify(key, guestStatement(action, p.by), guestSignature));
    if (!fine) return this.drop(id, p, "The other player's value did not come with a good signature.");
    try {
      this.answer(id, p.by, this.hostAppend(action, p.by));
    } catch (e) {
      this.drop(id, p, (e as Error).message);
    }
  }

  /** An exchange the host can't log: whoever asked is told why, and so is the other player, whose value goes unused. */
  private drop(id: string, p: Pending, problem: string) {
    this.answer(id, p.by, null, problem);
    if (p.guest !== p.by) this.send({ t: "refused", id, problem }, p.guest);
  }

  /** Tells whoever asked how their request went: locally if it was the host's own, otherwise over the link. */
  private answer(id: string, to: PlayerId, n: number | null, problem?: string) {
    const mine = this.waiting.get(id);
    if (mine) {
      this.waiting.delete(id);
      if (n === null) mine.reject(new Error(problem));
      else mine.resolve(n);
      return;
    }
    this.send(n === null ? { t: "refused", id, problem: problem ?? "Refused." } : { t: "done", id, n }, to);
  }

  private async hostReceive(m: ToHost, from: BrowserId) {
    const table = tableAt(this.log);
    switch (m.t) {
      case "hello": {
        this.send({ t: "log", log: this.log }, from);
        for (const f of filesOf(table)) void this.sendFile(f, from);
        if (typeof m.as === "object" && !table.players[from]) {
          try {
            this.hostAppend({ kind: "join", name: m.as.name, colour: freeColour(table, m.as.colour), publicKey: m.publicKey }, from);
          } catch {
            // A join the record refuses (a key that is not this browser's) leaves the browser watching.
          }
        }
        return;
      }
      case "resync":
        this.send({ t: "log", log: this.log }, from);
        return;
      case "act":
        if (!ownId(m.id, from)) return;
        if (m.action?.kind === "roll" || (m.action?.kind === "draw" && "seal" in m.action) || m.action?.kind === "join")
          return this.answer(m.id, from, null, "Rolls, shuffled draws and joins have their own requests.");
        try {
          this.answer(m.id, from, this.hostAppend(m.action, from));
        } catch (e) {
          this.answer(m.id, from, null, (e as Error).message);
        }
        return;
      case "ask":
        if (!ownId(m.id, from) || this.pending.has(m.id)) return;
        if (!table.players[from]) return this.answer(m.id, from, null, "Spectators can't roll or draw.");
        return this.startExchange(m.id, m.ask, from, from);
      case "guest":
        return this.finishExchange(m.id, from, m.guestValue, m.guestSignature);
      case "file":
        return this.receiveFile(m.fingerprint, m.bytes, m.type, from);
    }
  }

  private async sendFile(fingerprint: Fingerprint, to: BrowserId) {
    const blob = await archive.getFile(fingerprint);
    if (blob) this.send({ t: "file", fingerprint, bytes: await toBase64(blob), type: blob.type }, to);
  }

  private async receiveFile(fingerprint: Fingerprint, bytes: string, type: string, from: BrowserId) {
    // Only players add files; a spectator's is ignored, and the host's always comes through.
    if (from !== this.log.host && !tableAt(this.log).players[from]) return;
    const blob = fromBase64(bytes, type);
    const kept = await archive.keepFile(this.id, blob);
    if (kept !== fingerprint) return;
    // The host passes a player's file on to everyone else.
    if (this.hosting) for (const b of this.connected) if (b !== from) this.send({ t: "file", fingerprint, bytes, type }, b);
    this.changed();
  }

  // ——— Following the host ———

  private async receive(message: Json, from: BrowserId) {
    if (!isMessage(message)) return;
    if (this.hosting) return this.hostReceive(message as ToHost, from);
    if (from === this.log.host) return this.follow(message as FromHost);
    if (message.t === "file") return this.receiveFile(message.fingerprint, message.bytes, message.type, from);
  }

  private async follow(m: FromHost) {
    switch (m.t) {
      case "log": {
        const log = m.log;
        const asked = this.expecting;
        if (!asked) return;
        this.expecting = null;
        // The host may add to the log this browser has, never change it.
        if (log?.link !== this.log.link || log.host !== this.log.host || checkLog(log) || !extendsLog(log, this.log)) {
          this.disagreement = true;
          this.resynced("The host's log changes entries this browser already has.");
          return this.changed();
        }
        const had = this.log.entries.length;
        this.log = log;
        for (const e of log.entries.slice(had)) {
          if (!isSealed(e.action)) continue;
          // Resyncing, this player was connected all along, so an alone roll among the new entries was taken while here.
          if (asked === "resync") this.flagAlone(e.n, e.action);
          this.matchGiven(e.action);
        }
        // Caught up after reconnecting: a value given before, and still not in the log, was never used.
        if (asked === "hello") this.unused(() => true);
        this.caughtUp = true;
        this.disagreement = false;
        this.becomeJoined();
        void this.checkSignatures();
        this.changed();
        this.resynced();
        return;
      }
      case "entry": {
        const { entry } = m;
        if (!this.caughtUp) return;
        if (entry?.n !== this.log.entries.length + 1 || check(this.log, entry.action, entry.by)) {
          this.disagreement = true;
          return this.changed();
        }
        this.log = append(this.log, entry.action, entry.by);
        if (isSealed(entry.action)) {
          this.flagAlone(entry.n, entry.action);
          this.matchGiven(entry.action);
        }
        if (fingerprint(tableAt(this.log)) !== m.fingerprint) this.disagreement = true;
        this.becomeJoined();
        this.settle();
        void this.checkSignatures();
        return this.changed();
      }
      case "done": {
        const w = this.waiting.get(m.id);
        if (w) {
          this.waiting.delete(m.id);
          this.whenHas(m.n, () => w.resolve(m.n));
        }
        return;
      }
      case "refused": {
        this.unused((g) => g.id === m.id);
        this.myAsks.delete(m.id);
        const w = this.waiting.get(m.id);
        if (w) {
          this.waiting.delete(m.id);
          w.reject(new Error(m.problem));
        }
        return;
      }
      case "seal":
        return this.giveValue(m.id, m.ask, m.link, m.seal);
      case "file":
        return this.receiveFile(m.fingerprint, m.bytes, m.type, this.log.host);
    }
  }

  /** The other player's half of a sealed exchange: a fresh value, signed with what it is for. */
  private async giveValue(id: string, ask: Ask, link: string, seal: string) {
    if (link !== this.log.link || this.me === "watch") return;
    // For this player's own request, the host must describe what was asked, not a relabelled or redirected one.
    const mine = id.startsWith(`${this.link.me}.`);
    if (mine) {
      const asked = this.myAsks.get(id);
      this.myAsks.delete(id);
      if (!asked || JSON.stringify(asked) !== JSON.stringify(ask)) {
        const w = this.waiting.get(id);
        this.waiting.delete(id);
        return w?.reject(new Error("The host asked to sign a different roll or draw from the one asked for, so it was not signed."));
      }
    }
    const guestValue = randomValue();
    const sealed = { link, seal, hostValue: "", guestValue, guestBy: this.me, guestSignature: "" };
    const action: RollAction | ShuffledDrawAction = ask.kind === "roll" ? { ...ask, ...sealed } : { ...ask, ...sealed };
    const guestSignature = await this.link.sign(guestStatement({ ...action, guestBy: this.me }, mine ? this.me : this.log.host));
    this.given.push({ id, ask, seal });
    this.toHost({ t: "guest", id, guestValue, guestSignature });
  }

  /** A roll or draw the host took alone, arriving while this player is connected (ADR-023). */
  private flagAlone(n: number, a: RollAction | ShuffledDrawAction) {
    if (a.guestBy === null && this.me !== "watch" && tableAt(this.log).players[this.me]) this.aloneWhileHere.push(n);
  }

  /**
   * A roll or shuffled draw just logged, against the values this browser gave. The host logs a player's
   * values in the order they were sent, so once a later one is logged, any earlier one was skipped.
   */
  private matchGiven(a: RollAction | ShuffledDrawAction) {
    const at = this.given.findIndex((g) => g.seal === a.seal);
    if (at < 0) return;
    const before = new Set(this.given.slice(0, at));
    this.given.splice(at, 1);
    this.unused((g) => before.has(g));
  }

  /** Moves the given values that match out of waiting and into those the host never used. */
  private unused(match: (g: Given) => boolean) {
    for (const g of this.given.filter(match)) this.unusedValues.push(g.ask);
    this.given = this.given.filter((g) => !match(g));
  }

  private afterEntries: { n: number; run: () => void }[] = [];

  private whenHas(n: number, run: () => void) {
    if (this.log.entries.length >= n) run();
    else this.afterEntries.push({ n, run });
  }

  private settle() {
    const ready = this.afterEntries.filter((a) => this.log.entries.length >= a.n);
    this.afterEntries = this.afterEntries.filter((a) => this.log.entries.length < a.n);
    for (const a of ready) a.run();
  }

  /** A browser that asked to join becomes that player once its join is in the log. */
  private becomeJoined() {
    if (this.me === "watch" && this.joining !== "watch" && tableAt(this.log).players[this.link.me]) this.me = this.link.me;
  }

  private change(connected: BrowserId[]) {
    const hostArrived = !this.connected.includes(this.log.host) && connected.includes(this.log.host);
    this.connected = connected;
    if (hostArrived && !this.hosting) {
      this.caughtUp = false;
      const as = this.me !== "watch" ? "back" : this.joining;
      this.expecting = "hello";
      this.toHost({ t: "hello", as, publicKey: this.link.publicKey });
    }
    if (!this.hosting && !connected.includes(this.log.host)) {
      for (const w of this.waiting.values()) w.reject(new Error("The host went away before answering."));
      this.waiting.clear();
      this.resynced("The host went away before answering.");
    }
    if (this.hosting)
      for (const [id, p] of this.pending)
        if (!connected.includes(p.guest)) {
          this.pending.delete(id);
          this.answer(id, p.by, null, "The other player left before sending their value.");
        }
    this.changed();
  }

  /** Checks the other player's signature on every roll and shuffled draw not yet checked. */
  private async checkSignatures() {
    const log = this.log;
    const table = tableAt(log);
    let found = false;
    for (const e of log.entries) {
      if (this.checked.has(e.n)) continue;
      const a = e.action;
      if (!isSealed(a) || a.guestBy === null) continue;
      const key = tableAt(log, e.n - 1).players[a.guestBy]?.publicKey ?? table.players[a.guestBy]?.publicKey;
      const ok = key !== undefined && (await verify(key, guestStatement(a, e.by), a.guestSignature));
      this.checked.set(e.n, ok);
      found = true;
    }
    if (found) this.changed();
  }
}

/** A request's id is its sender's: one browser can't answer for, or take over, another's request. */
const ownId = (id: unknown, from: BrowserId) => typeof id === "string" && id.startsWith(`${from}.`);

/** Whether a log holds every entry of another, unchanged, and maybe more. */
function extendsLog(longer: Log, shorter: Log): boolean {
  return (
    Array.isArray(longer.entries) &&
    (shorter.entries.length === 0 || longer.copied === shorter.copied) &&
    longer.entries.length >= shorter.entries.length &&
    shorter.entries.every((e, i) => JSON.stringify(e) === JSON.stringify(longer.entries[i]))
  );
}

async function download(url: URL): Promise<Blob> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web links can be downloaded.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The link could not be downloaded (${res.status}).`);
  return res.blob();
}

export type { Entry };
