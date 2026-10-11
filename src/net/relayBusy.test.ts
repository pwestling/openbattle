import { beforeEach, describe, expect, it } from "vitest";
import { busyAwarePeerConnection, relayRefused, useRelayBusy } from "./relayBusy";

class FakePeer extends EventTarget {
  connectionState: RTCPeerConnectionState = "new";
  constructor(_config?: RTCConfiguration) {
    super();
  }
}

function iceError(errorCode: number, url: string) {
  return Object.assign(new Event("icecandidateerror"), { errorCode, url });
}

describe("relay busy", () => {
  beforeEach(() => useRelayBusy.setState({ at: null }));

  it("counts only a TURN server saying it is full", () => {
    expect(relayRefused({ errorCode: 486, url: "turn:battle.example:3478?transport=udp" })).toBe(true);
    expect(relayRefused({ errorCode: 508, url: "turns:battle.example:5349" })).toBe(true);
    expect(relayRefused({ errorCode: 701, url: "turn:battle.example:3478" })).toBe(false);
    expect(relayRefused({ errorCode: 486, url: "stun:stun.example:3478" })).toBe(false);
  });

  it("flags a refusal and clears once a connection gets through", () => {
    const Peer = busyAwarePeerConnection(FakePeer as unknown as typeof RTCPeerConnection);
    const pc = new Peer() as unknown as FakePeer;
    pc.dispatchEvent(iceError(701, "turn:battle.example:3478"));
    expect(useRelayBusy.getState().at).toBeNull();
    pc.dispatchEvent(iceError(486, "turn:battle.example:3478?transport=udp"));
    expect(useRelayBusy.getState().at).not.toBeNull();
    pc.connectionState = "connected";
    pc.dispatchEvent(new Event("connectionstatechange"));
    expect(useRelayBusy.getState().at).toBeNull();
  });
});
