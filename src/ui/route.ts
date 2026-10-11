import { useMemo } from "react";
import { create } from "zustand";
import { useStore } from "../store";
import { closeWorkshop, openWorkshop, useWorkshopOpen } from "../workshop/open";
import { closeLibrary, openLibrary, openTts, useLibraryOpen } from "../figures/open";
import { closePlayer, openLadder, openPlayerCard, usePlayerOpen } from "../player/open";
import { closeEvent, openEvent, runAnEvent, useEventOpen } from "../events/open";
import { systemOf } from "../core/content/turn";
import { t } from "../i18n";

/**
 * Where the player is, in the address bar (docs/architecture.md, "Addresses").
 * Screens are hash routes (`#/tables`, `#/workshop`, `#/game`), so any static
 * host serves them with no fallback, offline included. An online room keeps
 * its `?room=` link, which is what an invite is. Opening a screen adds a
 * history entry, closing it goes back to the one before, Back and Forward
 * open and close them, and a reload comes back to the same screen (a hotseat
 * game from its save, a room by rejoining it).
 *
 * The screens' own stores stay the truth; this keeps the address in step with
 * them, and sets them from the address on Back, Forward and load.
 */

/** The front door's own screens: `/`, `/tables`, `/rules/<game>`, `/play/<game>`, `/play/<game>/<who>`. */
const useRoute = create<{ path: string }>(() => ({ path: "/" }));

/** Old query links, read once at load as the screen they open. */
const LEGACY = ["tables", "ended", "rules", "play"];

/** The screen path in a hash: `#/tables` → `/tables`; anything else (`#mail=`, `#key=`) is not ours. */
export function hashPath(hash: string): string | null {
  if (hash === "" || hash === "#") return "/";
  if (!hash.startsWith("#/")) return null;
  const path = decodeURI(hash.slice(1)).replace(/\/+$/, "");
  return path || "/";
}

/** The screen an old query link opens: `?tables=1`, `?rules=<game>`, `?play=<game>`. */
export function legacyPath(search: string): string | null {
  const q = new URLSearchParams(search);
  const tables = q.get("tables");
  if (tables && ["1", "gone", "ended"].includes(tables)) return "/tables";
  const rules = q.get("rules");
  if (rules) return `/rules/${rules}`;
  const play = q.get("play");
  if (play) return `/play/${play}`;
  return null;
}

/** The path's parts: `/play/rift-lanterns/computer` → ["play", "rift-lanterns", "computer"]. */
export const parts = (path: string): string[] => path.split("/").filter(Boolean);

/** The path this page was loaded at, before anything changed the address. */
export const loadedPath: string =
  typeof location === "undefined"
    ? "/"
    : (hashPath(location.hash) ?? "/") !== "/"
      ? hashPath(location.hash)!
      : (legacyPath(location.search) ?? "/");

/** Go to a front door screen, as a new history entry. */
function go(path: string): void {
  useRoute.setState({ path: path || "/" });
}

/** Whether `path` is the front door screen now, and a setter that opens it or goes back to the front door. */
export function useRouteFlag(path: string): [boolean, (on: boolean) => void] {
  const on = useRoute((r) => r.path === path);
  return [on, (to) => (to ? go(path) : useRoute.getState().path === path && go("/"))];
}

/**
 * The front door's flow (UX 513): `/play/<game>/<who>`, the game picked and who against, each opening the next
 * column. `go(null)` goes back to the front door.
 */
export function usePlayRoute(): {
  game: string | null;
  who: string | null;
  go: (game: string | null, who?: string | null) => void;
} {
  const game = useRoute((r) => {
    const [s, g] = parts(r.path);
    return s === "play" && g ? g : null;
  });
  const who = useRoute((r) => {
    const [s, g, w] = parts(r.path);
    return s === "play" && g && w ? w : null;
  });
  return useMemo(
    () => ({
      game,
      who,
      go: (g: string | null, w: string | null = null) => go(g ? (w ? `/play/${g}/${w}` : `/play/${g}`) : "/"),
    }),
    [game, who],
  );
}

/** Whether a game (or a replay) is on screen: the front door's screens are under it. */
const inGame = (): boolean => {
  const s = useStore.getState();
  return s.session !== null || s.role === "spectator";
};

/** The online room on screen, if any: its address is its `?room=` link. */
const inRoom = (): boolean => {
  const s = useStore.getState();
  return inGame() && !!s.roomId && s.mode !== "hotseat";
};

/** The screen path for what's on screen now: the game, the top overlay, or the front door's screen. */
function currentPath(): string {
  const s = useStore.getState();
  if (inGame()) return s.session ? "/game" : "/replay";
  if (useWorkshopOpen.getState().open) return "/workshop";
  const event = useEventOpen.getState();
  if (event.id) return `/event/${event.id}`;
  if (event.running) return "/event/new";
  const player = usePlayerOpen.getState();
  if (player.view === "card") return "/player";
  if (player.view === "ladder") return player.system ? `/ladder/${player.system}` : "/ladder";
  const library = useLibraryOpen.getState();
  if (library.tab)
    return library.tts ? "/figures/tts" : library.tab === "storage" ? "/figures/storage" : "/figures";
  return useRoute.getState().path;
}

/** The address for what's on screen: the page's own query (less the old screen links), then the screen. */
function addressFor(path: string, search = location.search): string {
  const q = new URLSearchParams(search);
  // A room's address is its link and nothing else; out of it, the old screen links have been read.
  if (!inRoom()) for (const k of LEGACY) q.delete(k);
  if (!useWorkshopOpen.getState().open) q.delete("workshop");
  const query = q.size ? `?${q}` : "";
  const hash = inRoom() || path === "/" ? "" : `#${encodeURI(path)}`;
  return `${location.pathname}${query}${hash}`;
}

