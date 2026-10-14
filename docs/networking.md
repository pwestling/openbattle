# How networking works

Players' browsers connect directly to each other. One of them, the **host**, owns the game log: everyone else sends it what they want to do, and it sends back the events it logged. A server only introduces browsers to each other, and relays traffic for networks that block direct connections; no game data is stored on a server.

This page describes that layer: how peers meet, how intents become a shared log, how a peer catches up or comes back, how the room survives the host leaving, how drift is detected, and how rules packages travel. The log itself, the fold and macros are in [How the engine works](engine.md). The exact message shapes are a versioned protocol in [peer-protocol.md](protocols/peer-protocol.md) and [servers.md](protocols/servers.md); running the servers is in [self-host.md](self-host.md) and [cloudflare-turn.md](cloudflare-turn.md).

| Part            | Where                                                                                                                                                                  | Does                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Transport       | [`transport.ts`](../src/net/transport.ts), [`trystero.ts`](../src/net/trystero.ts), [`broadcast.ts`](../src/net/broadcast.ts), [`loopback.ts`](../src/net/loopback.ts) | Delivers JSON messages between peers in a room and reports peers arriving and leaving.              |
| Session         | [`session.ts`](../src/net/session.ts)                                                                                                                                  | Keeps one peer's copy of the log in step with the host's; elects hosts; compares checksums.         |
| Package sharing | [`share.ts`](../src/packages/share.ts)                                                                                                                                 | Moves rules package bytes between peers, outside the log.                                           |
| Configuration   | [`config.ts`](../src/net/config.ts), [`relayBusy.ts`](../src/net/relayBusy.ts)                                                                                         | Decides which signalling relays and TURN servers to use.                                            |
| Servers         | [`server/relay.mjs`](../server/relay.mjs), [`server/turn-worker.mjs`](../server/turn-worker.mjs)                                                                       | Signalling, site configuration, TURN logins and a health check.                                     |
| App wiring      | [`store.ts`](../src/store.ts)                                                                                                                                          | Chooses the transport, saves the log per room, and joins or reclaims a player once a host is found. |

Current contract: **peer protocol 11**, carrying `open-battle/record@9`.

## Guarantees

1. **One writer.** At any moment a room has at most one host it follows, and only the host appends to the log. Every event names the host that logged it.
2. **In order, without gaps.** A peer applies an event only if its seq is exactly one more than the last it holds. On a gap it stops and asks the host for what it is missing.
3. **Nothing is decided twice.** Dice, shuffles and macro results are resolved once, by the host, and travel as data. Other peers never re-resolve an intent.
4. **History is checked.** Every peer hashes the table at the same checkpoints and compares with the host's hash, so drift is noticed.
5. **Unknown is ignored.** A message whose `t` a build does not know, or a field it does not use, is skipped, never an error. A peer on a different protocol number is parked rather than misread.

## Roles

A peer joins a room as **host**, **client** or **spectator**.

- The **host** resolves every intent, its own and everyone else's, into a logged event, appends it and sends it to the room. It may dispatch an intent as any named player, which is how one screen plays several players.
- A **client** sends intents to the host and changes its table only when the host's event comes back. It can become host if the host leaves.
- A **spectator** receives the game like a client, optionally some time behind it, sends no intents and is never elected host.

## Transports

The session needs only this from a transport:

```ts
interface Transport {
  readonly selfId: string;
  send(message: NetMessage, to?: string): void; // one peer, or everyone
  onMessage(handler: (message: NetMessage, from: string) => void): void;
  onPeerJoin(handler: (peerId: string) => void): void;
  onPeerLeave(handler: (peerId: string) => void): void;
  leave(): void;
  rejoin?(): void; // leave and join the same room again, keeping the id and handlers
}
```

`from` is the transport's id for the sending peer. The session and the game use that id as the player's identity, so it is never taken from a message's contents.

| Mode      | Transport                    | Reaches                                                                                                                                                                       |
| --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `online`  | `trysteroTransport(roomId)`  | Other browsers anywhere, over WebRTC data channels. Loaded on demand.                                                                                                         |
| `local`   | `broadcastTransport(roomId)` | Other tabs of the same browser, over a `BroadcastChannel` named `open-battle:<roomId>`. Peers announce, welcome and say goodbye on page hide.                                 |
| `hotseat` | `createLoopbackNetwork()`    | Nobody: one peer, `solo`, hosts alone. Two players are recorded at seats 0 and 1, and each intent is dispatched, by default, as the player whose seat matches `pointer.seat`. |

The loopback network also connects several in-memory peers, delivering synchronously and deep-copying each message so peers never share objects.

