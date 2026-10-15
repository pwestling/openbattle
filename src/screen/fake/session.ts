// A fake session, so the screen can be built and proven before Session is.
// One browser only: it is always the host, and nothing is sent anywhere. Games are kept in
// localStorage so that coming back to a link works. Delete this folder when Session lands.
import type { Action, CardId, Fingerprint, Log, PlayerId, Size } from "../../record/index.ts";
import type { Me, Session, Snapshot } from "../../session/index.ts";
import { fakeHash, fakeTableAt } from "./fold.ts";

interface Kept {
  log: Log;
  me: PlayerId | "watch";
}

const keyOf = (link: string) => `openbattle-fake:${link}`;
const files = new Map<Fingerprint, Blob>();

/** What a proof can do to the fake from outside, to show the screen's reactions. */
const knobs = {
  connection: "playing" as Snapshot["connection"],
  disagreement: false,
  refuse: null as string | null,
  tamper: false,
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
    refuseNext(reason: string) {
      knobs.refuse = reason;
    },
    /** Takes an action as someone else, as if another browser had. */
    actAs(player: PlayerId, action: Action) {
      knobs.sessions.forEach((s) => s.append(action, player));
    },
    tamperNext() {
      knobs.tamper = true;
    },
  },
});

const randomId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 10);
const randomValue = () => crypto.randomUUID().replaceAll("-", "");

export function fakeKept(link: string): Kept | null {
  try {
    const text = localStorage.getItem(keyOf(link));
    return text ? (JSON.parse(text) as Kept) : null;
  } catch {
    return null;
  }
}

export function fakeKeep(link: string, kept: Kept): void {
  localStorage.setItem(keyOf(link), JSON.stringify(kept));
}

export function fakeFile(fingerprint: Fingerprint): Blob | null {
  return files.get(fingerprint) ?? null;
}

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

  private keep() {
    try {
      localStorage.setItem(keyOf(this.link), JSON.stringify({ log: this.log, me: this.me } satisfies Kept));
    } catch {
      // A browser refusing storage only means the game is not kept here.
    }
  }

  snapshot(): Snapshot {
    return {
      link: this.link,
      who: this.me === "watch" ? { watching: true } : { player: this.me, host: true },
      log: this.log,
      table: fakeTableAt(this.log),
      connection: knobs.connection,
      disagreement: knobs.disagreement,
      kept: true,
    };
  }

  notify() {
    const now = this.snapshot();
    this.listeners.forEach((l) => l(now));
  }

  append(action: Action, by: PlayerId) {
    this.log = { ...this.log, entries: [...this.log.entries, { n: this.log.entries.length + 1, by, action }] };
    this.keep();
    this.notify();
  }

  private async player(): Promise<PlayerId> {
    await new Promise((r) => setTimeout(r, 30));
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
    const hostValue = randomValue();
    const seal = knobs.tamper ? fakeHash("something else") : fakeHash(hostValue);
    knobs.tamper = false;
    const action: Action = { kind: "roll", dice, sides, seal, hostValue, guestValue: randomValue() };
    if (label) action.label = label;
    this.append(action, by);
    return fakeTableAt(this.log).rolls.at(-1)?.result ?? [];
  }

  async draw(deck: string, cards: number, to: "hand" | "table"): Promise<CardId[]> {
    const by = await this.player();
    const before = fakeTableAt(this.log).decks[deck];
    if (!before) throw new Error("There is no such deck.");
    if (before.cards.length < cards) throw new Error(`${before.name} is empty.`);
    this.append({ kind: "draw", deck, cards, to, seal: "", hostValue: randomValue(), guestValue: randomValue() }, by);
    const after = fakeTableAt(this.log).decks[deck]?.cards ?? [];
    return before.cards.filter((c) => !after.includes(c));
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
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const fingerprint = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    files.set(fingerprint, blob);
    return fingerprint;
  }

  leave(): void {
    knobs.sessions.delete(this);
    this.listeners.clear();
  }
}

export async function fakeOpen(size: Size, me: Me): Promise<Session> {
  const link = `${location.origin}/?game=${randomId()}`;
  const player = randomId();
  const session = new FakeSession(link, { size, entries: [] }, player);
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
  const kept = fakeKept(link);
  if (kept) return new FakeSession(link, kept.log, kept.me);
  // A game this browser has never seen: the fake has no host to catch up with, so it starts bare.
  if (as === "watch") return new FakeSession(link, { size: { width: 60, depth: 44 }, entries: [] }, "watch");
  const player = randomId();
  const session = new FakeSession(link, { size: { width: 60, depth: 44 }, entries: [] }, player);
  session.append({ kind: "join", name: as.name, colour: as.colour }, player);
  return session;
}
