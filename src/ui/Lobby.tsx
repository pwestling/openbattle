import { openPlayerCard } from "../player/open";
import { enterRoom } from "./route";
import { useCard } from "../player/card";
import { systemOf } from "../core/content/turn";
import { isPlaceholder } from "../core/content/systems";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DEFAULT_SYSTEM } from "../core";
import { listSystems } from "../core/content";
import { NET_PARAMS } from "../net/config";
import { boardOn, useOpenTables } from "../opentables/board";
import { BROADCAST } from "../broadcast/broadcast";
import { EXHIBITION, startExhibition } from "../broadcast/exhibition";
import { useLibrary } from "../packages/library";
import { APP_BUILD } from "../version";
import { ArmyGuide } from "./ArmyGuide";
import { NetCheck } from "./NetCheck";
import { presetMission, startDemo } from "./demo";
import { reloadedInto } from "./resumeHotseat";
import { usePlayRoute, useRouteFlag } from "./route";
import {
  BRINEWATCH,
  installOwnGame,
  installRiftLanterns,
  ownGame,
  playOwnAtTable,
  playOwnGame,
  playRiftAtTable,
  playRiftLanterns,
  RIFT_LANTERNS,
} from "../games/riftLanterns";
import type { RulebookDoc } from "../printplay/rulebook";
import { YourArmy } from "../bot/YourArmy";
import { armSolo, characterName, levelName, savedLevel } from "../bot/solo";
import type { Level } from "../bot/player";
import { TextSizePicker } from "./TextSizePicker";
import { LanguagePicker } from "../i18n/LanguagePicker";
import { WhatsNew } from "./WhatsNew";
import { formatDate, t, tn, gameText } from "../i18n";
import { BUILT_IN_LESSONS, lessonPackages, lessonSystem } from "../teach/builtin";
import { openLibrary, openTts } from "../figures/open";
import { openWorkshop } from "../workshop/open";
import { InstallLink, OfflineForFriends, OfflineNote, UpdateToast } from "../sw/UpdateToast";
import { PackageLibrary, refOf } from "./Packages";
import { FRONT, gameTitle, systemLabel } from "./systemLabels";
import { stateAt } from "../core/log";
import { OpenLink } from "../share/OpenLink";
import { OpenFile } from "../share/OpenFile";
import { PopMenu } from "./PopMenu";
import { loadRoom, loadSavedGame, useStore, type Mode } from "../store";

/** Play by mail loads after the front door; it sits below the fold. */
const MailLobby = lazy(() => import("../mail/MailLobby").then((m) => ({ default: m.MailLobby })));
/** Rift Lanterns' rules page (#47), with its print and play, on demand. */
const RulesPage = lazy(() => import("../printplay/RulesPage"));
/** Brinewatch's rules page (#69): the same page with its own rulebook. */
const BrinewatchRules = lazy(() =>
  Promise.all([import("../printplay/RulesPage"), import("../../games/brinewatch/rulebook.json")]).then(
    ([page, book]) => ({
      default: (props: Omit<Parameters<typeof page.default>[0], "doc">) => (
        <page.default {...props} doc={book.default as RulebookDoc} />
      ),
    }),
  ),
);
/** Open tables (#50): the public board of games, read only when opened. */
const OpenTablesBoard = lazy(() =>
  import("../opentables/OpenTables").then((m) => ({ default: m.OpenTablesBoard })),
);
/** Live now on the front door (PX): read once the lobby has settled. */
const LiveStrip = lazy(() => import("../opentables/OpenTables").then((m) => ({ default: m.LiveStrip })));
/** The sample game that stays in sight beside our own two; the rest fold under More games (UX 504). */
const FIRST = new Set(["forty-k-11"]);

/** Who against, on the front door (UX 513). */
type Who = "friend" | "computer" | "both" | "table";
const WHOS: Who[] = ["friend", "computer", "both", "table"];
const WHO_KEY = "open-battle:who";

/** Arrow keys move within a column's choices, as in a radio group. */
function arrows(e: React.KeyboardEvent<HTMLElement>) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!step) return;
  const all = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')];
  const at = all.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  all[(at + step + all.length) % all.length]?.focus();
}

/** Focus a column's chosen answer, else last time's, else its first choice or field, once it has opened. */
function focusInto(id: string) {
  requestAnimationFrame(() => {
    for (const want of [
      '[aria-checked="true"]',
      "[data-last]",
      '[role="radio"]',
      "input",
      "button.primary",
    ]) {
      const el = document.querySelector<HTMLElement>(`#${id} ${want}`);
      if (el) return el.focus();
    }
  });
}

