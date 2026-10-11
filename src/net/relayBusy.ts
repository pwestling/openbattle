import { create } from "zustand";

/**
 * Notices when the site's TURN server turns a connection away because it is full: coturn answers
 * an allocation with 486 (Allocation Quota Reached) or 508 (Insufficient Capacity). Players whose
 * networks need TURN then can't connect, so the room says the relay is busy instead of waiting in
 * silence. A peer connection that does connect (directly or through TURN) clears it.
 */
export const useRelayBusy = create<{ at: number | null }>(() => ({ at: null }));

/** coturn's answers when it won't hand out another relay. */
const FULL = new Set([486, 508]);

export function relayRefused(e: { errorCode?: number; url?: string | null }): boolean {
  return FULL.has(e.errorCode ?? 0) && /^turns?:/.test(e.url ?? "");
}

/** RTCPeerConnection that reports TURN refusals to useRelayBusy (Trystero's rtcPolyfill). */
export function busyAwarePeerConnection(Base: typeof RTCPeerConnection): typeof RTCPeerConnection {
  return class extends Base {
    constructor(config?: RTCConfiguration) {
      super(config);
      this.addEventListener("icecandidateerror", (e) => {
        if (relayRefused(e as RTCPeerConnectionIceErrorEvent)) useRelayBusy.setState({ at: Date.now() });
      });
      this.addEventListener("connectionstatechange", () => {
        if (this.connectionState === "connected" && useRelayBusy.getState().at !== null)
          useRelayBusy.setState({ at: null });
      });
    }
  };
}
