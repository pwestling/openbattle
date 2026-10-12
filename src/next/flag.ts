/**
 * Open Battle Next (ui-next): the from-scratch UI, the default since
 * 2026-10-11 (Porter). `?ui=classic` goes back to the classic UI for this
 * browser and `?ui=next` (or `#/next`) returns; the choice is kept, so links
 * and reloads stay in the same UI. Browsers driven by automation (the smoke
 * and perf scripts) keep the classic UI unless they ask for next.
 */
const KEY = "open-battle:ui";

function read(): boolean {
  if (typeof location === "undefined") return false;
  const asked = new URLSearchParams(location.search).get("ui");
  const automated = typeof navigator !== "undefined" && navigator.webdriver;
  try {
    if (asked === "next" || location.hash === "#/next") localStorage.setItem(KEY, "next");
    else if (asked === "classic") localStorage.setItem(KEY, "classic");
    const kept = localStorage.getItem(KEY);
    return kept ? kept === "next" : !automated;
  } catch {
    return asked ? asked === "next" : !automated;
  }
}

/** Whether this page shows the new UI. Read once, at load. */
export const NEXT = read();

/** Switch UI for this browser and reload into it. */
export function switchUi(next: boolean): void {
  try {
    localStorage.setItem(KEY, next ? "next" : "classic");
  } catch {
    // Storage blocked: the query below still carries the choice for this load.
  }
  const q = new URLSearchParams(location.search);
  q.set("ui", next ? "next" : "classic");
  location.assign(`${location.pathname}?${q}${location.hash === "#/next" ? "" : location.hash}`);
}
