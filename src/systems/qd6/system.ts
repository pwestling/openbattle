import type {
  ActionDef,
  Effect,
  Expr,
  GameSystem,
  Procedure,
  RuleDef,
  RuleReminder,
  Step,
} from "../../core/content";

/**
 * Quality d6 (#82): a generic skirmish-to-army game where every unit rolls
 * its own Quality. Mechanics only, written in our own words; the sample
 * armies are invented and players bring their own lists (roster.ts).
 *
 *  - Units have a Quality and a Defense, both d6 targets ("4+"). Attacks
 *    hit on the attacker's Quality; the defender rolls Defense for each hit,
 *    less the weapon's AP. A natural 6 always succeeds and a natural 1
 *    always fails, on every roll.
 *  - Players take turns activating one unit each. A unit gets one order:
 *    Hold (stay and shoot), Advance (move, then shoot), Rush (move twice as
 *    far, no shooting) or Charge (move twice as far into contact and fight).
 *    The round ends once every unit has gone; whoever finished first goes
 *    first next round (initiative.ts).
 *  - In a fight the defender strikes back; a unit's later fights in a round
 *    hit only on natural 6s (fatigue). The side that caused fewer wounds
 *    tests morale (melee.ts).
 *  - Morale is a Quality roll: failing it leaves a unit Shaken, and a unit
 *    at half strength that loses a fight and fails it routs (morale.ts).
 *  - Special rules are matched by name ("Tough(3)", "AP(1)", "Blast(3)")
 *    and play themselves where they can; the rest are reminders.
 */

const ref = (r: string): Expr => ({ ref: r });
const flag = (who: string, f: string): Expr => ({ hasFlag: who, flag: f });
const rule = (who: string, id: string): Expr => ({ hasRule: who, rule: id });
const melee: Expr = { is: "weapon.weaponKind", value: "melee" };
const ranged: Expr = { is: "weapon.weaponKind", value: "ranged" };
const engaged = (who: string): Expr => ({ call: "engaged", args: [ref(`${who}.id`)] });
const owns = (role: string): Expr => ({ is: "ruleOwner", value: role });

/** The game's constants, also read by its code (melee.ts, morale.ts). */
export const QD6_CONSTANTS = {
  /** Contact: models within this many inches are in melee. */
  engagementRange: 1,
  /** 1: the defender of a fight strikes back (0 switches it off). */
  strikeBack: 1,
  /** 1: a unit's later fights in a round hit only on natural 6s (0 switches it off). */
  fatigue: 1,
  /** The distance a Rush or Charge goes, as a multiple of the unit's Move. */
  dash: 2,
  /** A Fearless unit that fails a morale test passes on this or more. */
  fearless: 4,
  /** Regeneration ignores a wound on this or more. */
  regeneration: 5,
  /** Rending: the AP a natural 6 to hit gets. */
  rending: 4,
  /** Objectives are held from this many inches. */
  objectiveRange: 3,
} as const;

/** A unit that lost its nerve: hits only on 6s in melee, can't charge or shoot (the orders say). */
const fatiguedOrShaken: Expr = {
  all: [
    melee,
    {
      any: [
        { all: [{ cmp: ">", a: ref("const.fatigue"), b: 0 }, flag("attacker", "fatigued")] },
        { hasStatus: "attacker", status: "shaken" },
      ],
    },
  ],
};

/**
 * What a hit needs: the attacker's Quality, or the weapon's own "hits on"
 * (Reliable, Sniper); in melee once fatigued or shaken nothing but a natural
 * 6 (a target no modified roll reaches).
 */
const hitTarget: Expr = {
  cases: [
    { when: fatiguedOrShaken, then: 99 },
    { when: { cmp: ">", a: ref("weapon.skill"), b: 0 }, then: ref("weapon.skill") },
  ],
  else: ref("attacker.Q"),
};

/** A bearer close enough to strike: all of them in melee, those in range when shooting. */
const inReach: Expr = {
  any: [
    melee,
    {
      cmp: "<=",
      a: { query: { kind: "distance", from: "bearer", to: "target" } },
      b: { op: "+", args: [ref("weapon.range"), 0.000001] },
    },
  ],
};

