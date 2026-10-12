import { create } from "zustand";
import {
  createInitialState,
  createRecord,
  type GameRecord,
  type GameState,
  type Intent,
  type Player,
  type PlayerId,
  type Rng,
} from "./core";
import { broadcastTransport } from "./net/broadcast";
import { createLoopbackNetwork } from "./net/loopback";
import { Session, type NetStatus, type Role } from "./net/session";
import type { trysteroTransport as TrysteroTransport } from "./net/trystero";
import { useLibrary } from "./packages/library";
import { sharedSecret } from "./secrets/diceSecrets";
import { moduleInfo, startingLayout } from "./systems";

let trystero: typeof TrysteroTransport | null = null;
/** The WebRTC transport's chunk, loaded on demand. */
const loadTrystero = () =>
  import("./net/trystero").then((m) => {
    trystero = m.trysteroTransport;
  });

/** Side colours, told apart with colour blindness too (blue, orange, teal, yellow). */
const COLORS = ["#3b82f6", "#f97316", "#2dd4bf", "#fde047"];

/**
 * How peers reach each other. "online" is WebRTC between browsers;
 * "local" links tabs of the same browser; "hotseat" is one screen, both sides.
 */
export type Mode = "online" | "local" | "hotseat";

interface StartOptions {
  role: Role;
  mode: Mode;
  roomId?: string;
  name: string;
  /** Resume a saved game (host only). */
  record?: GameRecord;
  /** The module id a new game plays (host only); none when missing. */
  system?: string;
  /** The host's dice, for a test that wants known rolls. */
  rng?: Rng;
}

interface Store {
  game: GameState;
  record: GameRecord;
  session: Session | null;
  role: Role | null;
  mode: Mode;
  roomId: string | null;
  net: NetStatus | null;
  start: (options: StartOptions) => void;
  leave: () => void;
  /** Send an intent. In hotseat the active side sends it, unless `as` names another. */
  dispatch: (intent: Intent, as?: PlayerId) => void;
}

/** What a peer keeps per room so a reload can rejoin: the log it holds and the player it was. */
interface SavedRoom {
  record: GameRecord;
  playerId?: string;
  role?: Role;
}

const roomKey = (roomId: string) => `open-battle:room:${roomId}`;
const seatKey = (roomId: string) => `open-battle:seat:${roomId}`;

function loadRoom(roomId: string): SavedRoom | null {
  try {
    const raw = sessionStorage.getItem(roomKey(roomId));
    return raw ? (JSON.parse(raw) as SavedRoom) : null;
  } catch {
    return null;
  }
}

