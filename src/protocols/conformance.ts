import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020";

/**
 * The conformance suite's files (conformance/ and schemas/) for the tests
 * here. Another implementation uses the same files without this code: see
 * conformance/README.md.
 */

const SCHEMAS = import.meta.glob("../../schemas/*.schema.json", { eager: true, import: "default" });
const FIXTURES = import.meta.glob("../../conformance/*/v*/*/*.json", { eager: true, import: "default" });

interface Fixture {
  format: string;
  major: number;
  /** Its path under conformance/. */
  file: string;
  valid: boolean;
  data: unknown;
}

function schemaOf(format: string, major: number): object | undefined {
  return SCHEMAS[`../../schemas/${format}.v${major}.schema.json`] as object | undefined;
}

/** Every fixture on disk, valid and invalid. */
export function fixtures(): Fixture[] {
  return Object.entries(FIXTURES).flatMap(([path, data]) => {
    const m = /conformance\/([^/]+)\/v(\d+)\/(valid|invalid)\/([^/]+\.json)$/.exec(path);
    return m
      ? [
          {
            format: m[1]!,
            major: Number(m[2]),
            file: `${m[1]}/v${m[2]}/${m[3]}/${m[4]}`,
            valid: m[3] === "valid",
            data,
          },
        ]
      : [];
  });
}

// Generated schemas are draft-07; hand-written ones may be 2020-12.
const ajv = new Ajv({ allErrors: true, strict: false });
const ajv2020 = new Ajv2020({ allErrors: true, strict: false });
const compiled = new Map<string, ReturnType<typeof ajv.compile>>();

/** Schema errors for a document, or [] when it conforms. */
export function schemaErrors(format: string, major: number, data: unknown): string[] {
  const key = `${format}@${major}`;
  let check = compiled.get(key);
  if (!check) {
    const schema = schemaOf(format, major);
    if (!schema) return [`no schema for ${key}`];
    const draft = (schema as { $schema?: string }).$schema ?? "";
    check = (draft.includes("2020-12") ? ajv2020 : ajv).compile(schema);
    compiled.set(key, check);
  }
  return check(data) ? [] : (check.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`);
}

/** Write a fixture (WRITE_CONFORMANCE=1 only), the way src/printplay/rulebook.test.ts writes. */
export async function writeFixture(path: string, data: unknown): Promise<void> {
  const fs = (await import(/* @vite-ignore */ ["node", "fs"].join(":"))) as {
    mkdirSync(path: URL, opts: { recursive: boolean }): void;
    writeFileSync(path: URL, text: string): void;
  };
  const url = new URL(`../../conformance/${path}`, import.meta.url);
  fs.mkdirSync(new URL(".", url), { recursive: true });
  fs.writeFileSync(url, JSON.stringify(data, null, 2) + "\n");
}
