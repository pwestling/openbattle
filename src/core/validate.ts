import type { GameEvent } from "./actions";
import { cardEventProblem, cardLayoutProblem } from "./cards";
import { isCommitment, revealMatches, secretOf } from "./secrets";
import type { EntityRef, GameState } from "./types";

/** Names used as dictionary keys must never address an object's prototype. */
const KEY = /^[A-Za-z0-9_.:-]{1,64}$/;
const UNSAFE = { ["__proto__"]: true, constructor: true, prototype: true } as const;
const PROTECTED: Readonly<Record<string, true>> = {
  id: true,
  seat: true,
  q: true,
  tags: true,
  modelIds: true,
  unitId: true,
  kind: true,
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const key = (value: unknown): value is string =>
  typeof value === "string" && KEY.test(value) && !Object.hasOwn(UNSAFE, value);
const integer = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const point = (value: unknown): boolean => object(value) && finite(value.x) && finite(value.y);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(key) && new Set(value).size === value.length;

/** Validate actual JSON data, without invoking getters or recursing on its call stack. */
export function jsonProblem(value: unknown): string | null {
  const active = new Set<object>();
  const pending: { value: unknown; leaving?: boolean }[] = [{ value }];
  try {
    while (pending.length) {
      const next = pending.pop()!;
      const item = next.value;
      if (next.leaving) {
        active.delete(item as object);
        continue;
      }
      if (item === null || typeof item === "string" || typeof item === "boolean") continue;
      if (finite(item)) continue;
      if (typeof item !== "object" || item === null) return "event values must be finite JSON";
      const array = Array.isArray(item);
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array))
        return "event values must be plain JSON objects";
      if (active.has(item)) return "event values must not contain cycles";
      active.add(item);
      pending.push({ value: item, leaving: true });
      const descriptors = Object.getOwnPropertyDescriptors(item);
      const names = Reflect.ownKeys(descriptors);
      if (array && names.length !== (item as unknown[]).length + 1) return "JSON arrays must not have holes";
      for (const name of names) {
        if (typeof name !== "string" || Object.hasOwn(UNSAFE, name)) return "unsafe JSON key";
        if (array && name === "length") continue;
        if (array && !/^(0|[1-9][0-9]*)$/.test(name)) return "JSON arrays must not have named fields";
        const descriptor = descriptors[name]!;
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value"))
          return "JSON fields must be enumerable data properties";
        pending.push({ value: descriptor.value });
      }
    }
  } catch {
    return "event values must be readable JSON";
  }
  return null;
}

function entityOf(state: GameState, ref: EntityRef) {
  const table =
    ref.kind === "player"
      ? state.players
      : ref.kind === "unit"
        ? state.units
        : ref.kind === "model"
          ? state.models
          : state.tokens;
  return Object.hasOwn(table, ref.id) ? table[ref.id] : undefined;
}

function refProblem(ref: unknown, state?: GameState): string | null {
  if (
    !object(ref) ||
    !key(ref.id) ||
    typeof ref.kind !== "string" ||
    !["player", "unit", "model", "token"].includes(ref.kind)
  )
    return "entity reference needs a valid kind and safe id";
  if (!state) return null;
  return entityOf(state, ref as unknown as EntityRef) ? null : "unknown entity";
}

function bagsProblem(entity: Record<string, unknown>): string | null {
  if (entity.q !== undefined && (!object(entity.q) || Object.keys(entity.q).some((name) => !key(name))))
    return "quantities need a bag of safe keys";
  if (entity.tags !== undefined && !ids(entity.tags)) return "tags must be a unique list of safe keys";
  return null;
}

function baseProblem(base: unknown): string | null {
  if (!object(base)) return "base needs a shape and nonnegative dimensions";
  if (base.shape === "round")
    return nonnegative(base.diameterMm) ? null : "base diameter must be nonnegative";
  if (base.shape === "oval" || base.shape === "rect")
    return nonnegative(base.widthMm) && nonnegative(base.depthMm)
      ? null
      : "base dimensions must be nonnegative";
  return "unknown base shape";
}

