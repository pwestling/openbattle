import { useEffect, useState } from "react";
import {
  branchRecord,
  type EntityKind,
  type EntityRef,
  type Intent,
  type Json,
  type Mod,
  type PackageRef,
} from "./core";
import { useLibrary, type StoredPackage } from "./packages/library";
import { requestPackage, transferPercent, usePackageSharing, useTransfers } from "./packages/share";
import { requestApp, usePackageSandbox, useSandbox } from "./sandbox/runtime";
import { keepSecret, localSecret, useLocalSecrets } from "./secrets/local";
import { useStore, type Mode } from "./store";
import { moduleInfo } from "./systems";
import { APP_BUILD } from "./version";

/**
 * The bare minimum UI: enough to start or join a game, load a rules package,
 * send every kind of primitive intent, start a module's actions and answer
 * its questions, and watch the log and the state, so the core, the network
 * and the sandbox can be checked by hand. The game itself is the package's.
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

const short = () => Math.random().toString(36).slice(2, 7);
const parse = (text: string): Json => {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return text;
  }
};

function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <details open={open}>
        <summary>
          <strong>{title}</strong>
        </summary>
        {children}
      </details>
    </section>
  );
}

export function App() {
  usePackageSandbox();
  usePackageSharing();
  const { game, record, session, role, mode, roomId, net, start, leave, dispatch } = useStore();
  const library = useLibrary((s) => s.packages);
  const app = useSandbox((s) => s.app);
  const sandboxStatus = useSandbox((s) => s.status);
  const sandboxError = useSandbox((s) => s.error);
  const transfers = useTransfers((s) => s.byHash);
  useLocalSecrets((s) => s.kept);
  useEffect(() => void useLibrary.getState().load(), []);
  const [name, setName] = useState("Player");
  const [startMode, setStartMode] = useState<Mode>("hotseat");
  const [startRole, setStartRole] = useState<"host" | "client" | "spectator">("host");
  const [room, setRoom] = useState(() => new URLSearchParams(location.search).get("room") ?? "room1");
  const [pkgHash, setPkgHash] = useState("");
  const [json, setJson] = useState('{ "type": "log/note", "text": "hello" }');
  const [as, setAs] = useState("");
  const [problem, setProblem] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const f = (k: string, d = "") => form[k] ?? d;
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const systems = Object.values(library).filter((p) => p.manifest.kind === "system");
  const pkg = library[pkgHash] ?? systems[0];
  const players = Object.values(game.players);
  const active = players.find((p) => p.seat === game.pointer.seat);
  // Whose actions the module is asked about: the screen's player, or the chosen one in hotseat.
  const me = mode === "hotseat" ? as || active?.id || null : (session?.selfId ?? null);
  useEffect(() => requestApp(me), [me, record.events.length]);

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
            system: pkg.manifest.systems[0]!,
            packages: [refOf(pkg)],
          }),
        300,
      );
  }

  function send(intent: Intent, sender?: string) {
    setProblem("");
    try {
      dispatch(intent, sender ?? (as || undefined));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  }

  const refs: EntityRef[] = [
    ...players.map((p) => ({ kind: "player" as const, id: p.id })),
    ...Object.keys(game.units).map((id) => ({ kind: "unit" as const, id })),
    ...Object.keys(game.models).map((id) => ({ kind: "model" as const, id })),
    ...Object.keys(game.tokens).map((id) => ({ kind: "token" as const, id })),
  ];
  const refText = (r: EntityRef) => `${r.kind}:${r.id}`;
  const refFrom = (text: string): EntityRef => {
    const i = text.indexOf(":");
    return { kind: text.slice(0, i) as EntityKind, id: text.slice(i + 1) };
  };
  const target = refFrom(f("ref", refs[0] ? refText(refs[0]) : "player:"));
  const owner = as || me || players[0]?.id || "";
  const waiting = game.macro?.waiting;
  const info = moduleInfo(game.system);
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
              {net?.desync ? ` · DESYNC at ${net.desync.seq}` : " · in sync"}
            </span>
            <span className="muted">self {session.selfId}</span>
            <button onClick={leave}>Leave</button>
          </div>
        )}
        {problem && <p className="bad">{problem}</p>}
        {sandboxError && <p className="bad">{sandboxError}</p>}
      </section>

      {session && (
        <>
          <section>
            <h2>
              Game · {game.system ?? "no game"} · sandbox {sandboxStatus} · seq {game.seq}
            </h2>
            <p>
              Pointer <code data-testid="pointer">{JSON.stringify(game.pointer)}</code>
              {info ? ` · phases ${info.pointer.map((p) => p.id).join(", ")}` : ""}
            </p>
            <p className="muted">
              Players: {players.map((p) => `${p.name} (seat ${p.seat})`).join(", ") || "none"} · units{" "}
              {Object.keys(game.units).length} · models {Object.keys(game.models).length} · tokens{" "}
              {Object.keys(game.tokens).length} · terrain {game.terrain.length} · mods {game.mods.length} ·
              decks {game.decks?.length ?? 0}
            </p>
            <div className="row">
              {mode === "hotseat" && (
                <select value={as} onChange={(e) => setAs(e.target.value)} aria-label="Send as">
                  <option value="">as the active side</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      as {p.name}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={() => send({ type: "undo", seq: record.events.at(-1)?.seq ?? 0 })}>
                Undo last
              </button>
              <button
                onClick={() => {
                  // A branch starts between macros: one that is running cannot be copied.
                  const made = branchRecord(record, record.events.at(-1)?.seq ?? 0, owner);
                  if (!made) return setProblem("A macro is running: branch between actions");
                  start({ role: "host", mode, roomId: roomId ?? undefined, name, record: made });
                }}
              >
                Branch from now
              </button>
            </div>
          </section>

          {waiting && game.macro && (
            <section>
              <h2>
                A macro is waiting: {game.macro.macro} (run {game.macro.startSeq}, answers from{" "}
                {waiting.player})
              </h2>
              <p>{waiting.question}</p>
              <div className="row">
                {waiting.reveal !== undefined ? (
                  <button
                    onClick={() => {
                      const entry = game.secrets?.[waiting.player]?.[waiting.reveal!];
                      const mine = entry ? localSecret(entry.commitment) : undefined;
                      if (!mine) return setProblem("This device does not hold that secret");
                      send(
                        {
                          type: "macro/answer",
                          answer: JSON.stringify({ value: mine.value, salt: mine.salt }),
                        },
                        waiting.player,
                      );
                    }}
                  >
                    Reveal {waiting.reveal}
                  </button>
                ) : (
                  waiting.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() =>
                        send(
                          {
                            type: "macro/answer",
                            answer: waiting.secret !== undefined ? keepSecret(o.id) : o.id,
                          },
                          waiting.player,
                        )
                      }
                    >
                      {o.label}
                    </button>
                  ))
                )}
              </div>
            </section>
          )}

          <Section
            title={`The module's actions for ${me ?? "nobody"}${app?.panel ? ` · panel: ${app.panel.title}` : ""}`}
            open
          >
            {app?.panel && (
              <p>
                {(app.panel.lines ?? []).join(" · ")}{" "}
                {(app.panel.buttons ?? []).map((b) => (
                  <button
                    key={b.label}
                    disabled={!!b.disabled}
                    title={b.disabled}
                    onClick={() =>
                      send({ type: "macro/start", macro: b.macro, args: b.args ?? {} }, b.player)
                    }
                  >
                    {b.label}
                  </button>
                ))}
              </p>
            )}
            {!app?.actions.length && (
              <p className="muted">nothing offered (is the game's package loaded and trusted?)</p>
            )}
            <table>
              <tbody>
                {(app?.actions ?? []).map((a, i) => (
                  <tr key={`${a.id}:${a.unitId ?? ""}:${i}`}>
                    <td>{a.name}</td>
                    <td className="muted">{a.unitId ?? "player"}</td>
                    <td>
                      {a.available === true ? (
                        a.targeted ? (
                          a.targets.map((t) => (
                            <button
                              key={t.unitId}
                              onClick={() =>
                                send({
                                  type: "macro/start",
                                  macro: a.id,
                                  args: {
                                    ...(a.unitId ? { unit: a.unitId } : {}),
                                    ...(t.unitId ? { target: t.unitId } : {}),
                                  },
                                })
                              }
                            >
                              {t.label}
                            </button>
                          ))
                        ) : (
                          <button
                            onClick={() =>
                              send({
                                type: "macro/start",
                                macro: a.id,
                                args: a.unitId ? { unit: a.unitId } : {},
                              })
                            }
                          >
                            Start
                          </button>
                        )
                      ) : (
                        <span className="muted">{a.available}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Primitive intents">
            <div className="row">
              <strong>Pointer</strong>
              <input
                size={4}
                placeholder="round"
                value={f("round", String(game.pointer.round))}
                onChange={set("round")}
              />
              <input
                size={4}
                placeholder="seat"
                value={f("seat", String(game.pointer.seat))}
                onChange={set("seat")}
              />
              <input
                size={10}
                placeholder="phase"
                value={f("phase", String(game.pointer.phase ?? ""))}
                onChange={set("phase")}
              />
              <input
                size={14}
                placeholder='extra fields {"n":1}'
                value={f("extra")}
                onChange={set("extra")}
              />
              <button
                onClick={() =>
                  send({
                    type: "pointer/set",
                    pointer: {
                      ...(f("extra") ? (parse(f("extra")) as Record<string, Json>) : {}),
                      round: Number(f("round", String(game.pointer.round))),
                      seat: Number(f("seat", String(game.pointer.seat))),
                      phase: f("phase", String(game.pointer.phase ?? "")) || null,
                    },
                  })
                }
              >
                pointer/set
              </button>
            </div>
            <div className="row">
              <strong>Add</strong>
              <input size={6} placeholder="name" value={f("uname", "Squad")} onChange={set("uname")} />
              <input size={3} placeholder="n" value={f("un", "3")} onChange={set("un")} />
              <input size={4} placeholder="x" value={f("ux", "0")} onChange={set("ux")} />
              <input size={4} placeholder="y" value={f("uy", "0")} onChange={set("uy")} />
              <button
                onClick={() => {
                  const id = `u-${short()}`;
                  const n = Math.max(1, Number(f("un", "3")));
                  send({
                    type: "unit/add",
                    unit: { id, owner, name: f("uname", "Squad"), modelIds: [], q: { hp: 3 } },
                    models: Array.from({ length: n }, (_, i) => ({
                      id: `${id}-${i}`,
                      owner,
                      label: `${f("uname", "Squad")} ${i + 1}`,
                      position: { x: Number(f("ux", "0")) + i * 1.5, y: Number(f("uy", "0")) },
                      facing: 0,
                      base: { shape: "round" as const, diameterMm: 32 },
                    })),
                  });
                }}
              >
                unit/add
              </button>
              <button
                onClick={() =>
                  send({
                    type: "token/add",
                    token: {
                      id: `t-${short()}`,
                      kind: "marker",
                      position: { x: Number(f("ux", "0")), y: Number(f("uy", "0")) },
                      label: "marker",
                      owner,
                    },
                  })
                }
              >
                token/add
              </button>
            </div>
            <div className="row">
              <strong>Move</strong>
              <select
                value={f("model", Object.keys(game.models)[0] ?? "")}
                onChange={set("model")}
                aria-label="Model"
              >
                {Object.keys(game.models).map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
              <input size={4} placeholder="x" value={f("mx", "0")} onChange={set("mx")} />
              <input size={4} placeholder="y" value={f("my", "0")} onChange={set("my")} />
              <button
                onClick={() =>
                  send({
                    type: "models/move",
                    moves: [
                      {
                        id: f("model", Object.keys(game.models)[0] ?? ""),
                        to: { x: Number(f("mx", "0")), y: Number(f("my", "0")) },
                      },
                    ],
                  })
                }
              >
                models/move
              </button>
              <select
                value={f("munit", Object.keys(game.units)[0] ?? "")}
                onChange={set("munit")}
                aria-label="Unit"
              >
                {Object.keys(game.units).map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
              <button
                onClick={() =>
                  send({
                    type: "unit/move",
                    id: f("munit", Object.keys(game.units)[0] ?? ""),
                    pivot: { x: 0, y: 0 },
                    turn: 0,
                    delta: { x: Number(f("mx", "0")), y: Number(f("my", "0")) },
                  })
                }
              >
                unit/move by (x, y)
              </button>
            </div>
            <div className="row">
              <strong>Entity</strong>
              <select value={refText(target)} onChange={set("ref")} aria-label="Entity">
                {refs.map((r) => (
                  <option key={refText(r)}>{refText(r)}</option>
                ))}
              </select>
              <input size={8} placeholder="key" value={f("key", "hp")} onChange={set("key")} />
              <input size={8} placeholder="value (JSON)" value={f("value", "3")} onChange={set("value")} />
              <button
                onClick={() =>
                  send({ type: "q/set", ref: target, key: f("key", "hp"), value: parse(f("value", "3")) })
                }
              >
                q/set
              </button>
              <button
                onClick={() =>
                  send({ type: "q/adjust", ref: target, key: f("key", "hp"), delta: Number(f("value", "1")) })
                }
              >
                q/adjust
              </button>
              <button onClick={() => send({ type: "tag/set", ref: target, tag: f("key", "tag"), on: true })}>
                tag on
              </button>
              <button onClick={() => send({ type: "tag/set", ref: target, tag: f("key", "tag"), on: false })}>
                tag off
              </button>
              <button
                onClick={() =>
                  send({
                    type: "entity/set",
                    ref: target,
                    set: { [f("key", "off")]: parse(f("value", "true")) },
                  })
                }
              >
                entity/set
              </button>
            </div>
            <div className="row">
              <strong>Modifier</strong>
              <select value={f("op", "add")} onChange={set("op")} aria-label="Op">
                {["add", "set", "min", "max"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <input size={6} placeholder="until pointer field" value={f("until")} onChange={set("until")} />
              <button
                onClick={() =>
                  send({
                    type: "mod/add",
                    mod: {
                      target,
                      q: f("key", "hp"),
                      op: f("op", "add") as Mod["op"],
                      value: Number(f("value", "1")),
                      source: "debug page",
                      ...(f("until")
                        ? { until: { field: f("until"), is: (game.pointer[f("until")] ?? null) as Json } }
                        : {}),
                    },
                  })
                }
              >
                mod/add (key and value above)
              </button>
            </div>
            <div className="row">
              <strong>Dice</strong>
              <input size={3} value={f("dn", "2")} onChange={set("dn")} aria-label="Dice" />
              <span>d</span>
              <input size={3} value={f("ds", "6")} onChange={set("ds")} aria-label="Sides" />
              <button
                onClick={() =>
                  send({
                    type: "dice/roll",
                    count: Number(f("dn", "2")),
                    sides: Number(f("ds", "6")),
                    label: "debug",
                  })
                }
              >
                dice/roll
              </button>
              <button onClick={() => send({ type: "log/note", text: `note ${short()}` })}>log/note</button>
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
          </Section>

          <Section title="Entities, modifiers and quantities" open>
            <table>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td>player</td>
                    <td>{p.id}</td>
                    <td className="muted">
                      {JSON.stringify({ name: p.name, seat: p.seat, q: p.q, tags: p.tags })}
                    </td>
                  </tr>
                ))}
                {Object.values(game.units).map((u) => (
                  <tr key={u.id}>
                    <td>unit</td>
                    <td>{u.id}</td>
                    <td className="muted">
                      {JSON.stringify({
                        name: u.name,
                        owner: u.owner,
                        models: u.modelIds.length,
                        q: u.q,
                        tags: u.tags,
                      })}
                    </td>
                  </tr>
                ))}
                {Object.values(game.models).map((m) => (
                  <tr key={m.id}>
                    <td>model</td>
                    <td>{m.id}</td>
                    <td className="muted">
                      {JSON.stringify({
                        at: [m.position.x, m.position.y],
                        facing: m.facing,
                        off: m.off,
                        unit: m.unitId,
                        q: m.q,
                        tags: m.tags,
                      })}
                    </td>
                  </tr>
                ))}
                {Object.values(game.tokens).map((t) => (
                  <tr key={t.id}>
                    <td>token</td>
                    <td>{t.id}</td>
                    <td className="muted">{JSON.stringify(t)}</td>
                  </tr>
                ))}
                {game.mods.map((m) => (
                  <tr key={m.id}>
                    <td>mod</td>
                    <td>{m.id}</td>
                    <td className="muted">
                      {JSON.stringify(m)}{" "}
                      <button onClick={() => send({ type: "mod/remove", id: m.id })}>remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Rules packages this game names">
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
          </Section>

          <Section title="Hidden values (kept on this device, only the commitment is on the table)">
            <div className="row">
              <input value={f("skey", "hand:1")} onChange={set("skey")} aria-label="Secret key" />
              <input value={f("sval", "a secret")} onChange={set("sval")} aria-label="Secret value" />
              <button
                onClick={() => {
                  const mine = as || session.selfId;
                  send({
                    type: "secret/commit",
                    player: mine,
                    secrets: [{ key: f("skey", "hand:1"), commitment: keepSecret(f("sval", "a secret")) }],
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
          </Section>

          <Section title={`Event log (newest first, ${record.events.length} total)`} open>
            <table>
              <tbody>
                {events.map((e) => (
                  <tr key={e.seq}>
                    <td>{e.seq}</td>
                    <td className="muted">{e.by}</td>
                    <td className="muted">{e.host ?? ""}</td>
                    <td>{e.event.type}</td>
                    <td className="muted">{JSON.stringify(e.event).slice(0, 160)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="State and network">
            <pre>{JSON.stringify(game, null, 1)}</pre>
            <pre>{JSON.stringify(net, null, 1)}</pre>
          </Section>
        </>
      )}
    </main>
  );
}
