# Projection Driven Development

This repository is worked on by an AI agent and reviewed by a human who does not read code. The human is good at abstraction, separation, naming, and judging the outer surface of software. The agent is good at writing and maintaining large amounts of code but has unreliable taste. The method below exists so the human can see the shape of what the agent built, at whatever zoom level they choose, and catch the agent's mistakes without reading the implementation.

The core idea: the software exists as a ladder of descriptions, from intent down to code. Each level *refines* the one above it by adding decisions. The human reads the upper levels. The agent writes all levels, keeps them in sync, and, crucially, regenerates the upper levels *from* the code so the human is reading what was built, not what was meant.

## The ladder

| Level | Name | Lives in | Who reads it | Question it answers |
|---|---|---|---|---|
| 0 | Intent | `design/intent.html` | Human | What is this for, for whom, and how would we know it worked? |
| 1 | Concepts | `design/concepts/*.html` | Human | What are the nouns, what does each mean, what must always be true? |
| 2 | Boundaries | `design/boundaries/*.html` | Human | What are the modules, what does each one hide, what is it allowed to know about? |
| 3 | Surfaces | `design/surfaces/*.html` | Human | What does each module look like from outside? |
| 4 | Implementation | `src/` | Agent only | How does it work? |

`design/index.html` is the root: a zoomable tree of every node. The human opens it in a browser and never needs anything else.

**Level 3 is the human's floor.** Nothing below it is shown as text. Everything below it is shown as instruments (see below).

Each level is a *refinement* of the one above: it must be consistent with its parents, and it adds choices the parents didn't determine. A level is not a restatement of the one above with more words. If a node adds no decision, it shouldn't exist.

## Format

The design is HTML, written by hand, with no build step and no framework. Every page must render correctly opened from `file://`. There is one shared stylesheet, `design/design.css`, and nothing else is loaded except the graph renderer (below). HTML is the native format because the three things the human needs — links between nodes, collapsible zoom, and rendered graphs — are things HTML does on its own and Markdown doesn't.

Every node under `design/` is one page, short, ideally under a screen, with this skeleton:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ledger — Boundary</title>
<meta name="pdd-level" content="2">
<meta name="pdd-derived" content="2026-10-13T20:05Z">
<link rel="stylesheet" href="../design.css">
</head>
<body>
<article data-level="2" id="boundaries/ledger">
  <header>
    <h1>Ledger</h1>
    <nav class="realizes">
      Realizes:
      <a rel="realizes" href="../concepts/ledger.html">Ledger</a>
      <a rel="realizes" href="../concepts/account.html">Account</a>
      <a rel="realizes" href="../intent.html#durability">Durability</a>
    </nav>
  </header>
  <section id="hides"> … </section>
  <section id="knows"> … </section>
  <section id="owns"> … </section>
  <footer class="decisions">
    Decisions:
    <a rel="decision" href="../decisions/ADR-007.html">ADR-007</a>
    <a rel="decision" href="../decisions/ADR-012.html">ADR-012</a>
  </footer>
