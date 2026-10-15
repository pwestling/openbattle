// The saved game file. It reads, in order:
//   the line "OpenBattle game\n";
//   the length in bytes of the header, as a 4-byte big-endian number;
//   the header, as UTF-8 JSON: { version, link, log, files: [{ fingerprint, type, size }] };
//   each file's bytes, one after another, in the header's order.
// Files are appended raw rather than inside the JSON so a 512 MB mesh is neither copied nor inflated.
import type { Fingerprint, Log } from "../record/index.ts";
import { isLog } from "./shape.ts";

/** The format this code writes. A file with a higher version was made by a newer OpenBattle. */
export const VERSION = 1;

const MAGIC = new TextEncoder().encode("OpenBattle game\n");

export interface Packed {
  fingerprint: Fingerprint;
  bytes: Blob;
}

interface Header {
  version: number;
  link: string;
  log: Log;
  files: { fingerprint: Fingerprint; type: string; size: number }[];
}

export function pack(link: string, log: Log, files: Packed[], name: string): File {
  const header: Header = {
    version: VERSION,
    link,
    log,
    files: files.map((f) => ({ fingerprint: f.fingerprint, type: f.bytes.type, size: f.bytes.size })),
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, json.length);
  return new File([MAGIC, length, json, ...files.map((f) => f.bytes)], name, { type: "application/vnd.openbattle.game" });
}

export class NotAGame extends Error {}

/** Reads a saved game file back into its link, log and files, or throws NotAGame saying why. */
export async function unpack(file: Blob): Promise<{ link: string; log: Log; files: Packed[] }> {
  const start = MAGIC.length + 4;
  const lead = new Uint8Array(await file.slice(0, start).arrayBuffer());
  if (lead.length < start || MAGIC.some((b, i) => lead[i] !== b)) throw new NotAGame("This file is not a saved OpenBattle game.");
  const length = new DataView(lead.buffer).getUint32(MAGIC.length);
  if (start + length > file.size) throw new NotAGame("This saved game is cut short.");

  let header: unknown;
  try {
    header = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await file.slice(start, start + length).arrayBuffer()));
  } catch {
    throw new NotAGame("This saved game is damaged.");
  }
  const version = (header as Partial<Header> | null)?.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) throw new NotAGame("This saved game is damaged.");
  if (version > VERSION) throw new NotAGame("This game was saved by a newer version of OpenBattle. Update OpenBattle to open it.");
  if (!isHeader(header)) throw new NotAGame("This saved game is damaged.");

  let at = start + length;
  const files = header.files.map((f) => {
    const bytes = file.slice(at, at + f.size, f.type);
    at += f.size;
    return { fingerprint: f.fingerprint, bytes };
  });
  if (at > file.size) throw new NotAGame("This saved game is cut short.");
  if (at < file.size) throw new NotAGame("This saved game is damaged.");
  return { link: header.link, log: header.log, files };
}

function isHeader(value: unknown): value is Header {
  const h = value as Partial<Header>;
  return (
    typeof h.link === "string" &&
    isLog(h.log) &&
    Array.isArray(h.files) &&
    h.files.every(
      (f) =>
        typeof f === "object" &&
        f !== null &&
        typeof f.fingerprint === "string" &&
        typeof f.type === "string" &&
        Number.isSafeInteger(f.size) &&
        f.size >= 0,
    )
  );
}
