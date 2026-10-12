import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { characterName, levelName, savedLevel } from "../bot/solo";
import type { Level } from "../bot/player";
import { DEFAULT_SYSTEM } from "../core";
import { listSystems } from "../core/content";
import { isPlaceholder } from "../core/content/systems";
import { systemOf } from "../core/content/turn";
import { stateAt } from "../core/log";
import { openLibrary, openTts } from "../figures/open";
import {
  BRINEWATCH,
  installOwnGame,
  installRiftLanterns,
  ownGame,
  RIFT_LANTERNS,
} from "../games/riftLanterns";
import { t } from "../i18n";
import { LanguagePicker } from "../i18n/LanguagePicker";
import { boardOn, useOpenTables } from "../opentables/board";
import { useLibrary } from "../packages/library";
import { openPlayerCard } from "../player/open";
import { OpenFile } from "../share/OpenFile";
import { OpenLink } from "../share/OpenLink";
import { loadSavedGame } from "../store";
import { BUILT_IN_LESSONS, lessonPackages, lessonSystem } from "../teach/builtin";
import { usePlayRoute, useRouteFlag } from "../ui/route";
import { FRONT, gameTitle, systemLabel } from "../ui/systemLabels";
import { APP_BUILD } from "../version";
import { openWorkshop } from "../workshop/open";
import { TextSizePicker } from "../ui/TextSizePicker";
import { InstallLink, OfflineForFriends, OfflineNote, UpdateToast } from "../sw/UpdateToast";
import { ComputerArmy } from "./ComputerArmy";
import type { OwnArmy } from "../bot/startSolo";
import { PackageArmyChoice } from "../ui/PackageArmies";
import { SaveDoor } from "./SaveDoor";
import {
  atTable,
  autoJoin,
  bothSides,
  hostRoom,
  joinRoom,
  resume,
  roomFrom,
  savedName,
  NAME_KEY,
  SYSTEM_KEY,
  WHO_KEY,
  INVITE_KEY,
  WHOS,
  type Who,
} from "./start";

const OpenTablesBoard = lazy(() =>
  import("../opentables/OpenTables").then((m) => ({ default: m.OpenTablesBoard })),
);
const MailLobby = lazy(() => import("../mail/MailLobby").then((m) => ({ default: m.MailLobby })));

/** Arrow keys move between a group's choices, as in a radio group. */
function arrows(e: React.KeyboardEvent<HTMLElement>) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (!step) return;
  const all = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')];
  const at = all.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  all[(at + step + all.length) % all.length]?.focus();
}

/** Focus a column's chosen answer, else its first choice or field, once it has opened. */
function focusInto(id: string) {
  requestAnimationFrame(() => {
    for (const want of ['[aria-checked="true"]', "[data-last]", '[role="radio"]', "input", ".obn-lit"]) {
      const el = document.querySelector<HTMLElement>(`#${id} ${want}`);
      if (el) return el.focus();
    }
  });
}

interface Game {
  id: string;
  title: string;
  blurb: string;
}

/**
 * The front door (Flow Atlas 1): three columns, each opening when the one
 * before it is answered. What are you playing, who against, get ready, and
 * one lit button named for what happens. An invite is always in the header;
 * files and the other ways to play are one row in the footer.
 */
