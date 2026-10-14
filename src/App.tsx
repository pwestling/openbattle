import { useEffect, useRef, useState } from "react";
import {
  branchRecord,
  type EntityKind,
  type EntityRef,
  type Intent,
  type Json,
  type Mod,
  type PackageRef,
} from "./core";
import { cardsIn, type CardFace, type CardFields, type CardVisibility } from "./core/cards";
import { MacroInput } from "./MacroInput";
import { SetupForms } from "./SetupForms";
import { PackageConsent, PackagePicker } from "./PackagePicker";
import { selectComposition } from "./packages/composition";
import { useLibrary, type StoredPackage } from "./packages/library";
import { requestPackage, transferPercent, usePackageSharing, useTransfers } from "./packages/share";
import { requestApp, usePackageSandbox, useSandbox } from "./sandbox/runtime";
import { keepSecret, localSecret, useLocalSecrets } from "./secrets/local";
import type { PackageDiagnostic } from "./sandbox/protocol";
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

function CardImage({ image, label }: { image: CardFace; label: string }) {
  const column = image.index % image.cols;
  const row = Math.floor(image.index / image.cols);
  return (
    <div
      className="card-image"
      role="img"
      aria-label={label}
      style={{
        backgroundImage: `url(${JSON.stringify(image.url)})`,
        backgroundSize: `${image.cols * 100}% ${image.rows * 100}%`,
        backgroundPosition: `${image.cols === 1 ? 0 : (column / (image.cols - 1)) * 100}% ${
          image.rows === 1 ? 0 : (row / (image.rows - 1)) * 100
        }%`,
      }}
    />
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
  const sandboxWarnings = useSandbox((s) => s.warnings);
  const sandboxDiagnostics = useSandbox((s) => s.diagnostics);
  const transfers = useTransfers((s) => s.byHash);
  useLocalSecrets((s) => s.kept);
  useEffect(() => void useLibrary.getState().load(), []);
  const [name, setName] = useState("Player");
  const [seat, setSeat] = useState("");
  const [startMode, setStartMode] = useState<Mode>("hotseat");
  const [startRole, setStartRole] = useState<"host" | "client" | "spectator">("host");
  const [room, setRoom] = useState(() => new URLSearchParams(location.search).get("room") ?? "room1");
  const [pkgHash, setPkgHash] = useState("");
  const [extensionHashes, setExtensionHashes] = useState<string[]>([]);
  const [selectedSystem, setSelectedSystem] = useState("");
  const [starting, setStarting] = useState(false);
  const cancelStart = useRef<() => void>(() => {});
  useEffect(() => () => cancelStart.current(), []);
  const [json, setJson] = useState('{ "type": "log/note", "text": "hello" }');
  const [as, setAs] = useState("");
  const [problem, setProblem] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [cardViewers, setCardViewers] = useState<string[]>([]);
  const [proposal, setProposal] = useState<{
    macro: string;
    args: NonNullable<Extract<Intent, { type: "macro/start" }>["args"]>;
    sender: string;
    label: string;
    reason: string;
    seq: number;
    session: NonNullable<typeof session>;
    system: typeof game.system;
    actor: string | null;
    selectedAs: string;
  } | null>(null);
  const f = (k: string, d = "") => form[k] ?? d;
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const systems = Object.values(library).filter((p) => p.manifest.kind === "system");
  const candidate = library[pkgHash];
  const pkg = candidate?.manifest.kind === "system" ? candidate : systems[0];
  const system = pkg?.manifest.systems.includes(selectedSystem)
    ? selectedSystem
    : (pkg?.manifest.systems[0] ?? "");
  let planned: StoredPackage[] = [];
  let compositionError = "";
  try {
    if (!pkg) throw new Error("Load a game package before hosting.");
    const extensions = extensionHashes.map((hash) => {
      const extension = library[hash];
      if (!extension) throw new Error(`Selected extension is no longer installed: ${hash}`);
      return extension;
    });
    planned = selectComposition(Object.values(library), [pkg, ...extensions], system);
  } catch (error) {
    compositionError = error instanceof Error ? error.message : String(error);
  }
  const untrusted = planned.filter((p) => !p.trusted);
  const warnings = [
    ...new Map(
      [...(sandboxWarnings ?? []), ...(app?.warnings ?? [])].map((warning) => [
        JSON.stringify([warning.hash, warning.system, warning.kind, warning.id, warning.on, warning.message]),
        warning,
      ]),
    ).values(),
  ];
  const diagnosticGroups = new Map<string, PackageDiagnostic[]>();
  for (const diagnostic of [...sandboxDiagnostics, ...(app?.diagnostics ?? [])]) {
    const key = JSON.stringify([diagnostic.hash, diagnostic.packageId]);
    const group = diagnosticGroups.get(key) ?? [];
    group.push(diagnostic);
    diagnosticGroups.set(key, group);
  }
  const players = Object.values(game.players);
  const active = players.find((p) => p.seat === game.pointer.seat);
  // Whose actions the module is asked about: the screen's player, or the chosen one in hotseat.
  const me = mode === "hotseat" ? as || active?.id || null : (session?.selfId ?? null);
  useEffect(() => requestApp(me), [me, record.events.length]);
  const currentProposal =
    proposal &&
    proposal.seq === game.seq &&
    proposal.session === session &&
    proposal.system === game.system &&
    proposal.actor === me &&
    proposal.selectedAs === as &&
    canStartAs(proposal.sender) &&
    !game.macro
      ? proposal
      : null;
  if (proposal && !currentProposal) setProposal(null);

  async function loadFile(file: File) {
    const lib = useLibrary.getState();
    await lib.load();
    const r = await lib.add(new Uint8Array(await file.arrayBuffer()), { own: true });
    if (!r.ok) return setProblem(String(r.error));
    lib.trust(r.pkg.hash, true);
    if (r.pkg.manifest.kind === "system") {
      setPkgHash(r.pkg.hash);
      setSelectedSystem("");
      setExtensionHashes([]);
    } else {
      chooseExtension(r.pkg, true);
    }
    setProblem("");
  }

  function chooseExtension(extension: StoredPackage, enabled: boolean) {
    setExtensionHashes((hashes) => [
      ...hashes.filter(
        (hash) => hash !== extension.hash && library[hash]?.manifest.id !== extension.manifest.id,
      ),
      ...(enabled ? [extension.hash] : []),
    ]);
  }

  function begin() {
    const selectedSeat = seat.trim() === "" ? undefined : Number(seat);
    if (
      startMode !== "hotseat" &&
      startRole !== "spectator" &&
      selectedSeat !== undefined &&
      (!Number.isSafeInteger(selectedSeat) || selectedSeat < 0)
    )
      return setProblem("Seat must be a nonnegative safe integer, or blank for unseated.");
    let refs: PackageRef[] = [];
    if (startRole === "host") {
      try {
        if (!pkg) throw new Error("Load a game package before hosting.");
        const currentLibrary = useLibrary.getState().packages;
        const roots = [pkg.hash, ...extensionHashes].map((hash) => {
          const root = currentLibrary[hash];
          if (!root) throw new Error(`Selected package is no longer installed: ${hash}`);
          return root;
        });
        const composition = selectComposition(Object.values(currentLibrary), roots, system);
        const refused = composition.filter((p) => !p.trusted);
        if (refused.length)
          throw new Error(
            `Consent is required for: ${refused.map((p) => `${p.manifest.name} (${p.hash})`).join(", ")}`,
          );
        refs = composition.map(refOf);
      } catch (error) {
        return setProblem(error instanceof Error ? error.message : String(error));
      }
    }
    setProblem("");
    cancelStart.current();
    setStarting(true);
    const previous = useStore.getState().session;
    let captured: typeof session = null;
    let timer: number | undefined;
    const unsubscribe = useStore.subscribe((state) => {
      if (captured) {
        if (state.session !== captured) cancelStart.current();
        return;
      }
      if (!state.session || state.session === previous) return;
      captured = state.session;
      setStarting(false);
      if (startRole !== "host") {
        unsubscribe();
        return;
      }
      const hostSession = captured;
      const capturedSystem = system;
      const capturedRefs = refs;
      timer = window.setTimeout(() => {
        unsubscribe();
        const current = useStore.getState();
        if (
          current.session !== hostSession ||
          current.role !== "host" ||
          current.game.system !== capturedSystem
        )
          return;
        try {
          current.dispatch({
            type: "game/packages",
            app: APP_BUILD,
            system: capturedSystem,
            packages: capturedRefs,
          });
        } catch (error) {
          setProblem(error instanceof Error ? error.message : String(error));
        }
      }, 300);
    });
    cancelStart.current = () => {
      unsubscribe();
      clearTimeout(timer);
      setStarting(false);
    };
    try {
      start({
        role: startRole,
        mode: startMode,
        roomId: startMode === "hotseat" ? undefined : room,
        name,
        ...(startMode !== "hotseat" && startRole !== "spectator" && selectedSeat !== undefined
          ? { seat: selectedSeat }
          : {}),
        ...(startRole === "host" ? { system } : {}),
      });
    } catch (error) {
      cancelStart.current();
      setProblem(error instanceof Error ? error.message : String(error));
    }
  }

  function send(intent: Intent, sender?: string) {
    setProblem("");
    try {
      dispatch(intent, sender ?? (as || undefined));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  }

  function canStartAs(sender?: string) {
    const current = useStore.getState();
    const from = sender ?? (as || me || current.session?.selfId);
    return !!(
      current.session &&
      current.role !== "spectator" &&
      (current.mode === "hotseat" || current.game.players[current.session.selfId]) &&
      from &&
      current.game.players[from] &&
      (current.mode === "hotseat" || current.role === "host" || from === current.session.selfId)
    );
  }

  function startAction(
    macro: string,
    args: NonNullable<Extract<Intent, { type: "macro/start" }>["args"]>,
    label: string,
    reason?: string,
    sender?: string,
  ) {
    if (!session || game.macro || proposal || !canStartAs(sender)) return;
    const current = useStore.getState();
    if (
      current.session !== session ||
      current.game.seq !== game.seq ||
      current.game.system !== game.system ||
      current.game.macro
    )
      return;
    const from = sender ?? (as || me || session.selfId);
    if (reason === undefined) {
      send({ type: "macro/start", macro, args }, from);
      return;
    }
    setProposal({
      macro,
      args: structuredClone(args),
      sender: from,
      label,
      reason,
      seq: game.seq,
      session,
      system: game.system,
      actor: me,
      selectedAs: as,
    });
  }

  function proceedAnyway() {
    const pending = currentProposal;
    setProposal(null);
    if (!pending) return;
    const current = useStore.getState();
    const currentActor =
      current.mode === "hotseat"
        ? as ||
          Object.values(current.game.players).find((p) => p.seat === current.game.pointer.seat)?.id ||
          null
        : (current.session?.selfId ?? null);
    if (
      pending.seq !== current.game.seq ||
      pending.session !== current.session ||
      pending.system !== current.game.system ||
      pending.actor !== currentActor ||
      pending.selectedAs !== as ||
      !canStartAs(pending.sender) ||
      current.game.macro
    )
      return;
    send(
      {
        type: "macro/start",
        macro: pending.macro,
        args: pending.args,
        force: true,
        warning: pending.reason,
      },
      pending.sender,
    );
  }

  function assignSeat(player: string) {
    const key = `player-seat:${player}`;
    const value = f(key, String(game.players[player]?.seat ?? "")).trim();
    const assignment = value === "" ? null : Number(value);
    if (assignment !== null && (!Number.isSafeInteger(assignment) || assignment < 0))
      return setProblem("Seat must be a nonnegative safe integer, or blank for unseated.");
    send({ type: "player/set", player, set: { seat: assignment } }, player);
    setForm((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
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
  const collections = Object.values(game.cardCollections);
  const selected = selectedCards.filter((id) => game.cards[id]);
  const cardDestination = f("card-collection", collections[0]?.id ?? "");
  const cardVisibility: CardVisibility =
    f("card-visibility", "hidden") === "public"
      ? "all"
      : f("card-visibility", "hidden") === "private"
        ? cardViewers
        : [];
  const cardFields = {
    owner: f("card-owner") || null,
    visibility: cardVisibility,
    faceUp: f("card-faceup", "false") === "true",
    ...(f("card-x") || f("card-y")
      ? { position: { x: Number(f("card-x") || "NaN"), y: Number(f("card-y") || "NaN") } }
      : {}),
    ...(f("card-facing") ? { facing: Number(f("card-facing")) } : {}),
  } satisfies CardFields;
  const cardIndex = f("card-index") ? { index: Number(f("card-index")) } : {};

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
            <input
              value={seat}
              onChange={(e) => setSeat(e.target.value)}
              aria-label="Seat"
              placeholder="Seat (blank = unseated)"
              inputMode="numeric"
              disabled={startMode === "hotseat" || startRole === "spectator"}
            />
            {startMode === "hotseat" && <span className="muted">Hotseat preset: p1 seat 0, p2 seat 1.</span>}
            <label>
              Load a package…{" "}
              <input
                type="file"
                accept=".js"
                onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])}
              />
            </label>
            <button
              disabled={starting || (startRole === "host" && (!!compositionError || !!untrusted.length))}
              onClick={begin}
            >
              {starting ? "Starting…" : "Start"}
            </button>
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
            <button
              onClick={() => {
                cancelStart.current();
                leave();
              }}
            >
              Leave
            </button>
          </div>
        )}
        {!session && startRole === "host" && (
          <PackagePicker
            library={library}
            pkg={pkg}
            system={system}
            extensionHashes={extensionHashes}
            planned={planned}
            error={
              compositionError ||
              (untrusted.length
                ? `Consent required for ${untrusted.map((p) => p.manifest.name).join(", ")}.`
                : "")
            }
            onGame={(hash) => {
              setPkgHash(hash);
              setSelectedSystem("");
              setExtensionHashes([]);
            }}
            onSystem={(id) => {
              setSelectedSystem(id);
              setExtensionHashes([]);
            }}
            onExtension={chooseExtension}
          />
        )}
        {problem && <p className="bad">{problem}</p>}
        {sandboxError && <p className="bad">{sandboxError}</p>}
        {!!diagnosticGroups.size && (
          <div className="package-diagnostics" role="status" data-testid="package-diagnostics">
            <h2>Package errors</h2>
            {[...diagnosticGroups.entries()].map(([key, diagnostics]) => (
              <div key={key} className="package-diagnostic-group">
                <h3>{diagnostics[0]!.packageId ?? "Unknown package"}</h3>
                <p className="muted">
                  SHA-256 <code>{diagnostics[0]!.hash}</code>
                </p>
                <ul>
                  {diagnostics.map((diagnostic, index) => (
                    <li key={index}>
                      <strong>
                        {diagnostic.phase} · {diagnostic.callback}
                      </strong>
                      {diagnostic.system && (
                        <>
                          {" "}
                          · system <code>{diagnostic.system}</code>
                        </>
                      )}
                      {diagnostic.symbol && (
                        <>
                          {" "}
                          · symbol <code>{diagnostic.symbol}</code>
                        </>
                      )}
                      {diagnostic.actor && (
                        <>
                          {" "}
                          · actor <code>{diagnostic.actor}</code>
                        </>
                      )}
                      <p className="bad">{diagnostic.message}</p>
                      {diagnostic.source && (
                        <p className="muted">
                          Bundle <code>{diagnostic.source.url}</code> · line {diagnostic.source.line}, column{" "}
                          {diagnostic.source.column}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {!!warnings.length && (
          <div className="package-warnings" role="status">
            <h2>Package namespace warnings</h2>
            <ul>
              {warnings.map((warning) => (
                <li
                  key={JSON.stringify([
                    warning.hash,
                    warning.system,
                    warning.kind,
                    warning.id,
                    warning.on,
                    warning.message,
                  ])}
                >
                  {warning.message} · <code>{warning.packageId}</code> · {warning.system} · {warning.kind}{" "}
                  {warning.on ? `${warning.on}/` : ""}
                  {warning.id}
                  <br />
                  SHA-256 <code>{warning.hash}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
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
              Players:{" "}
              {players
                .map((p) => `${p.name} (${p.seat === undefined ? "unseated" : `seat ${p.seat}`})`)
                .join(", ") || "none"}{" "}
              · units {Object.keys(game.units).length} · models {Object.keys(game.models).length} · tokens{" "}
              {Object.keys(game.tokens).length} · terrain {game.terrain.length} · mods {game.mods.length} ·
              cards {Object.keys(game.cards).length} · collections {collections.length}
            </p>
            <div className="row">
              {mode === "hotseat" && (
                <select value={as} onChange={(e) => setAs(e.target.value)} aria-label="Send as">
                  <option value="">as the active player</option>
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

          <Section title="Seating" open>
            <p className="muted">
              Seats are recorded identifiers, not alliances. Blank clears an assignment. Hosts may set any
              participant's seat; other participants may set only their own.
            </p>
            {players.length === 0 && <p className="muted">No participants.</p>}
            {players.map((player) => {
              const canEdit = role === "host" || (role === "client" && player.id === session.selfId);
              return (
                <div className="row" key={player.id}>
                  <span>
                    {player.name} ({player.id}) ·{" "}
                    {player.seat === undefined ? "unseated" : `seat ${player.seat}`}
                  </span>
                  <input
                    aria-label={`Seat for ${player.id}`}
                    inputMode="numeric"
                    placeholder="unseated"
                    value={f(`player-seat:${player.id}`, String(player.seat ?? ""))}
                    onChange={set(`player-seat:${player.id}`)}
                    disabled={!canEdit}
                  />
                  <button onClick={() => assignSeat(player.id)} disabled={!canEdit}>
                    Set seat
                  </button>
                </div>
              );
            })}
          </Section>

          {waiting && game.macro && (
            <section>
              <h2>
                A macro is waiting: {game.macro.macro} (run {game.macro.startSeq}, answers from{" "}
                {waiting.player})
              </h2>
              <p>{me === waiting.player ? waiting.question : "Waiting for the answering player."}</p>
              <div className="row">
                {me !== waiting.player ? (
                  <span className="muted">The answering player's choices are hidden from this view.</span>
                ) : "input" in waiting ? (
                  <MacroInput
                    key={`${game.macro.startSeq}:${game.macro.results.length}:${game.macro.waitingCommand ?? ""}`}
                    input={waiting.input}
                    onAnswer={(answer) => send({ type: "macro/answer", answer }, waiting.player)}
                  />
                ) : waiting.reveal !== undefined ? (
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

          <SetupForms
            forms={app?.player === me ? app.setup : []}
            error={app?.player === me ? app.setupError : undefined}
            actor={me}
            session={session}
            system={game.system}
            events={record.events}
            disabled={
              !!game.macro ||
              !!currentProposal ||
              !me ||
              !canStartAs(me ?? undefined) ||
              app?.player !== me ||
              app.seq !== game.seq
            }
            onSubmit={(spec, data) => {
              if (!me || app?.player !== me || app.seq !== game.seq) return;
              startAction(spec.macro, { ...spec.args, form: spec.id, data }, spec.title, spec.warning, me);
            }}
          />

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
                    disabled={!!game.macro || !!currentProposal || !canStartAs(b.player)}
                    title={b.warning}
                    onClick={() => startAction(b.macro, b.args ?? {}, b.label, b.warning, b.player)}
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
                      {a.error !== undefined ? (
                        <span className="bad" data-testid="action-error">
                          Package error: {a.error}
                        </span>
                      ) : (
                        <>
                          {typeof a.available === "string" && (
                            <p className="advisory-warning" data-testid="action-warning">
                              {a.available}
                            </p>
                          )}
                          {a.targeted ? (
                            a.targets.map((t) => (
                              <button
                                key={t.unitId}
                                disabled={!!game.macro || !!currentProposal || !canStartAs()}
                                onClick={() =>
                                  startAction(
                                    a.id,
                                    {
                                      ...(a.unitId ? { unit: a.unitId } : {}),
                                      ...(t.unitId ? { target: t.unitId } : {}),
                                    },
                                    `${a.name}${a.unitId ? ` · unit ${a.unitId}` : ""} · target ${t.label}${t.unitId ? ` (${t.unitId})` : ""}`,
                                    typeof a.available === "string" ? a.available : undefined,
                                  )
                                }
                              >
                                {t.label}
                              </button>
                            ))
                          ) : (
                            <button
                              disabled={!!game.macro || !!currentProposal || !canStartAs()}
                              onClick={() =>
                                startAction(
                                  a.id,
                                  a.unitId ? { unit: a.unitId } : {},
                                  `${a.name}${a.unitId ? ` · unit ${a.unitId}` : ""}`,
                                  typeof a.available === "string" ? a.available : undefined,
                                )
                              }
                            >
                              Start
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentProposal && (
              <div
                className="advisory-confirmation"
                role="dialog"
                aria-labelledby="advisory-title"
                aria-describedby="advisory-reason"
                data-testid="advisory-confirmation"
              >
                <h2 id="advisory-title">Rule warning</h2>
                <p data-testid="advisory-selection">{currentProposal.label}</p>
                <p className="muted">
                  Player: {currentProposal.sender} · macro: {currentProposal.macro}
                </p>
                <pre data-testid="advisory-args">{JSON.stringify(currentProposal.args, null, 2)}</pre>
                <p id="advisory-reason" className="advisory-warning">
                  {currentProposal.reason}
                </p>
                <div className="row">
                  <button onClick={proceedAnyway}>Proceed anyway</button>
                  <button onClick={() => setProposal(null)}>Cancel</button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Cards" open>
            <p className="muted">
              Trusted-tabletop visibility: this view hides unauthorized names and faces, but all card
              identities and order are in the replicated record. The raw debug inspectors below expose them.
              This is not cryptographic confidentiality or shuffle fairness.
            </p>
            <p>
              Viewing as {players.find((p) => p.id === me)?.name ?? "nobody"} · top is index 0. Selection
              order is batch move order; moves do not change card fields.
            </p>
            {!collections.length && <p className="muted">No card collections.</p>}
            {collections.map((collection) => (
              <div className="card-collection" key={collection.id}>
                <div className="row">
                  <strong>{collection.name}</strong>
                  <span className="muted">
                    {collection.id} · {collection.cards.length} cards
                  </span>
                  <button onClick={() => send({ type: "collection/shuffle", collection: collection.id })}>
                    Shuffle
                  </button>
                  <button
                    disabled={collection.cards.length !== 0}
                    onClick={() => send({ type: "collection/remove", id: collection.id })}
                  >
                    Remove empty collection
                  </button>
                </div>
                <div className="card-list">
                  {cardsIn(game, collection.id, me).map((card, index) => {
                    const image = card.visible ? card.face : card.back;
                    return (
                      <label className="debug-card" key={card.id}>
                        <span>
                          <input
                            type="checkbox"
                            checked={selected.includes(card.id)}
                            onChange={(e) =>
                              setSelectedCards(
                                e.target.checked
                                  ? [...selected, card.id]
                                  : selected.filter((id) => id !== card.id),
                              )
                            }
                          />{" "}
                          {index} · {card.visible ? card.name : "Hidden card"}
                        </span>
                        {image && (
                          <CardImage
                            image={image}
                            label={card.visible ? (card.name ?? "Card face") : "Card back"}
                          />
                        )}
                        <small className="muted">
                          {card.id} · {card.faceUp ? "face up" : "face down"} · owner{" "}
                          {card.owner
                            ? (players.find((p) => p.id === card.owner)?.name ?? card.owner)
                            : "none"}
                          {" · "}position {card.position ? `${card.position.x}, ${card.position.y}` : "unset"}
                          {" · "}facing {card.facing ?? "unset"}
                        </small>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="card-controls">
              <div className="row">
                <strong>Collection</strong>
                <input
                  value={f("collection-id")}
                  onChange={set("collection-id")}
                  placeholder="ID (auto if blank)"
                  aria-label="New collection ID"
                />
                <input
                  value={f("collection-name", "Collection")}
                  onChange={set("collection-name")}
                  aria-label="New collection name"
                />
                <button
                  onClick={() =>
                    send({
                      type: "collection/add",
                      collection: {
                        id: f("collection-id") || `collection-${short()}`,
                        name: f("collection-name", "Collection"),
                        cards: [],
                      },
                    })
                  }
                >
                  Create collection
                </button>
              </div>
              <div className="row">
                <strong>Destination</strong>
                <select
                  value={cardDestination}
                  onChange={set("card-collection")}
                  aria-label="Card destination"
                >
                  {!collections.length && <option value="">(no collection)</option>}
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
                <input
                  size={6}
                  value={f("card-index")}
                  onChange={set("card-index")}
                  placeholder="end"
                  aria-label="Card insertion index (after removals)"
                />
                <button
                  disabled={!selected.length || !cardDestination}
                  onClick={() =>
                    send({
                      type: "cards/move",
                      cards: selected,
                      to: cardDestination,
                      ...cardIndex,
                    })
                  }
                >
                  Move selected ({selected.length})
                </button>
                <button
                  disabled={!selected.length}
                  onClick={() => send({ type: "cards/remove", cards: selected })}
                >
                  Remove selected
                </button>
                <button disabled={!selected.length} onClick={() => setSelectedCards([])}>
                  Clear selection
                </button>
              </div>
              <div className="row">
                <strong>Card fields</strong>
                <select
                  value={f("card-visibility", "hidden")}
                  onChange={set("card-visibility")}
                  aria-label="Card visibility"
                >
                  <option value="hidden">Hidden (no viewers)</option>
                  <option value="public">Public (everyone)</option>
                  <option value="private">Private (chosen viewers)</option>
                </select>
                {f("card-visibility", "hidden") === "private" &&
                  players.map((p) => (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        checked={cardViewers.includes(p.id)}
                        onChange={(e) =>
                          setCardViewers(
                            e.target.checked
                              ? [...cardViewers, p.id]
                              : cardViewers.filter((id) => id !== p.id),
                          )
                        }
                      />{" "}
                      {p.name}
                    </label>
                  ))}
                <select value={f("card-owner")} onChange={set("card-owner")} aria-label="Card owner">
                  <option value="">No owner</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={f("card-faceup", "false")}
                  onChange={set("card-faceup")}
                  aria-label="Card orientation"
                >
                  <option value="false">Face down</option>
                  <option value="true">Face up</option>
                </select>
                <input
                  size={4}
                  value={f("card-x")}
                  onChange={set("card-x")}
                  placeholder="x"
                  aria-label="Card x (supply both coordinates)"
                />
                <input
                  size={4}
                  value={f("card-y")}
                  onChange={set("card-y")}
                  placeholder="y"
                  aria-label="Card y (supply both coordinates)"
                />
                <input
                  size={7}
                  value={f("card-facing")}
                  onChange={set("card-facing")}
                  placeholder="facing"
                  aria-label="Card facing (blank leaves unchanged)"
                />
                <button
                  disabled={!selected.length}
                  onClick={() => {
                    for (const card of selected) send({ type: "card/set", card, set: cardFields });
                  }}
                >
                  Update selected
                </button>
              </div>
              <p className="muted">
                Owner and face-up state do not grant visibility. Fields above apply to additions and updates;
                supply both position coordinates, or leave both blank to keep position.
              </p>
              <div className="row">
                <strong>Add card</strong>
                <input
                  value={f("card-id")}
                  onChange={set("card-id")}
                  placeholder="ID (auto if blank)"
                  aria-label="New card ID"
                />
                <input
                  value={f("card-name", "New card")}
                  onChange={set("card-name")}
                  aria-label="New card name"
                />
                <button
                  disabled={!cardDestination}
                  onClick={() =>
                    send({
                      type: "card/add",
                      collection: cardDestination,
                      ...cardIndex,
                      card: {
                        id: f("card-id") || `card-${short()}`,
                        name: f("card-name", "New card"),
                        ...cardFields,
                      },
                    })
                  }
                >
                  Add card
                </button>
              </div>
            </div>
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
                    <button onClick={() => requestPackage(p.hash, { trust: false })}>
                      Ask the room for it
                    </button>
                  )}
                  {have && <PackageConsent pkg={library[p.hash]!} />}
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

          <Section
            title={`Raw debug event log (newest first, ${record.events.length} total; exposes hidden cards)`}
            open
          >
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

          <Section title="Raw debug state and network (exposes hidden cards)">
            <pre>{JSON.stringify(game, null, 1)}</pre>
            <pre>{JSON.stringify(net, null, 1)}</pre>
          </Section>
        </>
      )}
    </main>
  );
}
