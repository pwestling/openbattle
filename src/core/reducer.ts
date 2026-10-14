import type { GameEvent } from "./actions";
import { revealMatches } from "./secrets";
import { cardEventProblem, cardLayoutProblem, type Card } from "./cards";
import { dropExpired } from "./quantity";
import { transformPositions } from "./formation";
import type { Bag, EntityRef, GameState, Json, Model, Player, PlayerId, Token, Unit } from "./types";

/**
 * Apply one event's effect on the table. Pure: the result depends only on the
 * state and the event, never on which rules packages a peer has loaded, and
 * the input is never mutated. Sequencing, undo and history live in the event
 * log (log.ts), which is the source of truth; this only folds one event in.
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "player/join": {
      const known = state.players[event.player.id];
      const seat = event.player.seat ?? known?.seat;
      const player = { ...event.player, ...(seat === undefined ? {} : { seat }) };
      player.name = playerName(state, player);
      return { ...state, players: { ...state.players, [player.id]: player } };
    }
    case "player/claim":
      return claimPlayer(state, event.player, event.by);
    case "player/set": {
      const p = state.players[event.player];
      if (!p) return state;
      const { ready: _r, seat: _s, ...rest } = p;
      const { ready, seat, ...fields } = event.set;
      const next: Player = { ...rest, ...fields };
      const assigned = seat === undefined ? p.seat : seat;
      if (assigned !== undefined && assigned !== null) next.seat = assigned;
      if (ready ?? p.ready) next.ready = true;
      return { ...state, players: { ...state.players, [p.id]: next } };
    }
    case "game/system":
      return { ...state, system: event.system };
    case "game/packages": {
      const { type: _t, ...packages } = event;
      return { ...state, packages };
    }
    case "layout/set": {
      if (cardLayoutProblem(event.layout, state) !== undefined) return state;
      const { table, terrain, tokens, zones, cards, cardCollections } = event.layout;
      return {
        ...state,
        ...(table ? { table } : {}),
        terrain,
        zones,
        tokens: Object.fromEntries(tokens.map((t) => [t.id, t])),
        ...(cards && cardCollections
          ? {
              cards: Object.fromEntries(cards.map((c) => [c.id, c])),
              cardCollections: Object.fromEntries(cardCollections.map((c) => [c.id, c])),
            }
          : {}),
      };
    }
    case "terrain/add":
    case "terrain/update":
      return { ...state, terrain: [...state.terrain.filter((t) => t.id !== event.piece.id), event.piece] };
    case "terrain/remove":
      return { ...state, terrain: state.terrain.filter((t) => t.id !== event.id) };
    case "unit/add": {
      const models = { ...state.models };
      const units = { ...state.units };
      const incoming = new Set(event.models.map((model) => model.id));
      // Replacing a unit detaches its former members that aren't in the replacement.
      for (const model of Object.values(models))
        if (!incoming.has(model.id) && model.unitId === event.unit.id) models[model.id] = withoutUnit(model);
      const unit = { ...event.unit, modelIds: [...incoming] };
      units[unit.id] = unit;
      for (const model of event.models) replaceModel(models, units, { ...model, unitId: unit.id });
      return { ...state, units, models };
    }
    case "unit/remove": {
      const { [event.id]: unit, ...units } = state.units;
      if (!unit) return state;
      const models = { ...state.models };
      for (const model of Object.values(models)) if (model.unitId === unit.id) delete models[model.id];
      return { ...state, units, models };
    }
    case "unit/members": {
      const unit = state.units[event.id];
      if (!unit) return state;
      const models = { ...state.models };
      const units = { ...state.units };
      const remove = new Set(event.remove ?? []);
      const joining = (event.add ?? []).filter(
        (id) =>
          models[id] && (models[id]!.unitId !== unit.id || !unit.modelIds.includes(id) || remove.has(id)),
      );
      for (const id of remove) if (models[id]?.unitId === unit.id) models[id] = withoutUnit(models[id]!);
      for (const id of joining) {
        // Joining takes a model from the unit it was in.
        const prev = models[id]!.unitId;
        if (prev && prev !== unit.id && units[prev])
          units[prev] = { ...units[prev]!, modelIds: units[prev]!.modelIds.filter((m) => m !== id) };
        models[id] = { ...models[id]!, unitId: unit.id };
      }
      const added = new Set(joining);
      units[unit.id] = {
        ...unit,
        modelIds: [
          ...unit.modelIds.filter(
            (id) => !remove.has(id) && !added.has(id) && models[id]?.unitId === unit.id,
          ),
          ...joining,
        ],
      };
      return { ...state, units, models };
    }
    case "model/add": {
      const models = { ...state.models };
      const units = { ...state.units };
      replaceModel(models, units, event.model);
      return { ...state, models, units };
    }
    case "model/remove": {
      const { [event.id]: removed, ...models } = state.models;
      const unit = removed?.unitId ? state.units[removed.unitId] : undefined;
      const units = unit
        ? { ...state.units, [unit.id]: { ...unit, modelIds: unit.modelIds.filter((id) => id !== event.id) } }
        : state.units;
      return { ...state, models, units };
    }
    case "token/add":
      return { ...state, tokens: { ...state.tokens, [event.token.id]: event.token } };
    case "token/remove": {
      const { [event.id]: _gone, ...tokens } = state.tokens;
      return { ...state, tokens };
    }
    case "entity/set":
      return updateEntity(state, event.ref, (e) => {
        const next: Record<string, unknown> = { ...e };
        for (const [k, v] of Object.entries(event.set)) {
          if (v === null) delete next[k];
          else next[k] = v;
        }
        return next as typeof e;
      });
    case "models/move": {
      const models = { ...state.models };
      for (const { id, to, z, facing } of event.moves) {
        const m = models[id];
        if (!m) continue;
        models[id] = {
          ...m,
          position: to,
          ...(facing === undefined ? {} : { facing }),
          ...(z === undefined ? {} : { z }),
        };
      }
      return { ...state, models };
    }
    case "unit/move": {
      const unit = state.units[event.id];
      if (!unit) return state;
      const members = unit.modelIds.flatMap((id) => state.models[id] ?? []);
      const moved = transformPositions(
        members.map((m) => m.position),
        event.pivot,
        event.turn,
        event.delta,
      );
      const models = { ...state.models };
      members.forEach(
        (m, i) => (models[m.id] = { ...m, position: moved[i]!, facing: m.facing + event.turn }),
      );
      return { ...state, models };
    }
    case "q/set":
      return updateEntity(state, event.ref, (e) => {
        const q = { ...e.q };
        if (event.value === null) delete q[event.key];
        else q[event.key] = event.value;
        return withBag(e, q);
      });
    case "q/adjust":
      return updateEntity(state, event.ref, (e) => {
        const was = e.q?.[event.key];
        return withBag(e, { ...e.q, [event.key]: (typeof was === "number" ? was : 0) + event.delta });
      });
    case "tag/set":
      return updateEntity(state, event.ref, (e) => {
        const tags = (e.tags ?? []).filter((t) => t !== event.tag);
        if (event.on) tags.push(event.tag);
        const { tags: _t, ...rest } = e;
        return (tags.length ? { ...rest, tags } : rest) as typeof e;
      });
    case "mod/add":
      return { ...state, mods: [...state.mods.filter((m) => m.id !== event.mod.id), event.mod] };
    case "mod/remove":
      return {
        ...state,
        mods: state.mods.filter(
          (m) =>
            !(
              (event.id !== undefined && m.id === event.id) ||
              (event.source !== undefined && m.source === event.source)
            ),
        ),
      };
    case "pointer/set":
      // What the pointer was is gone: a modifier that was waiting on it ends for good, even if it comes round again.
      return dropExpired({ ...state, pointer: event.pointer });
    case "dice/roll":
      // The log keeps the roll; the table doesn't change.
      return state;
    case "collection/add":
    case "collection/remove":
    case "card/add":
    case "cards/remove":
    case "cards/move":
    case "card/set":
    case "collection/shuffle": {
      if (cardEventProblem(event, state) !== undefined) return state;
      switch (event.type) {
        case "collection/add":
          return {
            ...state,
            cardCollections: { ...state.cardCollections, [event.collection.id]: event.collection },
          };
        case "collection/remove": {
          const { [event.id]: _gone, ...cardCollections } = state.cardCollections;
          return { ...state, cardCollections };
        }
        case "card/add": {
          const collection = state.cardCollections[event.collection]!;
          const members = [...collection.cards];
          members.splice(event.index ?? members.length, 0, event.card.id);
          return {
            ...state,
            cards: { ...state.cards, [event.card.id]: event.card },
            cardCollections: {
              ...state.cardCollections,
              [collection.id]: { ...collection, cards: members },
            },
          };
        }
        case "cards/remove":
        case "cards/move": {
          const moving = new Set(event.cards);
          const cardCollections = { ...state.cardCollections };
          for (const collection of Object.values(state.cardCollections)) {
            if (collection.cards.some((id) => moving.has(id)))
              cardCollections[collection.id] = {
                ...collection,
                cards: collection.cards.filter((id) => !moving.has(id)),
              };
          }
          if (event.type === "cards/move") {
            const collection = cardCollections[event.to]!;
            const index = event.index ?? collection.cards.length;
            cardCollections[event.to] = {
              ...collection,
              cards: collection.cards.slice(0, index).concat(event.cards, collection.cards.slice(index)),
            };
            return { ...state, cardCollections };
          }
          const cards = { ...state.cards };
          for (const id of event.cards) delete cards[id];
          return { ...state, cards, cardCollections };
        }
        case "card/set":
          return {
            ...state,
            cards: { ...state.cards, [event.card]: { ...state.cards[event.card]!, ...event.set } },
          };
        case "collection/shuffle":
          return {
            ...state,
            cardCollections: {
              ...state.cardCollections,
              [event.collection]: { ...state.cardCollections[event.collection]!, cards: event.order },
            },
          };
      }
      throw new Error("Unreachable card event");
    }
    case "secret/commit": {
      const mine = { ...state.secrets?.[event.player] };
      for (const { key, commitment } of event.secrets) if (!mine[key]) mine[key] = { commitment };
      return { ...state, secrets: { ...state.secrets, [event.player]: mine } };
    }
    case "secret/reveal": {
      // Every peer checks the reveal; one that doesn't match its commitment changes nothing.
      const entry = state.secrets?.[event.player]?.[event.key];
      if (!revealMatches(entry, event.value, event.salt)) return state;
      const mine = {
        ...state.secrets![event.player],
        [event.key]: { ...entry!, revealed: { value: event.value } },
      };
      return { ...state, secrets: { ...state.secrets, [event.player]: mine } };
    }
    case "game/branch":
      return { ...state, branch: event.branch };
    case "module/set": {
      const mine = { ...state.modules?.[event.module], [event.key]: event.value as Json };
      return { ...state, modules: { ...state.modules, [event.module]: mine } };
    }
    case "macro/step": {
      // The step's own events, then where the macro stands (null once it is done).
      const applied = event.events.reduce(applyEvent, state);
      return { ...applied, macro: event.script };
    }
    case "log/note":
    case "player/resync":
      return state;
    case "undo":
      // Undo is resolved by the log's replay.
      return state;
  }
}

type Carrier = { q?: Bag; tags?: string[] };

function withBag<T extends Carrier>(e: T, q: Bag): T {
  const { q: _q, ...rest } = e;
  return (Object.keys(q).length ? { ...rest, q } : rest) as T;
}

function withoutUnit(m: Model): Model {
  const { unitId: _u, ...rest } = m;
  return rest;
}

/** Replace identity and move reciprocal membership together, including a detached replacement. */
function replaceModel(models: GameState["models"], units: GameState["units"], model: Model): void {
  const previous = models[model.id]?.unitId;
  if (previous && previous !== model.unitId && units[previous])
    units[previous] = {
      ...units[previous]!,
      modelIds: units[previous]!.modelIds.filter((id) => id !== model.id),
    };
  models[model.id] = model;
  const unit = model.unitId ? units[model.unitId] : undefined;
  if (unit && !unit.modelIds.includes(model.id))
    units[unit.id] = { ...unit, modelIds: [...unit.modelIds, model.id] };
}

