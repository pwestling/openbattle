import type { GameRecord, Intent, LoggedEvent } from "../core";

/** The host's state hash after event `seq` (see core/checksum.ts). */
export interface Check {
  seq: number;
  hash: number;
}

/** Wire protocol. The host is authoritative: clients send intents, the host
 * broadcasts logged events, and late joiners get the whole record. */
import type { BuildInfo } from "../protocol";

export type NetMessage =
  /**
   * A non-host greeting a peer: what log it already holds (`seq`, and `tail`
   * to check it is the same log), so the host sends only what is missing.
   */
  | {
      t: "hello";
      seq?: number;
      tail?: string;
      role?: "host" | "client" | "spectator";
      /** A spectator's delay (ms): the host holds events back that long before sending them (UX/PX: Live now). */
      delay?: number;
      /** The sender's protocol and build (src/protocol.ts); older builds don't send it. */
      v?: BuildInfo;
    }
  /** The host to a spectator: it sends this one events `ms` after they happen. */
  | { t: "delay"; ms: number }
  | { t: "intent"; intent: Intent }
  /** `check`: the host's state checksum after an earlier event, riding along with this one. */
  | { t: "event"; logged: LoggedEvent; check?: Check }
  /** Events a reconnecting peer missed, in order. */
  | { t: "events"; events: LoggedEvent[]; check?: Check }
  | { t: "record"; record: GameRecord }
  /** "I am the host": sent to each peer met, and when taking over a room. */
  | { t: "host"; seq: number; resumed?: boolean; v?: BuildInfo }
  /** A peer's log length and role, shared while choosing a new host. */
  /** `ready`: it holds every rules package the game names, so it could become host. */
  | { t: "sync"; seq: number; role: "host" | "client" | "spectator"; ready?: boolean }
  /** A host standing down in favour of `to`. */
  | { t: "yield"; to: string }
  | SideMessage;

/**
 * Peer-to-peer traffic outside the game log: rules packages, by the SHA-256
 * of their bytes (src/packages/share.ts). Any peer may send these to any other.
 */
export type SideMessage =
  | { t: "package/want"; hash: string }
  | { t: "package/part"; hash: string; part: number; parts: number; data: string }
  /** Which of the game's packages this peer is still getting (empty when it has them all). */
  | { t: "package/status"; missing: string[] };

/** Minimal peer-to-peer channel the session needs. Implemented over WebRTC by
 * `trysteroTransport` and in memory by `createLoopbackNetwork` for tests. */
export interface Transport {
  readonly selfId: string;
  /** Send to one peer, or to everyone when `to` is omitted. */
  send(message: NetMessage, to?: string): void;
  onMessage(handler: (message: NetMessage, from: string) => void): void;
  onPeerJoin(handler: (peerId: string) => void): void;
  onPeerLeave(handler: (peerId: string) => void): void;
  leave(): void;
  /**
   * Leave the room and join it again, keeping this peer's id and handlers: for a peer whose transport
   * dropped the others and isn't finding them again (#85b). Optional: a transport without it never needs it.
   */
  rejoin?(): void;
}
