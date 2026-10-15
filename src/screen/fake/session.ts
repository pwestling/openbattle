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
    /** Takes an action as someone else, as if another browser had. */
    actAs(player: PlayerId, action: Action) {
      knobs.sessions.forEach((s) => s.append(action, player));
    },
    /** A file arriving in this browser, as it would from another browser; resolves to its fingerprint. */
    arrive(text: string) {
      const session = [...knobs.sessions][0];
      return archive.keepFile(session?.snapshot().link ?? "", new Blob([text]));
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

const randomId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 10);
/** As Session makes them: 8 random base64url characters, "-", then the host's browser id. */
const gameId = (host: string) => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_")}-${host}`;
};
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
      who: this.me === "watch" ? { watching: true } : { player: this.me, host: true },
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
    const action: Action = { kind: "roll", dice, sides, ...(await this.sealed()) };
    if (label) action.label = label;
    this.append(action, by);
    return record.tableAt(this.log).rolls.at(-1)?.result ?? [];
  }

  /** Both values of the sealed exchange; with tamperNext, a seal the host's value doesn't open. */
  private async sealed() {
    const hostValue = randomValue();
    const seal = await sha256(knobs.tamper ? "something else" : hostValue);
    knobs.tamper = false;
    return { seal, hostValue, guestValue: randomValue() };
  }

  async draw(deck: string, cards: number, to: "hand" | "table"): Promise<CardId[]> {
    const by = await this.player();
    const before = record.tableAt(this.log).decks[deck];
    if (!before) throw new Error("There is no such deck.");
    if (before.cards.length < cards) throw new Error(`${before.name} is empty.`);
    const sealed = before.order === "shuffled" ? await this.sealed() : {};
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

/** A new game; from a saved log, it starts from that log with this browser in its first player's seat. */
export async function fakeOpen(size: Size, me: Me, from?: Log): Promise<Session> {
  if (knobs.unreachable) throw new Error("The relay cannot be reached.");
  const link = `${location.origin}/?game=${gameId(randomId())}`;
  if (from) {
    const first = from.entries.find((e) => e.action.kind === "join")?.by;
    if (!first) throw new Error("That saved game has no players.");
    return new FakeSession(link, from, first);
  }
  const player = randomId();
  const session = new FakeSession(link, record.newLog(size), player);
  session.append({ kind: "join", name: me.name, colour: me.colour }, player);
  return session;
}

export async function fakeEnter(link: string, as: Me | "watch"): Promise<Session> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new Error("That is not a game link.");
  }
  if (!url.searchParams.get("game")) throw new Error("That is not a game link.");
  const kept = await archive.load(link);
  if (kept) return new FakeSession(link, kept.log, kept.me);
  // A game this browser has never seen: the fake has no host to catch up with, so it starts bare.
  if (as === "watch") return new FakeSession(link, record.newLog({ width: 60, depth: 44 }), "watch");
  const player = randomId();
  const session = new FakeSession(link, record.newLog({ width: 60, depth: 44 }), player);
  session.append({ kind: "join", name: as.name, colour: as.colour }, player);
  return session;
}
