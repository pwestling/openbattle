import { build } from "esbuild";
import { fileURLToPath } from "node:url";

/** Bundle only repository-owned tooling. This never loads an author's package. */
export async function toolingRuntime(scenario = false) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const source = scenario
    ? 'export { runScenario, scenarioProblem } from "./src/authoring/scenario.ts"; export { readManifest } from "./src/packages/manifest.ts";'
    : 'export { readManifest } from "./src/packages/manifest.ts"; export { MODULE_API } from "./src/sdk/index.ts";';
  const result = await build({
    stdin: {
      contents: source,
      resolveDir: root,
      sourcefile: "open-battle-authoring-runtime.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    write: false,
    sourcemap: "inline",
    logLevel: "silent",
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`
  );
}
