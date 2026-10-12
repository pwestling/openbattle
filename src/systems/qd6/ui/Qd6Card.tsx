import { useState } from "react";
import type { GameState, Unit } from "../../../core";
import { bindRules, systemOf, unitActions, type ActionOption, type RuleDef } from "../../../core/content";
import { useStore } from "../../../store";
import { useGame } from "../../../ui/hooks";
import { useArriving } from "../../../ui/tableVerbs";
import { gameText, t } from "../../../i18n";
import { qd6RuleLine } from "./glossary";

/**
 * Quality d6's part of the unit card (#82), self-contained so any screen can
 * mount it: the unit's state as badges, its order for this go as one choice
 * (Rally alone while Shaken), the rules its list gave it in a line each,
 * and the before-battle choices its rules offer (Hero joins a unit, Ambush
 * waits off the table).
 */
export function Qd6Card({ unit, mine }: { unit: Unit; mine: boolean }) {
  return (
    <div className="qd6-card">
      <Qd6Badges unit={unit} />
      {mine && <Qd6Orders unit={unit} />}
      {mine && <Qd6BeforeBattle unit={unit} />}
      <Qd6Rules unit={unit} />
    </div>
  );
}

/** The order a unit took this go, from the flag its order sets. */
const ORDER_FLAGS: [string, string][] = [
  ["holding", "Holding"],
  ["advancing", "Advancing"],
  ["rushing", "Rushing"],
  ["charging", "Charging"],
];

/** Shaken and Fatigued, what each means, and the order it's on: at a glance, under the stats. */
function Qd6Badges({ unit }: { unit: Unit }) {
  const s = unit.status ?? {};
  const order = ORDER_FLAGS.find(([flag]) => s[flag]);
  const badges: { key: string; cls: string; label: string; hint?: string }[] = [];
  if (s.shaken)
    badges.push({
      key: "shaken",
      cls: "bad",
      label: t("Shaken"),
      hint: t("Rallies on its next go; hits only on 6s in melee; holds no objectives."),
    });
  if (s.fatigued)
    badges.push({
      key: "fatigued",
      cls: "tired",
      label: t("Fatigued"),
      hint: t("Has fought this round: hits only on 6s in melee."),
    });
  if (order) badges.push({ key: "order", cls: "order", label: gameText(order[1]) });
  else if (s.activated) badges.push({ key: "gone", cls: "gone", label: t("Gone this round") });
  if (s.reserves) badges.push({ key: "ambush", cls: "gone", label: t("In ambush") });
  if (!badges.length) return null;
  return (
    <div className="qd6-badges">
      {badges.map((b) => (
        <span key={b.key} className={`qd6-badge ${b.cls}`} title={b.hint}>
          {b.label}
        </span>
      ))}
      {badges
        .filter((b) => b.hint)
        .map((b) => (
          <p key={`hint-${b.key}`} className="small qd6-badge-hint">
            {b.hint}
          </p>
        ))}
    </div>
  );
}

/** The ways to start a go (the orders), as the rules data offers them. */
export function qd6Orders(game: GameState, unit: Unit): ActionOption[] {
  // An order whose condition doesn't hold at all (Rally while steady) isn't one to offer.
  return unitActions(game, unit.id).filter(
    (o) => o.def.activates !== undefined && !o.def.reactTo && o.why !== "Not allowed now",
  );
}

/**
 * Its order for this go, one choice: Hold, Advance, Rush or Charge, each with
 * what it does and how far it goes; a Shaken unit's only order is Rally. An
 * order the rules say no to stays visible, greyed, with the reason.
 */
function Qd6Orders({ unit }: { unit: Unit }) {
  const game = useGame();
  const dispatch = useStore((s) => s.dispatch);
  const s = unit.status ?? {};
  if (game.turn.round === 0 || s.activated || s.acting || s.reserves) return null;
  const orders = qd6Orders(game, unit);
  if (!orders.length) return null;
  // Not this side's go: one line, not four greyed buttons.
  const anyOk = orders.some((o) => o.ok);
  if (!anyOk && orders.every((o) => o.why === orders[0]!.why) && orders[0]!.why)
    return <p className="muted small">{gameText(orders[0]!.why)}</p>;
  const rally = orders.find((o) => o.def.id === "rally");
  const shown = rally?.ok ? [rally] : orders;
  return (
    <div className="qd6-orders" role="group" aria-label={t("Its order")}>
      <p className="small">
        <strong>{rally?.ok ? t("Shaken: it rallies this go") : t("Give it an order")}</strong>
      </p>
      <div className="qd6-order-list">
        {shown.map((o) => (
          <button
            key={o.def.id}
            className={`qd6-order${rally?.ok ? " primary" : ""}`}
            disabled={!o.ok}
            title={o.ok ? undefined : gameText(o.why ?? "")}
            onClick={() => dispatch({ type: "action/take", unitId: unit.id, action: o.def.id }, unit.owner)}
          >
            <span className="qd6-order-name">
              {gameText(o.def.name)}
              {o.move !== undefined ? ` ${o.move}"` : ""}
            </span>
            <span className="qd6-order-hint">
              {o.ok ? gameText(o.def.hint ?? "") : gameText(o.why ?? "")}
            </span>
          </button>
        ))}
      </div>
      {/* Rules are advisory: an order the rules say no to (no enemy in reach) can still be taken. */}
      {shown
        .filter((o) => !o.ok && o.overridable)
        .map((o) => (
          <button
            key={`anyway-${o.def.id}`}
            className="quiet small"
            title={t("{why}. The log tells everyone it was taken anyway.", { why: gameText(o.why ?? "") })}
            onClick={() =>
              dispatch({ type: "action/take", unitId: unit.id, action: o.def.id, force: true }, unit.owner)
            }
          >
            {t("{action} anyway", { action: gameText(o.def.name) })}
          </button>
        ))}
    </div>
  );
}

