interface StatusItem {
  key: string;
  label: string;
  on: boolean;
  /** What clearing it is called, when "Clear …" won't do ("Undo activation"). */
  clear?: string;
  /** Asked before it's taken off (Undo activation): a slip shouldn't undo a unit's go. */
  confirm?: string;
}

/**
 * Once a unit's statuses were changed from a ⋯ menu beside the chips. The layout keeps statuses to
 * the log and the step bar, so this renders nothing. Its props are kept so existing callers compile;
 * the callers and this file can go.
 */
export function StatusMenu(_props: {
  items: StatusItem[];
  unitName: string;
  onChange: (key: string, on: boolean) => void;
}): null {
  return null;
}
