// Reads a typed or pasted army list: one unit per line, such as
//   5x Scouts 25mm
//   Captain 40mm 1.5"
//   3x Bikers 60x35mm oval
//   Tank 100x60mm rect 2.5"
// A count ("5x", "5 x" or "5 ×") is optional and defaults to one model. A base is "25mm" (round),
// "60x35mm" (oval) or either followed by round, oval or rect; it defaults to 25mm round. A height in
// inches ('1.5"' or "1.5in") is the stand-in body's height; it defaults to 1.2". Blank lines and
// lines starting with # are skipped.
import type { Base } from "../record/index.ts";

export interface ListedUnit {
  name: string;
  count: number;
  base: Base;
  height: number;
}

export function readArmyList(text: string): { units: ListedUnit[]; unread: string[] } {
  const units: ListedUnit[] = [];
  const unread: string[] = [];
  for (const raw of text.split("\n")) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let count = 1;
    line = line.replace(/^(\d+)\s*[x×]\s*/i, (_, n: string) => {
      count = Number(n);
      return "";
    });
    let base: Base = { shape: "round", width: 25, depth: 25 };
    line = line.replace(
      /(\d+(?:\.\d+)?)\s*(?:[x×]\s*(\d+(?:\.\d+)?)\s*)?mm(?:\s+(round|oval|rect))?/i,
      (_, a: string, b?: string, shape?: string) => {
        const width = Number(a);
        const depth = b ? Number(b) : width;
        const kind = (shape?.toLowerCase() as Base["shape"] | undefined) ?? (width === depth ? "round" : "oval");
        base = { shape: kind, width, depth };
        return " ";
      },
    );
    let height = 1.2;
    line = line.replace(/(\d+(?:\.\d+)?)\s*(?:"|″|in\b)/i, (_, h: string) => {
      height = Number(h);
      return " ";
    });
    const name = line.replace(/[,;:\s]+/g, " ").trim();
    if (!name || count < 1) unread.push(raw.trim());
    else units.push({ name, count, base, height });
  }
  return { units, unread };
}
