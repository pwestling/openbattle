import { useEffect, useState } from "react";
import type { Intent, PackageRef } from "./core";
import { useLibrary, type StoredPackage } from "./packages/library";
import { requestPackage, transferPercent, usePackageSharing, useTransfers } from "./packages/share";
import { usePackageSandbox } from "./sandbox/runtime";
import { keepSecret, localSecret, useLocalSecrets } from "./secrets/local";
import { useStore, type Mode } from "./store";
import { APP_BUILD } from "./version";

/**
 * The bare minimum UI: enough to start or join a game, load a rules package,
 * send intents and watch the log and the state, so the core, the network and
 * the sandbox can be checked by hand. The game itself is the package's.
 */

const refOf = (p: StoredPackage): PackageRef => ({
  id: p.manifest.id,
  name: p.manifest.name,
  version: p.manifest.version,
  hash: p.hash,
  bytes: p.bytes,
  ...(p.manifest.author ? { author: p.manifest.author } : {}),
  ...(p.manifest.kind === "system" ? { kind: "system" as const } : {}),
});

const QUICK: [string, Intent][] = [
  ["Next phase", { type: "turn/next" }],
  ["Roll a d6", { type: "dice/roll", count: 1, sides: 6 }],
  ["Undo", { type: "undo", seq: 0 }],
];

