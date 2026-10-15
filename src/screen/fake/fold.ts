// A stand-in for record.tableAt, used only by the fake session and only until Record is built.
// It folds a log to a table the way design/surfaces/record.html describes, without checking anything.
// Delete this file when Record lands.
import type { Action, Card, Entry, Log, Roll, Table } from "../../record/index.ts";

/** Which entries undo has cancelled: each undo cancels the latest uncancelled action. */
function cancelledIn(entries: Entry[]): Set<number> {
  const cancelled = new Set<number>();
  for (const entry of entries) {
    if (entry.action.kind !== "undo") continue;
    const target = [...entries].reverse().find((e) => e.n < entry.n && e.action.kind !== "undo" && !cancelled.has(e.n));
    if (target) cancelled.add(target.n);
  }
  return cancelled;
}

/** A small deterministic hash, standing in for SHA-256 in the fake's sealed exchange. */
export function fakeHash(text: string): string {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** Numbers from both values of a sealed exchange, the same in every browser. */
export function fakeNumbers(hostValue: string, guestValue: string, count: number, below: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(parseInt(fakeHash(`${hostValue}:${guestValue}:${i}`).slice(0, 8), 16) % below);
  return out;
}

export function fakeTableAt(log: Log, upTo = log.entries.length): Table {
  const entries = log.entries.slice(0, upTo);
  const cancelled = cancelledIn(entries);
  const t: Table = {
    size: log.size,
    players: {},
    terrain: {},
    units: {},
    models: {},
    groups: {},
    phase: { round: 1, turn: null, name: "" },
    counters: {},
    marks: {},
    rolls: [],
    decks: {},
    cards: {},
    cancelled: [...cancelled],
  };
  for (const entry of entries) {
    if (entry.action.kind === "undo" || cancelled.has(entry.n)) continue;
    apply(t, entry.n, entry.by, entry.action);
  }
  return t;
}

function apply(t: Table, n: number, by: string, a: Action): void {
  switch (a.kind) {
    case "join":
    case "rename":
      t.players[by] = { id: by, name: a.name, colour: a.colour };
      return;
    case "place terrain":
      t.terrain[a.terrain.id] = a.terrain;
      return;
    case "remove terrain":
      delete t.terrain[a.terrain];
      return;
    case "add to army":
      for (const u of a.units) t.units[u.id] = { id: u.id, owner: by, name: u.name };
      for (const m of a.models) t.models[m.id] = { ...m, path: [], aside: false };
      for (const g of a.groups) t.groups[g.id] = { ...g, owner: by };
      return;
    case "move":
      for (const m of a.moves) {
        const model = t.models[m.model];
        if (model) Object.assign(model, { position: m.position, facing: m.facing, floor: m.floor, path: m.path });
      }
      return;
    case "set aside":
      for (const id of a.models) {
        const model = t.models[id];
        if (model) model.aside = true;
      }
      return;
    case "return":
      for (const m of a.models) {
        const model = t.models[m.model];
        if (model) Object.assign(model, { position: m.position, facing: m.facing, floor: m.floor, aside: false, path: [] });
      }
      return;
    case "group":
      t.groups[a.group] = { id: a.group, owner: by, name: a.name, members: a.members };
      return;
    case "ungroup":
      delete t.groups[a.group];
      return;
    case "phase":
      t.phase = a.phase;
      return;
    case "counter": {
      const counters = (t.counters[a.target] ??= {});
      if (a.value === null) delete counters[a.name];
      else counters[a.name] = a.value;
      return;
    }
    case "mark": {
      const marks = (t.marks[a.target] ??= []).filter((m) => m !== a.name);
      t.marks[a.target] = a.on ? [...marks, a.name] : marks;
      return;
    }
    case "roll": {
      const roll: Roll = {
        at: n,
        by,
        dice: a.dice,
        sides: a.sides,
        result: fakeNumbers(a.hostValue, a.guestValue, a.dice, a.sides).map((v) => v + 1),
        tampered: fakeHash(a.hostValue) !== a.seal,
      };
      if (a.label !== undefined) roll.label = a.label;
      t.rolls.push(roll);
      return;
    }
    case "add deck": {
      for (const c of a.cards) t.cards[c.id] = { ...c, place: { in: "deck", deck: a.deck } };
      t.decks[a.deck] = { id: a.deck, name: a.name, owner: a.owner, order: a.order, cards: a.cards.map((c) => c.id), position: a.position };
      return;
    }
    case "shuffle": {
      const deck = t.decks[a.deck];
      if (deck) deck.order = "shuffled";
      return;
    }
    case "draw": {
      const deck = t.decks[a.deck];
      if (!deck) return;
      const picked: string[] = [];
      for (let i = 0; i < a.cards && deck.cards.length; i++) {
        const at =
          deck.order === "ordered" || !a.hostValue || !a.guestValue
            ? 0
            : (fakeNumbers(a.hostValue, a.guestValue, i + 1, deck.cards.length)[i] ?? 0);
        picked.push(...deck.cards.splice(at, 1));
      }
      picked.forEach((id, i) => {
        const card = t.cards[id];
        if (!card) return;
        card.place =
          a.to === "hand"
            ? { in: "hand", player: by }
            : { in: "table", position: { x: deck.position.x + 3 + i * 2.7, y: deck.position.y }, faceUp: true };
      });
      return;
    }
    case "move card": {
      const card: Card | undefined = t.cards[a.card];
      if (!card) return;
      if (card.place.in === "deck") {
        const from = t.decks[card.place.deck];
        if (from) from.cards = from.cards.filter((c) => c !== a.card);
      }
      card.place = a.to;
      if (a.to.in === "deck") {
        const into = t.decks[a.to.deck];
        if (!into) return;
        if (a.at === "bottom" || into.order === "shuffled") into.cards.push(a.card);
        else into.cards.splice(a.at ?? 0, 0, a.card);
      }
      return;
    }
    case "undo":
      return;
  }
}
