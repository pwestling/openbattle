// Link: direct connections between the browsers in one game. Realizes design/surfaces/link.html.
//
// Browsers meet at the relay under the game's link and then talk over one ordered, reliable WebRTC
// data channel per pair. Of each pair, the browser with the smaller id dials; the other answers.
// Messages are cut into chunks so any size arrives whole, and queued so a fast sender never overruns
// the channel's buffer.
import type { BrowserId, FromRelay, Json, ToRelay, TurnCredentials } from "../../server/protocol.ts";
import { closeCode } from "../../server/protocol.ts";

export type { BrowserId, Json };

export interface Link {
  /** This browser's id, the same on every visit. */
  readonly me: BrowserId;
  send(message: Json, to?: BrowserId): void;
  onMessage(listener: (message: Json, from: BrowserId) => void): () => void;
  onChange(listener: (connected: BrowserId[]) => void): () => void;
  close(): void;
}

/** Rejects if the relay cannot be reached. */
export async function connect(link: string): Promise<Link> {
  const iceServers = fetchIceServers();
  const socket = await openSignalling(link);
  return new Connection(link, browserId(), socket, await iceServers).start();
}

const storageKey = "openbattle.browser";

function browserId(): BrowserId {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

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

type Peer = {
  attempt: string;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  open: boolean;
  /** Chunks waiting for room in the channel's buffer. */
  outbox: ArrayBuffer[];
  /** Chunks of the message being received. */
  inbox: Uint8Array[];
  /** Handshake steps run one after another. */
  steps: Promise<void>;
};

const chunkSize = 16 * 1024;
const bufferHigh = 1024 * 1024;
const bufferLow = 256 * 1024;
const lastChunk = 1;
const moreChunks = 0;

class Connection implements Link {
  private readonly peers = new Map<BrowserId, Peer>();
  /** Browsers the relay says are announced under this link. */
  private readonly announced = new Set<BrowserId>();
  private readonly messageListeners = new Set<(message: Json, from: BrowserId) => void>();
  private readonly changeListeners = new Set<(connected: BrowserId[]) => void>();
  private connected: BrowserId[] = [];
  private closed = false;
  private retry = 0;
  private ready!: () => void;
  private readonly link: string;
  readonly me: BrowserId;
  private socket: WebSocket;
  private readonly iceServers: RTCIceServer[];

  constructor(link: string, me: BrowserId, socket: WebSocket, iceServers: RTCIceServer[]) {
    this.link = link;
    this.me = me;
    this.socket = socket;
    this.iceServers = iceServers;
  }

  /** Resolves once the relay has said who is here. */
  start(): Promise<Link> {
    return new Promise((resolve, reject) => {
      this.ready = () => resolve(this);
      this.attach(this.socket, () => reject(new Error("The relay cannot be reached.")));
    });
  }

  send(message: Json, to?: BrowserId): void {
    const targets = to === undefined ? [...this.peers.values()] : [this.peers.get(to)];
    const live = targets.filter((p): p is Peer => p?.open === true);
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

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.close(1000);
    for (const peer of this.peers.values()) peer.pc.close();
    this.peers.clear();
    this.announced.clear();
    this.changed();
  }

  // Signalling

  private attach(socket: WebSocket, failed?: () => void) {
    this.socket = socket;
    this.relay({ kind: "hello", browser: this.me });
    socket.onmessage = (e) => this.fromRelay(JSON.parse(e.data as string) as FromRelay);
    socket.onclose = (e) => {
      failed?.();
      if (this.closed || this.socket !== socket) return;
      // Another tab or visit of this browser joined the game; it is this browser now.
      if (e.code === closeCode.replaced) return this.close();
      this.announced.clear();
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

  /** A browser announced itself, maybe again from a new tab: connect to it afresh. */
  private arrived(browser: BrowserId) {
    if (browser === this.me) return;
    this.announced.add(browser);
    if (this.me < browser) this.dial(browser);
  }

  // Direct connections

  private newPeer(browser: BrowserId, attempt: string): Peer {
    this.drop(browser);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { attempt, pc, channel: null, open: false, outbox: [], inbox: [], steps: Promise.resolve() };
    this.peers.set(browser, peer);
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
    this.useChannel(browser, peer, peer.pc.createDataChannel("game", { ordered: true }));
    this.step(peer, async () => {
      await peer.pc.setLocalDescription();
      this.signal(browser, { attempt: peer.attempt, description: peer.pc.localDescription!.toJSON() });
    });
  }

  private handshake(from: BrowserId, data: Handshake) {
    let peer = this.peers.get(from);
    if (data.description?.type === "offer" && peer?.attempt !== data.attempt) {
      peer = this.newPeer(from, data.attempt);
      const answering = peer;
      peer.pc.ondatachannel = (e) => this.useChannel(from, answering, e.channel);
    }
    if (!peer || peer.attempt !== data.attempt) return; // From an earlier attempt.
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

  private step(peer: Peer, run: () => Promise<void>) {
    peer.steps = peer.steps.then(run).catch(() => {
      // A broken handshake surfaces as a failed connection.
    });
  }

  private useChannel(browser: BrowserId, peer: Peer, channel: RTCDataChannel) {
    peer.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = bufferLow;
    channel.onopen = () => {
      if (this.peers.get(browser) !== peer) return;
      peer.open = true;
      this.changed();
    };
    channel.onclose = () => this.lost(browser, peer);
    channel.onbufferedamountlow = () => this.pump(peer);
    channel.onmessage = (e) => this.receive(browser, peer, new Uint8Array(e.data as ArrayBuffer));
  }

  /** The connection to a browser closed. If the relay still has it and we dial, try again. */
  private lost(browser: BrowserId, peer: Peer) {
    if (this.peers.get(browser) !== peer) return;
    this.drop(browser);
    this.changed();
    if (this.me < browser) {
      setTimeout(() => {
        if (!this.closed && this.announced.has(browser) && !this.peers.has(browser)) this.dial(browser);
      }, 1000);
    }
  }

  private drop(browser: BrowserId) {
    const peer = this.peers.get(browser);
    if (!peer) return;
    this.peers.delete(browser);
    peer.open = false;
    peer.pc.close();
  }

  // Messages

  private pump(peer: Peer) {
    const { channel } = peer;
    if (!peer.open || !channel || channel.readyState !== "open") return;
    while (peer.outbox.length > 0 && channel.bufferedAmount < bufferHigh) channel.send(peer.outbox.shift()!);
  }

  private receive(browser: BrowserId, peer: Peer, chunk: Uint8Array) {
    if (this.peers.get(browser) !== peer) return;
    peer.inbox.push(chunk.subarray(1));
    if (chunk[0] !== lastChunk) return;
    const message = JSON.parse(decoder.decode(concat(peer.inbox))) as Json;
    peer.inbox = [];
    for (const listener of [...this.messageListeners]) listener(message, browser);
  }

  private changed() {
    const now = [...this.peers].filter(([, p]) => p.open).map(([b]) => b).sort();
    if (now.length === this.connected.length && now.every((b, i) => b === this.connected[i])) return;
    this.connected = now;
    for (const listener of [...this.changeListeners]) listener([...now]);
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
