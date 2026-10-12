# Changelog

What changed in each release of Open Battle. The in-app **What's new** on the start page shows the highlights; this file has the whole list.

## Unreleased

- **A new layout, built from scratch.** One step bar at the bottom says what to do now and lights the one thing to press next. The front door is a column-by-column flow, setup is a checklist, and the end of the battle shows the result first. The old layout is still there: add `?ui=classic` to the address, or pick "Classic layout" at the front door.
- **Your dice roll only when you press Roll.** Nothing rolls by itself on a timer, and the "Roll my saves for me" and "Always in one go" ticks are gone. The computer still rolls its own dice.
- **A charge made by dragging counts as a charge.** Rolling the charge and dragging the unit into contact now marks it as having charged, so it fights first and "after charging" abilities and stratagems see it.
- **Shooting at a friend goes quicker.** When someone shoots your unit with several weapons, your screen says so ("Ana is shooting your Ember Kin with 3 weapons", then which weapon it's on), and you roll your saves when you're ready.
- **Quality d6 on the unit card.** A unit's order for its go is one choice (Hold, Advance, Rush or Charge, each saying what it does and how far), and a Shaken unit's only choice is Rally. Shaken and Fatigued show as badges with what they mean, and each rule from the list is a chip that explains itself and says whether the app plays it. Before the battle a Hero can join a unit and an Ambush unit can wait off the table, then arrive on its go. A round panel shows the units each side has left, who goes first next round and how the last fight went. A sniper's shooter picks the model hit on the attack panel.
- **Armies from packages, everywhere you pick an army.** One picker holds the game's sample armies and each package's, under the package's name. Against the computer, or with both sides on one screen, the front door offers the armies of packages you trust, and the package comes on with the army. A mission a package added says which package, the consent sheet says which armies a package brings (and which it can't read), and a list that names a pack offers to load it.
- **Routine rolls are quicker.** Only a roll that could decide something gets the full show; the others land in about a second.
- **Formats and protocols with a promise.** Every file, link, peer message, package and server API Open Battle uses now has a versioned spec in [docs/protocols](docs/protocols/README.md), a JSON Schema in `schemas/` generated from the code, and frozen conformance files in `conformance/` that other tools and forks can test against. A file from a newer version says so instead of failing to open.
- **Version 0.2 can't share a table with 0.1.** Reaction windows and simultaneous phases added new events, so the peer protocol is now 2 ([history](docs/protocols/peer-protocol.md#history)). Both players need the same version.
- **Packages bring armies and missions.** An extension package can carry sample armies as Army list v1 documents (`export const armies`, read as data, never run) and missions for the game it extends. Its armies are offered beside the game's own samples, labelled with the package, and go on the army shelf in one click; its missions join the game's at setup. See [docs/protocols/packages.md](docs/protocols/packages.md) and the example `examples/packages/border-muster.js`.
- **The table stays still.** Models no longer lift, lean, drop or squash when you move them, the move label no longer pulses or ticks near your limit, and the other player's moves snap into place with their trail. A charge no longer slams in or nudges the camera; its "Charged 7"" note fades in beside the unit. The battle starts with three seconds of army cards over the still table, with the panels up. While the dice roll, pressing a button on the panel lands them at once. Dice and casualties keep their animation, and a fallen model never takes your click.
- **Ladders keep different rules apart.** A ranked result now records the rules it was played under (the app build and every rules package, by hash), and both players check and sign them. Named seasons in `rulesets.json` share a ladder; any other rules, a house rule or a modded copy of a game, get a ladder of their own. See [docs/compatibility.md](docs/compatibility.md).
- **Shared dice in ranked games.** No one device decides a roll: the host commits to a secret seed, the opponent adds one, and each round's dice are checked once the host's seed is shown. A result whose dice don't check out can't be signed.
- **No farming the ladder.** A rating moves only against an opponent who has played five games against three different players.
- **Different versions at one table.** Players' apps say which version they run when they meet, and a banner names both when they differ. A player whose version can't share the table is kept out of the game rather than shown a table that drifts.
- **The board checks signatures.** A self-hosted board keeps a ranked result only if both signatures hold, and answers under `/v1`. Its protocol is in [docs/board-protocol.md](docs/board-protocol.md).
- **Stratagems as a hand of cards.** Drag a card onto a unit to play it, or click it and then the unit. A card the rules say no to asks "Play it anyway?", and the log says it was played anyway. After a roll with failed dice, a re-roll card pops up by the dice ("Re-roll a 2? · 1 CP") and re-rolls just that die.
- **Charge by dragging.** In the Charge phase, drag your unit onto an enemy: the tag says how far it is and what the 2D6 needs, and letting go declares the charge instead of moving there.
- **Leaders and reserves by dragging.** Before the battle, drag a leader onto a unit to have it lead the unit, and drag a unit that can deep strike off the table to put it into reserves. In the battle, drag it from reserves onto the table to bring it on.
- **Keys at the table.** Hold X to see through terrain, N to show every unit's name and L to look from a unit's eyes; let go and the view comes back. With your unit picked, S shoots, A advances, C charges and F fights, each in its own phase. Hover an objective to see who controls it and the OC on each side.
- **Weekly-game fixes.** A Tabletop Simulator save's objective markers are the game's objectives, and the import says so. A table that brings its own mission deck hides the built-in secret missions. A player following an invite link is asked their name before joining, so the log never says "Player 2" all evening.
- **Roll the dice yourself.** Under 🔊, hold to shake your dice in the tray and let go to throw them, or roll real dice and tap in the faces. Other players see "Ana is shaking…" while you shake.
- **For contributors.** [GOVERNANCE.md](GOVERNANCE.md), a code of conduct, a security policy, a pull request template, [docs/compatibility.md](docs/compatibility.md), and [CLAUDE.md](CLAUDE.md) with Claude Code skills for writing packages and modules, checking for publisher IP, verifying a change and drafting a proposal, and a Proposal issue form.

