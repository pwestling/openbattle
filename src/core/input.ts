import { jsonProblem } from "./validate";

export interface InputOption {
  id: string;
  label: string;
}

/** Explicit candidates, not rule-filtered queries into live state. */
export interface InputRef {
  kind: "unit" | "model" | "token" | "card" | "terrain";
  id: string;
}

interface SelectionBounds {
  min?: number;
  max?: number;
  /** The answer array preserves the player's chosen order in either mode. */
  ordered?: boolean;
}

/** Data-only player input. Spatial values are proposals in inches/radians, never table mutations. */
export type InputSpec =
  | { kind: "choice"; options: InputOption[] }
  | ({ kind: "multiChoice"; options: InputOption[] } & SelectionBounds)
  | { kind: "number"; min?: number; max?: number; integer?: boolean }
  | { kind: "text"; minLength?: number; maxLength?: number; multiline?: boolean }
  | ({ kind: "reference"; options: { ref: InputRef; label: string }[]; multiple?: boolean } & SelectionBounds)
  | { kind: "point" }
  | { kind: "pose" }
  | { kind: "path"; minPoints?: number; maxPoints?: number };

export type InputAnswer =
  | string
  | string[]
  | number
  | InputRef
  | InputRef[]
  | { x: number; y: number }
  | { position: { x: number; y: number }; facing: number }
  | { x: number; y: number }[];

const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const count = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v >= 0;
const optional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const fields = (v: Record<string, unknown>, names: string[]) =>
  Object.keys(v).every((k) => names.includes(k));
const point = (v: unknown): boolean => object(v) && fields(v, ["x", "y"]) && finite(v.x) && finite(v.y);
const ref = (v: unknown): v is InputRef =>
  object(v) &&
  fields(v, ["kind", "id"]) &&
  ["unit", "model", "token", "card", "terrain"].includes(String(v.kind)) &&
  typeof v.id === "string" &&
  v.id.length > 0;
const refKey = (v: InputRef) => `${v.kind}:${v.id}`;
const bounds = (min: unknown, max: unknown) =>
  optional(min, count) &&
  optional(max, count) &&
  (min === undefined || max === undefined || (min as number) <= (max as number));

