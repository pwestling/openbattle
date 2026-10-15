// At the table: the 3D table with the panels around it.
import { useEffect, useState } from "react";
import type { Session, Snapshot } from "../session/index.ts";
import { TableCanvas } from "./table/canvas.tsx";

export function Game({ session }: { session: Session }) {
  const [now, setNow] = useState<Snapshot | null>(null);
  useEffect(() => session.watch(setNow), [session]);
  useEffect(() => () => session.leave(), [session]);
  if (!now) return <main className="game" aria-busy="true" />;
  return (
    <main className="game">
      <Banner now={now} session={session} />
      <header className="topbar">
        <Invite link={now.link} />
      </header>
      <TableCanvas now={now} />
    </main>
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
      <span>Invite link</span>
      <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(() => setCopied(true));
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
