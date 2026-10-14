import { useEffect } from "react";
import { create } from "zustand";
import type { GameRecord } from "../core";
import { registerHooks, unregisterHooks } from "../core/macro";
import { setIntentRouter } from "../net/session";
import { useLibrary } from "../packages/library";
import { useStore } from "../store";
import { extendModuleInfo, moduleInfo, registerModuleInfo, unregisterModuleInfo } from "../systems";
import { Sandbox, STARTUP_MS } from "./host";
import type { AppState, Loaded, PackageDiagnostic, PackageWarning } from "./protocol";

/**
 * The game's trusted rules packages running in the sandbox: started when the
 * game names packages this player trusts, fed every logged event, asked what
 * the module offers (its actions and panel), and handed the host's macro
 * intents (setIntentRouter). Everything else the host resolves itself.
 */
interface SandboxState {
  status: "off" | "starting" | "on" | "stopped";
  /** Why it stopped, for the players. */
  error: string | null;
  /** Macro and action ids, by game id. */
  code: Record<string, string[]>;
  /** What the module offers `player` in the game as of `app.seq`. */
  app: AppState | null;
  warnings: PackageWarning[];
  diagnostics: PackageDiagnostic[];
}

export const useSandbox = create<SandboxState>(() => ({
  status: "off",
  error: null,
  code: {},
  app: null,
  warnings: [],
  diagnostics: [],
}));

/** Whose actions to ask the module for: the player on this screen, or whoever the page names. */
let appPlayer: string | null = null;
let askedFor = "";