export function Door() {
  const flow = usePlayRoute();
  const [saved] = useState(loadSavedGame);
  const [askName, setAskName] = useState(false);
  useEffect(() => {
    // Joining from an invite link is a one-time side effect at load; the name form opens only if it needs one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoJoin(saved) === "name") setAskName(true);
  }, [saved]);
  const [name, setName] = useState(savedName);
  const [invite, setInvite] = useState(() => {
    const room = new URLSearchParams(location.search).get("room");
    if (room) return room;
    // Back from a join that was still looking: the invite is in the box again (naive players 12).
    try {
      const kept = sessionStorage.getItem(INVITE_KEY);
      sessionStorage.removeItem(INVITE_KEY);
      return kept ?? "";
    } catch {
      return "";
    }
  });
  // The last level played (Easy the first time) is picked already, so Start is lit at once (UX N39).
  const [level, setLevel] = useState<Level | null>(savedLevel);
  const [phones, setPhones] = useState<"one" | "each">("one");
  // Both sides on this screen: the near side's army, when a trusted package brings one (#82b).
  const [near, setNear] = useState<OwnArmy | null>(null);
  const [more, setMore] = useState(false);
  // A TTS save opened here goes to its own door (UX N2).
  const [save, setSave] = useState<File | null>(null);
  const [tables, setTables] = useRouteFlag("/tables");

  const library = useLibrary((s) => s.packages);
  useEffect(() => {
    void useLibrary.getState().load();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 500));
    idle(() => {
      void installRiftLanterns();
      void installOwnGame(BRINEWATCH);
    });
  }, []);
  const fromPackages = Object.values(library).filter(
    (p) => p.trusted && p.manifest.kind === "system" && p.manifest.systems[0],
  );
  const ours: Game[] = [
    {
      id: RIFT_LANTERNS,
      // i18n-ignore
      title: "Rift Lanterns",
      blurb: t("Our own free skirmish game. Warbands included, nothing to import."),
    },
    {
      id: BRINEWATCH,
      // i18n-ignore
      title: "Brinewatch",
      blurb: t("Our own free game of climbing crews at low tide. Crews included."),
    },
  ];
  const first: Game[] = [
    {
      id: DEFAULT_SYSTEM,
      title: FRONT[DEFAULT_SYSTEM]!.title,
      blurb: t("Squads move, shoot, charge and fight."),
    },
    ...ours,
  ];
  const others: Game[] = [
    ...listSystems()
      .filter((s) => s.id !== DEFAULT_SYSTEM && !ownGame(s.id))
      .map((s) => ({ id: s.id, title: systemLabel(s.id, s.name), blurb: FRONT[s.id]?.blurb ?? "" })),
    ...fromPackages
      .filter(
        (p) => !listSystems().some((s) => s.id === p.manifest.systems[0]) && !ownGame(p.manifest.systems[0]!),
      )
      .map((p) => ({ id: p.manifest.systems[0]!, title: p.manifest.name, blurb: "" })),
  ];
  const all = [...first, ...others];
  const lastSystem = (() => {
    try {
      return localStorage.getItem(SYSTEM_KEY);
    } catch {
      return null;
    }
  })();
  const lastWho = (() => {
    try {
      return localStorage.getItem(WHO_KEY) as Who | null;
    } catch {
      return null;
    }
  })();
  // A return visit reopens the last game and opponent, with Start lit: coming back is Enter, Enter (UX N42).
  const reopen =
    !flow.game && !invite && !!lastSystem && all.some((g) => g.id === lastSystem) ? lastSystem : null;
  const reopenWho =
    reopen &&
    lastWho &&
    WHOS.includes(lastWho) &&
    (lastWho !== "computer" || !!FRONT[reopen] || ownGame(reopen))
      ? lastWho
      : null;
  useEffect(() => {
    if (!reopen) return;
    flow.go(reopen, reopenWho);
    if (!reopenWho) focusInto("obn-who");
    else requestAnimationFrame(() => document.querySelector<HTMLElement>("#obn-ready .obn-lit")?.focus());
    // Once, as the door opens: a later visit to the bare door is the player's own choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const system = flow.game && all.some((g) => g.id === flow.game) ? flow.game : null;
  const who = system && WHOS.includes(flow.who as Who) ? (flow.who as Who) : null;
  const picked = all.find((g) => g.id === system);
  const shown = first.some((g) => g.id === system) || !picked ? first : [...first, picked];
  const [moreGames, setMoreGames] = useState(false);

  // Esc closes the last column opened.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".modal-backdrop, .modal")) return;
      if (level && who === "computer") setLevel(null);
      else if (who) flow.go(system, null);
      else if (system) flow.go(null);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [who, system, level, flow]);

  const lessons = useMemo(
    () =>
      lessonPackages([
        ...BUILT_IN_LESSONS,
        ...Object.values(library)
          .filter((p) => p.manifest.kind === "lesson")
          .map((p) => p.source),
      ]).flatMap((p) => p.lessons),
    [library],
  );
  const lesson = lessons.find((l) => lessonSystem(l) === system);
  const computer = !!system && (!!FRONT[system] || ownGame(system));
  const tableOk =
    !!system && (ownGame(system) || !fromPackages.some((p) => p.manifest.systems[0] === system));

  const savedAt = useMemo(() => {
    if (!saved) return null;
    try {
      const s = stateAt(saved.record);
      const placeholder = !!s.system && isPlaceholder(s.system);
      return {
        game: gameTitle(s),
        round: placeholder ? null : s.turn.round,
        over: placeholder ? false : s.turn.round > (Number(systemOf(s).turn.rounds) || Infinity),
      };
    } catch {
      return null;
    }
  }, [saved]);

  const pick = (id: string) => {
    setNear(null);
    try {
      localStorage.setItem(SYSTEM_KEY, id);
    } catch {
      // Not kept.
    }
    flow.go(id, who === "computer" && !(FRONT[id] || ownGame(id)) ? null : who);
    focusInto("obn-who");
  };
  const choose = (id: Who) => {
    flow.go(system, id);
    try {
      localStorage.setItem(WHO_KEY, id);
    } catch {
      // Not kept.
    }
    if (id === "computer") {
      setLevel(savedLevel());
      focusInto("obn-who .obn-levels");
    } else focusInto("obn-ready");
  };
  const keepName = (n: string) => {
    setName(n);
    try {
      if (n.trim()) localStorage.setItem(NAME_KEY, n.trim());
    } catch {
      // Not kept.
    }
  };
  const needsName = who === "friend" || (who === "table" && phones === "each");
  const go = () => {
    if (!system) return;
    const n = name.trim();
    if (who === "friend") void hostRoom(system, n);
    else if (who === "both") bothSides(system, n, near ?? undefined);
    else if (who === "table") {
      if (phones === "one") atTable(system, n);
      else void hostRoom(system, n, true);
    }
  };
  const goLabel =
    who === "friend"
      ? t("Open the table")
      : who === "both"
        ? t("Set up both sides")
        : who === "table"
          ? phones === "each"
            ? t("Open the table for two phones")
            : t("Start on this screen")
          : "";

  if (askName)
    return (
      <div className="obn obn-door">
        <Header invite={null} setInvite={() => {}} name={name} />
        <form
          className="obn-guest"
          onSubmit={(e) => {
            e.preventDefault();
            const roomId = new URLSearchParams(location.search).get("room");
            if (!name.trim() || !roomId) return;
            setAskName(false);
            joinRoom(roomId, name.trim());
          }}
        >
          <span className="obn-label">{t("You're invited to a game")}</span>
          <h1 className="obn-display">{t("Join the table")}</h1>
          <label className="obn-field">
            <span className="obn-label">{t("Your name")}</span>
            <input
              value={name}
              autoFocus
              maxLength={32}
              placeholder={t("What should the others call you?")}
              onChange={(e) => keepName(e.target.value)}
            />
          </label>
          <p className="obn-muted">{t("Next: your army, at the table.")}</p>
          <div className="obn-row">
            <button className="obn-lit" disabled={!name.trim()}>
              {t("Join the table ▸")}
            </button>
            <button
              type="button"
              className="obn-quiet"
              onClick={() => {
                const roomId = new URLSearchParams(location.search).get("room");
                if (roomId) joinRoom(roomId, name.trim(), "spectator");
              }}
            >
              {t("Just watch")}
            </button>
          </div>
        </form>
      </div>
    );

  const card = (g: Game) => (
    <button
      key={g.id}
      role="radio"
      aria-checked={system === g.id}
      data-last={!system && (lastSystem ?? DEFAULT_SYSTEM) === g.id ? "" : undefined}
      className={`obn-pick${system === g.id ? " on" : system ? " dim" : ""}`}
      onClick={() => pick(g.id)}
    >
      <strong>{g.title}</strong>
      {g.blurb && <span>{g.blurb}</span>}
    </button>
  );
  const whoChoices: [Who, string, string, boolean][] = [
    ["friend", t("A friend online"), t("You get a link to send. They need nothing installed."), true],
    ["computer", t("The computer"), t("Easy, Steady or Sharp."), computer],
    [
      "both",
      t("Both sides, this screen"),
      system && (FRONT[system] || ownGame(system))
        ? t("Two sample armies set up; pass the screen each turn.")
        : t("You set up both armies and play both."),
      true,
    ],
    ["table", t("A real table, your models"), t("Phones keep the cards, wounds, CP, VP and dice."), tableOk],
  ];

  return (
    <div className="obn obn-door">
      <Header invite={invite} setInvite={setInvite} name={name} />
      {/* A new version, between games only (#34), and what still works offline (UX 249/250). */}
      <UpdateToast />
      <OfflineNote />
      {saved && savedAt && (
        <button className="obn-resume" onClick={() => resume(saved, name.trim() || savedName())}>
          <span className="obn-label">{savedAt.over ? t("Your last game") : t("Resume")}</span>
          <strong>
            {savedAt.over
              ? t("{game}: the battle is over", { game: savedAt.game })
              : savedAt.round
                ? t("{game}, round {n}", { game: savedAt.game, n: savedAt.round })
                : t("{game}, setting up", { game: savedAt.game })}
          </strong>
        </button>
      )}
      {save ? (
        <SaveDoor file={save} onClose={() => setSave(null)} />
      ) : (
        <div className="obn-cols">
          <section id="obn-game" className="obn-col" aria-labelledby="obn-game-h">
            <h2 id="obn-game-h">
              <span className="obn-no">1</span> {t("What are you playing?")}
            </h2>
            <div role="radiogroup" aria-labelledby="obn-game-h" className="obn-stack" onKeyDown={arrows}>
              {shown.map(card)}
            </div>
            {others.length > 0 && (
              <>
                <button
                  className="obn-link"
                  aria-expanded={moreGames}
                  onClick={() => setMoreGames(!moreGames)}
                >
                  {moreGames ? t("Fewer games ▴") : t("More games ▸")}
                </button>
                {moreGames && (
                  <div
                    role="radiogroup"
                    aria-label={t("More games")}
                    className="obn-stack"
                    onKeyDown={arrows}
                  >
                    {others.filter((g) => g.id !== system).map(card)}
                  </div>
                )}
              </>
            )}
          </section>
          {system && (
            <section id="obn-who" key={system} className="obn-col obn-drawer" aria-labelledby="obn-who-h">
              <h2 id="obn-who-h">
                <span className="obn-no">2</span> {t("Who against?")}
              </h2>
              <div role="radiogroup" aria-labelledby="obn-who-h" className="obn-stack" onKeyDown={arrows}>
                {whoChoices.map(([id, title, line, can]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={who === id}
                    data-last={!who && lastWho === id ? "" : undefined}
                    disabled={!can}
                    title={can ? undefined : t("Not for this game yet")}
                    className={`obn-pick${who === id ? " on" : who ? " dim" : ""}`}
                    onClick={() => choose(id)}
                  >
                    <strong>{title}</strong>
                    <span>{line}</span>
                  </button>
                ))}
              </div>
              {who === "computer" && (
                <div
                  className="obn-levels obn-stack"
                  role="radiogroup"
                  aria-label={t("How hard?")}
                  onKeyDown={arrows}
                >
                  <span className="obn-label">{t("How hard?")}</span>
                  {(
                    [
                      ["random", t("Plays loosely. Good for a first game.")],
                      ["steady", t("Plays to win.")],
                      ["sharp", t("Thinks harder about every move.")],
                    ] as const
                  ).map(([l, line]) => (
                    <button
                      key={l}
                      role="radio"
                      aria-checked={level === l}
                      data-last={!level && savedLevel() === l ? "" : undefined}
                      className={`obn-pick small${level === l ? " on" : level ? " dim" : ""}`}
                      onClick={() => {
                        setLevel(l);
                        focusInto("obn-ready");
                      }}
                    >
                      <strong>
                        {levelName(l)} <em>{characterName(l)}</em>
                      </strong>
                      <span>{line}</span>
                    </button>
                  ))}
                </div>
              )}
              {lesson && (
                <button
                  className="obn-link"
                  onClick={() => void import("../teach/store").then((m) => m.startLesson(lesson))}
                >
                  {t("New to it? Learn with a coach ▸")}
                </button>
              )}
            </section>
          )}
          {system && who && (who !== "computer" || level) && (
            <section
              id="obn-ready"
              key={`${system}/${who}`}
              className="obn-col obn-drawer"
              aria-labelledby="obn-ready-h"
            >
              <h2 id="obn-ready-h">
                <span className="obn-no">3</span> {t("Get ready")}
              </h2>
              {who === "computer" && level ? (
                <ComputerArmy key={level} system={system} level={level} />
              ) : (
                <>
                  {who === "table" && !ownGame(system) && (
                    <div className="obn-stack" role="radiogroup" aria-label={t("Phones")} onKeyDown={arrows}>
                      {(
                        [
                          ["one", t("One phone or screen for both of us")],
                          ["each", t("A phone each: you get a link for the other phone")],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          role="radio"
                          aria-checked={phones === id}
                          className={`obn-pick small${phones === id ? " on" : ""}`}
                          onClick={() => setPhones(id)}
                        >
                          <strong>{label}</strong>
                        </button>
                      ))}
                    </div>
                  )}
                  {who === "both" && (FRONT[system] || ownGame(system)) && (
                    <PackageArmyChoice key={system} system={system} onChange={setNear} />
                  )}
                  {who === "friend" && <OfflineForFriends />}
                  {needsName && (
                    <label className="obn-field">
                      <span className="obn-label">{t("Your name")}</span>
                      <input
                        value={name}
                        className={name.trim() ? undefined : "obn-lit-field"}
                        maxLength={32}
                        placeholder={t("What should the others call you?")}
                        onChange={(e) => keepName(e.target.value)}
                      />
                    </label>
                  )}
                  <p className="obn-muted">
                    {who === "friend"
                      ? t("Next: the table opens with a link to send. Your army goes on it there.")
                      : who === "both"
                        ? FRONT[system] || ownGame(system)
                          ? t("Both armies go on the table and the battle starts. Pass the screen each turn.")
                          : t("An empty table: put both armies on it, then start.")
                        : t("No 3D table: your phone keeps count while you play with your models.")}
                  </p>
                  <button className="obn-lit" disabled={needsName && !name.trim()} onClick={go}>
                    {goLabel} ▸
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      )}
      <footer className="obn-foot">
        {/* The other ways to play wait until a game is picked (naive players 9). A file, such as the
            weekly game's TTS save, opens from the first screen (UX 530). */}
        <OpenFile onTts={setSave} label={t("Open a save or file…")} />
        {system && (
          <>
            {boardOn() && (
              <button className="obn-link" onClick={() => setTables(true)}>
                {t("Find an opponent")}
              </button>
            )}
            <button className="obn-link" aria-expanded={more} onClick={() => setMore(!more)}>
              {t("More ways to play ▸")}
            </button>
          </>
        )}
        {/* One version string is enough (Jobs review): What's new and the classic layout are gone from
            the door; the language is under More ways to play. */}
        <span className="obn-muted obn-version">
          {/* i18n-ignore */}
          Open Battle {APP_BUILD.split("+")[0]}
        </span>
      </footer>
      {more && (
        <div className="obn-sheet obn-more" role="dialog" aria-label={t("More ways to play")}>
          <div className="obn-sheet-head">
            <strong>{t("More ways to play")}</strong>
            <button className="obn-quiet" onClick={() => setMore(false)} aria-label={t("Close")}>
              ✕
            </button>
          </div>
          <button className="obn-pick small" onClick={() => openTts()}>
            <strong>{t("Open a Tabletop Simulator save")}</strong>
            <span>{t("Terrain, armies and decks arrive as one game.")}</span>
          </button>
          <Suspense fallback={null}>
            <MailLobby name={name} system={system ?? lastSystem ?? DEFAULT_SYSTEM} onStarted={() => {}} />
          </Suspense>
          <button className="obn-pick small" onClick={() => openLibrary()}>
            <strong>{t("Figure library")}</strong>
            <span>{t("Your models, packs and storage.")}</span>
          </button>
          <button className="obn-pick small" onClick={openWorkshop}>
            <strong>{t("Module workshop")}</strong>
            <span>{t("Write your own game system.")}</span>
          </button>
          <OpenLink />
          <InstallLink />
          <LanguagePicker />
        </div>
      )}
      {tables && (
        <Suspense fallback={null}>
          <OpenTablesBoard
            onClose={() => setTables(false)}
            onJoin={(code, as) => joinRoom(code, as || name.trim() || savedName())}
            onHost={() => {
              setTables(false);
              // "Host a table and post it": the room opens with its Open tables post filled in (as the classic door).
              useOpenTables.setState({ asked: true });
              const g = system ?? lastSystem ?? DEFAULT_SYSTEM;
              void hostRoom(g, name.trim() || savedName());
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/** The door's header: the name, the invite (always here) and the player card. */
function Header({
  invite,
  setInvite,
  name,
}: {
  invite: string | null;
  setInvite: (s: string) => void;
  name: string;
}) {
  const [aa, setAa] = useState(false);
  return (
    <header className="obn-head">
      <div className="obn-brand">
        Open <b>Battle</b> {/* i18n-ignore: the name */}
      </div>
      <span className="obn-muted obn-pitch">
        {t("Tabletop battles in your browser, between friends. No account.")}
      </span>
      {invite !== null && (
        <form
          className="obn-invite"
          onSubmit={(e) => {
            e.preventDefault();
            const code = roomFrom(invite);
            if (code) joinRoom(code, name.trim() || savedName());
          }}
        >
          <label>
            <span>{t("Got an invite?")}</span>
            <input
              value={invite}
              placeholder={t("Paste the link or code")}
              aria-label={t("Paste an invite link or code")}
              onChange={(e) => setInvite(roomFrom(e.target.value))}
            />
          </label>
          {invite && <button className="obn-lit small">{t("Join")}</button>}
        </form>
      )}
      <button className="obn-quiet" onClick={openPlayerCard} title={t("Your player card")}>
        {name.trim() || t("Player card")}
      </button>
      {/* Text size before anything else, for whoever can't read the door at this size (UX 533). */}
      <span className="obn-pop">
        <button className="obn-quiet" aria-expanded={aa} onClick={() => setAa(!aa)} title={t("Text size")}>
          {t("Aa")}
        </button>
        {aa && (
          <span className="obn-popmenu">
            <TextSizePicker />
          </span>
        )}
      </span>
    </header>
  );
}