const hit = (target: Expr): Step => ({
  kind: "test",
  id: "hit",
  compare: "atLeast",
  target,
  alwaysPass: [6],
  alwaysFail: [1],
  roller: "attacker",
});

const allocate: Step = {
  kind: "allocate",
  id: "allocate",
  chooser: "defender",
  // Sniper: the shooter picks the model hit.
  attackerPicks: rule("weapon", "sniper"),
  // A wounded model takes the next wound; models unlike the rest (heroes, special weapons) go last.
  order: {
    cases: [
      { when: { cmp: ">", a: ref("model.woundsLost"), b: 0 }, then: -1 },
      { when: { cmp: ">", a: ref("model.special"), b: 0 }, then: 1 },
    ],
    else: 0,
  },
};

/**
 * The defender's roll for each hit. AP and cover change the roll (core
 * effects below); Rending raises the target for hits that came from a
 * natural 6, by reading the hit die that made each one.
 */
const defense = (rending: boolean): Step => ({
  kind: "test",
  id: "defense",
  compare: "atLeast",
  target: rending
    ? {
        op: "+",
        args: [
          ref("model.D"),
          {
            if: { all: [rule("weapon", "rending"), { cmp: "==", a: ref("input.value"), b: 6 }] },
            then: ref("const.rending"),
            else: 0,
          },
        ],
      }
    : ref("model.D"),
  alwaysPass: [6],
  alwaysFail: [1],
  roller: "defender",
  passOn: "failures",
});

/** Morale after a shot (morale.ts), once the casualties are off; only when a hit got through. */
const afterShot: Step = {
  kind: "do",
  id: "morale",
  do: [
    {
      do: "script",
      procedure: "afterAttack",
      args: { unit: ref("target"), before: { call: "woundsLeft", args: [ref("target.id")] } },
    },
  ],
};

/** One weapon's attacks: hits on Quality, Defense rolls, then wounds (Deadly(X) each, kept to one model). */
const attack: Procedure = {
  id: "attack",
  name: "Attack",
  params: ["attacker", "weapon", "target"],
  steps: [
    {
      kind: "pool",
      id: "attacks",
      each: "weapon.bearers",
      as: "bearer",
      where: inReach,
      count: ref("weapon.A"),
    },
    hit(hitTarget),
    allocate,
    defense(true),
    afterShot,
    { kind: "damage", id: "wounds", amount: ref("weapon.Deadly"), spillover: false },
  ],
};

/** Impact(X), as a charge lands (melee.ts): X dice for each model, hitting on 2+. */
const impact: Procedure = {
  id: "impact",
  name: "Impact",
  params: ["attacker", "target"],
  steps: [
    {
      kind: "pool",
      id: "attacks",
      count: { op: "*", args: [ref("attacker.Impact"), { count: "attacker.models" }] },
    },
    hit(2),
    allocate,
    defense(false),
    { kind: "damage", id: "wounds", amount: 1, spillover: false },
  ],
};

const beforeStep = (step: string): Effect["when"] => ({
  event: "step.before",
  where: { is: "event.step", value: step },
});
/** A die in this step that came up `natural` and succeeded. */
const naturalHit = (natural: number): Effect["when"] => ({
  event: "die.result",
  where: {
    all: [
      { is: "event.step", value: "hit" },
      { cmp: "==", a: ref("event.natural"), b: natural },
      ref("event.success"),
    ],
  },
});

const coreEffects: Effect[] = [
  {
    // AP(X): the Defense roll is X lower.
    id: "AP",
    when: beforeStep("defense"),
    if: { cmp: ">", a: ref("weapon.AP"), b: 0 },
    do: [{ do: "modifyRoll", by: { op: "-", args: [0, ref("weapon.AP")] } }],
  },
  {
    // Cover: most of the target's models the shooter sees are in or behind cover terrain: +1 to Defense.
    id: "Cover",
    when: beforeStep("defense"),
    if: {
      all: [
        ranged,
        { not: rule("weapon", "lockOn") },
        { cmp: ">", a: { query: { kind: "coverShare", from: "attacker", to: "target" } }, b: 0.5 },
      ],
    },
    do: [{ do: "modifyRoll", by: 1 }],
  },
];

