// Games saved before ADR-032 and ADR-033 named a counter's or mark's target by a bare id, or "game".
// Reading one turns each into today's typed targets, so older games still open and resume.
import type { Log, Target } from "../record/index.ts";

type Kind = "model" | "unit" | "group" | "player" | "terrain" | "marker" | "item";

export function upgrade(log: Log): Log {
  if (!log.entries.some((e) => isOld(e.action))) return log;
  // Every id is unique within a game, so what first named it says what kind of thing it is.
  const kinds = new Map<string, Kind>();
  const name = (id: unknown, kind: Kind) => typeof id === "string" && !kinds.has(id) && kinds.set(id, kind);
  for (const { by, action: a } of log.entries) {
    if (a.kind === "join") name(by, "player");
    else if (a.kind === "place terrain") name(a.terrain?.id, "terrain");
    else if (a.kind === "add to army") {
      for (const u of a.units ?? []) name(u.id, "unit");
      for (const m of a.models ?? []) name(m.id, "model");
      for (const g of a.groups ?? []) name(g.id, "group");
      for (const i of a.items ?? []) name(i.id, "item");
    } else if (a.kind === "group") name(a.group, "group");
    else if (a.kind === "item") name(a.item?.id, "item");
    else if (a.kind === "place marker") name(a.marker?.id, "marker");
  }
  const typed = (id: string): Target => {
    if (id === "game") return { game: true };
    const kind = kinds.get(id) ?? "unit";
    return { [kind]: id } as Target;
  };
  return {
    ...log,
    entries: log.entries.map((e) => {
      if (!isOld(e.action)) return e;
      const { target, ...rest } = e.action as unknown as { target: string };
      return { ...e, action: { ...rest, targets: [typed(target)] } as unknown as typeof e.action };
    }),
  };
}

const isOld = (a: { kind: string }) => (a.kind === "counter" || a.kind === "mark") && typeof (a as { target?: unknown }).target === "string";
