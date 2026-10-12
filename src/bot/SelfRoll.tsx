import { t } from "../i18n";
import { setShotHabit, useShotHabits } from "../ui/volley";

/**
 * "Roll my saves for me", next to the roll it changes: your saves roll as the wounds land, against a
 * person or the computer. Off unless chosen; then a roll waits for your press (Porter, 2026-10-12: no
 * roll ever goes by itself on a timer).
 */
export function RollsMineToggle() {
  const on = useShotHabits((s) => s.rollSaves);
  return (
    <label className="rolls-mine small muted">
      <input type="checkbox" checked={on} onChange={(e) => setShotHabit({ rollSaves: e.target.checked })} />{" "}
      {t("Roll my saves for me")}
    </label>
  );
}
