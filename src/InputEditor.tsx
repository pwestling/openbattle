import type { InputSpec } from "./core/input";
import { inputAnswerProblem } from "./core/input";
import type { Json } from "./core/types";
import type { DeepReadonly, ReadonlyJson } from "./sdk";

type PointDraft = { key: number; x: string; y: string };
export interface InputDraft {
  value: string;
  selected: number[];
  points: PointDraft[];
  facing: string;
  nextPoint: number;
}

const numericValue = (value: string): number | null => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Only validated defaults become editable values; partial numeric drafts stay strings. */
export function createInputDraft(input: DeepReadonly<InputSpec>, initial?: ReadonlyJson): InputDraft {
  const draft: InputDraft = {
    value: "",
    selected: [],
    points: Array.from({ length: input.kind === "path" ? (input.minPoints ?? 2) : 1 }, (_, key) => ({
      key,
      x: "",
      y: "",
    })),
    facing: "",
    nextPoint: input.kind === "path" ? (input.minPoints ?? 2) : 1,
  };
  if (initial === undefined || inputAnswerProblem(input as InputSpec, initial)) return draft;
  switch (input.kind) {
    case "choice":
      draft.selected = [input.options.findIndex((option) => option.id === initial)];
      break;
    case "multiChoice":
      draft.selected = (initial as readonly string[]).map((value) =>
        input.options.findIndex((option) => option.id === value),
      );
      break;
    case "reference": {
      const values = (input.multiple ? initial : [initial]) as readonly { kind: string; id: string }[];
      draft.selected = values.map((value) =>
        input.options.findIndex((option) => option.ref.kind === value.kind && option.ref.id === value.id),
      );
      break;
    }
    case "number":
    case "text":
      draft.value = String(initial);
      break;
    case "point":
    case "pose":
    case "path": {
      const pose = initial as { position: { x: number; y: number }; facing: number };
      const values = (
        input.kind === "path" ? initial : [input.kind === "pose" ? pose.position : initial]
      ) as readonly { x: number; y: number }[];
      draft.points = values.map((point, key) => ({ key, x: String(point.x), y: String(point.y) }));
      draft.nextPoint = draft.points.length;
      if (input.kind === "pose") draft.facing = String(pose.facing);
      break;
    }
  }
  return draft;
}

export function inputDraftAnswer(input: DeepReadonly<InputSpec>, draft: InputDraft): Json {
  switch (input.kind) {
    case "choice":
      return input.options[draft.selected[0] ?? -1]?.id ?? null;
    case "multiChoice":
      return draft.selected.map((index) => input.options[index]!.id);
    case "reference":
      return input.multiple
        ? draft.selected.map((index) => ({ ...input.options[index]!.ref }))
        : draft.selected.length
          ? { ...input.options[draft.selected[0]!]!.ref }
          : null;
    case "number":
      return numericValue(draft.value);
    case "text":
      return draft.value;
    case "point":
      return { x: numericValue(draft.points[0]!.x), y: numericValue(draft.points[0]!.y) };
    case "pose":
      return {
        position: { x: numericValue(draft.points[0]!.x), y: numericValue(draft.points[0]!.y) },
        facing: numericValue(draft.facing),
      };
    case "path":
      return draft.points.map((point) => ({ x: numericValue(point.x), y: numericValue(point.y) }));
  }
}

export function inputDraftProblem(input: DeepReadonly<InputSpec>, draft: InputDraft): string | null {
  const answer = inputDraftAnswer(input, draft);
  const error = inputAnswerProblem(input as InputSpec, answer);
  return error && input.kind === "number" && answer === null
    ? "Enter a finite number; the field cannot be blank."
    : error;
}

function moved<T>(values: T[], index: number, direction: number): T[] {
  const next = [...values];
  const destination = index + direction;
  if (destination < 0 || destination >= next.length) return values;
  [next[index], next[destination]] = [next[destination]!, next[index]!];
  return next;
}

