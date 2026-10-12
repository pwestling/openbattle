import { useState } from "react";
import type { GameState } from "../../../core";
import { isAlive } from "../../../core/units";
import { useStore } from "../../../store";
import { useGame } from "../../../ui/hooks";
import { displayName } from "../../../i18n/names";
import { t, tn } from "../../../i18n";
import type { FightRecord } from "../melee";
import { qd6 } from "../system";

/** Each seated side, with the units it still has to activate this round. */
function unitsToGo(game: GameState): { seat: number; name: string; left: number }[] {
  return Object.values(game.players)
    .filter((p) => p.seat !== undefined)
    .sort((a, b) => a.seat! - b.seat!)
    .map((p) => ({
      seat: p.seat!,
      name: displayName(p.name),
      left: Object.values(game.units).filter(
        (u) => u.owner === p.id && !u.status?.activated && !u.status?.reserves && isAlive(game, u),
      ).length,
    }));
}

/** The seat that ran out of units first this round, so goes first next round (initiative.ts), once known. */
function firstNextRound(game: GameState): number | undefined {
  const v = game.modules?.[qd6.id]?.[`firstDone:${game.turn.round}`];
  return typeof v === "number" ? v : undefined;
}

/** This round's last fight, from the module's state (melee.ts). */
export function lastFight(game: GameState): FightRecord | undefined {
  const f = game.modules?.[qd6.id]?.lastFight as FightRecord | undefined;
  return f && f.round === game.turn.round ? f : undefined;
}

/** How a fight ended, in a line. */
export function fightLine(f: FightRecord): string {
  const loser = f.loser === f.unit ? f.unitName : f.foeName;
  switch (f.morale) {
    case "tie":
      return t("A tie: no one tests morale.");
    case "destroyed":
      return t("{unit} was wiped out.", { unit: loser });
    case "held":
      return t("{unit} lost and held its nerve.", { unit: loser });
    case "shaken":
      return t("{unit} lost and is Shaken.", { unit: loser });
    case "routed":
      return t("{unit} lost and routed.", { unit: loser });
  }
}

/**
 * Quality d6's round at a glance (#82), self-contained: how many units each
 * side still has to go, who goes first next round (whoever runs out first),
 * and this round's last fight: the wounds each side caused and how it ended.
 */
export function Qd6RoundPanel() {
  const game = useGame();
  const scrub = useStore((s) => s.scrub);
  const [open, setOpen] = useState(true);
  if (game.system !== qd6.id || scrub !== null || game.turn.round === 0) return null;
  if (!open)
    return (
      <div className="panel play qd6-round collapsed">
        <button onClick={() => setOpen(true)}>{t("This round")}</button>
      </div>
    );
  const sides = unitsToGo(game);
  const first = firstNextRound(game);
  const firstName = sides.find((s) => s.seat === first)?.name;
  const fight = lastFight(game);
  return (
    <div className="panel play qd6-round" aria-label={t("This round")}>
      <div className="row spread">
        <strong>{t("This round")}</strong>
        <button className="quiet small" onClick={() => setOpen(false)}>
          {t("Hide")}
        </button>
      </div>
      <p className="small qd6-to-go">
        {sides.map((s, i) => (
          <span key={s.seat} className={s.seat === game.turn.activeSeat ? "now" : ""}>
            {i > 0 ? " · " : ""}
            {tn(s.left, "{name}: {n} unit to go", "{name}: {n} units to go", { name: s.name })}
          </span>
        ))}
      </p>
      <p className="small muted">
        {firstName
          ? game.turn.round >= Number(qd6.turn?.rounds ?? Infinity)
            ? t("{name} ran out of units first.", { name: firstName })
            : t("{name} ran out first, so goes first next round.", { name: firstName })
          : t("Whoever runs out of units first goes first next round.")}
      </p>
      {fight && (
        <div className="qd6-fight small">
          <strong>{t("Last fight")}</strong>
          <p>
            {t("{unit} caused {dealt}, {foe} struck back for {taken}.", {
              unit: fight.unitName,
              dealt: tn(fight.dealt, "{n} wound", "{n} wounds"),
              foe: fight.foeName,
              taken: tn(fight.taken, "{n} wound", "{n} wounds"),
            })}{" "}
            {fightLine(fight)}
          </p>
        </div>
      )}
    </div>
  );
}
