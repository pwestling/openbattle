// Whether an action can be appended: everything it names exists, numbers are finite, no group
// contains itself, and the player may take it. Game rules are never checked.
import { latestStanding } from "./fold.ts";
import { playerIdOf } from "./keys.ts";
import type { Action, Base, CardPlace, FloorRef, Item, Log, Marker, PlayerId, Point, Sealed, Shape, Stats, Table, Terrain } from "./types.ts";

/** Dice per roll: more would freeze every browser in the game (ADR-020). */
const mostDice = 1024;

/** A refusal, thrown inside the checks and returned as a Problem by check. */
class Refused extends Error {}

const refuse = (problem: string): never => {
  throw new Refused(problem);
};

const isText = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isWhole = (value: unknown): value is number => Number.isInteger(value);

function text(value: unknown, what: string) {
  if (!isText(value)) refuse(`${what} must be text.`);
}

function number(value: unknown, what: string) {
  if (!isNumber(value)) refuse(`${what} must be a finite number.`);
}

function positive(value: unknown, what: string) {
  if (!isNumber(value) || value <= 0) refuse(`${what} must be a positive number.`);
}

function point(value: unknown, what: string) {
  const p = value as Point;
  if (typeof p !== "object" || p === null || !isNumber(p.x) || !isNumber(p.y)) refuse(`${what} must be a point with finite x and y.`);
}

function points(value: unknown, what: string) {
  if (!Array.isArray(value)) refuse(`${what} must be a list of points.`);
  (value as unknown[]).forEach((p, i) => point(p, `${what} point ${i + 1}`));
}

function list<T>(value: unknown, what: string): T[] {
  if (!Array.isArray(value)) refuse(`${what} must be a list.`);
  return value as T[];
}

function distinct(ids: string[], what: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) refuse(`${what} "${id}" is named twice.`);
    seen.add(id);
  }
}

/** What an id already names in the game, if anything. Every id is unique within the game. */
function named(table: Table, id: string): string | null {
  if (table.players[id]) return "a player";
  if (table.terrain[id]) return "a terrain piece";
  if (table.units[id]) return "a unit";
  if (table.models[id]) return "a model";
  if (table.groups[id]) return "a group";
  if (table.decks[id]) return "a deck";
  if (table.cards[id]) return "a card";
  if (table.items[id]) return "an item";
  if (table.markers[id]) return "a marker";
  return null;
}

function fresh(table: Table, id: unknown, what: string) {
  text(id, `The ${what}'s id`);
  const already = named(table, id as string);
  if (already) refuse(`The id "${id}" for the new ${what} already names ${already}.`);
}

function player(table: Table, id: unknown, what: string) {
  if (!isText(id) || !table.players[id]) refuse(`${what} "${String(id)}" has not joined the game.`);
}

function onTable(table: Table, id: unknown) {
  const model = isText(id) ? table.models[id] : undefined;
  if (!model) return refuse(`There is no model "${String(id)}".`);
  if (model.place.in !== "table") refuse(`Model "${id}" is set aside; return it to the table first.`);
}

function floor(table: Table, ref: FloorRef | null, what: string) {
  if (ref === null) return;
  if (typeof ref !== "object" || !isText(ref.terrain) || !isWhole(ref.floor)) refuse(`${what} must name a terrain piece and a floor, or none.`);
  const piece = table.terrain[ref.terrain];
  if (!piece) refuse(`${what} is on terrain "${ref.terrain}", which is not on the table.`);
  if (!piece!.floors[ref.floor]) refuse(`Terrain "${ref.terrain}" has no floor ${ref.floor}.`);
}

function base(value: Base, what: string) {
  if (typeof value !== "object" || value === null || !["round", "oval", "rect"].includes(value.shape))
    refuse(`${what} must be round, oval or rect.`);
  positive(value.width, `${what} width`);
  positive(value.depth, `${what} depth`);
  if (value.shape === "round" && value.width !== value.depth) refuse(`${what} is round, so its width and depth must be equal.`);
}

