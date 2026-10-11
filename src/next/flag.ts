/**
 * Open Battle Next (ui-next): the from-scratch UI, alongside the classic one
 * until it replaces it. `?ui=next` (or `#/next`) turns it on for this browser
 * and `?ui=classic` turns it off; the choice is kept, so links and reloads
 * stay in the same UI.
 */
const KEY = "open-battle:ui";

function read(): boolean {
  if (typeof location === "undefined") return false;
  const asked = new URLSearchParams(location.search).get("ui");
  try {
    if (asked === "next" || location.hash === "#/next") localStorage.setItem(KEY, "next");
    else if (asked === "classic") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "next";
  } catch {
    return asked === "next";
  }
}

/** Whether this page shows the new UI. Read once, at load. */
export const NEXT = read();

/** Switch UI for this browser and reload into it. */
export function switchUi(next: boolean): void {
  try {
    if (next) localStorage.setItem(KEY, "next");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the query below still carries the choice for this load.
  }
  const q = new URLSearchParams(location.search);
  q.set("ui", next ? "next" : "classic");
  location.assign(`${location.pathname}?${q}${location.hash === "#/next" ? "" : location.hash}`);
}
