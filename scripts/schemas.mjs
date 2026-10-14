// JSON Schemas for Open Battle's interop formats, generated from the
// TypeScript types that read and write them, so a schema can't drift from the
// code. Each lands in schemas/<name>.v<major>.schema.json; docs/protocols/
// says what each format promises.
//
//   pnpm schemas          write them
//   pnpm schemas:check    fail if the code no longer matches what's committed
//
// A failing check means a change to a format the outside world reads. If the
// change only adds optional fields, run `pnpm schemas` and commit the result.
// If it removes, renames or retypes anything, or makes a field required, the
// format needs a new major version (docs/protocols/README.md).
import { createGenerator } from "ts-json-schema-generator";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Every format with a generated schema: its name, major version, the type that defines it and where. */
export const SCHEMAS = [
  // The game's log, as saved (docs/protocols/files.md).
  { name: "record", major: 9, path: "src/core/log.ts", type: "GameRecord" },
  // Packages (docs/protocols/packages.md).
  { name: "manifest", major: 3, path: "src/packages/manifest.ts", type: "Manifest" },
  // Trusted local authoring scenarios (docs/protocols/package-scenarios.md).
  { name: "package-scenario", major: 1, path: "src/authoring/scenario.ts", type: "PackageScenario" },
  { name: "package-scenario-report", major: 1, path: "src/authoring/scenario.ts", type: "ScenarioOutput" },
  // What peers and servers exchange (docs/protocols/peer-protocol.md, servers.md).
  { name: "peer-message", major: 11, path: "src/net/transport.ts", type: "NetMessage" },
  { name: "side-message", major: 2, path: "src/net/transport.ts", type: "SideMessage" },
  { name: "site-config", major: 2, path: "src/net/config.ts", type: "SiteConfig" },
];

const OUT = "schemas";
export const fileOf = (s) => join(OUT, `${s.name}.v${s.major}.schema.json`);

export function generate(s) {
  const schema = createGenerator({
    path: s.path,
    tsconfig: "tsconfig.app.json",
    type: s.type,
    skipTypeCheck: true,
    expose: "export",
    topRef: true,
    jsDoc: "basic",
    // Readers ignore fields they don't know (docs/protocols/README.md), so the schemas allow them.
    additionalProperties: true,
    sortProps: true,
  }).createSchema(s.type);
  return (
    JSON.stringify(
      {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: `urn:open-battle:schema:${s.name}@${s.major}`,
        title: `Open Battle ${s.name} v${s.major}`,
        ...schema,
      },
      null,
      2,
    ) + "\n"
  );
}

if (process.argv[1]?.endsWith("schemas.mjs")) {
  const check = process.argv.includes("--check");
  mkdirSync(OUT, { recursive: true });
  const changed = [];
  for (const s of SCHEMAS) {
    const text = generate(s);
    let before = "";
    try {
      before = readFileSync(fileOf(s), "utf8");
    } catch {
      // A new schema.
    }
    if (text === before) continue;
    changed.push(fileOf(s));
    if (!check) writeFileSync(fileOf(s), text);
  }
  if (check && changed.length) {
    console.error(
      `These formats changed in the code but not in schemas/:\n  ${changed.join("\n  ")}\n\n` +
        "Only optional fields added? Run `pnpm schemas` and commit the result.\n" +
        "Anything removed, renamed, retyped or made required? That is a new major version: see docs/protocols/README.md.",
    );
    process.exit(1);
  }
  console.log(
    check
      ? `${SCHEMAS.length} schemas match the code.`
      : `${changed.length} of ${SCHEMAS.length} schemas written.`,
  );
}
