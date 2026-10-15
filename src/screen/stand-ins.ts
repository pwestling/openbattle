// Every call the screen makes into Session, Record, Measure and Archive goes through here.
// While those modules are still stubs ("… is not built yet"), each call falls back to a small
// stand-in so the screen can be built and proven. When a module lands its fallback stops being
// used; delete the fallbacks (and src/screen/fake) once all four have landed.
import * as archive from "../archive/index.ts";
import * as measure from "../measure/index.ts";
import * as record from "../record/index.ts";
import * as session from "../session/index.ts";
import type { Fingerprint, Floor, Log, PlayerId, Point, Size, Table } from "../record/index.ts";
import type { Me, Session } from "../session/index.ts";
import { fakeTableAt } from "./fake/fold.ts";
import { fakeEnter, fakeFile, fakeKeep, fakeKept, fakeOpen } from "./fake/session.ts";

const notBuilt = (e: unknown) => e instanceof Error && e.message.endsWith("is not built yet");

async function orFake<T>(real: () => Promise<T>, fake: () => T | Promise<T>): Promise<T> {
  try {
    return await real();
  } catch (e) {
    if (notBuilt(e)) return fake();
    throw e;
  }
}

function orFakeNow<T>(real: () => T, fake: () => T): T {
  try {
    return real();
  } catch (e) {
    if (notBuilt(e)) return fake();
    throw e;
  }
}

export const openGame = (size: Size, me: Me): Promise<Session> =>
  orFake(
    () => session.open(size, me),
    () => fakeOpen(size, me),
  );

export const enterGame = (link: string, as: Me | "watch"): Promise<Session> =>
  orFake(
    () => session.enter(link, as),
    () => fakeEnter(link, as),
  );

export const tableAt = (log: Log, upTo?: number): Table =>
  orFakeNow(
    () => record.tableAt(log, upTo),
    () => fakeTableAt(log, upTo),
  );

export const kept = (link: string): Promise<archive.Saved | null> =>
  orFake(
    () => archive.load(link),
    () => fakeKept(link),
  );

export const keep = (link: string, saved: { log: Log; me: PlayerId | "watch" }): Promise<void> =>
  orFake(
    () => archive.save(link, saved),
    () => fakeKeep(link, saved),
  );

export const getFile = (fingerprint: Fingerprint): Promise<Blob | null> =>
  orFake(
    () => archive.getFile(fingerprint),
    () => fakeFile(fingerprint),
  );

export const toFile = (link: string, log: Log): Promise<Blob> =>
  orFake(
    () => archive.toFile(link, log),
    () => new Blob([JSON.stringify({ openbattle: 0, link, log })], { type: "application/json" }),
  );

export const fromFile = (file: Blob): Promise<{ link: string; log: Log }> =>
  orFake(
    () => archive.fromFile(file),
    async () => {
      const data = JSON.parse(await file.text()) as { openbattle?: number; log?: Log };
      if (data.openbattle !== 0 || !data.log) throw new Error("That file is not a saved game.");
      return { link: `${location.origin}/?game=${crypto.randomUUID().slice(0, 10)}`, log: data.log };
    },
  );

export const floors = (mesh: measure.Mesh, size: { width: number; depth: number; height: number }): Floor[] =>
  orFakeNow(
    () => measure.floors(mesh, size),
    // Stand-in: one floor across the top of a piece whose top is flat, which boxes and cylinders are.
    () => {
      const p = mesh.positions;
      let top = -Infinity;
      for (let i = 1; i < p.length; i += 3) top = Math.max(top, p[i]!);
      let atTop = 0;
      for (let i = 1; i < p.length; i += 3) if (Math.abs(p[i]! - top) < 1e-4) atTop++;
      if (atTop < 3) return [];
      const w = size.width / 2;
      const d = size.depth / 2;
      return [
        {
          height: size.height,
          outline: [
            { x: -w, y: -d },
            { x: w, y: -d },
            { x: w, y: d },
            { x: -w, y: d },
          ],
        },
      ];
    },
  );

export type Spot = measure.Spot;

export const distance = (table: Table, from: Spot, to: Spot, via: Point[] = []): { across: number; up: number } =>
  orFakeNow(
    () => measure.distance(table, from, to, via),
    // Stand-in: straight lines between centres, less the bases' radii at the ends.
    () => {
      const at = (s: Spot): { p: Point; r: number; h: number } => {
        if ("x" in s) return { p: s, r: 0, h: 0 };
        const models = Object.values(table.models).filter((m) => ("model" in s ? m.id === s.model : m.unit === s.unit));
        const m = models[0];
        if (!m) throw new Error("No such model");
        const floor = m.floor ? (table.terrain[m.floor.terrain]?.floors[m.floor.floor]?.height ?? 0) : 0;
        return { p: m.position, r: (m.base.width + m.base.depth) / 4 / 25.4, h: floor };
      };
      const a = at(from);
      const b = at(to);
      const points = [a.p, ...via, b.p];
      let across = 0;
      for (let i = 1; i < points.length; i++) across += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
      across = Math.max(0, across - a.r - b.r);
      return { across: Math.round(across * 100) / 100, up: Math.round((b.h - a.h) * 100) / 100 };
    },
  );