function shape(value: Shape) {
  if (typeof value !== "object" || value === null || !["box", "cylinder", "ramp", "mesh"].includes(value.kind))
    refuse("A terrain piece's shape must be a box, cylinder, ramp or mesh.");
  if (value.kind === "mesh") text(value.mesh, "The mesh's fingerprint");
  positive(value.width, "The terrain piece's width");
  positive(value.depth, "The terrain piece's depth");
  positive(value.height, "The terrain piece's height");
}

function terrain(table: Table, piece: Terrain) {
  if (typeof piece !== "object" || piece === null) refuse("The terrain piece is missing.");
  text(piece.id, "The terrain piece's id");
  if (!table.terrain[piece.id]) fresh(table, piece.id, "terrain piece");
  text(piece.name, "The terrain piece's name");
  shape(piece.shape);
  point(piece.position, "The terrain piece's position");
  number(piece.facing, "The terrain piece's facing");
  list<Terrain["floors"][number]>(piece.floors, "The terrain piece's floors").forEach((f, i) => {
    number(f?.height, `Floor ${i}'s height`);
    points(f.outline, `Floor ${i}'s outline`);
  });
}

/** Units and groups a group may hold; checks none of them, followed through groups, is the group itself. */
function members(table: Table, group: string, members: unknown, extra: Map<string, string[] | null> = new Map()) {
  const ids = list<string>(members, "A group's members");
  distinct(ids, "Member");
  const membersOf = (id: string): string[] | null | undefined =>
    id === group ? ids : extra.has(id) ? extra.get(id) : table.units[id] ? null : table.groups[id]?.members;
  for (const id of ids) {
    if (!isText(id) || membersOf(id) === undefined) refuse(`Group "${group}" names "${String(id)}", which is not a unit or group.`);
  }
  const seen = new Set<string>();
  const visit = (id: string) => {
    for (const member of membersOf(id) ?? []) {
      if (member === group) refuse(`Group "${group}" would contain itself.`);
      if (!seen.has(member)) {
        seen.add(member);
        visit(member);
      }
    }
  };
  visit(group);
}

/** Each kind of thing a counter or mark can be on, and where the table keeps them. */
const kinds = {
  model: ["models", "model"],
  unit: ["units", "unit"],
  group: ["groups", "group"],
  player: ["players", "player"],
  terrain: ["terrain", "terrain piece"],
  marker: ["markers", "marker"],
  item: ["items", "item"],
} as const;

function target(table: Table, value: unknown) {
  const entries = typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : [];
  if (entries.length !== 1) refuse("A target is one model, unit, group, player, terrain piece, marker or item, or the game.");
  const [kind, id] = entries[0]!;
  if (kind === "game") {
    if (id !== true) refuse("The game is named as { game: true }.");
    return;
  }
  if (!Object.hasOwn(kinds, kind)) refuse(`"${kind}" is not a model, unit, group, player, terrain piece, marker, item or the game.`);
  const [where, word] = kinds[kind as keyof typeof kinds];
  if (!isText(id) || !table[where][id]) refuse(`There is no ${word} "${String(id)}".`);
}

/** One or more targets, none named twice. */
function targets(table: Table, value: unknown) {
  const all = list<unknown>(value, "The targets");
  if (all.length === 0) refuse("Name at least one target.");
  all.forEach((t) => target(table, t));
  distinct(all.map((t) => JSON.stringify(t)), "Target");
}

function stats(value: Stats, what: string) {
  if (value.counters !== undefined) {
    if (typeof value.counters !== "object" || value.counters === null || Array.isArray(value.counters)) refuse(`${what}'s counters must be named numbers.`);
    for (const [name, n] of Object.entries(value.counters)) number(n, `${what}'s counter "${name}"`);
  }
  if (value.marks !== undefined) list<unknown>(value.marks, `${what}'s marks`).forEach((m) => text(m, `${what}'s mark`));
}

