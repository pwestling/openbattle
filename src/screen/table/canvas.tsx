// Puts the 3D table on the page and keeps it in step with the table shown.
import { useEffect, useRef } from "react";
import { edgeOf, usePlay, type Play } from "../play.tsx";
import { Gestures } from "./gestures.ts";
import { Pieces } from "./pieces.ts";
import { TableView } from "./view.ts";

/** The models of the latest move up to the moment shown, whose paths stay visible to everyone. */
function lastMove(play: Play): string[] {
  const upTo = play.lookingAt ?? play.now.log.entries.length;
  const cancelled = new Set(play.table.cancelled);
  const entry = play.now.log.entries.findLast((e) => e.n <= upTo && e.action.kind === "move" && !cancelled.has(e.n));
  return entry?.action.kind === "move" ? entry.action.moves.map((m) => m.model) : [];
}

export function TableCanvas() {
  const play = usePlay();
  const { table, me, readOnly } = play;
  const host = useRef<HTMLDivElement>(null);
  const parts = useRef<{ view: TableView; gestures: Gestures } | null>(null);
  const actRef = useRef(play.act);
  actRef.current = play.act;
  const { width, depth } = table.size;

  useEffect(() => {
    const view = new TableView(host.current!, { width, depth });
    const pieces = new Pieces(view);
    const gestures = new Gestures(view, pieces, { act: (a) => actRef.current(a) });
    parts.current = { view, gestures };
    return () => {
      gestures.dispose();
      pieces.dispose();
      view.dispose();
      parts.current = null;
    };
  }, [width, depth]);

  useEffect(() => {
    const p = parts.current;
    if (!p) return;
    p.view.camera.setEdge(edgeOf(table, me));
    p.gestures.setTable(table, readOnly, (me && table.players[me]?.colour) || "#e2b04a", lastMove(play));
  }, [play, width, depth]);

  return <div className="table" ref={host} />;
}
