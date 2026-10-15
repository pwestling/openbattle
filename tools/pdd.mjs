#!/usr/bin/env node
// Regenerates the projections in design/: index.html and DRIFT.html.
// Usage: node tools/pdd.mjs [--artifact <file>]
//   --artifact also writes the index as a page fragment whose links point into design/,
//   for publishing the design as one artifact.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DESIGN = join(ROOT, "design");
const GENERATED = new Set(["index.html", "DRIFT.html"]);
const now = new Date().toISOString().slice(0, 16) + "Z";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "instruments" || name === "drift" ? [] : walk(path);
    return name.endsWith(".html") && !(dir === DESIGN && GENERATED.has(name)) ? [path] : [];
  });
}

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const nodes = walk(DESIGN).map((file) => {
  const html = readFileSync(file, "utf8");
  const article = html.match(/<article data-level="(\d)" id="([^"]+)"/);
  if (!article) throw new Error(`${relative(ROOT, file)}: no <article data-level id>`);
  const id = article[2];
  if (id !== relative(DESIGN, file).replace(/\.html$/, "")) throw new Error(`${id}: id does not match its path`);
  const realizesNav = html.match(/<nav class="realizes">([\s\S]*?)<\/nav>/)?.[1] ?? "";
  const parents = [...realizesNav.matchAll(/rel="realizes" href="([^"#]+)/g)].map((m) =>
    join(file, "..", m[1]).slice(DESIGN.length + 1).replace(/\.html$/, ""),
  );
  return {
    id,
    level: Number(article[1]),
    title: strip(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]),
    derived: html.match(/name="pdd-derived" content="([^"]+)"/)?.[1] ?? "never",
    parents: [...new Set(parents)],
    status: html.match(/<dt>Status<\/dt><dd><mark>([^<]*)<\/mark>/)?.[1] ?? "",
    open: [...html.matchAll(/<mark>Open<\/mark>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])),
  };
});
const byId = new Map(nodes.map((n) => [n.id, n]));
for (const n of nodes) for (const p of n.parents) if (!byId.has(p)) throw new Error(`${n.id}: realizes missing node ${p}`);
for (const n of nodes) {
  if (n.id !== "intent" && !n.id.startsWith("decisions/") && n.parents.length === 0) throw new Error(`${n.id}: realizes nothing, so the index would not show it`);
}

// Drift: the upward pass writes what it finds, one <section data-node="…"> per affected node, as
// files in design/drift/. This collects them into DRIFT.html; it does not compare code itself.
const hasCode = existsSync(join(ROOT, "src")) && readdirSync(join(ROOT, "src"), { recursive: true }).some((f) => /\.tsx?$/.test(f));
const DRIFT_DIR = join(DESIGN, "drift");
const found = existsSync(DRIFT_DIR)
  ? readdirSync(DRIFT_DIR).filter((f) => f.endsWith(".html")).sort().map((f) => readFileSync(join(DRIFT_DIR, f), "utf8").trim())
  : [];
const driftSections = found.flatMap((html) => [...html.matchAll(/<section data-node="([^"]+)"/g)].map((m) => m[1]));
for (const id of driftSections) if (!byId.has(id)) throw new Error(`drift: section against missing node ${id}`);
const summary = !hasCode
  ? "There is no code in <code>src/</code> yet, so there is nothing to compare with the design."
  : found.length
    ? "What the code does that the design does not say, found by the latest upward pass."
    : "No upward pass has recorded drift yet.";
writeFileSync(join(DESIGN, "DRIFT.html"), doc("Drift report", 3, "DRIFT", `
  <header>
    <nav><a rel="up" href="index.html">OpenBattle design</a> · Projection, regenerated</nav>
    <h1>Drift report</h1>
    <p>Generated ${now}.</p>
  </header>
  <p>${summary}</p>
${found.join("\n")}`));

function doc(title, level, id, body, css = "design.css") {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="pdd-level" content="${level}">
<meta name="pdd-derived" content="${now}">
<link rel="stylesheet" href="${css}">
</head>
<body>
<main data-level="${level}" id="${id}">${body}
</main>
</body>
</html>
`;
}

const LEVEL = ["Intent", "Concepts", "Boundaries", "Surfaces"];
const children = (id) => nodes.filter((n) => n.level <= 3 && n.parents.includes(id)).sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
const badge = (n) => (driftSections.includes(n.id) ? ` <mark>Drift</mark>` : "");

function tree(n, prefix, depth = 0) {
  const kids = children(n.id);
  const line = `<summary><span>L${n.level}</span><a href="${prefix}${n.id}.html">${n.title}</a><small>${n.derived}</small>${badge(n)}</summary>`;
  const pad = "  ".repeat(depth + 1);
  if (!kids.length) return `${pad}<details>${line}</details>`;
  return `${pad}<details${depth < 1 ? " open" : ""}>${line}\n${kids.map((k) => tree(k, prefix, depth + 1)).join("\n")}\n${pad}</details>`;
}

function body(prefix) {
  const designNodes = nodes.filter((n) => !n.id.startsWith("decisions/"));
  const decisions = nodes.filter((n) => n.id.startsWith("decisions/")).sort((a, b) => a.id.localeCompare(b.id));
  const count = (l) => designNodes.filter((n) => n.level === l).length;
  const proposed = nodes.filter((d) => d.status === "Proposed").sort((a, b) => a.id.localeCompare(b.id));
  const opens = nodes.flatMap((n) => n.open.map((text) => ({ n, text })));
  const intent = byId.get("intent");
  const waiting = [
    ...opens.map(({ n, text }) => `<li><a href="${prefix}${n.id}.html">${n.title}</a>: ${text}</li>`),
    ...proposed.map((d) => `<li><a href="${prefix}${d.id}.html">${d.title}</a> <small>proposed</small></li>`),
  ];
  return `
  <header>
    <nav>Projection, regenerated ${now}</nav>
    <h1>OpenBattle design</h1>
    <p>${[0, 1, 2, 3].map((l) => `${count(l)} ${LEVEL[l].toLowerCase()}`).join(" · ")} · ${decisions.length} decisions · ${proposed.length} awaiting approval · ${driftSections.length} open drift</p>
  </header>
  <section id="waiting">
    <h2>Waiting on Porter</h2>
    ${waiting.length ? `<ul>\n      ${waiting.join("\n      ")}\n    </ul>` : "<p>Nothing.</p>"}
  </section>
  <section id="tree">
    <h2>The ladder</h2>
${tree(intent, prefix)}
  </section>
  <section id="decisions">
    <h2>Decisions</h2>
    <ul>
      ${decisions.map((d) => `<li><a href="${prefix}${d.id}.html">${d.title}</a> <small>L${d.level} · ${d.status || "no status"}</small></li>`).join("\n      ")}
    </ul>
  </section>
  <section id="instruments">
    <h2>Drift and instruments</h2>
    <ul>
      <li><a href="${prefix}DRIFT.html">Drift report</a> <small>${driftSections.length} open</small></li>
      <li>Instruments appear with the first upward pass, once the modules are built.</li>
    </ul>
  </section>`;
}

writeFileSync(join(DESIGN, "index.html"), doc("OpenBattle design", 0, "index", body("")));

const artifactAt = process.argv.indexOf("--artifact");
if (artifactAt > 0) {
  const out = process.argv[artifactAt + 1];
  writeFileSync(out, `<title>OpenBattle Design</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="design/design.css">
<main data-level="0" id="index">${body("design/")}
</main>
`);
}
console.log(`index: ${nodes.length} nodes, ${driftSections.length} drift`);