function physicalProblem(entity: Record<string, unknown>): string | null {
  if (entity.z !== undefined && !finite(entity.z)) return "height above the table must be finite";
  if (entity.height !== undefined && (!finite(entity.height) || entity.height < 0))
    return "body height must be finite and nonnegative";
  if (entity.bands !== undefined) {
    if (!Array.isArray(entity.bands)) return "body bands must be an array";
    for (const band of entity.bands)
      if (
        !object(band) ||
        !nonnegative(band.r) ||
        !nonnegative(band.z0) ||
        !nonnegative(band.z1) ||
        band.z1 < band.z0
      )
        return "body bands need nonnegative finite radii/heights and ordered intervals";
  }
  return null;
}

function entityProblem(
  kind: EntityRef["kind"],
  value: unknown,
  state?: GameState,
  contained = false,
): string | null {
  if (!object(value) || !key(value.id)) return `${kind} needs a safe id`;
  const bags = bagsProblem(value);
  if (bags) return bags;
  if (kind === "player") {
    if (typeof value.name !== "string" || typeof value.color !== "string")
      return "player needs name and color";
    if (value.seat !== undefined && (!integer(value.seat) || value.seat < 0))
      return "player seat must be nonnegative";
    if (value.ready !== undefined && typeof value.ready !== "boolean") return "player ready must be boolean";
    return null;
  }
  if (value.owner !== undefined || kind !== "token")
    if (!key(value.owner) || (state && !Object.hasOwn(state.players, value.owner)))
      return "entity owner must be a known player";
  if (kind === "unit")
    return typeof value.name === "string" && ids(value.modelIds)
      ? null
      : "unit needs a name and unique safe model ids";
  if (!point(value.position)) return "entity position must be finite";
  if (kind === "model") {
    if (typeof value.label !== "string" || !finite(value.facing))
      return "model needs a label and finite facing";
    if (value.off !== undefined && typeof value.off !== "boolean") return "model off must be boolean";
    if (
      value.unitId !== undefined &&
      (!key(value.unitId) || (!contained && state && !Object.hasOwn(state.units, value.unitId)))
    )
      return "model unitId must reference a known unit";
  } else {
    if (typeof value.kind !== "string" || !value.kind) return "token needs a kind";
    if (value.label !== undefined && typeof value.label !== "string") return "token label must be a string";
    if (value.facing !== undefined && !finite(value.facing)) return "token facing must be finite";
  }
  if (kind === "model" || value.base !== undefined) {
    const problem = baseProblem(value.base);
    if (problem) return problem;
  }
  return physicalProblem(value);
}

function terrainProblem(value: unknown): string | null {
  if (
    !object(value) ||
    !key(value.id) ||
    typeof value.name !== "string" ||
    typeof value.category !== "string"
  )
    return "terrain needs a safe id, name and category";
  if (
    !point(value.position) ||
    !finite(value.facing) ||
    !nonnegative(value.width) ||
    !nonnegative(value.depth)
  )
    return "terrain needs finite position, facing and nonnegative dimensions";
  if (!Array.isArray(value.solids)) return "terrain solids must be an array";
  for (const solid of value.solids)
    if (
      !object(solid) ||
      typeof solid.kind !== "string" ||
      !["wall", "floor", "block", "foliage"].includes(solid.kind) ||
      !finite(solid.x) ||
      !finite(solid.y) ||
      !finite(solid.z) ||
      !nonnegative(solid.w) ||
      !nonnegative(solid.d) ||
      !nonnegative(solid.h)
    )
      return "terrain solids need a known kind, finite coordinates and nonnegative dimensions";
  if (
    value.hull !== undefined &&
    (!Array.isArray(value.hull) || value.hull.length % 9 !== 0 || !value.hull.every(finite))
  )
    return "terrain hull must contain complete finite triangles";
  return bagsProblem(value);
}

