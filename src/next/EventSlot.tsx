import { lazy, Suspense } from "react";
import { useStore } from "../store";

const EventSeat = lazy(() => import("../events/EventSeat").then((m) => ({ default: m.EventSeat })));

/**
 * A table of an online event (#67) in the new layout: the seat's card (deploy the army entered with, the
 * checks, Back to the event). Its effects (ranked from the start, the army's hash, the top tables on Live now)
 * must run all game, so the game screen keeps one mounted, out of sight, while the battle is on.
 */
export function EventSlot({ hidden = false }: { hidden?: boolean }) {
  const event = useStore((s) => !!s.game.settings.event);
  if (!event) return null;
  return (
    <div className="obn-event" hidden={hidden}>
      <Suspense fallback={null}>
        <EventSeat />
      </Suspense>
    </div>
  );
}
