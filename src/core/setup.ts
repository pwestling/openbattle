import type { Args, ReadonlyJson } from "../sdk";
import { inputAnswerProblem, inputSpecProblem, type InputSpec } from "./input";
import { jsonProblem } from "./validate";

export interface SetupField {
  id: string;
  label: string;
  hint?: string;
  input: InputSpec | { kind: "json" };
  optional?: boolean;
  initial?: ReadonlyJson;
}

/** A package-defined data intake. Its macro owns interpretation and every lasting effect. */
export interface SetupSpec {
  id: string;
  title: string;
  macro: string;
  fields: SetupField[];
  /** Static arguments; `data`, `form` and host-owned `by` are reserved. */
  args?: Args;
  warning?: string;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9_.:-]{1,64}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);

/** These are data descriptors, not a universal roster schema. */
export function setupSpecProblem(value: unknown): string | null {
  const json = jsonProblem(value);
  if (json) return json;
  if (
    !object(value) ||
    !identifier(value.id) ||
    typeof value.title !== "string" ||
    typeof value.macro !== "string" ||
    !value.macro ||
    !Array.isArray(value.fields)
  )
    return "invalid setup form";
  if (value.warning !== undefined && (typeof value.warning !== "string" || !value.warning.trim()))
    return "setup warning must be nonempty text";
  if (
    value.args !== undefined &&
    (!object(value.args) || ["data", "form", "by"].some((key) => Object.hasOwn(value.args as object, key)))
  )
    return "setup arguments must be an object without reserved data/form/by fields";
  const ids = new Set<string>();
  for (const field of value.fields) {
    if (
      !object(field) ||
      !identifier(field.id) ||
      ids.has(field.id) ||
      typeof field.label !== "string" ||
      (field.hint !== undefined && typeof field.hint !== "string") ||
      (field.optional !== undefined && typeof field.optional !== "boolean")
    )
      return "setup fields need unique safe IDs and labels";
    ids.add(field.id);
    if (!object(field.input)) return `invalid input for ${field.id}`;
    const problem =
      field.input.kind === "json"
        ? Object.keys(field.input).every((key) => key === "kind")
          ? null
          : "unknown JSON input field"
        : inputSpecProblem(field.input);
    if (problem) return `${field.id}: ${problem}`;
    if (Object.hasOwn(field, "initial")) {
      const initialProblem = setupFieldProblem(field as unknown as SetupField, field.initial);
      if (initialProblem) return `${field.id}: invalid initial value (${initialProblem})`;
    }
  }
  return null;
}

function setupFieldProblem(field: SetupField, value: unknown): string | null {
  return field.input.kind === "json" ? jsonProblem(value) : inputAnswerProblem(field.input, value);
}

/** Validate local intake before starting a macro. The host still validates all macro arguments as JSON;
 * the package validates/interprets its own file format inside the macro.
 */
export function setupDataProblem(spec: SetupSpec, data: unknown): string | null {
  const json = jsonProblem(data);
  if (json) return json;
  if (!object(data)) return "setup data must be an object";
  if (Object.keys(data).some((key) => !spec.fields.some((field) => field.id === key)))
    return "unknown setup field";
  for (const field of spec.fields) {
    if (!Object.hasOwn(data, field.id)) {
      if (field.optional) continue;
      return `${field.label}: a value is required`;
    }
    const problem = setupFieldProblem(field, data[field.id]);
    if (problem) return `${field.label}: ${problem}`;
  }
  return null;
}
