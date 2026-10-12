// Ember Skirmish: a small invented game that uses every part of the module
// API once, to build on and to check the core with. Two sides muster a few
// models and take turns through three phases (order, move, strike). It is
// plain JavaScript with no imports, loaded as it is (see docs/packages.md).
//
// What a module is: the core knows only physical things (units of models,
// tokens, terrain, decks, hidden values, dice, a pointer saying where the game
// is up to). A module registers the quantities its entities carry, the phases
// the pointer moves through, and actions that are shorthand for collections of
// the core's primitive events. Its macros only run on the host; what they
// emit becomes ordinary events in the log.

export const manifest = {
  id: "example.ember-skirmish",
  name: "Ember Skirmish (example)",
  version: "1.0.0",
  author: "Open Battle examples",
  api: 2,
  kind: "system",
  systems: ["ember-skirmish"],
  requires: [],
  adds: "A small invented game: muster, order, move, strike. Exercises quantities, modifiers, the pointer, a hook, a secret and a question.",
};

const PHASES = ["order", "move", "strike"];
const unitRef = (id) => ({ kind: "unit", id });
const playerRef = (id) => ({ kind: "player", id });

/** The seat whose turn it is, as a player. */
function activePlayer(view) {
  return Object.values(view.state.players).find((p) => p.seat === view.pointer.seat);
}

/** Next phase: the pointer moves, a new turn gives its player a command point. */
function* advance(ctx) {
  const view = ctx.view;
  const p = view.pointer;
  const at = PHASES.indexOf(p.phase);
  let next;
  if (at === -1) next = { round: 1, seat: 0, phase: "order", n: 1 };
  else if (at < PHASES.length - 1) next = { ...p, phase: PHASES[at + 1], n: (p.n || 0) + 1 };
  else {
    const seat = 1 - p.seat;
    next = { round: seat === 0 ? p.round + 1 : p.round, seat, phase: "order", n: (p.n || 0) + 1 };
  }
  yield ctx.emit({ type: "pointer/set", pointer: next });
  const who = Object.values(view.state.players).find((pl) => pl.seat === next.seat);
  if (next.phase === "order" && who)
    yield ctx.emit({ type: "q/adjust", ref: playerRef(who.id), key: "cp", delta: 1 });
  yield ctx.note(`Round ${next.round}, ${next.phase}`);
}

/** Put the starting player's three models on the table (`args.by` is who started the macro). */
function* muster(ctx, args) {
  const view = ctx.view;
  const player = view.state.players[args.by];
  if (!player) return;
  const y = player.seat === 0 ? 8 : -8;
  const id = `${player.id}-embers`;
  const models = [0, 1, 2].map((i) => ({
    id: `${id}-${i}`,
    owner: player.id,
    label: `Ember ${i + 1}`,
    position: { x: (i - 1) * 3, y },
    facing: player.seat === 0 ? Math.PI : 0,
    base: { shape: "round", diameterMm: 32 },
  }));
  yield ctx.emit({
    type: "unit/add",
    unit: {
      id,
      owner: player.id,
      name: `${player.name}'s embers`,
      modelIds: [],
      q: { hp: 3, edge: 0, moved: 0 },
    },
    models,
  });
  yield ctx.note(`${player.name} musters`);
}

/** A strike: the defender chooses how to meet it, then the dice say. */
function* strike(ctx, args) {
  const me = ctx.view.state.units[args.unit];
  const them = ctx.view.state.units[args.target];
  if (!me || !them) return;
  const stance = yield ctx.ask(them.owner, `${me.name} strikes ${them.name}. Guard or dodge?`, [
    { id: "guard", label: "Guard: harder to hit" },
    { id: "dodge", label: "Dodge: hit less often, hurt more" },
  ]);
  // After the answer the view is the table as it is now, whatever moved while the question stood.
  const edge = ctx.view.q(unitRef(me.id), "edge");
  const range = ctx.view.distance(me.id, them.id);
  const rolled = yield ctx.roll("2D6", "strike");
  const need = 7 + (stance === "guard" ? 1 : 0) + (range > 6 ? 1 : 0) - edge;
  const hit = rolled.total >= need;
  yield ctx.note(
    `${me.name} rolls ${rolled.total} at range ${range} (needs ${need}) and ${hit ? "hits" : "misses"}`,
  );
  if (!hit) return;
  yield ctx.emit({ type: "q/adjust", ref: unitRef(them.id), key: "hp", delta: stance === "dodge" ? -2 : -1 });
  if (ctx.view.q(unitRef(them.id), "hp") <= 0) {
    for (const id of them.modelIds)
      yield ctx.emit({ type: "entity/set", ref: { kind: "model", id }, set: { off: true } });
    yield ctx.note(`${them.name} are out`);
  }
  // A modifier that lasts while the pointer's step counter stays as it is: to the end of this phase.
  const n = ctx.view.until("n");
  yield ctx.emit({
    type: "mod/add",
    mod: {
      id: `edge-${me.id}-${String(n.is)}`,
      target: unitRef(me.id),
      q: "edge",
      op: "add",
      value: 1,
      source: "strike",
      until: n,
    },
  });
}

