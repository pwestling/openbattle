import type { ReactNode } from "react";
import { t } from "../i18n";
import { NEXT } from "../next/flag";

/**
 * The unit card's reference (stats, weapons, abilities, sight tools, models) under one ⋯ in the
 * new layout: the card itself is the unit's name, models and what it can do now (naive players 1).
 * The classic layout shows it all, as before.
 */
export function CardMore({ children }: { children: ReactNode }) {
  if (!NEXT) return <>{children}</>;
  return (
    <details className="card-more">
      <summary>{t("⋯ Stats, weapons and more")}</summary>
      {children}
    </details>
  );
}
