// Puts the 3D table on the page and keeps it in step with the table shown.
import { useEffect, useRef, type RefObject } from "react";
import { tableAt } from "../../record/index.ts";
import { edgeOf, usePlay, type Play } from "../play.tsx";
import { Cards } from "./cards.ts";
import { cardMove, Gestures, type Origin } from "./gestures.ts";
import { Pieces } from "./pieces.ts";
import { TableView } from "./view.ts";

/** Lets a card dragged out of the hand be let go on the table. */
export type HandDrop = (card: string, clientX: number, clientY: number, bottom: boolean) => void;

/**
 * Where each model that has moved this turn began the turn, and the waypoints its latest move was
 * pinned through. Dragging it again only adjusts that move; a leg is added by pinning a waypoint.
 */
function turnOrigins(play: Play): Map<string, Origin> {
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
  const origins = new Map<string, Origin>();
  for (const e of entries) {
    if (e.n <= began || e.action.kind !== "move") continue;
    for (const m of e.action.moves) {
      const was = origins.get(m.model);
      const first = m.path[0];
      if (!was && first) origins.set(m.model, { position: first, floor: tableAt(play.now.log, e.n - 1).models[m.model]?.floor ?? null, via: [] });
      const origin = origins.get(m.model);
      if (!origin || !first) continue;
      // A move recorded from the turn's start carries its pinned waypoints on; an older one starts afresh.
      origin.via = first.x === origin.position.x && first.y === origin.position.y ? m.path.slice(1, -1) : [];
    }
  }
  return origins;
}

/** Lets the panels select things on the table. */
export type Select = (ids: string[]) => void;

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
    p.gestures.setTable(table, me, readOnly, turnOrigins(play));
  }, [play, width, depth]);

  useEffect(() => {
    parts.current?.gestures.setLocked(lockedTerrain);
  }, [lockedTerrain, width, depth]);

  return <div className="table" ref={host} />;
}
