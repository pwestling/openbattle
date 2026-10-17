// The counters and marks on one target (a player, unit, group, model or the game).
import { useState } from "react";
import type { ByTarget, Table, Target } from "../../record/index.ts";
import { useBuildOn, usePlay } from "../play.tsx";

/** What the table keeps for a target, such as its counters. */
export function on<T>(all: ByTarget<T>, target: Target): T | undefined {
  if ("game" in target) return all.game;
  const [kind, id] = Object.entries(target)[0] as [Exclude<keyof ByTarget<T>, "game">, string];
  return Object.hasOwn(all[kind], id) ? all[kind][id] : undefined;
}

export const countersOn = (table: Table, target: Target) => on(table.counters, target) ?? {};
export const marksOn = (table: Table, target: Target) => on(table.marks, target) ?? [];

export function Counters({ target }: { target: Target }) {
  const { table, act, readOnly } = usePlay();
  const counters = Object.entries(countersOn(table, target));
  const marks = marksOn(table, target);
  const [adding, setAdding] = useState("");
  const latest = useBuildOn(countersOn(table, target));
  const set = (name: string, value: number | null) => {
    const next = { ...latest.get() };
    if (value === null) delete next[name];
    else next[name] = value;
    latest.send(next, act({ kind: "counter", targets: [target], name, value }));
  };
  const step = (name: string, by: number) => set(name, (latest.get()[name] ?? 0) + by);
  const mark = (name: string, on: boolean) => void act({ kind: "mark", targets: [target], name, on });

  return (
    <div className="counters">
      {counters.map(([name, value]) => (
        <span key={name} className="counter" aria-label={`${name} counter`}>
          {name}
          <button disabled={readOnly} aria-label={`Lower ${name}`} onClick={() => step(name, -1)}>
            −
          </button>
          <span className="value">{value}</span>
          <button disabled={readOnly} aria-label={`Raise ${name}`} onClick={() => step(name, 1)}>
            +
          </button>
          <button disabled={readOnly} aria-label={`Clear ${name}`} className="quiet" onClick={() => set(name, null)}>
            ×
          </button>
        </span>
      ))}
      {marks.map((name) => (
        <button
          key={name}
          className="mark"
          aria-pressed="true"
          disabled={readOnly}
          title="Turn this mark off"
          onClick={() => mark(name, false)}
        >
          {name}
        </button>
      ))}
      {!readOnly && (
        <details className="add-counter">
          <summary title="Add a counter or mark">＋</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = adding.trim();
              if (!name) return;
              const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              if (submitter?.value === "mark") mark(name, true);
              else set(name, 0);
              setAdding("");
              e.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <input
              aria-label="Counter or mark name"
              placeholder="Wounds, Activated…"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
            />
            <button type="submit" value="counter">
              Add counter
            </button>
            <button type="submit" value="mark">
              Add mark
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
