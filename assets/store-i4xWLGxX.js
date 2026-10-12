import{n as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./react-hsrUxga6.js";import{Bt as n,C as r,Cr as i,Ct as a,Dt as o,E as s,Fr as c,Gn as l,Gt as u,Hn as d,Ht as f,J as p,Jt as m,Kt as h,L as g,Ot as _,Pt as v,Rt as ee,S as y,Tt as te,Wn as b,hn as x,in as S,it as C,pn as w,rr as T,sr as E,u as D,w as O,wt as k,x as ne}from"./core-DoB44smz.js";import{O as re,d as A}from"./store-Cq2fXzZQ.js";import{u as ie}from"./systemLabels-DkcyEaVU.js";import"./gameLog-dFk5iafm.js";import{O as j,j as ae,o as oe,r as M}from"./systems-qTlcFxwS.js";import{a as se,c as ce,i as le,n as ue,t as de}from"./lesson-CBcRYlia.js";import{r as fe}from"./Branch-DOxvuqTG.js";function N(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var P=[`// A lesson package for Open Battle's teaching mode: a guided first turn of the
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
`];function pe(e=P){return e.flatMap(e=>{let t=le(e);return`error`in t?[]:[t]})}function F(e){return S().find(t=>ie(e.system,t.id))?.id}function me(e){let t=r(e),n=[],i=e.initial;for(let r of e.events){if(t.has(r.seq))continue;let e=i;if(i={...O(i,r.event),seq:r.seq},r.event.type===`turn/prev`||e.turn.round===0||i.turn.round<=e.turn.round&&i.turn.phase===e.turn.phase)continue;let a=f(e);if(a?.id&&n.push({kind:`phaseEnd`,phase:a.id,seat:e.turn.activeSeat,round:e.turn.round,state:e,seq:r.seq}),i.turn.round>e.turn.round){n.push({kind:`roundEnd`,round:e.turn.round,state:e,seq:r.seq});let t=m(i).turn.rounds;typeof t==`number`&&i.turn.round>t&&n.push({kind:`gameEnd`,round:e.turn.round,state:e,seq:r.seq})}}return n}var he=(e,t)=>`phaseEnd`in e?t.kind===`phaseEnd`&&t.phase===e.phaseEnd&&t.round>=(e.fromRound??1):`roundEnd`in e?t.kind===`roundEnd`&&t.round>=(e.fromRound??1):t.kind===`gameEnd`;function I(e,t,n){if(!n)return[];let r=new Set((t.scores??[]).map(e=>e.key)),i=[],a=me(e),o=a.find(e=>e.kind===`gameEnd`)?.seq??1/0,s=new Set(e.events.flatMap(({seq:e,event:t})=>e>o&&t.type===`secret/reveal`&&t.key.startsWith(`mission:`)?[`${t.key}:${String(t.value)}`]:[]));for(let e of a)for(let a of n.scoring)if(he(a.at,e))for(let n of e.kind===`phaseEnd`?[e.seat]:l(e.state)){let o=`${a.id}:${e.round}:${n}`;if(r.has(o))continue;let s=!!t.settings.companion&&a.measures!==!1,l=s?{vp:0,why:a.ask?.question??c(`count it on your table`)}:a.suggest(e.state,n);l&&i.push({key:o,seat:n,round:e.round,rule:a.name,...l,guessed:!s,...s&&a.ask?{ask:a.ask}:{}})}for(let[e,a]of Object.entries(t.secrets??{})){let o=t.players[e]?.seat;if(o!==void 0)for(let[c,l]of Object.entries(a)){if(!c.startsWith(`mission:`)||!l.revealed)continue;let a=`card:${e}:${c}`;if(r.has(a))continue;let u=n.deck?.find(e=>e.id===l.revealed.value);if(!u||s.has(`${c}:${u.id}`))continue;let d=!!t.settings.companion,f=d?{vp:0,why:u.ask?.question??u.text}:u.suggest(t,o);i.push({key:a,seat:o,round:t.turn.round,rule:u.name,...f,guessed:!d,...d&&u.ask?{ask:u.ask}:{}})}}return i}function ge(e){let t={},n=new Set;for(let r of e.scores??[])r.vp&&(n.add(r.round),t[r.seat]??={},t[r.seat][r.round]=(t[r.seat][r.round]??0)+r.vp);let r=[...n],i=Math.min(...r),a=Math.max(...r);return{rounds:r.length?Array.from({length:a-i+1},(e,t)=>i+t):[],bySeat:t}}function _e(e){return e.filter(e=>!(e.guessed&&!e.ask&&e.vp===0))}function ve(e,t,n){if(!e.tidy||n.intent.type!==`action/take`)return;let r=R(t);e.taken?.phase!==r&&(e.taken={phase:r,keys:new Set}),e.taken.keys.add(L(t,n.intent.unitId,n.intent.action))}function L(e,t,n){let r=m(e).actions.find(e=>e.id===n);return`${t}:${r&&(r.move&&!/pile|consolidat|charge/i.test(r.move.kind)||(r.sets??[]).includes(`stationary`))?`move`:n}`}function R(e){return`${e.turn.round}:${e.turn.activeSeat}:${e.turn.phase}`}var z=(e,t)=>t[Math.floor(e()*t.length)],B=(e,t)=>{let n=[...t];for(let t=n.length-1;t>0;t--){let r=Math.floor(e()*(t+1));[n[t],n[r]]=[n[r],n[t]]}return n};function ye(e,t,n){try{return!!ne(e,n.intent,n.as,()=>.5,0,t)}catch{return!1}}function be(e,t){let n=Math.floor(e.rng()*2**48).toString(16).padStart(12,`0`),r=i(t,n);return e.kept.set(r,{value:t,salt:n}),r}var xe=e=>{let t=m(e).turn.rounds;return typeof t==`number`?t:5},V=e=>e.turn.round>xe(e),Se=e=>e.reaction?{...e,reaction:null}:e;function Ce(e,t,n){let r=Object.values(t.players).filter(e=>e.seat!==void 0),i=(e,t,n)=>[...n?[n]:[],...r.map(e=>e.id).filter(e=>e!==n)].map(n=>({intent:e,as:n,kind:t})),a=t.script?.waiting;if(a){if(a.reveal!==void 0){let e=t.secrets?.[a.player]?.[a.reveal]?.commitment,r=e?n.kept.get(e):void 0;return{what:`a reveal of ${a.reveal} by ${a.player}`,moves:r?[{intent:{type:`script/answer`,answer:JSON.stringify(r)},as:a.player,kind:`reveal`}]:[]}}let e=B(n.rng,a.options);return{what:`"${a.question}" for ${a.player}`,moves:e.map(e=>({intent:{type:`script/answer`,answer:a.secret===void 0?e.id:be(n,e.id)},as:a.player,kind:`answer`}))}}let o=t.procedure;if(o){let e=o.run;if(e.pending){let t=[...B(n.rng,e.pending.options.map(e=>e.id)),`pass`];return n.rng()<.5&&t.unshift(`pass`),{what:`the ${e.pending.step} window`,moves:t.flatMap(e=>i({type:`procedure/respond`,answer:e},`respond`))}}return{what:`the ${o.action} roll`,moves:i(e.done?{type:`procedure/clear`}:{type:`procedure/roll`},`roll`,!e.done&&D(t,e)||o.by)}}let s=t.reaction;if(s){let e=b(t,s.seat),r=[];if(n.weighing||n.rng()<.4)for(let i of e)for(let e of p(t,i.id)){let t=e.units.length?e.units[Math.floor(n.rng()*e.units.length)]:void 0,a=e.needsUnit&&t?{...e.play,targetId:t}:e.play;r.push({intent:a,as:i.id,kind:`react`})}return{what:`the ${s.window} reaction window`,moves:[...r,...e.map(e=>({intent:{type:`reaction/pass`},as:e.id,kind:`pass`}))]}}let c=t.attack;if(c)return{what:`the attack`,moves:i(c.stage===`done`?{type:`attack/clear`}:{type:`attack/roll`},`attack`,t.units[c.stage===`save`?c.spec.targetUnitId:c.spec.attackerUnitId]?.owner)};let l=t.pending;if(l){let e=b(t,l.seat),r=[];if(n.weighing||n.rng()<.4){for(let i of B(n.rng,Object.values(t.units)))if(e.some(e=>e.id===i.owner)&&x(t,i)&&!i.status?.reserves)for(let e of v(t,i.id))e.ok&&e.def.reactTo&&r.push({intent:{type:`action/take`,unitId:i.id,action:e.def.id},as:i.owner,kind:`react`})}return{what:`a reaction`,moves:[...r,...e.map(e=>({intent:{type:`reaction/pass`},as:e.id,kind:`pass`}))]}}let u=M(t.system)?.app?.missions?.find(e=>e.id===t.mission?.id),d=e.events.at(-1)?.event.type;if(n.weighing)return null;u&&(n.scores===void 0||d===`turn/next`||d===`turn/ready`||d===`score/confirm`||d===`secret/reveal`)&&(n.scores=I(e,t,u).map(e=>e.key));let f=u&&n.scores?.length?I(e,t,u)[0]:void 0;if(f){let e=n.rng()<.2,r={type:`score/confirm`,key:f.key,seat:f.seat,round:f.round,vp:e?0:f.vp,why:f.why,...e?{skipped:!0}:{}};return{what:`the score ${f.key}`,moves:b(t,f.seat).map(e=>({intent:r,as:e.id,kind:`score`}))}}return null}function*we(e,t){let n=e.turn.round,r=n>0&&ee(e),i=r?Object.values(e.players).filter(e=>e.seat!==void 0):b(e,e.turn.activeSeat),s=t=>n===0?e.players[t]?.seat!==void 0:i.some(e=>e.id===t),c=B(t.rng,Object.values(e.units).filter(t=>s(t.owner)&&x(e,t)&&!t.status?.reserves)),l=a(e),d=n>0&&u(e)?Object.values(e.units).filter(t=>s(t.owner)&&x(e,t)&&t.status?.reserves):[],p=n>0&&t.tidy&&!l.length&&u(e)?[...c,...d].find(e=>!e.status?.activated&&!e.status?.acting):void 0,g=p?[{intent:{type:`turn/endActivation`,unit:p.id},as:p.owner,kind:`endActivation`}]:r?Te(e,t):[...n>0&&!u(e)&&h(e)?i.map(e=>({intent:{type:`turn/pass`},as:e.id,kind:`pass`})):[],...i.map(e=>({intent:{type:`turn/next`},as:e.id,kind:`next`}))];if(n===0){c[0]&&t.rng()<.3&&(yield*G(e,K(e,c[0],t,4))),yield*g;for(let t of Object.values(e.players))yield{intent:{type:`turn/next`},as:t.id,kind:`next`};return}let y=_(m(e));if(y&&t.rng()<.5)for(let t of i){if(!o(e,t.id))continue;let n=e.pools?.[t.id]?.[y]??[],r=c.find(e=>e.owner===t.id);for(let i of Object.keys(r?.sheet?.weapons??{}))for(let a=0;a<n.length;a++)r&&!te(e,t.id,r.id,i,a)&&(yield{intent:{type:`dice/place`,unitId:r.id,weapon:i,index:a},as:t.id,kind:`place`})}let S=f(e)?.id??``;if(/move/i.test(S)&&t.rng()<.3&&(yield*U(e,t,c,/join/i)),t.tidy&&/move/i.test(S)){let r=`${n}:${e.turn.activeSeat}:${e.turn.phase}`;t.moved?.phase!==r&&(t.moved={phase:r,units:new Set});let i=(l.length?l:c).find(e=>!t.moved.units.has(e.id));i&&!v(e,i.id).some(e=>e.ok&&e.move!==void 0)&&(t.moved.units.add(i.id),yield*G(e,K(e,i,t,6)))}let C=Ee(e,t);C&&(yield C);let w=!1,T=function*(){for(let n of l.length?l:c)for(let r of H(e,n,t))w=!0,yield r},E=t.tidy?6:40,D=t.tidy?Math.min(.9,.15+t.idle*.12):Math.min(.9,.05+t.idle*.04),O=l.map(e=>({intent:{type:`turn/endActivation`},as:e.owner,kind:`endActivation`}));if(/combat|fight/i.test(f(e)?.id??``)&&(t.rng()<.5&&(yield*U(e,t,c,/challenge/i)),yield*U(e,t,c)),t.wholeGame&&t.idle<6){let r=[...U(e,t,l.length?l:[...d,...c])],i=l.some(e=>e.status?.actionBudget!==void 0)&&t.rng()<.4;i||(yield*r);let a=(l.length?l:c)[Math.floor(t.rng()*(l.length||c.length))];t.went?.round!==n&&(t.went={round:n,units:new Set}),a&&!(t.tidy&&t.went.units.has(a.id))&&(t.went.units.add(a.id),yield*G(e,(t.rng()<.25?z(t.rng,W(e,a,12)):void 0)??K(e,a,{...t,tidy:!0},6))),i&&(yield*r)}/move/i.test(f(e)?.id??``)&&t.rng()<.5&&(yield*U(e,t,c,/charge|march|join|leave/i)),/move/i.test(f(e)?.id??``)&&t.rng()<.3&&(yield*U(e,t,c,/leave/i));let k=t.rng();if(k<.6?yield*T():k<.75?yield*U(e,t,c):k<.8?yield*Oe(e,t,i.map(e=>e.id)):k<.95&&c[0]&&!t.tidy&&(yield*G(e,K(e,c[0],t,6))),t.rng()<D&&(yield*O),t.idle>E&&t.rng()<D&&(yield*g),yield*T(),yield*O,!w||t.idle>E){if(yield*g,r&&t.tidy)for(let t of b(e,e.turn.activeSeat))yield{intent:{type:`turn/next`},as:t.id,kind:`next`};else for(let e of i)yield{intent:{type:`turn/pass`},as:e.id,kind:`pass`}}yield*g}function Te(e,t){let r=(e,t=!0)=>({intent:t?{type:`turn/ready`}:{type:`turn/ready`,ready:!1},as:e,kind:t?`ready`:`unready`}),i=B(t.rng,n(e)).map(e=>r(e));if(t.tidy)return i;let a=t.rng(),o=e.turn.ready??[];return a<.1?[{intent:{type:`turn/next`},as:e.turn.ready?.[0]??n(e)[0],kind:`next`},...i]:a<.15&&o.length?[r(o[0],!1),...i]:i}function*H(e,t,n){let r=n.taken?.phase===R(e)?n.taken.keys:void 0;for(let i of B(n.rng,v(e,t.id))){if(i.def.reactTo||n.tidy&&(r?.has(L(e,t.id,i.def.id))||je(e,t,i.def.id))||i.def.sets?.includes(`advanced`)&&Ae(t)&&(n.tidy||n.rng()<.75))continue;if(i.def.procedure){let r=Object.keys(t.sheet?.weapons??{}),a=k(e,t.id,i.def.id).filter(e=>e.ok),o=new Set(a.map(e=>e.unitId));for(let s of B(n.rng,r.length?r:[void 0]).slice(0,3)){let r=s&&n.rng()<.3,c=B(n.rng,r?k(e,t.id,i.def.id,s).filter(e=>e.ok):a);n.rng()<.5&&c.sort((e,t)=>Number(o.has(e.unitId))-Number(o.has(t.unitId)));for(let r of c.slice(0,2)){if(n.tidy&&s&&(!J(e,t,s,r.unitId)||ke(t,s,i.def.id)))continue;let a={...s?{weapon:s}:{},targetId:r.unitId},o=v(e,t.id,a).find(e=>e.def.id===i.def.id);if(!o?.ok)continue;let l=c.filter(e=>e.unitId!==r.unitId).map(e=>e.unitId),u=o.repeat&&n.rng()<.7?l.slice(0,o.repeat-1):[];yield{intent:{type:`action/take`,unitId:t.id,action:i.def.id,...a,...u.length?{more:u}:{}},as:t.owner,kind:`action:${i.def.id}`}}}continue}if(!i.ok)continue;let a=i.commands?B(n.rng,i.commands.candidates).slice(0,i.commands.count):[],o=i.def.target?z(n.rng,k(e,t.id,i.def.id).filter(e=>e.ok))?.unitId:void 0,s={intent:{type:`action/take`,unitId:t.id,action:i.def.id,...o?{targetId:o}:{},...a.length?{with:a}:{}},as:t.owner,kind:`action:${i.def.id}`},c=r=>i.def.move?.kind===`charge`?q(e,t,n,r,o):K(e,t,n,r);if(i.move===void 0&&/charge/i.test(i.def.id)){let r=oe(e.system).chargeRoll;if(r&&o){n.charging={unitId:t.id,targetId:o,round:e.turn.round};let i={type:`dice/roll`,count:r.count,sides:r.sides,label:`charge roll`,unitId:t.id};yield{...s,then:{intent:i,as:t.owner,kind:`chargeRoll`}}}else yield{...s,then:q(e,t,n,8+Math.floor(n.rng()*6),o)};continue}if(n.tidy&&i.move!==void 0){yield{...s,then:c(Math.max(1,i.move))};continue}yield s,i.move!==void 0&&(yield c(Math.max(1,i.move)))}}function*U(e,t,n,r){if(e.script)return;let i=M(e.system),a=f(e)?.id,o=i?g(e,i.system.id):null;for(let s of n.slice(0,4)){let n={player:s.owner,unitId:s.id},c=[...o?(i.actions??[]).filter(e=>e.by===`unit`&&(!e.phases||a&&e.phases.includes(a))).filter(e=>!e.applies||e.applies(o,n)).map(e=>{let t=e.available(o,n),r=t===!0&&e.targets?e.targets(o,n):[];return{id:e.id,available:t,targets:r,targeted:!!e.targets}}):[],...(t.packageActions?.(s.id,s.owner)??[]).map(e=>({...e,targeted:e.targets.length>0}))],l=B(t.rng,c).sort((e,t)=>Number(t.targeted)-Number(e.targeted));for(let n of l){if(n.available!==!0||r&&!r.test(n.id))continue;let i=/charge/i.test(n.id)&&t.rng()<.5?n.targets.filter(t=>De(e,t.unitId)):[],a=z(t.rng,i.length?i:n.targets)?.unitId;if(n.targeted&&!a)continue;let o={intent:{type:`script/start`,procedure:n.id,args:{unit:s.id,...a?{target:a}:{}}},as:s.owner,kind:`code:${n.id}`};yield/charge/i.test(n.id)&&a?{...o,then:q(e,s,t,24,a)}:o}}}function Ee(e,t){let n=t.charging;if(!n||n.round!==e.turn.round)return null;let r=e.units[n.unitId],i=e.units[n.targetId],a=e.modules?.[e.system??``]??{};if(!r?.status?.acting||!i||!x(e,i)||a[`short:${r.id}`]===n.round||a[`landed:${r.id}`]===n.round)return null;let o=s(e,r,i);return!o||o.distance<.05?null:{intent:{...o.move,how:`charge`},as:r.owner,kind:`chargeMove`}}function De(e,t){let n=t?e.units[t]:void 0;if(!n)return!1;let r=w(e,n);return Object.values(e.units).some(t=>d(e,t.owner,n.owner)&&w(e,t).length&&j(r,w(e,t))<.6)}function*Oe(e,t,n){for(let r of n)for(let n of B(t.rng,C(e,r))){if(!n.ok||n.def.custom||t.tidy&&/re.?roll/i.test(n.def.id))continue;let e=n.targets?z(t.rng,n.targets):void 0;(!n.targets||e)&&(yield{intent:{type:`player/action`,action:n.def.id,...e?{targetId:e}:{}},as:r,kind:`stratagem:${n.def.id}`})}}function W(e,t,n){let r=w(e,t);if(!r.length)return[];let i={x:r.reduce((e,t)=>e+t.position.x,0)/r.length,y:r.reduce((e,t)=>e+t.position.y,0)/r.length},a=r[0].z??0,o=[];for(let t of e.terrain)for(let e of t.solids){if(e.kind!==`floor`&&e.kind!==`block`)continue;let r=Math.round((e.z+e.h)*100)/100;if(r<1||Math.abs(r-a)<.3)continue;let s=E(t,{x:e.x,y:e.y}),c=Math.hypot(s.x-i.x,s.y-i.y)+Math.abs(r-a);c<=n+.05&&o.push({d:c,at:s,top:r})}return o.sort((e,t)=>e.d-t.d).slice(0,3).flatMap(({at:n,top:a})=>{let o=r.map(t=>{let r={x:n.x+t.position.x-i.x,y:n.y+t.position.y-i.y};return{id:t.id,to:r,z:T(e.terrain,r,a)}});return o.some(e=>Math.abs(e.z-a)>.05)?[]:[{intent:{type:`models/move`,moves:o},as:t.owner,kind:`move`}]})}function*G(e,t){if(t.intent.type!==`models/move`)return void(yield t);t.intent.moves.some(t=>{let n=e.models[t.id]?.position;return!n||Math.hypot(n.x-t.to.x,n.y-t.to.y)>.1})&&(yield t)}function K(e,t,n,r){let i=t.modelIds.map(t=>e.models[t]).filter(e=>e&&!e.destroyed),a=i.reduce((e,t)=>e+t.position.x,0)/i.length,o=i.reduce((e,t)=>e+t.position.y,0)/i.length,s=n.tidy?Me(e,t,a,o):null,c=s?Math.atan2(s.x-a,s.y-o)+(n.rng()-.5)*.6:n.rng()*Math.PI*2,l=s?Math.max(0,Math.min(Math.hypot(s.x-a,s.y-o)-3,r*(.6+.4*n.rng()))):n.rng()*r,u=e.table.width/2-2,d=e.table.depth/2-2,f=(e,t)=>Math.max(-t,Math.min(t,e)),p=f(a+Math.sin(c)*l,u)-a,m=f(o+Math.cos(c)*l,d)-o;return{intent:{type:`models/move`,moves:i.map(e=>({id:e.id,to:{x:e.position.x+p,y:e.position.y+m}}))},as:t.owner,kind:`move`}}function q(e,t,n,r,i){let a=w(e,t),o=a.reduce((e,t)=>e+t.position.x,0)/a.length,s=a.reduce((e,t)=>e+t.position.y,0)/a.length,c,l=1/0;for(let n of Object.values(e.units)){if(!d(e,n.owner,t.owner)||!x(e,n)||i&&n.id!==i)continue;let r=j(a,w(e,n));r<l&&([c,l]=[n,r])}if(!c)return K(e,t,n,r);let u=w(e,c),f=u.reduce((e,t)=>e+t.position.x,0)/u.length,p=u.reduce((e,t)=>e+t.position.y,0)/u.length,m=Math.hypot(f-o,p-s)||1,[h,g]=[0,0],_=r;for(let e=0;e<8&&_>.01&&l>.05;e++){let e=Math.max(0,Math.min(_,l-.02));[h,g]=[h+(f-o)/m*e,g+(p-s)/m*e],_-=e;let t=a.map(e=>({...e,position:{x:e.position.x+h,y:e.position.y+g}}));l=j(t,u)}return{intent:{type:`models/move`,moves:a.map(e=>({id:e.id,to:{x:e.position.x+h,y:e.position.y+g}}))},as:t.owner,kind:`move`}}function J(e,t,n,r){let i=t.sheet?.weapons?.[n],a=e.units[r];if(!i||!a)return!0;let o=ae(i);return o===null||j(w(e,t),w(e,a))<=o+.05}function ke(e,t,n){let r=e.sheet?.weapons?.[t]?.kind;return r===`melee`&&/shoot|fire/i.test(n)||r===`ranged`&&/fight|melee|strike/i.test(n)}function Ae(e){return Object.values(e.sheet?.weapons??{}).some(e=>e.kind===`ranged`&&!e.keywords.some(e=>/^assault$/i.test(e)))}function je(e,t,n){let r=/pile.?in|consolidat/i.test(n)?2:/withdraw|fall.?back|retreat|disengage/i.test(n)?6:0;if(!r)return!1;let i=w(e,t);return!Object.values(e.units).some(n=>d(e,n.owner,t.owner)&&x(e,n)&&j(i,w(e,n))<=r)}function Me(e,t,n,r){let i=null,a=1/0;for(let o of Object.values(e.units)){if(!d(e,o.owner,t.owner)||!x(e,o))continue;let s=o.modelIds.map(t=>e.models[t]).filter(e=>e&&!e.destroyed),c=s.reduce((e,t)=>e+t.position.x,0)/s.length,l=s.reduce((e,t)=>e+t.position.y,0)/s.length,u=Math.hypot(c-n,l-r);u<a&&([i,a]=[{x:c,y:l},u])}return i}var Ne={roll:0,slain:0,lost:0,target:``,engaged:0};function Y(e,t){let n=t=>e.players[t]?.seat,r=Object.values(e.units).filter(t=>w(e,t).length&&!t.status?.reserves);return r.filter(i=>n(i.owner)===t&&r.some(r=>n(r.owner)!==void 0&&n(r.owner)!==t&&j(w(e,i),w(e,r))<=1.05)).length}function Pe(e,t,n,i){let a=new Set(b(t,i).map(e=>e.id)),o=r(e),s=y(e,n),c=e=>t.players[e]?.seat,l=0,u=0;for(let e of Object.values(t.models))e.destroyed&&!s.models[e.id]?.destroyed&&(c(e.owner)===i?u++:l++);let d=0,f=``,p=[];for(let r of e.events){if(o.has(r.seq))continue;let e=r.event;if(r.seq>n){let t=e.type===`script/step`?[e]:e.type===`procedure/clear`&&e.script?[e.script]:[];for(let e of t)for(let t of e.events)t.type===`log/note`&&p.push(t.text)}if(!a.has(r.by))continue;e.type===`dice/roll`&&r.seq>n&&(d=e.roll.results.reduce((e,t)=>e+t,0));let i=e.type===`attack/declare`?e.attack.spec.targetUnitId:e.type===`action/take`?e.targetId:void 0;i&&t.units[i]&&(f=t.units[i].name)}return{roll:d,slain:l,lost:u,target:f,engaged:Y(t,i),said:p.join(`
`)}}function Fe(e){let t=[e.type];return e.type===`dice/roll`&&e.roll.label&&t.push(`roll:${e.roll.label}`),(e.type===`action/take`||e.type===`player/action`)&&t.push(e.action),e.type===`attack/declare`&&t.push(`attack:${e.attack.spec.kind}`),e.type===`attack/roll`&&e.attack.stage===`done`&&t.push(`attack:done`),e.type===`script/step`&&e.started&&t.push(e.started),t}function Ie(e){return e.type===`attack/roll`?e.attack.spec.attackerUnitId:``}function Le(e,t){let n=e.script?.waiting;return n?e.players[n.player]?.seat===t:e.pending?e.pending.seat===t:e.turn.activeSeat===t}function X(e,t){let{state:n,you:r}=t,i=1-r;return`any`in e?e.any.some(e=>X(e,t)):`all`in e?e.all.every(e=>X(e,t)):`did`in e?(Array.isArray(e.did)?e.did:[e.did]).some(e=>t.did.has(e)):`phase`in e?n.turn.round>0&&f(n)?.id===e.phase&&n.turn.activeSeat===(e.side===`them`?i:r):`round`in e?n.turn.round>=e.round:`over`in e?n.turn.round>0&&V(n):`yourTurn`in e?n.turn.round>0&&!Le(n,i)&&n.turn.activeSeat===r:`theirTurn`in e?n.turn.round>0&&n.turn.activeSeat===i:`engaged`in e&&Y(n,r)>0}function Re(e,t,n,i,a=!1){let o=e.you??0,s=new Set(b(i,o).map(e=>e.id)),c=r(n),{step:l}=t,u=[...t.began],{facts:d,said:f}=t,p=a;for(;;){let t=e.steps[l];if(!t)break;let r=u[l]??i.seq;if(u[l]===void 0&&t.if&&!ue(t.if,{...d??Ne,engaged:Y(i,o)})){u[l]=r,l++;continue}u[l]=r;let a,m=!1;if(!t.until||p)a=p,m=p&&!!t.until,p=!1;else{let e=new Set;for(let t of n.events)if(t.seq>r&&!c.has(t.seq)&&s.has(t.by))for(let n of Fe(t.event))(n!==`attack:done`||s.has(i.units[Ie(t.event)]?.owner??``))&&e.add(n);a=X(t.until,{did:e,state:i,you:o})}if(!a)break;d=Pe(n,i,r,o),f=m?void 0:de(t,d),l++}return{step:l,began:u.slice(0,l+1),...d?{facts:d}:{},said:f??null}}var ze=e({backToLobby:()=>He,coachTick:()=>$,computerPlays:()=>Be,leaveLesson:()=>Q,redoStep:()=>Ue,startLesson:()=>Ve,useCoach:()=>Z}),Z=t(()=>({lesson:null,free:!1,progress:{step:0,began:[]},bot:{rng:Math.random,kept:new Map,idle:0,tidy:!0},initial:null}));function Be(e,t){if(re(e,t))return!0;let{lesson:n}=Z.getState();return!n||!t||!e.players[t]?!1:!b(e,n.you??0).some(e=>e.id===t)}function Ve(e){let t=F(e);if(!t)return;A.getState().start({role:`host`,mode:`hotseat`,name:localStorage.getItem(`open-battle:name`)??``,system:t});let n=0,r=()=>{let{game:i}=A.getState();if(l(i).length<2||(i.system??`forty-k-11`)!==t){n++<40&&setTimeout(r,50);return}let{dispatch:a}=A.getState();ce(e,()=>A.getState().game,a,crypto.randomUUID().slice(0,6)),se.setState({hint:!1}),Z.setState({lesson:e,free:!1,progress:{step:0,began:[]},bot:{rng:N(Date.now()%2**31),kept:new Map,idle:0,tidy:!0},initial:A.getState().record.initial}),$()};r()}function Q(){Z.setState({lesson:null,free:!1,initial:null})}function He(){Q(),A.getState().session?.leave(),A.setState({session:null,role:null,scrub:null,selected:null,draft:null})}function $(e=!1){let{lesson:t,progress:n}=Z.getState();if(!t)return;let{record:r,game:i,select:a}=A.getState(),o=Re(t,n,r,i,e);if(o.step===n.step&&o.began.length===n.began.length)return;Z.setState({progress:o});let s=t.steps[o.step]?.show;if(s&&o.began.length!==n.began.length){let e=new Set(Object.values(i.players).filter(e=>e.seat===s.seat).map(e=>e.id)),t=Object.values(i.units).filter(t=>e.has(t.owner))[s.unit];t&&a(t.id)}}function Ue(){let{progress:e}=Z.getState(),t=e.began[e.step];t!==void 0&&(fe(t,`hotseat`),Z.setState({initial:A.getState().record.initial}))}export{N as A,ke as C,P as D,ge as E,pe as O,Se as S,_e as T,je as _,Ue as a,H as b,Fe as c,q as d,we as f,R as g,W as h,Q as i,F as k,Le as l,ve as m,$ as n,ze as o,ye as p,Be as r,Z as s,He as t,V as u,J as v,I as w,Ce as x,L as y};