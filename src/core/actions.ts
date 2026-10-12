import { commitTo, isSeed } from "./sharedDice";
import { isPlayerKey, type PlayerKey } from "./ranked";
import type { BranchEvent } from "./branch";
import { isCommitment, revealMatches, secretOf } from "./secrets";
import { deckPrefix, inHand, type CardDeck } from "./cards";
import { die } from "./dice";
import { KEY, PROTECTED } from "./validate";
import { codeActionWhy, startMacro, stepMacro, type LogNote, type MacroStep, type ModuleSet } from "./macro";
import type {
  DiceRoll,
  EntityRef,
  GamePackages,
  GameSettings,
  GameState,
  Json,
  Mod,
  Model,
  ModelId,
  PackageRef,
  Player,
  PlayerId,
  Pointer,
  Table,
  TerrainPiece,
  Token,
  TokenId,
  Unit,
  UnitId,
  Vec2,
  Zone,
} from "./types";

/** The table layout: terrain, tokens and areas. */
export interface Layout {
  /** The table's size, when the layout brings one. */
  table?: Table;
  terrain: TerrainPiece[];
  tokens: Token[];
  zones: Zone[];
  /** The table's card decks (core/cards.ts). */
  decks?: CardDeck[];
}

/** Where a model went in a move: its new place, and the corners it went round on its way (kept in the event for rules that measure). */
interface ModelMove {
  id: ModelId;
  to: Vec2;
  /** Height of the base; omitted means unchanged. */
  z?: number;
  /** A new facing; omitted means unchanged. */
  facing?: number;
  /** Corners the move went round, in order. */
  via?: Vec2[];
}

/** Fields `entity/set` may change: everything static, never identity, containment or the open bags. */
type EntityFields = Record<string, Json>;

/**
 * An Intent is what a player asks for. Only the host turns intents into
 * Events, which is where anything random (dice) gets resolved, so every peer
 * applies exactly the same events in the same order. The core's intents are
 * physical: they move things, roll dice, change quantities and tags, set the
 * pointer, deal with hidden values. A game's own moves are macros
 * (`macro/start`) that a rules module expands into these.
 */
export type Intent =
  | { type: "player/join"; player: Player }
  | { type: "player/claim"; player: PlayerId }
  | { type: "player/set"; player: PlayerId; set: { name?: string; color?: string; ready?: boolean } }
  | { type: "game/system"; system: string }
  | { type: "game/packages"; app: string; system: string; packages: PackageRef[] }
  | { type: "settings/set"; settings: Partial<GameSettings> }
  | { type: "layout/set"; layout: Layout }
  | { type: "terrain/add"; piece: TerrainPiece }
  | { type: "terrain/update"; piece: TerrainPiece }
  | { type: "terrain/remove"; id: string }
  | { type: "unit/add"; unit: Unit; models: Model[] }
  | { type: "unit/remove"; id: UnitId }
  /** Models join or leave a unit (a character joining a squad, a model detached). */
  | { type: "unit/members"; id: UnitId; add?: ModelId[]; remove?: ModelId[] }
  | { type: "model/add"; model: Model }
  | { type: "model/remove"; id: ModelId }
  | { type: "token/add"; token: Token }
  | { type: "token/remove"; id: TokenId }
  | { type: "entity/set"; ref: EntityRef; set: EntityFields }
  /** Several models placed at once, e.g. a squad dragged together. */
  | { type: "models/move"; moves: ModelMove[]; setup?: boolean }
  /** Every model in a unit as one rigid block: rotate by `turn` about `pivot`, then translate by `delta`. */
  | { type: "unit/move"; id: UnitId; pivot: Vec2; turn: number; delta: Vec2 }
  | { type: "q/set"; ref: EntityRef; key: string; value: Json }
  | { type: "q/adjust"; ref: EntityRef; key: string; delta: number }
  | { type: "tag/set"; ref: EntityRef; tag: string; on: boolean }
  | { type: "mod/add"; mod: Omit<Mod, "id"> }
  /** Take off a modifier by id, or every one a source put there. */
  | { type: "mod/remove"; id?: string; source?: string }
  | { type: "pointer/set"; pointer: Pointer }
  | { type: "dice/roll"; count: number; sides: number; faces?: string[]; label?: string }
  | {
      type: "secret/commit";
      player: PlayerId;
      secrets: { key: string; commitment: string }[];
      label?: string;
    }
  | { type: "secret/reveal"; player: PlayerId; key: string; value: unknown; salt: string; label?: string }
  | { type: "deck/discard"; deck: string; key: string }
  | { type: "deck/shuffle"; deck: string }
  | { type: "deck/remove"; id: string }
  | { type: "log/note"; text: string }
  /** Tie a player's key to their seat for a ranked game (core/ranked.ts). */
  | { type: "ranked/card"; key: PlayerKey | null }
  /** The host commits to a seed for the stretch's dice (core/sharedDice.ts). */
  | { type: "dice/commit"; hash: string }
  | { type: "dice/seed"; seed: string }
  | { type: "dice/reveal"; seed: string; next?: string }
  /** Resync a peer (the host answers with the log). */
  | { type: "player/resync" }
  /** Take back an event; `also` lists dependents that go with it (see canUndo). */
  | { type: "undo"; seq: number; also?: number[] }
  /** Start a rules module's macro (a code action or hook). `cause` is the event that set it off. */
  | { type: "macro/start"; macro: string; args?: Record<string, Json>; cause?: number; force?: boolean }
  /** A player's answer to the question the running macro is waiting on. */
  | { type: "macro/answer"; answer: string };

