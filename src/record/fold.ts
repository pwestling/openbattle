// Working out the table from the log. Only ever called on actions check has accepted.
import { drawFrom, opens, rollDice } from "./chance.ts";
import type { Card, Entry, FloorRef, Log, Sealed, Size, Table } from "./types.ts";

export function bareTable(size: Size): Table {
  return {
    size: { width: size.width, depth: size.depth },
    players: {},
    terrain: {},
    units: {},
    models: {},
    groups: {},
    phase: { round: 0, turn: null, name: "" },
    counters: {},
    marks: {},
    rolls: [],
    decks: {},
    cards: {},
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
  return table;
}

const copy = <T>(value: T): T => structuredClone(value);

/** Puts back on the table any model whose floor no longer exists. */
function settle(table: Table) {
  for (const model of Object.values(table.models)) {
    if (model.floor && !table.terrain[model.floor.terrain]?.floors[model.floor.floor]) model.floor = null;
  }
}

const floorOf = (floor: FloorRef | null) => (floor ? { terrain: floor.terrain, floor: floor.floor } : null);

function apply(table: Table, { n, by, action }: Entry) {
  switch (action.kind) {
    case "undo":
      return;
    case "join":
      table.players[by] = { id: by, name: action.name, colour: action.colour };
      return;
    case "rename":
      table.players[by] = { id: by, name: action.name, colour: action.colour };
      return;
    case "place terrain":
      table.terrain[action.terrain.id] = copy(action.terrain);
      settle(table);
      return;
    case "remove terrain":
      delete table.terrain[action.terrain];
      settle(table);
      return;
    case "add to army":
      for (const unit of action.units) table.units[unit.id] = { id: unit.id, owner: by, name: unit.name };
      for (const m of action.models) {
        table.models[m.id] = {
          id: m.id,
          unit: m.unit,
          name: m.name,
          base: copy(m.base),
          ...(m.mesh === undefined ? {} : { mesh: m.mesh }),
          height: m.height,
          position: copy(m.position),
          facing: m.facing,
          floor: floorOf(m.floor),
          path: [],
          aside: false,
        };
      }
      for (const g of action.groups) table.groups[g.id] = { id: g.id, owner: by, name: g.name, members: [...g.members] };
      return;
    case "move":
      for (const move of action.moves) {
        const model = table.models[move.model]!;
        model.position = copy(move.position);
        model.facing = move.facing;
        model.floor = floorOf(move.floor);
        model.path = copy(move.path);
      }
      return;
    case "set aside":
      for (const id of action.models) table.models[id]!.aside = true;
      return;
    case "return":
      for (const back of action.models) {
        const model = table.models[back.model]!;
        model.position = copy(back.position);
        model.facing = back.facing;
        model.floor = floorOf(back.floor);
        model.path = [];
        model.aside = false;
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
      forget(table, action.group);
      return;
    case "phase":
      table.phase = copy(action.phase);
      return;
    case "counter": {
      const counters = (table.counters[action.target] ??= {});
      if (action.value === null) delete counters[action.name];
      else counters[action.name] = action.value;
      if (Object.keys(counters).length === 0) delete table.counters[action.target];
      return;
    }
    case "mark": {
      const marks = (table.marks[action.target] ?? []).filter((m) => m !== action.name);
      if (action.on) marks.push(action.name);
      if (marks.length) table.marks[action.target] = marks;
      else delete table.marks[action.target];
      return;
    }
    case "roll":
      table.rolls.push({
        at: n,
        by,
        dice: action.dice,
        sides: action.sides,
        ...(action.label === undefined ? {} : { label: action.label }),
        result: rollDice(action, action.dice, action.sides),
        tampered: !opens(action),
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
      deck.cards = deck.cards.filter((id) => !drawn.includes(id));
      for (const id of drawn) {
        table.cards[id]!.place =
          action.to === "hand" ? { in: "hand", player: by } : { in: "table", position: copy(deck.position), faceUp: true };
      }
      return;
    }
    case "move card": {
      const card = table.cards[action.card]!;
      if (card.place.in === "deck") {
        const from = table.decks[card.place.deck]!;
        from.cards = from.cards.filter((id) => id !== action.card);
      }
      card.place = copy(action.to);
      if (action.to.in === "deck") {
        const into = table.decks[action.to.deck]!;
        const at = into.order === "ordered" && typeof action.at === "number" ? action.at : action.at === "bottom" ? into.cards.length : 0;
        into.cards.splice(at, 0, action.card);
      }
      return;
    }
  }
}

/** Drops counters and marks on a target that no longer exists. */
function forget(table: Table, target: string) {
  delete table.counters[target];
  delete table.marks[target];
}
