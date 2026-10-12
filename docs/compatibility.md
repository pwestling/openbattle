# Compatibility

Anyone can change Open Battle: fork it, write a rules package, run a modified build. This page says how those changes live side by side without splitting the players or making ranked games unfair. The short version: **a casual table plays whatever its players agree to, and a ranked game counts only on the ladder for the exact rules it was played under.**

Every format and protocol others can build on (files, links, peer messages, server APIs, packages) is listed with its version, spec, schema and conformance files in [protocols/](protocols/README.md). This page is about how builds and packages that differ play together.

## The four layers

Every game runs on four layers of code. Each has its own identity and its own rule for what happens when two players differ.

| Layer       | What it covers                                 | Identified by                                                    | Players differ, casual game                              | Players differ, ranked game                |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Protocol    | The shape of events, intents and peer messages | `PROTOCOL` in `src/protocol.ts`                                  | A red banner: the tables can't stay in step. Both reload | The same                                   |
| App build   | The reducer                                    | The release version and commit (`APP_BUILD` in `src/version.ts`) | A banner naming both builds; play on                     | The host's build is recorded in the result |
| Game module | A package that is a whole game                 | The module id, and the package's SHA-256                         | Every player gets the host's package, checked by hash    | n/a                                        |
| Extensions  | House rules added to a game                    | The SHA-256 of each file                                         | Each player agrees to each package once                  | n/a                                        |

Peers tell each other their protocol and build when they meet (`hello` and `host` messages in `src/net/transport.ts`). Builds from before this check don't send it and are taken to be compatible.

## Shared dice

Two players with ranked keys (`ranked/card`, `src/core/ranked.ts`) can roll fairly: no one device decides a roll (`src/core/sharedDice.ts`):

1. The host commits to a secret seed (its SHA-256) in the log.
2. The other player answers with a seed of their own, in the clear.
3. Each event's dice come from both seeds and the event's number, and the log keeps the intent each event came from.
4. The host reveals its seed and commits to the next; the other player rolls the stretch's events again from the log and checks they come out the same.

A macro step's dice are checked by the seed its sandbox was given; running the module again to check its output is still to do. A host that leaves or reloads starts a new commitment, and the stretch it never revealed is counted as unchecked. What's left: once both seeds are in, the host knows the stretch's dice, so a modified host could see a roll coming. Answering each roll with a fresh seed from the other player would close that, at the cost of a message per roll.

Result signing and ladders (worked out from a game's rules and score) are gone with the old rules engine; they return when a module can say what a result is.

## Promises for package authors

- A package's `id` names it for good: keep it across versions. Saved games, campaign books and ladders refer to it.
- Use semver in `version`: patch for fixes, minor for new rules, major when an existing game would play differently.
- `api` is the module API version (`MODULE_API` in `src/sdk/index.ts`, now 2). A change to `src/sdk` that existing packages would notice raises it, and the app refuses packages for another version by name, with the reason.
- Every byte change is a new hash, so every player is asked again.

## Promises for forks

The code is MIT; fork freely. A fork marks its version with a prerelease tag (`0.1.0-<name>` in `package.json`), so its build string names it. If it keeps `PROTOCOL` unchanged and plays by it, it can join Open Battle tables. A fork that changes the protocol must change `PROTOCOL`, so players see a clear "can't play together" message instead of a table that drifts. See [GOVERNANCE.md](../GOVERNANCE.md#the-open-battle-name) for when a fork should use its own name.

## Shared servers

Every server the app talks to is open source and lives in this repository (`server/`): the signalling relay and the TURN login service. Anyone can run their own with the [self-host kit](self-host.md).

## Changing any of this

Changes to the protocol or the module API need a proposal first. See [GOVERNANCE.md](../GOVERNANCE.md#changes-that-need-a-proposal).