/** What a logged event is: an intent as the host resolved it. */
export type GameEvent =
  | { type: "player/join"; player: Player }
  | { type: "player/claim"; player: PlayerId; by: PlayerId }
  | { type: "player/set"; player: PlayerId; set: { name?: string; color?: string; ready?: boolean } }
  | { type: "game/system"; system: string }
  | ({ type: "game/packages" } & GamePackages)
  | { type: "settings/set"; settings: Partial<GameSettings> }
  | { type: "layout/set"; layout: Layout }
  | { type: "terrain/add"; piece: TerrainPiece }
  | { type: "terrain/update"; piece: TerrainPiece }
  | { type: "terrain/remove"; id: string }
  | { type: "unit/add"; unit: Unit; models: Model[] }
  | { type: "unit/remove"; id: UnitId }
  | { type: "unit/members"; id: UnitId; add?: ModelId[]; remove?: ModelId[] }
  | { type: "model/add"; model: Model }
  | { type: "model/remove"; id: ModelId }
  | { type: "token/add"; token: Token }
  | { type: "token/remove"; id: TokenId }
  | { type: "entity/set"; ref: EntityRef; set: EntityFields }
  | { type: "models/move"; moves: ModelMove[]; setup?: boolean }
  | { type: "unit/move"; id: UnitId; pivot: Vec2; turn: number; delta: Vec2 }
  | { type: "q/set"; ref: EntityRef; key: string; value: Json }
  | { type: "q/adjust"; ref: EntityRef; key: string; delta: number }
  | { type: "tag/set"; ref: EntityRef; tag: string; on: boolean }
  | { type: "mod/add"; mod: Mod }
  | { type: "mod/remove"; id?: string; source?: string }
  | { type: "pointer/set"; pointer: Pointer }
  | { type: "dice/roll"; roll: DiceRoll }
  | {
      type: "secret/commit";
      player: PlayerId;
      secrets: { key: string; commitment: string }[];
      label?: string;
    }
  | { type: "secret/reveal"; player: PlayerId; key: string; value: unknown; salt: string; label?: string }
  | { type: "deck/discard"; player: PlayerId; deck: string; key: string }
  | { type: "deck/shuffle"; player: PlayerId; deck: string }
  | { type: "deck/remove"; id: string }
  | LogNote
  | ModuleSet
  | { type: "ranked/card"; player: PlayerId; key: PlayerKey | null }
  | { type: "dice/commit"; player: PlayerId; hash: string }
  | { type: "dice/seed"; player: PlayerId; seed: string }
  | { type: "dice/reveal"; player: PlayerId; seed: string; next?: string }
  | { type: "player/resync"; player: PlayerId }
  | BranchEvent
  | MacroStep
  | { type: "undo"; seq: number; also?: number[] };

export type Rng = () => number;

const MAX_DICE_PER_ROLL = 100;

