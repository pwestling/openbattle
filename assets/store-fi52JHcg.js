import{n as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./react-hsrUxga6.js";import{Bt as n,C as r,Ct as i,Dt as a,E as o,Gt as s,Ht as c,J as l,Jt as u,Kn as d,Kt as f,L as p,Lr as m,Ot as h,Pt as g,Rt as ee,S as _,Tr as v,Tt as te,Wn as y,ar as b,gn as x,in as S,it as C,lr as w,mn as T,qn as E,u as D,w as O,wt as k,x as ne}from"./core-DUu43Way.js";import{d as A,k as re}from"./store-BdWdsyin.js";import{u as ie}from"./systemLabels-CcE0jL33.js";import"./gameLog-Co2HLptY.js";import{A as j,G as ae,K as oe,N as se,U as ce,a as le,r as ue}from"./systems-BFOHv3RX.js";import{i as de,t as fe}from"./help-CQhE8UMp.js";import{r as pe}from"./Branch-ByARXvLV.js";import{i as me,n as he,t as ge}from"./lesson-BIZZ2FRF.js";function M(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var N=[`// A lesson package for Open Battle's teaching mode: a guided first turn of the
// built-in sci-fi battle game. Lesson packages are plain data, read without
// running anything (src/teach/lesson.ts), so anyone can write one.

export const manifest = {
  id: "open-battle.lessons.sci-fi",
  name: "First game: Sci-fi battle",
  version: "1.0.0",
  author: "Open Battle",
  api: 1,
  kind: "lesson",
  systems: ["forty-k"],
  requires: [],
  adds: "A guided first turn: move, shoot, charge and fight, against a computer opponent.",
};

export const lessons = [
  {
    id: "first-turn",
    title: "Your first turn",
    system: "forty-k",
    summary: "Move, shoot, charge and fight, then watch the other side do the same.",
    you: 0,
    // Your infantry and theirs start close enough to trade shots and maybe charge.
    place: [
      { seat: 0, unit: 0, at: { x: 0, y: 11 } },
      { seat: 1, unit: 0, at: { x: 0, y: -6 } },
    ],
    steps: [
      {
        say: "You command the blue army at the near edge; the computer plays red. A turn runs through five phases: Command, Movement, Shooting, Charge and Fight. Let's play one.",
      },
      {
        say: "This is the Command phase. Both sides gain a Command point (CP, top bar) to spend on stratagems later. Nothing else to do: press ▶ at the top for the Movement phase.",
        point: "▶",
        until: { phase: "movement" },
      },
      {
        say: "Your Line Troopers are selected. Drag them towards the enemy: their card shows how far they've moved against their Move of 6\\".",
        show: { seat: 0, unit: 0 },
        until: { did: ["models/move", "normalMove", "advance"] },
        after: "Good. Moving first lets you pick the fights.",
      },
      {
        say: "Move any other units you like the same way. When you're done, press ▶ for the Shooting phase.",
        point: "▶",
        until: { phase: "shooting" },
      },
      {
        say: "On the Line Troopers' card, press Shoot beside a weapon (the Rng column says how far it reaches), pick the Ashen Thralls as the target, then press Declare attack.",
        show: { seat: 0, unit: 0 },
        point: "Declare attack",
        until: { did: ["attack:ranged", "shoot"] },
      },
      {
        say: "Now roll: the panel on the right goes hits, then wounds, then their saves, then damage. Press the blue button each time.",
        point: "Roll to hit",
        until: { any: [{ did: ["attack:done", "attack/clear", "procedure/clear"] }, { phase: "charge" }] },
        after: [
          { if: "slain >= 5", say: "{slain} of the {target} down from one volley. They'll feel that." },
          { if: "slain > 0", say: "{slain} of the {target} down. Every model counts." },
          { say: "Nothing got through that time. Dice are like that." },
        ],
      },
      {
        say: "Shoot with other units if you like, then press ▶ for the Charge phase.",
        point: "▶",
        until: { phase: "charge" },
      },
      {
        say: 'A unit can charge an enemy within 12". Select your Line Troopers and press Charge (2D6): two dice say how far they can go. If nothing is close enough, press ▶.',
        show: { seat: 0, unit: 0 },
        point: "Charge (2D6)",
        until: { any: [{ did: ["charge", "roll:charge"] }, { phase: "fight" }] },
      },
      {
        if: "roll > 0",
        say: "You rolled {roll}\\". If the gap to the enemy is no more than that, drag the Line Troopers into contact; the ruler shows how far they've gone. If it's too far, the charge fails: press ▶.",
        until: { any: [{ engaged: true }, { phase: "fight" }] },
        after: [
          { if: "engaged", say: "Contact! Charging units fight first." },
          { say: "Short. Charges fail sometimes; that's the game." },
        ],
      },
      {
        say: "Press ▶ for the Fight phase.",
        point: "▶",
        until: { phase: "fight" },
      },
      {
        if: "engaged",
        say: "Fight phase: press Fight on the Line Troopers' card, pick the unit they're in contact with, press Fight again under the target and roll.",
        show: { seat: 0, unit: 0 },
        point: "Fight",
        until: { any: [{ did: ["attack:done", "attack/clear", "procedure/clear"] }, { theirTurn: true }] },
        after: [
          { if: "slain > 0", say: "{slain} cut down in the melee." },
          { say: "They held. Combat can drag on into the next turn." },
        ],
      },
      {
        say: "That's your turn. Press ▶ to end it: the red army goes next.",
        point: "▶",
        until: { theirTurn: true },
      },
      {
        say: "Red's turn. Watch it move and shoot. When it shoots you, your saves are yours to roll: press Roll saves in the panel when it comes up.",
        point: "Roll saves",
        until: { any: [{ all: [{ engaged: true }, { phase: "fight", side: "them" }] }, { yourTurn: true }] },
        after: [
          { if: "lost > 0", say: "{lost} of yours down. Time for payback." },
          { say: "Not a scratch on you." },
        ],
      },
      {
        if: "engaged",
        hold: true,
        say: "They charged you! In the Fight phase both sides fight. Select your unit in contact, press Fight, pick them, press Fight again and roll.",
        point: "Fight",
        until: { any: [{ did: ["attack:done", "attack/clear", "procedure/clear"] }, { yourTurn: true }] },
        after: [
          { if: "slain > 0", say: "{slain} of them down. That'll teach them." },
          { say: "Nothing this time, but you stood your ground." },
        ],
      },
      {
        say: "Red finishes its turn.",
        until: { yourTurn: true },
      },
      {
        say: "That's a whole round. The battle runs for five; play on as long as you like, and \\"What can I do now?\\" at the top of the screen always says what's possible.",
      },
    ],
    done: {
      title: "First turn done",
      ticks: [
        { label: "Moved", did: ["models/move", "normalMove", "advance"] },
        { label: "Shot", did: ["attack:ranged", "shoot"] },
        { label: "Charged", did: ["roll:charge", "charge"] },
        { label: "Fought", did: ["attack:melee", "fight"] },
      ],
    },
  },
];
`,`// A lesson package for Open Battle's teaching mode: a guided first turn of the
// built-in rank-and-flank game (played by hand). Plain data (src/teach/lesson.ts).

export const manifest = {
  id: "open-battle.lessons.rank-and-flank",
  name: "First game: Rank and flank",
  version: "1.0.0",
  author: "Open Battle",
  api: 1,
  kind: "lesson",
  systems: ["tow"],
  requires: [],
  adds: "A guided first turn with regiment blocks: march, shoot and fight, against a computer opponent.",
};

export const lessons = [
  {
    id: "first-turn",
    title: "Moving blocks",
    system: "tow",
    summary: "March a regiment, shoot with your archers, then watch the other side.",
    you: 0,
    steps: [
      {
        say: "You command blue at the near edge; the computer plays red. Your units are regiments: blocks of models in ranks that move together. A turn runs Strategy, Movement, Shooting and Combat.",
      },
      {
        say: "Nothing happens in the Strategy phase of a first turn. Press ▶ at the top for Movement.",
        until: { phase: "movement" },
      },
      {
        say: "Your spear regiment is selected. Drag the block forwards: it keeps its ranks, and the ruler shows how far it has gone against its Move. The card has buttons to wheel and turn.",
        show: { seat: 0, unit: 0 },
        until: { did: ["unit/move", "models/move"] },
      },
      {
        say: "To charge, drag a block into contact with an enemy; the enemy may react first. Press ▶ for the Shooting phase.",
        until: { phase: "shooting" },
      },
      {
        say: "Your archers are selected. Normally only the front rank shoots, but these bowmen have Volley Fire: if they haven't moved this turn, half of each rank behind shoots over their heads too. Press Shoot and pick an enemy in range, or press ▶ if nothing is close enough.",
        show: { seat: 0, unit: 1 },
        until: { any: [{ did: "shoot" }, { phase: "combat" }] },
      },
      {
        say: "Combat: blocks in contact fight. Press ▶ to end your turn when you're done.",
        until: { theirTurn: true },
      },
      {
        say: "Now red plays its turn. If it charges you, you'll be asked how to react.",
        until: { yourTurn: true },
      },
      {
        say: "That's a whole round. Bring your blocks into contact to fight; a unit that loses badly may flee. Once you play on, \\"What can I do now?\\" at the top of the screen always says what's possible.",
      },
    ],
  },
  {
    id: "break-and-panic",
    title: "Break and panic",
    system: "tow",
    summary: "Charge a small unit, break it, and watch its friends test for Panic.",
    you: 0,
    // Red holds against your charge, so the fight happens (UX 317).
    answers: ["hold"],
    // Your spears face red's slingers a couple of inches away.
    place: [
      { seat: 0, unit: 0, at: { x: 0, y: 6.5 } },
      { seat: 1, unit: 4, at: { x: 0, y: 1 } },
      // The warband (and its General's Leadership) well away; a dim Bog Hulk beside the slingers.
      { seat: 1, unit: 0, at: { x: -22, y: -10 } },
      { seat: 1, unit: 3, at: { x: 6, y: 0 } },
    ],
    steps: [
      {
        say: "A regiment that breaks shakes its friends: any unit within 6\\" of a friend that flees from combat or is destroyed takes a Panic test, and may run too. Red's slingers stand just ahead of your spears, with a Bog Hulk beside them.",
      },
      {
        say: "Your spears are Drilled: they march near the enemy without a test, and may redress their ranks for free before moving. Press ▶ for Movement.",
        until: { phase: "movement" },
      },
      {
        say: "Your spears are selected. Press Declare charge and pick the slingers, then move into contact with the Charge panel or by dragging.",
        show: { seat: 0, unit: 0 },
        point: "Declare charge",
        until: { engaged: true },
      },
      {
        say: "Press ▶ until the Combat phase.",
        until: { phase: "combat" },
      },
      {
        say: "Press Fight. Both sides strike, then the loser takes a break test.",
        show: { seat: 0, unit: 0 },
        point: "Fight",
        // If the charge fell short there's nothing to fight: the step ends with the turn.
        until: { any: [{ did: "combat" }, { theirTurn: true }] },
        // Keyed on what the rules logged: the break test, then the Bog Hulk's Panic test (UX 319).
        after: [
          {
            if: "said:keeps more than half its models",
            say: "The slingers broke and fled, and the Bog Hulk failed its Panic test: it fell back in good order, and rallies at the end of the move.",
          },
          {
            if: "said:fails its Panic test",
            say: "The slingers broke and fled, and the Bog Hulk failed its Panic test and fled with them.",
          },
          {
            if: "said:keeps its nerve",
            say: "The slingers broke and fled. The Bog Hulk beside them took a Panic test and kept its nerve.",
          },
          {
            if: "said:breaks (",
            say: "The slingers broke and fled.",
          },
          {
            if: "said:falls back in good order",
            say: "The slingers lost and fell back in good order: that isn't fleeing, so nobody tests for Panic.",
          },
          {
            if: "said:Combat result",
            say: "The slingers held. The fight goes on next turn.",
          },
          {
            say: "Your charge didn't reach them this time, so there was no fight.",
          },
        ],
      },
      {
        say: "Panic tests also come when a unit loses a quarter of its models to shooting or magic. You can roll one by hand from a unit's card when the rules call for it.",
      },
    ],
  },
];
`,`// A lesson package for Open Battle's teaching mode: a guided first round of the
// built-in Conquest game (played by hand). Plain data (src/teach/lesson.ts).

export const manifest = {
  id: "open-battle.lessons.conquest",
  name: "First game: Conquest",
  version: "1.0.0",
  author: "Open Battle",
  api: 1,
  kind: "lesson",
  systems: ["conquest"],
  requires: [],
  adds: "A guided first round: the command stack, drawing cards and activating regiments, against a computer opponent.",
};

export const lessons = [
  {
    id: "first-round",
    title: "The command stack",
    system: "conquest",
    summary: "Order your stack, draw a card and activate a regiment, then trade turns.",
    you: 0,
    steps: [
      {
        say: "You command blue at the near edge; the computer plays red. Each round you secretly put your regiments in order: your command stack. Then the sides take turns drawing the top card and activating that regiment.",
      },
      {
        say: "Open Command stack on the left, use the arrows to put your regiments in the order you want them to act, and press Lock in stack. Then press ▶ for the Action phase.",
        until: { any: [{ did: "secret/commit" }, { phase: "actions" }] },
      },
      {
        say: "Press ▶ when your stack is locked in.",
        until: { phase: "actions" },
      },
      {
        say: "Press Draw in the Command stack to turn up your top card, then press Activate on that regiment's card.",
        until: { did: "activate" },
      },
      {
        say: "The regiment has two actions. March forwards, or Volley or Clash if an enemy is in reach.",
        until: { did: ["march", "volley", "clash", "charge"] },
      },
      {
        say: "Take its second action if you like, then press End activation at the top.",
        until: { any: [{ did: "turn/endActivation" }, { theirTurn: true }] },
      },
      {
        say: "Red draws its top card and activates that regiment now.",
        until: { yourTurn: true },
      },
      {
        say: "Your turn again: draw your next card. When every regiment has gone, the round ends and you build a new stack.",
      },
    ],
  },
];
`,`// A lesson package for Open Battle's teaching mode: a guided first round of the
// built-in Full Spectrum Dominance game. Plain data (src/teach/lesson.ts).

export const manifest = {
  id: "open-battle.lessons.fsd",
  name: "First game: Full Spectrum Dominance",
  version: "1.0.0",
  author: "Open Battle",
  api: 1,
  kind: "lesson",
  systems: ["fsd"],
  requires: [],
  adds: "A guided first round: activations, moving and firing, against a computer opponent.",
};

export const lessons = [
  {
    id: "first-round",
    title: "Activations",
    system: "fsd",
    summary: "Activate a unit, move and fire, then take turns with the other side.",
    you: 0,
    place: [
      // Within rifle range of each other, so the first Fire has something to hit.
      { seat: 0, unit: 1, at: { x: -6, y: 2 } },
      { seat: 1, unit: 1, at: { x: -6, y: -1 } },
    ],
    steps: [
      {
        say: "You command blue at the near edge; the computer plays red. Each round both sides get activation dice. You take turns: one unit each, back and forth, until both sides run out.",
      },
      {
        say: "Your Rifle Squad is selected. Press Activate on its card to spend one of your activation dice on it.",
        show: { seat: 0, unit: 1 },
        until: { did: "activate" },
      },
      {
        say: "An activated unit has two actions. Press Move and drag it, or Fire at an enemy it can see.",
        until: { did: ["move", "fire"] },
      },
      {
        say: "Use its second action if you like, then press End activation at the top.",
        until: { any: [{ did: "turn/endActivation" }, { theirTurn: true }] },
      },
      {
        say: "Red activates one of its units now. If it fires at you, the panel may offer a reaction or ask for a roll.",
        until: { yourTurn: true },
      },
      {
        say: "Your turn again: activate another unit. Keep going until the dice run out; then the round is scored and a new one starts.",
      },
    ],
  },
];
`];function _e(e=N){return e.flatMap(e=>{let t=me(e);return`error`in t?[]:[t]})}function P(e){return S().find(t=>ie(e.system,t.id))?.id}function ve(e){let t=r(e),n=[],i=e.initial;for(let r of e.events){if(t.has(r.seq))continue;let e=i;if(i={...O(i,r.event),seq:r.seq},r.event.type===`turn/prev`||e.turn.round===0||i.turn.round<=e.turn.round&&i.turn.phase===e.turn.phase)continue;let a=c(e);if(a?.id&&n.push({kind:`phaseEnd`,phase:a.id,seat:e.turn.activeSeat,round:e.turn.round,state:e,seq:r.seq}),i.turn.round>e.turn.round){n.push({kind:`roundEnd`,round:e.turn.round,state:e,seq:r.seq});let t=u(i).turn.rounds;typeof t==`number`&&i.turn.round>t&&n.push({kind:`gameEnd`,round:e.turn.round,state:e,seq:r.seq})}}return n}var ye=(e,t)=>`phaseEnd`in e?t.kind===`phaseEnd`&&t.phase===e.phaseEnd&&t.round>=(e.fromRound??1):`roundEnd`in e?t.kind===`roundEnd`&&t.round>=(e.fromRound??1):t.kind===`gameEnd`;function F(e,t,n){if(!n)return[];let r=new Set((t.scores??[]).map(e=>e.key)),i=[],a=ve(e),o=a.find(e=>e.kind===`gameEnd`)?.seq??1/0,s=new Set(e.events.flatMap(({seq:e,event:t})=>e>o&&t.type===`secret/reveal`&&t.key.startsWith(`mission:`)?[`${t.key}:${String(t.value)}`]:[]));for(let e of a)for(let a of n.scoring)if(ye(a.at,e))for(let n of e.kind===`phaseEnd`?[e.seat]:E(e.state)){let o=`${a.id}:${e.round}:${n}`;if(r.has(o))continue;let s=!!t.settings.companion&&a.measures!==!1,c=s?{vp:0,why:a.ask?.question??m(`count it on your table`)}:a.suggest(e.state,n);c&&i.push({key:o,seat:n,round:e.round,rule:a.name,...c,guessed:!s,...s&&a.ask?{ask:a.ask}:{}})}for(let[e,a]of Object.entries(t.secrets??{})){let o=t.players[e]?.seat;if(o!==void 0)for(let[c,l]of Object.entries(a)){if(!c.startsWith(`mission:`)||!l.revealed)continue;let a=`card:${e}:${c}`;if(r.has(a))continue;let u=n.deck?.find(e=>e.id===l.revealed.value);if(!u||s.has(`${c}:${u.id}`))continue;let d=!!t.settings.companion,f=d?{vp:0,why:u.ask?.question??u.text}:u.suggest(t,o);i.push({key:a,seat:o,round:t.turn.round,rule:u.name,...f,guessed:!d,...d&&u.ask?{ask:u.ask}:{}})}}return i}function be(e){let t={},n=new Set;for(let r of e.scores??[])r.vp&&(n.add(r.round),t[r.seat]??={},t[r.seat][r.round]=(t[r.seat][r.round]??0)+r.vp);return{rounds:[...n].sort((e,t)=>e-t),bySeat:t}}function xe(e,t,n){if(!e.tidy||n.intent.type!==`action/take`)return;let r=L(t);e.taken?.phase!==r&&(e.taken={phase:r,keys:new Set}),e.taken.keys.add(I(t,n.intent.unitId,n.intent.action))}function I(e,t,n){let r=u(e).actions.find(e=>e.id===n);return`${t}:${r&&(r.move&&!/pile|consolidat|charge/i.test(r.move.kind)||(r.sets??[]).includes(`stationary`))?`move`:n}`}function L(e){return`${e.turn.round}:${e.turn.activeSeat}:${e.turn.phase}`}var R=(e,t)=>t[Math.floor(e()*t.length)],z=(e,t)=>{let n=[...t];for(let t=n.length-1;t>0;t--){let r=Math.floor(e()*(t+1));[n[t],n[r]]=[n[r],n[t]]}return n};function Se(e,t,n){try{return!!ne(e,n.intent,n.as,()=>.5,0,t)}catch{return!1}}function B(e,t){let n=Math.floor(e.rng()*2**48).toString(16).padStart(12,`0`),r=v(t,n);return e.kept.set(r,{value:t,salt:n}),r}var Ce=e=>{let t=u(e).turn.rounds;return typeof t==`number`?t:5},V=e=>e.turn.round>Ce(e),we=e=>e.reaction?{...e,reaction:null}:e;function Te(e,t,n){let r=Object.values(t.players).filter(e=>e.seat!==void 0),i=(e,t,n)=>[...n?[n]:[],...r.map(e=>e.id).filter(e=>e!==n)].map(n=>({intent:e,as:n,kind:t})),a=t.script?.waiting;if(a){if(a.reveal!==void 0){let e=t.secrets?.[a.player]?.[a.reveal]?.commitment,r=e?n.kept.get(e):void 0;return{what:`a reveal of ${a.reveal} by ${a.player}`,moves:r?[{intent:{type:`script/answer`,answer:JSON.stringify(r)},as:a.player,kind:`reveal`}]:[]}}let e=z(n.rng,a.options);return{what:`"${a.question}" for ${a.player}`,moves:e.map(e=>({intent:{type:`script/answer`,answer:a.secret===void 0?e.id:B(n,e.id)},as:a.player,kind:`answer`}))}}let o=t.procedure;if(o){let e=o.run;if(e.pending){let t=[...z(n.rng,e.pending.options.map(e=>e.id)),`pass`];return n.rng()<.5&&t.unshift(`pass`),{what:`the ${e.pending.step} window`,moves:t.flatMap(e=>i({type:`procedure/respond`,answer:e},`respond`))}}return{what:`the ${o.action} roll`,moves:i(e.done?{type:`procedure/clear`}:{type:`procedure/roll`},`roll`,!e.done&&D(t,e)||o.by)}}let s=t.reaction;if(s){let e=d(t,s.seat),r=[];if(n.weighing||n.rng()<.4)for(let i of e)for(let e of l(t,i.id)){let t=e.units.length?e.units[Math.floor(n.rng()*e.units.length)]:void 0,a=e.needsUnit&&t?{...e.play,targetId:t}:e.play;r.push({intent:a,as:i.id,kind:`react`})}return{what:`the ${s.window} reaction window`,moves:[...r,...e.map(e=>({intent:{type:`reaction/pass`},as:e.id,kind:`pass`}))]}}let c=t.attack;if(c)return{what:`the attack`,moves:i(c.stage===`done`?{type:`attack/clear`}:{type:`attack/roll`},`attack`,t.units[c.stage===`save`?c.spec.targetUnitId:c.spec.attackerUnitId]?.owner)};let u=t.pending;if(u){let e=d(t,u.seat),r=[];if(n.weighing||n.rng()<.4){for(let i of z(n.rng,Object.values(t.units)))if(e.some(e=>e.id===i.owner)&&x(t,i)&&!i.status?.reserves)for(let e of g(t,i.id))e.ok&&e.def.reactTo&&r.push({intent:{type:`action/take`,unitId:i.id,action:e.def.id},as:i.owner,kind:`react`})}return{what:`a reaction`,moves:[...r,...e.map(e=>({intent:{type:`reaction/pass`},as:e.id,kind:`pass`}))]}}let f=ue(t.system)?.app?.missions?.find(e=>e.id===t.mission?.id),p=e.events.at(-1)?.event.type;if(n.weighing)return null;f&&(n.scores===void 0||p===`turn/next`||p===`turn/ready`||p===`score/confirm`||p===`secret/reveal`)&&(n.scores=F(e,t,f).map(e=>e.key));let m=f&&n.scores?.length?F(e,t,f)[0]:void 0;if(m){let e=n.rng()<.2,r={type:`score/confirm`,key:m.key,seat:m.seat,round:m.round,vp:e?0:m.vp,why:m.why,...e?{skipped:!0}:{}};return{what:`the score ${m.key}`,moves:d(t,m.seat).map(e=>({intent:r,as:e.id,kind:`score`}))}}return null}function*Ee(e,t){let n=e.turn.round,r=n>0&&ee(e),o=r?Object.values(e.players).filter(e=>e.seat!==void 0):d(e,e.turn.activeSeat),l=t=>n===0?e.players[t]?.seat!==void 0:o.some(e=>e.id===t),p=z(t.rng,Object.values(e.units).filter(t=>l(t.owner)&&x(e,t)&&!t.status?.reserves)),m=i(e),_=n>0&&s(e)?Object.values(e.units).filter(t=>l(t.owner)&&x(e,t)&&t.status?.reserves):[],v=n>0&&t.tidy&&!m.length&&s(e)?[...p,..._].find(e=>!e.status?.activated&&!e.status?.acting):void 0,y=v?[{intent:{type:`turn/endActivation`,unit:v.id},as:v.owner,kind:`endActivation`}]:r?De(e,t):[...n>0&&!s(e)&&f(e)?o.map(e=>({intent:{type:`turn/pass`},as:e.id,kind:`pass`})):[],...o.map(e=>({intent:{type:`turn/next`},as:e.id,kind:`next`}))];if(n===0){p[0]&&t.rng()<.3&&(yield*G(e,K(e,p[0],t,4))),yield*y;for(let t of Object.values(e.players))yield{intent:{type:`turn/next`},as:t.id,kind:`next`};return}yield*J(e,t,o.map(e=>e.id));let b=h(u(e));if(b&&t.rng()<.5)for(let t of o){if(!a(e,t.id))continue;let n=e.pools?.[t.id]?.[b]??[],r=p.find(e=>e.owner===t.id);for(let i of Object.keys(r?.sheet?.weapons??{}))for(let a=0;a<n.length;a++)r&&!te(e,t.id,r.id,i,a)&&(yield{intent:{type:`dice/place`,unitId:r.id,weapon:i,index:a},as:t.id,kind:`place`})}let S=c(e)?.id??``;if(/move/i.test(S)&&t.rng()<.3&&(yield*U(e,t,p,/join/i)),t.tidy&&/move/i.test(S)){let r=`${n}:${e.turn.activeSeat}:${e.turn.phase}`;t.moved?.phase!==r&&(t.moved={phase:r,units:new Set});let i=(m.length?m:p).find(e=>!t.moved.units.has(e.id));i&&!g(e,i.id).some(e=>e.ok&&e.move!==void 0)&&(t.moved.units.add(i.id),yield*G(e,K(e,i,t,6)))}let C=Oe(e,t);C&&(yield C);let w=!1,T=function*(){for(let n of m.length?m:p)for(let r of H(e,n,t))w=!0,yield r},E=t.tidy?6:40,D=t.tidy?Math.min(.9,.15+t.idle*.12):Math.min(.9,.05+t.idle*.04),O=m.map(e=>({intent:{type:`turn/endActivation`},as:e.owner,kind:`endActivation`}));if(/combat|fight/i.test(c(e)?.id??``)&&(t.rng()<.5&&(yield*U(e,t,p,/challenge/i)),yield*U(e,t,p)),t.wholeGame&&t.idle<6){let r=[...U(e,t,m.length?m:[..._,...p])],i=m.some(e=>e.status?.actionBudget!==void 0)&&t.rng()<.4;i||(yield*r);let a=(m.length?m:p)[Math.floor(t.rng()*(m.length||p.length))];t.went?.round!==n&&(t.went={round:n,units:new Set}),a&&!(t.tidy&&t.went.units.has(a.id))&&(t.went.units.add(a.id),yield*G(e,(t.rng()<.25?R(t.rng,W(e,a,12)):void 0)??K(e,a,{...t,tidy:!0},6))),i&&(yield*r)}/move/i.test(c(e)?.id??``)&&t.rng()<.5&&(yield*U(e,t,p,/charge|march|join|leave/i)),/move/i.test(c(e)?.id??``)&&t.rng()<.3&&(yield*U(e,t,p,/leave/i));let k=t.rng();if(k<.6?yield*T():k<.75?yield*U(e,t,p):k<.8?yield*Ae(e,t,o.map(e=>e.id)):k<.95&&p[0]&&!t.tidy&&(yield*G(e,K(e,p[0],t,6))),t.rng()<D&&(yield*O),t.idle>E&&t.rng()<D&&(yield*y),yield*T(),yield*O,!w||t.idle>E){if(yield*y,r&&t.tidy)for(let t of d(e,e.turn.activeSeat))yield{intent:{type:`turn/next`},as:t.id,kind:`next`};else for(let e of o)yield{intent:{type:`turn/pass`},as:e.id,kind:`pass`}}yield*y}function De(e,t){let r=(e,t=!0)=>({intent:t?{type:`turn/ready`}:{type:`turn/ready`,ready:!1},as:e,kind:t?`ready`:`unready`}),i=z(t.rng,n(e)).map(e=>r(e));if(t.tidy)return i;let a=t.rng(),o=e.turn.ready??[];return a<.1?[{intent:{type:`turn/next`},as:e.turn.ready?.[0]??n(e)[0],kind:`next`},...i]:a<.15&&o.length?[r(o[0],!1),...i]:i}function*H(e,t,n){let r=n.taken?.phase===L(e)?n.taken.keys:void 0;for(let i of z(n.rng,g(e,t.id))){if(i.def.reactTo||n.tidy&&(r?.has(I(e,t.id,i.def.id))||Pe(e,t,i.def.id))||i.def.sets?.includes(`advanced`)&&Ne(t)&&(n.tidy||n.rng()<.75))continue;if(i.def.procedure){let r=Object.keys(t.sheet?.weapons??{}),a=k(e,t.id,i.def.id).filter(e=>e.ok),o=new Set(a.map(e=>e.unitId));for(let s of z(n.rng,r.length?r:[void 0]).slice(0,3)){let r=s&&n.rng()<.3,c=z(n.rng,r?k(e,t.id,i.def.id,s).filter(e=>e.ok):a);n.rng()<.5&&c.sort((e,t)=>Number(o.has(e.unitId))-Number(o.has(t.unitId)));for(let r of c.slice(0,2)){if(n.tidy&&s&&(!je(e,t,s,r.unitId)||Me(t,s,i.def.id)))continue;let a={...s?{weapon:s}:{},targetId:r.unitId},o=g(e,t.id,a).find(e=>e.def.id===i.def.id);if(!o?.ok)continue;let l=c.filter(e=>e.unitId!==r.unitId).map(e=>e.unitId),u=o.repeat&&n.rng()<.7?l.slice(0,o.repeat-1):[];yield{intent:{type:`action/take`,unitId:t.id,action:i.def.id,...a,...u.length?{more:u}:{}},as:t.owner,kind:`action:${i.def.id}`}}}continue}if(!i.ok)continue;let a=i.commands?z(n.rng,i.commands.candidates).slice(0,i.commands.count):[],o=i.def.target?R(n.rng,k(e,t.id,i.def.id).filter(e=>e.ok))?.unitId:void 0,s={intent:{type:`action/take`,unitId:t.id,action:i.def.id,...o?{targetId:o}:{},...a.length?{with:a}:{}},as:t.owner,kind:`action:${i.def.id}`},c=r=>i.def.move?.kind===`charge`?q(e,t,n,r,o):K(e,t,n,r);if(i.move===void 0&&/charge/i.test(i.def.id)){let r=le(e.system).chargeRoll;if(r&&o){n.charging={unitId:t.id,targetId:o,round:e.turn.round};let i={type:`dice/roll`,count:r.count,sides:r.sides,label:`charge roll`,unitId:t.id};yield{...s,then:{intent:i,as:t.owner,kind:`chargeRoll`}}}else yield{...s,then:q(e,t,n,8+Math.floor(n.rng()*6),o)};continue}if(n.tidy&&i.move!==void 0){yield{...s,then:c(Math.max(1,i.move))};continue}yield s,i.move!==void 0&&(yield c(Math.max(1,i.move)))}}function*U(e,t,n,r){if(e.script)return;let i=ue(e.system),a=c(e)?.id,o=i?p(e,i.system.id):null;for(let s of n.slice(0,4)){let n={player:s.owner,unitId:s.id},c=[...o?(i.actions??[]).filter(e=>e.by===`unit`&&(!e.phases||a&&e.phases.includes(a))).filter(e=>!e.applies||e.applies(o,n)).map(e=>{let t=e.available(o,n),r=t===!0&&e.targets?e.targets(o,n):[];return{id:e.id,available:t,targets:r,targeted:!!e.targets}}):[],...(t.packageActions?.(s.id,s.owner)??[]).map(e=>({...e,targeted:e.targets.length>0}))],l=z(t.rng,c).sort((e,t)=>Number(t.targeted)-Number(e.targeted));for(let n of l){if(n.available!==!0||r&&!r.test(n.id))continue;let i=/charge/i.test(n.id)&&t.rng()<.5?n.targets.filter(t=>ke(e,t.unitId)):[],a=R(t.rng,i.length?i:n.targets)?.unitId;if(n.targeted&&!a)continue;let o={intent:{type:`script/start`,procedure:n.id,args:{unit:s.id,...a?{target:a}:{}}},as:s.owner,kind:`code:${n.id}`};yield/charge/i.test(n.id)&&a?{...o,then:q(e,s,t,24,a)}:o}}}function Oe(e,t){let n=t.charging;if(!n||n.round!==e.turn.round)return null;let r=e.units[n.unitId],i=e.units[n.targetId],a=e.modules?.[e.system??``]??{};if(!r?.status?.acting||!i||!x(e,i)||a[`short:${r.id}`]===n.round||a[`landed:${r.id}`]===n.round)return null;let s=o(e,r,i);return!s||s.distance<.05?null:{intent:{...s.move,how:`charge`},as:r.owner,kind:`chargeMove`}}function ke(e,t){let n=t?e.units[t]:void 0;if(!n)return!1;let r=T(e,n);return Object.values(e.units).some(t=>y(e,t.owner,n.owner)&&T(e,t).length&&j(r,T(e,t))<.6)}function*Ae(e,t,n){for(let r of n)for(let n of z(t.rng,C(e,r))){if(!n.ok||n.def.custom||t.tidy&&/re.?roll/i.test(n.def.id))continue;let e=n.targets?R(t.rng,n.targets):void 0;(!n.targets||e)&&(yield{intent:{type:`player/action`,action:n.def.id,...e?{targetId:e}:{}},as:r,kind:`stratagem:${n.def.id}`})}}function W(e,t,n){let r=T(e,t);if(!r.length)return[];let i={x:r.reduce((e,t)=>e+t.position.x,0)/r.length,y:r.reduce((e,t)=>e+t.position.y,0)/r.length},a=r[0].z??0,o=[];for(let t of e.terrain)for(let e of t.solids){if(e.kind!==`floor`&&e.kind!==`block`)continue;let r=Math.round((e.z+e.h)*100)/100;if(r<1||Math.abs(r-a)<.3)continue;let s=w(t,{x:e.x,y:e.y}),c=Math.hypot(s.x-i.x,s.y-i.y)+Math.abs(r-a);c<=n+.05&&o.push({d:c,at:s,top:r})}return o.sort((e,t)=>e.d-t.d).slice(0,3).flatMap(({at:n,top:a})=>{let o=r.map(t=>{let r={x:n.x+t.position.x-i.x,y:n.y+t.position.y-i.y};return{id:t.id,to:r,z:b(e.terrain,r,a)}});return o.some(e=>Math.abs(e.z-a)>.05)?[]:[{intent:{type:`models/move`,moves:o},as:t.owner,kind:`move`}]})}function*G(e,t){if(t.intent.type!==`models/move`)return void(yield t);t.intent.moves.some(t=>{let n=e.models[t.id]?.position;return!n||Math.hypot(n.x-t.to.x,n.y-t.to.y)>.1})&&(yield t)}function K(e,t,n,r){let i=t.modelIds.map(t=>e.models[t]).filter(e=>e&&!e.destroyed),a=i.reduce((e,t)=>e+t.position.x,0)/i.length,o=i.reduce((e,t)=>e+t.position.y,0)/i.length,s=n.tidy?Fe(e,t,a,o):null,c=s?Math.atan2(s.x-a,s.y-o)+(n.rng()-.5)*.6:n.rng()*Math.PI*2,l=s?Math.max(0,Math.min(Math.hypot(s.x-a,s.y-o)-3,r*(.6+.4*n.rng()))):n.rng()*r,u=e.table.width/2-2,d=e.table.depth/2-2,f=(e,t)=>Math.max(-t,Math.min(t,e)),p=f(a+Math.sin(c)*l,u)-a,m=f(o+Math.cos(c)*l,d)-o;return{intent:{type:`models/move`,moves:i.map(e=>({id:e.id,to:{x:e.position.x+p,y:e.position.y+m}}))},as:t.owner,kind:`move`}}function q(e,t,n,r,i){let a=T(e,t),o=a.reduce((e,t)=>e+t.position.x,0)/a.length,s=a.reduce((e,t)=>e+t.position.y,0)/a.length,c,l=1/0;for(let n of Object.values(e.units)){if(!y(e,n.owner,t.owner)||!x(e,n)||i&&n.id!==i)continue;let r=j(a,T(e,n));r<l&&([c,l]=[n,r])}if(!c)return K(e,t,n,r);let u=T(e,c),d=u.reduce((e,t)=>e+t.position.x,0)/u.length,f=u.reduce((e,t)=>e+t.position.y,0)/u.length,p=Math.hypot(d-o,f-s)||1,[m,h]=[0,0],g=r;for(let e=0;e<8&&g>.01&&l>.05;e++){let e=Math.max(0,Math.min(g,l-.02));[m,h]=[m+(d-o)/p*e,h+(f-s)/p*e],g-=e;let t=a.map(e=>({...e,position:{x:e.position.x+m,y:e.position.y+h}}));l=j(t,u)}return{intent:{type:`models/move`,moves:a.map(e=>({id:e.id,to:{x:e.position.x+m,y:e.position.y+h}}))},as:t.owner,kind:`move`}}function je(e,t,n,r){let i=t.sheet?.weapons?.[n],a=e.units[r];if(!i||!a)return!0;let o=se(i);return o===null||j(T(e,t),T(e,a))<=o+.05}function Me(e,t,n){let r=e.sheet?.weapons?.[t]?.kind;return r===`melee`&&/shoot|fire/i.test(n)||r===`ranged`&&/fight|melee|strike/i.test(n)}function Ne(e){return Object.values(e.sheet?.weapons??{}).some(e=>e.kind===`ranged`&&!e.keywords.some(e=>/^assault$/i.test(e)))}function Pe(e,t,n){let r=/pile.?in|consolidat/i.test(n)?2:/withdraw|fall.?back|retreat|disengage/i.test(n)?6:0;if(!r)return!1;let i=T(e,t);return!Object.values(e.units).some(n=>y(e,n.owner,t.owner)&&x(e,n)&&j(i,T(e,n))<=r)}function Fe(e,t,n,r){let i=null,a=1/0;for(let o of Object.values(e.units)){if(!y(e,o.owner,t.owner)||!x(e,o))continue;let s=o.modelIds.map(t=>e.models[t]).filter(e=>e&&!e.destroyed),c=s.reduce((e,t)=>e+t.position.x,0)/s.length,l=s.reduce((e,t)=>e+t.position.y,0)/s.length,u=Math.hypot(c-n,l-r);u<a&&([i,a]=[{x:c,y:l},u])}return i}function Ie(e,t,n){return J(e,t,n).filter(e=>e.kind===`stack`)}function J(e,t,n){if(e.system!==`conquest-hand`)return[];let r=[];for(let a of n){let n=oe(e,a);if(!n){let n=z(t.rng,Object.values(e.units).filter(t=>t.owner===a&&x(e,t)).map(e=>e.id));if(!n.length||!t.tidy&&t.rng()<.3)continue;r.push({intent:{type:`secret/commit`,player:a,secrets:n.map((n,r)=>({key:ce(e.turn.round,r),commitment:B(t,n)})),label:`their command stack`},as:a,kind:`stack`});continue}let o=ae(e,n),s=o&&o.unitId===void 0?t.kept.get(o.commitment):void 0;o&&s&&!i(e).length&&r.push({intent:{type:`secret/reveal`,player:a,key:o.key,value:s.value,salt:s.salt,label:`their command card`},as:a,kind:`draw`})}return r}var Le={roll:0,slain:0,lost:0,target:``,engaged:0};function Y(e,t){let n=t=>e.players[t]?.seat,r=Object.values(e.units).filter(t=>T(e,t).length&&!t.status?.reserves);return r.filter(i=>n(i.owner)===t&&r.some(r=>n(r.owner)!==void 0&&n(r.owner)!==t&&j(T(e,i),T(e,r))<=1.05)).length}function Re(e,t,n,i){let a=new Set(d(t,i).map(e=>e.id)),o=r(e),s=_(e,n),c=e=>t.players[e]?.seat,l=0,u=0;for(let e of Object.values(t.models))e.destroyed&&!s.models[e.id]?.destroyed&&(c(e.owner)===i?u++:l++);let f=0,p=``,m=[];for(let r of e.events){if(o.has(r.seq))continue;let e=r.event;if(r.seq>n){let t=e.type===`script/step`?[e]:e.type===`procedure/clear`&&e.script?[e.script]:[];for(let e of t)for(let t of e.events)t.type===`log/note`&&m.push(t.text)}if(!a.has(r.by))continue;e.type===`dice/roll`&&r.seq>n&&(f=e.roll.results.reduce((e,t)=>e+t,0));let i=e.type===`attack/declare`?e.attack.spec.targetUnitId:e.type===`action/take`?e.targetId:void 0;i&&t.units[i]&&(p=t.units[i].name)}return{roll:f,slain:l,lost:u,target:p,engaged:Y(t,i),said:m.join(`
`)}}function ze(e){let t=[e.type];return e.type===`dice/roll`&&e.roll.label&&t.push(`roll:${e.roll.label}`),(e.type===`action/take`||e.type===`player/action`)&&t.push(e.action),e.type===`attack/declare`&&t.push(`attack:${e.attack.spec.kind}`),e.type===`attack/roll`&&e.attack.stage===`done`&&t.push(`attack:done`),e.type===`script/step`&&e.started&&t.push(e.started),t}function Be(e){return e.type===`attack/roll`?e.attack.spec.attackerUnitId:``}function Ve(e,t){let n=e.script?.waiting;return n?e.players[n.player]?.seat===t:e.pending?e.pending.seat===t:e.turn.activeSeat===t}function X(e,t){let{state:n,you:r}=t,i=1-r;return`any`in e?e.any.some(e=>X(e,t)):`all`in e?e.all.every(e=>X(e,t)):`did`in e?(Array.isArray(e.did)?e.did:[e.did]).some(e=>t.did.has(e)):`phase`in e?n.turn.round>0&&c(n)?.id===e.phase&&n.turn.activeSeat===(e.side===`them`?i:r):`round`in e?n.turn.round>=e.round:`over`in e?n.turn.round>0&&V(n):`yourTurn`in e?n.turn.round>0&&!Ve(n,i)&&n.turn.activeSeat===r:`theirTurn`in e?n.turn.round>0&&n.turn.activeSeat===i:`engaged`in e&&Y(n,r)>0}function He(e,t,n,i,a=!1){let o=e.you??0,s=new Set(d(i,o).map(e=>e.id)),c=r(n),{step:l}=t,u=[...t.began],{facts:f,said:p}=t,m=a;for(;;){let t=e.steps[l];if(!t)break;let r=u[l]??i.seq;if(u[l]===void 0&&t.if&&!he(t.if,{...f??Le,engaged:Y(i,o)})){u[l]=r,l++;continue}u[l]=r;let a,d=!1;if(!t.until||m)a=m,d=m&&!!t.until,m=!1;else{let e=new Set;for(let t of n.events)if(t.seq>r&&!c.has(t.seq)&&s.has(t.by))for(let n of ze(t.event))(n!==`attack:done`||s.has(i.units[Be(t.event)]?.owner??``))&&e.add(n);a=X(t.until,{did:e,state:i,you:o})}if(!a)break;f=Re(n,i,r,o),p=d?void 0:ge(t,f),l++}return{step:l,began:u.slice(0,l+1),...f?{facts:f}:{},said:p??null}}var Ue=e({backToLobby:()=>Ke,coachTick:()=>$,computerPlays:()=>We,leaveLesson:()=>Q,redoStep:()=>qe,startLesson:()=>Ge,useCoach:()=>Z}),Z=t(()=>({lesson:null,free:!1,progress:{step:0,began:[]},bot:{rng:Math.random,kept:new Map,idle:0,tidy:!0},initial:null}));function We(e,t){if(re(e,t))return!0;let{lesson:n}=Z.getState();return!n||!t||!e.players[t]?!1:!d(e,n.you??0).some(e=>e.id===t)}function Ge(e){let t=P(e);if(!t)return;A.getState().start({role:`host`,mode:`hotseat`,name:localStorage.getItem(`open-battle:name`)??``,system:t});let n=0,r=()=>{let{game:i}=A.getState();if(E(i).length<2||(i.system??`forty-k-11`)!==t){n++<40&&setTimeout(r,50);return}let{dispatch:a}=A.getState();de(e,()=>A.getState().game,a,crypto.randomUUID().slice(0,6)),fe.setState({hint:!1}),Z.setState({lesson:e,free:!1,progress:{step:0,began:[]},bot:{rng:M(Date.now()%2**31),kept:new Map,idle:0,tidy:!0},initial:A.getState().record.initial}),$()};r()}function Q(){Z.setState({lesson:null,free:!1,initial:null})}function Ke(){Q(),A.getState().session?.leave(),A.setState({session:null,role:null,scrub:null,selected:null,draft:null})}function $(e=!1){let{lesson:t,progress:n}=Z.getState();if(!t)return;let{record:r,game:i,select:a}=A.getState(),o=He(t,n,r,i,e);if(o.step===n.step&&o.began.length===n.began.length)return;Z.setState({progress:o});let s=t.steps[o.step]?.show;if(s&&o.began.length!==n.began.length){let e=new Set(Object.values(i.players).filter(e=>e.seat===s.seat).map(e=>e.id)),t=Object.values(i.units).filter(t=>e.has(t.owner))[s.unit];t&&a(t.id)}}function qe(){let{progress:e}=Z.getState(),t=e.began[e.step];t!==void 0&&(pe(t,`hotseat`),Z.setState({initial:A.getState().record.initial}))}export{P as A,Te as C,be as D,F as E,N as O,H as S,Me as T,W as _,qe as a,je as b,ze as c,q as d,J as f,Ie as g,xe as h,Q as i,M as j,_e as k,Ve as l,Se as m,$ as n,Ue as o,Ee as p,We as r,Z as s,Ke as t,V as u,L as v,we as w,I as x,Pe as y};