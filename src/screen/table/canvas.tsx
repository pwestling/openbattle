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

export function TableCanvas({ handDrop }: { handDrop: RefObject<HandDrop | null> }) {
  const play = usePlay();
  const { table, me, readOnly } = play;
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
    handDrop.current = (card, x, y, bottom) => {
      const target = gestures.targetAt(x, y);
      if (!target || target.into === "hand") return;
      void playRef.current.act(
        target.into === "table"
          ? { kind: "move card", card, to: { in: "table", position: target.at, faceUp: true } }
          : cardMove(card, target, bottom, playRef.current.me),
      );
    };
    return () => {
      handDrop.current = null;
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
    p.gestures.setTable(table, me, readOnly, (me && table.players[me]?.colour) || "#e2b04a", lastMove(play));
  }, [play, width, depth]);

  return <div className="table" ref={host} />;
}
