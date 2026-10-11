import { expect, it } from "vitest";
import "../systems";
import { stateAt } from "../core";
import { currentSlot } from "../core/content/turn";
import { playMatch } from "./match";
import { botPolicy } from "./player";
import { freeMoves, type BotContext } from "../soak/bot";
import { seededRng } from "../sandbox/protocol";

it("both bots act in 40k's simultaneous Command phase, then both say ready (#81)", async () => {
  const r = await playMatch({ system: "forty-k-11", seed: 2, maxSteps: 700 }, (start) => [
    botPolicy("steady", start, 0, { seed: 1 }),
    botPolicy("random", start, 1, { seed: 2 }),
  ]);
  expect(r.error).toBeUndefined();
  const record = r.record!;
  expect(r.rounds).toBeGreaterThanOrEqual(2);
  // Every Command phase the bots left, they left by both saying they were done.
  const ready = record.events.filter((e) => e.event.type === "turn/ready");
  expect(new Set(ready.map((e) => e.by))).toEqual(new Set(["p0", "p1"]));
  let commands = 0;
  for (const e of record.events) {
    const before = stateAt(record, e.seq - 1);
    if (before.turn.round === 0 || currentSlot(before)?.id !== "command") continue;
    const after = stateAt(record, e.seq);
    if (after.turn.phase === before.turn.phase && after.turn.round === before.turn.round) continue;
    commands++;
    expect(e.event.type).toBe("turn/ready");
    expect(before.turn.ready).toHaveLength(1);
  }
  expect(commands).toBeGreaterThanOrEqual(3);
}, 300000);

it("a tidy bot that is done in a simultaneous phase never passes its turn away (#81)", async () => {
  const r = await playMatch({ system: "forty-k-11", seed: 2, maxSteps: 400 }, (start) => [
    botPolicy("steady", start, 0, { seed: 1 }),
    botPolicy("random", start, 1, { seed: 2 }),
  ]);
  const record = r.record!;
  // A moment in a Command phase where the side whose turn it is has said it is done.
  const at = record.events.find((e) => {
    const s = stateAt(record, e.seq);
    const active = Object.values(s.players).find((p) => p.seat === s.turn.activeSeat);
    return (
      currentSlot(s)?.id === "command" &&
      !!active &&
      !!s.turn.ready?.includes(active.id) &&
      s.turn.ready.length === 1
    );
  });
  expect(at).toBeDefined();
  const state = stateAt(record, at!.seq);
  for (let seed = 1; seed <= 40; seed++) {
    const ctx: BotContext = { rng: seededRng(seed), kept: new Map(), idle: 99, tidy: true };
    for (const m of freeMoves(state, ctx)) expect(m.intent.type).not.toBe("turn/pass");
  }
}, 300000);