/** "Name(X)" or "Name X", any case, with the number as `x`. */
const named = (name: string, x = false) =>
  x ? `^${name}\\s*\\(?\\s*(?<x>\\d+)\\s*\\)?\\s*$` : `^${name}\\s*$`;

/** A weapon rule that sets one of the weapon's characteristics from its number. */
const weaponSets = (id: string, name: string, characteristic: string, fixed?: number): RuleDef => ({
  id,
  name,
  ...(fixed === undefined ? { params: [{ id: "x", type: "number" as const, default: 1 }] } : {}),
  match: named(name.toLowerCase(), fixed === undefined),
  appliesTo: ["weapon"],
  effects: [
    {
      when: { event: "always" },
      do: [{ do: "setCharacteristic", target: "self", characteristic, to: fixed ?? ref("param.x") }],
    },
  ],
});

/** A rule the module's code plays (melee.ts, morale.ts, the import), found by id. */
const played = (id: string, name: string, match: string, appliesTo: RuleDef["appliesTo"]): RuleDef => ({
  id,
  name,
  match,
  appliesTo,
  effects: [],
  played: "code",
});

/** A rule the players resolve: a reminder as the unit acts. */
const reminder = (id: string, name: string, match: string, appliesTo: RuleDef["appliesTo"]): RuleDef => ({
  id,
  name,
  match,
  appliesTo,
  effects: [{ when: { event: "action.declared" }, do: [{ do: "manual", reminder: id }] }],
});

const weaponRules: RuleDef[] = [
  weaponSets("ap", "AP", "AP"),
  weaponSets("deadly", "Deadly", "Deadly"),
  // Hits on 2+ whoever shoots.
  weaponSets("reliable", "Reliable", "skill", 2),
  {
    // Hits on 2+, and the shooter picks the model hit (the allocate step's attackerPicks).
    id: "sniper",
    name: "Sniper",
    match: named("sniper"),
    appliesTo: ["weapon"],
    effects: [
      {
        when: { event: "always" },
        do: [{ do: "setCharacteristic", target: "self", characteristic: "skill", to: 2 }],
      },
    ],
  },
  {
    // Blast(X): each hit becomes X hits, no more than the target has models.
    id: "blast",
    name: "Blast",
    params: [{ id: "x", type: "number", default: 3 }],
    match: named("blast", true),
    appliesTo: ["weapon"],
    effects: [
      {
        when: {
          event: "die.result",
          where: { all: [{ is: "event.step", value: "hit" }, ref("event.success")] },
        },
        do: [
          {
            do: "addSuccesses",
            count: {
              op: "max",
              args: [
                0,
                { op: "-", args: [{ op: "min", args: [ref("param.x"), { count: "target.models" }] }, 1] },
              ],
            },
          },
        ],
      },
    ],
  },
  // Rending: a natural 6 to hit is harder to save (the defense step reads it).
  played("rending", "Rending", named("rending"), ["weapon"]),
  // Lock-On: ignores cover (above) and the target's Stealth (below).
  played("lockOn", "Lock-On", "^lock[- ]?on\\s*$", ["weapon"]),
  {
    // Indirect: may shoot at enemies out of sight (the Shoot targets); -1 to hit after moving.
    id: "indirect",
    name: "Indirect",
    match: named("indirect"),
    appliesTo: ["weapon"],
    effects: [
      { when: beforeStep("hit"), if: flag("attacker", "advancing"), do: [{ do: "modifyRoll", by: -1 }] },
    ],
  },
  // Poison: natural 6s to hit make the defender re-roll its successful 6s, by hand.
  reminder("poison", "Poison", named("poison"), ["weapon"]),
];