/**
 * Checks an item may be carried by carrier: a model, or an item that is not the item itself nor held by it.
 * extra is items being added in the same action, by id to their carrier.
 */
function carrier(table: Table, item: string, carrier: unknown, extra: Map<string, string> = new Map()) {
  const carrierOf = (id: string): string | undefined => (id === item ? (carrier as string) : extra.get(id) ?? table.items[id]?.carrier);
  if (!isText(carrier) || !(table.models[carrier] || extra.has(carrier) || table.items[carrier]))
    refuse(`Item "${item}" must be carried by a model or held by an item, not "${String(carrier)}".`);
  const seen = new Set<string>();
  for (let at: string | undefined = carrier as string; at !== undefined && !table.models[at]; at = carrierOf(at)) {
    if (at === item) refuse(`Item "${item}" would hold itself.`);
    if (seen.has(at)) break;
    seen.add(at);
  }
}

function marker(table: Table, value: Marker) {
  if (typeof value !== "object" || value === null) refuse("The marker is missing.");
  text(value.id, "The marker's id");
  if (!table.markers[value.id]) fresh(table, value.id, "marker");
  text(value.name, "The marker's name");
  text(value.colour, "The marker's colour");
  if (value.shape !== "disc" && value.shape !== "rect") refuse("A marker is a disc or a rectangle.");
  positive(value.width, "The marker's width");
  positive(value.depth, "The marker's depth");
  if (value.shape === "disc" && value.width !== value.depth) refuse("A disc's width and depth must be equal.");
  point(value.position, "The marker's position");
  number(value.facing, "The marker's facing");
}

function deck(table: Table, id: unknown) {
  if (!isText(id) || !table.decks[id]) refuse(`There is no deck "${String(id)}".`);
  return table.decks[id as string]!;
}

function sealed(log: Log, table: Table, by: PlayerId, action: Partial<Record<keyof Sealed, unknown>>, what: string) {
  if (!isText(action.seal) || !isText(action.hostValue) || !isText(action.guestValue))
    refuse(`${what} needs the seal and both random values.`);
  // Signed for this game (ADR-022): otherwise an exchange from another game could be replayed here.
  if (!isText(action.link) || action.link !== log.link) refuse(`${what} must be signed for this game's link.`);
  const host = log.host;
  // Taken alone (ADR-023): only the host, who makes both values; nobody signs, and the table says so.
  if (action.guestBy === null) {
    if (by !== host) refuse("Only the host can roll or draw alone, with nobody else taking part.");
    if (action.guestSignature !== undefined) refuse(`${what} taken alone has no signature: nobody else took part.`);
  } else {
    // Who sent the other value (ADR-022): the taker, unless the host takes it; then anyone but the host.
    if (!isText(action.guestBy) || !table.players[action.guestBy]) refuse(`${what} must name the player who sent the other value.`);
    if (action.guestBy === host) refuse("The host can't send the other value: it would choose both.");
    if (by !== host && action.guestBy !== by) refuse(`${what} by a player who is not the host takes their own value.`);
    // Whether the signature checks is for Session, which shows a failure as tampered; here it must be there.
    if (!isText(action.guestSignature) || action.guestSignature === "")
      refuse(`${what} needs the other player's signature over their value.`);
  }
  // A seal opens once: logging an old exchange again would let the host pick one whose result suits it.
  for (const entry of log.entries) {
    const earlier = entry.action as Partial<Sealed>;
    if ((entry.action.kind === "roll" || entry.action.kind === "draw") && earlier.seal === action.seal)
      refuse(`This seal was already used, in action ${entry.n}.`);
  }
}

