// Ember Skirmish: a small invented game that uses every part of the module
// API once, to build on and to check the core with. Exactly two participants
// choose distinct seats 0 and 1, muster, then take turns through order, move and strike.
// It is plain JavaScript with no imports, loaded as it is (see docs/packages.md).
//
// What a module is: the core knows only physical things (units of models,
// tokens, terrain, cards and collections, hidden values, dice, a pointer saying where the game
// is up to). A module registers the quantities its entities carry, the phases
// the pointer moves through, and actions that are shorthand for collections of
// the core's primitive events. Its macros only run on the host; what they
// emit becomes ordinary events in the log.

export const manifest = {
  id: "example.ember-skirmish",
  name: "Ember Skirmish (example)",
  version: "9.0.0",
  author: "Open Battle examples",
  api: 12,
  kind: "system",
  systems: ["ember-skirmish"],
  requires: [],
  adds: "An invented two-player game requiring distinct seats 0 and 1: import a JSON force profile and formation spacing, muster, order, move, strike. Includes a shared signal cache, private hands and public signals worth a command point; trusted-tabletop visibility, not confidential cards.",
};

const PHASES = ["order", "move", "strike"];
const unitRef = (id) => ({ kind: "unit", id });
const playerRef = (id) => ({ kind: "player", id });
const CACHE = "signal-cache";
const TABLE = "signal-table";
const DISCARD = "signal-discard";
// Collection roles are package policy; a seat is stable when its peer id is claimed.
const handId = (view, player) => `hand-${view.state.players[player].seat}`;
const SIGNALS = [
  "Lantern Relay",
  "Copper Echo",
  "Dawn Thread",
  "Bright Crossing",
  "Quiet Spark",
  "Glass Horizon",
  "Silver Path",
  "Warm Current",
];

/** This two-player setup and its turn/deployment roles are package policy, not engine seating. */
function setupReason(view) {
  const players = Object.values(view.state.players);
  return players.length === 2 &&
    players.some((player) => player.seat === 0) &&
    players.some((player) => player.seat === 1)
    ? null
    : "Ember Skirmish needs exactly two participants with distinct seats 0 and 1. Set seats in Seating before mustering or advancing.";
}

/** The seat whose turn it is, as a player. */
function activePlayer(view) {
  return Object.values(view.state.players).find((p) => p.seat === view.pointer.seat);
}

