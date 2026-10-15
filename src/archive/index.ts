// Archive: games and files kept in this browser, and saved game files. Realizes design/surfaces/archive.html.
import type { Fingerprint, Log, PlayerId } from "../record/index.ts";

export interface Saved {
  log: Log;
  me: PlayerId | "watch";
}

const notYet = (op: string): never => {
  throw new Error(`archive.${op} is not built yet`);
};

export async function save(link: string, saved: Saved): Promise<void> {
  return notYet("save");
}

export async function load(link: string): Promise<Saved | null> {
  return notYet("load");
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
