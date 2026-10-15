// The dice tray: how many dice, how many sides, an optional label, and Roll. Dice are thrown
// onto the tray and land on the decided result, for everyone at once, then line up sorted.
// Recent rolls stay listed; a tampered roll is shown in red with a warning, and a roll the host made
// with nobody else connected is marked "rolled alone" (ADR-023).
import { useEffect, useRef, useState } from "react";
import type { Roll } from "../../record/index.ts";
import { playerName, usePlay } from "../play.tsx";
import { DiceTray } from "../table/dice.ts";

export function DicePanel() {
  const { table, now, me, readOnly, session, note } = usePlay();
  const [dice, setDice] = useState(2);
  const [sides, setSides] = useState(6);
  const [label, setLabel] = useState("");
  const [rolling, setRolling] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tray = useRef<DiceTray | null>(null);
  // The roll the tray last threw, and whether its dice have landed yet.
  const [shown, setShown] = useState<{ at: number; landed: boolean } | null>(null);
  const rolls = now.table.rolls;
  // Rolls already made when the table opened are shown landed, not thrown again.
  const before = useRef(rolls.at(-1)?.at ?? 0);

  useEffect(() => {
    tray.current = new DiceTray(canvas.current!);
    const fit = new ResizeObserver(() => tray.current?.fit());
    fit.observe(canvas.current!);
    return () => {
      fit.disconnect();
      tray.current?.dispose();
    };
  }, []);

  const latest = rolls.at(-1);
  useEffect(() => {
    if (!latest || latest.at === shown?.at) return;
    // Rolls made before the table opened, or uncovered by an undo, are shown landed.
    if (latest.at <= before.current || latest.at < (shown?.at ?? 0)) {
      setShown({ at: latest.at, landed: true });
      return;
    }
    setShown({ at: latest.at, landed: false });
    const colour = table.players[latest.by]?.colour ?? "#dddddd";
    tray.current?.throw(latest.result, latest.sides, colour, () => setShown({ at: latest.at, landed: true }));
  }, [latest?.at]);

  const roll = async () => {
    setRolling(true);
    try {
      await session.roll(dice, sides, label.trim() || undefined);
    } catch (e) {
      note(e instanceof Error ? e.message : "The dice could not be rolled.");
    } finally {
      setRolling(false);
    }
  };

  const recent = rolls
    .filter((r) => r.at !== shown?.at || shown.landed)
    .slice(-6)
    .reverse();
  return (
    <section className="dice" aria-label="Dice tray">
      <canvas ref={canvas} className="tray" aria-hidden="true" />
      {me && !readOnly && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void roll();
          }}
        >
          <label>
            Dice
            <input type="number" min={1} max={1024} value={dice} onChange={(e) => setDice(Number(e.target.value))} />
          </label>
          <label>
            Sides
            <input type="number" min={2} value={sides} onChange={(e) => setSides(Number(e.target.value))} />
          </label>
          <label>
            Label
            <input value={label} placeholder="optional" onChange={(e) => setLabel(e.target.value)} />
          </label>
          <button type="submit" disabled={rolling}>
            Roll
          </button>
        </form>
      )}
      <ol className="rolls" aria-label="Recent rolls">
        {recent.map((r: Roll) => (
          <li key={r.at} className={[r.tampered ? "tampered" : "", r.alone ? "alone" : ""].join(" ")}>
            <span className="who">
              {playerName(table, r.by)} · {r.dice}d{r.sides}
              {r.label ? ` · ${r.label}` : ""}
            </span>
            <span className="result">{[...r.result].sort((a, b) => a - b).join(" ")}</span>
            {r.tampered && <strong role="alert">This roll was tampered with: its seal doesn't match.</strong>}
            {r.alone && (
              <span className="alone-mark" title="Nobody else was connected to send the other value, so this roll is not tamper-evident.">
                Rolled alone
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
