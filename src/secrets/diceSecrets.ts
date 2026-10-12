/** This device's secret seeds for shared dice (core/sharedDice.ts), by commitment. */
const KEY = "open-battle:shared-dice:";
const secrets = new Map<string, string>();

/** A secret seed this device committed to (kept for a reload of the same tab). */
export function sharedSecret(commit: string): string | undefined {
  if (secrets.has(commit)) return secrets.get(commit);
  try {
    const kept = sessionStorage.getItem(KEY + commit);
    if (kept) secrets.set(commit, kept);
    return kept ?? undefined;
  } catch {
    return undefined;
  }
}
