import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { LoggedEvent } from "./core/log";
import { setupDataProblem, setupSpecProblem, type SetupField, type SetupSpec } from "./core/setup";
import type { Json } from "./core/types";
import { jsonProblem } from "./core/validate";
import {
  createInputDraft,
  InputEditor,
  inputDraftAnswer,
  inputDraftProblem,
  type InputDraft,
} from "./InputEditor";

type FieldDraft = {
  included: boolean;
  editor: InputDraft | null;
  text: string;
  fileStatus: string;
  fileError: string | null;
  reading: boolean;
};

function createFieldDraft(field: SetupField): FieldDraft {
  const initial = Object.hasOwn(field, "initial");
  return {
    included: !field.optional || initial,
    editor: field.input.kind === "json" ? null : createInputDraft(field.input, field.initial),
    text: initial && field.input.kind === "json" ? JSON.stringify(field.initial, null, 2) : "",
    fileStatus: initial && field.input.kind === "json" ? "Package default" : "No file selected",
    fileError: null,
    reading: false,
  };
}

function parseJson(text: string): { value: Json; problem: null } | { problem: string } {
  if (!text.trim()) return { problem: "Paste JSON or choose a .json file." };
  try {
    const value: unknown = JSON.parse(text);
    const problem = jsonProblem(value);
    return problem ? { problem } : { value: value as Json, problem: null };
  } catch (error) {
    return { problem: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function fieldValue(
  field: SetupField,
  draft: FieldDraft,
): { value: Json; problem: null } | { problem: string } {
  if (field.input.kind === "json") {
    if (draft.reading) return { problem: "Wait for the selected file to finish reading, or edit the JSON." };
    if (draft.fileError) return { problem: draft.fileError };
    return parseJson(draft.text);
  }
  const problem = inputDraftProblem(field.input, draft.editor!);
  return problem ? { problem } : { value: inputDraftAnswer(field.input, draft.editor!), problem: null };
}

/** Every edit/file selection invalidates previous reads; unmount invalidates reads from old actors/forms. */
function JsonEditor({
  field,
  draft,
  onChange,
  errorId,
}: {
  field: SetupField;
  draft: FieldDraft;
  onChange: (update: Partial<FieldDraft>) => void;
  errorId: string;
}) {
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  const problem = fieldValue(field, draft).problem;
  const load = async (file: File) => {
    const request = ++revision.current;
    if (!/\.json$/i.test(file.name)) {
      onChange({
        reading: false,
        fileStatus: `Rejected ${file.name}`,
        fileError: "Choose a file with a .json extension.",
      });
      return;
    }
    onChange({ reading: true, fileError: null, fileStatus: `Reading ${file.name}…` });
    try {
      const text = await file.text();
      if (revision.current !== request) return;
      onChange({ text, reading: false, fileError: null, fileStatus: `Loaded ${file.name}` });
    } catch (error) {
      if (revision.current !== request) return;
      onChange({
        reading: false,
        fileStatus: `Could not read ${file.name}`,
        fileError: `Could not read JSON file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };
  return (
    <div className="setup-json">
      <label className="macro-input-field">
        <span>Paste JSON</span>
        <textarea
          data-testid="setup-json-paste"
          value={draft.text}
          spellCheck={false}
          onChange={(event) => {
            revision.current++;
            onChange({
              text: event.target.value,
              reading: false,
              fileError: null,
              fileStatus: "JSON edited locally",
            });
          }}
          aria-invalid={!!problem}
          aria-describedby={problem ? errorId : undefined}
        />
      </label>
      <label className="macro-input-field">
        <span>Upload .json file</span>
        <input
          type="file"
          accept=".json,application/json"
          data-testid="setup-json-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void load(file);
          }}
        />
      </label>
      <p className="muted" role="status" data-testid="setup-json-status">
        {draft.fileStatus}
      </p>
      {problem && (
        <p id={errorId} className="bad" role="alert" data-testid="setup-field-error">
          {problem}
        </p>
      )}
    </div>
  );
}

function SetupForm({
  spec,
  disabled,
  onSubmit,
  importError,
}: {
  spec: SetupSpec;
  disabled: boolean;
  onSubmit: (spec: SetupSpec, data: Record<string, Json>) => void;
  importError?: string;
}) {
  const id = useId();
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(spec.fields.map((field) => [field.id, createFieldDraft(field)])),
  );
  const [attempted, setAttempted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const update = (field: string, change: Partial<FieldDraft>) => {
    setDrafts((current) => ({ ...current, [field]: { ...current[field]!, ...change } }));
    setProblem(null);
  };
  return (
    <form
      className="setup-form macro-input"
      data-testid="setup-form"
      data-setup-form={spec.id}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        setAttempted(true);
        const data: Record<string, Json> = {};
        for (const field of spec.fields) {
          const draft = drafts[field.id]!;
          if (field.optional && !draft.included) continue;
          const result = fieldValue(field, draft);
          if (result.problem !== null) {
            setProblem(`${field.label}: ${result.problem}`);
            return;
          }
          data[field.id] = result.value;
        }
        const error = setupDataProblem(spec, data);
        setProblem(error);
        if (!error) onSubmit(spec, data);
      }}
    >
      <fieldset className="setup-form-controls" disabled={disabled}>
        <legend>{spec.title}</legend>
        <p className="muted">Values stay on this device until Submit. The package decides how to use them.</p>
        {spec.warning && (
          <p className="advisory-warning" data-testid="setup-warning">
            {spec.warning}
          </p>
        )}
        {spec.fields.map((field) => {
          const draft = drafts[field.id]!;
          const errorId = `${id}-${field.id}-error`;
          const fieldProblem = attempted && draft.included ? fieldValue(field, draft).problem : null;
          return (
            <fieldset key={field.id} className="setup-field" data-setup-field={field.id}>
              <legend>{field.label}</legend>
              {field.hint && <p className="muted">{field.hint}</p>}
              {field.optional && (
                <label className="setup-include">
                  <input
                    type="checkbox"
                    data-testid="setup-include"
                    checked={draft.included}
                    onChange={(event) => update(field.id, { included: event.target.checked })}
                  />
                  Include {field.label} (optional)
                </label>
              )}
              {!draft.included ? (
                <p className="muted">Omitted from submitted data.</p>
              ) : field.input.kind === "json" ? (
                <JsonEditor
                  field={field}
                  draft={draft}
                  onChange={(change) => update(field.id, change)}
                  errorId={errorId}
                />
              ) : (
                <>
                  <InputEditor
                    input={field.input}
                    draft={draft.editor!}
                    onChange={(editor) => update(field.id, { editor })}
                    problem={fieldProblem}
                    errorId={errorId}
                  />
                  {fieldProblem && (
                    <p id={errorId} className="bad" role="alert" data-testid="setup-field-error">
                      {fieldProblem}
                    </p>
                  )}
                </>
              )}
            </fieldset>
          );
        })}
        <button type="submit" data-testid="setup-submit">
          Submit {spec.title}
        </button>
      </fieldset>
      {problem && (
        <p className="bad" role="alert" data-testid="setup-submit-error">
          {problem}
        </p>
      )}
      {importError && (
        <p className="bad" role="alert" data-testid="setup-import-error">
          Last import failed: {importError}
        </p>
      )}
    </form>
  );
}

export function SetupForms({
  forms,
  error,
  actor,
  session,
  system,
  disabled,
  events,
  onSubmit,
}: {
  forms: readonly SetupSpec[];
  error?: string;
  actor: string | null;
  session: object | null;
  system?: string;
  disabled: boolean;
  events: readonly LoggedEvent[];
  onSubmit: (spec: SetupSpec, data: Record<string, Json>) => void;
}) {
  const [scope, setScope] = useState({ actor, session, system, version: 0 });
  const changed = scope.actor !== actor || scope.session !== session || scope.system !== system;
  const version = changed ? scope.version + 1 : scope.version;
  if (changed) setScope({ actor, session, system, version });
  const outcomes = useMemo(() => {
    const latest = new Map<string, { run: number; macro: string; error?: string }>();
    const runs = new Map<number, string>();
    for (const logged of events) {
      const step = logged.event;
      if (step.type !== "macro/step" || step.by !== actor) continue;
      if (step.started && typeof step.args?.form === "string") {
        runs.set(step.run, step.args.form);
        latest.set(step.args.form, { run: step.run, macro: step.macro });
      }
      const form = runs.get(step.run);
      const attempt = form === undefined ? undefined : latest.get(form);
      if (attempt?.run === step.run && attempt.macro === step.macro && step.error) attempt.error = step.error;
    }
    return latest;
  }, [events, actor]);
  return (
    <section data-testid="setup-forms">
      <h2>Package setup for {actor ?? "nobody"}</h2>
      {error && (
        <p className="bad" role="alert" data-testid="setup-error">
          Package setup error: {error}
        </p>
      )}
      {!error && forms.length === 0 && <p className="muted">No setup forms offered.</p>}
      {forms.map((spec) => {
        const problem = setupSpecProblem(spec);
        if (problem)
          return (
            <p key={spec.id} className="bad" role="alert" data-testid="setup-error">
              {spec.title}: {problem}
            </p>
          );
        const outcome = outcomes.get(spec.id);
        return (
          <SetupForm
            key={`${version}:${JSON.stringify(spec)}`}
            spec={spec}
            disabled={disabled}
            onSubmit={onSubmit}
            importError={outcome?.macro === spec.macro ? outcome.error : undefined}
          />
        );
      })}
    </section>
  );
}
