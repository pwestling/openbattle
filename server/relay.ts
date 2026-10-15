// The relay: signalling and TURN credentials. Realizes design/surfaces/relay.html.
// It keeps who is announced under each game link while they are connected, and nothing else.
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { closeCode, linkPattern, maxMessage, type BrowserId, type FromRelay, type Health, type Json, type ToRelay, type TurnCredentials } from "./protocol.ts";

const port = Number(process.env.RELAY_PORT ?? 8787);
// coturn's shared secret (use-auth-secret / static-auth-secret) and its addresses, comma separated.
const turnSecret = process.env.TURN_SECRET ?? "";
const turnUrls = (process.env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean);
const turnConfigured = turnSecret !== "" && turnUrls.length > 0;
const turnLifetime = 24 * 60 * 60;

/** Game link -> the browsers announced under it. A room exists only while someone is in it. */
const rooms = new Map<string, Map<BrowserId, WebSocket>>();

const send = (socket: WebSocket, message: FromRelay) => socket.send(JSON.stringify(message));

/** coturn's REST credentials: the user name is the expiry time, the password an HMAC of it. */
function turnCredentials(): TurnCredentials {
  const username = `${Math.floor(Date.now() / 1000) + turnLifetime}:${randomBytes(6).toString("hex")}`;
  const credential = createHmac("sha1", turnSecret).update(username).digest("base64");
  return { urls: turnUrls, username, credential };
}

function parse(raw: string): ToRelay | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  if (m.kind === "hello" && typeof m.browser === "string" && m.browser !== "") return { kind: "hello", browser: m.browser };
  if (m.kind === "signal" && typeof m.to === "string" && "data" in m) return { kind: "signal", to: m.to, data: m.data as Json };
  return null;
}

function join(game: string, socket: WebSocket) {
  let me: BrowserId | null = null;
  let room: Map<BrowserId, WebSocket> | null = null;

  socket.on("message", (raw, isBinary) => {
    const message = isBinary ? null : parse(raw.toString());
    if (!message || (me === null) !== (message.kind === "hello")) {
      socket.close(closeCode.notProtocol, "not the relay protocol");
      return;
    }
    if (message.kind === "hello") {
      me = message.browser;
      room = rooms.get(game) ?? new Map();
      rooms.set(game, room);
      const earlier = room.get(me);
      if (earlier) {
        // The newest tab or visit is this browser. Forget the earlier one before it closes.
        room.delete(me);
        for (const other of room.values()) send(other, { kind: "left", browser: me });
        earlier.close(closeCode.replaced, "this browser joined again elsewhere");
      }
      send(socket, { kind: "here", browsers: [...room.keys()] });
      for (const other of room.values()) send(other, { kind: "arrived", browser: me });
      room.set(me, socket);
      return;
    }
    const target = room?.get(message.to);
    if (target) send(target, { kind: "signal", from: me!, data: message.data });
  });

  // ws reports oversize messages here and closes the socket itself (1009); an unhandled error would stop the relay.
  socket.on("error", () => {});

  socket.on("close", () => {
    if (me === null || !room || room.get(me) !== socket) return;
    room.delete(me);
    for (const other of room.values()) send(other, { kind: "left", browser: me });
    if (room.size === 0) rooms.delete(game);
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://relay");
  if (url.pathname === "/health") {
    const health: Health = { signal: true, turn: turnConfigured };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(health));
  } else if (url.pathname === "/turn" && turnConfigured) {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(turnCredentials()));
  } else if (url.pathname === "/turn") {
    res.writeHead(503).end();
  } else {
    res.writeHead(404).end();
  }
});

// maxPayload makes ws close the socket (1009) on anything over 64 KB, before it is buffered.
const signalling = new WebSocketServer({ noServer: true, maxPayload: maxMessage });

// Sockets that stop answering pings are closed, so a vanished browser is reported as left (relay health).
const alive = new WeakSet<WebSocket>();

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://relay");
  const game = url.searchParams.get("game") ?? "";
  if (url.pathname !== "/signal" || !linkPattern.test(game)) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }
  signalling.handleUpgrade(req, socket, head, (ws) => {
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));
    join(game, ws);
  });
});

setInterval(() => {
  for (const ws of signalling.clients) {
    if (!alive.has(ws)) ws.terminate();
    else {
      alive.delete(ws);
      ws.ping();
    }
  }
}, 30_000).unref();

server.listen(port, () => console.log(`relay on :${port}${turnConfigured ? "" : " (TURN not configured)"}`));
