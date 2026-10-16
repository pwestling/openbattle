// Reads a typed or pasted army list: one unit per line, such as
//   5x Scouts 25mm
//   Captain 40mm 1.5"
//   3x Bikers 60x35mm oval
//   Tank 100x60mm rect 2.5"
// A count ("5x", "5 x" or "5 ×") is optional and defaults to one model. A base is "25mm" (round),
// "60x35mm" (oval) or either followed by round, oval or rect; it defaults to 25mm round. A height in
// inches ('1.5"' or "1.5in") is the stand-in body's height; it defaults to 1.2". Blank lines and
// lines starting with # are skipped. A count without the x ("10 Scouts") reads too.
//
// A list exported as text from OnePageRules' Army Forge reads as well: a unit line such as
//   Battle Brothers [5] Q3+ D3+ | 175pts | Fearless
// is that many models on the default base, and the equipment lines under it, up to the next blank
// line, are skipped, as is the "++ army ++" heading. Its weapons' ranges are not heights.
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
  // True while reading the equipment under an Army Forge unit line.
  let equipment = false;
  for (const raw of text.split("\n")) {
    let line = raw.trim();
    if (!line) {
      equipment = false;
      continue;
    }
    if (line.startsWith("#") || /^\+\+.*\+\+$/.test(line)) continue;
    // "2x Name [5]" is two such units, read as one of ten.
    const forge = /^(?:(\d+)\s*[x×]\s*)?(.+?)\s*\[(\d+)\]\s*Q\d\+\s*D\d\+/i.exec(line);
    if (forge) {
      const count = Number(forge[1] ?? 1) * Number(forge[3]);
      if (count < 1) unread.push(line);
      else units.push({ name: forge[2]!.trim(), count, base: { shape: "round", width: 25, depth: 25 }, height: 1.2 });
      equipment = true;
      continue;
    }
    if (equipment) continue;
    let count = 1;
    line = line.replace(/^(\d+)\s*(?:[x×]\s*|\s(?=\D))/i, (_, n: string) => {
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
    // A name needs a letter, so a stray number is reported rather than becoming a unit called "5".
    if (!/\p{L}/u.test(name) || count < 1) unread.push(raw.trim());
    else units.push({ name, count, base, height });
  }
  return { units, unread };
}