</article>
</body>
</html>
```

The parts that carry meaning:

- `<a rel="realizes">` links are the DAG edges. The design is a DAG, not a tree: a boundary realizes several concepts; a surface may realize several boundaries; a cross-cutting invariant is realized by many children. Because the edges are links, the human navigates them by clicking and the agent extracts them by parsing `rel`.
- `<a rel="decision">` links point to the decision records explaining the choices this node made that its parents didn't force.
- `<meta name="pdd-derived">` is the timestamp of the last upward regeneration (see "Two directions"). The index shows it; a stale one is a visible warning.
- `data-level` and the `id` are what the index and the instruments key on. Node ids are `level-folder/slug`, matching the file path without extension.

Write for the human. Plain language, the project's own vocabulary, no code in levels 0–2. Level 3 may contain signatures in `<code>` alongside prose. Use semantic elements (`section`, `dl`, `details`) rather than classes wherever a semantic element exists; the stylesheet styles elements, not class soup.

### The index

`design/index.html` is a nested `<details>` tree: intent at the top, concepts inside it, boundaries inside each concept they realize, surfaces inside each boundary. A node that realizes several parents appears under each one (it's a DAG rendered as a tree; repetition is fine, it's how zoom works). Each `<summary>` shows the node's title, its `pdd-derived` date, and a drift badge if `DRIFT.html` has an open item against it. The index is regenerated, never hand-edited, on every upward pass.

## Decision records

Every edge in the DAG carries a decision. When you choose X over Y at any level, write `design/decisions/ADR-NNN.html`, same skeleton, with a `<dl>` body:

```html
<article data-level="2" id="decisions/ADR-012">
  <h1>ADR-012: Ledger does not know about Users</h1>
  <dl>
    <dt>Context</dt><dd>Posting needs an actor for audit, which could come from User.</dd>
    <dt>Decision</dt><dd>Ledger takes an opaque <code>ActorId</code>. It never imports User.</dd>
    <dt>Because</dt><dd>Keeps Ledger reusable and keeps User's churn out of Ledger.</dd>
    <dt>Rejected</dt><dd>Ledger imports User directly. Simpler, but couples the two fastest-changing modules.</dd>
    <dt>Affects</dt><dd><a href="../boundaries/ledger.html">Ledger</a></dd>
  </dl>
</article>
```

Decisions are what let a human judge taste without reading code, and what let the agent re-derive lower levels when an upper one changes. A DAG without decisions is a filing system.

## Concepts (level 1)

A concept is a unit of user-facing meaning, not a data type. Each `design/concepts/<name>.md` has:

- **Purpose**: one sentence, why the concept exists for the user.
- **Meaning**: what the noun refers to, in plain language.
- **Invariants**: what must always be true about it.
- **Not**: what it is often confused with and isn't.

The set of concepts is the project's vocabulary. Every noun used in levels 2–3 must be a concept or a plain English word, and every use of a concept name in another node is a link to that concept's page. Introducing a new noun anywhere is an escalation (below).

## Boundaries (level 2)

One page per module in `design/boundaries/`. For each:

- **Hides**: the decision this module exists to encapsulate (Parnas's criterion). "Hides the storage format" is a boundary. "Does ledger stuff" is not.
- **Knows about**: the concepts and other modules it may reference. This list is enforced; see instruments.
- **Owns**: which invariants it is responsible for maintaining.

Dependency direction is part of the design. If A knows about B, B must not know about A unless a decision record says why.

## Surfaces (level 3)

`design/surfaces/<module>.html` describes the module from outside: one `<section>` per operation, each with its signature in `<code>`, then preconditions, postconditions, and failure behavior as a `<dl>`. This is the lowest thing the human reads and the thing they are best at judging. A surface with twelve operations where four would do, or one that leaks an internal concept, is a taste failure the human should be able to see here.

## Two directions

**Downward (refine).** When intent or a concept changes, or a new feature is requested, locate the highest node affected and work down: update concepts, then boundaries, then surfaces, then code. Each step adds a decision record if it made a choice. Do not skip to code and backfill. The design must be derivable from the top at all times, even though it never actually was (Parnas & Clements: fake the rational process, but keep the documents as if it were real).

**Upward (decompile).** After any change to `src/`, regenerate levels 3, 2, and the vocabulary *from the code*, in a pass that does not read the existing design files. Then diff the regenerated version against the stored one. This is the only honest summary: it describes what exists, not what was intended.

The diff is the human's primary review artifact. Write it to `design/DRIFT.html`, one `<section>` per affected node, each item linking to the node it's against and showing the change with `<del>` and `<ins>`:

```html
<section data-node="boundaries/ledger">
  <h2><a href="boundaries/ledger.html">Ledger</a></h2>
  <ul>
    <li>Knows about: <ins>User</ins> (via <code>src/ledger/post.ts:14</code>).
        Design says it must not. See <a href="decisions/ADR-012.html">ADR-012</a>.</li>
  </ul>
</section>
<section data-node="surfaces/ledger">
  <h2><a href="surfaces/ledger.html">Ledger surface</a></h2>
  <ul>
    <li><code>post(entry<ins>, userEmail</ins>)</code> — parameter not in surface spec.</li>
  </ul>
