import { t } from "../../../i18n";

/**
 * Each Quality d6 rule in a line of our own words (#82), for the unit card
 * when the player's list brought no text of its own. Whether the app plays
 * it or reminds the players is the system's (`played`, reminders).
 */
export function qd6RuleLine(id: string): string | undefined {
  switch (id) {
    case "tough":
      return t("Each model takes this many wounds before it falls.");
    case "fearless":
      return t("A failed morale test still passes on a 4+.");
    case "impact":
      return t("As its charge lands, each model makes this many hits on 2+.");
    case "furious":
      return t("Charging, each natural 6 to hit in melee scores one more hit.");
    case "relentless":
      return t('Having held, each natural 6 to hit at over 9" scores one more hit.');
    case "regeneration":
      return t("Ignores each wound on a 5+.");
    case "stealth":
      return t("Shooting at it is -1 to hit (Lock-On ignores this).");
    case "fast":
      return t('Moves 2" further.');
    case "slow":
      return t('Moves 2" less.');
    case "flying":
      return t("Moves over blocking terrain and other units.");
    case "strider":
      return t("Difficult ground doesn't slow it.");
    case "scout":
      return t('Sets up after the other units, then may move up to 12".');
    case "ambush":
      return t('May wait off the table and arrive from round 2, more than 9" from enemies.');
    case "hero":
      return t("May join a friendly unit before the battle: they move and fight as one.");
    default:
      return undefined;
  }
}
