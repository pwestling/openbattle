import type { ReactNode } from "react";
import { t } from "../i18n";

/**
 * The unit card's reference (stats, weapons, abilities, sight tools, models) under one ⋯: the card
 * itself is the unit's name, models and what it can do now (naive players 1).
 */
export function CardMore({ children }: { children: ReactNode }) {
  return (
    <details className="card-more">
      <summary>{t("⋯ Stats, weapons and more")}</summary>
      {children}
    </details>
  );
}