/** Run `then` once the game's session exists: at once, or when an online start has loaded WebRTC. */
function whenStarted(then: () => void): void {
  if (useStore.getState().session) return then();
  const off = useStore.subscribe((s) => {
    if (!s.session) return;
    off();
    then();
  });
}

/** Rejoin once per page load (effects run twice in development). */
let autoJoined = false;

export function Lobby() {
  const { start } = useStore();
  const params = new URLSearchParams(location.search);
  const [name, setName] = useState(
    () => localStorage.getItem("open-battle:name") || useCard.getState().name.trim(),
  );
  // A name given on the player card fills this in at once, unless the player typed another (UX 449).
  const cardName = useCard((c) => c.name.trim());
  const [lastCard, setLastCard] = useState(cardName);
  if (cardName !== lastCard) {
    setLastCard(cardName);
    if (!name.trim() || name.trim() === lastCard) setName(cardName);
  }
  const [room, setRoom] = useState(() => params.get("room") ?? "");
  const [sameBrowser, setSameBrowser] = useState(params.get("local") === "1");
  // Players per side when hosting: 1 (1v1) or 2 (a 2v2 team game, core/teams.ts).
  const [teamSize, setTeamSize] = useState(1);
  const [guide, setGuide] = useState(false);
  // Screens with an address (src/ui/route.ts): #/rules/<game>, #/tables, #/play/<game>.
  const [rules, setRules] = useRouteFlag(`/rules/${RIFT_LANTERNS}`);
  const [brineRules, setBrineRules] = useRouteFlag(`/rules/${BRINEWATCH}`);
  const [tables, setTables] = useRouteFlag("/tables");
  useState(() => {
    // Back from a table whose host had gone, or a game that ended under a watcher: the board says so.
    if (params.get("tables") === "gone") useOpenTables.setState({ gone: "table" });
    if (params.get("tables") === "ended")
      useOpenTables.setState({ gone: "game", ended: params.get("ended") ?? null });
  });
  // Play the computer (#45): the game whose card asks "How hard?" (UX 350).
  // The front door's Live now strip waits for the page to settle, and only where Open tables is on.
  const [liveStrip, setLiveStrip] = useState(false);
  useEffect(() => {
    if (!boardOn() || EXHIBITION) return;
    const timer = setTimeout(() => setLiveStrip(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  // The front door is a flow (UX 513, Porter): the game, then who against, then getting ready, each column
  // opening once the one before is answered. Its address is `#/play/<game>/<who>` (src/ui/route.ts), so Back
  // closes the last column. The weekly group's last choices come back already picked; `?play=<game>`, a
  // watcher's "Play this yourself" (PX), lands on that game against the computer.
  const flow = usePlayRoute();
  const opened = flow.game !== null;
  const who = WHOS.includes(flow.who as Who) ? (flow.who as Who) : null;
  const [level, setLevel] = useState<Level | null>(() => savedLevel());
  const [phones, setPhones] = useState<"one" | "each">("one");
  // Esc closes the last column opened ("‹" for the keyboard, UX 513).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".modal-backdrop, .modal")) return;
      if (level && who === "computer") setLevel(null);
      else if (who) flow.go(flow.game, null);
      else if (opened) flow.go(null);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [who, opened, level, flow]);
  // Built-in games, then whole games from trusted rules packages (their code runs in the sandbox).
  const library = useLibrary((s) => s.packages);
  useEffect(() => {
    void useLibrary.getState().load();
    // Our own game goes in the library after the front door is up, so it's in the game list (#42).
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 500));
    idle(() => {
      void installRiftLanterns();
      void installOwnGame(BRINEWATCH);
    });
  }, []);
  const fromPackages = Object.values(library).filter(
    (p) => p.trusted && p.manifest.kind === "system" && p.manifest.systems[0],
  );
  const systems = [
    ...listSystems().map((s) => ({ id: s.id, name: s.name })),
    ...fromPackages
      .filter((p) => !listSystems().some((s) => s.id === p.manifest.systems[0]))
      .map((p) => ({
        id: p.manifest.systems[0]!,
        name: t("{name} {version}", { name: p.manifest.name, version: p.manifest.version }),
      })),
  ];
  // The game picked on the front door (UX 513): a watcher's ?play=, else the last one played, else the sci-fi battle.
  const [stored, setSystem] = useState(() => {
    const want = params.get("play") || localStorage.getItem("open-battle:system");
    return want && (systems.some((s) => s.id === want) || ownGame(want)) ? want : DEFAULT_SYSTEM;
  });
  // Back, Forward or a link at #/play/<game>: that game is the one picked.
  const system =
    flow.game && (systems.some((s) => s.id === flow.game) || ownGame(flow.game)) ? flow.game : stored;
  // Last time's choices, for the weekly group: Enter, Enter, Enter (UX 513). A watcher's ?play= is the computer.
  const [lastWho] = useState<Who | null>(() => {
    if (params.get("play")) return "computer";
    const last = localStorage.getItem(WHO_KEY) as Who | null;
    return last && WHOS.includes(last) ? last : null;
  });
  const [saved] = useState(loadSavedGame);
  // "Resume: Sci-fi battle, round 2" first in the lobby, not under everything else (UX 395).
  const savedAt = useMemo(() => {
    if (!saved) return null;
    try {
      const s = stateAt(saved.record);
      // A package game's rounds fold only with its package loaded: say no round rather than a wrong one.
      return {
        event: s.settings.event ?? null,
        game: gameTitle(s),
        round: s.system && isPlaceholder(s.system) ? null : s.turn.round,
        over:
          s.system && isPlaceholder(s.system)
            ? false
            : s.turn.round > (Number(systemOf(s).turn.rounds) || Infinity),
      };
    } catch {
      return null;
    }
  }, [saved]);
  const mode: Mode = sameBrowser ? "local" : "online";

  const remember = (as = name) => {
    localStorage.setItem("open-battle:name", as);
    localStorage.setItem("open-battle:system", system);
  };
  const linkTo = (roomId: string) => {
    const q = new URLSearchParams({ room: roomId });
    if (sameBrowser) q.set("local", "1");
    // Keep relay settings so an invite link connects the same way.
    for (const k of NET_PARAMS) if (params.get(k)) q.set(k, params.get(k)!);
    enterRoom(q);
  };

  /** A game from a package names that package, so every player gets its code (read now: our own may have just gone in). */
  const namePackage = () => {
    const pkg = Object.values(useLibrary.getState().packages).find(
      (p) => p.trusted && p.manifest.kind === "system" && p.manifest.systems[0] === system,
    );
    if (!pkg) return;
    useStore.getState().dispatch({
      type: "game/packages",
      app: APP_BUILD,
      system: { id: system, builtIn: false },
      packages: [refOf(pkg)],
    });
  };
  const host = async (companion = false, as = name) => {
    // Our own games go in the library first, so the room names their package.
    if (ownGame(system)) await installOwnGame(system);
    remember(as);
    const roomId = room || crypto.randomUUID().slice(0, 8);
    linkTo(roomId);
    start({ role: "host", mode, roomId, name: as, system });
    // Online, the session starts once WebRTC has loaded: until then a dispatch goes nowhere, and a
    // 2 vs 2 room opened as 1 vs 1 (dogfood).
    whenStarted(() => {
      namePackage();
      presetMission();
      if (teamSize > 1) useStore.getState().dispatch({ type: "settings/set", settings: { teamSize } });
      if (companion) useStore.getState().dispatch({ type: "settings/set", settings: { companion: true } });
    });
  };
  /** Real models on a real table (#37): this screen keeps the cards, dice and score. */
  const companionHere = () => {
    if (ownGame(system)) return void playOwnAtTable(system);
    remember();
    start({ role: "host", mode: "hotseat", name, system });
    namePackage();
    presetMission();
    useStore.getState().dispatch({ type: "settings/set", settings: { companion: true } });
  };
  const join = (role: "client" | "spectator", roomId = room, as = name) => {
    remember(as);
    linkTo(roomId);
    start({ role, mode, roomId, name: as });
  };
  const resume = () => {
    if (!saved) return;
    if (saved.roomId) linkTo(saved.roomId);
    start({ role: "host", mode: saved.mode, roomId: saved.roomId ?? undefined, name, record: saved.record });
    // The computer takes its side again, at the level it played (UX 439).
    if (saved.computer) armSolo(saved.computer.level, saved.computer.seat);
  };
  // The name is asked once, when it's needed: an invite link, or hosting or joining with none yet (#78, UX 517).
  const [askName, setAskName] = useState<{ go: (name: string) => void; watch?: () => void } | null>(null);
  const needName = (go: (name: string) => void) => {
    const n = name.trim() || useCard.getState().name.trim();
    if (n) go(n);
    else setAskName({ go });
  };
  /** Both sides on this screen: our own games and the samples set up and started, any other game on an empty table. */
  const bothSides = () => {
    if (ownGame(system)) return void playOwnGame(system);
    if (FRONT[system]) return startDemo(system);
    remember();
    start({ role: "host", mode: "hotseat", name, system });
    namePackage();
    presetMission();
  };
  // A tab reloaded in the middle of a game goes straight back into its room.
  useEffect(() => {
    if (autoJoined) return;
    autoJoined = true;
    // A volunteer's exhibition table (#64): the computer plays itself for Live now.
    if (EXHIBITION) return startExhibition();
    const roomId = params.get("room");
    const back = roomId ? loadRoom(roomId) : null;
    // A hotseat game reloaded in the middle goes straight back in, the computer's side too (UX 395).
    const into = roomId ? null : reloadedInto(saved);
    if (into && saved) {
      start({ role: "host", mode: "hotseat", name, record: saved.record });
      if (into.solo) armSolo(into.solo.level, into.solo.seat);
      return;
    }
    if (!roomId) return;
    const m: Mode = params.get("local") === "1" ? "local" : "online";
    const who = localStorage.getItem("open-battle:name") ?? "";
    // A review room's link: watch the replay together (src/replay/review.ts).
    if (params.get("review") === "1") {
      start({ role: "spectator", mode: m, roomId, name: who, review: true });
      return;
    }
    // The streaming view always just watches.
    if (BROADCAST) {
      start({ role: "spectator", mode: m, roomId, name: who || "Stream" });
      return;
    }
    // An invite link goes straight into the room: a free seat is taken, a game in progress offers Rejoin or Watch.
    if (!back?.role) {
      if (!who.trim() && !useCard.getState().name.trim()) {
        // Set from the link, once: not a cascade of renders.
        queueMicrotask(() =>
          setAskName({
            go: (n) => start({ role: "client", mode: m, roomId, name: n }),
            watch: () => start({ role: "spectator", mode: m, roomId, name: "" }),
          }),
        );
        return;
      }
      start({ role: "client", mode: m, roomId, name: who });
      return;
    }
    if (back.role === "host") start({ role: "host", mode: m, roomId, name: who, record: back.record });
    else start({ role: back.role, mode: m, roomId, name: who });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const demos = listSystems().filter((s) => FRONT[s.id]);
  // The built-in lessons, then any lesson packages loaded on this device (data only: nothing to trust).
  const lessons = lessonPackages([
    ...BUILT_IN_LESSONS,
    ...Object.values(library)
      .filter((p) => p.manifest.kind === "lesson")
      .map((p) => p.source),
  ])
    .flatMap((p) => p.lessons)
    .filter(
      (l, i, all) => lessonSystem(l) && all.findIndex((x) => x.id === l.id && x.system === l.system) === i,
    );
  // One card per game, with its lessons and its demo (UX 284); lesson packages for other games get cards too.
  const games = [
    ...demos.map((g) => ({
      id: g.id,
      title: FRONT[g.id]!.title,
      blurb: FRONT[g.id]!.blurb,
      demo: true,
      lessons: lessons.filter((l) => lessonSystem(l) === g.id),
    })),
    ...[...new Set(lessons.map((l) => lessonSystem(l)!))]
      .filter((id) => !FRONT[id])
      .map((id) => ({
        id,
        title: systemLabel(id, ""),
        blurb: "",
        demo: false,
        lessons: lessons.filter((l) => lessonSystem(l) === id),
      })),
  ];

  if (askName)
    return (
      <div className="panel lobby">
        <form
          className="join-name"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            localStorage.setItem("open-battle:name", n);
            setAskName(null);
            askName.go(n);
          }}
        >
          {/* i18n-ignore */}
          <h1>Open Battle</h1>
          <p>
            {askName.watch
              ? t("You've been invited to a game. What should the others call you?")
              : t("What should the others call you?")}
          </p>
          <div className="row">
            <input
              value={name}
              placeholder={t("Your name")}
              aria-label={t("Your name")}
              autoFocus
              maxLength={32}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="primary" disabled={!name.trim()}>
              {t("Use this name")}
            </button>
          </div>
          {askName.watch ? (
            <button type="button" className="link quiet small" onClick={askName.watch}>
              {t("Just watch")}
            </button>
          ) : (
            <button type="button" className="link quiet small" onClick={() => setAskName(null)}>
              {t("Back")}
            </button>
          )}
        </form>
      </div>
    );

  // 1. What are you playing? (UX 513): the sci-fi battle and our own two side by side, the same shape, no
  // buttons on them; every other game under More games.
  const ours = [
    {
      id: RIFT_LANTERNS,
      // i18n-ignore
      title: "Rift Lanterns",
      blurb: t(
        "Our own skirmish game, free to share (CC BY). Four warbands fight over lanterns fallen into a rift. Nothing to import.",
      ),
    },
    {
      id: BRINEWATCH,
      // i18n-ignore
      title: "Brinewatch",
      blurb: t(
        "Our own skirmish game, free to share (CC BY). Crews of five to ten climb a drowned town's towers at low tide: two actions a go, guards and hidden lurkers. Nothing to import.",
      ),
    },
  ];
  const first = [
    ...games.filter((g) => FIRST.has(g.id)).map((g) => ({ id: g.id, title: g.title, blurb: g.blurb })),
    ...ours,
  ];
  const more = [
    ...games.filter((g) => !FIRST.has(g.id)).map((g) => ({ id: g.id, title: g.title, blurb: g.blurb })),
    ...systems
      .filter((x) => !games.some((g) => g.id === x.id) && !ownGame(x.id))
      .map((x) => ({ id: x.id, title: systemLabel(x.id, x.name), blurb: "" })),
  ];
  // A game picked from More games takes its place in the row.
  const shown = first.some((g) => g.id === system)
    ? first
    : [...first, ...more.filter((g) => g.id === system)];
  const picked = [...first, ...more].find((g) => g.id === system);
  const lesson = games.find((g) => g.id === system)?.lessons[0];
  const pick = (id: string) => {
    setSystem(id);
    localStorage.setItem("open-battle:system", id);
    // A choice the new game can't take (the computer) is asked again.
    flow.go(id, who === "computer" && !(FRONT[id] || ownGame(id)) ? null : who);
    focusInto("flow-who");
  };
  const choose = (id: Who) => {
    flow.go(system, id);
    localStorage.setItem(WHO_KEY, id);
    if (id === "computer") {
      setLevel(null);
      focusInto("flow-who .how-hard");
    } else focusInto("flow-ready");
  };
  /** The one button at the foot of Get ready: what happens is in its name. */
  const go = () => {
    if (who === "friend") void host(false, name.trim());
    else if (who === "both") bothSides();
    else if (who === "table") {
      if (phones === "one") companionHere();
      else void host(true, name.trim());
    }
  };
  const gameCard = (g: { id: string; title: string; blurb: string }) => (
    <button
      key={g.id}
      role="radio"
      aria-checked={opened && system === g.id}
      data-last={!opened && system === g.id ? "" : undefined}
      className={`demo game-pick${opened && system === g.id ? " on" : ""}${ownGame(g.id) ? " ours" : ""}`}
      onClick={() => pick(g.id)}
    >
      <strong>{g.title}</strong>
      {g.blurb && <span className="muted small">{g.blurb}</span>}
    </button>
  );
  // 2. Who against? Online is the computer's only where there's a computer player for the game.
  const computer = !!FRONT[system] || ownGame(system);
  const atTable = ownGame(system) || !fromPackages.some((p) => p.manifest.systems[0] === system);

  return (
    <div className="panel lobby">
      <div className="lobby-head">
        {/* i18n-ignore */}
        <h1>Open Battle</h1>
        {/* Settings out of the way, but in sight (UX 285). */}
        <div className="lobby-settings">
          <CardChip />
          {/* Set once, so one small menu (UX 83). */}
          <PopMenu label={t("Aa ▾")} title={t("Text size and language")} side="right" className="lobby-aa">
            <TextSizePicker />
            <LanguagePicker />
          </PopMenu>
        </div>
      </div>
      {/* Joining is the one thing a guest does: always at the top (UX 513). */}
      <div className="invite-box">
        <label>
          {t("Got an invite? Paste it")}{" "}
          <input
            value={room}
            placeholder={t("a room code or invite link")}
            aria-label={t("Room")}
            onChange={(e) => setRoom(roomFrom(e.target.value))}
          />
        </label>
        {room && (
          <>
            <div className="row">
              <button className="primary" onClick={() => needName((n) => join("client", room, n))}>
                {t("Join")}
              </button>
              <button onClick={() => join("spectator")}>{t("Watch")}</button>
            </div>
            {/* The connection check is for joining; it's in Report a problem too (UX 83). */}
            <NetCheck />
          </>
        )}
      </div>
      <p className="pitch">
        {t("Tabletop battles on a 3D table in your browser. Bring your army; the rules keep count.")}
      </p>
      {saved && savedAt?.event && savedAt.over ? (
        // An event game played out: the event is what's next, not the finished table (PX events 6).
        <button
          className="primary resume-top"
          onClick={() => void import("../events/play").then((m) => m.backToEvent(savedAt.event!.id))}
        >
          <strong>{t("{event}: back to the event", { event: savedAt.event.name })}</strong>
          <span className="small">
            {t("Event round {n} · Table {table}", { n: savedAt.event.round, table: savedAt.event.table })}
          </span>
        </button>
      ) : (
        saved && (
          <button className="primary resume-top" onClick={resume}>
            <strong>
              {savedAt
                ? savedAt.over
                  ? t("Back to {game}: Battle over", { game: savedAt.game })
                  : savedAt.round === null
                    ? t("Resume: {game}", { game: savedAt.game })
                    : savedAt.round > 0
                      ? t("Resume: {game}, round {n}", { game: savedAt.game, n: savedAt.round })
                      : t("Resume: {game}, deploying", { game: savedAt.game })
                : t("Resume last game")}
            </strong>
            <span className="small">
              {tn(
                saved.record.events.length,
                "{mode}, {n} event, saved {date}",
                "{mode}, {n} events, saved {date}",
                {
                  mode: saved.computer
                    ? t("Against the computer ({level})", { level: levelName(saved.computer.level) })
                    : ({ online: t("online"), local: t("local"), hotseat: t("hotseat") }[saved.mode] ??
                      saved.mode),
                  date: formatDate(new Date(saved.savedAt), {
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric",
                  }),
                },
              )}
            </span>
          </button>
        )
      )}
      {liveStrip && (
        <Suspense fallback={null}>
          <LiveStrip onMore={() => setTables(true)} />
        </Suspense>
      )}
      <WhatsNew />
      <UpdateToast />
      <OfflineNote />
      <div className="flow">
        <section id="flow-game" className="flow-col" aria-labelledby="flow-game-h">
          <h2 id="flow-game-h">{t("1. What are you playing?")}</h2>
          <div className="demos game-row" role="radiogroup" aria-labelledby="flow-game-h" onKeyDown={arrows}>
            {shown.map(gameCard)}
          </div>
          {more.length > 0 && (
            <details className="more-games">
              <summary>{t("More games ▸")}</summary>
              <div className="demos">{more.filter((g) => g.id !== system).map(gameCard)}</div>
            </details>
          )}
          {ownGame(system) && opened && (
            <button
              className="link small"
              onClick={() => (system === BRINEWATCH ? setBrineRules(true) : setRules(true))}
            >
              {t("Rules, print and play")}
            </button>
          )}
        </section>
        {opened && (
          <section id="flow-who" key={system} className="flow-col drawer" aria-labelledby="flow-who-h">
            <h2 id="flow-who-h">
              {picked ? t("2. Who against, in {game}?", { game: picked.title }) : t("2. Who against?")}
            </h2>
            <div className="who" role="radiogroup" aria-labelledby="flow-who-h" onKeyDown={arrows}>
              {(
                [
                  [
                    "friend",
                    "friend",
                    t("A friend online"),
                    t("You get a link to send; whoever opens it joins your table."),
                    true,
                  ],
                  ["computer", "solo", t("The computer"), t("Easy, Steady or Sharp."), computer],
                  [
                    "both",
                    "try play-now",
                    t("Both sides, on this screen"),
                    FRONT[system] || ownGame(system)
                      ? t("Two sample armies set up; you play both.")
                      : t("You set up both armies and play both."),
                    true,
                  ],
                  [
                    "table",
                    "table",
                    t("At a real table, with your models"),
                    t("Open Battle keeps the cards, wounds, CP, VP and each attack."),
                    atTable,
                  ],
                ] as const
              ).map(([id, cls, title, line, can]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={who === id}
                  data-last={!who && lastWho === id ? "" : undefined}
                  disabled={!can}
                  title={can ? undefined : t("No computer player for this game yet")}
                  className={`who-pick ${cls}${who === id ? " on" : ""}`}
                  onClick={() => choose(id)}
                >
                  <strong>{title}</strong>
                  <span className="muted small">{line}</span>
                </button>
              ))}
            </div>
            {who === "computer" && computer && (
              <div className="how-hard" role="radiogroup" aria-label={t("How hard?")} onKeyDown={arrows}>
                <strong className="small">{t("How hard?")}</strong>
                {(
                  [
                    ["random", t("plays loosely; good for a first game")],
                    ["steady", t("plays to win")],
                    ["sharp", t("thinks harder about every move")],
                  ] as const
                ).map(([l, line]) => (
                  <button
                    key={l}
                    role="radio"
                    aria-checked={level === l}
                    className={level === l ? "small on" : "small"}
                    onClick={() => {
                      setLevel(l);
                      focusInto("flow-ready");
                    }}
                  >
                    {levelName(l)} <span className="muted small">{characterName(l)}</span>{" "}
                    <span className="muted small">{line}</span>
                  </button>
                ))}
              </div>
            )}
            {lesson && (
              <button
                className="link small learn"
                title={gameText(lesson.summary)}
                onClick={() => void import("../teach/store").then((m) => m.startLesson(lesson))}
              >
                {t("New to it? Learn with a coach")}
              </button>
            )}
          </section>
        )}
        {opened && who && (who !== "computer" || level) && (
          <section
            id="flow-ready"
            key={`${system}/${who}`}
            className="flow-col drawer"
            aria-labelledby="flow-ready-h"
          >
            <h2 id="flow-ready-h">{t("3. Get ready")}</h2>
            {who === "computer" && level && (
              <YourArmy system={system} level={level} onBack={() => setLevel(null)} />
            )}
            {who === "table" && (
              <div className="segmented" role="radiogroup" aria-label={t("Phones")} onKeyDown={arrows}>
                <button
                  role="radio"
                  aria-checked={phones === "one"}
                  className={phones === "one" ? "on" : ""}
                  onClick={() => setPhones("one")}
                >
                  {t("One phone for both of us")}
                </button>
                {!ownGame(system) && (
                  <button
                    role="radio"
                    aria-checked={phones === "each"}
                    className={phones === "each" ? "on" : ""}
                    title={t("You get a link to send; the other player opens it on their phone")}
                    onClick={() => setPhones("each")}
                  >
                    {t("A phone each")}
                  </button>
                )}
              </div>
            )}
            {(who === "friend" || (who === "table" && phones === "each")) && (
              <label className="flow-name">
                {t("Your name")}{" "}
                <input
                  value={name}
                  maxLength={32}
                  placeholder={t("What should the others call you?")}
                  onChange={(e) => {
                    setName(e.target.value);
                    // Kept as typed, so Open tables and mail invites offer it too (dogfood).
                    if (e.target.value.trim())
                      localStorage.setItem("open-battle:name", e.target.value.trim());
                  }}
                />
              </label>
            )}
            {who === "friend" && (
              <p className="muted small">{t("Next, in the room: your army and the invite link to send.")}</p>
            )}
            {who === "both" && (
              <p className="muted small">
                {FRONT[system] || ownGame(system)
                  ? t("Both armies go on the table and the battle starts. Pass the screen at each turn.")
                  : t("An empty table: put both armies on it, then start.")}
              </p>
            )}
            {who !== "computer" && (
              <button
                className="primary flow-go"
                disabled={(who === "friend" || (who === "table" && phones === "each")) && !name.trim()}
                onClick={go}
              >
                {who === "both" ? t("Set up both sides") : t("Open the table")}
              </button>
            )}
            {who === "friend" && (
              <div className="row wrap who-more">
                <OfflineForFriends />
                {boardOn() && (
                  <button className="link open-tables-button" onClick={() => setTables(true)}>
                    {t("Or find an opponent on Open tables")}
                  </button>
                )}
                <details className="host-options">
                  <summary className="muted small">
                    {teamSize === 2 ? t("Options: 2 vs 2") : t("Options")}
                  </summary>
                  <div className="segmented" role="radiogroup" aria-label={t("Players")}>
                    {(
                      [
                        [1, t("1 vs 1"), t("Two players")],
                        [2, t("2 vs 2"), t("Four players in two teams; teams share CP and VP")],
                      ] as const
                    ).map(([n, label, about]) => (
                      <button
                        key={n}
                        role="radio"
                        aria-checked={teamSize === n}
                        className={teamSize === n ? "on" : ""}
                        title={about}
                        onClick={() => setTeamSize(n)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </section>
        )}
      </div>
      {tables && (
        <Suspense fallback={null}>
          <OpenTablesBoard
            onClose={() => setTables(false)}
            onJoin={(code, as) => {
              setRoom(code);
              if (as) setName(as);
              join("client", code, as || name);
            }}
            onHost={() => {
              setTables(false);
              useOpenTables.setState({ asked: true });
              needName((n) => void host(false, n));
            }}
          />
        </Suspense>
      )}
      {rules && (
        <Suspense fallback={null}>
          <RulesPage
            onClose={() => setRules(false)}
            play={[
              { label: t("Both sides, on this screen"), primary: true, run: () => void playRiftLanterns() },
              {
                label: t("The computer"),
                run: () => (setRules(false), pick(RIFT_LANTERNS), choose("computer")),
              },
              { label: t("At a real table"), run: () => void playRiftAtTable() },
            ]}
          />
        </Suspense>
      )}
      {brineRules && (
        <Suspense fallback={null}>
          <BrinewatchRules
            onClose={() => setBrineRules(false)}
            play={[
              {
                label: t("Both sides, on this screen"),
                primary: true,
                run: () => void playOwnGame(BRINEWATCH),
              },
              {
                label: t("The computer"),
                run: () => (setBrineRules(false), pick(BRINEWATCH), choose("computer")),
              },
              { label: t("At a real table"), run: () => void playOwnAtTable(BRINEWATCH) },
            ]}
          />
        </Suspense>
      )}
      {/* Files: one way in that recognises what it's given (UX 516); the rest of the ways to play fold below. */}
      <div className="row wrap lobby-files">
        <OpenFile />
        <details className="fold">
          <summary>{t("More ways to play")}</summary>
          <button className="own-army" onClick={() => setGuide(true)}>
            <strong>{t("Play your own army: import a list")}</strong>
            <span className="muted small">
              {t(
                "From New Recruit, BattleScribe, Yellowscribe or a Tabletop Simulator save, with your own figures if you have them.",
              )}
            </span>
          </button>
          <button className="tts-entry" onClick={() => openTts()}>
            {t("Open a Tabletop Simulator save as a game")}
          </button>
          <label className="check">
            <input type="checkbox" checked={sameBrowser} onChange={(e) => setSameBrowser(e.target.checked)} />
            {t("Same browser (play between two tabs, no network)")}
          </label>
          <button
            onClick={() => {
              remember();
              start({ role: "host", mode: "hotseat", name, system });
              namePackage();
              presetMission();
            }}
          >
            {t("Set up a game on this screen (hotseat)")}
          </button>
          <PackageLibrary system={system} onPick={pick} />
          <Suspense fallback={null}>
            <MailLobby
              name={name}
              system={system}
              onStarted={() => {
                remember();
                namePackage();
              }}
            />
          </Suspense>
          <button className="link" onClick={() => openLibrary()}>
            {t("Figure library: your models, packs and storage")}
          </button>
          <button className="link" onClick={openWorkshop}>
            {t("Module workshop: write your own game system")}
          </button>
          <OpenLink />
        </details>
        <InstallLink />
      </div>
      <footer className="lobby-foot muted small">
        <span>{t("No account: games run between your browsers.")}</span>
        <span>
          {/* i18n-ignore */}
          Open Battle {APP_BUILD.split("+")[0]} ·{" "}
          <a href="https://github.com/pwestling/openbattle" target="_blank" rel="noreferrer">
            {t("Source code")}
          </a>
        </span>
      </footer>
      {guide && <ArmyGuide system={system} onClose={() => setGuide(false)} />}
    </div>
  );
}

/** A room code, or the room in a pasted invite link (UX 289). */
function roomFrom(text: string): string {
  const v = text.trim();
  try {
    return new URL(v).searchParams.get("room") ?? v;
  } catch {
    return v;
  }
}

/** The player card in the lobby's header (UX 453): name and colour, one tap to the card and the ladder. */
function CardChip() {
  const name = useCard((c) => c.name.trim());
  const color = useCard((c) => c.colors[0]);
  return (
    <button
      className="card-chip"
      onClick={openPlayerCard}
      title={t("Your player card: name, colours, ranked games")}
      aria-label={t("Your player card: name, colours, ranked games")}
    >
      <span className="swatch" style={{ background: color }} aria-hidden="true" />
      {name || t("Your player card")}
    </button>
  );
}
