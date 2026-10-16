// The log: every action as a sentence, a slider to look back, and undo beside your own latest action.
import { useEffect, useMemo, useRef } from "react";
import type { Snapshot } from "../../session/index.ts";
import { usePlay } from "../play.tsx";
import { namesIn, sentence } from "../words.ts";

/** The number of the latest action if `me` may undo it now, else undefined. */
export function undoableBy(now: Snapshot, me: string | null): number | undefined {
  const cancelled = new Set(now.table.cancelled);
  // Undo cancels the latest uncancelled action, and only its taker may undo it.
  const latest = now.log.entries.findLast((e) => e.action.kind !== "undo" && !cancelled.has(e.n));
  // The record never undoes a roll or a shuffled draw; a join it would, but leaving is not an undo.
  const undoable =
    latest &&
    latest.action.kind !== "join" &&
    latest.action.kind !== "roll" &&
    !(latest.action.kind === "draw" && "seal" in latest.action);
  return undoable && latest.by === me ? latest.n : undefined;
}

export function LogPanel({ lookingAt, lookAt }: { lookingAt: number | null; lookAt: (n: number | null) => void }) {
  const { now, me, act } = usePlay();
  const log = now.log;
  const names = useMemo(() => namesIn(log), [log]);
  const cancelled = new Set(now.table.cancelled);
  const latestOwn = undoableBy(now, me);
  const end = useRef<HTMLLIElement>(null);
  // Braced: scrollIntoView returns a promise in newer browsers, and an effect may only return a clean-up.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [log.entries.length]);
  const at = lookingAt ?? log.entries.length;
  // A roll or shuffled draw whose seal doesn't match is shown in red with a warning.
  const tampered = new Set([...now.table.rolls, ...now.table.draws].filter((r) => r.tampered).map((r) => r.at));
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
            {tampered.has(e.n) && (
              <strong role="alert">This {e.action.kind === "roll" ? "roll" : "draw"} was tampered with: its seal doesn't match.</strong>
            )}
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
