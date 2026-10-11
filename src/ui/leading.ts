import type { GameState, Unit } from "../core";
import { aliveModels, unitDistance } from "../systems/wh40k/rules";

/** Unit names listed by a Leader ability ("can be attached to the following units: ..."). */
export function leaderOf(unit: Unit): string[] {
  const text = unit.sheet?.abilities.find((a) => /^leader\b/i.test(a.name))?.text ?? "";
  const list = text.split(/following units?:/i)[1];
  if (!list) return [];
  return list
    .split(/[■•\n,]/)
    .map((s) => s.replace(/\*/g, "").trim())
    .filter((s) => s && s.length < 60 && !/^this model/i.test(s));
}

/** How near (edge to edge) a leader stands to the unit it was set up to lead. */
const STANDING_WITH = 2;

/** Whether a unit can lead another (a Leader ability on its sheet). */
export const isLeader = (u: Unit) => !!u.sheet?.abilities.some((a) => /^leader\b/i.test(a.name));

/** A unit already led, or a leader already leading: merged, so it's neither offered nor offered to. */
const joined = (u: Unit) => !!u.joined?.length || !!u.status?.attached;

/**
 * Whether `leader` can lead `body`: the units its Leader ability names when
 * it names any, else any squad that isn't a vehicle, a monster or a character.
 */
function canLead(leader: Unit, body: Unit): boolean {
  if (isLeader(body) || joined(body) || body.status?.reserves) return false;
  const names = leaderOf(leader).map((n) => n.toLowerCase());
  if (names.length) return names.some((n) => body.name.toLowerCase().startsWith(n));
  const kw = (body.sheet?.keywords ?? []).map((k) => k.toLowerCase());
  return !kw.some((k) => k === "vehicle" || k === "monster" || k === "character");
}

/**
 * Before the battle, the unit a leader stands with (within 2" of it) and can
 * lead: the one its Leader ability names first, else the nearest. None when
 * it stands alone, or is already leading one (PX D1, UX ui-next lead fix).
 */
export function standingWith(game: GameState, unit: Unit): Unit | undefined {
  if (game.turn.round > 0 || !isLeader(unit) || joined(unit) || unit.status?.reserves) return undefined;
  const names = leaderOf(unit).map((n) => n.toLowerCase());
  const mine = aliveModels(game, unit);
  return Object.values(game.units)
    .filter((u) => u.owner === unit.owner && u.id !== unit.id && canLead(unit, u))
    .map((u) => ({ u, d: unitDistance(mine, aliveModels(game, u)) }))
    .filter((x) => x.d <= STANDING_WITH)
    .sort(
      (a, b) =>
        Number(names.some((n) => b.u.name.toLowerCase().startsWith(n))) -
          Number(names.some((n) => a.u.name.toLowerCase().startsWith(n))) || a.d - b.d,
    )[0]?.u;
}

/** Every leader of `owner` standing with a squad it can lead, one leader to a squad. */
export function leadPairs(game: GameState, owner: string): { leader: Unit; near: Unit }[] {
  const taken = new Set<string>();
  const out: { leader: Unit; near: Unit }[] = [];
  for (const u of Object.values(game.units)) {
    if (u.owner !== owner) continue;
    const near = standingWith(game, u);
    if (!near || taken.has(near.id)) continue;
    taken.add(near.id);
    out.push({ leader: u, near });
  }
  return out;
}
