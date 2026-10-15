// A fake session, so the screen can be built and proven before Session is.
// One browser only: it is always the host, and nothing is sent anywhere. Actions are checked and
// folded by Record, and games and files are kept with Archive, as the real session does.
// Delete this folder when Session lands.
import type { Action, CardId, Fingerprint, Log, PlayerId, Size } from "../../record/index.ts";
import * as archive from "../../archive/index.ts";
import * as record from "../../record/index.ts";
import type { Me, Session, Snapshot } from "../../session/index.ts";

/** The hex SHA-256 of some text, as the sealed exchange's seal is (ADR-008). */
async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** What a proof can do to the fake from outside, to show the screen's reactions. */
const knobs = {
  connection: "playing" as Snapshot["connection"],
  disagreement: false,
  refuse: null as string | null,
  tamper: false,
  unreachable: false,
  /** Whether another player's browser is taken to be connected, to send the other value. */
  company: false,
  /** How long the host takes to answer an action, in milliseconds. */
  delay: 30,
  sessions: new Set<FakeSession>(),
};
Object.assign(window, {
  openbattleFake: {
    setConnection(c: Snapshot["connection"]) {
      knobs.connection = c;
      knobs.sessions.forEach((s) => s.notify());
    },
    setDisagreement(on: boolean) {
      knobs.disagreement = on;
      knobs.sessions.forEach((s) => s.notify());
    },
    /** Makes the host slow to answer, as over a poor connection. */
    setDelay(ms: number) {
      knobs.delay = ms;
    },
    refuseNext(reason: string) {
      knobs.refuse = reason;
    },
    /** The log as this browser has it. */
    log() {
      return [...knobs.sessions][0]?.snapshot().log;
    },
    /** Someone else joins, as if from another browser; resolves to their player id. */
    join(name: string, colour: string) {
      const { publicKey, id } = newKey();
      knobs.sessions.forEach((s) => s.append({ kind: "join", name, colour, publicKey }, id));
      return id;
    },
    /** Takes an action as someone else, as if another browser had. */
    actAs(player: PlayerId, action: Action) {
      knobs.sessions.forEach((s) => s.append(action, player));
    },
    /** A file arriving in this browser, as it would from another browser; resolves to its fingerprint. */
    arrive(text: string) {
      const session = [...knobs.sessions][0];
      return archive.keepFile(session?.snapshot().link ?? "", new Blob([text]));
    },
    /** Pretends another player is connected, so the host's rolls use their value rather than being made alone. */
    setCompany(on: boolean) {
      knobs.company = on;
    },
    /** Makes new games fail as if the server could not be reached. */
    setUnreachable(on: boolean) {
      knobs.unreachable = on;
    },
    tamperNext() {
      knobs.tamper = true;
    },
  },
});

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

/** A made-up browser key and the player id it gives (ADR-022). Nothing is ever signed with it. */
function newKey(): { publicKey: string; id: PlayerId } {
  const publicKey = base64url(crypto.getRandomValues(new Uint8Array(65)));
  return { publicKey, id: record.playerIdOf(publicKey)! };
}

/** This browser's key, the same for every game while the page is open. */
const mine = newKey();

/** As Session makes them: 8 random base64url characters, "-", then the host's browser id. */
const gameId = (host: PlayerId) => `${base64url(crypto.getRandomValues(new Uint8Array(6)))}-${host}`;

const randomValue = () => crypto.randomUUID().replaceAll("-", "");

class FakeSession implements Session {
  private listeners = new Set<(now: Snapshot) => void>();
  private link: string;
  private log: Log;
  private me: PlayerId | "watch";
  constructor(link: string, log: Log, me: PlayerId | "watch") {
    this.link = link;
    this.log = log;
    this.me = me;
    knobs.sessions.add(this);
    this.keep();
  }

  private kept = true;

  private keep() {
    archive.save(this.link, { log: this.log, me: this.me }).catch(() => {
      // A browser refusing storage only means the game is not kept here.
      this.kept = false;
      this.notify();
    });
  }

  snapshot(): Snapshot {
    return {
      link: this.link,
      who: this.me === "watch" ? { watching: true } : { player: this.me, host: this.me === this.log.host },
      log: this.log,
      table: record.tableAt(this.log),
      connection: knobs.connection,
      disagreement: knobs.disagreement,
      kept: this.kept,
    };
  }

  notify() {
    const now = this.snapshot();
    this.listeners.forEach((l) => l(now));
  }

