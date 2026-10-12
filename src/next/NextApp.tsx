import { lazy, Suspense, useEffect } from "react";
import { BROADCAST } from "../broadcast/broadcast";
import { t } from "../i18n";
import { watchRoute } from "../ui/route";
import { VIEWER } from "../viewer/flag";
import "../styles/14-next.css";
import { Door } from "./Door";

const NextGame = lazy(() => import("./Game").then((m) => ({ default: m.NextGame })));
/** The streaming view and the replay page keep their own screens for now. */
const Classic = lazy(() => import("../GameScreen").then((m) => ({ default: m.GameScreen })));

/** Open Battle Next (ui-next): the new front door and game screen, over the same engine, net and table. */
export function NextApp({ started }: { started: boolean }) {
  // The address follows the screens from here on, once the door has rejoined a reloaded game (its effect runs first).
  useEffect(watchRoute, []);
  if (!started) return <Door />;
  return (
    <Suspense fallback={<div className="loading-table">{t("Setting up the table…")}</div>}>
      {BROADCAST || VIEWER ? <Classic started /> : <NextGame />}
    </Suspense>
  );
}
