import { namespacedId, unitAdd } from "../../../src/sdk/authoring";
import type { Macro, QuantityDef } from "../../../src/sdk";

export const quantities: QuantityDef[] = [
  { id: "energy", name: "Energy", on: "unit", initial: 2 },
  { id: "hp", name: "Hit points", on: "model", initial: 3 },
];

/** IDs depend only on the system, entity kind and recorded participant ID. */
export const muster: Macro = function* (ctx, args) {
  if (typeof args.by !== "string" || !ctx.view.state.players[args.by])
    throw new Error("Muster needs a recorded participant");
  const player = args.by;
  const unitId = namespacedId("lantern-game", "unit", player);
  const modelId = namespacedId("lantern-game", "model", player);
  if (ctx.view.state.units[unitId]) {
    if (!(yield* ctx.warn(player, "Mustering again replaces your lantern and its starting quantities.")))
      return;
  }

  // Defaults become ordinary entity data in unit/add, not implicit reducer state.
  yield ctx.emit(
    unitAdd(quantities, { id: unitId, owner: player, name: "Lantern Keeper", modelIds: [modelId] }, [
      {
        id: modelId,
        owner: player,
        label: "Lantern Bearer",
        unitId,
        position: { x: 0, y: 0 },
        facing: 0,
        base: { shape: "round", diameterMm: 30 },
      },
    ]),
  );

  // The host can reconstruct the generator from recorded commands at this point.
  const answer = yield ctx.input(player, "How brightly should the lantern shine?", {
    kind: "number",
    min: 0,
    max: 10,
  });
  if (typeof answer !== "number") throw new Error("The lantern answer must be a number");
  yield ctx.set("answer", answer);
};