  /** Appends an action if Record allows it, as the host would; otherwise rejects with Record's reason. */
  append(action: Action, by: PlayerId) {
    this.log = record.append(this.log, action, by);
    this.keep();
    this.notify();
  }

  private async player(): Promise<PlayerId> {
    await new Promise((r) => setTimeout(r, knobs.delay));
    if (this.me === "watch") throw new Error("Spectators can't change the game.");
    if (knobs.connection === "host away") throw new Error("The host is away.");
    if (knobs.refuse) {
      const reason = knobs.refuse;
      knobs.refuse = null;
      throw new Error(reason);
    }
    return this.me;
  }

  async act(action: Action): Promise<void> {
    this.append(action, await this.player());
  }

  async roll(dice: number, sides: number, label?: string): Promise<number[]> {
    const by = await this.player();
    const action: Action = { kind: "roll", dice, sides, ...(await this.sealed(by)) };
    if (label) action.label = label;
    this.append(action, by);
    return record.tableAt(this.log).rolls.at(-1)?.result ?? [];
  }

  /** Both values of the sealed exchange; with tamperNext, a seal the host's value doesn't open. */
  private async sealed(by: PlayerId) {
    const hostValue = randomValue();
    const seal = await sha256(knobs.tamper ? "something else" : hostValue);
    knobs.tamper = false;
    const values = { link: this.log.link, seal, hostValue, guestValue: randomValue() };
    // The other value comes from the taker, or for the host from another connected player (ADR-022);
    // with nobody else connected, the host takes it alone (ADR-023).
    const host = this.log.host;
    const other = Object.keys(record.tableAt(this.log).players).find((p) => p !== host);
    const guestBy = by !== host ? by : knobs.company ? other : undefined;
    return guestBy ? { ...values, guestBy, guestSignature: "not checked by the fake" } : { ...values, guestBy: null };
  }

  async draw(deck: string, cards: number, to: "hand" | "table"): Promise<CardId[]> {
    const by = await this.player();
    const before = record.tableAt(this.log).decks[deck];
    if (!before) throw new Error("There is no such deck.");
    if (before.cards.length < cards) throw new Error(`${before.name} is empty.`);
    const sealed = before.order === "shuffled" ? await this.sealed(by) : {};
    this.append({ kind: "draw", deck, cards, to, ...sealed }, by);
    return record.tableAt(this.log).draws.at(-1)?.cards ?? [];
  }

  watch(listener: (now: Snapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  async resync(): Promise<void> {
    knobs.disagreement = false;
    this.notify();
  }

  async addFile(source: Blob | URL): Promise<Fingerprint> {
    await this.player();
    const blob = source instanceof Blob ? source : await (await fetch(source)).blob();
    return archive.keepFile(this.link, blob);
  }

  leave(): void {
    knobs.sessions.delete(this);
    this.listeners.clear();
  }
}

const urlOf = (id: string) => `${location.origin}/?game=${id}`;

/** A new game. From a saved log, it starts from that log, and this browser joins it unless it is already a player there. */
export async function fakeOpen(size: Size, me: Me, from?: Log): Promise<Session> {
  if (knobs.unreachable) throw new Error("The relay cannot be reached.");
  const log = from ? record.reopen(from, gameId(mine.id), mine.id) : record.newLog(size, gameId(mine.id), mine.id);
  const session = new FakeSession(urlOf(log.link), log, mine.id);
  if (!record.tableAt(log).players[mine.id])
    session.append({ kind: "join", name: me.name, colour: me.colour, publicKey: mine.publicKey }, mine.id);
  return session;
}

export async function fakeEnter(link: string, as: Me | "watch"): Promise<Session> {
  let id: string | null;
  try {
    id = new URL(link).searchParams.get("game");
  } catch {
    throw new Error("That is not a game link.");
  }
  if (!id || id.length < 31) throw new Error("That is not a game link.");
  const kept = await archive.load(link);
  if (kept) return new FakeSession(link, kept.log, kept.me);
  // A game this browser has never seen: the fake has no host to catch up with, so it starts bare.
  const log = record.newLog({ width: 60, depth: 44 }, id, id.slice(9, 31));
  if (as === "watch") return new FakeSession(link, log, "watch");
  const session = new FakeSession(link, log, mine.id);
  session.append({ kind: "join", name: as.name, colour: as.colour, publicKey: mine.publicKey }, mine.id);
  return session;
}