</section>
<section data-node="concepts">
  <h2>Vocabulary</h2>
  <ul>
    <li>New noun <ins>Entry</ins> in <code>src/ledger/</code>. No concept defined. Possibly a synonym for <a href="concepts/posting.html">Posting</a>?</li>
  </ul>
</section>
```

The index reads this file to place drift badges, so `data-node` must match node ids exactly.

Every drift item is resolved in exactly one of two ways: fix the code to match the design, or propose an upward patch to the design (below). Never silently update the design to match the code.

## Escalation

Most implementation decisions are the agent's and stay below the floor. Some are taste decisions in disguise. The rule for which is mechanical, not a judgment call. Escalate — that is, stop and produce a proposed patch to a design file for the human to approve — whenever a change would:

1. Introduce a noun not in `design/concepts/`.
2. Add or remove a module, or change what a module hides.
3. Add an edge to the dependency graph (one module newly knows about another).
4. Change any operation on a module's surface: add, remove, rename, change signature or failure behavior.
5. Change observable behavior described at level 0.
6. Violate an invariant, or require weakening one.

A proposed patch is a diff against the relevant design file plus a draft decision record. The human approves, edits, or vetoes. Do not proceed with the implementation half of the change until the design half is accepted. If blocked and the human is unavailable, do the non-escalating parts of the task and stop.

Everything not on the list is yours. Do not ask about it.

## Instruments

Below the floor, the human sees structure, not text. Regenerate these on every upward pass into `design/instruments/`, each as its own page linked from the index:

- **Dependency graph** (`dependencies.html`): modules as nodes, "knows about" as directed edges, with edges not declared in any boundary page drawn red. Render as inline `<svg>` (Graphviz `dot -Tsvg` if available, otherwise write the graph in a `<pre class="mermaid">` block and load Mermaid from a CDN — this is the one permitted external script). Every node in the SVG links to its boundary page.
- **Knowledge table** (`knowledge.html`): a `<table>`, one row per module, with the count and linked list of concepts and modules it references. Sort by count descending; the top of this table is where leaks live.
- **Vocabulary table** (`vocabulary.html`): every identifier noun in `src/`, linked to its concept or marked undefined. Flag any noun used with two apparent meanings.
- **Surface size** (`surfaces.html`): operations per module, parameters per operation, as a table sorted descending.

Tables are plain `<table>` elements. The stylesheet handles the rest. These are chosen because they can't be flattered: a prose summary can describe a tangled module as "cohesive"; an arrow pointing the wrong way is just wrong.

## Working a task

1. Read `design/intent.html` and the concepts the task touches. If the task is not expressible in the existing vocabulary, that is your first escalation.
2. Find the lowest level at which the task is fully determined. Most tasks are determined at level 3 and need only code.
3. If any level needs to change, work downward from it, writing decision records as you choose.
4. Implement.
5. Run the upward pass. Write the drift report.
6. Resolve every drift item: fix code, or escalate with a proposed patch.
7. Update `pdd-derived` timestamps, regenerate the instruments and `index.html`. Leave nothing stale.

A task is not done while `DRIFT.html` has unresolved items.

## What not to do

- Do not write prose summaries of code for the human to read. Decompile and diff instead.
- Do not update a design file to match code without an approved patch.
- Do not add a level, a node, or a section that records no decision.
- Do not pad design files. Short nodes are regenerable; long ones rot.
- Do not introduce a build step, a framework, a second stylesheet, or any script beyond the graph renderer. If the design can't be read by opening `index.html` from disk, it's broken.
- Do not hand-edit `index.html`, `DRIFT.html`, or anything in `instruments/`. They are projections; regenerate them.
- Do not ask the human about anything below the floor, and do not fail to ask about anything on the escalation list.
- Do not treat the ladder as a sequence to walk once. It is maintained continuously, in both directions.

## Why this shape

The human's advantage is taste about separation, naming, and surfaces. The agent's advantage is volume and consistency. The ladder puts every taste decision at a level the human can read, puts every volume decision below a floor the human never has to cross, and uses the agent's consistency to keep the two honest with each other. The drift report is the point where the two advantages meet.