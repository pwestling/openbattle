import type { GameEvent } from "./actions";
import { revealMatches } from "./secrets";
import { cleanDecks, pileOf, type CardPile } from "./cards";
import { dropExpired } from "./quantity";
import { sidePlayers } from "./teams";
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
      // First come, first seated, filling the emptier side up to the team size; a rejoining player keeps their seat.
      const size = state.settings.teamSize ?? 1;
      const count = (seat: number) => Object.values(state.players).filter((p) => p.seat === seat).length;
      const free = count(0) < size || count(1) < size;
      const seat = known?.seat ?? event.player.seat ?? (free ? (count(1) < count(0) ? 1 : 0) : undefined);
      const player = { ...event.player, ...(seat === undefined ? {} : { seat }) };
      player.name = playerName(state, player);
      return { ...state, players: { ...state.players, [player.id]: player } };
    }
    case "player/claim":
      return claimPlayer(state, event.player, event.by);
    case "player/set": {
      const p = state.players[event.player];
      if (!p) return state;
      const { ready: _r, ...rest } = p;
      const { ready, ...fields } = event.set;
      const next: Player = { ...rest, ...fields };
      if (ready ?? p.ready) next.ready = true;
      return { ...state, players: { ...state.players, [p.id]: next } };
    }
    case "game/system":
      return { ...state, system: event.system };
    case "game/packages": {
      const { type: _t, ...packages } = event;
      return { ...state, packages };
    }
    case "settings/set":
      return { ...state, settings: { ...state.settings, ...event.settings } };
    case "layout/set": {
      const { table, terrain, tokens, zones, decks } = event.layout;
      return {
        ...state,
        ...(table ? { table } : {}),
        terrain,
        zones,
        tokens: Object.fromEntries(tokens.map((t) => [t.id, t])),
        // A table with decks brings them; one without leaves the game's as they are.
        ...(decks ? { decks: cleanDecks(decks) } : {}),
      };
    }
    case "terrain/add":
    case "terrain/update":
      return { ...state, terrain: [...state.terrain.filter((t) => t.id !== event.piece.id), event.piece] };
    case "terrain/remove":
      return { ...state, terrain: state.terrain.filter((t) => t.id !== event.id) };
    case "unit/add": {
      const models = { ...state.models };
      for (const model of event.models) models[model.id] = { ...model, unitId: event.unit.id };
      const unit = { ...event.unit, modelIds: event.models.map((m) => m.id) };
      return { ...state, units: { ...state.units, [unit.id]: unit }, models };
    }
    case "unit/remove": {
      const { [event.id]: unit, ...units } = state.units;
      if (!unit) return state;
      const models = { ...state.models };
      for (const id of unit.modelIds) delete models[id];
      return { ...state, units, models };
    }
    case "unit/members": {
      const unit = state.units[event.id];
      if (!unit) return state;
      const models = { ...state.models };
      const units = { ...state.units };
      const remove = new Set(event.remove ?? []);
      const joining = (event.add ?? []).filter((id) => models[id] && !unit.modelIds.includes(id));
      for (const id of remove) if (models[id]?.unitId === unit.id) models[id] = withoutUnit(models[id]!);
      for (const id of joining) {
        // Joining takes a model from the unit it was in.
        const prev = models[id]!.unitId;
        if (prev && prev !== unit.id && units[prev])
          units[prev] = { ...units[prev]!, modelIds: units[prev]!.modelIds.filter((m) => m !== id) };
        models[id] = { ...models[id]!, unitId: unit.id };
      }
      units[unit.id] = { ...unit, modelIds: [...unit.modelIds.filter((id) => !remove.has(id)), ...joining] };
      return { ...state, units, models };
    }
    case "model/add":
      return { ...state, models: { ...state.models, [event.model.id]: event.model } };
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
    case "deck/discard":
    case "deck/shuffle": {
      const pile = pileOf(state, event.player, event.deck);
      const next: CardPile =
        event.type === "deck/discard"
          ? { ...pile, discarded: [...pile.discarded, event.key] }
          : { discarded: [], returned: [...pile.returned, ...pile.discarded] };
      const mine = { ...state.cardPiles?.[event.player], [event.deck]: next };
      return { ...state, cardPiles: { ...state.cardPiles, [event.player]: mine } };
    }
    case "deck/remove":
      return { ...state, decks: state.decks?.filter((d) => d.id !== event.id) };
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
    case "ranked/card": {
      const ranked = state.ranked ?? { keys: {} };
      const { [event.player]: _old, ...keys } = ranked.keys;
      return {
        ...state,
        ranked: { ...ranked, keys: event.key ? { ...keys, [event.player]: event.key } : keys },
      };
    }
    case "dice/commit":
      return {
        ...state,
        sharedDice: {
          by: event.player,
          commit: event.hash,
          seeds: {},
          round: state.pointer.round,
          from: state.seq + 1,
        },
      };
    case "dice/seed":
      return state.sharedDice
        ? {
            ...state,
            sharedDice: {
              ...state.sharedDice,
              seeds: { ...state.sharedDice.seeds, [event.player]: event.seed },
            },
          }
        : state;
    case "dice/reveal": {
      const { sharedDice: _done, ...rest } = state;
      return event.next
        ? {
            ...rest,
            sharedDice: {
              by: event.player,
              commit: event.next,
              seeds: {},
              round: state.pointer.round,
              from: state.seq + 1,
            },
          }
        : rest;
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

/** Hand a player's seat, units, tokens and hidden values to a new peer id. */
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
  // A player's committed secrets follow them to their new id (their device still holds the values).
  const { [from]: mine, ...secrets } = state.secrets ?? {};
  const { [from]: piles, ...cardPiles } = state.cardPiles ?? {};
  const macro = state.macro;
  const ranked = state.ranked;
  return {
    ...state,
    players: { ...players, [to]: { ...old, id: to } },
    units,
    models,
    tokens,
    mods: state.mods.map((m) =>
      m.target.kind === "player" && m.target.id === from ? { ...m, target: { kind: "player", id: to } } : m,
    ),
    // What the game waits on from them waits on their new id: a macro they started, a question for them.
    ...(macro && (macro.by === from || macro.waiting?.player === from)
      ? {
          macro: {
            ...macro,
            by: who(macro.by),
            ...(macro.waiting ? { waiting: { ...macro.waiting, player: who(macro.waiting.player) } } : {}),
          },
        }
      : {}),
    ...(state.secrets ? { secrets: mine ? { ...secrets, [to]: mine } : secrets } : {}),
    ...(state.cardPiles ? { cardPiles: piles ? { ...cardPiles, [to]: piles } : cardPiles } : {}),
    ...(ranked?.keys[from]
      ? {
          ranked: {
            ...ranked,
            keys: Object.fromEntries(Object.entries(ranked.keys).map(([k, v]) => [who(k), v])),
          },
        }
      : {}),
  };
}

/**
 * A blank or generic name becomes "Player 1"/"Player 2" by seat, and a name
 * another player already has gets a number, so the two sides never look alike.
 */
function playerName(state: GameState, player: Player): string {
  // Teammates number on: side 1 has Players 1 and 3, side 2 has Players 2 and 4.
  const before = sidePlayers(state, player.seat ?? -1).filter((p) => p.id !== player.id).length;
  const fallback = player.seat === undefined ? "Spectator" : `Player ${player.seat + 1 + 2 * before}`;
  const wanted = player.name.trim();
  const base = !wanted || wanted === "Player" ? fallback : wanted;
  const taken = new Set(
    Object.values(state.players)
      .filter((p) => p.id !== player.id)
      .map((p) => p.name),
  );
  if (!taken.has(base)) return base;
  if (!taken.has(fallback) && base !== fallback) return fallback;
  for (let i = 2; ; i++) if (!taken.has(`${base} (${i})`)) return `${base} (${i})`;
}
