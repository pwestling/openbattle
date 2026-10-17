// Working out the table from the log. Only ever called on actions check has accepted.
import { drawFrom, opens, rollDice } from "./chance.ts";
import type { ByTarget, Card, Entry, FloorRef, Log, Sealed, Size, Stats, Table, Target } from "./types.ts";

/**
 * A record keyed by ids, with nothing inherited, so an id such as "__proto__" or "toString"
 * is only ever a key the log put there.
 */
const byId = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;

const byTarget = <T>(game: T): ByTarget<T> => ({
  model: byId(),
  unit: byId(),
  group: byId(),
  player: byId(),
  terrain: byId(),
  marker: byId(),
  item: byId(),
  game,
});

export function bareTable(size: Size): Table {
  return {
    size: { width: size.width, depth: size.depth },
    players: byId(),
    terrain: byId(),
    units: byId(),
    models: byId(),
    groups: byId(),
    items: byId(),
    markers: byId(),
    phase: { round: 0, turn: null, name: "" },
    priority: { players: [], note: "" },
    rules: null,
    counters: byTarget(byId<number>()),
    marks: byTarget<string[]>([]),
    rolls: [],
    draws: [],
    decks: byId(),
    cards: byId(),
    cancelled: [],
  };
}

/**
 * The log numbers that undo has cancelled among these entries. Undo cancels the latest action
 * not yet cancelled; an undo is never itself cancelled.
 */
export function cancelledIn(entries: Entry[]): number[] {
  const standing: number[] = [];
  const cancelled: number[] = [];
  for (const entry of entries) {
    if (entry.action.kind !== "undo") standing.push(entry.n);
    else {
      const n = standing.pop();
      if (n !== undefined) cancelled.push(n);
    }
  }
  return cancelled.sort((a, b) => a - b);
}

/** The latest entry undo would cancel next, if any. */
export function latestStanding(entries: Entry[]): Entry | undefined {
  const cancelled = new Set(cancelledIn(entries));
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    if (entry.action.kind !== "undo" && !cancelled.has(entry.n)) return entry;
  }
  return undefined;
}

export function fold(log: Log, upTo: number): Table {
  const entries = log.entries.slice(0, upTo);
  const table = bareTable(log.size);
  table.cancelled = cancelledIn(entries);
  const cancelled = new Set(table.cancelled);
  for (const entry of entries) {
    if (entry.action.kind !== "undo" && !cancelled.has(entry.n)) apply(table, entry);
  }
  placeInDecks(table);
  return table;
}

/**
 * A deck's list is the one record of which cards are in it and in what order. A card in a deck takes
 * its place from that list once the log is applied, so no action has to keep the two in step.
 */
function placeInDecks(table: Table) {
  for (const deck of Object.values(table.decks)) for (const id of deck.cards) table.cards[id]!.place = { in: "deck", deck: deck.id };
}

const copy = <T>(value: T): T => structuredClone(value);

/** Puts back on the table any model whose floor no longer exists. */
function settle(table: Table) {
  for (const model of Object.values(table.models)) {
    const place = model.place;
    if (place.in === "table" && place.floor && !table.terrain[place.floor.terrain]?.floors[place.floor.floor]) place.floor = null;
  }
}

const floorOf = (floor: FloorRef | null) => (floor ? { terrain: floor.terrain, floor: floor.floor } : null);

