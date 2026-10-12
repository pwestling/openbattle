import { aliveModels, stateAt, undoneSeqs, type GameRecord, type GameState, type PlayerId } from "../core";
import { formatList, t, tn } from "../i18n";
import { displayName } from "../i18n/names";

/**
 * One line for the step bar on what just happened out of your hands (naive players 6): your last
 * attack's result, and what the other side did since, until you do the next thing. "Your Lance
 * Team shot Cinder Brutes: 2 slain. Rook moved 3 units and attacked Line Troopers."
 */
export function recapLine(record: GameRecord, game: GameState, mine: PlayerId[]): string | null {
  if (!mine.length) return null;
  const undone = undoneSeqs(record);
  const events = record.events.filter((e) => !undone.has(e.seq) && e.event.type !== "undo");
  // The other side's run of events since your last one: none means you've moved on.
  let i = events.length;
  while (i > 0 && !mine.includes(events[i - 1]!.by ?? "")) i--;
  const theirs = events.slice(i).filter((e) => !!e.by && !!game.players[e.by]);
  if (!theirs.length) return null;
  const parts: string[] = [];

  // Your last attack, if your own run of events just before theirs had one: what it did.
  let j = i;
  while (j > 0 && mine.includes(events[j - 1]!.by ?? "")) j--;
  const yours = events.slice(j, i);
  const declared = [...yours]
    .reverse()
    .find((e) => e.event.type === "attack/declare" || (e.event.type === "action/take" && !!e.event.targetId));
  if (declared) {
    const target =
      declared.event.type === "attack/declare"
        ? declared.event.attack.spec.targetUnitId
        : declared.event.type === "action/take"
          ? declared.event.targetId
          : undefined;
    const attacker =
      declared.event.type === "attack/declare"
        ? declared.event.attack.spec.attackerUnitId
        : declared.event.type === "action/take"
          ? declared.event.unitId
          : undefined;
    const before = stateAt(record, declared.seq);
    const after = stateAt(record, events[i - 1]!.seq);
    const unit = target ? before.units[target] : undefined;
    const by = attacker ? before.units[attacker] : undefined;
    if (unit && by) {
      const lost = aliveModels(before, unit).length - aliveModels(after, after.units[unit.id] ?? unit).length;
      parts.push(
        lost > 0
          ? tn(lost, "Your {unit} hit {target}: {n} slain.", "Your {unit} hit {target}: {n} slain.", {
              unit: by.name,
              target: unit.name,
            })
          : t("Your {unit} attacked {target}: no losses.", { unit: by.name, target: unit.name }),
      );
    }
  }

  // What the other side did: units moved, and whom they attacked.
  const who = displayName(game.players[theirs[0]!.by!]?.name ?? "");
  const moved = new Set<string>();
  const hit = new Set<string>();
  for (const e of theirs) {
    const ev = e.event;
    if (ev.type === "models/move" && !ev.setup)
      for (const m of ev.moves) {
        const u = game.models[m.id]?.unitId;
        if (u) moved.add(u);
      }
    else if (ev.type === "model/move") {
      const u = game.models[ev.id]?.unitId;
      if (u) moved.add(u);
    } else if (ev.type === "attack/declare") hit.add(ev.attack.spec.targetUnitId);
    else if (ev.type === "action/take" && ev.targetId) hit.add(ev.targetId);
  }
  const names = [...hit].map((id) => game.units[id]?.name).filter((n): n is string => !!n);
  if (moved.size && names.length)
    parts.push(
      tn(
        moved.size,
        "{name} moved {n} unit and attacked {targets}.",
        "{name} moved {n} units and attacked {targets}.",
        {
          name: who,
          targets: formatList(names),
        },
      ),
    );
  else if (moved.size)
    parts.push(tn(moved.size, "{name} moved {n} unit.", "{name} moved {n} units.", { name: who }));
  else if (names.length)
    parts.push(t("{name} attacked {targets}.", { name: who, targets: formatList(names) }));
  return parts.length ? parts.join(" ") : null;
}
