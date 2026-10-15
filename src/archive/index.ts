// Archive: games and files kept in this browser, and saved game files. Realizes design/surfaces/archive.html.
import type { Fingerprint, Log, PlayerId } from "../record/index.ts";
import { isSaved } from "./shape.ts";
import { GAMES, request, within } from "./store.ts";

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
  return notYet("keepFile");
}

export async function getFile(fingerprint: Fingerprint): Promise<Blob | null> {
  return notYet("getFile");
}

/** The surface says Blob; it is a promise because the kept mesh files are read from storage. */
export async function toFile(link: string, log: Log): Promise<Blob> {
  return notYet("toFile");
}

export async function fromFile(file: Blob): Promise<{ link: string; log: Log }> {
  return notYet("fromFile");
}