/** The system's rules a unit's list named: each with its id, its name as written and the player's text. */
function qd6UnitRules(game: GameState, unit: Unit): { def: RuleDef; name: string; text: string }[] {
  const system = systemOf(game);
  return (unit.sheet?.abilities ?? []).flatMap((a) => {
    const ref = bindRules(system.rules, [a.name], "unit")[0];
    const def = ref && system.rules.find((r) => r.id === ref.rule);
    return def ? [{ def, name: a.name, text: a.text }] : [];
  });
}

/** The rules its list gave it, in a line each: the list's own words, else ours, and whether the app plays it. */
function Qd6Rules({ unit }: { unit: Unit }) {
  const game = useGame();
  const [open, setOpen] = useState<string | null>(null);
  const rules = qd6UnitRules(game, unit);
  if (!rules.length) return null;
  const plays = (def: RuleDef) =>
    def.played === "code" || def.effects.some((e) => e.do.some((d) => d.do !== "manual"));
  const line = rules.find((r) => r.name === open);
  return (
    <div className="qd6-rules">
      <div className="row wrap">
        {rules.map((r) => (
          <button
            key={r.name}
            className={`chip${open === r.name ? " on" : ""}`}
            aria-expanded={open === r.name}
            title={r.text || qd6RuleLine(r.def.id)}
            onClick={() => setOpen(open === r.name ? null : r.name)}
          >
            {r.name}
          </button>
        ))}
      </div>
      {line && (
        <p className="small rule-text">
          <strong>{line.name}.</strong> {line.text || qd6RuleLine(line.def.id) || ""}{" "}
          <span className="muted">
            {plays(line.def) ? t("The app plays this.") : t("A reminder: the players do this.")}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Before the battle, what its rules let it do: a Hero joins a friendly unit
 * (or leaves it again), an Ambush unit waits off the table. In the battle, a
 * unit in ambush arrives on its go.
 */
function Qd6BeforeBattle({ unit }: { unit: Unit }) {
  const game = useGame();
  const dispatch = useStore((s) => s.dispatch);
  const rules = new Set(qd6UnitRules(game, unit).map((r) => r.def.id));
  const s = unit.status ?? {};
  const deploying = game.turn.round === 0;
  const myGo = game.players[unit.owner]?.seat === game.turn.activeSeat;
  const busy = Object.values(game.units).some((u) => u.status?.acting);
  const hero = rules.has("hero") && deploying && !s.reserves;
  const friends = Object.values(game.units).filter(
    (u) => u.owner === unit.owner && u.id !== unit.id && !u.status?.reserves && !u.joined?.length,
  );
  const joined = deploying ? (unit.joined ?? []) : [];
  const ambush = rules.has("ambush");
  if (!hero && !joined.length && !(ambush && (deploying || s.reserves))) return null;
  return (
    <div className="qd6-before small">
      {hero && friends.length > 0 && (
        <label className="row">
          {t("Hero:")}{" "}
          <select
            value=""
            onChange={(e) =>
              e.target.value && dispatch({ type: "unit/attach", id: unit.id, to: e.target.value }, unit.owner)
            }
          >
            <option value="">{t("Join a unit…")}</option>
            {friends.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {joined.map((h) => (
        <button
          key={h.id}
          className="quiet small"
          onClick={() => dispatch({ type: "unit/detach", id: unit.id, unit: h.id }, unit.owner)}
        >
          {t("{hero} leaves the unit", { hero: h.name })}
        </button>
      ))}
      {ambush && deploying && !s.reserves && (
        <button onClick={() => dispatch({ type: "unit/reserve", id: unit.id, reserve: true }, unit.owner)}>
          {t("Wait in ambush")}
        </button>
      )}
      {ambush && deploying && s.reserves && (
        <button
          className="quiet small"
          onClick={() => dispatch({ type: "unit/reserve", id: unit.id, reserve: false }, unit.owner)}
        >
          {t("Set it up on the table instead")}
        </button>
      )}
      {!deploying && s.reserves && myGo && !busy && (
        <>
          {game.turn.round < 2 && <p className="muted small">{t("It arrives from round 2.")}</p>}
          <button
            className={game.turn.round < 2 ? "quiet small" : "primary"}
            title={t(
              'Click the table to set it down, more than 9" from every enemy model. Esc puts it back.',
            )}
            onClick={() =>
              game.settings.companion
                ? dispatch({ type: "unit/reserve", id: unit.id, reserve: false }, unit.owner)
                : useArriving.setState({ unitId: unit.id })
            }
          >
            {game.turn.round < 2 ? t("Arrive anyway") : t("Arrive")}
          </button>
        </>
      )}
    </div>
  );
}
