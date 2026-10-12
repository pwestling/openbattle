/**
 * A small reader for gettext PO files, the catalog format (see
 * docs/translating.md): what translators' tools (Poedit, Weblate, Crowdin)
 * read and write. Only what the catalogs use: msgctxt, msgid, msgid_plural,
 * msgstr / msgstr[n], and the fuzzy flag, which marks a draft.
 */
interface PoEntry {
  context?: string;
  id: string;
  plural?: string;
  /** One string, or one per plural form. */
  str: string[];
  fuzzy: boolean;
  /** Translator and extractor comments, kept for writing back. */
  comments: string[];
}

/** The key an entry is looked up by: its context and its English text. */
export const entryKey = (id: string, context?: string) => (context ? `${context}\u0004${id}` : id);

function unquote(s: string): string {
  return JSON.parse(s.replace(/\\(?!["\\nt])/g, "\\\\")) as string;
}

export function parsePo(text: string): PoEntry[] {
  const out: PoEntry[] = [];
  let cur: PoEntry | null = null;
  let field: { name: string; index: number } | null = null;
  let comments: string[] = [];
  let fuzzy = false;
  const flush = () => {
    if (cur) out.push(cur);
    cur = null;
    field = null;
  };
  const set = (name: string, index: number, value: string) => {
    if (!cur) return;
    if (name === "msgctxt") cur.context = (cur.context ?? "") + value;
    else if (name === "msgid") cur.id += value;
    else if (name === "msgid_plural") cur.plural = (cur.plural ?? "") + value;
    else if (name === "msgstr") cur.str[index] = (cur.str[index] ?? "") + value;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("#")) {
      if (cur && field?.name === "msgstr") flush();
      if (line.startsWith("#,")) fuzzy ||= /\bfuzzy\b/.test(line);
      else comments.push(raw);
      continue;
    }
    const m = /^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?\s+(".*")$/.exec(line);
    if (m) {
      const [, name, index, value] = m;
      if (name === "msgctxt" || (name === "msgid" && (!cur || field?.name === "msgstr"))) {
        if (cur && field?.name === "msgstr") flush();
        cur ??= { id: "", str: [], fuzzy, comments };
        comments = [];
        fuzzy = false;
      }
      field = { name: name!, index: Number(index ?? 0) };
      set(field.name, field.index, unquote(value!));
    } else if (line.startsWith('"') && field) set(field.name, field.index, unquote(line));
  }
  flush();
  return out;
}
