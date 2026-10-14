import { namespacedId } from "../../../src/sdk/authoring";
import type { ModuleDef } from "../../../src/sdk";
import { muster, quantities } from "./muster";

// Build-time local imports are bundled away; load only the generated JavaScript.
// Keep this manifest a literal so the builder and package loader can read it as data.
export const manifest = {
  id: "example.lantern-game",
  name: "Lantern Game (typed example)",
  version: "1.0.0",
  author: "Open Battle examples",
  api: 12,
  kind: "system",
  systems: ["lantern-game"],
  requires: [],
  adds: "An invented lantern muster demonstrating typed local helpers, recorded starting quantities, a structured number input and a resumable macro.",
};

const game: ModuleDef = {
  id: "lantern-game",
  name: "Lantern Game",
  version: "1.0.0",
  api: 12,
  table: { width: 24, depth: 24 },
  quantities,
  actions: [
    {
      id: "muster",
      name: "Muster a lantern",
      by: "player",
      available(view, actor) {
        return view.state.units[namespacedId("lantern-game", "unit", actor.player)]
          ? "Your lantern is already mustered; mustering again replaces its starting quantities."
          : true;
      },
      run: muster,
    },
  ],
  panel(view) {
    return {
      title: "Lantern Game",
      lines: [
        `Lantern units: ${Object.keys(view.state.units).length}`,
        `Chosen brightness: ${view.own.answer ?? "not chosen"}`,
      ],
    };
  },
};

export default game;
