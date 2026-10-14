// An invented supplies action for Ember Skirmish. Load alongside its required game.
// Its command-point effect is public; its grant counter belongs only to this extension.
export const manifest = {
  id: "example.ember-supplies",
  name: "Ember Supplies (example)",
  version: "1.0.0",
  author: "Open Battle examples",
  api: 12,
  kind: "extension",
  systems: ["ember-skirmish"],
  requires: [{ id: "example.ember-skirmish" }],
  adds: "Adds a player supplies action granting one command point, with an independent extension-owned grant counter shown in its button label.",
};

export default {
  api: 12,
  id: "example.ember-supplies",
  name: "Ember Supplies",
  version: "1.0.0",
  actions: [
    {
      id: "example.ember-supplies:grant",
      name: "Grant supplies",
      by: "player",
      applies: (view, actor) => !!view.state.players[actor.player],
      available: () => true,
      label: (view) => `Grant supplies (+1 command point; ${view.own.grants ?? 0} grants so far)`,
      run: function* (ctx, args) {
        const player = ctx.view.state.players[args.by];
        if (!player) throw new Error("Supplies need a participating player");
        const grants = ctx.view.own.grants ?? 0;
        yield ctx.emit({ type: "q/adjust", ref: { kind: "player", id: player.id }, key: "cp", delta: 1 });
        yield ctx.set("grants", grants + 1);
        yield ctx.note(`${player.name} receives supplies`);
      },
    },
  ],
};
