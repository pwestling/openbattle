// At the table: the 3D table with the panels around it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Action } from "../record/index.ts";
import type { Session, Snapshot } from "../session/index.ts";
import { ArmyPanel } from "./panels/army.tsx";
import { DecksPanel } from "./panels/decks.tsx";
import { DicePanel } from "./panels/dice.tsx";
import { Hand } from "./panels/hand.tsx";
import { LogPanel } from "./panels/log.tsx";
import { PhaseBar } from "./panels/phase.tsx";
import { TerrainPanel } from "./panels/terrain.tsx";
import { PlayContext, usePlay, type Play } from "./play.tsx";
import { toFile } from "../archive/index.ts";
import { tableAt } from "../record/index.ts";
import { TableCanvas, type HandDrop } from "./table/canvas.tsx";

export function Game({ session }: { session: Session }) {
  const [now, setNow] = useState<Snapshot | null>(null);
  const [lookingAt, lookAt] = useState<number | null>(null);
  const [notes, setNotes] = useState<{ id: number; text: string }[]>([]);
  const handDrop = useRef<HandDrop | null>(null);
  useEffect(() => session.watch(setNow), [session]);
  useEffect(() => () => session.leave(), [session]);

  const note = useCallback((text: string) => {
    const id = Math.random();
    setNotes((n) => [...n, { id, text }]);
    setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 5000);
  }, []);

  const play = useMemo((): Play | null => {
    if (!now) return null;
    const me = "player" in now.who ? now.who.player : null;
    const table = lookingAt === null ? now.table : tableAt(now.log, lookingAt);
    return {
      session,
      now,
      table,
      lookingAt,
      me,
      readOnly: !me || now.connection !== "playing" || lookingAt !== null,
      act: async (action: Action) => {
        try {
          await session.act(action);
          return true;
        } catch (e) {
          note(e instanceof Error ? e.message : "That didn't work.");
          return false;
        }
      },
      note,
      newId: () => `${me ?? "x"}-${crypto.randomUUID().slice(0, 8)}`,
    };
  }, [now, lookingAt, session, note]);

  if (!play || !now) return <main className="game" aria-busy="true" />;
  return (
    <PlayContext.Provider value={play}>
      <main className={`game${play.readOnly ? " read-only" : ""}`}>
        <TableCanvas handDrop={handDrop} />
        <header className="topbar">
          <PhaseBar />
          <Invite link={now.link} />
          <Save />
          <Controls />
        </header>
        <Banner now={now} session={session} />
        <aside className="left">
          <Tabs />
        </aside>
        <aside className="right">
          <LogPanel lookingAt={lookingAt} lookAt={lookAt} />
        </aside>
        <aside className="corner">
          <DicePanel />
        </aside>
        <Hand handDrop={handDrop} />
        <div className="notes">
          {notes.map((n) => (
            <p key={n.id} role="alert">
              {n.text}
            </p>
          ))}
        </div>
      </main>
    </PlayContext.Provider>
  );
}

function Tabs() {
  const [tab, setTab] = useState<"Army" | "Terrain" | "Decks">("Army");
  return (
    <>
      <nav className="tabs" role="tablist">
        {(["Army", "Terrain", "Decks"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {tab === "Army" ? <ArmyPanel /> : tab === "Terrain" ? <TerrainPanel /> : <DecksPanel />}
    </>
  );
}

function Banner({ now, session }: { now: Snapshot; session: Session }) {
  const { note } = usePlay();
  const [busy, setBusy] = useState(false);
  let content = null;
  if (now.connection === "connecting") content = <>Connecting…</>;
  else if (now.connection === "host away") content = <>Waiting for the host. The game is paused.</>;
  else if (now.disagreement)
    content = (
      <>
        Your table differs from the host's.{" "}
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void session
              .resync()
              .catch(() => note("The host's copy could not be loaded. Try again in a moment."))
              .finally(() => setBusy(false));
          }}
        >
          Reload the host's copy
        </button>
      </>
    );
  else if (!now.kept) content = <>This browser won't keep the game, so it can't be picked up again from here.</>;
  return content ? (
    <div role="status" className="banner">
      {content}
    </div>
  ) : null;
}

function Invite({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="invite">
      <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(() => setCopied(true));
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

/** The mouse and keyboard controls, shown where the screen picked a key Tabletop Simulator lacks (ADR-017). */
function Controls() {
  return (
    <details className="controls">
      <summary>Controls</summary>
      <dl>
        <dt>Left-click</dt>
        <dd>Select a model; again, or double-click, for its whole unit. Shift-click adds or removes one.</dd>
        <dt>Left-drag</dt>
        <dd>On a model or terrain: carry it. On the table: select with a box.</dd>
        <dt>Q / E</dt>
        <dd>Turn what you carry.</dd>
        <dt>Space or right-click</dt>
        <dd>Pin a waypoint while carrying or measuring.</dd>
        <dt>Page Up / Page Down</dt>
        <dd>Step between floors while carrying (or Shift with the wheel).</dd>
        <dt>Hold Tab</dt>
        <dd>Ruler: drag between two spots or from a model. Only you see it.</dd>
        <dt>Right-drag</dt>
        <dd>Turn the camera.</dd>
        <dt>Middle-drag or arrows</dt>
        <dd>Slide the camera.</dd>
        <dt>Wheel</dt>
        <dd>Zoom.</dd>
        <dt>T / H</dt>
        <dd>Look straight down / back to your edge.</dd>
        <dt>Click a deck</dt>
        <dd>Draw into your hand; Shift-click to draw face up.</dd>
        <dt>Drag a card</dt>
        <dd>Onto the table, a discard pile or a deck (Shift: its bottom).</dd>
        <dt>F</dt>
        <dd>Flip the card under the pointer.</dd>
        <dt>Escape</dt>
        <dd>Put back what you carry.</dd>
      </dl>
    </details>
  );
}

/** Saves the game to a file; players and spectators alike. */
function Save() {
  const { now, note } = usePlay();
  return (
    <button
      onClick={async () => {
        try {
          const blob = await toFile(now.link, now.log);
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = blob instanceof File ? blob.name : `openbattle-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } catch {
          note("The game could not be saved to a file.");
        }
      }}
    >
      Save
    </button>
  );
}
