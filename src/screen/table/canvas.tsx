// Puts the 3D table on the page and keeps it in step with each snapshot.
import { useEffect, useRef } from "react";
import type { Snapshot } from "../../session/index.ts";
import { Gestures } from "./gestures.ts";
import { TableView } from "./view.ts";

export function TableCanvas({ now }: { now: Snapshot }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<TableView | null>(null);
  const { width, depth } = now.table.size;

  useEffect(() => {
    const v = new TableView(host.current!, { width, depth });
    const gestures = new Gestures(v);
    view.current = v;
    return () => {
      gestures.dispose();
      v.dispose();
      view.current = null;
    };
  }, [width, depth]);

  return <div className="table" ref={host} />;
}
