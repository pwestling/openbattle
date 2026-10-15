// The phase bar: round, whose turn and the phase name, each changeable by a player.
import { useEffect, useRef, useState } from "react";
import type { Phase } from "../../record/index.ts";
import { usePlay } from "../play.tsx";

export function PhaseBar() {
  const { table, act, readOnly } = usePlay();
  const phase = table.phase;
  const [name, setName] = useState(phase.name);
  useEffect(() => setName(phase.name), [phase.name]);
  // Changes made before the last one has come back build on it, rather than on the phase shown.
  const latest = useRef(phase);
  useEffect(() => {
    latest.current = phase;
  }, [phase]);
  const set = (change: Partial<Phase>) => {
    latest.current = { ...latest.current, ...change };
    void act({ kind: "phase", phase: latest.current });
  };

  return (
    <div className="phase" role="group" aria-label="Phase">
      <span>Round</span>
      <button disabled={readOnly || phase.round <= 1} aria-label="Previous round" onClick={() => set({ round: phase.round - 1 })}>
        −
      </button>
      <span className="value" aria-label="Round">
        {phase.round}
      </span>
      <button disabled={readOnly} aria-label="Next round" onClick={() => set({ round: phase.round + 1 })}>
        +
      </button>
      <label>
        Turn
        <select disabled={readOnly} value={phase.turn ?? ""} onChange={(e) => set({ turn: e.target.value || null })}>
          <option value="">—</option>
          {Object.values(table.players).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name !== phase.name) set({ name });
        }}
      >
        <input
          aria-label="Phase name"
          placeholder="Phase"
          disabled={readOnly}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== phase.name && set({ name })}
        />
      </form>
    </div>
  );
}
