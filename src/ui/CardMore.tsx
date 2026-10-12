import type { ReactNode } from "react";
import { t } from "../i18n";
import { NEXT } from "../next/flag";
import { useStore } from "../store";

/**
 * The unit card's reference (stats, weapons, abilities, sight tools, models) under one ⋯ in the
 * new layout: the card itself is the unit's name, models and what it can do now (naive players 1).
 * The classic layout shows it all, as before, and so does the table companion, which has no step
 * bar: its weapons' Shoot and Fight are the way to attack.
 */
export function CardMore({ children }: { children: ReactNode }) {
  const companion = useStore((s) => !!s.game.settings.companion);
  if (!NEXT || companion) return <>{children}</>;
  return (
    <details className="card-more">
      <summary>{t("⋯ Stats, weapons and more")}</summary>
      {children}
    </details>
  );
}