/** Next phase: the pointer moves, a new turn gives its player a command point. */
function* advance(ctx) {
  const view = ctx.view;
  const reason = setupReason(view);
  if (reason) {
    yield ctx.note(`Setup warning: ${reason}`);
    return;
  }
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

// Force data belongs to the package. Stable seats, not claimable peer ids, address imports.
const forceKey = (seat) => `force:${seat}`;
const forceFor = (view, player) =>
  view.own[forceKey(player.seat)] ?? {
    profile: { v: 1, name: `${player.name}'s embers`, models: 3, hp: 3, edge: 0 },
    spacing: 3,
  };

/** Validate this sample's file format before keeping any data or emitting any effect. */
function* importForce(ctx, args) {
  const player = ctx.view.state.players[args.by];
  if (!player || (player.seat !== 0 && player.seat !== 1))
    throw new Error("A force profile needs a participant at seat 0 or 1");
  const data = args.data;
  if (args.form !== "force-profile" || !data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Expected force-profile form data");
  const profile = data.profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    throw new Error("Force profile must be a JSON object");
  if (profile.v !== 1)
    throw new Error(`Unsupported force profile version ${String(profile.v)}; expected v: 1`);
  if (typeof profile.name !== "string" || !profile.name.trim())
    throw new Error("Force profile name must be nonempty text");
  if (!Number.isSafeInteger(profile.models) || profile.models < 1 || profile.models > 100)
    throw new Error("Force profile models must be an integer from 1 to 100");
  if (
    typeof profile.hp !== "number" ||
    !Number.isFinite(profile.hp) ||
    typeof profile.edge !== "number" ||
    !Number.isFinite(profile.edge)
  )
    throw new Error("Force profile hp and edge must be finite numbers");
  if (typeof data.spacing !== "number" || !Number.isFinite(data.spacing))
    throw new Error("Formation spacing must be a finite number of inches");
  if (!Number.isFinite(((profile.models - 1) / 2) * data.spacing))
    throw new Error("Formation exceeds the finite coordinate range");
  yield ctx.set(forceKey(player.seat), { profile, spacing: data.spacing });
  yield ctx.note(`${player.name} imports ${profile.name} (${profile.models} models)`);
}

function setupForms(view, actor) {
  const player = view.state.players[actor];
  if (
    !player ||
    (player.seat !== 0 && player.seat !== 1) ||
    view.pointer.round !== 0 ||
    Object.values(view.state.units).some((unit) => unit.owner === actor)
  )
    return [];
  const force = forceFor(view, player);
  return [
    {
      id: "force-profile",
      title: `${player.name}'s force profile`,
      macro: "import-force",
      fields: [
        {
          id: "profile",
          label: "Force profile JSON",
          hint: "An object with v: 1, name (text), models (integer 1–100), hp and edge (finite numbers). Extra package data is preserved.",
          input: { kind: "json" },
          initial: force.profile,
        },
        {
          id: "spacing",
          label: "Formation spacing (inches)",
          input: { kind: "number" },
          initial: force.spacing,
        },
      ],
    },
  ];
}

/** Muster the configured profile (`args.by` is the participant starting the macro). */
function* muster(ctx, args) {
  const view = ctx.view;
  const reason = setupReason(view);
  if (reason) {
    yield ctx.note(`Setup warning: ${reason}`);
    return;
  }
  const player = view.state.players[args.by];
  if (!player) return;
  const { profile, spacing } = forceFor(view, player);
  const hand = handId(view, player.id);
  if (!view.state.cardCollections[hand])
    yield ctx.emit({
      type: "collection/add",
      collection: { id: hand, name: `${player.name}'s signals`, cards: [] },
    });
  const y = player.seat === 0 ? 8 : -8;
  const id = `${player.id}-embers`;
  const models = Array.from({ length: profile.models }, (_, i) => ({
    id: `${id}-${i}`,
    owner: player.id,
    label: `Ember ${i + 1}`,
    position: { x: (i - (profile.models - 1) / 2) * spacing, y },
    facing: player.seat === 0 ? Math.PI : 0,
    base: { shape: "round", diameterMm: 32 },
    height: 2,
  }));
  yield ctx.emit({
    type: "unit/add",
    unit: {
      id,
      owner: player.id,
      name: profile.name,
      modelIds: [],
      q: { hp: profile.hp, edge: profile.edge, moved: 0 },
    },
    models,
  });
  yield ctx.note(`${player.name} musters`);
}

/** Card identities are in the full trusted record; hiding is a tabletop display rule. */
function* shuffleSignals(ctx) {
  yield ctx.shuffle(CACHE);
  yield ctx.note("The signal cache is shuffled");
}

/** The package, not the engine, decides that a draw takes exactly two top cards. */
function* drawSignals(ctx, args) {
  const hand = handId(ctx.view, args.by);
  const cache = ctx.view.state.cardCollections[CACHE];
  if (!ctx.view.state.players[args.by] || !ctx.view.state.cardCollections[hand])
    throw new Error("Muster before drawing signals");
  if (!cache || cache.cards.length < 2) throw new Error("Two signals are needed to draw");
  const cards = cache.cards.slice(0, 2);
  yield ctx.emit({ type: "cards/move", cards, to: hand });
  for (const card of cards)
    yield ctx.emit({
      type: "card/set",
      card,
      set: { owner: args.by, visibility: [args.by], faceUp: false },
    });
  yield ctx.note(`${ctx.view.state.players[args.by].name} draws two private signals`);
}

/** Play one signal openly; every invented signal gives one command point. */
function* playSignal(ctx, args) {
  const hand = handId(ctx.view, args.by);
  const cards = ctx.view.cards(hand, args.by);
  if (!cards.length) throw new Error("No signal in your hand");
  const card = yield ctx.ask(
    args.by,
    "Play a signal for one command point",
    cards.map((c) => ({
      id: c.id,
      label: c.name ?? "Hidden signal",
    })),
  );
  if (!ctx.view.state.cardCollections[hand]?.cards.includes(card))
    throw new Error("The chosen signal is no longer in your hand");
  yield ctx.emit({ type: "cards/move", cards: [card], to: TABLE });
  yield ctx.emit({ type: "card/set", card, set: { owner: args.by, visibility: "all", faceUp: true } });
  yield ctx.emit({ type: "q/adjust", ref: playerRef(args.by), key: "cp", delta: 1 });
  yield ctx.note(`${ctx.view.state.cards[card].name} is played for one command point`);
}

/** Return an unused signal to the top, hidden again; this does not refund anything. */
function* returnSignal(ctx, args) {
  const hand = handId(ctx.view, args.by);
  const cards = ctx.view.cards(hand, args.by);
  if (!cards.length) throw new Error("No signal in your hand");
  const card = yield ctx.ask(
    args.by,
    "Return which signal to the top of the cache?",
    cards.map((c) => ({
      id: c.id,
      label: c.name ?? "Hidden signal",
    })),
  );
  if (!ctx.view.state.cardCollections[hand]?.cards.includes(card))
    throw new Error("The chosen signal is no longer in your hand");
  yield ctx.emit({ type: "cards/move", cards: [card], to: CACHE, index: 0 });
  yield ctx.emit({ type: "card/set", card, set: { owner: null, visibility: [], faceUp: false } });
  yield ctx.note(`${ctx.view.state.players[args.by].name} returns an unused signal`);
}

/** Played signals are retired openly, with no further command-point effect. */
function* discardSignal(ctx, args) {
  const cards = ctx.view.cards(TABLE, args.by).filter((c) => c.owner === args.by);
  if (!cards.length) throw new Error("No played signal to discard");
  const card = yield ctx.ask(
    args.by,
    "Discard which played signal?",
    cards.map((c) => ({
      id: c.id,
      label: c.name ?? "Hidden signal",
    })),
  );
  if (
    !ctx.view.state.cardCollections[TABLE]?.cards.includes(card) ||
    ctx.view.state.cards[card]?.owner !== args.by
  )
    throw new Error("The chosen signal is no longer yours on the table");
  yield ctx.emit({ type: "cards/move", cards: [card], to: DISCARD });
  yield ctx.emit({ type: "card/set", card, set: { owner: null, visibility: "all", faceUp: true } });
  yield ctx.note(`${ctx.view.state.cards[card].name} is discarded`);
}

/** Recycling hides retired signals and randomizes the entire replenished cache. */
function* recycleSignals(ctx) {
  const cards = ctx.view.state.cardCollections[DISCARD].cards.slice();
  if (!cards.length) throw new Error("No discarded signals to recycle");
  yield ctx.emit({ type: "cards/move", cards, to: CACHE });
  for (const card of cards)
    yield ctx.emit({ type: "card/set", card, set: { owner: null, visibility: [], faceUp: false } });
  yield ctx.shuffle(CACHE);
  yield ctx.note("Discarded signals return to the shuffled cache");
}

/**
 * Package policy: tagged terrain boxes (except foliage) obstruct a strike.
 * Models do not block; any clear ray in any active model pair is enough.
 * Geometry supplies counts, not a unit-visibility rule or permission to strike.
 */
function strikeLine(view, from, to) {
  const blockers = view.state.terrain
    .filter((piece) => piece.tags?.includes("strike-blocker"))
    .map((piece) => ({
      kind: "terrain",
      id: piece.id,
      shape: "solids",
      solids: piece.solids.flatMap((solid, i) => (solid.kind === "foliage" ? [] : [i])),
    }));
  for (const observer of from.modelIds) {
    if (!view.state.models[observer] || view.state.models[observer].off) continue;
    for (const target of to.modelIds) {
      if (!view.state.models[target] || view.state.models[target].off) continue;
      if (view.geometry.sample(observer, target, { mode: "body", blockers }).anyClear) return true;
    }
  }
  return false;
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
  if (!strikeLine(ctx.view, me, them) && !(yield* ctx.warn(args.by, "No clear sampled strike line"))) return;
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
  api: 12,
  id: "ember-skirmish",
  name: "Ember Skirmish",
  version: "9.0.0",
  table: { width: 36, depth: 24 },
  layout: () => ({
    terrain: [],
    tokens: [{ id: "beacon", kind: "objective", position: { x: 0, y: 0 }, label: "Beacon" }],
    cards: SIGNALS.map((name, index) => ({
      id: `signal-${index + 1}`,
      name,
      visibility: [],
      faceUp: false,
    })),
    cardCollections: [
      { id: CACHE, name: "Signal cache", cards: SIGNALS.map((_, index) => `signal-${index + 1}`) },
      { id: TABLE, name: "Played signals", cards: [] },
      { id: DISCARD, name: "Discarded signals", cards: [] },
    ],
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
  setup: setupForms,
  macros: { "import-force": importForce },
  actions: [
    {
      id: "advance",
      name: "Next phase",
      by: "player",
      available: (view) => setupReason(view) ?? true,
      run: advance,
    },
    {
      id: "muster",
      name: "Muster",
      by: "player",
      available: (view, actor) =>
        setupReason(view) ??
        (view.pointer.round === 0 && !view.units(actor.player).length ? true : "Already mustered"),
      run: muster,
    },
    {
      id: "shuffle-signals",
      name: "Shuffle signal cache",
      by: "player",
      available: (view) =>
        view.state.cardCollections[CACHE]?.cards.length > 1 ? true : "Need two signals in the cache",
      run: shuffleSignals,
    },
    {
      id: "draw-signals",
      name: "Draw two signals",
      by: "player",
      available: (view, actor) =>
        !view.state.cardCollections[handId(view, actor.player)]
          ? "Muster first"
          : view.state.cardCollections[CACHE]?.cards.length >= 2
            ? true
            : "Need two signals in the cache",
      run: drawSignals,
    },
    {
      id: "play-signal",
      name: "Play a signal (+1 command point)",
      by: "player",
      available: (view, actor) =>
        view.state.cardCollections[handId(view, actor.player)]?.cards.length > 0 ? true : "Hand is empty",
      run: playSignal,
    },
    {
      id: "return-signal",
      name: "Return an unused signal",
      by: "player",
      available: (view, actor) =>
        view.state.cardCollections[handId(view, actor.player)]?.cards.length > 0 ? true : "Hand is empty",
      run: returnSignal,
    },
    {
      id: "discard-signal",
      name: "Discard a played signal",
      by: "player",
      available: (view, actor) =>
        view.state.cardCollections[TABLE]?.cards.some((id) => view.state.cards[id].owner === actor.player)
          ? true
          : "No played signal",
      run: discardSignal,
    },
    {
      id: "recycle-signals",
      name: "Recycle discarded signals",
      by: "player",
      available: (view) =>
        view.state.cardCollections[DISCARD]?.cards.length > 0 ? true : "Discard collection is empty",
      run: recycleSignals,
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
      setupReason(view) ??
        "Two-player policy: seat 0 deploys at the north edge, seat 1 at the south; turns alternate.",
      "Signals: draw two; play one openly for +1 command point; return unused signals to the top; discard played signals, then recycle.",
      "Trusted tabletop: card identities are inspectable in the full record, not confidential.",
      "Sight: tagged strike-blocker terrain obstructs sample rays; any clear model pair suffices. Blocked strikes warn but remain playable.",
    ],
    buttons: [{ label: "Next phase", macro: "advance", warning: setupReason(view) ?? undefined }],
  }),
};
