import { lazy, Suspense } from "react";
import { BROADCAST } from "../broadcast/broadcast";
import { t } from "../i18n";
import { useStore } from "../store";
import { VIEWER } from "../viewer/flag";
import "../styles/14-next.css";
import { Door } from "./Door";

const NextGame = lazy(() => import("./Game").then((m) => ({ default: m.NextGame })));
/** The streaming view, a replay page and the phone companion keep their own screens for now. */
const Classic = lazy(() => import("../GameScreen").then((m) => ({ default: m.GameScreen })));

/** Open Battle Next (ui-next): the new front door and game screen, over the same engine, net and table. */
export function NextApp({ started }: { started: boolean }) {
  const companion = useStore((s) => !!s.game.settings.companion);
  if (!started) return <Door />;
  return (
    <Suspense fallback={<div className="loading-table">{t("Setting up the table…")}</div>}>
      {BROADCAST || VIEWER || companion ? <Classic started /> : <NextGame />}
    </Suspense>
  );
}
