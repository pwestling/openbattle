import { joinRoom as joinNostr, selfId as nostrSelfId, type JsonValue } from "@trystero-p2p/nostr";
import { joinRoom as joinWsRelay, selfId as wsSelfId } from "@trystero-p2p/ws-relay";
import { netConfig, type NetConfig } from "./config";
import { busyAwarePeerConnection } from "./relayBusy";
import type { NetMessage, Transport } from "./transport";

const APP_ID = "open-battle-dev";

/**
 * WebRTC transport. Trystero finds peers through a signalling relay (public
 * Nostr relays by default, or a self-hosted WebSocket relay); game data then
 * flows directly between browsers.
 */
export function trysteroTransport(
  roomId: string,
  password?: string,
  config: NetConfig = netConfig(),
): Transport {
  const turnConfig = config.turn.length ? config.turn : undefined;
  // Everything through TURN (?forceTurn=1): for testing a TURN server.
  const rtcConfig: RTCConfiguration | undefined = config.forceTurn
    ? { iceTransportPolicy: "relay" }
    : undefined;
  // With TURN in play, notice when it turns connections away because it is full.
  const rtcPolyfill =
    turnConfig && typeof RTCPeerConnection !== "undefined"
      ? busyAwarePeerConnection(RTCPeerConnection)
      : undefined;
  const join = () =>
    config.signal.length
      ? joinWsRelay(
          {
            appId: APP_ID,
            password,
            turnConfig,
            rtcConfig,
            rtcPolyfill,
            relayConfig: { urls: config.signal },
          },
          roomId,
        )
      : joinNostr(
          {
            appId: APP_ID,
            password,
            turnConfig,
            rtcConfig,
            rtcPolyfill,
            ...(config.nostr.length ? { relayConfig: { urls: config.nostr } } : {}),
          },
          roomId,
        );
  const selfId = config.signal.length ? wsSelfId : nostrSelfId;
  let room = join();
  let channel = room.makeAction<JsonValue>("msg");
  // Kept, so a rejoined room gets them again.
  const on: {
    message?: (message: NetMessage, from: string) => void;
    join?: (peerId: string) => void;
    leave?: (peerId: string) => void;
  } = {};
  const bind = () => {
    channel.onMessage = (data, { peerId }) => on.message?.(data as unknown as NetMessage, peerId);
    room.onPeerJoin = (peerId) => on.join?.(peerId);
    room.onPeerLeave = (peerId) => on.leave?.(peerId);
  };
  bind();

  return {
    selfId,
    send(message, to) {
      void channel.send(message as unknown as JsonValue, to ? { target: to } : undefined);
    },
    onMessage(handler) {
      on.message = handler;
    },
    onPeerJoin(handler) {
      on.join = handler;
      // Peers already here are told of at once, as Trystero does.
      room.onPeerJoin = (peerId) => on.join?.(peerId);
    },
    onPeerLeave(handler) {
      on.leave = handler;
    },
    leave() {
      void room.leave();
    },
    rejoin() {
      // Trystero can drop a peer's room right after meeting it while the other side keeps it (#85b), and finds
      // it again only on that side's next announcement, a minute apart once it has settled. Leaving tells the
      // other side we went; joining again meets it over the same connection.
      const old = room;
      old.onPeerJoin = null;
      old.onPeerLeave = null;
      void old.leave();
      room = join();
      channel = room.makeAction<JsonValue>("msg");
      bind();
    },
  };
}
