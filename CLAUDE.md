@AGENTS.md

## Agent notes (below the floor)

- `design/` is the human's view of the project; follow PROJECTION.md for every change.
- Regenerate the projections (`design/index.html`, `design/DRIFT.html`) with `node tools/pdd.mjs`. Never hand-edit them.
- The design is also published as an artifact, https://claude.ai/artifact/4f6HiTgwbjDm8WWMZLWhsv: run `node tools/pdd.mjs --artifact <scratch file>` and republish that file with every page under `design/` as supporting files.
- Attempt 1 is in git history at `1b491c5`. Use it as evidence, not as code to copy.
- No unit tests (ADR-018). Every behaviour in the intent is proven from the outside: checks that drive the real app in real browsers as a person would. A task is done when its proof passes. Proofs are never deleted or skipped to make progress.
- Limits only protect the relay server or stop a game from crashing (ADR-020). Otherwise leave the limit off and suggest it to Porter with the reason.