/** Change one entity, whichever kind it is. A reference to nothing changes nothing. */
function updateEntity(state: GameState, ref: EntityRef, f: <T extends Carrier>(e: T) => T): GameState {
  switch (ref.kind) {
    case "player": {
      const e = state.players[ref.id];
      return e ? { ...state, players: { ...state.players, [ref.id]: f(e) } } : state;
    }
    case "unit": {
      const e = state.units[ref.id];
      return e ? { ...state, units: { ...state.units, [ref.id]: f(e) } } : state;
    }
    case "model": {
      const e = state.models[ref.id];
      return e ? { ...state, models: { ...state.models, [ref.id]: f(e) } } : state;
    }
    case "token": {
      const e = state.tokens[ref.id];
      return e ? { ...state, tokens: { ...state.tokens, [ref.id]: f(e) } } : state;
    }
  }
}

/** Hand a player's seat, units, tokens, cards and hidden values to a new peer id. */
function claimPlayer(state: GameState, from: string, to: string): GameState {
  const old = state.players[from];
  if (!old) return state;
  const { [from]: _gone, [to]: _new, ...players } = state.players;
  const who = (p: PlayerId): PlayerId => (p === from ? to : p);
  const units: Record<string, Unit> = {};
  for (const [id, u] of Object.entries(state.units)) units[id] = u.owner === from ? { ...u, owner: to } : u;
  const models: Record<string, Model> = {};
  for (const [id, m] of Object.entries(state.models)) models[id] = m.owner === from ? { ...m, owner: to } : m;
  const tokens: Record<string, Token> = {};
  for (const [id, t] of Object.entries(state.tokens)) tokens[id] = t.owner === from ? { ...t, owner: to } : t;
  const cards: Record<string, Card> = {};
  for (const [id, card] of Object.entries(state.cards)) {
    const visibility = card.visibility;
    const rebindVisibility = visibility !== "all" && visibility.includes(from);
    cards[id] =
      card.owner === from || rebindVisibility
        ? {
            ...card,
            ...(card.owner === from ? { owner: to } : {}),
            ...(rebindVisibility ? { visibility: [...new Set((visibility as string[]).map(who))] } : {}),
          }
        : card;
  }
  // A player's committed secrets follow them to their new id (their device still holds the values).
  const { [from]: mine, ...secrets } = state.secrets ?? {};
  const macro = state.macro;
  return {
    ...state,
    players: { ...players, [to]: { ...old, id: to } },
    units,
    models,
    tokens,
    cards,
    mods: state.mods.map((m) =>
      m.target.kind === "player" && m.target.id === from ? { ...m, target: { kind: "player", id: to } } : m,
    ),
    // Keep original commands/args intact; current and future recipient addresses follow every reclaim.
    ...(macro
      ? {
          macro: {
            ...macro,
            by: who(macro.by),
            identities: {
              ...Object.fromEntries(
                Object.entries(macro.identities ?? {}).map(([id, player]) => [id, who(player)]),
              ),
              [from]: to,
            },
            ...(macro.waiting ? { waiting: { ...macro.waiting, player: who(macro.waiting.player) } } : {}),
          },
        }
      : {}),
    ...(state.secrets ? { secrets: mine ? { ...secrets, [to]: mine } : secrets } : {}),
  };
}

/** Blank or generic names are numbered in join order; duplicate names get a suffix. */
function playerName(state: GameState, player: Player): string {
  const fallback = state.players[player.id]?.name ?? `Player ${Object.keys(state.players).length + 1}`;
  const wanted = player.name.trim();
  const base = !wanted || wanted === "Player" ? fallback : wanted;
  const taken = new Set(
    Object.values(state.players)
      .filter((p) => p.id !== player.id)
      .map((p) => p.name),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} (${i})`)) return `${base} (${i})`;
}
