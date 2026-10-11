import { lazy, Suspense, useEffect, useState } from "react";
import { BetterMoveHint } from "../review/ReviewPanel";
import { SoloBot } from "../bot/SoloBot";
import { CampaignBookDialog, CampaignKeeper } from "../campaign/CampaignUI";
import { OthersShaking } from "../companion/Shake";
import { onKey } from "../GameScreen";
import { t } from "../i18n";
import { MailBar } from "../mail/MailBar";
import { MyTableKeeper, TableArrivals } from "../opentables/OpenTables";
import { RankedKeeper } from "../ranked/RankedGame";
import { SharedDiceKeeper } from "../ranked/dice";
import { NoteCaption } from "../replay/NotesPanel";
import { Moments } from "../broadcast/Moments";
import { useStore } from "../store";
import { systemModule } from "../systems";
import { useTableTalk } from "../talk/talk";
import { BroughtOffer } from "../tts/BroughtOffer";
import { TtsNote } from "../tts/TtsNote";
import { Ambience } from "../ui/Ambience";
import { Announcer } from "../ui/Announcer";
import { AttackPanel } from "../ui/AttackPanel";
import { ClockKeeper } from "../ui/Clocks";
import { Coach } from "../ui/Coach";
import { ReportBanner } from "../ui/Crash";
import { DiceTray, landDice } from "../ui/DiceTray";
import { useHold } from "../ui/hold";
import { KeysSheet } from "../ui/Keys";
import { PackagePanel } from "../ui/PackagePanel";
import { PackageCards } from "../ui/Packages";
import { useTableKeys } from "../ui/peekKeys";
import { OthersPlanning, PlanPanel } from "../ui/PlanPanel";
import { PlayPanel } from "../ui/PlayPanel";
import { ReactionPrompt } from "../ui/ProcedurePanels";
import { MayReact, ReactionCard } from "../ui/ReactionCard";
import { ReplayBar } from "../ui/ReplayBar";
import { RerollCard } from "../ui/RerollCard";
import { ReplayTitle, RoundCard } from "../ui/RoundCard";
import { SandboxNotice } from "../ui/SandboxNotice";
import { ScriptPanel } from "../ui/ScriptPanel";
import { Showcase } from "../ui/Showcase";
import { battleOver, StatsScreen } from "../ui/StatsScreen";
import { StratagemHand } from "../ui/StratagemHand";
import { DragTag, TableTag } from "../ui/TableTag";
import { TableWarningsPanel } from "../ui/TableWarnings";
import { FloatingReactions, TalkPanel } from "../ui/TalkPanel";
import { TerrainPanel } from "../ui/TerrainPanel";
import { TouchLayer } from "../ui/TouchLayer";
import { UnitCard } from "../ui/UnitCard";
import { useHotseatMark } from "../ui/resumeHotseat";
import { OnAir, VoiceRoom } from "../voice/VoiceBar";
import { Drawer } from "./Drawer";
import { NextEnd, useEndStats } from "./End";
import { Setup } from "./Setup";
import { StepBar } from "./StepBar";
import { Strip } from "./Strip";

const Board = lazy(() => import("../render/Board").then((m) => ({ default: m.Board })));

/**
 * The game screen (ui-next): four places. The score strip on top, the table,
 * the step bar at the bottom with the one lit step, and a sheet on the right
 * only while a unit is selected or an attack is under way. Everything else is
 * in ⋯. Before the battle the room's checklist takes the left edge.
 */
export function NextGame() {
  useHotseatMark();
  useTableKeys();
  useTableTalk();
  const [drawer, setDrawer] = useState(false);
  const editing = useStore((s) => s.editing);
  const hotseat = useStore((s) => s.mode === "hotseat");
  const deploying = useStore((s) => s.game.turn.round === 0);
  const holding = useHold((s) => s.held !== null);
  const SystemPanel = systemModule(useStore((s) => s.game.system)).panel;
  const attacking = useStore(
    (s) => s.game.attack !== null || !!s.game.procedure || (s.draft !== null && s.scrub === null),
  );
  const selected = useStore((s) => s.selected !== null);
  const reacting = useStore((s) => !!s.game.pending);
  const view = useStore((s) => s.view);
  // At the end the result card leads; the classic stats screen opens only when asked for from it.
  const over = useStore((s) => battleOver(s.game) && s.scrub === null);
  const statsAsked = useEndStats((s) => s.asked);
  const setView = useStore((s) => s.setView);
  // A finished attack's panel doesn't follow into the next phase (UX N19), nor does the pick: the next unit is lit instead.
  const phaseKey = useStore((s) => `${s.game.turn.round}/${s.game.turn.phase}/${s.game.turn.activeSeat}`);
  useEffect(() => {
    const s = useStore.getState();
    if (s.game.attack) return;
    if (s.draft) s.setDraft(null);
    if (s.selected) s.select(null);
  }, [phaseKey]);
  useEffect(() => {
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  const sheet = editing || attacking || selected;
  return (
    <div className={`obn obn-game${sheet ? " with-sheet" : ""}${deploying ? " deploying" : ""}`}>
      <Suspense fallback={null}>
        <Board />
      </Suspense>
      <Strip onMenu={() => setDrawer(!drawer)} />
      {deploying && !editing ? <Setup /> : <StepBar />}
      {!editing && <ScriptPanel />}
      {!editing && <PlayPanel />}
      {!editing && SystemPanel && (
        <Suspense fallback={null}>
          <SystemPanel />
        </Suspense>
      )}
      {!editing && <PackagePanel />}
      {/* While the dice tray rolls, the sheet shows the table before the roll; a press there lands the dice at once. */}
      <div
        className={`obn-sheet-wrap${holding ? " holding" : ""}`}
        onClickCapture={(e) => {
          if (!holding || !(e.target as Element).closest?.("button, select")) return;
          e.preventDefault();
          e.stopPropagation();
          landDice();
        }}
      >
        {editing ? <TerrainPanel /> : attacking ? <AttackPanel /> : <UnitCard />}
      </div>
      {drawer && <Drawer onClose={() => setDrawer(false)} />}
      <ReplayBar />
      <ReportBanner />
      <TableWarningsPanel />
      <TtsNote />
      <BroughtOffer />
      <RoundCard />
      <ReplayTitle />
      <NoteCaption />
      <DiceTray />
      {!editing && !hotseat && <TalkPanel />}
      <FloatingReactions />
      <TableTag />
      <DragTag />
      {!editing && <StratagemHand tucked />}
      {!editing && <RerollCard />}
      {!editing && <ReactionCard />}
      {!editing && <MayReact />}
      {!editing && !hotseat && <PlanPanel />}
      <OthersPlanning />
      <OthersShaking />
      {!editing && <TouchLayer />}
      <VoiceRoom />
      <OnAir />
      <Moments />
      <Ambience />
      <Showcase />
      {(!over || statsAsked) && <StatsScreen />}
      <NextEnd />
      <PackageCards />
      <SandboxNotice />
      {!editing && <BetterMoveHint />}
      {!editing && <Coach />}
      {!editing && <SoloBot />}
      {!editing && <MailBar />}
      <MyTableKeeper />
      <TableArrivals />
      <RankedKeeper />
      <SharedDiceKeeper />
      <KeysSheet />
      <CampaignKeeper />
      <ClockKeeper />
      <CampaignBookDialog />
      <Announcer />
      {reacting && <ReactionPrompt />}
      {view === "eye" && (
        <button className="eye-exit primary" onClick={() => setView("3d")}>
          {t("Leave model's eye view (Esc)")}
        </button>
      )}
    </div>
  );
}
