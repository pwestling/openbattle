import { build } from "esbuild";
import ts from "typescript";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { toolingRuntime } from "./package-runtime.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function literal(node) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))
    return literal(node.expression);
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) {
    const value = Object.create(null);
    for (const property of node.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !(
          ts.isIdentifier(property.name) ||
          ts.isStringLiteral(property.name) ||
          ts.isNumericLiteral(property.name)
        )
      )
        throw new Error("manifest must be a plain literal (no computed keys, shorthand, methods or spreads)");
      const key = property.name.text;
      if (Object.hasOwn(value, key)) throw new Error(`Duplicate manifest key: ${key}`);
      value[key] = literal(property.initializer);
    }
    return value;
  }
  throw new Error("manifest must be a plain literal (no variables, calls or templates)");
}

function entryManifest(source) {
  const declarations = [];
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === "manifest") {
        if (!(statement.declarationList.flags & ts.NodeFlags.Const) || !declaration.initializer)
          throw new Error("manifest must be an exported const literal in the entry file");
        declarations.push(declaration);
      }
    }
  }
  if (declarations.length !== 1)
    throw new Error("Entry must declare exactly one export const manifest = { ... }");
  return literal(declarations[0].initializer);
}

function typecheck(entry, kind) {
  // The synthetic assignment checks even an unannotated default export. No file is written.
  const contract = resolve(root, ".openbattle-authoring-contract.ts");
  const sdk = resolve(root, "src/sdk/index.ts");
  const expected =
    kind === "system" ? "ModuleDef" : 'Pick<ModuleDef, "api"> & Partial<Omit<ModuleDef, "api">>';
  const text = `import definition from ${JSON.stringify(entry)};\nimport type { ModuleDef } from ${JSON.stringify(sdk)};\nconst checked: ${expected} = definition;\nexport default checked;\n`;
  const options = {
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noUncheckedIndexedAccess: true,
    noFallthroughCasesInSwitch: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    checkJs: true,
  };
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  host.readFile = (path) => (path === contract ? text : originalRead(path));
  host.fileExists = (path) => path === contract || originalExists(path);
  const program = ts.createProgram([entry, contract], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => "\n",
      }),
    );
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const symbol = source && checker.getSymbolAtLocation(source);
  const defaultExport = symbol && checker.getExportsOfModule(symbol).find((item) => item.name === "default");
  const type = defaultExport && checker.getTypeOfSymbolAtLocation(defaultExport, source);
  if (!type || type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
    throw new Error("Default export must have a concrete, checked module type, not any or unknown");
}

function noImports(source) {
  const ast = ts.createSourceFile("package.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
      (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
    )
      throw new Error("Package artifact must contain no static or dynamic runtime imports");
    ts.forEachChild(node, visit);
  };
  visit(ast);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[1] !== "--out")
    throw new Error("Usage: pnpm package:build <entry.ts> --out <file.js>");
  const entry = await realpath(resolve(args[0]));
  const output = resolve(args[2]);
  if (entry === output) throw new Error("Output must not overwrite the entry source");
  const source = await readFile(entry, "utf8");
  const ast = ts.createSourceFile(entry, source, ts.ScriptTarget.Latest, true);
  const value = entryManifest(ast);
  const { readManifest, MODULE_API } = await toolingRuntime();
  const manifestSource = `export const manifest = ${JSON.stringify(value, null, 2)};`;
  const parsed = readManifest(manifestSource);
  if ("error" in parsed) throw new Error(parsed.error);
  if (parsed.manifest.api !== MODULE_API)
    throw new Error(`Manifest API ${parsed.manifest.api} does not match MODULE_API ${MODULE_API}`);
  typecheck(entry, parsed.manifest.kind);
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    target: "es2022",
    format: "iife",
    globalName: "__openBattlePackage",
    write: false,
    sourcemap: "inline",
    sourcesContent: true,
    legalComments: "inline",
    banner: { js: manifestSource },
    footer: { js: "export default __openBattlePackage.default;" },
    logLevel: "silent",
    plugins: [
      {
        name: "local-authoring-sources",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") return;
            if (!args.path.startsWith("./") && !args.path.startsWith("../") && !isAbsolute(args.path))
              return {
                errors: [
                  {
                    text: `Runtime import ${JSON.stringify(args.path)} is not a local source; packages cannot import node modules or external URLs`,
                  },
                ],
              };
          });
          builder.onLoad({ filter: /.*/ }, async (args) => {
            const actual = await realpath(args.path);
            if (actual.split(sep).includes("node_modules"))
              return { errors: [{ text: "Runtime code from node_modules is not allowed in a package" }] };
          });
        },
      },
    ],
  });
  const bytes = result.outputFiles[0].contents;
  const artifact = new TextDecoder().decode(bytes);
  noImports(artifact);
  const bundledManifest = readManifest(artifact);
  if (
    "error" in bundledManifest ||
    JSON.stringify(bundledManifest.manifest) !== JSON.stringify(parsed.manifest)
  )
    throw new Error("Bundled manifest changed or is not readable without execution");
  // Only a completed typecheck and bundle can reach the atomic output replacement.
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(
    JSON.stringify({
      ok: true,
      entry,
      output,
      bytes: bytes.byteLength,
      hash: createHash("sha256").update(bytes).digest("hex"),
      manifest: parsed.manifest,
    }),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