const COLOR = /^#[0-9a-f]{6}$/i;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const point = (p: unknown): p is Vec2 => !!p && finite((p as Vec2).x) && finite((p as Vec2).y);

function exists(state: GameState, ref: EntityRef): boolean {
  switch (ref?.kind) {
    case "player":
      return !!state.players[ref.id];
    case "unit":
      return !!state.units[ref.id];
    case "model":
      return !!state.models[ref.id];
    case "token":
      return !!state.tokens[ref.id];
    default:
      return false;
  }
}

/**
 * Resolve an intent from `from` into an event, or null if it is rejected.
 * Only malformed or impersonating intents are rejected. Rules are advisory:
 * a move that breaks a game's rules is still applied, and a rules module
 * warns instead.
 */
export function resolveIntent(
  intent: Intent,
  from: PlayerId,
  rng: Rng = Math.random,
  state?: GameState,
  /** The state as it stood after an earlier event; macros replay from it. */
  history?: (seq: number) => GameState,
): GameEvent | null {
  switch (intent.type) {
    case "macro/start": {
      if (!state || state.macro || !state.players[from]) return null;
      const args = intent.args ?? {};
      // An action the module says isn't available now is refused, as its panel would.
      if (!intent.force && codeActionWhy(state, intent.macro, args, from) !== undefined) return null;
      return startMacro(state, intent.macro, args, from, rng, intent.cause);
    }
    case "macro/answer": {
      const macro = state?.macro;
      if (!state || !macro?.waiting || !history) return null;
      if (macro.waiting.player !== from) return null;
      // A secret's answer (a commitment, or a reveal) is checked by the macro itself.
      const secret = macro.waiting.secret !== undefined || macro.waiting.reveal !== undefined;
      if (!secret && !macro.waiting.options.some((o) => o.id === intent.answer)) return null;
      return stepMacro(macro, state, history, rng, intent.answer);
    }
    case "dice/roll": {
      const count = Math.floor(intent.count);
      const sides = Math.floor(intent.sides);
      if (count < 1 || count > MAX_DICE_PER_ROLL || sides < 2) return null;
      const results = Array.from({ length: count }, () => die(rng, sides));
      const roll: DiceRoll = { by: from, sides, results };
      if (intent.faces?.length === sides) roll.faces = intent.faces;
      if (intent.label) roll.label = String(intent.label).slice(0, 60);
      return { type: "dice/roll", roll };
    }
    case "player/join":
      return intent.player.id === from ? intent : null;
    case "player/claim":
      return state?.players[intent.player] && intent.player !== from
        ? { type: "player/claim", player: intent.player, by: from }
        : null;
    case "player/set": {
      if (!state?.players[intent.player] || intent.player !== from) return null;
      const set: { name?: string; color?: string; ready?: boolean } = {};
      if (intent.set.name !== undefined) {
        const name = String(intent.set.name).trim().slice(0, 32);
        if (!name) return null;
        set.name = name;
      }
      if (intent.set.color !== undefined) {
        if (!COLOR.test(String(intent.set.color))) return null;
        set.color = String(intent.set.color).toLowerCase();
      }
      if (intent.set.ready !== undefined) set.ready = !!intent.set.ready;
      return Object.keys(set).length ? { type: "player/set", player: from, set } : null;
    }
    case "player/resync":
      return { type: "player/resync", player: from };
    case "game/system":
      return typeof intent.system === "string" && intent.system.length <= 64 ? intent : null;
    case "game/packages":
      return intent;
    case "ranked/card": {
      // Seated players only.
      if (typeof state?.players[from]?.seat !== "number") return null;
      if (intent.key !== null && !isPlayerKey(intent.key)) return null;
      return { type: "ranked/card", player: from, key: intent.key };
    }
    case "dice/commit": {
      // A ranked game's host (the session only takes this from itself). A new host, or one that
      // lost its seed, starts afresh: the stretch it never revealed can't be checked, and says so.
      if (!state?.ranked?.keys[from] || !isSeed(intent.hash)) return null;
      return { type: "dice/commit", player: from, hash: intent.hash };
    }
    case "dice/seed": {
      const d = state?.sharedDice;
      if (!d || d.by === from || !state.ranked?.keys[from] || d.seeds[from] || !isSeed(intent.seed))
        return null;
      return { type: "dice/seed", player: from, seed: intent.seed };
    }
    case "dice/reveal": {
      const d = state?.sharedDice;
      if (!d || d.by !== from || !isSeed(intent.seed) || commitTo(intent.seed) !== d.commit) return null;
      if (intent.next !== undefined && !isSeed(intent.next)) return null;
      return {
        type: "dice/reveal",
        player: from,
        seed: intent.seed,
        ...(intent.next ? { next: intent.next } : {}),
      };
    }
    case "secret/commit": {
      if (!state?.players[intent.player] || intent.player !== from || !intent.secrets.length) return null;
      const keys = new Set<string>();
      for (const { key, commitment } of intent.secrets) {
        if (!key || keys.has(key) || !isCommitment(commitment) || secretOf(state, from, key)) return null;
        keys.add(key);
      }
      return intent;
    }
    case "secret/reveal":
      if (!state || intent.player !== from) return null;
      return revealMatches(secretOf(state, from, intent.key), intent.value, intent.salt) ? intent : null;
    case "deck/discard": {
      if (!state?.decks?.some((d) => d.id === intent.deck) || !intent.key.startsWith(deckPrefix(intent.deck)))
        return null;
      if (!inHand(state, from, intent.deck).some(([k]) => k === intent.key)) return null;
      return { ...intent, player: from };
    }
    case "deck/shuffle":
      if (!state?.decks?.some((d) => d.id === intent.deck) || !state.players[from]) return null;
      return { ...intent, player: from };
    case "deck/remove":
      return state?.players[from]?.seat !== undefined && state.decks?.some((d) => d.id === intent.id)
        ? intent
        : null;
    case "log/note": {
      const text = String(intent.text ?? "")
        .trim()
        .slice(0, 200);
      return state?.players[from] && text ? { type: "log/note", text } : null;
    }
    case "entity/set": {
      if (!state || !exists(state, intent.ref) || !intent.set || typeof intent.set !== "object") return null;
      const keys = Object.keys(intent.set);
      if (!keys.length || keys.some((k) => PROTECTED.has(k) || !KEY.test(k))) return null;
      return intent;
    }
    case "q/set":
    case "q/adjust": {
      if (!state || !exists(state, intent.ref) || !KEY.test(intent.key)) return null;
      if (intent.type === "q/adjust" && !finite(intent.delta)) return null;
      return intent;
    }
    case "tag/set":
      return state && exists(state, intent.ref) && KEY.test(intent.tag) && typeof intent.on === "boolean"
        ? intent
        : null;
    case "mod/add": {
      const m = intent.mod;
      if (!state || !m || !exists(state, m.target) || !KEY.test(m.q) || !finite(m.value)) return null;
      if (!["add", "set", "min", "max"].includes(m.op)) return null;
      if (m.until !== undefined && !KEY.test(String(m.until.field))) return null;
      // The id comes from the log position, so every peer names it alike.
      return { type: "mod/add", mod: { ...m, id: `m${(state.seq ?? 0) + 1}` } };
    }
    case "mod/remove":
      return intent.id !== undefined || intent.source !== undefined ? intent : null;
    case "pointer/set": {
      const p = intent.pointer;
      if (!p || !Number.isInteger(p.round) || !Number.isInteger(p.seat) || p.seat < 0) return null;
      if (p.phase !== null && typeof p.phase !== "string") return null;
      return intent;
    }
    case "models/move": {
      if (!state || !intent.moves?.length || intent.moves.length > 500) return null;
      if (!intent.moves.every((m) => point(m.to) && !!state.models[m.id])) return null;
      return intent;
    }
    case "unit/move":
      return state?.units[intent.id] && point(intent.pivot) && point(intent.delta) && finite(intent.turn)
        ? intent
        : null;
    case "unit/members":
      return state?.units[intent.id] ? intent : null;
    case "unit/add":
    case "model/add":
    case "token/add":
    case "terrain/add":
    case "terrain/update":
    case "layout/set":
    case "settings/set":
      return intent;
    case "unit/remove":
      return state?.units[intent.id] ? intent : null;
    case "model/remove":
      return state?.models[intent.id] ? intent : null;
    case "token/remove":
      return state?.tokens[intent.id] ? intent : null;
    case "terrain/remove":
      return intent;
    case "undo":
      return intent;
  }
}
