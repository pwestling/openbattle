@AGENTS.md

## Agent notes (below the floor)

- `design/` is the human's view of the project; follow PROJECTION.md for every change.
- Regenerate the projections (`design/index.html`, `design/DRIFT.html`) with `node tools/pdd.mjs`. Never hand-edit them.
- The design is also published as an artifact, https://claude.ai/artifact/4f6HiTgwbjDm8WWMZLWhsv: run `node tools/pdd.mjs --artifact <scratch file>` and republish that file with every page under `design/` as supporting files.
- Attempt 1 is in git history at `1b491c5`. Use it as evidence, not as code to copy.
- Tests are never deleted or skipped to make progress.