const unitRules: RuleDef[] = [
  // Tough(X): X wounds a model; the import puts X in the model's Wounds.
  played("tough", "Tough", named("tough", true), ["unit", "model"]),
  // Fearless: a failed morale test passes on a further 4+ (morale.ts).
  played("fearless", "Fearless", named("fearless"), ["unit"]),
  // Impact(X): X hits on 2+ for each model as its charge lands (melee.ts).
  {
    id: "impact",
    name: "Impact",
    params: [{ id: "x", type: "number", default: 1 }],
    match: named("impact", true),
    appliesTo: ["unit"],
    effects: [
      {
        when: { event: "always" },
        do: [{ do: "setCharacteristic", target: "self", characteristic: "Impact", to: ref("param.x") }],
      },
    ],
    played: "code",
  },
  {
    // Furious: charging, each natural 6 to hit in melee scores one more hit.
    id: "furious",
    name: "Furious",
    match: named("furious"),
    appliesTo: ["unit"],
    effects: [
      {
        when: naturalHit(6),
        if: { all: [owns("attacker"), melee, flag("attacker", "charging")] },
        do: [{ do: "addSuccesses", count: 1 }],
      },
    ],
  },
  {
    // Relentless: having held, each natural 6 to hit when shooting at an enemy over 9" away scores one more hit.
    id: "relentless",
    name: "Relentless",
    match: named("relentless"),
    appliesTo: ["unit"],
    effects: [
      {
        when: naturalHit(6),
        if: {
          all: [
            owns("attacker"),
            ranged,
            flag("attacker", "holding"),
            { cmp: ">", a: { query: { kind: "distance", from: "attacker", to: "target" } }, b: 9 },
          ],
        },
        do: [{ do: "addSuccesses", count: 1 }],
      },
    ],
  },
  {
    // Regeneration: each wound is ignored on a 5+.
    id: "regeneration",
    name: "Regeneration",
    match: named("regeneration"),
    appliesTo: ["unit"],
    effects: [
      { when: { event: "always" }, do: [{ do: "ignoreDamage", atLeast: ref("const.regeneration") }] },
    ],
  },
  {
    // Stealth: -1 to hit it with shooting (Lock-On weapons ignore it).
    id: "stealth",
    name: "Stealth",
    match: named("stealth"),
    appliesTo: ["unit"],
    effects: [
      {
        when: beforeStep("hit"),
        if: { all: [owns("target"), ranged, { not: rule("weapon", "lockOn") }] },
        do: [{ do: "modifyRoll", by: -1 }],
      },
    ],
  },
  {
    // Fast: moves 2" further (so 4" further on a Rush or Charge).
    id: "fast",
    name: "Fast",
    match: named("fast"),
    appliesTo: ["unit"],
    effects: [
      {
        when: { event: "always" },
        do: [{ do: "modifyCharacteristic", target: "self", characteristic: "M", by: 2 }],
      },
    ],
  },
  {
    // Slow: moves 2" less (so 4" less on a Rush or Charge).
    id: "slow",
    name: "Slow",
    match: named("slow"),
    appliesTo: ["unit"],
    effects: [
      {
        when: { event: "always" },
        do: [{ do: "modifyCharacteristic", target: "self", characteristic: "M", by: -2 }],
      },
    ],
  },
  // Flying: moves over blocking terrain (the terrain list below) and units, by hand.
  played("flying", "Flying", named("flying"), ["unit"]),
  // Strider and dangerous or difficult ground: by hand, reminded as the unit moves.
  reminder("strider", "Strider", named("strider"), ["unit"]),
  // Before the battle (ruleReminders below).
  reminder("scout", "Scout", named("scout"), ["unit"]),
  reminder("ambush", "Ambush", named("ambush"), ["unit"]),
  reminder("hero", "Hero", named("hero"), ["unit"]),
];

const ruleReminders: RuleReminder[] = [
  {
    id: "scout",
    name: "Scout",
    text: 'Set up after the other units, then it may move up to 12".',
    phase: "deployment",
    if: rule("self", "scout"),
  },
  {
    id: "ambush",
    name: "Ambush",
    text: 'May wait off the table and arrive from round 2, more than 9" from enemies.',
    phase: "deployment",
    if: rule("self", "ambush"),
  },
  {
    id: "hero",
    name: "Hero",
    text: "May join a friendly unit before the battle: they move and fight as one.",
    phase: "deployment",
    if: rule("self", "hero"),
  },
  {
    id: "strider",
    name: "Strider",
    text: "Difficult terrain doesn't slow it.",
    phase: "activation",
    on: "move",
    if: rule("self", "strider"),
  },
];

