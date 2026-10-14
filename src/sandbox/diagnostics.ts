import type { PackageDiagnostic } from "./protocol";

/** Only report coordinates actually present in a package stack or persisted error. */
function sourceOf(error: unknown): PackageDiagnostic["source"] {
  const text = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const own = typeof location === "undefined" ? undefined : location.href;
  for (const match of text.matchAll(/((?:open-battle-package:|blob:|data:)[^\s)]*?):(\d+):(\d+)/g)) {
    if (match[1] === own) continue;
    const line = Number(match[2]);
    const column = Number(match[3]);
    if (line > 0 && column > 0) return { url: match[1]!, line, column };
  }
  return undefined;
}

export function packageDiagnostic(
  identity: Omit<PackageDiagnostic, "severity" | "message" | "source">,
  error: unknown,
): PackageDiagnostic {
  const source = sourceOf(error);
  return {
    ...identity,
    severity: "error",
    message: error instanceof Error ? error.message : String(error),
    ...(source ? { source } : {}),
  };
}

/** Keep real coordinates in the existing macro error string for record reconstruction. */
export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const source = sourceOf(error);
  return source ? `${message} (${source.url}:${source.line}:${source.column})` : message;
}

/** A new presentation evaluation gets its own bounded list, not a growing session log. */
export function addDiagnostic(diagnostics: PackageDiagnostic[], diagnostic: PackageDiagnostic): void {
  if (diagnostics.length < 100) diagnostics.push(diagnostic);
}