const here = () => location.pathname + location.search + location.hash;

/** Our history entries carry the address before them, so closing a screen can go back rather than pile up. */
interface Entry {
  ob: true;
  prev: string | null;
}
const entry = (prev: string | null): Entry => ({ ob: true, prev });
const prevOf = (state: unknown): string | null =>
  (state as Entry | null)?.ob ? ((state as Entry).prev ?? null) : null;

/**
 * Into an online room: its `?room=` link as a new history entry, so Back leaves
 * it for the front door. Already in a game (a branch, a rejoin), the address
 * is replaced instead.
 */
export function enterRoom(query: URLSearchParams): void {
  const to = `${location.pathname}?${query}`;
  if (inGame() || new URLSearchParams(location.search).has("room"))
    history.replaceState(history.state, "", to);
  else history.pushState(entry(here()), "", to);
}

/** Set while the address is being applied to the screens, so applying it doesn't write it back. */
let applying = false;
/** Set while our own history.back() is on its way: the screens already show where it lands. */
let backing = false;
let queued = false;
/** The game's address while one is on screen, to put back when the player stays after Back. */
let gameAddress = "";

/** Write the address for what's on screen, if it changed: back to the entry before when that's it, else a new one. */
function write(): void {
  queued = false;
  if (applying || backing) return;
  // A link's own hash (#mail=, #key=) is read and cleared by its screen first.
  if (hashPath(location.hash) === null) return;
  const path = currentPath();
  const to = addressFor(path);
  if (to === here()) {
    if (inGame()) gameAddress = to;
    return;
  }
  if (prevOf(history.state) === to) {
    backing = true;
    history.back();
    return;
  }
  // A game address nothing came back into (a link to someone's hotseat game), the old screen links read at
  // load, and a game's screen address once it's an online room: put right, not piled up.
  const dead = !inGame() && ["/game", "/replay"].includes(hashPath(location.hash) ?? "");
  const legacy = LEGACY.some((k) => new URLSearchParams(location.search).has(k)) && !inRoom();
  if (dead || legacy || (inRoom() && hashPath(location.hash) !== "/"))
    history.replaceState(history.state, "", to);
  else history.pushState(entry(here()), "", to);
  if (inGame()) gameAddress = to;
}

const schedule = () => {
  if (queued) return;
  queued = true;
  queueMicrotask(write);
};

/** Open the screens a path names, and close the others (not at load: a `?workshop=` link has opened its own). */
function show(path: string, close = true): void {
  const [screen, a] = parts(path);
  if (screen === "workshop") openWorkshop();
  else if (close && useWorkshopOpen.getState().open) closeWorkshop();
  if (screen === "event" && a) {
    if (a === "new") runAnEvent();
    else openEvent(a);
  } else if (close && (useEventOpen.getState().id || useEventOpen.getState().running)) closeEvent();
  if (screen === "player") openPlayerCard();
  else if (screen === "ladder") openLadder(a);
  else if (close && usePlayerOpen.getState().view) closePlayer();
  if (screen === "figures") {
    if (a === "tts") openTts();
    else openLibrary(a === "storage" ? "storage" : "figures");
  } else if (close && useLibraryOpen.getState().tab) closeLibrary();
  const front = ["tables", "rules", "play"].includes(screen ?? "") ? path : "/";
  if (useRoute.getState().path !== front) useRoute.setState({ path: front });
}

/** Whether leaving the game on screen needs asking, as "Leave game" does: an online game others can't go on without. */
function leavingNeedsAsking(): boolean {
  const s = useStore.getState();
  if (!inRoom() || s.net?.role === "spectator" || s.review) return false;
  try {
    const rounds = systemOf(s.game).turn.rounds;
    return !(typeof rounds === "number" && s.game.turn.round > rounds);
  } catch {
    return true;
  }
}

/** Back or Forward: show what the address says. */
function onPop(): void {
  const path = hashPath(location.hash);
  // Our own history.back() landing: the screens already show it.
  if (backing) {
    backing = false;
    return;
  }
  if (path === null) return;
  if (inGame()) {
    // Still this game's address (a screen inside it): nothing to do.
    if (here() === gameAddress) return;
    if (leavingNeedsAsking() && !confirm(t("Leave this game? The others can't go on without you."))) {
      // Stay: the game's address goes back on top.
      history.pushState(entry(here()), "", gameAddress || addressFor(currentPath()));
      return;
    }
    // Out of the game the way "Leave game" goes: a fresh front door at this address (a hotseat game is saved).
    location.reload();
    return;
  }
  // Into a room's link, or onto a game: load it as a link is loaded.
  if (new URLSearchParams(location.search).has("room") || path === "/game") {
    location.reload();
    return;
  }
  applying = true;
  try {
    show(path);
  } finally {
    applying = false;
  }
}

let watching = false;

/**
 * Keep the address in step with the screens. Called once by the app, after the
 * front door's first effects: a reloaded game has been resumed by then, so its
 * address stays.
 */
export function watchRoute(): void {
  if (watching) return;
  watching = true;
  if (!inGame()) show(loadedPath, false);
  for (const store of [useStore, useWorkshopOpen, useEventOpen, usePlayerOpen, useLibraryOpen, useRoute])
    (store.subscribe as (f: () => void) => () => void)(schedule);
  addEventListener("popstate", onPop);
  schedule();
}
