import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { toolingRuntime } from "./package-runtime.mjs";

async function main() {
  if (process.argv.length !== 3)
    throw new Error(
      "Usage: pnpm package:scenario <scenario.json> (runs explicitly trusted local code, NOT a security sandbox)",
    );
  const path = resolve(process.argv[2]);
  const value = JSON.parse(await readFile(path, "utf8"));
  const { scenarioProblem, runScenario, readManifest } = await toolingRuntime(true);
  const problem = scenarioProblem(value);
  if (problem) throw new Error(problem);
  const packages = [];
  const hashes = new Set();
  for (const packagePath of value.packages) {
    const bytes = await readFile(resolve(dirname(path), packagePath));
    const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hashes.has(hash)) throw new Error(`Duplicate package content: ${packagePath}`);
    hashes.add(hash);
    const result = readManifest(source);
    if ("error" in result) throw new Error(`${packagePath}: ${result.error}`);
    packages.push({ source, hash, manifest: result.manifest });
  }
  console.error("Running trusted local package code with Node access; this tool is NOT a security sandbox.");
  let instance = 0;
  const report = await runScenario(value, packages, (source) => {
    // A fresh module identity recreates top-level package state on reconstruction.
    // The source bytes passed by SandboxEngine are not rewritten or evaluated ahead of load.
    const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#scenario-instance-${instance++}`;
    return import(url);
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        format: "open-battle/package-scenario-report@1",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
