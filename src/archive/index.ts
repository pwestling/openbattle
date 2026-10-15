// Archive: games and files kept in this browser, and saved game files. Realizes design/surfaces/archive.html.
import type { Fingerprint, Log, PlayerId } from "../record/index.ts";
import { isSaved } from "./shape.ts";
import { FILES, GAMES, request, within } from "./store.ts";

export interface Saved {
  log: Log;
  me: PlayerId | "watch";
}

const notYet = (op: string): never => {
  throw new Error(`archive.${op} is not built yet`);
};

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
  return fingerprint;
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

/** The surface says Blob; it is a promise because the kept mesh files are read from storage. */
export async function toFile(link: string, log: Log): Promise<Blob> {
  return notYet("toFile");
}

export async function fromFile(file: Blob): Promise<{ link: string; log: Log }> {
  return notYet("fromFile");
}
