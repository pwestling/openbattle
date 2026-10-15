// At the table: the 3D table with the panels around it.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Action } from "../record/index.ts";
import type { Session, Snapshot } from "../session/index.ts";
import { ArmyPanel } from "./panels/army.tsx";
import { LogPanel } from "./panels/log.tsx";
import { PhaseBar } from "./panels/phase.tsx";
import { PlayContext, usePlay, type Play } from "./play.tsx";
import { tableAt, toFile } from "./stand-ins.ts";
import { TableCanvas } from "./table/canvas.tsx";

export function Game({ session }: { session: Session }) {
  const [now, setNow] = useState<Snapshot | null>(null);
  const [lookingAt, lookAt] = useState<number | null>(null);
  const [notes, setNotes] = useState<{ id: number; text: string }[]>([]);
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
        <TableCanvas />
        <header className="topbar">
          <PhaseBar />
          <Invite link={now.link} />
          <Save />
        </header>
        <Banner now={now} session={session} />
        <aside className="left">
          <ArmyPanel />
        </aside>
        <aside className="right">
          <LogPanel lookingAt={lookingAt} lookAt={lookAt} />
        </aside>
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

function Banner({ now, session }: { now: Snapshot; session: Session }) {
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
            void session.resync().finally(() => setBusy(false));
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
