// Puts the 3D table on the page and keeps it in step with the table shown.
import { useEffect, useRef } from "react";
import { edgeOf, usePlay } from "../play.tsx";
import { Gestures } from "./gestures.ts";
import { Pieces } from "./pieces.ts";
import { TableView } from "./view.ts";

export function TableCanvas() {
  const { table, me } = usePlay();
  const host = useRef<HTMLDivElement>(null);
  const parts = useRef<{ view: TableView; pieces: Pieces } | null>(null);
  const { width, depth } = table.size;

  useEffect(() => {
    const view = new TableView(host.current!, { width, depth });
    const gestures = new Gestures(view);
    const pieces = new Pieces(view);
    parts.current = { view, pieces };
    return () => {
      gestures.dispose();
      pieces.dispose();
      view.dispose();
      parts.current = null;
    };
  }, [width, depth]);

  useEffect(() => {
    parts.current?.view.camera.setEdge(edgeOf(table, me));
    parts.current?.pieces.sync(table, new Set(), new Map());
  }, [table, me, width, depth]);

  return <div className="table" ref={host} />;
}
