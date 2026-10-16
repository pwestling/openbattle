// Puts the 3D table on the page and keeps it in step with the table shown.
import { useEffect, useRef, type RefObject } from "react";
import { edgeOf, usePlay, type Play } from "../play.tsx";
import { Cards } from "./cards.ts";
import { cardMove, Gestures } from "./gestures.ts";
import { Pieces } from "./pieces.ts";
import { TableView } from "./view.ts";

/** Lets a card dragged out of the hand be let go on the table. */
export type HandDrop = (card: string, clientX: number, clientY: number, bottom: boolean) => void;

/** The models of the latest move up to the moment shown, whose paths stay visible to everyone. */
function lastMove(play: Play): string[] {
  const upTo = play.lookingAt ?? play.now.log.entries.length;
  const cancelled = new Set(play.table.cancelled);
  const entry = play.now.log.entries.findLast((e) => e.n <= upTo && e.action.kind === "move" && !cancelled.has(e.n));
  return entry?.action.kind === "move" ? entry.action.moves.map((m) => m.model) : [];
}

/** Lets the panels select things on the table. */
export type Select = (ids: string[]) => void;

/** How far each model has been moved since the turn began, along the paths of its moves that still stand. */
function movedThisTurn(play: Play): Map<string, number> {
  const upTo = play.lookingAt ?? play.now.log.entries.length;
  const cancelled = new Set(play.table.cancelled);
  const entries = play.now.log.entries.filter((e) => e.n <= upTo && !cancelled.has(e.n));
  // The turn began at the latest standing phase change that moved to another round or player.
  let began = 0;
  let round = 0;
  let turn: string | null = null;
  for (const e of entries) {
    if (e.action.kind !== "phase") continue;
    if (e.action.phase.round !== round || e.action.phase.turn !== turn) began = e.n;
    ({ round, turn } = e.action.phase);
  }
  const moved = new Map<string, number>();
  for (const e of entries) {
    if (e.n <= began || e.action.kind !== "move") continue;
    for (const m of e.action.moves) {
      let length = 0;
      for (let i = 1; i < m.path.length; i++) length += Math.hypot(m.path[i]!.x - m.path[i - 1]!.x, m.path[i]!.y - m.path[i - 1]!.y);
      moved.set(m.model, (moved.get(m.model) ?? 0) + length);
    }
  }
  return moved;
}

export function TableCanvas({ handDrop, selectRef }: { handDrop: RefObject<HandDrop | null>; selectRef: RefObject<Select | null> }) {
  const play = usePlay();
  const { table, me, readOnly, lockedTerrain } = play;
  const host = useRef<HTMLDivElement>(null);
  const parts = useRef<{ view: TableView; gestures: Gestures } | null>(null);
  const playRef = useRef(play);
  playRef.current = play;
  const { width, depth } = table.size;

  useEffect(() => {
    const view = new TableView(host.current!, { width, depth });
    const pieces = new Pieces(view);
    const cards = new Cards(view);
    const gestures = new Gestures(view, pieces, cards, {
      act: (a) => playRef.current.act(a),
      draw: (deck, to) => {
        const { table, session, note } = playRef.current;
        const d = table.decks[deck];
        if (!d) return;
        if (d.cards.length === 0) return note(`${d.name} is empty.`);
        session.draw(deck, 1, to).catch((e: unknown) => note(e instanceof Error ? e.message : "No card could be drawn."));
      },
    });
    parts.current = { view, gestures };
    selectRef.current = (ids) => gestures.select(ids);
    handDrop.current = (card, x, y, bottom) => {
      const target = gestures.targetAt(x, y);
      if (!target || target.into === "hand") return;
      void playRef.current.act(
        target.into === "table"
          ? { kind: "move card", card, to: { in: "table", position: target.at, faceUp: true } }
          : cardMove(card, target, bottom, playRef.current.me, playRef.current.table),
      );
    };
    return () => {
      handDrop.current = null;
      selectRef.current = null;
      gestures.dispose();
      cards.dispose();
      pieces.dispose();
      view.dispose();
      parts.current = null;
    };
  }, [width, depth]);

  useEffect(() => {
    const p = parts.current;
    if (!p) return;
    p.view.camera.setEdge(edgeOf(table, me));
    p.gestures.setTable(table, me, readOnly, (me && table.players[me]?.colour) || "#e2b04a", lastMove(play), movedThisTurn(play));
  }, [play, width, depth]);

  useEffect(() => {
    parts.current?.gestures.setLocked(lockedTerrain);
  }, [lockedTerrain, width, depth]);

  return <div className="table" ref={host} />;
}