/** Validate the package's request before suspending. A malformed request fails the macro. */
export function inputSpecProblem(spec: unknown): string | null {
  const json = jsonProblem(spec);
  if (json) return json;
  if (!object(spec)) return "input must be an object";
  switch (spec.kind) {
    case "choice":
    case "multiChoice": {
      if (
        !Array.isArray(spec.options) ||
        !spec.options.every(
          (o) =>
            object(o) &&
            fields(o, ["id", "label"]) &&
            typeof o.id === "string" &&
            o.id.length > 0 &&
            typeof o.label === "string",
        ) ||
        new Set(spec.options.map((o) => o.id)).size !== spec.options.length
      )
        return "input choices need unique nonempty IDs and labels";
      if (spec.kind === "choice")
        return fields(spec, ["kind", "options"]) && spec.options.length > 0
          ? null
          : "choice needs at least one offered option and no unknown fields";
      return fields(spec, ["kind", "options", "min", "max", "ordered"]) &&
        bounds(spec.min, spec.max) &&
        (spec.min === undefined || (spec.min as number) <= spec.options.length) &&
        (spec.max === undefined || (spec.max as number) <= spec.options.length) &&
        optional(spec.ordered, (v) => typeof v === "boolean")
        ? null
        : "invalid selection bounds";
    }
    case "reference": {
      if (
        !Array.isArray(spec.options) ||
        !spec.options.every(
          (o) => object(o) && fields(o, ["ref", "label"]) && ref(o.ref) && typeof o.label === "string",
        ) ||
        new Set(spec.options.map((o) => refKey(o.ref))).size !== spec.options.length
      )
        return "reference input needs unique labeled references";
      if (
        !fields(spec, ["kind", "options", "multiple", "min", "max", "ordered"]) ||
        !optional(spec.multiple, (v) => typeof v === "boolean") ||
        !optional(spec.ordered, (v) => typeof v === "boolean") ||
        !bounds(spec.min, spec.max) ||
        (spec.min !== undefined && (spec.min as number) > spec.options.length) ||
        (spec.max !== undefined && (spec.max as number) > spec.options.length) ||
        (!spec.multiple &&
          (spec.options.length === 0 ||
            spec.min !== undefined ||
            spec.max !== undefined ||
            spec.ordered !== undefined))
      )
        return "invalid reference selection bounds";
      return null;
    }
    case "number":
      return fields(spec, ["kind", "min", "max", "integer"]) &&
        optional(spec.min, finite) &&
        optional(spec.max, finite) &&
        (spec.min === undefined || spec.max === undefined || (spec.min as number) <= (spec.max as number)) &&
        optional(spec.integer, (v) => typeof v === "boolean") &&
        (!spec.integer ||
          Math.ceil(
            Math.max((spec.min as number | undefined) ?? -Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER),
          ) <=
            Math.floor(
              Math.min((spec.max as number | undefined) ?? Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
            ))
        ? null
        : "invalid number bounds";
    case "text":
      return fields(spec, ["kind", "minLength", "maxLength", "multiline"]) &&
        bounds(spec.minLength, spec.maxLength) &&
        optional(spec.multiline, (v) => typeof v === "boolean")
        ? null
        : "invalid text bounds";
    case "point":
    case "pose":
      return fields(spec, ["kind"]) ? null : "unknown spatial input field";
    case "path":
      return fields(spec, ["kind", "minPoints", "maxPoints"]) && bounds(spec.minPoints ?? 2, spec.maxPoints)
        ? null
        : "invalid path bounds";
    default:
      return "unknown input kind";
  }
}

/** Structural/domain validation only; no distances, ownership, table bounds or game legality. */
export function inputAnswerProblem(spec: InputSpec, answer: unknown): string | null {
  const json = jsonProblem(answer);
  if (json) return json;
  switch (spec.kind) {
    case "choice":
      return typeof answer === "string" && spec.options.some((o) => o.id === answer)
        ? null
        : "choose an offered option";
    case "multiChoice":
      return selectionProblem(
        answer,
        spec.min ?? 0,
        spec.max ?? spec.options.length,
        (v) => typeof v === "string" && spec.options.some((o) => o.id === v),
        (v) => String(v),
      );
    case "reference": {
      const offered = (v: unknown) => ref(v) && spec.options.some((o) => refKey(o.ref) === refKey(v));
      return spec.multiple
        ? selectionProblem(answer, spec.min ?? 0, spec.max ?? spec.options.length, offered, (v) =>
            refKey(v as InputRef),
          )
        : offered(answer)
          ? null
          : "choose an offered reference";
    }
    case "number":
      return finite(answer) &&
        (!spec.integer || Number.isSafeInteger(answer)) &&
        (spec.min === undefined || answer >= spec.min) &&
        (spec.max === undefined || answer <= spec.max)
        ? null
        : "number does not match the requested range or integer format";
    case "text":
      return typeof answer === "string" &&
        answer.length >= (spec.minLength ?? 0) &&
        (spec.maxLength === undefined || answer.length <= spec.maxLength)
        ? null
        : "text does not match the requested length";
    case "point":
      return point(answer) ? null : "point needs finite x and y";
    case "pose":
      return object(answer) &&
        fields(answer, ["position", "facing"]) &&
        point(answer.position) &&
        finite(answer.facing)
        ? null
        : "pose needs a point and finite facing in radians";
    case "path":
      return Array.isArray(answer) &&
        answer.length >= (spec.minPoints ?? 2) &&
        (spec.maxPoints === undefined || answer.length <= spec.maxPoints) &&
        answer.every(point)
        ? null
        : "path needs the requested number of finite points";
  }
}

function selectionProblem(
  answer: unknown,
  min: number,
  max: number,
  offered: (v: unknown) => boolean,
  key: (v: unknown) => string,
) {
  return Array.isArray(answer) &&
    answer.length >= min &&
    answer.length <= max &&
    answer.every(offered) &&
    new Set(answer.map(key)).size === answer.length
    ? null
    : "select distinct offered values within the requested count";
}
