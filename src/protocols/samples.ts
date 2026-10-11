import "../systems/index";
import {
  createInitialState,
  resolveIntent,
  applyEvent,
  type GameRecord,
  type GameState,
  type Intent,
  type Player,
  type PlayerId,
} from "../core";
import { canonResult, type RankedResult } from "../core/ranked";
import { stateAt } from "../core/log";
import { newCampaign, recordGame } from "../campaign/book";
import { buildFile, startSegment } from "../mail/file";
import { commitTo, newSeed } from "../mail/dice";
import { sign, type Identity } from "../mail/keys";
import { createLoopbackNetwork } from "../net/loopback";
import { Session } from "../net/session";
import { armyFromGame } from "../packages/shelf";
import { keyOf } from "../player/card";
import { signingText, type SignedResult } from "../ranked/verify";
import { seededRng } from "../sandbox/protocol";
import { standeeBytes } from "../standees/file";
import { systemModule } from "../systems";
import { spawnIntents } from "../systems/wh40k/deploy";
import { sampleRoster } from "../systems/wh40k/sample";
import { tableFromGame } from "../tables/library";
import { deploySamples } from "../teach/setup";

/**
 * Samples of each interop format, made by the app's own writers. With
 * WRITE_CONFORMANCE=1, src/protocols/write.test.ts saves them to
 * conformance/<format>/v<major>/valid/ as frozen fixtures: every later build
 * must still read them. Every name is invented.
 */

const PLAYERS: Player[] = [
  { id: "p1", name: "Ana", color: "#2563eb", seat: 0 },
  { id: "p2", name: "Ben", color: "#dc2626", seat: 1 },
];

function play(state: GameState, intent: Intent, from: PlayerId): GameState {
  const event = resolveIntent(intent, from, () => 0.5, state);
  if (!event) throw new Error(`Rejected: ${JSON.stringify(intent)}`);
  return applyEvent({ ...state, seq: state.seq + 1 }, event);
}

/** A 40k table with both sample armies down, played through a session as the app does. */
export function sampleRecord(): GameRecord {
  const host = new Session({
    transport: createLoopbackNetwork().connect("a"),
    role: "host",
    onChange: () => {},
    rng: seededRng(7),
    now: () => 1_760_000_000_000,
  });
  const send = (i: Intent, as: string) => host.dispatch(i, as);
  for (const p of PLAYERS) send({ type: "player/join", player: p }, p.id);
  send({ type: "layout/set", layout: systemModule("forty-k").layout(host.current.table) }, "p1");
  deploySamples(() => host.current, send, "m");
  send({ type: "turn/next" }, "p1");
  host.leave();
  return host.log;
}

export function sampleArmy() {
  let s = createInitialState();
  s = play(s, { type: "player/join", player: PLAYERS[0]! }, "p1");
  const roster = sampleRoster(0);
  for (const i of spawnIntents(s, "p1", roster.units, "p1-abc", roster.name)) s = play(s, i, "p1");
  const army = armyFromGame(s, "p1", { roster, prefix: "p1-abc" });
  return { ...army, id: "sample-army", savedAt: 1_760_000_000_000, attachments: { assets: {} } };
}

export function sampleTable() {
  let s = createInitialState();
  s = play(s, { type: "player/join", player: PLAYERS[0]! }, "p1");
  s = play(s, { type: "layout/set", layout: systemModule("forty-k").layout(s.table) }, "p1");
  return {
    ...tableFromGame(s, "Ridge line", "sample-table"),
    savedAt: 1_760_000_000_000,
    attachments: { assets: {} },
  };
}

/** A 1×1 transparent PNG: the smallest picture a standee can hold. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function sampleStandee(): unknown {
  return JSON.parse(
    new TextDecoder().decode(standeeBytes({ name: "Lantern bearer", basePx: 1, baseMm: 25, front: PIXEL })),
  );
}

export function sampleCampaign() {
  const record = sampleRecord();
  const book = { ...newCampaign("Ashfall league", "sample-campaign"), map: [{ name: "Cinder ridge" }] };
  return recordGame(book, record, stateAt(record, record.events.at(-1)!.seq), { vp: [12, 8], seats: [0, 1] });
}

export async function newIdentity(): Promise<Identity> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return {
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
}

export async function samplePlayer(id: Identity) {
  return {
    format: "open-battle/player@1",
    card: { name: "Ana", colors: ["#2563eb", "#f5c542"] },
    identity: id,
  };
}

export async function sampleSignedResult(ids: [Identity, Identity]): Promise<SignedResult> {
  const result: RankedResult = {
    v: 1,
    system: "rift-lanterns",
    points: null,
    rounds: 5,
    players: [
      { key: keyOf(ids[0].publicKey), name: "Ana", vp: 12 },
      { key: keyOf(ids[1].publicKey), name: "Ben", vp: 8 },
    ],
    winner: 0,
    replay: "a".repeat(64),
    at: 1_760_000_000_000,
    rules: { app: "0.1.0", packages: [] },
  };
  const text = signingText(canonResult(result)!);
  return { result, sigs: [await sign(text, ids[0]), await sign(text, ids[1])] };
}

export async function sampleMail() {
  const base = sampleRecord();
  const segment = startSegment(base, 3, newSeed(), await commitTo(newSeed()));
  return buildFile({ game: "sample-game", from: "p1", name: "Ana", segment, record: base });
}