const notActivated: Expr = {
  all: [{ not: { hasStatus: "self", status: "activated" } }, { not: flag("self", "reserves") }],
};
const shaken = { if: { hasStatus: "self", status: "shaken" }, why: "Shaken: Rally first" } satisfies {
  if: Expr;
  why: string;
};
const dash: Expr = { op: "*", args: [ref("self.M"), ref("const.dash")] };

const orders: ActionDef[] = [
  {
    id: "hold",
    name: "Hold",
    verb: "holds",
    by: "unit",
    side: "active",
    hint: "Stay put and shoot",
    activates: 0,
    if: notActivated,
    notWhen: [shaken],
    sets: ["holding"],
  },
  {
    id: "advance",
    name: "Advance",
    verb: "advances",
    by: "unit",
    side: "active",
    hint: "Move, then shoot",
    activates: 0,
    if: notActivated,
    notWhen: [shaken],
    move: { kind: "advance", distance: ref("self.M") },
    sets: ["advancing"],
  },
  {
    id: "rush",
    name: "Rush",
    verb: "rushes",
    by: "unit",
    side: "active",
    hint: "Move twice as far, no shooting",
    activates: 0,
    if: notActivated,
    notWhen: [shaken],
    move: { kind: "rush", distance: dash },
    sets: ["rushing"],
  },
  {
    id: "charge",
    name: "Charge",
    verb: "charges",
    by: "unit",
    side: "active",
    hint: "Move twice as far into contact, then Fight",
    activates: 0,
    if: notActivated,
    notWhen: [
      shaken,
      {
        if: { cmp: ">", a: { call: "enemyGap", args: [ref("self.id")] }, b: dash },
        why: "No enemy in reach",
      },
    ],
    target: {
      filter: true,
      notWhen: [
        {
          if: { cmp: ">", a: { query: { kind: "distance", from: "self", to: "it" } }, b: dash },
          why: "Out of reach",
        },
      ],
    },
    move: { kind: "charge", distance: dash },
    sets: ["charging"],
  },
  {
    id: "rally",
    name: "Rally",
    verb: "rallies",
    by: "unit",
    side: "active",
    hint: "Stay idle to shake off Shaken",
    activates: 0,
    if: { all: [notActivated, { hasStatus: "self", status: "shaken" }] },
    do: [{ do: "removeStatus", target: "self", status: "shaken" }],
  },
  {
    // Each ranged weapon once, after Hold or Advance (Indirect weapons need no sight).
    id: "shoot",
    name: "Shoot",
    verb: "shoots",
    by: "unit",
    free: true,
    forWeapons: ranged,
    notWhen: [
      {
        if: { not: { any: [flag("self", "holding"), flag("self", "advancing")] } },
        why: "Hold or Advance to shoot",
      },
      { if: engaged("self"), why: "In melee" },
    ],
    target: {
      filter: { any: [{ query: { kind: "visible", from: "self", to: "it" } }, rule("weapon", "indirect")] },
      notWhen: [
        {
          if: {
            cmp: ">",
            a: { query: { kind: "distance", from: "self", to: "it" } },
            b: ref("weapon.range"),
          },
          why: "Out of range",
        },
      ],
    },
    limit: { count: 1, per: "round" },
    procedure: "attack",
  },
];

