// Link: direct connections between the browsers in one game. Realizes design/surfaces/link.html.
//
// Browsers meet at the relay under the game's link and then talk over one ordered, reliable WebRTC
// data channel per pair. Of each pair, the browser with the smaller id dials; the other answers.
// Before a connection counts, each side proves its id by signing a fresh challenge from the other
// with the key the id is worked out from (ADR-022), bound to the connection's own DTLS fingerprints,
// so whoever carries the signalling can neither pose as a browser nor sit in the middle.
// Messages are cut into chunks so any size arrives whole, and queued so a fast sender never overruns
// the channel's buffer.
import type { BrowserId, FromRelay, Json, ToRelay, TurnCredentials } from "../../server/protocol.ts";
import { closeCode, helloText } from "../../server/protocol.ts";
import * as keys from "./keys.ts";

export type { BrowserId, Json };

export interface Link {
  /** This browser's id, the same on every visit, worked out from its public key. */
  readonly me: BrowserId;
  /** This browser's public key, base64url. */
  readonly publicKey: string;
  send(message: Json, to?: BrowserId): void;
  onMessage(listener: (message: Json, from: BrowserId) => void): () => void;
  onChange(listener: (connected: BrowserId[]) => void): () => void;
  /** True once another tab of this browser took over the game; this link then has no connections. */
  readonly replaced: boolean;
  /** Signs a string (as UTF-8) with this browser's key, for checking with verify. Base64url. */
  sign(data: string): Promise<string>;
  close(): void;
}

/** Rejects if the relay cannot be reached. */
export async function connect(link: string): Promise<Link> {
  const [me, iceServers] = await Promise.all([keys.identity(), fetchIceServers()]);
  const socket = await openSignalling(link);
  return new Connection(link, me, socket, iceServers).start();
}

/** This browser's id and public key, before connecting to any game. */
export async function thisBrowser(): Promise<{ id: BrowserId; publicKey: string }> {
  const { id, publicKey } = await keys.identity();
  return { id, publicKey };
}

/** Whether signature is publicKey's signature of data, made with Link.sign. False for anything malformed; never throws. */
export async function verify(publicKey: string, data: string, signature: string): Promise<boolean> {
  try {
    return await keys.verify(publicKey, concat([forSigning, encoder.encode(data)]), signature);
  } catch {
    return false;
  }
}

/** The browser id belonging to a public key. Rejects if it is not a public key. */
export async function idFor(publicKey: string): Promise<BrowserId> {
  const raw = keys.fromBase64url(publicKey);
  await keys.checkPublicKey(raw);
  return keys.idOf(raw);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
// What the link signs to prove an id, and what it signs for others, can never be mistaken for each other.
const forProof = encoder.encode("openbattle link proof\n");
const forSigning = encoder.encode("openbattle signed\n");

/** TURN if the relay has it; otherwise direct connections only. */
async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/turn", { cache: "no-store" });
    return res.ok ? [(await res.json()) as TurnCredentials] : [];
  } catch {
    return [];
  }
}

