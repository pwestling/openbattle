import { create } from "zustand";

/**
 * The unit the step bar lights next, for the table: a tap on an enemy in Shooting or Charge is a
 * target for it, never its card (naive players 5). The bar keeps it up to date.
 */
export const useLit = create<{ unitId: string | null }>(() => ({ unitId: null }));