/** Choose a stance in secret: only a commitment goes on the table. */
function* hide(ctx, args) {
  const unit = ctx.view.state.units[args.unit];
  if (!unit) return;
  yield ctx.secret(unit.owner, `stance:${unit.id}`, `Hidden stance for ${unit.name}`, [
    { id: "hold", label: "Hold" },
    { id: "rush", label: "Rush" },
  ]);
  yield ctx.note(`${unit.name} have a hidden stance`);
}

/** Show it: everyone checks the value against the commitment. */
function* show(ctx, args) {
  const unit = ctx.view.state.units[args.unit];
  if (!unit) return;
  const stance = yield ctx.reveal(unit.owner, `stance:${unit.id}`);
  yield ctx.note(`${unit.name} reveal "${stance}"`);
  if (stance === "rush") {
    const n = ctx.view.until("n");
    yield ctx.emit({
      type: "mod/add",
      mod: {
        id: `rush-${unit.id}-${String(n.is)}`,
        target: unitRef(unit.id),
        q: "edge",
        op: "add",
        value: 2,
        source: "rush",
        until: n,
      },
    });
  }
}

/** Hook: after any logged move, count it on the unit that moved. */
function* countMove(ctx, args) {
  const event = args.event;
  if (event.setup) return;
  const model = ctx.view.state.models[event.moves[0].id];
  if (!model || !model.unitId) return;
  yield ctx.emit({ type: "q/adjust", ref: unitRef(model.unitId), key: "moved", delta: 1 });
}

const enemiesNear = (view, actor) => {
  const me = actor.unitId;
  return Object.values(view.state.units)
    .filter((u) => u.owner !== actor.player && view.units().some((v) => v.id === u.id))
    .map((u) => ({ unitId: u.id, label: `${u.name} (${view.distance(me, u.id)}")` }));
};

const myTurn = (view, actor) => {
  const me = view.state.players[actor.player];
  return me && me.seat === view.pointer.seat ? true : "Not your turn";
};

export default {
  api: 2,
  id: "ember-skirmish",
  name: "Ember Skirmish",
  version: "1.0.0",
  table: { width: 36, depth: 24 },
  layout: () => ({
    terrain: [],
    tokens: [{ id: "beacon", kind: "objective", position: { x: 0, y: 0 }, label: "Beacon" }],
    zones: [
      {
        seat: 0,
        points: [
          { x: -18, y: 12 },
          { x: 18, y: 12 },
          { x: 18, y: 6 },
          { x: -18, y: 6 },
        ],
      },
      {
        seat: 1,
        points: [
          { x: -18, y: -12 },
          { x: 18, y: -12 },
          { x: 18, y: -6 },
          { x: -18, y: -6 },
        ],
      },
    ],
  }),
  quantities: [
    { id: "hp", name: "Hit points", on: "unit", initial: 3 },
    { id: "edge", name: "Edge", on: "unit", initial: 0, hint: "Added to a strike's roll" },
    { id: "moved", name: "Moves", on: "unit", initial: 0 },
    { id: "cp", name: "Command points", on: "player", initial: 0 },
  ],
  pointer: [
    { id: "order", name: "Order" },
    { id: "move", name: "Move" },
    { id: "strike", name: "Strike" },
  ],
  macros: { advance },
  actions: [
    { id: "advance", name: "Next phase", by: "player", available: () => true, run: advance },
    {
      id: "muster",
      name: "Muster",
      by: "player",
      available: (view, actor) =>
        view.pointer.round === 0 && !view.units(actor.player).length ? true : "Already mustered",
      run: muster,
    },
    {
      id: "strike",
      name: "Strike",
      by: "unit",
      phases: ["strike"],
      available: (view, actor) => myTurn(view, actor),
      targets: enemiesNear,
      run: strike,
    },
    {
      id: "hide",
      name: "Hide a stance",
      by: "unit",
      phases: ["order"],
      available: (view, actor) =>
        view.state.secrets?.[actor.player]?.[`stance:${actor.unitId}`]
          ? "Already hidden"
          : myTurn(view, actor),
      run: hide,
    },
    {
      id: "show",
      name: "Show the stance",
      by: "unit",
      phases: ["strike"],
      available: (view, actor) => {
        const s = view.state.secrets?.[actor.player]?.[`stance:${actor.unitId}`];
        return s && !s.revealed ? true : "Nothing hidden";
      },
      run: show,
    },
  ],
  hooks: { on: { "models/move": countMove } },
  panel: (view) => ({
    title: "Ember Skirmish",
    lines: [
      `Round ${view.pointer.round}, ${view.pointer.phase ?? "not started"}`,
      `Turn: ${activePlayer(view)?.name ?? "nobody yet"}`,
    ],
    buttons: [{ label: "Next phase", macro: "advance", disabled: undefined }],
  }),
};