export function App() {
  usePackageSandbox();
  usePackageSharing();
  const { game, record, session, role, mode, roomId, net, start, leave, dispatch } = useStore();
  const library = useLibrary((s) => s.packages);
  useEffect(() => void useLibrary.getState().load(), []);
  const [name, setName] = useState("Player");
  const [startMode, setStartMode] = useState<Mode>("hotseat");
  const [startRole, setStartRole] = useState<"host" | "client" | "spectator">("host");
  const [room, setRoom] = useState(() => new URLSearchParams(location.search).get("room") ?? "room1");
  const [pkgHash, setPkgHash] = useState("");
  const [json, setJson] = useState('{ "type": "turn/next" }');
  const [as, setAs] = useState("");
  const [problem, setProblem] = useState("");
  const transfers = useTransfers((s) => s.byHash);
  useLocalSecrets((s) => s.kept);
  const [secretKey, setSecretKey] = useState("hand:1");
  const [secretValue, setSecretValue] = useState("a secret");

  const systems = Object.values(library).filter((p) => p.manifest.kind === "system");
  const pkg = library[pkgHash] ?? systems[0];

  async function loadFile(file: File) {
    const lib = useLibrary.getState();
    await lib.load();
    const r = await lib.add(new Uint8Array(await file.arrayBuffer()), { own: true });
    if (!r.ok) return setProblem(String(r.error));
    lib.trust(r.pkg.hash, true);
    setPkgHash(r.pkg.hash);
    setProblem("");
  }

  function begin() {
    const system = startRole === "host" ? pkg?.manifest.systems[0] : undefined;
    start({
      role: startRole,
      mode: startMode,
      roomId: startMode === "hotseat" ? undefined : room,
      name,
      ...(system ? { system } : {}),
    });
    if (startRole === "host" && pkg)
      setTimeout(
        () =>
          useStore.getState().dispatch({
            type: "game/packages",
            app: APP_BUILD,
            system: { id: pkg.manifest.systems[0]!, builtIn: false },
            packages: [refOf(pkg)],
          }),
        300,
      );
  }

  function send(intent: Intent) {
    setProblem("");
    try {
      dispatch(intent, as || undefined);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  }

  const events = record.events.slice(-150).reverse();
  return (
    <main>
      <section>
        <h1>
          Open Battle · debug table <span className="muted">build {APP_BUILD}</span>
        </h1>
        {!session ? (
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
            <select
              value={startMode}
              onChange={(e) => setStartMode(e.target.value as Mode)}
              aria-label="Mode"
            >
              <option value="hotseat">hotseat (one screen)</option>
              <option value="local">local (tabs of this browser)</option>
              <option value="online">online (WebRTC)</option>
            </select>
            <select
              value={startRole}
              onChange={(e) => setStartRole(e.target.value as typeof startRole)}
              aria-label="Role"
            >
              <option value="host">host</option>
              <option value="client">join</option>
              <option value="spectator">watch</option>
            </select>
            {startMode !== "hotseat" && (
              <input value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room" />
            )}
            <select
              value={pkg?.hash ?? ""}
              onChange={(e) => setPkgHash(e.target.value)}
              aria-label="Game package"
            >
              {systems.length === 0 && <option value="">(no game package loaded)</option>}
              {systems.map((p) => (
                <option key={p.hash} value={p.hash}>
                  {p.manifest.name} {p.manifest.version}
                </option>
              ))}
            </select>
            <label>
              Load a package…{" "}
              <input
                type="file"
                accept=".js"
                onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])}
              />
            </label>
            <button onClick={begin}>Start</button>
          </div>
        ) : (
          <div className="row">
            <span>
              {role} · {mode}
              {roomId ? ` · room ${roomId}` : ""} · host {net?.hostId ?? "?"} · peers {net?.peers.length ?? 0}
              {net?.migrating ? " · migrating" : ""}
            </span>
            <span className="muted">self {session.selfId}</span>
            <button onClick={leave}>Leave</button>
          </div>
        )}
        {problem && <p className="bad">{problem}</p>}
      </section>

      {session && (
        <>
          <section>
            <h2>
              Game · {game.system ?? "none"} · round {game.turn.round}, seat {game.turn.activeSeat}, seq{" "}
              {game.seq}
            </h2>
            <p className="muted">
              Players:{" "}
              {Object.values(game.players)
                .map((p) => `${p.name} (seat ${p.seat})`)
                .join(", ") || "none"}{" "}
              · units {Object.keys(game.units).length} · models {Object.keys(game.models).length}
            </p>
            <div className="row">
              {QUICK.map(([label, intent]) => (
                <button
                  key={label}
                  onClick={() =>
                    send(
                      intent.type === "undo" ? { type: "undo", seq: record.events.at(-1)?.seq ?? 0 } : intent,
                    )
                  }
                >
                  {label}
                </button>
              ))}
              {mode === "hotseat" && (
                <select value={as} onChange={(e) => setAs(e.target.value)} aria-label="Send as">
                  <option value="">as the active side</option>
                  {Object.values(game.players).map((p) => (
                    <option key={p.id} value={p.id}>
                      as {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <textarea value={json} onChange={(e) => setJson(e.target.value)} aria-label="Intent JSON" />
            <div className="row">
              <button
                onClick={() => {
                  try {
                    send(JSON.parse(json) as Intent);
                  } catch (e) {
                    setProblem(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Send intent
              </button>
            </div>
          </section>

          <section>
            <h2>Rules packages this game names</h2>
            {(game.packages?.packages ?? []).length === 0 && <p className="muted">none</p>}
            {(game.packages?.packages ?? []).map((p) => {
              const have = !!library[p.hash];
              const t = transfers[p.hash];
              return (
                <div className="row" key={p.hash}>
                  <span>
                    {p.name} {p.version} <span className="muted">{p.hash.slice(0, 10)}</span>
                  </span>
                  <span className={have ? "ok" : "bad"}>
                    {have
                      ? library[p.hash]!.trusted
                        ? "here, trusted"
                        : "here, not trusted"
                      : t
                        ? `${t.state} ${transferPercent(t)}%`
                        : "missing"}
                  </span>
                  {!have && (
                    <button onClick={() => requestPackage(p.hash, { trust: true })}>
                      Ask the room for it
                    </button>
                  )}
                  {have && !library[p.hash]!.trusted && (
                    <button onClick={() => useLibrary.getState().trust(p.hash, true)}>Trust</button>
                  )}
                </div>
              );
            })}
          </section>

          <section>
            <h2>Hidden values (kept on this device, only the commitment is on the table)</h2>
            <div className="row">
              <input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                aria-label="Secret key"
              />
              <input
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                aria-label="Secret value"
              />
              <button
                onClick={() => {
                  const me = as || session.selfId;
                  send({
                    type: "secret/commit",
                    player: me,
                    secrets: [{ key: secretKey, commitment: keepSecret(secretValue) }],
                  });
                }}
              >
                Commit
              </button>
            </div>
            {Object.entries(game.secrets ?? {}).flatMap(([player, entries]) =>
              Object.entries(entries).map(([key, e]) => {
                const mine = localSecret(e.commitment);
                return (
                  <div className="row" key={`${player}:${key}`}>
                    <span>
                      {player} · {key} · <span className="muted">{e.commitment.slice(0, 10)}</span>
                    </span>
                    {e.revealed ? (
                      <span className="ok">revealed: {JSON.stringify(e.revealed.value)}</span>
                    ) : mine ? (
                      <button
                        onClick={() =>
                          send({ type: "secret/reveal", player, key, value: mine.value, salt: mine.salt })
                        }
                      >
                        Reveal
                      </button>
                    ) : (
                      <span className="muted">hidden</span>
                    )}
                  </div>
                );
              }),
            )}
          </section>

          <section>
            <h2>Event log (newest first, {record.events.length} total)</h2>
            <table>
              <tbody>
                {events.map((e) => (
                  <tr key={e.seq}>
                    <td>{e.seq}</td>
                    <td className="muted">{e.by}</td>
                    <td className="muted">{e.host ?? ""}</td>
                    <td>{e.event.type}</td>
                    <td className="muted">{JSON.stringify(e.event).slice(0, 140)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <details>
              <summary>State</summary>
              <pre>{JSON.stringify(game, null, 1)}</pre>
            </details>
            <details>
              <summary>Network status</summary>
              <pre>{JSON.stringify(net, null, 1)}</pre>
            </details>
          </section>
        </>
      )}
    </main>
  );
}