/** The seat this browser last had in a room, kept beyond the tab, so a new tab finds its player again. */
function deviceSeat(roomId: string): string | undefined {
  try {
    return localStorage.getItem(seatKey(roomId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveRoom(roomId: string, record: GameRecord, seatedAs: string | undefined, role: Role) {
  try {
    if (seatedAs && localStorage.getItem(seatKey(roomId)) !== seatedAs)
      localStorage.setItem(seatKey(roomId), seatedAs);
    const playerId = seatedAs ?? loadRoom(roomId)?.playerId;
    sessionStorage.setItem(
      roomKey(roomId),
      JSON.stringify({ record, role, ...(playerId ? { playerId } : {}) }),
    );
  } catch {
    // Storage full or blocked: a reload rejoins from scratch.
  }
}

const HOTSEAT_PLAYERS: Player[] = [
  { id: "p1", name: "Player 1", color: COLORS[0]!, seat: 0 },
  { id: "p2", name: "Player 2", color: COLORS[1]!, seat: 1 },
];

export const useStore = create<Store>((set, get) => ({
  game: createInitialState(),
  record: createRecord(),
  session: null,
  role: null,
  mode: "online",
  roomId: null,
  net: null,

  start(options) {
    const { role, mode, roomId, name, record, system, rng } = options;
    // WebRTC (Trystero) loads on demand.
    if (mode !== "hotseat" && mode !== "local" && !trystero) {
      void loadTrystero().then(() => get().start(options));
      return;
    }
    get().session?.leave();
    const transport =
      mode === "hotseat"
        ? createLoopbackNetwork().connect("solo")
        : mode === "local"
          ? broadcastTransport(roomId!)
          : trystero!(roomId!);
    // A client coming back to a room picks up the log it saved there, and asks only for what it missed.
    const room = mode === "hotseat" || !roomId ? null : loadRoom(roomId);
    const resumed = role === "host" && !!record && mode !== "hotseat";
    let seated = role === "spectator";
    const session: Session = new Session({
      transport,
      role,
      record: record ?? (role === "client" ? room?.record : undefined),
      resumed,
      ...(rng ? { rng } : {}),
      sharedSecret,
      // A peer missing one of the game's rules packages can't host it.
      ready: (state) =>
        (state.packages?.packages ?? []).every((p) => !!useLibrary.getState().packages[p.hash]),
      onChange: (game, rec) => {
        // A session that was replaced (left) may still call back; ignore it.
        if (get().session !== session) return;
        set({ game, record: rec });
        const current = session.status.role ?? role;
        if (roomId && mode !== "hotseat")
          saveRoom(roomId, rec, game.players[session.selfId] ? session.selfId : undefined, current);
        takeSeat();
      },
      onNet: (status) => {
        if (get().session !== session) return;
        set({ net: status, role: status.role });
        takeSeat();
      },
    });
    set({
      session,
      mode,
      roomId: roomId ?? null,
      game: session.current,
      record: session.log,
      net: session.status,
      role,
    });

    /** Once there is a host and a game: take back our old seat, or a free one. */
    function takeSeat() {
      if (seated || mode === "hotseat" || get().session !== session) return;
      const status = session.status;
      if (status.role === "host" ? false : status.hostId === null) return;
      const game = session.current;
      if (game.seq === 0 && status.role !== "host") return;
      // Sit down only with the game's rules loaded.
      if (status.role !== "host") {
        const lib = useLibrary.getState();
        if (!lib.loaded) return;
        if ((game.packages?.packages ?? []).some((p) => !lib.packages[p.hash])) return;
      }
      const players = Object.values(game.players);
      if (players.some((p) => p.id === session.selfId)) {
        seated = true;
        return;
      }
      // This tab's seat, else this browser's (a new tab on the same invite), else a resumed host's own.
      const mine =
        room?.playerId ??
        (roomId ? deviceSeat(roomId) : undefined) ??
        (resumed ? players.find((p) => p.seat === 0)?.id : undefined);
      seated = true;
      if (mine && game.players[mine] && (room?.playerId === mine || !status.peers.includes(mine))) {
        session.dispatch({ type: "player/claim", player: mine });
        return;
      }
      if (status.role === "host") return;
      // Sides fill up to the team size, the emptier side first.
      const size = game.settings.teamSize ?? 1;
      const count = (seat: number) => players.filter((p) => p.seat === seat).length;
      if (count(0) >= size && count(1) >= size) return;
      const seat = count(0) >= size ? 1 : count(1) >= size ? 0 : count(1) < count(0) ? 1 : 0;
      session.dispatch({
        type: "player/join",
        player: { id: session.selfId, name, color: COLORS[seat + 2 * count(seat)] ?? COLORS[seat]!, seat },
      });
    }

    if (role !== "host") {
      takeSeat();
      return;
    }
    if (record) {
      // A resumed host first finds out whether the room has moved on without it, then takes its seat back.
      setTimeout(takeSeat, 1500);
      return;
    }
    seated = true;
    if (mode === "hotseat") {
      for (const p of HOTSEAT_PLAYERS) session.dispatch({ type: "player/join", player: p }, p.id);
    } else {
      session.dispatch({
        type: "player/join",
        player: { id: session.selfId, name, color: COLORS[0]!, seat: 0 },
      });
    }
    if (system) session.dispatch({ type: "game/system", system });
    // The module's own table and layout, when its package is already known here; the sandbox offers them once it loads.
    const info = moduleInfo(system);
    session.dispatch({
      type: "layout/set",
      layout: { ...startingLayout(system), ...(info ? { table: info.table } : {}) },
    });
  },

  leave() {
    get().session?.leave();
    set({ session: null, role: null, net: null, game: createInitialState(), record: createRecord() });
  },

  dispatch(intent, as) {
    const { session, mode, game } = get();
    if (!session) return;
    if (mode === "hotseat") {
      const active = Object.values(game.players).find((p) => p.seat === game.pointer.seat);
      session.dispatch(intent, as ?? active?.id);
    } else session.dispatch(intent);
  },
}));
