import type { GameEvent } from "./actions";

/** What a quantity, tag or entity field may be called. */
export const KEY = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Fields of an entity that `entity/set` never touches: identity, containment and the open bags. */
export const PROTECTED = new Set(["id", "q", "tags", "modelIds", "unitId", "kind"]);

/**
 * The events a rules module may emit from a macro (`ctx.emit`): the table's
 * primitives. Players, packages, undo, the log's own bookkeeping, secrets and
 * dice (which have their own commands) are not among them.
 */
const EMITTABLE: ReadonlySet<string> = new Set([
  "terrain/add",
  "terrain/update",
  "terrain/remove",
  "unit/add",
  "unit/remove",
  "unit/members",
  "model/add",
  "model/remove",
  "token/add",
  "token/remove",
  "entity/set",
  "models/move",
  "unit/move",
  "q/set",
  "q/adjust",
  "tag/set",
  "mod/add",
  "mod/remove",
  "pointer/set",
  "deck/shuffle",
  "log/note",
  "module/set",
]);

/** Why a module's event can't go in the log, or null when it can. */
export function emitProblem(event: unknown): string | null {
  const e = event as GameEvent | null;
  if (!e || typeof e !== "object" || typeof e.type !== "string") return "not an event";
  if (!EMITTABLE.has(e.type)) return `"${e.type}" is not a primitive a module may emit`;
  if (e.type === "entity/set" && Object.keys(e.set ?? {}).some((k) => PROTECTED.has(k) || !KEY.test(k)))
    return "entity/set may not change identity, containment or the q and tags bags";
  if (e.type === "mod/add" && !(typeof e.mod?.id === "string" && e.mod.id)) return "mod/add needs a mod id";
  return null;
}