function place(table: Table, to: CardPlace) {
  if (typeof to !== "object" || to === null) refuse("A card must go to a deck, a hand, the table or a discard pile.");
  switch (to.in) {
    case "deck":
    case "discard":
      deck(table, to.deck);
      return;
    case "hand":
      player(table, to.player, "Player");
      return;
    case "table":
      point(to.position, "The card's position");
      if (typeof to.faceUp !== "boolean") refuse("A card on the table must be face up or face down.");
      return;
    default:
      refuse("A card must go to a deck, a hand, the table or a discard pile.");
  }
}

export function problemWith(log: Log, table: Table, action: Action, by: PlayerId): string | null {
  try {
    if (typeof action !== "object" || action === null) refuse("The action is missing.");
    text(by, "The player");
    if (action.kind === "join") {
      if (table.players[by]) refuse("This player has already joined.");
      fresh(table, by, "player");
    } else player(table, by, "Player");
    if (action.note !== undefined) {
      text(action.note, "The note");
      if (action.kind === "roll") refuse("A roll's label is its note.");
    }
    takeable(log, table, action, by);
    return null;
  } catch (error) {
    if (error instanceof Refused) return error.message;
    // A malformed action from elsewhere: something it names is missing or of the wrong kind.
    return `The action is malformed (${error instanceof Error ? error.message : String(error)}).`;
  }
}

