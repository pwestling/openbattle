import { create } from "zustand";

/** The army showcase at battle start is running. */
export const useShowcase = create<{ on: boolean }>(() => ({ on: false }));

/** The showcase is on: the director and a followed commentator stand aside. */
export const showcasing = (): boolean => useShowcase.getState().on;

/** A game started before the table had loaded (the one-click demo): its showcase is still owed when it mounts. */
export const owed = { initial: null as object | null };

/** A game whose start isn't shown off (the module workshop's test table, UX 311). */
export const quiet = { initial: null as object | null };