export const qd6: GameSystem = {
  id: "qd6-1",
  name: "Quality d6",
  version: "0.1.0",
  units: "inch",
  defaultTable: { width: 72, depth: 48 },
  settings: { los: "true", modelsBlock: false },
  dice: [{ id: "d6", sides: 6 }],
  defaultDie: "d6",
  characteristics: [
    {
      id: "Q",
      name: "Quality",
      of: "model",
      type: "target",
      format: "{v}+",
      aliases: ["Quality", "Qua"],
      default: 4,
    },
    {
      id: "D",
      name: "Defense",
      of: "model",
      type: "target",
      format: "{v}+",
      aliases: ["Defense", "Defence", "Def"],
      default: 4,
    },
    { id: "W", name: "Wounds", of: "model", type: "number", aliases: ["Tough", "Wounds"], default: 1 },
    { id: "M", name: "Move", of: "model", type: "distance", format: '{v}"', aliases: ["Move"], default: 6 },
    // Set by Impact(X) on the unit.
    { id: "Impact", name: "Impact", of: "model", type: "number", default: 0 },
    {
      id: "range",
      name: "Range",
      of: "weapon",
      type: "distance",
      format: '{v}"',
      aliases: ["Rng"],
      default: 0,
    },
    { id: "A", name: "Attacks", of: "weapon", type: "dice", aliases: ["Attacks"], default: 1 },
    { id: "AP", name: "AP", of: "weapon", type: "number", default: 0 },
    // Set by Reliable and Sniper: hits on this, whatever the Quality (0: the Quality).
    { id: "skill", name: "Hits on", of: "weapon", type: "target", format: "{v}+", default: 0 },
    // Set by Deadly(X): wounds each unsaved hit does, to one model.
    { id: "Deadly", name: "Deadly", of: "weapon", type: "number", default: 1 },
  ],
  weaponKinds: ["ranged", "melee"],
  unitShape: { kind: "skirmish" },
  statuses: [
    { id: "activated", name: "Activated", on: "unit" },
    {
      id: "shaken",
      name: "Shaken",
      on: "unit",
      hint: "Rallies on its next go instead of an order; hits only on 6s in melee; holds no objectives.",
    },
    {
      id: "fatigued",
      name: "Fatigued",
      on: "unit",
      hint: "Has fought this round: hits only on 6s in melee.",
    },
  ],
  resets: [
    { at: "round", flags: ["activated", "fatigued", "used.*"] },
    { at: "activation", flags: ["holding", "advancing", "rushing", "charging", "fought"] },
  ],
  resources: [{ id: "VP", name: "Victory points", on: "player", initial: 0 }],
  terrain: [
    { id: "open", name: "Open ground" },
    { id: "cover", name: "Cover", cover: true },
    { id: "difficult", name: "Difficult (cover)", cover: true },
    {
      id: "blocking",
      name: "Blocking",
      blocksMovement: true,
      blocksSight: true,
      movement: [{ keywords: ["Flying"], blocks: false }],
    },
  ],
  rules: [...weaponRules, ...unitRules],
  procedures: [attack, impact],
  coreEffects,
  actions: orders,
  ruleReminders,
  deploymentHint: "Take turns setting up one unit at a time in your zone. Scouts go last.",
  turn: {
    rounds: 4,
    initiative: "rollOff",
    round: [
      {
        kind: "alternate",
        id: "activations",
        pool: { kind: "units" },
        untilAllActivated: true,
        activation: [
          {
            kind: "phase",
            id: "activation",
            name: "Activations",
            actions: ["hold", "advance", "rush", "charge", "rally", "shoot"],
            hint: "Activate one unit: Hold, Advance, Rush or Charge. The round ends once every unit has gone.",
          },
        ],
      },
    ],
  },
  checks: [
    {
      id: "coherency",
      name: "Unit coherency",
      when: { event: "move.end" },
      require: {
        every: "self.models",
        as: "m",
        test: {
          any: [
            { cmp: "<=", a: { count: "self.models" }, b: 1 },
            {
              cmp: ">=",
              a: {
                count: "self.models",
                as: "o",
                where: { cmp: "<=", a: { query: { kind: "distance", from: "m", to: "o" } }, b: 1 },
              },
              b: 2,
            },
          ],
        },
      },
      message: 'Each model should stay within 1" of another of its unit',
    },
    {
      id: "moveDistance",
      name: "Move distance",
      when: { event: "move.end" },
      require: { cmp: "<=", a: ref("event.inchesMoved"), b: { op: "+", args: [ref("event.allowed"), 0.05] } },
      message: "Moved further than its order allows",
    },
  ],
  constants: { ...QD6_CONSTANTS },
};
