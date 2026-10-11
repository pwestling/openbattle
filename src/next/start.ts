import { armSolo } from "../bot/solo";
import { BROADCAST } from "../broadcast/broadcast";
import { EXHIBITION, startExhibition } from "../broadcast/exhibition";
import { installOwnGame, ownGame, playOwnAtTable, playOwnGame } from "../games/riftLanterns";
import { NET_PARAMS } from "../net/config";
import { useLibrary } from "../packages/library";
import { useCard } from "../player/card";
import { loadRoom, useStore, type SavedGame } from "../store";
import { presetMission, startDemo } from "../ui/demo";
import { refOf } from "../ui/Packages";
import { reloadedInto } from "../ui/resumeHotseat";
import { enterRoom } from "../ui/route";
import { FRONT } from "../ui/systemLabels";
import { APP_BUILD } from "../version";

/**
 * Starting games from the new front door: the same sessions the classic
 * lobby starts (src/ui/Lobby.tsx), so a game started here plays the same and
 * either UI can resume it.
 */

export const NAME_KEY = "open-battle:name";
export const SYSTEM_KEY = "open-battle:system";
export const WHO_KEY = "open-battle:who";

export type Who = "friend" | "computer" | "both" | "table";
export const WHOS: Who[] = ["friend", "computer", "both", "table"];

/** The name this browser plays under: what was typed last, else the player card's. */
export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || useCard.getState().name.trim();
  } catch {
    return useCard.getState().name.trim();
  }
}

function remember(name: string, system?: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
    if (system) localStorage.setItem(SYSTEM_KEY, system);
  } catch {
    // Not kept: asked again next time.
  }
}

/** The room's address: its invite link, carrying the relay settings and this UI so a guest lands in it too. */
function linkTo(roomId: string): void {
  const here = new URLSearchParams(location.search);
  const q = new URLSearchParams({ room: roomId });
  if (here.get("local") === "1") q.set("local", "1");
  for (const k of NET_PARAMS) if (here.get(k)) q.set(k, here.get(k)!);
  q.set("ui", "next");
  enterRoom(q);
}

/** Run `then` once the game's session exists: at once, or when an online start has loaded WebRTC. */
function whenStarted(then: () => void): void {
  if (useStore.getState().session) return then();
  const off = useStore.subscribe((s) => {
    if (!s.session) return;
    off();
    then();
  });
}

/** A game from a package names that package, so every player gets its code. */
function namePackage(system: string): void {
  const pkg = Object.values(useLibrary.getState().packages).find(
    (p) => p.trusted && p.manifest.kind === "system" && p.manifest.systems[0] === system,
  );
  if (!pkg) return;
  useStore.getState().dispatch({
    type: "game/packages",
    app: APP_BUILD,
    system: { id: system, builtIn: false },
    packages: [refOf(pkg)],
  });
}

const mode = () => (new URLSearchParams(location.search).get("local") === "1" ? "local" : "online");

/** A friend online: open a room and its invite link. `companion` seats phones at a real table. */
export async function hostRoom(system: string, name: string, companion = false): Promise<void> {
  if (ownGame(system)) await installOwnGame(system);
  remember(name, system);
  const roomId = crypto.randomUUID().slice(0, 8);
  linkTo(roomId);
  useStore.getState().start({ role: "host", mode: mode(), roomId, name, system });
  whenStarted(() => {
    namePackage(system);
    presetMission();
    if (companion) useStore.getState().dispatch({ type: "settings/set", settings: { companion: true } });
  });
}

/** Join a room by its code, as a player or to watch. */
export function joinRoom(roomId: string, name: string, role: "client" | "spectator" = "client"): void {
  remember(name);
  linkTo(roomId);
  useStore.getState().start({ role, mode: mode(), roomId, name });
}

/** Both sides on this screen: the sample armies set up where there are any, else an empty table. */
export function bothSides(system: string, name: string): void {
  remember(name, system);
  if (ownGame(system)) return void playOwnGame(system);
  if (FRONT[system]) return startDemo(system);
  useStore.getState().start({ role: "host", mode: "hotseat", name, system });
  namePackage(system);
  presetMission();
}

/** Real models on a real table, one screen for both players. */
export function atTable(system: string, name: string): void {
  remember(name, system);
  if (ownGame(system)) return void playOwnAtTable(system);
  useStore.getState().start({ role: "host", mode: "hotseat", name, system });
  namePackage(system);
  presetMission();
  useStore.getState().dispatch({ type: "settings/set", settings: { companion: true } });
}

/** Back into the saved game. */
export function resume(saved: SavedGame, name: string): void {
  if (saved.roomId) linkTo(saved.roomId);
  useStore
    .getState()
    .start({ role: "host", mode: saved.mode, roomId: saved.roomId ?? undefined, name, record: saved.record });
  if (saved.computer) armSolo(saved.computer.level, saved.computer.seat);
}

/** The room code in a pasted invite link, or the text as it is. */
export function roomFrom(text: string): string {
  const v = text.trim();
  try {
    return new URL(v).searchParams.get("room") ?? v;
  } catch {
    return v;
  }
}

let autoJoined = false;

/**
 * What a page load goes straight into, as the classic lobby does: an
 * exhibition table, a reloaded hotseat game, or the room in its address.
 * Returns "name" when an invite link needs a name first.
 */
export function autoJoin(saved: SavedGame | null): "name" | null {
  if (autoJoined) return null;
  autoJoined = true;
  const { start } = useStore.getState();
  if (EXHIBITION) {
    startExhibition();
    return null;
  }
  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  const name = savedName();
  const into = roomId ? null : reloadedInto(saved);
  if (into && saved) {
    start({ role: "host", mode: "hotseat", name, record: saved.record });
    if (into.solo) armSolo(into.solo.level, into.solo.seat);
    return null;
  }
  if (!roomId) return null;
  const m = mode();
  if (params.get("review") === "1") {
    start({ role: "spectator", mode: m, roomId, name, review: true });
    return null;
  }
  if (BROADCAST) {
    start({ role: "spectator", mode: m, roomId, name: name || "Stream" });
    return null;
  }
  const back = loadRoom(roomId);
  if (back?.role === "host") start({ role: "host", mode: m, roomId, name, record: back.record });
  else if (back?.role) start({ role: back.role, mode: m, roomId, name });
  else if (!name.trim()) return "name";
  else start({ role: "client", mode: m, roomId, name });
  return null;
}