## 0.1.0 (2026-10-10)

The first release: a complete tabletop for miniatures wargames in the browser, peer to peer, with four game systems and two games of our own built in.

### Play

- **Rift Lanterns, our own game.** An original skirmish game that ships with the app (CC BY 4.0): four warbands with their own stand-in figures, silhouettes and colours, three missions scored in the top bar, glowing lanterns that take the holder's colour and ring when they change hands, and a starter table with open firing lanes. Play now from the start page, nothing to import. Its rules page is made from the game's own module, so it never drifts from what the app plays, and **Print and play** makes an A4 or US Letter PDF in the browser: the rules, a card per unit with wound boxes, lantern and wound tokens, round and VP tracks, rulers, a quick-reference card, and fold-over stand-in figures with bases at true size. The table companion knows it too: players say what they see, the phone keeps the score.
- **Four game systems built in.** A squad-based sci-fi battle game in phases, a rank-and-flank fantasy game with regiment blocks, magic and psychology, Conquest-style regiments with a secret command stack, and Full Spectrum Dominance with activation dice, areas of control, reactions and support cards. Each has a made-up sample army and a one-click demo.
- **A 3D table with a top-down view.** Drag units with live distance, coherency and engagement range; ranked blocks wheel, reform, turn and march.
- **True and abstract line of sight.** Traced from each model's eyes against terrain and models, or with stand-in heights for games that use them. Cover, hidden units and higher ground come from the same check.
- **Attack automation.** Pick a weapon and a target; the panel works out who is in range and what to roll, and every number can be changed. Abilities that play themselves for the sci-fi game's common rules.
- **Brinewatch, our second game.** A CC BY skirmish game of action points, climbing and close quarters, written as a workshop package and played with Play now like Rift Lanterns.
- **Play the computer.** Steady and Sharp opponents that try each move on a copy of the table with the dice rolled; Sharp plans whole turns and weighs the enemy's answer. Bring your own army or a sample one, in every built-in game.
- **Real rosters beyond the sci-fi game.** Old World, Conquest and Full Spectrum Dominance rosters import, and their universal special rules play themselves. Faction rules (detachment, enhancements, stratagems) come from the roster.
- **Teach it this rule.** A no-code rule builder for abilities the app doesn't know yet, kept with the army on the shelf.
- **Your painted army on the table.** Photograph your figures with a phone; the app cuts them out and stands them on the table as photo standees, shared with your opponent.
- **Tablet touch play.** Drag, rotate, measure and pick on a touch screen.
- **Advisory rules.** The app measures, rolls and reminds, and the table warnings panel lists every check, but nothing is ever blocked. Undo takes back a whole action.
- **Missions and secrets.** Missions with suggested scores a player confirms; secret objectives and hidden orders committed on their owner's device and revealed with proof they weren't changed.

