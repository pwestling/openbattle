/**
 * A rules package's manifest, read from its source WITHOUT running it: the
 * consent sheet shows what a package is and adds before any of its code may
 * run. The manifest is the `export const manifest = { ... }` literal at the top
 * of the bundle (see the game modules spec), parsed as data.
 */
/** An intentional replacement of a symbol supplied by a declared dependency. */
export interface PackageOverride {
  system: string;
  kind: "action" | "macro" | "quantity" | "phase" | "panel" | "setup";
  id: string;
  from: string;
  /** Required for a quantity: stats on different entity kinds are different symbols. */
  on?: "player" | "unit" | "model" | "token";
}

export interface Manifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  api: number;
  /** A "system" package is a whole game; an "extension" adds rules to the games its `systems` name. */
  kind: "system" | "extension";
  systems: string[];
  requires: { id: string; hash?: string }[];
  overrides?: PackageOverride[];
  adds?: string;
  changelog?: string;
}

type ManifestResult = { manifest: Manifest } | { error: string };

const NOT_LITERAL = "manifest must be a plain literal";

export function readManifest(source: string): ManifestResult {
  const m = /export\s+const\s+manifest\s*(?::[^=]+)?=\s*/.exec(source);
  if (!m) return { error: "This file has no package manifest." };
  let value: unknown;
  try {
    value = new LiteralParser(source, m.index + m[0].length).value();
  } catch {
    // Identifiers, calls, spreads and template expressions would need the code to run.
    return { error: NOT_LITERAL };
  }
  return check(value);
}

function check(v: unknown): ManifestResult {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { error: NOT_LITERAL };
  const o = v as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string) : null);
  const id = str("id");
  const name = str("name");
  const version = str("version");
  const missing = [
    !id && "id",
    !name && "name",
    !version && "version",
    (!Number.isSafeInteger(o.api) || (o.api as number) < 1) && "api",
    !["system", "extension"].includes(o.kind as string) && "kind",
    !(
      Array.isArray(o.systems) &&
      o.systems.length &&
      o.systems.every((x) => typeof x === "string" && x.trim())
    ) && "systems",
  ].filter(Boolean);
  if (missing.length) return { error: `The manifest is missing ${missing.join(", ")}.` };
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(id!) || ["__proto__", "constructor", "prototype"].includes(id!))
    return { error: "Package id must be a safe module-state namespace (1–64 letters, digits, _, ., :, -)." };
  if (o.requires !== undefined && !Array.isArray(o.requires))
    return { error: "Manifest requires must be an array of { id, hash? } dependencies." };
  const requires: Manifest["requires"] = [];
  for (const r of (o.requires ?? []) as unknown[]) {
    if (!r || typeof r !== "object" || Array.isArray(r))
      return { error: "Each manifest dependency must be { id, hash? }." };
    const dependency = r as Record<string, unknown>;
    if (
      typeof dependency.id !== "string" ||
      !dependency.id.trim() ||
      (dependency.hash !== undefined &&
        (typeof dependency.hash !== "string" || !/^[a-f0-9]{64}$/.test(dependency.hash)))
    )
      return { error: "Each dependency needs a nonempty id and, when pinned, a lowercase SHA-256 hash." };
    if (dependency.id === id || requires.some((x) => x.id === dependency.id))
      return { error: `Duplicate or self dependency: ${dependency.id}` };
    requires.push({
      id: dependency.id,
      ...(dependency.hash === undefined ? {} : { hash: dependency.hash as string }),
    });
  }
  if (o.overrides !== undefined && !Array.isArray(o.overrides))
    return { error: "Manifest overrides must be an array." };
  const overrides: PackageOverride[] = [];
  for (const value of (o.overrides ?? []) as unknown[]) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { error: "Each override must name system, kind, id and from." };
    const entry = value as Record<string, unknown>;
    if (
      !["system", "id", "from"].every(
        (key) => typeof entry[key] === "string" && (entry[key] as string).trim(),
      ) ||
      !["action", "macro", "quantity", "phase", "panel", "setup"].includes(entry.kind as string) ||
      !requires.some((r) => r.id === entry.from) ||
      (entry.kind === "quantity"
        ? !["player", "unit", "model", "token"].includes(entry.on as string)
        : entry.on !== undefined) ||
      (entry.kind === "panel" && entry.id !== "panel")
    )
      return {
        error:
          "An override needs a symbol and system, a declared dependency as from, and on for quantities (panel id is panel).",
      };
    const override = entry as unknown as PackageOverride;
    if (
      overrides.some(
        (x) =>
          x.system === override.system &&
          x.kind === override.kind &&
          x.id === override.id &&
          x.on === override.on,
      )
    )
      return { error: `Duplicate override: ${override.kind} ${override.id}` };
    overrides.push(override);
  }
  const manifest: Manifest = {
    id: id!,
    name: name!,
    version: version!,
    api: o.api as number,
    kind: o.kind as Manifest["kind"],
    systems: o.systems as string[],
    requires,
    ...(overrides.length ? { overrides } : {}),
  };
  const author = str("author");
  const adds = str("adds");
  const changelog = str("changelog");
  if (author) manifest.author = author;
  if (adds) manifest.adds = adds;
  if (changelog) manifest.changelog = changelog;
  return { manifest };
}

