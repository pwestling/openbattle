import type { ReactNode } from "react";
import type { Intent, PlayerId } from "../core";
import { useStore } from "../store";
import { useReactionHeld } from "./reactionHold";

/**
 * A roll: sends the intent, and the game rolls the dice. The other player may
 * react first (#80), so it waits a short beat, or until they say Go on.
 */
export function RollButton({
  intent,
  as,
  className,
  title,
  children,
  onRolled,
}: {
  intent: Intent;
  as?: PlayerId;
  className?: string;
  title?: string;
  children: ReactNode;
  onRolled?: () => void;
}) {
  const held = useReactionHeld();
  return (
    <button
      className={className}
      disabled={held}
      title={title}
      onClick={() => {
        useStore.getState().dispatch(intent, as);
        onRolled?.();
      }}
    >
      {children}
    </button>
  );
}
