import { useId, useState } from "react";
import { inputAnswerProblem, type InputSpec } from "./core/input";
import type { Json } from "./core/types";
import { createInputDraft, InputEditor, inputDraftAnswer, inputDraftProblem } from "./InputEditor";
import type { DeepReadonly } from "./sdk";

/** A draft only: packages decide how a recorded answer affects the table. */
export function MacroInput({
  input,
  onAnswer,
}: {
  input: DeepReadonly<InputSpec>;
  onAnswer: (answer: Json) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => createInputDraft(input));
  const [problem, setProblem] = useState<string | null>(null);
  const single = input.kind === "choice" || (input.kind === "reference" && !input.multiple);
  const submit = (answer: Json) => {
    const error = inputAnswerProblem(input as InputSpec, answer);
    setProblem(error);
    if (!error) onAnswer(answer);
  };
  return (
    <form
      className="macro-input"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const error = inputDraftProblem(input, draft);
        setProblem(error);
        if (!error) onAnswer(inputDraftAnswer(input, draft));
      }}
    >
      <InputEditor
        input={input}
        draft={draft}
        onChange={setDraft}
        problem={problem}
        errorId={`${id}-error`}
        onImmediateAnswer={submit}
      />
      {problem && (
        <p id={`${id}-error`} className="bad" role="alert">
          {problem}
        </p>
      )}
      {!single && <button type="submit">Submit answer</button>}
    </form>
  );
}