function signalUrl(link: string) {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/signal?game=${encodeURIComponent(link)}`;
}

function openSignalling(link: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(signalUrl(link));
    socket.onopen = () => {
      socket.onclose = null;
      resolve(socket);
    };
    socket.onclose = () => reject(new Error("The relay cannot be reached."));
  });
}

/** Handshake data between two browsers, tagged with the dial attempt it belongs to. */
type Handshake = { attempt: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

/** Sent on a new channel before anything else, to prove ids. */
type Proof = { challenge: string; publicKey: string; tab: string } | { answer: string };

type Peer = {
  attempt: string;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  /** The challenge this browser sends; the peer must sign it. */
  challenge: Uint8Array;
  /** Our challenge has gone out. It must go before our answer, so the peer meets them in that order. */
  asked: boolean;
  /** The public key the peer claims, once it has been checked against its id. */
  publicKey: string | null;
  /** Which tab of the peer's browser this connection reaches. */
  tab: string | null;
  /** The peer signed our challenge: it is who it says. */
  proven: boolean;
  /** Chunks waiting for room in the channel's buffer. */
  outbox: ArrayBuffer[];
  /** Chunks of the message being received. */
  inbox: Uint8Array[];
  /** Handshake and incoming steps run one after another. */
  steps: Promise<void>;
};

const chunkSize = 16 * 1024;
const bufferHigh = 1024 * 1024;
const bufferLow = 256 * 1024;
const moreChunks = 0;
const lastChunk = 1;
const proofChunk = 2;

class Connection implements Link {
  /** Proven connections, one per browser. */
  private readonly peers = new Map<BrowserId, Peer>();
  /** Connections still proving themselves. One that proves replaces the browser's old connection. */
  private readonly trying = new Map<BrowserId, Peer>();
  /** Browsers the relay says are announced under this link. */
  private readonly announced = new Set<BrowserId>();
  private readonly messageListeners = new Set<(message: Json, from: BrowserId) => void>();
  private readonly changeListeners = new Set<(connected: BrowserId[]) => void>();
  private connected: BrowserId[] = [];
  private closed = false;
  /** Another tab of this browser took over at the relay. */
  replaced = false;
  /** This tab, so peers can tell a reconnect of the same tab from a new tab of the same browser. */
  private readonly tab = crypto.randomUUID();
  private retry = 0;
  /** Failed dials in a row to each browser, for backing off. */
  private readonly dials = new Map<BrowserId, number>();
  private ready!: () => void;
  private readonly link: string;
  private readonly identity: keys.Identity;
  private socket: WebSocket;
  private readonly iceServers: RTCIceServer[];
  readonly me: BrowserId;
  readonly publicKey: string;

  constructor(link: string, identity: keys.Identity, socket: WebSocket, iceServers: RTCIceServer[]) {
    this.link = link;
    this.identity = identity;
    this.me = identity.id;
    this.publicKey = identity.publicKey;
    this.socket = socket;
    this.iceServers = iceServers;
  }

  /** Resolves once the relay has said who is here. */
  start(): Promise<Link> {
    return new Promise((resolve, reject) => {
      this.ready = () => resolve(this);
      this.attach(this.socket, (code) =>
        reject(new Error(code === closeCode.notProven ? "The relay refused this browser's proof of id." : "The relay cannot be reached.")),
      );
    });
  }

  send(message: Json, to?: BrowserId): void {
    const targets = to === undefined ? [...this.peers.values()] : [this.peers.get(to)];
    const live = targets.filter((p): p is Peer => p !== undefined);
    if (live.length === 0) return;
    const chunks = toChunks(message);
    for (const peer of live) {
      peer.outbox.push(...chunks);
      this.pump(peer);
    }
  }

  onMessage(listener: (message: Json, from: BrowserId) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onChange(listener: (connected: BrowserId[]) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  sign(data: string): Promise<string> {
    return keys.sign(this.identity.keys, concat([forSigning, encoder.encode(data)]));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.close(1000);
    for (const peer of [...this.peers.values(), ...this.trying.values()]) peer.pc.close();
    this.peers.clear();
    this.trying.clear();
    this.announced.clear();
    this.changed();
  }

  // Signalling

  private attach(socket: WebSocket, failed?: (code: number) => void) {
    this.socket = socket;
    socket.onmessage = (e) => this.fromRelay(JSON.parse(e.data as string) as FromRelay);
    socket.onclose = (e) => {
      failed?.(e.code);
      if (this.closed || this.socket !== socket) return;
      this.announced.clear();
      if (e.code === closeCode.replaced) {
        // Another tab of this browser joined; the relay checked it holds our key. It has the seat now.
        this.replaced = true;
        return this.close();
      }
      this.reconnect();
    };
  }

  /** The relay went away. Direct connections carry on; keep trying so newcomers can still meet us. */
  private reconnect() {
    const delay = Math.min(1000 * 2 ** this.retry++, 10_000);
    setTimeout(() => {
      if (this.closed) return;
      openSignalling(this.link).then(
        (socket) => (this.closed ? socket.close(1000) : this.attach(socket)),
        () => this.reconnect(),
      );
    }, delay);
  }

  private relay(message: ToRelay) {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private signal(to: BrowserId, data: Handshake) {
    this.relay({ kind: "signal", to, data: JSON.parse(JSON.stringify(data)) as Json });
  }

  private fromRelay(message: FromRelay) {
    switch (message.kind) {
      case "challenge":
        // Announce this browser, proving at the relay that it holds the key its id comes from.
        void keys.sign(this.identity.keys, encoder.encode(helloText(message.nonce, this.link))).then((signature) =>
          this.relay({ kind: "hello", browser: this.me, publicKey: this.publicKey, signature }),
        );
        break;
      case "here":
        this.retry = 0;
        for (const browser of message.browsers) this.arrived(browser);
        this.ready();
        break;
      case "arrived":
        this.arrived(message.browser);
        break;
      case "left":
        // Only the signalling socket went; a direct connection stays until it closes on its own.
        this.announced.delete(message.browser);
        break;
      case "signal":
        this.handshake(message.from, message.data as unknown as Handshake);
        break;
    }
  }

  /** A browser announced itself, maybe again from a new tab: try a fresh connection to it. */
  private arrived(browser: BrowserId) {
    if (browser === this.me) return;
    this.announced.add(browser);
    if (this.me < browser) this.dial(browser);
  }

  // Direct connections

  private newPeer(browser: BrowserId, attempt: string): Peer {
    this.trying.get(browser)?.pc.close();
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const peer: Peer = { attempt, pc, channel: null, challenge, asked: false, publicKey: null, tab: null, proven: false, outbox: [], inbox: [], steps: Promise.resolve() };
    this.trying.set(browser, peer);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal(browser, { attempt, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.lost(browser, peer);
    };
    return peer;
  }

  private dial(browser: BrowserId) {
    const peer = this.newPeer(browser, crypto.randomUUID());
    this.useChannel(browser, peer, peer.pc.createDataChannel("game", { ordered: true }), true);
    this.step(peer, async () => {
      await peer.pc.setLocalDescription();
      this.signal(browser, { attempt: peer.attempt, description: peer.pc.localDescription!.toJSON() });
    });
  }

  private handshake(from: BrowserId, data: Handshake) {
    const known = [this.trying.get(from), this.peers.get(from)];
    let peer = known.find((p) => p?.attempt === data.attempt);
    if (!peer && data.description?.type === "offer") {
      const answering = this.newPeer(from, data.attempt);
      answering.pc.ondatachannel = (e) => this.useChannel(from, answering, e.channel, false);
      peer = answering;
    }
    if (!peer) return; // From an earlier attempt.
    const { pc } = peer;
    this.step(peer, async () => {
      if (data.description) {
        await pc.setRemoteDescription(data.description);
        if (data.description.type === "offer") {
          await pc.setLocalDescription();
          this.signal(from, { attempt: data.attempt, description: pc.localDescription!.toJSON() });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    });
  }

  /**
   * Runs one step after the peer's earlier ones. A failed handshake step surfaces as a failed connection;
   * a peer that breaks the proof or message protocol is dropped.
   */
  private step(peer: Peer, run: () => Promise<void> | void, drop = false) {
    peer.steps = peer.steps.then(run).catch(() => {
      if (drop) peer.pc.close();
    });
  }

  private useChannel(browser: BrowserId, peer: Peer, channel: RTCDataChannel, dialing: boolean) {
    peer.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = bufferLow;
    // The dialer asks first, once its channel opens. The answerer asks only on hearing from the dialer,
    // because what it sends before the dialer's channel opens can be lost.
    if (dialing) channel.onopen = () => this.ask(peer);
    channel.onclose = () => this.lost(browser, peer);
    channel.onbufferedamountlow = () => this.pump(peer);
    channel.onmessage = (e) => {
      const chunk = new Uint8Array(e.data as ArrayBuffer);
      this.step(peer, () => this.receive(browser, peer, chunk), true);
    };
  }

  private ask(peer: Peer) {
    if (peer.asked) return;
    peer.asked = true;
    this.sendProof(peer.channel!, { challenge: keys.toBase64url(peer.challenge), publicKey: this.publicKey, tab: this.tab });
  }

  private sendProof(channel: RTCDataChannel, proof: Proof) {
    const bytes = encoder.encode(JSON.stringify(proof));
    const chunk = new Uint8Array(bytes.length + 1);
    chunk[0] = proofChunk;
    chunk.set(bytes, 1);
    channel.send(chunk);
  }

  /**
   * What a browser signs to prove its id: the asker's challenge and id, and both ends' DTLS fingerprints,
   * the signer's first. A proof made on one connection is worthless on any other.
   */
  private proofBytes(challenge: Uint8Array, asker: BrowserId, signerSdp: string, askerSdp: string) {
    return concat([forProof, challenge, encoder.encode(`\n${asker}\n${fingerprints(signerSdp)}\n${fingerprints(askerSdp)}`)]);
  }

  /** Answers the peer's challenge, and checks the peer's answer to ours. A peer that fails is dropped. */
  private async prove(browser: BrowserId, peer: Peer, proof: Proof) {
    if ("challenge" in proof) {
      if (peer.publicKey !== null || (await idFor(proof.publicKey)) !== browser) throw new Error("not that browser's key");
      peer.publicKey = proof.publicKey;
      peer.tab = String(proof.tab);
      const { local, remote } = descriptions(peer.pc);
      const answer = await keys.sign(this.identity.keys, this.proofBytes(keys.fromBase64url(proof.challenge), browser, local, remote));
      this.ask(peer);
      this.sendProof(peer.channel!, { answer });
      return;
    }
    if (peer.publicKey === null || peer.proven) throw new Error("answer out of turn");
    const { local, remote } = descriptions(peer.pc);
    if (!(await keys.verify(peer.publicKey, this.proofBytes(peer.challenge, this.me, remote, local), proof.answer))) throw new Error("wrong answer");
    peer.proven = true;
    this.promote(browser, peer);
  }

  /**
   * A connection proved itself. If we already reach that same tab, it is a reconnect at the relay:
   * keep the working connection, so nothing in flight is lost. Otherwise it becomes the browser's
   * connection, and listeners see the browser leave and arrive, so they know to catch it up.
   */
  private promote(browser: BrowserId, peer: Peer) {
    if (this.closed || this.trying.get(browser) !== peer) return peer.pc.close();
    this.trying.delete(browser);
    this.dials.delete(browser);
    const old = this.peers.get(browser);
    if (old && old.tab === peer.tab && old.channel?.readyState === "open") return peer.pc.close();
    this.peers.set(browser, peer);
    if (old) {
      old.pc.close();
      this.peers.delete(browser);
      this.changed();
      this.peers.set(browser, peer);
    }
    this.pump(peer);
    this.changed();
  }

  /** A connection closed or failed. If we dial this browser and it is still at the relay, keep trying. */
  private lost(browser: BrowserId, peer: Peer) {
    if (this.trying.get(browser) === peer) {
      this.trying.delete(browser);
      peer.pc.close();
    } else if (this.peers.get(browser) === peer) {
      this.peers.delete(browser);
      peer.pc.close();
      this.changed();
    } else {
      return;
    }
    if (this.me > browser || this.peers.has(browser)) return;
    const failures = this.dials.get(browser) ?? 0;
    this.dials.set(browser, failures + 1);
    setTimeout(() => {
      const idle = !this.peers.has(browser) && !this.trying.has(browser);
      if (!this.closed && idle && this.announced.has(browser)) this.dial(browser);
    }, Math.min(1000 * 2 ** failures, 10_000));
  }

  // Messages

  private pump(peer: Peer) {
    const { channel } = peer;
    if (!peer.proven || !channel || channel.readyState !== "open") return;
    while (peer.outbox.length > 0 && channel.bufferedAmount < bufferHigh) channel.send(peer.outbox.shift()!);
  }

  private async receive(browser: BrowserId, peer: Peer, chunk: Uint8Array) {
    if (chunk[0] === proofChunk) return this.prove(browser, peer, JSON.parse(decoder.decode(chunk.subarray(1))) as Proof);
    // The peer's answer comes before anything it sends, so a message from an unproven peer breaks the protocol.
    if (!peer.proven) throw new Error("message before proof");
    if (this.peers.get(browser) !== peer) return;
    peer.inbox.push(chunk.subarray(1));
    if (chunk[0] !== lastChunk) return;
    const message = JSON.parse(decoder.decode(concat(peer.inbox))) as Json;
    peer.inbox = [];
    for (const listener of [...this.messageListeners]) listener(message, browser);
  }

  private changed() {
    const now = [...this.peers.keys()].sort();
    if (now.length === this.connected.length && now.every((b, i) => b === this.connected[i])) return;
    this.connected = now;
    for (const listener of [...this.changeListeners]) listener([...now]);
  }
}

/** One message as chunks: a flag byte (more to come, or last) then up to chunkSize bytes. */
function toChunks(message: Json): ArrayBuffer[] {
  const bytes = encoder.encode(JSON.stringify(message));
  const chunks: ArrayBuffer[] = [];
  for (let at = 0; at === 0 || at < bytes.length; at += chunkSize) {
    const part = bytes.subarray(at, at + chunkSize);
    const chunk = new Uint8Array(part.length + 1);
    chunk[0] = at + chunkSize >= bytes.length ? lastChunk : moreChunks;
    chunk.set(part, 1);
    chunks.push(chunk.buffer);
  }
  return chunks;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function descriptions(pc: RTCPeerConnection) {
  return { local: pc.localDescription?.sdp ?? "", remote: pc.remoteDescription?.sdp ?? "" };
}

/** The DTLS fingerprints an SDP commits to, in a fixed order. */
function fingerprints(sdp: string): string {
  const lines = sdp.split(/\r?\n/).filter((l) => l.startsWith("a=fingerprint:"));
  if (lines.length === 0) throw new Error("no fingerprint");
  return [...new Set(lines.map((l) => l.trim().toLowerCase()))].sort().join(",");
}