/** Controlled widgets: ordinary choices may answer immediately; setup fields only edit drafts. */
export function InputEditor({
  input,
  draft,
  onChange,
  problem,
  errorId,
  onImmediateAnswer,
}: {
  input: DeepReadonly<InputSpec>;
  draft: InputDraft;
  onChange: (draft: InputDraft) => void;
  problem?: string | null;
  errorId?: string;
  onImmediateAnswer?: (answer: Json) => void;
}) {
  const { value, selected, points, facing } = draft;
  const change = (update: Partial<InputDraft>) => onChange({ ...draft, ...update });
  const errorAttributes = { "aria-invalid": !!problem, "aria-describedby": problem ? errorId : undefined };
  return (
    <div className="input-editor">
      {input.kind === "choice" || (input.kind === "reference" && !input.multiple) ? (
        <div className="row" role="group" aria-label="Answer options">
          {input.options.map((option, index) => (
            <button
              type="button"
              key={index}
              aria-pressed={selected.includes(index)}
              onClick={() => {
                if (onImmediateAnswer) onImmediateAnswer("ref" in option ? { ...option.ref } : option.id);
                else change({ selected: [index] });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : input.kind === "multiChoice" || (input.kind === "reference" && input.multiple) ? (
        <fieldset className="macro-input-selection">
          <legend>Choose answers</legend>
          <p className="muted">
            Select {input.min ?? 0}–{input.max ?? input.options.length} answers.
            {input.ordered ? " Set their order below." : " Answers retain selection order."}
          </p>
          <div className="macro-input-options">
            {input.options.map((option, index) => (
              <label key={index}>
                <input
                  type="checkbox"
                  checked={selected.includes(index)}
                  onChange={() =>
                    change({
                      selected: selected.includes(index)
                        ? selected.filter((item) => item !== index)
                        : [...selected, index],
                    })
                  }
                  {...errorAttributes}
                />
                <span>{option.label}</span>
                {"ref" in option && (
                  <span className="muted">
                    ({option.ref.kind}: {option.ref.id})
                  </span>
                )}
              </label>
            ))}
          </div>
          {input.ordered && selected.length > 0 && (
            <ol className="macro-input-order" aria-label="Chosen answer order">
              {selected.map((optionIndex, position) => {
                const option = input.options[optionIndex]!;
                return (
                  <li key={optionIndex}>
                    <div className="row">
                      <span>{option.label}</span>
                      <button
                        type="button"
                        aria-label={`Move ${option.label} up`}
                        disabled={position === 0}
                        onClick={() => change({ selected: moved(selected, position, -1) })}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${option.label} down`}
                        disabled={position === selected.length - 1}
                        onClick={() => change({ selected: moved(selected, position, 1) })}
                      >
                        Down
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </fieldset>
      ) : input.kind === "number" ? (
        <label className="macro-input-field">
          <span>Number{input.integer ? " (integer)" : ""}</span>
          <input
            type="text"
            inputMode={input.integer ? "numeric" : "decimal"}
            value={value}
            onChange={(event) => change({ value: event.target.value })}
            {...errorAttributes}
          />
          {(input.min !== undefined || input.max !== undefined) && (
            <span className="muted">
              {input.min !== undefined ? `Minimum: ${input.min}. ` : ""}
              {input.max !== undefined ? `Maximum: ${input.max}.` : ""}
            </span>
          )}
        </label>
      ) : input.kind === "text" ? (
        <label className="macro-input-field">
          <span>Text answer</span>
          {input.multiline ? (
            <textarea
              value={value}
              onChange={(event) => change({ value: event.target.value })}
              {...errorAttributes}
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(event) => change({ value: event.target.value })}
              {...errorAttributes}
            />
          )}
          {(input.minLength !== undefined || input.maxLength !== undefined) && (
            <span className="muted">
              {input.minLength !== undefined ? `Minimum length: ${input.minLength}. ` : ""}
              {input.maxLength !== undefined ? `Maximum length: ${input.maxLength}. ` : ""}Current length:{" "}
              {value.length}.
            </span>
          )}
        </label>
      ) : (
        <fieldset className="macro-input-spatial">
          <legend>{input.kind === "path" ? "Path points" : input.kind === "pose" ? "Pose" : "Point"}</legend>
          <p className="muted">
            Coordinates are in inches{input.kind === "pose" ? "; facing is in radians" : ""}.
            {input.kind === "path" &&
              ` Use ${input.minPoints ?? 2}${input.maxPoints === undefined ? " or more" : `–${input.maxPoints}`} points.`}
          </p>
          {points.map((point, index) => (
            <div className="macro-input-point row" key={point.key}>
              {input.kind === "path" && <span>Point {index + 1}</span>}
              {(["x", "y"] as const).map((axis) => (
                <label className="macro-input-field" key={axis}>
                  <span>{axis.toUpperCase()} (inches)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={
                      input.kind === "path"
                        ? `Point ${index + 1} ${axis.toUpperCase()} (inches)`
                        : `${axis.toUpperCase()} (inches)`
                    }
                    value={point[axis]}
                    onChange={(event) =>
                      change({
                        points: points.map((item) =>
                          item.key === point.key ? { ...item, [axis]: event.target.value } : item,
                        ),
                      })
                    }
                    {...errorAttributes}
                  />
                </label>
              ))}
              {input.kind === "path" && (
                <>
                  <button
                    type="button"
                    aria-label={`Move point ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => change({ points: moved(points, index, -1) })}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move point ${index + 1} down`}
                    disabled={index === points.length - 1}
                    onClick={() => change({ points: moved(points, index, 1) })}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove point ${index + 1}`}
                    onClick={() => change({ points: points.filter((item) => item.key !== point.key) })}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          ))}
          {input.kind === "pose" && (
            <label className="macro-input-field">
              <span>Facing (radians)</span>
              <input
                type="text"
                inputMode="decimal"
                value={facing}
                onChange={(event) => change({ facing: event.target.value })}
                {...errorAttributes}
              />
            </label>
          )}
          {input.kind === "path" && (
            <button
              type="button"
              disabled={input.maxPoints !== undefined && points.length >= input.maxPoints}
              onClick={() =>
                change({
                  points: [...points, { key: draft.nextPoint, x: "", y: "" }],
                  nextPoint: draft.nextPoint + 1,
                })
              }
            >
              Add point
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}