**WebRTC.** The online transport uses [Trystero](https://github.com/dmotz/trystero) with app id `open-battle-dev` and the room id from the invite link (`?room=`). Every message is one JSON value on the Trystero action `msg`. Signalling goes through a self-hosted WebSocket relay when one is configured, and through public Nostr relays otherwise; it carries only the WebRTC handshake. After that, data flows browser to browser, or through a TURN server when the networks in between allow nothing else.

Trystero can drop a peer's side of a connection just after meeting while the other side keeps it. `rejoin()` leaves and joins the room again on the same id, which makes the other side meet it afresh.

## Meeting the host

```text
joiner                                host
  │  (transport: peer joined)           │
  │── sync {seq, role, ready} ─────────▶│  every non-host greets a new peer with its log length
  │◀──────────────── host {seq, resumed, v}  the host announces itself to each peer it meets
  │── hello {seq, tail, role, v} ──────▶│  "this much of the log I already hold"
  │◀────────── events {events, check?}  │  the rest, if the tail matches
  │◀──────────────────── record {record}│  otherwise the whole record
```

- `tail` fingerprints the joiner's last event as `seq:at:by:type`. If the host's event at that seq has the same fingerprint, the logs agree up to there and only the missing events are sent, with the latest checksum after that point. Otherwise, or when the joiner holds nothing, the host sends the whole record.
- A joiner that has met peers but no host repeats its `sync` every 3 seconds, up to ten times; a host answers any `sync` from a peer that has not greeted it by announcing again. A joiner left with no peers at all calls `rejoin()` instead.
- A joiner follows the first host it hears, or a later one that [outranks](#changing-host) it.

**Joining the game.** Once a peer has a host and the game's log, and holds every rules package the game names, the app makes it a participant. It claims an earlier identity if it has one, and sends `player/join` otherwise:

- the identity this tab last had in the room (kept in `sessionStorage`), or
- this browser's last identity in the room (kept in `localStorage`), provided that identity is not connected right now.

A claim hands the identity, its seat and everything it owns to the new peer id ([participants](engine.md#participants-and-explicit-seats)).

## Playing

```text
client                 host                                  every other peer
  │── intent ────────▶ │ resolve: validate, roll, run macro
  │                    │ append as seq N, record reactions
  │◀─ event {logged N, check?} ─┼──────────────────────────────▶│
  │ apply N            │                                       │ apply N
```

**Sending.** A client sends `intent` to its host. While the room has no host, intents wait in a queue and go to whichever host it follows next; if the client becomes host itself, it applies them.

**Resolving.** The host resolves an intent with the engine's `resolveLogged` and logs the result; a rejected intent produces nothing, and its sender gets no reply. `macro/start` and `macro/answer` for the game being played go to the rules sandbox with a seed the host draws from its RNG. While the sandbox works on one, further intents queue and are resolved in arrival order afterwards, so the log keeps the order intents arrived in. A package change (`game/system`, `game/packages`) that differs from the recorded one is refused while a macro is waiting or a reaction is owed.

**Hooks.** When the host logs an event it asks the loaded hooks what the event sets off and records those obligations in the event's `reactions` before sending it. It then starts the oldest owed reaction whenever no macro is running and nothing is resolving: after each logged event, after a sandbox result, on becoming host, and when the sandbox's code changes. A reaction whose code is not loaded stays owed. The rules are in [execution continuity](engine.md#execution-continuity).

**Authority.** The host keeps an authority counter. Leaving, standing down or having its sandbox router replaced increments it and empties the resolution queue. A sandbox result that returns under an older counter value is discarded: it appends nothing and discharges no reaction.

**Applying.** A peer accepts `event`, `events` and `record` only from the host it follows. It ignores events it already holds, appends the next one, and on a gap sends `hello` and stops until the missing events arrive. Every event except `undo` folds directly onto the current table; an undo rebuilds the table from the log.

## Coming back

A peer saves its copy of the log for each room it is in, in `sessionStorage` under `open-battle:record@9:room:<roomId>`, with its role and player id. A reloaded client tab starts from that log and its `hello` asks only for what it missed. A different record format is never read from the cache.

A host can start from a saved record to resume a game (`resumed`). If the room carried on without it under another host with a longer log, it stands down and rejoins as a client. Otherwise it takes the room back, and about a second and a half later reclaims its recorded identity.

## Changing host

When the host's connection goes, every client that has received the log from it starts a migration. A joiner that never received the log looks for a host again instead.

1. **Report.** Each client sends `sync { seq, role, ready }`. `ready` says it holds every package the game names, so it could run the game's macros.
2. **Wait.** Peers wait a grace period, 4 seconds by default, in case the host returns.
3. **Elect.** Every peer computes the same answer from what it has heard. The candidates are clients that are ready and not parked, including itself. The winner has the longest log, then is a resumed host, then has the lowest peer id.
4. **Take over.** The winner becomes host and announces itself. It applies the intents it had queued, then drains owed reactions. The others follow its announcement, greet it with `hello`, and send it their queued intents. If no candidate is ready, the room waits and tries again after another grace period.

**Two hosts.** If two peers both claim the host role, each compares the other's announcement with itself by the same ranking. The one that loses sends `yield { to }`, becomes a client and follows the winner. Clients that followed the loser follow the winner too. The winner announces again, to make sure the other hears it.

A peer with no host that receives a whole `record` follows the peer that sent it as host.

## Checksums

Every peer keeps the table as it stood at the last 32 checkpoints: every tenth event, and every event that sets the pointer. It hashes them lazily, when the browser is idle. The hash is the engine's `stateHash` ([checksums](engine.md#checksums)).

The host attaches its hash for the latest checkpoint to the next event it sends, as `check { seq, hash }`. A peer that holds the same checkpoint compares. On a mismatch it reports a **desync** with both hashes and a running count. A later checkpoint that matches clears it. The last 64 comparisons are kept for a problem report.

A desync is reported, not repaired. A player's `resync` sends the intent `player/resync`, which is logged (a desync is evidence of a bug or mismatched code); the host then sends its whole record. A spectator's resync sends a `hello` without a log position, which also returns the record. Receiving a record replaces the peer's log and clears its checkpoints and any reported desync.

## Spectators

A spectator greets with `hello { role: "spectator", delay? }`. With no delay it is sent events as they happen, like a client.

A spectator can watch behind the game. The host answers a `delay` in milliseconds, capped at ten minutes and raised to the host's spectator floor, with `delay { ms }`. It then sends the part of the log older than that, and every 250 ms the events that have become old enough. Checksums are not sent to a delayed spectator, because they would describe a table ahead of its view. The host sends the rest of the log to every delayed spectator when it leaves, and when a game sets `pointer.over` to `true`.

While the host has a spectator floor, it holds back events from every peer not known to be a client: a peer that has not greeted it yet, for example, gets events only once it has. The app does not currently set a floor or ask for a delay.

Spectators send no intents. That is enforced by the spectator's own session, not by the host.

## Versions and parked peers

`hello` and `host` carry `v { protocol, build }`. `protocol` is the peer protocol number (11); `build` is the app version and commit.

- A peer whose `protocol` differs is **parked**. The host sends it no events, drops its intents, never follows its announcements and never elects it. Both sides show that they can't play together.
- A peer with the same protocol and a different `build` plays normally; the app shows that the builds differ, because they may fold differently.
- A peer that sends no `v` is assumed to share the protocol.

Side messages are delivered to parked peers too, so packages still travel between them.

## Package sharing

Rules packages travel as **side messages**, never in the log and never checksummed. Any peer may send them to any other.

| Message                                    | Purpose                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `package/want { hash }`                    | Asks the room for the package with that SHA-256.                                                                         |
| `package/part { hash, part, parts, data }` | One slice of a package, base64, 48 Ki characters per part, sent only to the peer that asked.                             |
| `package/status { missing }`               | The hashes of the game's packages this peer still lacks, sent to everyone when it changes and to each peer that arrives. |

- **Asking.** A player asks the room for a package the game names that their library lacks. It may ask again after a transfer has stalled for 15 seconds.
- **Answering.** Any peer holding the package answers, if the package is no larger than 4 MiB; bigger packages are loaded from a file.
- **Receiving.** A peer takes parts only for a hash it asked for, only from the first peer that answers, and only within the size bound. Once all parts are in it decodes them and adds the bytes to its library, which checks them against the hash.
- **Running.** Arriving bytes are not trusted automatically. Package code runs only after the player has trusted that hash, or chose "trust what arrives" when asking.

A peer that still lacks a package is not `ready`: it cannot win a host election, and the app does not join it to the game until its library has every package.

## Finding each other

WebRTC needs a **signalling** channel to exchange connection offers, **STUN** to discover public addresses, and on restrictive networks a **TURN** server to relay the traffic.

**Configuration.** `netConfig()` reads three sources and takes the first that says something, so an invite link can carry its own settings:

1. the page URL: `?signal=`, `?nostr=`, `?turn=` with `turnUser` and `turnPass`, and `?forceTurn=1`;
2. the site's `config.json` (`signal`, `nostr`, `turn`), fetched once as the page opens, with a 3-second timeout;
3. build-time variables: `VITE_SIGNAL_URL`, `VITE_NOSTR_RELAYS`, `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_PASS`.

TURN servers come from those sources first. Failing that, they come from a **TURN login service** (`VITE_TURN_CONFIG`). The page fetches short-lived logins from it as it opens, and fetches fresh ones once half their lifetime has passed. Without TURN, peers connect wherever STUN is enough. `?forceTurn=1` sends everything through TURN, to test a TURN server.

When coturn refuses a relay because it is full (STUN errors 486 or 508), the app says the relay is busy instead of waiting in silence; any connection that succeeds clears that.

**Servers.**

- **[`server/relay.mjs`](../server/relay.mjs)** (`pnpm relay`, port 8787). Answers on three paths:
  - `/relay` is a Trystero WebSocket signalling relay;
  - `GET /config.json` gives the relay's URL and, when `TURN_SECRET` is set, a coturn login signed with it (HMAC-SHA1, valid for `TURN_TTL`, 24 hours by default), so the secret never reaches a browser;
  - `GET /health.json` reports uptime and whether the TURN server answers a STUN request.

  It refuses to start with a `TURN_SECRET` shorter than 16 characters.

- **[`server/turn-worker.mjs`](../server/turn-worker.mjs)** (a Cloudflare Worker). `GET /` returns `{ turn, ttl }`: logins from Cloudflare's TURN service, valid for 4 hours by default (10 minutes to 48 hours). It leaves out non-TURN and port-53 URLs and answers only the origins in `ALLOWED_ORIGINS` when that is set.

## Messages

| `t`         | Direction                 | Carries                                  | Purpose                                                      |
| ----------- | ------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| `hello`     | Non-host → host           | `seq?`, `tail?`, `role?`, `delay?`, `v?` | Greets the host and says how much of the log the peer holds. |
| `host`      | Host → each peer it meets | `seq`, `resumed?`, `v?`                  | Announces the host and its log length.                       |
| `sync`      | Non-host → peers          | `seq`, `role`, `ready?`                  | Reports log length and readiness, for meeting and elections. |
| `yield`     | Losing host → everyone    | `to`                                     | Stands down in favour of another host.                       |
| `intent`    | Client → host             | `intent`                                 | Asks for something to happen.                                |
| `event`     | Host → room               | `logged`, `check?`                       | One newly logged event, and the latest checkpoint's hash.    |
| `events`    | Host → one peer           | `events`, `check?`                       | The events a peer is missing, in order.                      |
| `record`    | Host → one peer           | `record`                                 | The whole game, when catching up by events is not possible.  |
| `delay`     | Host → spectator          | `ms`                                     | How far behind the game the host will send it events.        |
| `package/*` | Any peer → any peer       | See [package sharing](#package-sharing)  | Rules package bytes and status, outside the log.             |

## Timings and limits

| What                                          | Value                                                    |
| --------------------------------------------- | -------------------------------------------------------- |
| Grace before electing a new host              | 4 s by default                                           |
| Joiner asking again for a host                | Every 3 s, up to 10 times                                |
| Resumed host reclaiming its identity          | After 1.5 s                                              |
| Checkpoint states kept                        | 32                                                       |
| Checksum comparisons kept for a report        | 64                                                       |
| Spectator delay                               | Up to 10 minutes; events released every 250 ms           |
| Package size shared between peers             | 4 MiB                                                    |
| Package part                                  | 48 Ki base64 characters                                  |
| Stalled package transfer                      | Can be asked for again after 15 s                        |
| Build string in `v`                           | Up to 80 characters                                      |
| Site `config.json` / TURN login fetch timeout | 3 s / 5 s                                                |
| TURN logins from the login service            | Refreshed after half their lifetime; at least 10 minutes |

## What the network does not promise

- **Authenticated peers.** Peer ids come from the transport, and nothing proves who is behind one. Any peer can announce itself as host, and peers follow an announcement that outranks their current host. A record sent to a peer with no host makes the sender its host.
- **Permissions beyond impersonation.** The host refuses an intent that acts as someone other than its sender, as the engine defines. It does not check the sender's role, so a modified spectator could send intents.
- **Delivery of every intent.** An intent sent to a host that leaves before logging it is lost, as are intents queued for the sandbox when the host loses authority. The player sends them again.
- **Automatic repair.** A desync is shown, and fixed only when someone resyncs.
- **Secrecy from other peers.** Every peer holds the full record. Secrets keep their values on their owners' devices ([secrets](engine.md#secrets)); everything else in the log is visible to every peer in the room.
- **Private signalling.** Public Nostr relays see that peers are meeting in a room. A self-hosted relay avoids depending on them.