function layoutProblem(layout: unknown, state?: GameState): string | null {
  const cards = cardLayoutProblem(layout, state);
  if (cards) return cards;
  const value = layout as Record<string, unknown>;
  if (
    value.table !== undefined &&
    (!object(value.table) || !positive(value.table.width) || !positive(value.table.depth))
  )
    return "table dimensions must be positive";
  for (const [items, check] of [
    [value.terrain, (item: unknown) => terrainProblem(item)],
    [value.tokens, (item: unknown) => entityProblem("token", item, state)],
  ] as const) {
    const seen = new Set<string>();
    for (const item of items as Record<string, unknown>[]) {
      const problem = check(item);
      if (problem) return problem;
      if (seen.has(item.id as string)) return "layout ids must be unique";
      seen.add(item.id as string);
    }
  }
  for (const zone of value.zones as unknown[])
    if (
      !object(zone) ||
      !integer(zone.seat) ||
      zone.seat < 0 ||
      !Array.isArray(zone.points) ||
      zone.points.length < 3 ||
      !zone.points.every(point)
    )
      return "zones need a nonnegative seat and at least three finite polygon points";
  return null;
}

/** The single contract for resolved primitives: JSON shape and table mechanics, never game rules. */
export function eventProblem(event: unknown, state?: GameState): string | null {
  const json = jsonProblem(event);
  if (json) return json;
  if (!object(event) || typeof event.type !== "string") return "not an event";
  const e = event as unknown as GameEvent;
  switch (e.type) {
    case "layout/set":
      return layoutProblem(e.layout, state);
    case "terrain/add":
    case "terrain/update":
      return terrainProblem(e.piece);
    case "terrain/remove":
      return key(e.id) ? null : "terrain needs a safe id";
    case "unit/add": {
      const problem = entityProblem("unit", e.unit, state);
      if (problem) return problem;
      if (!Array.isArray(e.models)) return "unit models must be an array";
      const seen = new Set<string>();
      for (const model of e.models) {
        const problem = entityProblem("model", model, state, true);
        if (problem) return problem;
        if (seen.has(model.id)) return "unit models must have unique ids";
        seen.add(model.id);
      }
      // The reducer deliberately replaces modelIds and each supplied model's unitId.
      return null;
    }
    case "model/add":
      return entityProblem("model", e.model, state);
    case "token/add":
      return entityProblem("token", e.token, state);
    case "unit/remove":
    case "model/remove":
    case "token/remove":
      return refProblem({ kind: e.type.split("/")[0], id: e.id }, state);
    case "unit/members": {
      const problem = refProblem({ kind: "unit", id: e.id }, state);
      if (problem) return problem;
      for (const members of [e.add, e.remove]) {
        if (members === undefined) continue;
        if (!ids(members)) return "unit members must be unique safe model ids";
        if (state && members.some((id) => !Object.hasOwn(state.models, id))) return "unknown member model";
      }
      return null;
    }
    case "entity/set": {
      const problem = refProblem(e.ref, state);
      if (problem) return problem;
      if (
        !object(e.set) ||
        !Object.keys(e.set).length ||
        Object.keys(e.set).some((name) => Object.hasOwn(PROTECTED, name) || !key(name))
      )
        return "entity/set may not change identity, containment, reserved seat or the q and tags bags";
      if (!state) {
        // Validate known geometry fields even when only shape is available.
        const kind = e.ref.kind;
        for (const name of kind === "player"
          ? ["name", "color"]
          : kind === "unit"
            ? ["name"]
            : kind === "model"
              ? ["label"]
              : [])
          if (Object.hasOwn(e.set, name) && typeof e.set[name] !== "string") return `${name} must be text`;
        if (
          Object.hasOwn(e.set, "owner") &&
          kind !== "player" &&
          !(kind === "token" && e.set.owner === null) &&
          !key(e.set.owner)
        )
          return "owner needs a safe player id";
        if (kind === "player") {
          if (e.set.ready !== undefined && e.set.ready !== null && typeof e.set.ready !== "boolean")
            return "player ready must be boolean";
        }
        if (kind === "model" || kind === "token") {
          if (Object.hasOwn(e.set, "position") && !point(e.set.position))
            return "entity position must be finite";
          if (kind === "model" && Object.hasOwn(e.set, "facing") && !finite(e.set.facing))
            return "model facing must be finite";
          if (
            kind === "token" &&
            e.set.label !== undefined &&
            e.set.label !== null &&
            typeof e.set.label !== "string"
          )
            return "token label must be text";
          if (Object.hasOwn(e.set, "base") && (kind === "model" || e.set.base !== null)) {
            const problem = baseProblem(e.set.base);
            if (problem) return problem;
          }
          if (e.set.facing !== undefined && e.set.facing !== null && !finite(e.set.facing))
            return "facing must be finite";
          if (
            kind === "model" &&
            e.set.off !== undefined &&
            e.set.off !== null &&
            typeof e.set.off !== "boolean"
          )
            return "model off must be boolean";
          return physicalProblem(
            Object.fromEntries(Object.entries(e.set).filter(([, value]) => value !== null)),
          );
        }
        return null;
      }
      const next: Record<string, unknown> = { ...entityOf(state, e.ref) };
      for (const [name, value] of Object.entries(e.set)) {
        if (value === null) delete next[name];
        else next[name] = value;
      }
      return entityProblem(e.ref.kind, next, state);
    }
    case "q/set":
    case "q/adjust": {
      const problem = refProblem(e.ref, state);
      if (problem) return problem;
      if (!key(e.key)) return "quantity needs a safe key";
      if (e.type === "q/adjust") {
        if (!finite(e.delta)) return "quantity adjustment must be finite";
        if (state) {
          const was = entityOf(state, e.ref)?.q?.[e.key];
          if (!finite((typeof was === "number" ? was : 0) + e.delta)) return "quantity adjustment overflows";
        }
      } else if (!Object.hasOwn(event, "value")) return "quantity needs a JSON value";
      return null;
    }
    case "tag/set":
      return (
        refProblem(e.ref, state) ??
        (key(e.tag) && typeof e.on === "boolean" ? null : "tag needs a safe key and boolean")
      );
    case "mod/add": {
      const m = e.mod;
      if (!object(m) || !key(m.id)) return "modifier needs a safe id";
      const problem = refProblem(m.target, state);
      if (problem) return problem;
      if (
        !key(m.q) ||
        typeof m.op !== "string" ||
        !["add", "set", "min", "max"].includes(m.op) ||
        !finite(m.value)
      )
        return "modifier needs a safe quantity, known operation and finite value";
      if (m.source !== undefined && typeof m.source !== "string") return "modifier source must be a string";
      if (m.until !== undefined && (!object(m.until) || !key(m.until.field) || !Object.hasOwn(m.until, "is")))
        return "modifier expiry needs a safe pointer field and JSON value";
      return null;
    }
    case "mod/remove":
      if (e.id === undefined && e.source === undefined) return "modifier removal needs an id or source";
      return (e.id === undefined || key(e.id)) && (e.source === undefined || typeof e.source === "string")
        ? null
        : "invalid modifier removal";
    case "pointer/set": {
      const p = e.pointer;
      return object(p) &&
        integer(p.round) &&
        integer(p.seat) &&
        p.seat >= 0 &&
        (p.phase === null || typeof p.phase === "string") &&
        Object.keys(p).every(key)
        ? null
        : "pointer needs an integer round, nonnegative seat, phase and safe fields";
    }
    case "models/move": {
      if (!Array.isArray(e.moves) || !e.moves.length || e.moves.length > 500)
        return "move needs 1 to 500 models";
      if (e.setup !== undefined && typeof e.setup !== "boolean") return "move setup must be boolean";
      const seen = new Set<string>();
      for (const move of e.moves) {
        if (
          !object(move) ||
          !point(move.to) ||
          (move.z !== undefined && !finite(move.z)) ||
          (move.facing !== undefined && !finite(move.facing)) ||
          (move.via !== undefined && (!Array.isArray(move.via) || !move.via.every(point)))
        )
          return "model moves need finite positions, heights, facings and paths";
        const problem = refProblem({ kind: "model", id: move.id }, state);
        if (problem) return problem;
        if (seen.has(move.id)) return "move model ids must be unique";
        seen.add(move.id);
      }
      return null;
    }
    case "unit/move": {
      const problem = refProblem({ kind: "unit", id: e.id }, state);
      if (problem) return problem;
      if (!point(e.pivot) || !point(e.delta) || !finite(e.turn))
        return "unit move needs finite pivot, delta and turn";
      if (state) {
        const cosine = Math.cos(e.turn);
        const sine = Math.sin(e.turn);
        for (const id of state.units[e.id]!.modelIds) {
          const model = state.models[id];
          if (!model) continue;
          const x = model.position.x - e.pivot.x;
          const y = model.position.y - e.pivot.y;
          if (
            !finite(e.pivot.x + (x * cosine + y * sine) + e.delta.x) ||
            !finite(e.pivot.y + (-x * sine + y * cosine) + e.delta.y) ||
            !finite(model.facing + e.turn)
          )
            return "unit move overflows model coordinates";
        }
      }
      return null;
    }
    case "collection/add":
    case "collection/remove":
    case "card/add":
    case "cards/remove":
    case "cards/move":
    case "card/set":
    case "collection/shuffle":
      return cardEventProblem(e, state) ?? null;
    case "module/set":
      return key(e.module) && key(e.key) && Object.hasOwn(event, "value")
        ? null
        : "module state needs safe ids and a JSON value";
    case "log/note":
      return typeof e.text === "string" ? null : "log note needs text";
    case "dice/roll": {
      const roll = e.roll;
      if (
        !object(roll) ||
        !key(roll.by) ||
        !integer(roll.sides) ||
        roll.sides < 0 ||
        !Array.isArray(roll.results) ||
        roll.results.some((n) => !integer(n) || n < 1 || n > roll.sides) ||
        (roll.sides === 0 && roll.results.length !== 0)
      )
        return "invalid resolved dice roll";
      if (
        roll.faces !== undefined &&
        (!Array.isArray(roll.faces) ||
          roll.faces.length !== roll.sides ||
          !roll.faces.every((face) => typeof face === "string"))
      )
        return "dice faces must match the sides";
      return roll.label === undefined || typeof roll.label === "string" ? null : "dice label must be text";
    }
    case "secret/commit": {
      if (
        !key(e.player) ||
        (state && !Object.hasOwn(state.players, e.player)) ||
        !Array.isArray(e.secrets) ||
        !e.secrets.length
      )
        return "secret commitment needs a player and secrets";
      if (e.label !== undefined && typeof e.label !== "string") return "secret label must be text";
      const seen = new Set<string>();
      for (const secret of e.secrets) {
        if (!object(secret) || !key(secret.key) || !isCommitment(secret.commitment) || seen.has(secret.key))
          return "secret commitments need unique safe keys and hashes";
        if (state && secretOf(state, e.player, secret.key)) return "secret already committed";
        seen.add(secret.key);
      }
      return null;
    }
    case "secret/reveal":
      if (
        !key(e.player) ||
        !key(e.key) ||
        typeof e.salt !== "string" ||
        !Object.hasOwn(event, "value") ||
        (e.label !== undefined && typeof e.label !== "string")
      )
        return "invalid secret reveal";
      if (!state) return null;
      try {
        return Object.hasOwn(state.players, e.player) &&
          revealMatches(secretOf(state, e.player, e.key), e.value, e.salt)
          ? null
          : "secret reveal does not match its commitment";
      } catch {
        return "invalid secret reveal value";
      }
    case "player/join":
      return entityProblem("player", e.player, state);
    case "player/claim":
      return key(e.by) ? refProblem({ kind: "player", id: e.player }, state) : "claim needs a safe peer id";
    case "player/set":
      return (
        refProblem({ kind: "player", id: e.player }, state) ??
        (object(e.set) &&
        Object.keys(e.set).length > 0 &&
        Object.keys(e.set).every((name) => ["name", "color", "ready", "seat"].includes(name)) &&
        (e.set.name === undefined || typeof e.set.name === "string") &&
        (e.set.color === undefined ||
          (typeof e.set.color === "string" && /^#[0-9a-f]{6}$/i.test(e.set.color))) &&
        (e.set.ready === undefined || typeof e.set.ready === "boolean") &&
        (e.set.seat === undefined || e.set.seat === null || (integer(e.set.seat) && e.set.seat >= 0))
          ? null
          : "invalid player fields")
      );
    case "player/resync":
      return key(e.player) ? null : "resync needs a safe player id";
    case "game/system":
      return typeof e.system === "string" && e.system.length <= 64 ? null : "invalid system id";
    case "game/packages":
      if (typeof e.app !== "string" || !key(e.system) || !Array.isArray(e.packages))
        return "invalid package selection";
      for (const pkg of e.packages)
        if (
          !object(pkg) ||
          !key(pkg.id) ||
          typeof pkg.name !== "string" ||
          typeof pkg.version !== "string" ||
          !isCommitment(pkg.hash) ||
          !integer(pkg.bytes) ||
          pkg.bytes < 0 ||
          (pkg.author !== undefined && typeof pkg.author !== "string") ||
          (pkg.kind !== undefined && pkg.kind !== "system")
        )
          return "invalid package reference";
      return new Set(e.packages.map((pkg) => pkg.id)).size === e.packages.length
        ? null
        : "duplicate package ids";
    case "undo":
      return integer(e.seq) &&
        e.seq > 0 &&
        (e.also === undefined ||
          (Array.isArray(e.also) &&
            e.also.every((seq) => integer(seq) && seq > 0) &&
            new Set(e.also).size === e.also.length))
        ? null
        : "undo needs positive sequence numbers";
    default:
      return "unknown primitive event";
  }
}

/**
 * The events a rules module may emit from a macro (`ctx.emit`): the table's
 * primitives. Players, packages, undo, the log's own bookkeeping, secrets and
 * dice (which have their own commands) are not among them.
 */
const EMITTABLE: Readonly<Record<string, true>> = {
  "layout/set": true,
  "terrain/add": true,
  "terrain/update": true,
  "terrain/remove": true,
  "unit/add": true,
  "unit/remove": true,
  "unit/members": true,
  "model/add": true,
  "model/remove": true,
  "token/add": true,
  "token/remove": true,
  "entity/set": true,
  "models/move": true,
  "unit/move": true,
  "q/set": true,
  "q/adjust": true,
  "tag/set": true,
  "mod/add": true,
  "mod/remove": true,
  "pointer/set": true,
  "collection/add": true,
  "collection/remove": true,
  "card/add": true,
  "cards/remove": true,
  "cards/move": true,
  "card/set": true,
  "log/note": true,
  "module/set": true,
};

/** Why a module's event can't go in the log, or null when it can. */
export function emitProblem(event: unknown, state?: GameState): string | null {
  const json = jsonProblem(event);
  if (json) return json;
  if (!object(event) || typeof event.type !== "string") return "not an event";
  if (!Object.hasOwn(EMITTABLE, event.type)) return `"${event.type}" is not a primitive a module may emit`;
  return eventProblem(event, state);
}
