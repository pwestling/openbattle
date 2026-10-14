import type { GameEvent } from "../core/actions";
import type { Bag, EntityKind, Json, Model, Token, Unit } from "../core/types";
import { jsonProblem } from "../core/validate";
import type { DeepReadonly, QuantityDef, ReadonlyJson } from "./index";

const KEY = /^[A-Za-z0-9_.:-]{1,64}$/;
const UNSAFE = {
  ["__proto__"]: true,
  constructor: true,
  prototype: true,
} as const;
const KINDS: Readonly<Record<EntityKind, true>> = {
  player: true,
  unit: true,
  model: true,
  token: true,
};

function safeKey(value: unknown): value is string {
  return typeof value === "string" && KEY.test(value) && !Object.hasOwn(UNSAFE, value);
}

/**
 * A collision-unambiguous ID: a colon-free namespace prefix and typed,
 * length-framed parts, not separator-joined arbitrary values. The result must
 * fit the core's 64-character ID limit. Nothing is truncated.
 */
export function namespacedId(namespace: string, ...parts: (string | number)[]): string {
  if (!safeKey(namespace) || namespace.includes(":"))
    throw new Error("ID namespace must be a safe colon-free key");
  let id = namespace;
  for (const part of parts) {
    let text: string;
    let type: string;
    if (typeof part === "string") {
      if (!safeKey(part)) throw new Error("ID string parts must be safe keys");
      text = part;
      type = "s";
    } else {
      if (typeof part !== "number" || !Number.isSafeInteger(part) || Object.is(part, -0))
        throw new Error("ID numeric parts must be safe integers other than negative zero");
      text = String(part);
      type = "n";
    }
    id += `:${type}${text.length}:${text}`;
    if (id.length > 64) throw new Error("Namespaced ID exceeds the 64-character limit");
  }
  if (!safeKey(id)) throw new Error("Namespaced ID exceeds the 64-character limit");
  return id;
}

function requireJson(value: unknown, label: string): void {
  const problem = jsonProblem(value);
  if (problem) throw new Error(`${label}: ${problem}`);
}

/** Copy already-validated JSON iteratively, including each occurrence of a shared object. */
function copyJson(value: ReadonlyJson): Json {
  if (value === null || typeof value !== "object") return value;
  const root: Json[] | Bag = Array.isArray(value) ? [] : {};
  const pending: {
    source: readonly ReadonlyJson[] | Readonly<Record<string, ReadonlyJson>>;
    target: Json[] | Bag;
  }[] = [{ source: value, target: root }];
  while (pending.length) {
    const { source, target } = pending.pop()!;
    for (const key of Object.keys(source)) {
      const item = (source as Readonly<Record<string, ReadonlyJson>>)[key]!;
      let copied: Json;
      if (item !== null && typeof item === "object") {
        copied = Array.isArray(item) ? [] : {};
        pending.push({ source: item, target: copied });
      } else copied = item;
      (target as Bag)[key] = copied;
    }
  }
  return root;
}

/**
 * Materialize declared defaults for one kind as explicit event data. Overrides
 * win by presence (including 0, false and null). Both sources are validated and
 * deeply copied; no quantities are applied to entities already in state.
 */
export function initialQuantities(
  definitions: readonly DeepReadonly<QuantityDef>[],
  kind: EntityKind,
  overrides?: Readonly<Record<string, ReadonlyJson>>,
): Bag {
  if (!Object.hasOwn(KINDS, kind)) throw new Error("Unknown quantity entity kind");
  requireJson(definitions, "Quantity definitions");
  if (!Array.isArray(definitions)) throw new Error("Quantity definitions must be an array");
  if (overrides !== undefined) {
    requireJson(overrides, "Quantity overrides");
    if (overrides === null || typeof overrides !== "object" || Array.isArray(overrides))
      throw new Error("Quantity overrides must be an object");
    for (const key of Object.keys(overrides))
      if (!safeKey(key)) throw new Error(`Unsafe quantity override key: ${key}`);
  }
  const seen = new Map<EntityKind, Set<string>>();
  const result: Bag = {};
  for (const definition of definitions) {
    if (
      definition === null ||
      typeof definition !== "object" ||
      Array.isArray(definition) ||
      !safeKey(definition.id) ||
      typeof definition.name !== "string" ||
      !Object.hasOwn(KINDS, definition.on)
    )
      throw new Error("Quantity definitions need a safe ID, name and entity kind");
    let keys = seen.get(definition.on);
    if (!keys) {
      keys = new Set();
      seen.set(definition.on, keys);
    }
    if (keys.has(definition.id))
      throw new Error(`Duplicate quantity definition: ${definition.on}:${definition.id}`);
    keys.add(definition.id);
    if (
      definition.on === kind &&
      Object.hasOwn(definition, "initial") &&
      (overrides === undefined || !Object.hasOwn(overrides, definition.id))
    )
      result[definition.id] = copyJson(definition.initial!);
  }
  if (overrides !== undefined) {
    for (const key of Object.keys(overrides)) {
      result[key] = copyJson(overrides[key]!);
    }
  }
  return result;
}

function withQuantities<T extends Unit | Model | Token>(
  definitions: readonly DeepReadonly<QuantityDef>[],
  kind: EntityKind,
  entity: DeepReadonly<T>,
): T {
  requireJson(entity, `${kind} entity`);
  if (entity === null || typeof entity !== "object" || Array.isArray(entity))
    throw new Error(`${kind} entity must be an object`);
  const { q, ...fields } = entity;
  const copied = copyJson(fields as ReadonlyJson) as unknown as T;
  copied.q = initialQuantities(definitions, kind, q);
  return copied;
}

/** Construct a unit/add primitive with explicit unit and model starting quantities. */
export function unitAdd(
  definitions: readonly DeepReadonly<QuantityDef>[],
  unit: DeepReadonly<Unit>,
  models: readonly DeepReadonly<Model>[],
): Extract<GameEvent, { type: "unit/add" }> {
  requireJson(models, "Unit models");
  if (!Array.isArray(models)) throw new Error("Unit models must be an array");
  return {
    type: "unit/add",
    unit: withQuantities<Unit>(definitions, "unit", unit),
    models: models.map((model) => withQuantities<Model>(definitions, "model", model)),
  };
}

/** Construct a model/add primitive with explicit starting quantities. */
export function modelAdd(
  definitions: readonly DeepReadonly<QuantityDef>[],
  model: DeepReadonly<Model>,
): Extract<GameEvent, { type: "model/add" }> {
  return { type: "model/add", model: withQuantities<Model>(definitions, "model", model) };
}

/** Construct a token/add primitive with explicit starting quantities. */
export function tokenAdd(
  definitions: readonly DeepReadonly<QuantityDef>[],
  token: DeepReadonly<Token>,
): Extract<GameEvent, { type: "token/add" }> {
  return { type: "token/add", token: withQuantities<Token>(definitions, "token", token) };
}
