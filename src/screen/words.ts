// Every action as a sentence for the log ("Ana moved Scouts 5.8″").
import type { Action, Entry, Log, PlayerId, Table } from "../record/index.ts";
import { distance } from "./stand-ins.ts";

/** Names for everything the log ever named, so removed things still read well. */
export interface Names {
  players: Map<string, string>;
  things: Map<string, string>;
}

export function namesIn(log: Log): Names {
  const players = new Map<string, string>();
  const things = new Map<string, string>();
  for (const { by, action: a } of log.entries) {
    if (a.kind === "join" || a.kind === "rename") players.set(by, a.name);
    else if (a.kind === "place terrain") things.set(a.terrain.id, a.terrain.name);
    else if (a.kind === "add to army") {
      for (const u of a.units) things.set(u.id, u.name);
      for (const m of a.models) things.set(m.id, m.name);
      for (const g of a.groups) things.set(g.id, g.name);
    } else if (a.kind === "group") things.set(a.group, a.name);
    else if (a.kind === "add deck") {
      things.set(a.deck, a.name);
      for (const c of a.cards) things.set(c.id, c.name);
    }
  }
  return { players, things };
}

const possessive = (name: string) => (name.endsWith("s") ? `${name}’` : `${name}’s`);

const inches = (n: number) => `${Math.round(n * 10) / 10}″`;

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "nothing";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function sentence(entry: Entry, log: Log, table: Table, names: Names, me: PlayerId | null): string {
  const who = names.players.get(entry.by) ?? "Someone";
  const name = (id: string) => names.things.get(id) ?? names.players.get(id) ?? (id === "game" ? "the game" : "something");
  const unitOf = (model: string) => {
    for (const e of log.entries) {
      if (e.action.kind !== "add to army") continue;
      const m = e.action.models.find((x) => x.id === model);
      if (m) return m.unit;
    }
    return model;
  };
  const a: Action = entry.action;
  switch (a.kind) {
    case "join":
      return `${who} joined`;
    case "rename": {
      const before = log.entries.findLast(
        (e) => e.n < entry.n && e.by === entry.by && (e.action.kind === "join" || e.action.kind === "rename"),
      );
      const was = before && "name" in before.action ? before.action.name : who;
      return `${was} is now ${a.name}`;
    }
    case "place terrain": {
      const before = log.entries.some((e) => e.n < entry.n && e.action.kind === "place terrain" && e.action.terrain.id === a.terrain.id);
      return `${who} ${before ? "changed" : "placed"} ${a.terrain.name}`;
    }
    case "remove terrain":
      return `${who} removed ${name(a.terrain)}`;
    case "add to army": {
      const parts = new Map<string, number>();
      for (const m of a.models) parts.set(m.unit, (parts.get(m.unit) ?? 0) + 1);
      return `${who} added ${list([...parts].map(([u, n]) => (n === 1 ? name(u) : `${name(u)} (${n} models)`)))}`;
    }
    case "move": {
      // Each unit's distance is the longest path any of its models took.
      const longest = new Map<string, number>();
      for (const m of a.moves) {
        const [first, ...rest] = m.path;
        const last = rest.pop();
        const across = first && last ? distance(table, first, last, rest).across : 0;
        const unit = unitOf(m.model);
        longest.set(unit, Math.max(longest.get(unit) ?? 0, across));
      }
      return `${who} moved ${list([...longest].map(([u, d]) => `${name(u)} ${inches(d)}`))}`;
    }
    case "set aside":
      return `${who} set aside ${describeModels(a.models, unitOf, name)}`;
    case "return":
      return `${who} returned ${describeModels(
        a.models.map((m) => m.model),
        unitOf,
        name,
      )}`;
    case "group":
      return `${who} grouped ${list(a.members.map(name))} as ${a.name}`;
    case "ungroup":
      return `${who} ungrouped ${name(a.group)}`;
    case "phase": {
      const turn = a.phase.turn ? `, ${possessive(names.players.get(a.phase.turn) ?? "someone")} turn` : "";
      return `${who} set round ${a.phase.round}${turn}${a.phase.name ? `, ${a.phase.name}` : ""}`;
    }
    case "counter":
      return a.value === null
        ? `${who} cleared ${possessive(name(a.target))} ${a.name}`
        : `${who} set ${possessive(name(a.target))} ${a.name} to ${a.value}`;
    case "mark":
      return `${who} ${a.on ? "marked" : "unmarked"} ${name(a.target)} ${a.name}`;
    case "roll": {
      const roll = table.rolls.find((r) => r.at === entry.n);
      const result = roll ? `: ${roll.result.join(", ")}` : "";
      return `${who} rolled ${a.dice}d${a.sides}${a.label ? ` for ${a.label}` : ""}${result}${roll?.tampered ? " (tampered!)" : ""}`;
    }
    case "add deck":
      return `${who} added the deck ${a.name} (${plural(a.cards.length, "card")}, ${a.order})`;
    case "shuffle":
      return `${who} shuffled ${name(a.deck)}`;
    case "draw":
      return `${who} drew ${plural(a.cards, "card")} from ${name(a.deck)} ${a.to === "hand" ? (entry.by === me ? "into your hand" : "into their hand") : "face up"}`;
    case "move card": {
      const to = a.to;
      if (to.in === "hand")
        return `${who} took ${to.player === me ? name(a.card) : "a card"} into ${to.player === entry.by ? "their" : possessive(name(to.player))} hand`;
      if (to.in === "table") return `${who} played ${to.faceUp ? name(a.card) : "a card face down"} onto the table`;
      if (to.in === "discard") return `${who} discarded ${name(a.card)}`;
      return `${who} put a card ${a.at === "bottom" ? "at the bottom of" : "back into"} ${name(to.deck)}`;
    }
    case "undo":
      return `${who} undid their last action`;
  }
}

function describeModels(models: string[], unitOf: (m: string) => string, name: (id: string) => string): string {
  const units = new Map<string, number>();
  for (const m of models) units.set(unitOf(m), (units.get(unitOf(m)) ?? 0) + 1);
  return list([...units].map(([u, n]) => (n === 1 ? name(u) : `${name(u)} (${n} models)`)));
}
