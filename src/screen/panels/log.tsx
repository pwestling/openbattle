// The log: every action as a sentence, a slider to look back, and undo beside your own latest action.
import { useEffect, useMemo, useRef } from "react";
import { usePlay } from "../play.tsx";
import { namesIn, sentence } from "../words.ts";

export function LogPanel({ lookingAt, lookAt }: { lookingAt: number | null; lookAt: (n: number | null) => void }) {
  const { now, me, act } = usePlay();
  const log = now.log;
  const names = useMemo(() => namesIn(log), [log]);
  const cancelled = new Set(now.table.cancelled);
  // Undo cancels the latest uncancelled action, and only its taker may undo it.
  const latest = log.entries.findLast((e) => e.action.kind !== "undo" && !cancelled.has(e.n));
  const latestOwn = latest?.by === me ? latest.n : undefined;
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [log.entries.length]);
  const at = lookingAt ?? log.entries.length;
  // A shuffled draw whose seal doesn't match is shown as a tampered roll is.
  const tampered = new Set(now.table.draws.filter((d) => d.tampered).map((d) => d.at));
  // Rolls and draws the host made with nobody else connected are not tamper-evident (ADR-023).
  const alone = new Set([...now.table.rolls, ...now.table.draws].filter((r) => r.alone).map((r) => r.at));

  return (
    <section className="log" aria-label="Log">
      <h3>Log</h3>
      <ol>
        {log.entries.map((e) => (
          <li
            key={e.n}
            className={[
              cancelled.has(e.n) ? "cancelled" : "",
              e.n > at ? "later" : "",
              tampered.has(e.n) ? "tampered" : "",
              alone.has(e.n) ? "alone" : "",
            ].join(" ")}
            ref={e.n === log.entries.length ? end : undefined}
          >
            <span>{sentence(e, log, now.table, names, me)}</span>
            {tampered.has(e.n) && <strong role="alert">This draw was tampered with: its seal doesn't match.</strong>}
            {e.n === latestOwn && lookingAt === null && now.connection === "playing" && (
              <button onClick={() => void act({ kind: "undo" })}>Undo</button>
            )}
          </li>
        ))}
      </ol>
      <label className="look-back">
        Look back
        <input
          type="range"
          min={0}
          max={log.entries.length}
          value={at}
          onChange={(e) => {
            const n = Number(e.target.value);
            lookAt(n === log.entries.length ? null : n);
          }}
        />
      </label>
      {lookingAt !== null && (
        <p className="looking">
          Showing the table after action {lookingAt} of {log.entries.length}. <button onClick={() => lookAt(null)}>Back to now</button>
        </p>
      )}
    </section>
  );
}
