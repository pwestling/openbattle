import type { RunSwing } from "../core/stats";

/** What a run came to against its odds: "0 slain where 1.7 were expected". */
export function swingResult(r: RunSwing): string {
  const verb = r.measure !== "damage" && r.expected >= 1.05 ? "were" : "was";
  return `${r.actual} ${r.measure} where ${r.expected.toFixed(1)} ${verb} expected`;
}
