// Whether an action can be appended: everything it names exists, numbers are finite, no group
// contains itself, and the player may take it. Game rules are never checked.
import { latestStanding } from "./fold.ts";
import { playerIdOf } from "./keys.ts";
import type { Action, Base, CardPlace, FloorRef, Log, PlayerId, Point, Sealed, Shape, Table, Terrain } from "./types.ts";

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
  if (id === "game") return "the game";
  if (table.players[id]) return "a player";
  if (table.terrain[id]) return "a terrain piece";
  if (table.units[id]) return "a unit";
  if (table.models[id]) return "a model";
  if (table.groups[id]) return "a group";
  if (table.decks[id]) return "a deck";
  if (table.cards[id]) return "a card";
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
  if (model.aside) refuse(`Model "${id}" is set aside; return it to the table first.`);
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

function target(table: Table, id: unknown) {
  if (!isText(id) || !(id === "game" || table.models[id] || table.units[id] || table.groups[id] || table.players[id]))
    refuse(`"${String(id)}" is not a model, unit, group, player or the game.`);
}

function deck(table: Table, id: unknown) {
  if (!isText(id) || !table.decks[id]) refuse(`There is no deck "${String(id)}".`);
  return table.decks[id as string]!;
}

function sealed(log: Log, table: Table, by: PlayerId, action: Partial<Record<keyof Sealed, unknown>>, what: string) {
  if (!isText(action.seal) || !isText(action.hostValue) || !isText(action.guestValue))
    refuse(`${what} needs the seal and both random values.`);
  // Signed for this game (ADR-022): otherwise an exchange from another game could be replayed here.
  if (action.link !== log.link) refuse(`${what} must be signed for this game's link.`);
  // Who sent the other value (ADR-022): the taker, unless the host takes it; then anyone but the host.
  if (!isText(action.guestBy) || !table.players[action.guestBy]) refuse(`${what} must name the player who sent the other value.`);
  const host = log.host;
  if (action.guestBy === host) refuse("The host can't send the other value: it would choose both.");
  if (by !== host && action.guestBy !== by) refuse(`${what} by a player who is not the host takes their own value.`);
  // Whether the signature checks is for Session, which shows a failure as tampered; here it must be there.
  if (!isText(action.guestSignature) || action.guestSignature === "")
    refuse(`${what} needs the other player's signature over their value.`);
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
    case "add to army": {
      const units = list<{ id: string; name: string }>(action.units, "The units");
      const models = list<(typeof action.models)[number]>(action.models, "The models");
      const groups = list<(typeof action.groups)[number]>(action.groups, "The groups");
      distinct([...units.map((u) => u.id), ...models.map((m) => m.id), ...groups.map((g) => g.id)], "The id");
      for (const unit of units) {
        fresh(table, unit.id, "unit");
        text(unit.name, "A unit's name");
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
      return;
    }
    case "return": {
      const backs = list<(typeof action.models)[number]>(action.models, "The models");
      distinct(backs.map((b) => b.model), "Model");
      for (const back of backs) {
        const model = isText(back.model) ? table.models[back.model] : undefined;
        if (!model) refuse(`There is no model "${String(back.model)}".`);
        if (!model!.aside) refuse(`Model "${back.model}" is already on the table.`);
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
      target(table, action.target);
      text(action.name, "The counter's name");
      if (action.value !== null) number(action.value, "The counter's value");
      return;
    case "mark":
      target(table, action.target);
      text(action.name, "The mark's name");
      if (typeof action.on !== "boolean") refuse("A mark must be turned on or off.");
      return;
    case "roll":
      if (!isWhole(action.dice) || action.dice < 1 || action.dice > mostDice) refuse(`A roll is 1 to ${mostDice} dice.`);
      if (!Number.isSafeInteger(action.sides) || action.sides < 2) refuse("A die has a whole number of sides, at least two.");
      if (action.label !== undefined) text(action.label, "The roll's label");
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
