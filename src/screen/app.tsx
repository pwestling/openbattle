// The three places a person can be: the start page, arriving from a link, and at the table.
import { useEffect, useState } from "react";
import type { Me, Session } from "../session/index.ts";
import { Game } from "./game.tsx";
import { fromFile, load, save } from "../archive/index.ts";
import { enterGame, openGame } from "./stand-ins.ts";

type Place = { at: "start"; message?: string } | { at: "arrive"; link: string } | { at: "table"; session: Session };

const colours = ["#d1453b", "#2f6fd6", "#2e9e55", "#d69a1f", "#8a4fd1", "#1aa3a3", "#e0e0e0", "#333333"];

/** The name and colour this browser last used, so the forms start filled in. */
function rememberedMe(): Me {
  try {
    const me = JSON.parse(localStorage.getItem("openbattle-me") ?? "null") as Me | null;
    if (me?.name && me.colour) return me;
  } catch {
    // Nothing remembered.
  }
  return { name: "", colour: colours[0]! };
}

function remember(me: Me) {
  try {
    localStorage.setItem("openbattle-me", JSON.stringify(me));
  } catch {
    // Remembering is a convenience only.
  }
}

export function App() {
  const [place, setPlace] = useState<Place>(() =>
    location.search || location.hash ? { at: "arrive", link: location.href } : { at: "start" },
  );
  const toTable = (session: Session) => setPlace({ at: "table", session });
  const toStart = (message?: string) => {
    history.replaceState(null, "", "/");
    setPlace(message ? { at: "start", message } : { at: "start" });
  };
  if (place.at === "table") return <Game session={place.session} />;
  if (place.at === "arrive") return <Arrive link={place.link} onEnter={toTable} onBroken={toStart} />;
  return <Start message={place.message} onOpen={toTable} />;
}

function MeFields({ me, setMe }: { me: Me; setMe: (me: Me) => void }) {
  return (
    <>
      <label>
        Your name
        <input value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} required autoFocus />
      </label>
      <fieldset className="colours">
        <legend>Colour</legend>
        {colours.map((c) => (
          <button
            type="button"
            key={c}
            aria-label={`Colour ${c}`}
            aria-pressed={me.colour === c}
            style={{ background: c }}
            onClick={() => setMe({ ...me, colour: c })}
          />
        ))}
      </fieldset>
    </>
  );
}

function Start({ message, onOpen }: { message?: string | undefined; onOpen: (s: Session) => void }) {
  const [me, setMe] = useState(rememberedMe);
  const [width, setWidth] = useState(60);
  const [depth, setDepth] = useState(44);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; retry?: () => void } | null>(message ? { text: message } : null);

  const newGame = async () => {
    setBusy(true);
    setProblem(null);
    remember(me);
    try {
      const session = await openGame({ width, depth }, me);
      const stop = session.watch((now) => history.replaceState(null, "", now.link));
      stop();
      onOpen(session);
    } catch {
      setProblem({ text: "The server can't be reached right now.", retry: newGame });
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (file: File) => {
    setBusy(true);
    setProblem(null);
    try {
      const { link, log } = await fromFile(file);
      // The game in the file opens here as its host: the player who started it.
      const host = log.entries.find((e) => e.action.kind === "join")?.by;
      if (!host) throw new Error("That saved game has no players.");
      await save(link, { log, me: host });
      history.replaceState(null, "", link);
      onOpen(await enterGame(link, me));
    } catch (e) {
      setProblem({ text: e instanceof Error ? e.message : "That file could not be opened." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="start">
      <h1>OpenBattle</h1>
      {problem && (
        <p role="alert" className="problem">
          {problem.text} {problem.retry && <button onClick={problem.retry}>Retry</button>}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void newGame();
        }}
      >
        <h2>New game</h2>
        <MeFields me={me} setMe={setMe} />
        <div className="size">
          <label>
            Table width (inches)
            <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
          <label>
            Table depth (inches)
            <input type="number" min={1} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
          </label>
        </div>
        <button type="submit" disabled={busy || !me.name.trim()}>
          New game
        </button>
      </form>
      <section>
        <h2>Open a saved file</h2>
        <label className="file">
          Choose a saved game file
          <input
            type="file"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void openFile(file);
            }}
          />
        </label>
      </section>
    </main>
  );
}

function Arrive({ link, onEnter, onBroken }: { link: string; onEnter: (s: Session) => void; onBroken: (m: string) => void }) {
  const [me, setMe] = useState(rememberedMe);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const enter = async (as: Me | "watch") => {
    setBusy(true);
    try {
      onEnter(await enterGame(link, as));
    } catch {
      onBroken("That link doesn't lead to a game. Check it with whoever sent it, or start a new one.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Someone coming back on the same browser goes straight back to their seat.
    void load(link).then((saved) => (saved ? enter(saved.me === "watch" ? "watch" : rememberedMe()) : setAsking(true)));
  }, [link]);

  if (!asking) return <main className="start" aria-busy="true" />;
  return (
    <main className="start">
      <h1>OpenBattle</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          remember(me);
          void enter(me);
        }}
      >
        <h2>Join this game</h2>
        <MeFields me={me} setMe={setMe} />
        <button type="submit" disabled={busy || !me.name.trim()}>
          Join
        </button>
        <button type="button" disabled={busy} onClick={() => void enter("watch")}>
          Watch
        </button>
      </form>
    </main>
  );
}
