import{n as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./react-hsrUxga6.js";import{C as n,Dr as r,E as i,Et as a,Ft as o,Jn as s,Kn as c,Kt as l,Ot as u,R as d,S as f,Tt as p,Ut as m,Vt as h,Y as g,Yn as _,Yt as v,an as y,at as b,dr as x,gn as S,kt as ee,qt as te,sr as C,u as w,vn as T,w as E,wt as D,x as O,zr as ne,zt as re}from"./core-CbuythNH.js";import{O as ie,d as k}from"./store-DJlRyvtI.js";import{u as ae}from"./systemLabels-DQTsKNRs.js";import"./gameLog-d3t58IbN.js";import{I as A,Q as oe,Y as se,Z as ce,o as le,r as ue,z as de}from"./systems-DxVnTc9_.js";import{a as fe,c as pe,i as me,n as he,t as ge}from"./lesson-DvSc7yas.js";import{r as _e}from"./Branch-DYnBhGgE.js";function j(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var M=[`// A lesson package for Open Battle's teaching mode: a guided first turn of the
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
`];function ve(e=M){return e.flatMap(e=>{let t=me(e);return`error`in t?[]:[t]})}function N(e){return y().find(t=>ae(e.system,t.id))?.id}function ye(e){let t=n(e),r=[],i=e.initial;for(let n of e.events){if(t.has(n.seq))continue;let e=i;if(i={...E(i,n.event),seq:n.seq},n.event.type===`turn/prev`||e.turn.round===0||i.turn.round<=e.turn.round&&i.turn.phase===e.turn.phase)continue;let a=m(e);if(a?.id&&r.push({kind:`phaseEnd`,phase:a.id,seat:e.turn.activeSeat,round:e.turn.round,state:e,seq:n.seq}),i.turn.round>e.turn.round){r.push({kind:`roundEnd`,round:e.turn.round,state:e,seq:n.seq});let t=v(i).turn.rounds;typeof t==`number`&&i.turn.round>t&&r.push({kind:`gameEnd`,round:e.turn.round,state:e,seq:n.seq})}}return r}var be=(e,t)=>`phaseEnd`in e?t.kind===`phaseEnd`&&t.phase===e.phaseEnd&&t.round>=(e.fromRound??1):`roundEnd`in e?t.kind===`roundEnd`&&t.round>=(e.fromRound??1):t.kind===`gameEnd`;function P(e,t,n){if(!n)return[];let r=new Set((t.scores??[]).map(e=>e.key)),i=[],a=ye(e),o=a.find(e=>e.kind===`gameEnd`)?.seq??1/0,s=new Set(e.events.flatMap(({seq:e,event:t})=>e>o&&t.type===`secret/reveal`&&t.key.startsWith(`mission:`)?[`${t.key}:${String(t.value)}`]:[]));for(let e of a)for(let a of n.scoring)if(be(a.at,e))for(let n of e.kind===`phaseEnd`?[e.seat]:_(e.state)){let o=`${a.id}:${e.round}:${n}`;if(r.has(o))continue;let s=!!t.settings.companion&&a.measures!==!1,c=s?{vp:0,why:a.ask?.question??ne(`count it on your table`)}:a.suggest(e.state,n);c&&i.push({key:o,seat:n,round:e.round,rule:a.name,...c,guessed:!s,...s&&a.ask?{ask:a.ask}:{}})}for(let[e,a]of Object.entries(t.secrets??{})){let o=t.players[e]?.seat;if(o!==void 0)for(let[c,l]of Object.entries(a)){if(!c.startsWith(`mission:`)||!l.revealed)continue;let a=`card:${e}:${c}`;if(r.has(a))continue;let u=n.deck?.find(e=>e.id===l.revealed.value);if(!u||s.has(`${c}:${u.id}`))continue;let d=!!t.settings.companion,f=d?{vp:0,why:u.ask?.question??u.text}:u.suggest(t,o);i.push({key:a,seat:o,round:t.turn.round,rule:u.name,...f,guessed:!d,...d&&u.ask?{ask:u.ask}:{}})}}return i}function xe(e){let t={},n=new Set;for(let r of e.scores??[])r.vp&&(n.add(r.round),t[r.seat]??={},t[r.seat][r.round]=(t[r.seat][r.round]??0)+r.vp);let r=[...n],i=Math.min(...r),a=Math.max(...r);return{rounds:r.length?Array.from({length:a-i+1},(e,t)=>i+t):[],bySeat:t}}function Se(e){return e.filter(e=>!(e.guessed&&!e.ask&&e.vp===0))}function Ce(e,t,n){if(!e.tidy||n.intent.type!==`action/take`)return;let r=I(t);e.taken?.phase!==r&&(e.taken={phase:r,keys:new Set}),e.taken.keys.add(F(t,n.intent.unitId,n.intent.action))}function F(e,t,n){let r=v(e).actions.find(e=>e.id===n);return`${t}:${r&&(r.move&&!/pile|consolidat|charge/i.test(r.move.kind)||(r.sets??[]).includes(`stationary`))?`move`:n}`}function I(e){return`${e.turn.round}:${e.turn.activeSeat}:${e.turn.phase}`}var L=(e,t)=>t[Math.floor(e()*t.length)],R=(e,t)=>{let n=[...t];for(let t=n.length-1;t>0;t--){let r=Math.floor(e()*(t+1));[n[t],n[r]]=[n[r],n[t]]}return n};function we(e,t,n){try{return!!O(e,n.intent,n.as,()=>.5,0,t)}catch{return!1}}function z(e,t){let n=Math.floor(e.rng()*2**48).toString(16).padStart(12,`0`),i=r(t,n);return e.kept.set(i,{value:t,salt:n}),i}var Te=e=>{let t=v(e).turn.rounds;return typeof t==`number`?t:5},B=e=>e.turn.round>Te(e),Ee=e=>e.reaction?{...e,reaction:null}:e;function De(e,t,n){let r=Object.values(t.players).filter(e=>e.seat!==void 0),i=(e,t,n)=>[...n?[n]:[],...r.map(e=>e.id).filter(e=>e!==n)].map(n=>({intent:e,as:n,kind:t})),a=t.script?.waiting;if(a){if(a.reveal!==void 0){let e=t.secrets?.[a.player]?.[a.reveal]?.commitment,r=e?n.kept.get(e):void 0;return{what:`a reveal of ${a.reveal} by ${a.player}`,moves:r?[{intent:{type:`script/answer`,answer:JSON.stringify(r)},as:a.player,kind:`reveal`}]:[]}}let e=R(n.rng,a.options);return{what:`"${a.question}" for ${a.player}`,moves:e.map(e=>({intent:{type:`script/answer`,answer:a.secret===void 0?e.id:z(n,e.id)},as:a.player,kind:`answer`}))}}let c=t.procedure;if(c){let e=c.run;if(e.pending){let t=[...R(n.rng,e.pending.options.map(e=>e.id)),`pass`];return n.rng()<.5&&t.unshift(`pass`),{what:`the ${e.pending.step} window`,moves:t.flatMap(e=>i({type:`procedure/respond`,answer:e},`respond`))}}return{what:`the ${c.action} roll`,moves:i(e.done?{type:`procedure/clear`}:{type:`procedure/roll`},`roll`,!e.done&&w(t,e)||c.by)}}let l=t.reaction;if(l){let e=s(t,l.seat),r=[];if(n.weighing||n.rng()<.4)for(let i of e)for(let e of g(t,i.id)){let t=e.units.length?e.units[Math.floor(n.rng()*e.units.length)]:void 0,a=e.needsUnit&&t?{...e.play,targetId:t}:e.play;r.push({intent:a,as:i.id,kind:`react`})}return{what:`the ${l.window} reaction window`,moves:[...r,...e.map(e=>({intent:{type:`reaction/pass`},as:e.id,kind:`pass`}))]}}let u=t.attack;if(u)return{what:`the attack`,moves:i(u.stage===`done`?{type:`attack/clear`}:{type:`attack/roll`},`attack`,t.units[u.stage===`save`?u.spec.targetUnitId:u.spec.attackerUnitId]?.owner)};let d=t.pending;if(d){let e=s(t,d.seat),r=[];if(n.weighing||n.rng()<.4){for(let i of R(n.rng,Object.values(t.units)))if(e.some(e=>e.id===i.owner)&&T(t,i)&&!i.status?.reserves)for(let e of o(t,i.id))e.ok&&e.def.reactTo&&r.push({intent:{type:`action/take`,unitId:i.id,action:e.def.id},as:i.owner,kind:`react`})}return{what:`a reaction`,moves:[...r,...e.map(e=>({intent:{type:`reaction/pass`},as:e.id,kind:`pass`}))]}}let f=ue(t.system)?.app?.missions?.find(e=>e.id===t.mission?.id),p=e.events.at(-1)?.event.type;if(n.weighing)return null;f&&(n.scores===void 0||p===`turn/next`||p===`turn/ready`||p===`score/confirm`||p===`secret/reveal`)&&(n.scores=P(e,t,f).map(e=>e.key));let m=f&&n.scores?.length?P(e,t,f)[0]:void 0;if(m){let e=n.rng()<.2,r={type:`score/confirm`,key:m.key,seat:m.seat,round:m.round,vp:e?0:m.vp,why:m.why,...e?{skipped:!0}:{}};return{what:`the score ${m.key}`,moves:s(t,m.seat).map(e=>({intent:r,as:e.id,kind:`score`}))}}return null}function*Oe(e,t){let n=e.turn.round,r=n>0&&re(e),i=r?Object.values(e.players).filter(e=>e.seat!==void 0):s(e,e.turn.activeSeat),c=t=>n===0?e.players[t]?.seat!==void 0:i.some(e=>e.id===t),d=R(t.rng,Object.values(e.units).filter(t=>c(t.owner)&&T(e,t)&&!t.status?.reserves)),f=D(e),p=n>0&&l(e)?Object.values(e.units).filter(t=>c(t.owner)&&T(e,t)&&t.status?.reserves):[],h=n>0&&t.tidy&&!f.length&&l(e)?[...d,...p].find(e=>!e.status?.activated&&!e.status?.acting):void 0,g=h?[{intent:{type:`turn/endActivation`,unit:h.id},as:h.owner,kind:`endActivation`}]:r?ke(e,t):[...n>0&&!l(e)&&te(e)?i.map(e=>({intent:{type:`turn/pass`},as:e.id,kind:`pass`})):[],...i.map(e=>({intent:{type:`turn/next`},as:e.id,kind:`next`}))];if(n===0){d[0]&&t.rng()<.3&&(yield*W(e,G(e,d[0],t,4))),yield*g;for(let t of Object.values(e.players))yield{intent:{type:`turn/next`},as:t.id,kind:`next`};return}yield*q(e,t,i.map(e=>e.id));let _=ee(v(e));if(_&&t.rng()<.5)for(let t of i){if(!u(e,t.id))continue;let n=e.pools?.[t.id]?.[_]??[],r=d.find(e=>e.owner===t.id);for(let i of Object.keys(r?.sheet?.weapons??{}))for(let o=0;o<n.length;o++)r&&!a(e,t.id,r.id,i,o)&&(yield{intent:{type:`dice/place`,unitId:r.id,weapon:i,index:o},as:t.id,kind:`place`})}let y=m(e)?.id??``;if(/move/i.test(y)&&t.rng()<.3&&(yield*H(e,t,d,/join/i)),t.tidy&&/move/i.test(y)){let r=`${n}:${e.turn.activeSeat}:${e.turn.phase}`;t.moved?.phase!==r&&(t.moved={phase:r,units:new Set});let i=(f.length?f:d).find(e=>!t.moved.units.has(e.id));i&&!o(e,i.id).some(e=>e.ok&&e.move!==void 0)&&(t.moved.units.add(i.id),yield*W(e,G(e,i,t,6)))}let b=Ae(e,t);b&&(yield b);let x=!1,S=function*(){for(let n of f.length?f:d)for(let r of V(e,n,t))x=!0,yield r},C=t.tidy?6:40,w=t.tidy?Math.min(.9,.15+t.idle*.12):Math.min(.9,.05+t.idle*.04),E=f.map(e=>({intent:{type:`turn/endActivation`},as:e.owner,kind:`endActivation`}));if(/combat|fight/i.test(m(e)?.id??``)&&(t.rng()<.5&&(yield*H(e,t,d,/challenge/i)),yield*H(e,t,d)),t.wholeGame&&t.idle<6){let r=[...H(e,t,f.length?f:[...p,...d])],i=f.some(e=>e.status?.actionBudget!==void 0)&&t.rng()<.4;i||(yield*r);let a=(f.length?f:d)[Math.floor(t.rng()*(f.length||d.length))];t.went?.round!==n&&(t.went={round:n,units:new Set}),a&&!(t.tidy&&t.went.units.has(a.id))&&(t.went.units.add(a.id),yield*W(e,(t.rng()<.25?L(t.rng,U(e,a,12)):void 0)??G(e,a,{...t,tidy:!0},6))),i&&(yield*r)}/move/i.test(m(e)?.id??``)&&t.rng()<.5&&(yield*H(e,t,d,/charge|march|join|leave/i)),/move/i.test(m(e)?.id??``)&&t.rng()<.3&&(yield*H(e,t,d,/leave/i));let O=t.rng();if(O<.6?yield*S():O<.75?yield*H(e,t,d):O<.8?yield*Me(e,t,i.map(e=>e.id)):O<.95&&d[0]&&!t.tidy&&(yield*W(e,G(e,d[0],t,6))),t.rng()<w&&(yield*E),t.idle>C&&t.rng()<w&&(yield*g),yield*S(),yield*E,!x||t.idle>C){if(yield*g,r&&t.tidy)for(let t of s(e,e.turn.activeSeat))yield{intent:{type:`turn/next`},as:t.id,kind:`next`};else for(let e of i)yield{intent:{type:`turn/pass`},as:e.id,kind:`pass`}}yield*g}function ke(e,t){let n=(e,t=!0)=>({intent:t?{type:`turn/ready`}:{type:`turn/ready`,ready:!1},as:e,kind:t?`ready`:`unready`}),r=R(t.rng,h(e)).map(e=>n(e));if(t.tidy)return r;let i=t.rng(),a=e.turn.ready??[];return i<.1?[{intent:{type:`turn/next`},as:e.turn.ready?.[0]??h(e)[0],kind:`next`},...r]:i<.15&&a.length?[n(a[0],!1),...r]:r}function*V(e,t,n){let r=n.taken?.phase===I(e)?n.taken.keys:void 0;for(let i of R(n.rng,o(e,t.id))){if(i.def.reactTo||n.tidy&&(r?.has(F(e,t.id,i.def.id))||Ie(e,t,i.def.id))||i.def.sets?.includes(`advanced`)&&Fe(t)&&(n.tidy||n.rng()<.75))continue;if(i.def.procedure){let r=Object.keys(t.sheet?.weapons??{}),a=p(e,t.id,i.def.id).filter(e=>e.ok),s=new Set(a.map(e=>e.unitId));for(let c of R(n.rng,r.length?r:[void 0]).slice(0,3)){let r=c&&n.rng()<.3,l=R(n.rng,r?p(e,t.id,i.def.id,c).filter(e=>e.ok):a);n.rng()<.5&&l.sort((e,t)=>Number(s.has(e.unitId))-Number(s.has(t.unitId)));for(let r of l.slice(0,2)){if(n.tidy&&c&&(!Ne(e,t,c,r.unitId)||Pe(t,c,i.def.id)))continue;let a={...c?{weapon:c}:{},targetId:r.unitId},s=o(e,t.id,a).find(e=>e.def.id===i.def.id);if(!s?.ok)continue;let u=l.filter(e=>e.unitId!==r.unitId).map(e=>e.unitId),d=s.repeat&&n.rng()<.7?u.slice(0,s.repeat-1):[];yield{intent:{type:`action/take`,unitId:t.id,action:i.def.id,...a,...d.length?{more:d}:{}},as:t.owner,kind:`action:${i.def.id}`}}}continue}if(!i.ok)continue;let a=i.commands?R(n.rng,i.commands.candidates).slice(0,i.commands.count):[],s=i.def.target?L(n.rng,p(e,t.id,i.def.id).filter(e=>e.ok))?.unitId:void 0,c={intent:{type:`action/take`,unitId:t.id,action:i.def.id,...s?{targetId:s}:{},...a.length?{with:a}:{}},as:t.owner,kind:`action:${i.def.id}`},l=r=>i.def.move?.kind===`charge`?K(e,t,n,r,s):G(e,t,n,r);if(i.move===void 0&&/charge/i.test(i.def.id)){let r=le(e.system).chargeRoll;if(r&&s){n.charging={unitId:t.id,targetId:s,round:e.turn.round};let i={type:`dice/roll`,count:r.count,sides:r.sides,label:`charge roll`,unitId:t.id};yield{...c,then:{intent:i,as:t.owner,kind:`chargeRoll`}}}else yield{...c,then:K(e,t,n,8+Math.floor(n.rng()*6),s)};continue}if(n.tidy&&i.move!==void 0){yield{...c,then:l(Math.max(1,i.move))};continue}yield c,i.move!==void 0&&(yield l(Math.max(1,i.move)))}}function*H(e,t,n,r){if(e.script)return;let i=ue(e.system),a=m(e)?.id,o=i?d(e,i.system.id):null;for(let s of n.slice(0,4)){let n={player:s.owner,unitId:s.id},c=[...o?(i.actions??[]).filter(e=>e.by===`unit`&&(!e.phases||a&&e.phases.includes(a))).filter(e=>!e.applies||e.applies(o,n)).map(e=>{let t=e.available(o,n),r=t===!0&&e.targets?e.targets(o,n):[];return{id:e.id,available:t,targets:r,targeted:!!e.targets}}):[],...(t.packageActions?.(s.id,s.owner)??[]).map(e=>({...e,targeted:e.targets.length>0}))],l=R(t.rng,c).sort((e,t)=>Number(t.targeted)-Number(e.targeted));for(let n of l){if(n.available!==!0||r&&!r.test(n.id))continue;let i=/charge/i.test(n.id)&&t.rng()<.5?n.targets.filter(t=>je(e,t.unitId)):[],a=L(t.rng,i.length?i:n.targets)?.unitId;if(n.targeted&&!a)continue;let o={intent:{type:`script/start`,procedure:n.id,args:{unit:s.id,...a?{target:a}:{}}},as:s.owner,kind:`code:${n.id}`};yield/charge/i.test(n.id)&&a?{...o,then:K(e,s,t,24,a)}:o}}}function Ae(e,t){let n=t.charging;if(!n||n.round!==e.turn.round)return null;let r=e.units[n.unitId],a=e.units[n.targetId],o=e.modules?.[e.system??``]??{};if(!r?.status?.acting||!a||!T(e,a)||o[`short:${r.id}`]===n.round||o[`landed:${r.id}`]===n.round)return null;let s=i(e,r,a);return!s||s.distance<.05?null:{intent:{...s.move,how:`charge`},as:r.owner,kind:`chargeMove`}}function je(e,t){let n=t?e.units[t]:void 0;if(!n)return!1;let r=S(e,n);return Object.values(e.units).some(t=>c(e,t.owner,n.owner)&&S(e,t).length&&A(r,S(e,t))<.6)}function*Me(e,t,n){for(let r of n)for(let n of R(t.rng,b(e,r))){if(!n.ok||n.def.custom||t.tidy&&/re.?roll/i.test(n.def.id))continue;let e=n.targets?L(t.rng,n.targets):void 0;(!n.targets||e)&&(yield{intent:{type:`player/action`,action:n.def.id,...e?{targetId:e}:{}},as:r,kind:`stratagem:${n.def.id}`})}}function U(e,t,n){let r=S(e,t);if(!r.length)return[];let i={x:r.reduce((e,t)=>e+t.position.x,0)/r.length,y:r.reduce((e,t)=>e+t.position.y,0)/r.length},a=r[0].z??0,o=[];for(let t of e.terrain)for(let e of t.solids){if(e.kind!==`floor`&&e.kind!==`block`)continue;let r=Math.round((e.z+e.h)*100)/100;if(r<1||Math.abs(r-a)<.3)continue;let s=x(t,{x:e.x,y:e.y}),c=Math.hypot(s.x-i.x,s.y-i.y)+Math.abs(r-a);c<=n+.05&&o.push({d:c,at:s,top:r})}return o.sort((e,t)=>e.d-t.d).slice(0,3).flatMap(({at:n,top:a})=>{let o=r.map(t=>{let r={x:n.x+t.position.x-i.x,y:n.y+t.position.y-i.y};return{id:t.id,to:r,z:C(e.terrain,r,a)}});return o.some(e=>Math.abs(e.z-a)>.05)?[]:[{intent:{type:`models/move`,moves:o},as:t.owner,kind:`move`}]})}function*W(e,t){if(t.intent.type!==`models/move`)return void(yield t);t.intent.moves.some(t=>{let n=e.models[t.id]?.position;return!n||Math.hypot(n.x-t.to.x,n.y-t.to.y)>.1})&&(yield t)}function G(e,t,n,r){let i=t.modelIds.map(t=>e.models[t]).filter(e=>e&&!e.destroyed),a=i.reduce((e,t)=>e+t.position.x,0)/i.length,o=i.reduce((e,t)=>e+t.position.y,0)/i.length,s=n.tidy?Le(e,t,a,o):null,c=s?Math.atan2(s.x-a,s.y-o)+(n.rng()-.5)*.6:n.rng()*Math.PI*2,l=s?Math.max(0,Math.min(Math.hypot(s.x-a,s.y-o)-3,r*(.6+.4*n.rng()))):n.rng()*r,u=e.table.width/2-2,d=e.table.depth/2-2,f=(e,t)=>Math.max(-t,Math.min(t,e)),p=f(a+Math.sin(c)*l,u)-a,m=f(o+Math.cos(c)*l,d)-o;return{intent:{type:`models/move`,moves:i.map(e=>({id:e.id,to:{x:e.position.x+p,y:e.position.y+m}}))},as:t.owner,kind:`move`}}function K(e,t,n,r,i){let a=S(e,t),o=a.reduce((e,t)=>e+t.position.x,0)/a.length,s=a.reduce((e,t)=>e+t.position.y,0)/a.length,l,u=1/0;for(let n of Object.values(e.units)){if(!c(e,n.owner,t.owner)||!T(e,n)||i&&n.id!==i)continue;let r=A(a,S(e,n));r<u&&([l,u]=[n,r])}if(!l)return G(e,t,n,r);let d=S(e,l),f=d.reduce((e,t)=>e+t.position.x,0)/d.length,p=d.reduce((e,t)=>e+t.position.y,0)/d.length,m=Math.hypot(f-o,p-s)||1,[h,g]=[0,0],_=r;for(let e=0;e<8&&_>.01&&u>.05;e++){let e=Math.max(0,Math.min(_,u-.02));[h,g]=[h+(f-o)/m*e,g+(p-s)/m*e],_-=e;let t=a.map(e=>({...e,position:{x:e.position.x+h,y:e.position.y+g}}));u=A(t,d)}return{intent:{type:`models/move`,moves:a.map(e=>({id:e.id,to:{x:e.position.x+h,y:e.position.y+g}}))},as:t.owner,kind:`move`}}function Ne(e,t,n,r){let i=t.sheet?.weapons?.[n],a=e.units[r];if(!i||!a)return!0;let o=de(i);return o===null||A(S(e,t),S(e,a))<=o+.05}function Pe(e,t,n){let r=e.sheet?.weapons?.[t]?.kind;return r===`melee`&&/shoot|fire/i.test(n)||r===`ranged`&&/fight|melee|strike/i.test(n)}function Fe(e){return Object.values(e.sheet?.weapons??{}).some(e=>e.kind===`ranged`&&!e.keywords.some(e=>/^assault$/i.test(e)))}function Ie(e,t,n){let r=/pile.?in|consolidat/i.test(n)?2:/withdraw|fall.?back|retreat|disengage/i.test(n)?6:0;if(!r)return!1;let i=S(e,t);return!Object.values(e.units).some(n=>c(e,n.owner,t.owner)&&T(e,n)&&A(i,S(e,n))<=r)}function Le(e,t,n,r){let i=null,a=1/0;for(let o of Object.values(e.units)){if(!c(e,o.owner,t.owner)||!T(e,o))continue;let s=o.modelIds.map(t=>e.models[t]).filter(e=>e&&!e.destroyed),l=s.reduce((e,t)=>e+t.position.x,0)/s.length,u=s.reduce((e,t)=>e+t.position.y,0)/s.length,d=Math.hypot(l-n,u-r);d<a&&([i,a]=[{x:l,y:u},d])}return i}function Re(e,t,n){return q(e,t,n).filter(e=>e.kind===`stack`)}function q(e,t,n){if(e.system!==`conquest-hand`)return[];let r=[];for(let i of n){let n=oe(e,i);if(!n){let n=R(t.rng,Object.values(e.units).filter(t=>t.owner===i&&T(e,t)).map(e=>e.id));if(!n.length||!t.tidy&&t.rng()<.3)continue;r.push({intent:{type:`secret/commit`,player:i,secrets:n.map((n,r)=>({key:se(e.turn.round,r),commitment:z(t,n)})),label:`their command stack`},as:i,kind:`stack`});continue}let a=ce(e,n),o=a&&a.unitId===void 0?t.kept.get(a.commitment):void 0;a&&o&&!D(e).length&&r.push({intent:{type:`secret/reveal`,player:i,key:a.key,value:o.value,salt:o.salt,label:`their command card`},as:i,kind:`draw`})}return r}var ze={roll:0,slain:0,lost:0,target:``,engaged:0};function J(e,t){let n=t=>e.players[t]?.seat,r=Object.values(e.units).filter(t=>S(e,t).length&&!t.status?.reserves);return r.filter(i=>n(i.owner)===t&&r.some(r=>n(r.owner)!==void 0&&n(r.owner)!==t&&A(S(e,i),S(e,r))<=1.05)).length}function Be(e,t,r,i){let a=new Set(s(t,i).map(e=>e.id)),o=n(e),c=f(e,r),l=e=>t.players[e]?.seat,u=0,d=0;for(let e of Object.values(t.models))e.destroyed&&!c.models[e.id]?.destroyed&&(l(e.owner)===i?d++:u++);let p=0,m=``,h=[];for(let n of e.events){if(o.has(n.seq))continue;let e=n.event;if(n.seq>r){let t=e.type===`script/step`?[e]:e.type===`procedure/clear`&&e.script?[e.script]:[];for(let e of t)for(let t of e.events)t.type===`log/note`&&h.push(t.text)}if(!a.has(n.by))continue;e.type===`dice/roll`&&n.seq>r&&(p=e.roll.results.reduce((e,t)=>e+t,0));let i=e.type===`attack/declare`?e.attack.spec.targetUnitId:e.type===`action/take`?e.targetId:void 0;i&&t.units[i]&&(m=t.units[i].name)}return{roll:p,slain:u,lost:d,target:m,engaged:J(t,i),said:h.join(`
`)}}function Ve(e){let t=[e.type];return e.type===`dice/roll`&&e.roll.label&&t.push(`roll:${e.roll.label}`),(e.type===`action/take`||e.type===`player/action`)&&t.push(e.action),e.type===`attack/declare`&&t.push(`attack:${e.attack.spec.kind}`),e.type===`attack/roll`&&e.attack.stage===`done`&&t.push(`attack:done`),e.type===`script/step`&&e.started&&t.push(e.started),t}function He(e){return e.type===`attack/roll`?e.attack.spec.attackerUnitId:``}function Ue(e,t){let n=e.script?.waiting;return n?e.players[n.player]?.seat===t:e.pending?e.pending.seat===t:e.turn.activeSeat===t}function Y(e,t){let{state:n,you:r}=t,i=1-r;return`any`in e?e.any.some(e=>Y(e,t)):`all`in e?e.all.every(e=>Y(e,t)):`did`in e?(Array.isArray(e.did)?e.did:[e.did]).some(e=>t.did.has(e)):`phase`in e?n.turn.round>0&&m(n)?.id===e.phase&&n.turn.activeSeat===(e.side===`them`?i:r):`round`in e?n.turn.round>=e.round:`over`in e?n.turn.round>0&&B(n):`yourTurn`in e?n.turn.round>0&&!Ue(n,i)&&n.turn.activeSeat===r:`theirTurn`in e?n.turn.round>0&&n.turn.activeSeat===i:`engaged`in e&&J(n,r)>0}function We(e,t,r,i,a=!1){let o=e.you??0,c=new Set(s(i,o).map(e=>e.id)),l=n(r),{step:u}=t,d=[...t.began],{facts:f,said:p}=t,m=a;for(;;){let t=e.steps[u];if(!t)break;let n=d[u]??i.seq;if(d[u]===void 0&&t.if&&!he(t.if,{...f??ze,engaged:J(i,o)})){d[u]=n,u++;continue}d[u]=n;let a,s=!1;if(!t.until||m)a=m,s=m&&!!t.until,m=!1;else{let e=new Set;for(let t of r.events)if(t.seq>n&&!l.has(t.seq)&&c.has(t.by))for(let n of Ve(t.event))(n!==`attack:done`||c.has(i.units[He(t.event)]?.owner??``))&&e.add(n);a=Y(t.until,{did:e,state:i,you:o})}if(!a)break;f=Be(r,i,n,o),p=s?void 0:ge(t,f),u++}return{step:u,began:d.slice(0,u+1),...f?{facts:f}:{},said:p??null}}var Ge=e({backToLobby:()=>Je,coachTick:()=>Q,computerPlays:()=>Ke,leaveLesson:()=>Z,redoStep:()=>$,startLesson:()=>qe,useCoach:()=>X}),X=t(()=>({lesson:null,free:!1,progress:{step:0,began:[]},bot:{rng:Math.random,kept:new Map,idle:0,tidy:!0},initial:null}));function Ke(e,t){if(ie(e,t))return!0;let{lesson:n}=X.getState();return!n||!t||!e.players[t]?!1:!s(e,n.you??0).some(e=>e.id===t)}function qe(e){let t=N(e);if(!t)return;k.getState().start({role:`host`,mode:`hotseat`,name:localStorage.getItem(`open-battle:name`)??``,system:t});let n=0,r=()=>{let{game:i}=k.getState();if(_(i).length<2||(i.system??`forty-k-11`)!==t){n++<40&&setTimeout(r,50);return}let{dispatch:a}=k.getState();pe(e,()=>k.getState().game,a,crypto.randomUUID().slice(0,6)),fe.setState({hint:!1}),X.setState({lesson:e,free:!1,progress:{step:0,began:[]},bot:{rng:j(Date.now()%2**31),kept:new Map,idle:0,tidy:!0},initial:k.getState().record.initial}),Q()};r()}function Z(){X.setState({lesson:null,free:!1,initial:null})}function Je(){Z(),k.getState().session?.leave(),k.setState({session:null,role:null,scrub:null,selected:null,draft:null})}function Q(e=!1){let{lesson:t,progress:n}=X.getState();if(!t)return;let{record:r,game:i,select:a}=k.getState(),o=We(t,n,r,i,e);if(o.step===n.step&&o.began.length===n.began.length)return;X.setState({progress:o});let s=t.steps[o.step]?.show;if(s&&o.began.length!==n.began.length){let e=new Set(Object.values(i.players).filter(e=>e.seat===s.seat).map(e=>e.id)),t=Object.values(i.units).filter(t=>e.has(t.owner))[s.unit];t&&a(t.id)}}function $(){let{progress:e}=X.getState(),t=e.began[e.step];t!==void 0&&(_e(t,`hotseat`),X.setState({initial:k.getState().record.initial}))}export{ve as A,De as C,Se as D,P as E,j as M,xe as O,V as S,Pe as T,U as _,$ as a,Ne as b,Ve as c,K as d,q as f,Re as g,Ce as h,Z as i,N as j,M as k,Ue as l,we as m,Q as n,Ge as o,Oe as p,Ke as r,X as s,Je as t,B as u,I as v,Ee as w,F as x,Ie as y};