### Together

- **Online, 1v1 or 2v2.** Host a room and send the link. Others join, watch, or take over as host. Teams of two share CP and VP.
- **Open tables and Live now.** A public board of games looking for players, and any public game to watch as it happens.
- **Online events.** Swiss rounds with no server: the organiser's browser pairs the rounds, and players sign their results.
- **Player cards and ranked games.** A card with your record, and ranked games both players sign.
- **Table talk and voice.** Pings, arrows, areas, chat and reactions, plus push-to-talk or open-mic voice over the same peer connections.
- **Table companion.** Play on a real table with real models: the phone keeps the game, takes your own dice ("A phone each" or "One phone for both of us"), and asks what it can't see, such as models in range and cover.
- **Play by mail.** A game across days with signed turn files, commit-reveal dice and an optional mailbox on the self-host kit.
- **Chess clocks and event nights.** Time limits worked out from the game log; Swiss rounds in the campaign book.
- **Campaign book.** A shared, hashed book of games with a league table, a map and unit stories, and campaign rules as packages.
- **Broadcast view.** A stream view with a commentator camera, a spectator delay and end-of-game moment cards.

### After the game

- **Replays and "What if".** Scrub back through any game, download it as a replay file, or branch a new game from any moment.
- **Game review.** The computer goes over a finished game, scores each decision, and shows the better move with how sure it is.
- **Annotated replays.** Notes and marks on moments, chapters, and review rooms where a coach leads and others follow.
- **Battle stats.** Dice luck, the biggest swing of each round, and calls for the rolls of a lifetime.
- **Share the battle.** Download a replay as one web page that opens in any browser, even offline; record a clip of the highlights reel or any stretch with the dice in frame; save end-of-game and round cards sized for posting.

### Your stuff

- **Army import.** BattleScribe and New Recruit rosters, with missing stats filled in by players. Save armies to the army shelf.
- **Figures and terrain.** Drop 3D models onto units, keep a figure library, upload terrain models, and build tables in the terrain editor with saved and starter tables.
- **Rules packages.** Sandboxed packages that add rules or a whole new game, shared peer to peer and checked by hash.

### For everyone

- **Learn to play.** A guided first game for each system against the computer, with a coach.
- **Front door.** Try it now demos, army guides, a "What can I do now?" hint and a controls sheet.
- **Translations.** The whole interface in German and French (machine drafts, open for review), with game words translated.
- **Accessibility.** Keyboard play, text size, colour-blind side colours with shapes, and a screen-reader announcer.
- **Install and play offline.** The app keeps itself on the device; games on one screen, lessons, replays and saved things work without a network.
- **Dice that feel good.** A felt dice tray with sound, your own dice colours and finishes, an army showcase at battle start, and table ambience.

### For hosts and contributors

- **Module workshop.** Write a game system in the browser from a template, checked against the SDK's types as you type, play it on a test table that reloads on every save, soak it with the bot, and export it as a package or for the community modules gallery. **Check** gives one verdict: types, loading and a short bot game.
- **Self-host kit.** Docker Compose with the app, a signalling relay and a TURN server.
- **Playtest kit.** Report a problem bundles a replay with the errors; a crash screen and a connection check.
- **Tests.** Unit tests, a soak bot playing seeded games every night, and browser smoke tests through each way into the app.