function apply(table: Table, { n, by, action }: Entry) {
  switch (action.kind) {
    case "undo":
      return;
    case "join":
      table.players[by] = { id: by, name: action.name, colour: action.colour, publicKey: action.publicKey };
      return;
    case "rename":
      table.players[by] = { publicKey: "", ...table.players[by], id: by, name: action.name, colour: action.colour };
      return;
    case "place terrain": {
      // Placing a piece again keeps its lock; only "lock terrain" changes it.
      const { locked: _, ...placed } = copy(action.terrain);
      table.terrain[placed.id] = table.terrain[placed.id]?.locked ? { ...placed, locked: true } : placed;
      settle(table);
      return;
    }
    case "lock terrain":
      for (const id of action.terrain) {
        const piece = table.terrain[id]!;
        if (action.locked) piece.locked = true;
        else delete piece.locked;
      }
      return;
    case "remove terrain":
      delete table.terrain[action.terrain];
      forget(table, { terrain: action.terrain });
      settle(table);
      return;
    case "add to army":
      for (const unit of action.units) {
        table.units[unit.id] = { id: unit.id, owner: by, name: unit.name };
        stats(table, { unit: unit.id }, unit);
      }
      for (const m of action.models) {
        table.models[m.id] = {
          id: m.id,
          unit: m.unit,
          name: m.name,
          base: copy(m.base),
          ...(m.mesh === undefined ? {} : { mesh: m.mesh }),
          height: m.height,
          place: { in: "table", position: copy(m.position), facing: m.facing, floor: floorOf(m.floor) },
          path: [],
        };
        stats(table, { model: m.id }, m);
      }
      for (const item of action.items ?? []) {
        table.items[item.id] = { id: item.id, name: item.name, carrier: item.carrier };
        stats(table, { item: item.id }, item);
      }
      for (const g of action.groups) table.groups[g.id] = { id: g.id, owner: by, name: g.name, members: [...g.members] };
      return;
    case "move":
      for (const move of action.moves) {
        const model = table.models[move.model]!;
        model.place = { in: "table", position: copy(move.position), facing: move.facing, floor: floorOf(move.floor) };
        model.path = copy(move.path);
      }
      return;
    case "set aside":
      for (const id of action.models) table.models[id]!.place = { in: action.to ?? "removed" };
      return;
    case "return":
      for (const back of action.models) {
        const model = table.models[back.model]!;
        model.place = { in: "table", position: copy(back.position), facing: back.facing, floor: floorOf(back.floor) };
        model.path = [];
      }
      return;
    case "group": {
      const owner = table.groups[action.group]?.owner ?? by;
      table.groups[action.group] = { id: action.group, owner, name: action.name, members: [...action.members] };
      return;
    }
    case "ungroup":
      delete table.groups[action.group];
      for (const group of Object.values(table.groups)) group.members = group.members.filter((m) => m !== action.group);
      forget(table, { group: action.group });
      return;
    case "phase":
      table.phase = copy(action.phase);
      return;
    case "counter": {
      const counters = Object.assign(byId<number>(), countersOn(table, action.target));
      if (action.value === null) delete counters[action.name];
      else counters[action.name] = action.value;
      keep(table.counters, action.target, Object.keys(counters).length ? counters : undefined, byId());
      return;
    }
    case "mark": {
      const marks = (marksOn(table, action.target) ?? []).filter((m) => m !== action.name);
      if (action.on) marks.push(action.name);
      keep(table.marks, action.target, marks.length ? marks : undefined, []);
      return;
    }
    case "item": {
      const { id, name, carrier } = action.item;
      table.items[id] = { id, name, carrier };
      return;
    }
    case "remove item":
      for (const id of heldIn(table, action.item)) {
        delete table.items[id];
        forget(table, { item: id });
      }
      return;
    case "place marker":
      table.markers[action.marker.id] = copy(action.marker);
      return;
    case "remove marker":
      delete table.markers[action.marker];
      forget(table, { marker: action.marker });
      return;
    case "priority":
      table.priority = { players: [...action.players], note: action.note ?? "" };
      return;
    case "rules":
      table.rules = action.name;
      return;
    case "roll":
      table.rolls.push({
        at: n,
        by,
        dice: action.dice,
        sides: action.sides,
        ...(action.label === undefined ? {} : { label: action.label }),
        result: rollDice(action, action.dice, action.sides),
        tampered: !opens(action),
        alone: action.guestBy === null,
      });
      return;
    case "add deck": {
      table.decks[action.deck] = {
        id: action.deck,
        name: action.name,
        owner: action.owner,
        order: action.order,
        cards: action.cards.map((c) => c.id),
        position: copy(action.position),
      };
      for (const c of action.cards) {
        // Its place comes from the deck's list (placeInDecks).
        const card: Card = { id: c.id, name: c.name, place: { in: "deck", deck: action.deck } };
        if (c.text !== undefined) card.text = c.text;
        if (c.picture !== undefined) card.picture = c.picture;
        table.cards[c.id] = card;
      }
      return;
    }
    case "shuffle":
      table.decks[action.deck]!.order = "shuffled";
      return;
    case "draw": {
      const deck = table.decks[action.deck]!;
      const drawn =
        deck.order === "ordered" ? deck.cards.slice(0, action.cards) : drawFrom(action as Sealed, deck.cards, action.cards);
      const taken = new Set(drawn);
      deck.cards = deck.cards.filter((id) => !taken.has(id));
      table.draws.push({
        at: n,
        by,
        deck: action.deck,
        cards: drawn,
        to: action.to,
        tampered: deck.order === "shuffled" && !opens(action as Sealed),
        alone: deck.order === "shuffled" && (action as Sealed).guestBy === null,
      });
      for (const id of drawn) {
        table.cards[id]!.place =
          action.to === "hand" ? { in: "hand", player: by } : { in: "table", position: copy(deck.position), faceUp: true };
      }
      return;
    }
    case "move card": {
      for (const deck of Object.values(table.decks)) deck.cards = deck.cards.filter((id) => id !== action.card);
      table.cards[action.card]!.place = copy(action.to);
      if (action.to.in === "deck") {
        const into = table.decks[action.to.deck]!;
        const at = into.order === "ordered" && typeof action.at === "number" ? action.at : action.at === "bottom" ? into.cards.length : 0;
        into.cards.splice(at, 0, action.card);
      }
      return;
    }
  }
}

/** Sets the counters and marks a new unit, model or item comes with. */
function stats(table: Table, target: Target, { counters, marks }: Stats) {
  if (counters && Object.keys(counters).length) keep(table.counters, target, Object.assign(byId<number>(), counters), byId());
  if (marks?.length) keep(table.marks, target, [...new Set(marks)], []);
}

const countersOn = (table: Table, target: Target) => ("game" in target ? table.counters.game : held(table.counters, target));
const marksOn = (table: Table, target: Target) => ("game" in target ? table.marks.game : held(table.marks, target));

/** What is kept for a thing, by its kind and id. */
function held<T>(all: ByTarget<T>, target: Exclude<Target, { game: true }>): T | undefined {
  const [kind, id] = Object.entries(target)[0] as [Exclude<keyof ByTarget<T>, "game">, string];
  return all[kind][id];
}

/** Keeps a value for a target, or drops it when undefined (the game's goes back to empty). */
function keep<T>(all: ByTarget<T>, target: Target, value: T | undefined, empty: T) {
  if ("game" in target) {
    all.game = value ?? empty;
    return;
  }
  const [kind, id] = Object.entries(target)[0] as [Exclude<keyof ByTarget<T>, "game">, string];
  if (value === undefined) delete all[kind][id];
  else all[kind][id] = value;
}

/** An item and every item it holds, through any depth. */
export function heldIn(table: Table, item: string): string[] {
  const all = [item];
  for (let i = 0; i < all.length; i++) {
    for (const other of Object.values(table.items)) if (other.carrier === all[i]) all.push(other.id);
  }
  return all;
}

/** Drops counters and marks on a target that no longer exists. */
function forget(table: Table, target: Target) {
  keep(table.counters, target, undefined, byId());
  keep(table.marks, target, undefined, []);
}