function takeable(log: Log, table: Table, action: Action, by: PlayerId) {
  switch (action.kind) {
    case "join":
      text(action.name, "The name");
      text(action.colour, "The colour");
      text(action.publicKey, "The player's public key");
      // So no two players share a key: the same key gives the same id, and an id joins once.
      if (playerIdOf(action.publicKey) !== by) refuse("A player's id must be worked out from their public key.");
      return;
    case "rename":
      text(action.name, "The name");
      text(action.colour, "The colour");
      return;
    case "place terrain":
      terrain(table, action.terrain);
      return;
    case "remove terrain":
      if (!isText(action.terrain) || !table.terrain[action.terrain]) refuse(`There is no terrain piece "${String(action.terrain)}".`);
      return;
    case "lock terrain": {
      const ids = list<string>(action.terrain, "The terrain pieces");
      if (ids.length === 0) refuse("Lock or unlock at least one terrain piece.");
      distinct(ids, "The terrain piece");
      for (const id of ids) if (!isText(id) || !table.terrain[id]) refuse(`There is no terrain piece "${String(id)}".`);
      if (typeof action.locked !== "boolean") refuse("Terrain must be locked or unlocked.");
      return;
    }
    case "add to army": {
      const units = list<(typeof action.units)[number]>(action.units, "The units");
      const models = list<(typeof action.models)[number]>(action.models, "The models");
      const groups = list<(typeof action.groups)[number]>(action.groups, "The groups");
      const items = action.items === undefined ? [] : list<(NonNullable<typeof action.items>)[number]>(action.items, "The items");
      distinct([...units.map((u) => u.id), ...models.map((m) => m.id), ...groups.map((g) => g.id), ...items.map((i) => i.id)], "The id");
      for (const unit of units) {
        fresh(table, unit.id, "unit");
        text(unit.name, "A unit's name");
        stats(unit, `Unit "${unit.id}"`);
      }
      const newUnits = new Set(units.map((u) => u.id));
      for (const model of models) {
        fresh(table, model.id, "model");
        text(model.name, "A model's name");
        if (!newUnits.has(model.unit)) {
          const unit = table.units[model.unit];
          if (!unit) refuse(`Model "${model.id}" is in unit "${model.unit}", which does not exist.`);
          if (unit!.owner !== by) refuse(`Unit "${model.unit}" is in another player's army.`);
        }
        base(model.base, `Model "${model.id}"'s base`);
        if (model.mesh !== undefined) text(model.mesh, "The mesh's fingerprint");
        if (!isNumber(model.height) || model.height < 0) refuse(`Model "${model.id}"'s height must be zero or more.`);
        point(model.position, `Model "${model.id}"'s position`);
        number(model.facing, `Model "${model.id}"'s facing`);
        floor(table, model.floor, `Model "${model.id}"`);
        stats(model, `Model "${model.id}"`);
      }
      // New items may be carried by new models, by models of this player's army, or by other new items.
      const newModels = new Set(models.map((m) => m.id));
      const newItems = new Map(items.map((i) => [i.id, i.carrier]));
      for (const item of items) {
        fresh(table, item.id, "item");
        text(item.name, "An item's name");
        const on = table.models[item.carrier];
        if (on && table.units[on.unit]!.owner !== by) refuse(`Model "${item.carrier}" is in another player's army.`);
        if (!newModels.has(item.carrier)) carrier(table, item.id, item.carrier, newItems);
        stats(item, `Item "${item.id}"`);
      }
      const extra = new Map<string, string[] | null>([...newUnits].map((id) => [id, null]));
      for (const group of groups) {
        fresh(table, group.id, "group");
        text(group.name, "A group's name");
        members(table, group.id, group.members, extra);
        extra.set(group.id, group.members);
      }
      return;
    }
    case "move": {
      const moves = list<(typeof action.moves)[number]>(action.moves, "The moves");
      distinct(moves.map((m) => m.model), "Model");
      for (const move of moves) {
        onTable(table, move.model);
        point(move.position, `Model "${move.model}"'s position`);
        number(move.facing, `Model "${move.model}"'s facing`);
        floor(table, move.floor, `Model "${move.model}"`);
        points(move.path, `Model "${move.model}"'s path`);
      }
      return;
    }
    case "set aside": {
      const ids = list<string>(action.models, "The models");
      distinct(ids, "Model");
      for (const id of ids) onTable(table, id);
      if (action.to !== undefined && action.to !== "removed" && action.to !== "reserve") refuse("Models are set aside as removed or into reserve.");
      return;
    }
    case "return": {
      const backs = list<(typeof action.models)[number]>(action.models, "The models");
      distinct(backs.map((b) => b.model), "Model");
      for (const back of backs) {
        const model = isText(back.model) ? table.models[back.model] : undefined;
        if (!model) refuse(`There is no model "${String(back.model)}".`);
        if (model!.place.in === "table") refuse(`Model "${back.model}" is already on the table.`);
        point(back.position, `Model "${back.model}"'s position`);
        number(back.facing, `Model "${back.model}"'s facing`);
        floor(table, back.floor, `Model "${back.model}"`);
      }
      return;
    }
    case "group":
      text(action.group, "The group's id");
      if (!table.groups[action.group]) fresh(table, action.group, "group");
      text(action.name, "The group's name");
      members(table, action.group, action.members);
      return;
    case "ungroup":
      if (!isText(action.group) || !table.groups[action.group]) refuse(`There is no group "${String(action.group)}".`);
      return;
    case "phase":
      if (typeof action.phase !== "object" || action.phase === null) refuse("The phase is missing.");
      number(action.phase.round, "The round");
      if (action.phase.turn !== null) player(table, action.phase.turn, "Player");
      text(action.phase.name, "The phase's name");
      return;
    case "counter":
      targets(table, action.targets);
      text(action.name, "The counter's name");
      if (action.value !== null) number(action.value, "The counter's value");
      return;
    case "mark":
      targets(table, action.targets);
      text(action.name, "The mark's name");
      if (typeof action.on !== "boolean") refuse("A mark must be turned on or off.");
      return;
    case "roll":
      if (!isWhole(action.dice) || action.dice < 1 || action.dice > mostDice) refuse(`A roll is 1 to ${mostDice} dice.`);
      if (!Number.isSafeInteger(action.sides) || action.sides < 2) refuse("A die has a whole number of sides, at least two.");
      if (action.label !== undefined) text(action.label, "The roll's label");
      if (action.about !== undefined) list<unknown>(action.about, "What the roll is about").forEach((t) => target(table, t));
      sealed(log, table, by, action, "A roll");
      return;
    case "add deck": {
      fresh(table, action.deck, "deck");
      text(action.name, "The deck's name");
      if (action.owner !== null) player(table, action.owner, "Owner");
      if (action.order !== "ordered" && action.order !== "shuffled") refuse("A deck is ordered or shuffled.");
      const cards = list<(typeof action.cards)[number]>(action.cards, "The cards");
      distinct(cards.map((c) => c.id), "Card");
      for (const card of cards) {
        fresh(table, card.id, "card");
        text(card.name, "A card's name");
        if (card.text !== undefined) text(card.text, "A card's text");
        if (card.picture !== undefined) text(card.picture, "A card picture's fingerprint");
      }
      point(action.position, "The deck's position");
      return;
    }
    case "shuffle":
      deck(table, action.deck);
      return;
    case "draw": {
      const from = deck(table, action.deck);
      if (!isWhole(action.cards) || action.cards < 1) refuse("A draw takes at least one card.");
      if (action.cards > from.cards.length)
        refuse(`Deck "${action.deck}" has ${from.cards.length} cards left, not ${action.cards}.`);
      if (action.to !== "hand" && action.to !== "table") refuse("Cards are drawn to the hand or the table.");
      const values = action as Partial<Sealed>;
      if (from.order === "ordered") {
        if (values.link !== undefined || values.seal !== undefined || values.hostValue !== undefined || values.guestValue !== undefined || values.guestBy !== undefined || values.guestSignature !== undefined)
          refuse("An ordered deck gives its top cards; a draw from it has no random values.");
      } else {
        sealed(log, table, by, values, "A draw from a shuffled deck");
      }
      return;
    }
    case "move card": {
      const card = isText(action.card) ? table.cards[action.card] : undefined;
      if (!card) refuse(`There is no card "${String(action.card)}".`);
      place(table, action.to);
      if (action.at !== undefined) {
        const into = action.to.in === "deck" ? table.decks[action.to.deck] : undefined;
        if (!into || into.order !== "ordered") refuse("A position is only given when moving a card into an ordered deck.");
        const size = into!.cards.filter((id) => id !== action.card).length;
        if (action.at !== "bottom" && (!isWhole(action.at) || action.at < 0 || action.at > size))
          refuse(`A position in deck "${into!.id}" is from 0 (the top) to ${size}, or the bottom.`);
      }
      return;
    }
    case "item": {
      const item = action.item as Item;
      if (typeof item !== "object" || item === null) refuse("The item is missing.");
      text(item.id, "The item's id");
      if (!table.items[item.id]) fresh(table, item.id, "item");
      text(item.name, "The item's name");
      carrier(table, item.id, item.carrier);
      return;
    }
    case "remove item":
      if (!isText(action.item) || !table.items[action.item]) refuse(`There is no item "${String(action.item)}".`);
      return;
    case "place marker":
      marker(table, action.marker);
      return;
    case "remove marker":
      if (!isText(action.marker) || !table.markers[action.marker]) refuse(`There is no marker "${String(action.marker)}".`);
      return;
    case "priority": {
      const ids = list<string>(action.players, "The players with priority");
      distinct(ids, "Player");
      for (const id of ids) player(table, id, "Player");
      if (action.note !== undefined) text(action.note, "Priority's note");
      return;
    }
    case "rules":
      if (action.name !== null) text(action.name, "The rules package's name");
      return;
    case "undo": {
      const latest = latestStanding(log.entries);
      if (!latest) refuse("There is nothing to undo.");
      if (latest!.by !== by) refuse("Only the player who took the latest action can undo it.");
      if (latest!.action.kind === "roll") refuse("A roll can't be undone: it happens once and its result never changes.");
      if (latest!.action.kind === "draw" && "seal" in latest!.action)
        refuse("A draw from a shuffled deck can't be undone, or it could be drawn again until it suited.");
      return;
    }
    default:
      refuse(`"${String((action as { kind: unknown }).kind)}" is not a kind of action.`);
  }
}
