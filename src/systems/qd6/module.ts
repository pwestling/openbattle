import type { GameModule } from "../../sdk";
import type { SystemModule } from "../app";
import { qd6Bot } from "./bot";
import { initiativeHooks } from "./initiative";
import { qd6Layout, QD6_CATEGORIES } from "./layout";
import { meleeActions, meleeFunctions } from "./melee";
import { holdFast } from "./mission";
import { moraleProcedures } from "./morale";
import { importQd6List, readQd6ArmyList } from "./roster";
import { qd6Armies, qd6Sample } from "./sample";
import { qd6 } from "./system";

/** Quality d6: Quality and Defense rolls, one order a go, strike-back fights (system.ts). */
export const qd6Module: GameModule<SystemModule> = {
  id: qd6.id,
  version: qd6.version,
  api: 1,
  system: qd6,
  procedures: moraleProcedures,
  functions: meleeFunctions,
  actions: meleeActions,
  hooks: initiativeHooks,
  bot: qd6Bot,
  app: {
    sample: qd6Sample,
    armies: qd6Armies(),
    // A JSON or text list the player brings, read on their device (roster.ts).
    importRoster: importQd6List,
    // Army list v1 files opened from a link or the shelf: Tough(X) gives Wounds.
    readArmyList: readQd6ArmyList,
    layout: (t) => qd6Layout(t.width, t.depth),
    templateCategory: QD6_CATEGORIES,
    missions: [holdFast()],
  },
};
