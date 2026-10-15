// Archive: games and files kept in this browser, and saved game files. Realizes design/surfaces/archive.html.
import type { Entry, Fingerprint, Log, PlayerId } from "../record/index.ts";
import { NotAGame, pack, unpack, type Packed } from "./gamefile.ts";
import { isSaved } from "./shape.ts";
import { FILES, GAMES, request, within } from "./store.ts";

export interface Saved {
  log: Log;
  me: PlayerId | "watch";
}

export async function save(link: string, saved: Saved): Promise<void> {
  const copy: Saved = { log: saved.log, me: saved.me };
  await within([GAMES], "readwrite", (tx) => request(tx.objectStore(GAMES).put(copy, link)));
}

export async function load(link: string): Promise<Saved | null> {
  try {
    const stored: unknown = await within([GAMES], "readonly", (tx) => request(tx.objectStore(GAMES).get(link)));
    return isSaved(stored) ? { log: stored.log, me: stored.me } : null;
  } catch {
    return null;
  }
}

export async function keepFile(link: string, file: Blob): Promise<Fingerprint> {
  const fingerprint = await fingerprintOf(file);
  await keep(link, file, fingerprint);
  return fingerprint;
}

async function keep(link: string, file: Blob, fingerprint: Fingerprint): Promise<void> {
  await within([FILES], "readwrite", async (tx) => {
    const files = tx.objectStore(FILES);
    const kept: unknown = await request(files.get(fingerprint));
    if (isKept(kept)) {
      if (!kept.links.includes(link)) await request(files.put({ ...kept, links: [...kept.links, link] }, fingerprint));
    } else {
      const bytes = new Blob([file], { type: file.type });
      await request(files.put({ bytes, links: [link] } satisfies Kept, fingerprint));
    }
  });
}

export async function getFile(fingerprint: Fingerprint): Promise<Blob | null> {
  const kept: unknown = await within([FILES], "readonly", (tx) => request(tx.objectStore(FILES).get(fingerprint)));
  return isKept(kept) ? kept.bytes : null;
}

/** A kept file: its bytes once, and the links of the games that use it. */
interface Kept {
  bytes: Blob;
  links: string[];
}

const isKept = (value: unknown): value is Kept =>
  typeof value === "object" && value !== null && (value as Kept).bytes instanceof Blob && Array.isArray((value as Kept).links);

async function fingerprintOf(file: Blob): Promise<Fingerprint> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The Blob is a File, so it carries its name. A file this browser never kept is left out. */
export async function toFile(link: string, log: Log): Promise<Blob> {
  const files: Packed[] = [];
  for (const fingerprint of filesUsed(log.entries)) {
    const bytes = await getFile(fingerprint).catch(() => null);
    if (bytes) files.push({ fingerprint, bytes });
  }
  return pack(link, log, files, fileName(link, new Date()));
}

export async function fromFile(file: Blob): Promise<{ link: string; log: Log }> {
  const { link, log, files } = await unpack(file);
  // Check every file before keeping any, so a damaged saved game leaves nothing behind.
  for (const { fingerprint, bytes } of files) {
    if ((await fingerprintOf(bytes)) !== fingerprint) throw new NotAGame("This saved game is damaged.");
  }
  // Keeping is best effort: where the browser refuses storage the game still opens, and its pieces show as missing.
  for (const { fingerprint, bytes } of files) await keep(link, bytes, fingerprint).catch(() => {});
  return { link, log };
}

/** Every mesh and card picture the log names, each once, in the order they first appear. */
// Reads defensively: a log from a file is only checked down to its kinds, and toFile never fails.
function filesUsed(entries: Entry[]): Fingerprint[] {
  const used = new Set<Fingerprint>();
  const add = (f: unknown) => typeof f === "string" && used.add(f);
  for (const { action } of entries) {
    if (action.kind === "place terrain" && action.terrain?.shape?.kind === "mesh") add(action.terrain.shape.mesh);
    if (action.kind === "add to army" && Array.isArray(action.models)) for (const m of action.models) add(m?.mesh);
    if (action.kind === "add deck" && Array.isArray(action.cards)) for (const c of action.cards) add(c?.picture);
  }
  return [...used];
}

/** Named after the game and the day, for example "OpenBattle k3j9x 2026-10-15.openbattle". */
function fileName(link: string, now: Date): string {
  const game = link.split(/[/#?=&]/).filter(Boolean).pop()?.replace(/[^A-Za-z0-9_-]+/g, "-") || "game";
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  return `OpenBattle ${game} ${day}.openbattle`;
}
