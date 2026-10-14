#!/usr/bin/env node
// Regenerates the projections in design/: index.html and DRIFT.html.
// Usage: node tools/pdd.mjs [--artifact <file>]
//   --artifact also writes the index as a page fragment whose links point into design/,
//   for publishing the design as one artifact.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DESIGN = join(ROOT, "design");
const GENERATED = new Set(["index.html", "DRIFT.html"]);
const now = new Date().toISOString().slice(0, 16) + "Z";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "instruments" ? [] : walk(path);
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

// Drift: compares the code with the design. There is no code yet, so there is nothing to compare.
const hasCode = existsSync(join(ROOT, "src")) && walk(join(ROOT, "src")).length > 0;
const driftSections = [];
if (!existsSync(join(DESIGN, "DRIFT.html")) || !hasCode) {
  writeFileSync(join(DESIGN, "DRIFT.html"), doc("Drift report", 3, "DRIFT", `
  <header>
    <nav><a rel="up" href="index.html">OpenBattle design</a> · Projection, regenerated</nav>
    <h1>Drift report</h1>
    <p>Generated ${now}.</p>
  </header>
  <p>${hasCode ? "No open drift." : "There is no code in <code>src/</code> yet, so there is nothing to compare with the design."}</p>`));
}
const drift = readFileSync(join(DESIGN, "DRIFT.html"), "utf8");
for (const m of drift.matchAll(/<section data-node="([^"]+)"/g)) driftSections.push(m[1]);

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
  const proposed = decisions.filter((d) => d.status === "Proposed");
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
    <p>${[0, 1, 2, 3].map((l) => `${count(l)} ${LEVEL[l].toLowerCase()}`).join(" · ")} · ${decisions.length} decisions, ${proposed.length} proposed · ${driftSections.length} open drift</p>
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
      ${hasCode ? "" : "<li>Instruments appear once there is code in <code>src/</code>.</li>"}
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
