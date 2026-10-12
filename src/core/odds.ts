import type { Step } from "./content/schema";
import { type DiceSum } from "./content/runtime";
import type { StepPlan, TestPlan } from "./content/runner";
import { evaluate } from "./content/expr";

/**
 * Exact odds for a procedure, from the numbers a preview works out for each
 * step (no simulation): how many dice survive each step on average, how many
 * models die, and the chance the target is wiped out. Per-die rules that add
 * successes or skip steps (sustained hits, lethal hits) aren't counted; the
 * plan's modifiers, re-rolls, always-pass and always-fail faces are.
 */

/** A probability for each value: dist[n] = P(value = n). */
type Dist = number[];

/** Most dice tracked through a procedure; beyond this the tail is folded in. */
const MAX_TOKENS = 400;

function convolve(a: Dist, b: Dist): Dist {
  const out = new Array<number>(Math.min(a.length + b.length - 1, MAX_TOKENS + 1)).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (!a[i]) continue;
    for (let j = 0; j < b.length; j++) {
      const k = Math.min(i + j, MAX_TOKENS);
      out[k]! += a[i]! * b[j]!;
    }
  }
  return out;
}

/** Distribution of a dice sum such as "2D6+1" (negative totals count as 0). */
function sumDist(sum: DiceSum, rerollOnes = false): Dist {
  let offset = 0;
  let d: Dist = [1];
  for (const t of sum) {
    if (!t.sides) {
      offset += t.count;
      continue;
    }
    // A subtracted die -v is (s - v) - s: a 0..s-1 die and an offset.
    const s = t.sides;
    const die =
      t.count > 0
        ? rerollOnes
          ? // A 1 is rolled again once: 1 only on 1 then 1, every other face gains the re-roll's share.
            [0, 1 / (s * s), ...new Array<number>(s - 1).fill(1 / s + 1 / (s * s))]
          : [0, ...new Array<number>(s).fill(1 / s)]
        : new Array<number>(s).fill(1 / s);
    for (let i = 0; i < Math.abs(t.count); i++) {
      d = convolve(d, die);
      if (t.count < 0) offset -= t.sides;
    }
  }
  const out: Dist = [];
  d.forEach((p, n) => {
    const v = Math.max(0, n + offset);
    out[v] = (out[v] ?? 0) + p;
  });
  for (let i = 0; i < out.length; i++) out[i] ??= 0;
  return out;
}

/** The distribution of one die-roll result for a test: a single die, a sum, or the best/worst of several. */
function rollDist(plan: TestPlan): Dist {
  const s = plan.sides;
  if (plan.sumOf > 1) return sumDist([{ count: plan.sumOf, sides: s }]);
  const k = plan.dicePerInput;
  if (k === 1) return [0, ...new Array<number>(s).fill(1 / s)];
  if (k <= 0) return [1];
  const out: Dist = [0];
  for (let v = 1; v <= s; v++) {
    // P(max = v) = (v/s)^k - ((v-1)/s)^k; the lowest mirrors it.
    const hi = (v / s) ** k - ((v - 1) / s) ** k;
    const lo = ((s - v + 1) / s) ** k - ((s - v) / s) ** k;
    out[v] = plan.keep === "lowest" ? lo : hi;
  }
  return out;
}

/**
 * The chance one input passes a test, as the runner judges it: critical and
 * always-pass faces, always-fail faces, the modifier, then one re-roll.
 * `followUp` is the roll needed on a second die when the target is above
 * the die's maximum (The Old World's 7+). Null when the target depends on
 * each input (opposed rolls).
 */
export function passChance(plan: TestPlan, followUp?: number): number | null {
  if (plan.skip) return 1;
  if (plan.target === 0) return null;
  const dist = rollDist(plan);
  const max = plan.sides * plan.sumOf;
  const overflow =
    followUp !== undefined && plan.compare === "atLeast" && plan.target !== null && plan.target > max;
  const need = overflow ? max : plan.target;
  const judge = (natural: number): boolean => {
    if (need === null || natural === 0) return false;
    const critical = plan.criticalOn !== null && natural >= plan.criticalOn;
    if (plan.alwaysFail.includes(natural)) return false;
    if (critical || plan.alwaysPass.includes(natural)) return true;
    const value = natural + plan.modifier;
    return plan.compare === "atLeast" ? value >= need : value <= need;
  };
  let first = 0;
  let again = 0;
  let rerolledPasses = 0;
  dist.forEach((p, v) => {
    const ok = judge(v);
    if (ok) first += p;
    const reroll =
      (plan.reroll === "ones" && v === 1) ||
      ((plan.reroll === "failed" || plan.reroll === "any") && !ok) ||
      !!plan.rerollValues?.includes(v);
    if (reroll) again += p;
    // A re-rolled die passes with the same chance as a fresh one; "ones" or a named face may re-roll a pass.
    if (reroll && ok) rerolledPasses += p;
  });
  const passed = first - rerolledPasses + again * first;
  if (!overflow) return passed;
  // The follow-up die fails on a 1 whatever it needs.
  const faces = Math.max(0, plan.sides - Math.max(2, followUp!) + 1);
  return passed * (faces / plan.sides);
}

/** The follow-up roll a step needs for a target above the die's maximum, if it has one. */
export function followUpNeed(step: Step | undefined, plan: StepPlan | undefined): number | undefined {
  if (!step || step.kind !== "test" || !step.overflow || plan?.kind !== "test" || plan.target === null)
    return undefined;
  try {
    const v = evaluate(step.overflow.followUp, { scope: { test: { target: plan.target } } });
    return typeof v === "number" ? v : undefined;
  } catch {
    return undefined;
  }
}