/** Objects, arrays, strings, numbers, booleans and null, as written in JS (comments and trailing commas allowed). */
class LiteralParser {
  constructor(
    private readonly s: string,
    private i: number,
  ) {}

  /** Where the parser has read to. */
  get at(): number {
    return this.i;
  }

  value(): unknown {
    this.space();
    const c = this.s[this.i];
    if (c === "{") return this.object();
    if (c === "[") return this.array();
    if (c === '"' || c === "'" || c === "`") return this.string();
    const word = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|true|false|null)/i.exec(this.s.slice(this.i, this.i + 40));
    if (!word) throw new Error(`unexpected "${this.s.slice(this.i, this.i + 12)}"`);
    this.i += word[0].length;
    const w = word[0];
    return w === "true" ? true : w === "false" ? false : w === "null" ? null : Number(w);
  }

  private object(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    this.i++;
    for (;;) {
      this.space();
      if (this.s[this.i] === "}") {
        this.i++;
        return out;
      }
      const c = this.s[this.i];
      let key: string;
      if (c === '"' || c === "'") key = this.string();
      else {
        const m = /^[A-Za-z_$][\w$]*/.exec(this.s.slice(this.i, this.i + 64));
        if (!m) throw new Error("expected a key");
        key = m[0];
        this.i += key.length;
      }
      this.space();
      if (this.s[this.i++] !== ":") throw new Error(`expected ":" after ${key}`);
      // Plain data only: no prototype tricks.
      const v = this.value();
      if (key !== "__proto__" && key !== "constructor" && key !== "prototype") out[key] = v;
      this.space();
      if (this.s[this.i] === ",") this.i++;
      else if (this.s[this.i] !== "}") throw new Error("expected , or }");
    }
  }

  private array(): unknown[] {
    const out: unknown[] = [];
    this.i++;
    for (;;) {
      this.space();
      if (this.s[this.i] === "]") {
        this.i++;
        return out;
      }
      out.push(this.value());
      this.space();
      if (this.s[this.i] === ",") this.i++;
      else if (this.s[this.i] !== "]") throw new Error("expected , or ]");
    }
  }

  private string(): string {
    const q = this.s[this.i++];
    let out = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i++]!;
      if (c === q) return out;
      if (q === "`" && c === "$" && this.s[this.i] === "{")
        throw new Error("template expressions aren't data");
      if (c === "\\") {
        const e = this.s[this.i++]!;
        out += e === "n" ? "\n" : e === "t" ? "\t" : e;
      } else out += c;
    }
    throw new Error("unterminated string");
  }

  private space(): void {
    for (;;) {
      const rest = this.s.slice(this.i, this.i + 2);
      if (/^\s/.test(rest)) this.i++;
      else if (rest === "//") {
        const nl = this.s.indexOf("\n", this.i);
        this.i = nl < 0 ? this.s.length : nl + 1;
      } else if (rest === "/*") {
        const end = this.s.indexOf("*/", this.i + 2);
        this.i = end < 0 ? this.s.length : end + 2;
      } else return;
    }
  }
}

export async function sha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
