// Your hand: a row of cards along the bottom of the screen, dragged onto the table to play them.
// Everyone else's hand shows as card backs with a count.
import { useEffect, useState, type RefObject } from "react";
import type { Card, Fingerprint } from "../../record/index.ts";
import { usePlay } from "../play.tsx";
import { getFile } from "../../archive/index.ts";
import type { HandDrop } from "../table/canvas.tsx";

/** A card picture as a URL the page can show, once this browser has its file. */
export function usePicture(picture: Fingerprint | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!picture) return;
    let made: string | null = null;
    void getFile(picture).then((blob) => {
      if (!blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [picture]);
  return url;
}

function FaceUp({ card, onPointerDown }: { card: Card; onPointerDown?: (e: React.PointerEvent) => void }) {
  const picture = usePicture(card.picture);
  return (
    <li className="card" aria-label={card.name} onPointerDown={onPointerDown}>
      <strong>{card.name}</strong>
      {picture && <img src={picture} alt="" draggable={false} />}
      {card.text && <p>{card.text}</p>}
    </li>
  );
}

export function Hand({ handDrop }: { handDrop: RefObject<HandDrop | null> }) {
  const { table, me, readOnly } = usePlay();
  const [dragging, setDragging] = useState<{ card: Card; x: number; y: number } | null>(null);
  const cards = Object.values(table.cards);
  const mine = cards.filter((c) => c.place.in === "hand" && c.place.player === me);
  const others = Object.values(table.players)
    .filter((p) => p.id !== me)
    .map((p) => ({ player: p, count: cards.filter((c) => c.place.in === "hand" && c.place.player === p.id).length }))
    .filter((o) => o.count > 0);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setDragging((d) => d && { ...d, x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      setDragging(null);
      const over = document.elementFromPoint(e.clientX, e.clientY);
      if (!over?.closest(".hand")) handDrop.current?.(dragging.card.id, e.clientX, e.clientY, e.shiftKey);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging?.card.id]);

  if (!me && !others.length) return null;
  return (
    <section className="hand" aria-label="Your hand">
      {others.map((o) => (
        <p key={o.player.id} className="other-hand" aria-label={`${o.player.name}'s hand`}>
          {o.player.name}’s hand:{" "}
          {Array.from({ length: Math.min(o.count, 8) }, (_, i) => (
            <span key={i} className="back" />
          ))}{" "}
          {o.count}
        </p>
      ))}
      {me && !mine.length && <p className="empty-hand">Your hand is empty</p>}
      <ol className="cards">
        {mine.map((c) => (
          <FaceUp
            key={c.id}
            card={c}
            onPointerDown={(e) => {
              if (readOnly || e.button !== 0) return;
              e.preventDefault();
              setDragging({ card: c, x: e.clientX, y: e.clientY });
            }}
          />
        ))}
      </ol>
      {dragging && (
        <div className="card ghost" style={{ left: dragging.x, top: dragging.y }}>
          <strong>{dragging.card.name}</strong>
        </div>
      )}
    </section>
  );
}