/** Ask the sandbox for what `player` can do, once per new event (or per change of player). */
export function requestApp(player: string | null = appPlayer): void {
  appPlayer = player;
  const seq = useStore.getState().record.events.at(-1)?.seq ?? 0;
  if (!sandbox || !player || askedFor === `${seq}:${player}`) return;
  const requested = `${seq}:${player}`;
  askedFor = requested;
  const box = sandbox;
  box
    .call<AppState>({ t: "appState", player })
    .then((app) => {
      if (sandbox === box && askedFor === requested)
        useSandbox.setState({ app, warnings: app.warnings, error: null });
    })
    .catch((error: unknown) => {
      if (sandbox !== box || askedFor !== requested) return;
      askedFor = "";
      useSandbox.setState({
        error: `Package presentation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    });
}

let sandbox: Sandbox | null = null;
/** The record the worker holds, and how far it has been sent. */
let sent: { record: GameRecord; seq: number } | null = null;

/** Send the worker whatever it hasn't seen of the record, or the whole record if history changed. */
function sync(): void {
  if (!sandbox) return;
  const record = useStore.getState().record;
  if (sent?.record === record) return;
  const prev = sent;
  const last = record.events.at(-1)?.seq ?? 0;
  const at = prev ? record.events.findIndex((e) => e.seq > prev.seq) : -1;
  const continues =
    prev &&
    record.initial === prev.record.initial &&
    record.events.length >= prev.record.events.length &&
    record.events[prev.record.events.length - 1] === prev.record.events.at(-1);
  if (continues) {
    const events = at < 0 ? [] : record.events.slice(at);
    if (events.length) void sandbox.call({ t: "events", events }, STARTUP_MS).catch(() => {});
  } else void sandbox.call({ t: "init", record }, STARTUP_MS).catch(() => {});
  sent = { record, seq: last };
  requestApp();
}

/** The games the packages registered on the app's side, and the hook owners to take off again. */
const provided: string[] = [];
const hookOwners: string[] = [];

/** Take the packages' data and hooks back off the app. */
function unload() {
  askedFor = "";
  useSandbox.setState({ app: null, warnings: [], diagnostics: [] });
  for (const id of provided.splice(0)) unregisterModuleInfo(id);
  for (const owner of hookOwners.splice(0)) unregisterHooks(owner);
}

/** The packages the game wants running, and whether they've been started again after stopping. */
let wantedNow: { hash: string; source: string }[] | null = null;
let retried = false;

function stop(why: string) {
  // Hook descriptors survive a worker restart: new triggers still record their obligations.
  askedFor = "";
  useSandbox.setState({ app: null });
  sandbox = null;
  sent = null;
  setIntentRouter(null);
  // Trusted packages get a second start before their rules are off: a busy page can starve the first.
  if (wantedNow && !retried) {
    retried = true;
    console.warn(`Rules sandbox stopped (${why}); starting it again`);
    void start(wantedNow);
    return;
  }
  useSandbox.setState({ status: "stopped", error: why, code: {} });
}

/** Bumped when a start is cancelled (the packages changed), so a start still loading stops itself. */
let generation = 0;

async function start(packages: { hash: string; source: string }[]): Promise<void> {
  const gen = ++generation;
  useSandbox.setState({
    status: "starting",
    error: null,
    code: {},
    app: null,
    warnings: [],
    diagnostics: [],
  });
  try {
    const source = (await import("virtual:sandbox-worker")).default;
    if (gen !== generation) return;
    const box = await Sandbox.start(source, stop);
    const loaded = await box.call<Loaded>({ t: "load", packages }, STARTUP_MS).finally(() => {
      // Cancelled while starting: nothing else holds this one, so end its iframe and worker here.
      if (gen !== generation) box.stop();
    });
    if (gen !== generation) return;
    useSandbox.setState({ diagnostics: loaded.diagnostics });
    if (loaded.errors.length) {
      box.stop();
      throw new Error(`A rules package didn't load: ${loaded.errors[0]!.error}`);
    }
    sandbox = box;
    sent = null;
    const code: Record<string, string[]> = {};
    for (const p of loaded.packages) {
      if (p.info) {
        registerModuleInfo(p.info);
        provided.push(p.info.id);
        offerLayout(p.info.id);
      }
      for (const s of p.systems) {
        code[s] = [
          ...new Set([...(code[s] ?? []).filter((id) => !p.removedActions?.includes(id)), ...p.macros]),
        ];
        if (p.adds) extendModuleInfo(s, p.adds, p.removedActions);
        registerHooks(s, p.hash, p.hooks);
      }
      hookOwners.push(p.hash);
    }
    sync();
    useSandbox.setState({
      status: "on",
      code,
      error: null,
      warnings: loaded.warnings,
      diagnostics: loaded.diagnostics,
    });
    // Macro intents (a code action, a hook) are resolved where the code is. The rest the host does itself.
    setIntentRouter((intent, from, state) => {
      if (intent.type !== "macro/start" && intent.type !== "macro/answer") return null;
      if (!code[state.system ?? ""] || !sandbox) return null;
      const box = sandbox;
      return (seed) => {
        sync();
        return box.call({ t: "resolve", intent, from, seed });
      };
    });
  } catch (e) {
    if (gen === generation) stop(e instanceof Error ? e.message : String(e));
  }
}

/**
 * A game just set up before its module was known gets the module's table and
 * layout once it is: the host puts them on a fresh table.
 */
function offerLayout(id: string): void {
  const { role, game, dispatch } = useStore.getState();
  const fresh =
    game.pointer.round === 0 &&
    !game.terrain.length &&
    !game.zones.length &&
    !Object.keys(game.tokens).length;
  const info = moduleInfo(id);
  if (role === "host" && game.system === id && fresh && info)
    dispatch({ type: "layout/set", layout: { ...info.layout, table: info.table } });
}

/** Keep the sandbox running the game's trusted packages. Mount once. */
export function usePackageSandbox(): void {
  const wanted = useStore((s) => s.game.packages?.packages);
  const library = useLibrary((s) => s.packages);
  const run = (wanted ?? []).filter((p) => library[p.hash]?.trusted);
  const key = run.map((p) => p.hash).join();
  useEffect(() => {
    if (!key) return;
    const lib = useLibrary.getState().packages;
    wantedNow = key.split(",").map((hash) => ({ hash, source: lib[hash]!.source }));
    retried = false;
    void start(wantedNow);
    return () => {
      wantedNow = null;
      generation++;
      sandbox?.stop();
      unload();
      sandbox = null;
      sent = null;
      setIntentRouter(null);
      useSandbox.setState({ status: "off", error: null, code: {}, warnings: [], diagnostics: [] });
    };
  }, [key]);
  // Every change to the record reaches the worker's replica.
  useEffect(() => useStore.subscribe((s, p) => s.record !== p.record && sync()), []);
}
