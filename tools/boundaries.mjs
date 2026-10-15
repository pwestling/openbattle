// Checks every import in src/ and server/ against the boundaries' "Knows about" lists
// (design/boundaries/*.html). Changing a list here is an escalation: change the boundary first.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

// Which modules each module may import, and which packages it may use.
const modules = {
  record: { dir: "src/record", knows: [], packages: [] },
  measure: { dir: "src/measure", knows: [], packages: [] },
  link: { dir: "src/link", knows: ["relay protocol"], packages: [] },
  archive: { dir: "src/archive", knows: ["record"], packages: [] },
  session: { dir: "src/session", knows: ["record", "link", "archive"], packages: [] },
  screen: { dir: "src/screen", knows: ["session", "record", "measure", "archive"], packages: ["react", "react-dom", "three"] },
  relay: { dir: "server", knows: [], packages: ["ws", "node:"] },
  main: { file: "src/main.ts", knows: ["screen"], packages: [] },
};
// What another module may import of each one: only its public face.
const faces = {
  record: "src/record/index.ts",
  measure: "src/measure/index.ts",
  link: "src/link/index.ts",
  archive: "src/archive/index.ts",
  session: "src/session/index.ts",
  screen: "src/screen/index.ts",
  "relay protocol": "server/protocol.ts",
};

const ownerOf = (file) => {
  for (const [name, m] of Object.entries(modules)) {
    if (m.file ? file === m.file : file.startsWith(m.dir + "/")) return name;
  }
  return null;
};

const walk = (dir) =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

const problems = [];
const files = [...walk("src"), ...walk("server")];
for (const file of files) {
  const owner = ownerOf(file);
  if (!owner) {
    problems.push(`${file}: belongs to no module`);
    continue;
  }
  const m = modules[owner];
  const source = readFileSync(join(root, file), "utf8");
  const specifiers = [...source.matchAll(/(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1] ?? match[2],
  );
  for (const spec of specifiers) {
    const line = source.slice(0, source.indexOf(spec)).split("\n").length;
    const where = `${file}:${line}`;
    if (!spec.startsWith(".")) {
      const allowed = m.packages.some((p) => (p.endsWith(":") ? spec.startsWith(p) : spec === p || spec.startsWith(p + "/")));
      if (!allowed) problems.push(`${where}: ${owner} may not use the package "${spec}"`);
      continue;
    }
    const target = relative(root, resolve(join(root, dirname(file)), spec));
    const targetOwner = ownerOf(target);
    if (targetOwner === owner) continue;
    const face = Object.entries(faces).find(([, path]) => path === target)?.[0];
    if (!face) problems.push(`${where}: imports ${target}, which is not a module's public face`);
    else if (!m.knows.includes(face)) problems.push(`${where}: ${owner} may not know about ${face}`);
  }
}

if (problems.length) {
  console.error(`Boundary check failed:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`Boundary check passed: ${files.length} files.`);
