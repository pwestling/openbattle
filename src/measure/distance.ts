// Distances base edge to base edge. Every base is a convex outline grown by a radius: a round base
// is its centre grown by its radius, a point is itself, and other bases are their corners.
import type { Point, Spot, TableShape } from "./index.ts";

const mmPerInch = 25.4;
/** Sides of the outline an oval base is measured as: closer than a thousandth of an inch to the true oval. */
const ovalSides = 256;

interface Body {
  outline: Point[];
  radius: number;
  height: number;
}

type Model = TableShape["models"][string];

/** A table's own entry for an id; never something every object inherits, such as "toString". */
const own = <T>(record: Record<string, T>, id: string): T | undefined => (Object.hasOwn(record, id) ? record[id] : undefined);

/** The length of a vector. Square roots are exact in every browser, unlike Math.hypot. */
const length = (x: number, y: number) => Math.sqrt(x * x + y * y);

/**
 * The cosine and sine of an angle in degrees, worked out with only adding and multiplying, which
 * give the same results in every browser, unlike Math.cos and Math.sin. Whole quarter turns are exact.
 */
function turnOf(degrees: number): { cos: number; sin: number } {
  let d = degrees % 360;
  if (d < 0) d += 360;
  let quarter = Math.floor(d / 90);
  let rest = d - quarter * 90;
  if (rest > 45) {
    rest -= 90;
    quarter += 1;
  }
  const x = (rest * Math.PI) / 180;
  const x2 = x * x;
  // Taylor series to x^15 and x^14: for |x| up to π/4 the next terms are below 1e-16.
  const s = x * (1 - (x2 / 6) * (1 - (x2 / 20) * (1 - (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - (x2 / 156) * (1 - x2 / 210)))))));
  const c = 1 - (x2 / 2) * (1 - (x2 / 12) * (1 - (x2 / 30) * (1 - (x2 / 56) * (1 - (x2 / 90) * (1 - (x2 / 132) * (1 - x2 / 182))))));
  switch (quarter % 4) {
    case 0:
      return { cos: c, sin: s };
    case 1:
      return { cos: -s, sin: c };
    case 2:
      return { cos: -c, sin: -s };
    default:
      return { cos: s, sin: -c };
  }
}

function heightOf(table: TableShape, model: Model): number {
  const floor = model.floor;
  return floor ? (own(table.terrain, floor.terrain)?.floors[floor.floor]?.height ?? 0) : 0;
}

function bodyOf(table: TableShape, model: Model): Body {
  const { position: c, facing, base } = model;
  const { cos, sin } = turnOf(facing);
  // Facing turns clockwise from +y: a model's right is +x when it faces +y.
  const place = (across: number, ahead: number): Point => ({
    x: c.x + across * cos + ahead * sin,
    y: c.y - across * sin + ahead * cos,
  });
  const w = base.width / mmPerInch / 2;
  const d = base.depth / mmPerInch / 2;
  const height = heightOf(table, model);
  if (base.shape === "round") return { outline: [{ x: c.x, y: c.y }], radius: w, height };
  if (base.shape === "rect") return { outline: [place(-w, -d), place(w, -d), place(w, d), place(-w, d)], radius: 0, height };
  const outline = Array.from({ length: ovalSides }, (_, i) => {
    const a = turnOf((360 * i) / ovalSides);
    return place(w * a.cos, d * a.sin);
  });
  return { outline, radius: 0, height };
}

function modelOf(table: TableShape, id: string): Model {
  const model = own(table.models, id);
  if (!model) throw new Error(`There is no model "${id}".`);
  if (model.aside) throw new Error(`Model "${id}" is set aside.`);
  return model;
}

/** The bodies a spot could be measured from: one, or every model of a unit on the table. */
function bodiesOf(table: TableShape, spot: Spot): Body[] {
  if ("model" in spot) return [bodyOf(table, modelOf(table, spot.model))];
  if ("unit" in spot) {
    const ids = Object.keys(table.models)
      .filter((id) => table.models[id]!.unit === spot.unit)
      .sort();
    const on = ids.filter((id) => !table.models[id]!.aside);
    if (ids.length === 0) throw new Error(`There is no unit "${spot.unit}" with models.`);
    if (on.length === 0) throw new Error(`Every model of unit "${spot.unit}" is set aside.`);
    return on.map((id) => bodyOf(table, table.models[id]!));
  }
  return [{ outline: [{ x: spot.x, y: spot.y }], radius: 0, height: 0 }];
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return length(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The outline, starting from its lowest corner (then leftmost), as the merge below needs. */
function fromLowest(outline: Point[]): Point[] {
  let lowest = 0;
  outline.forEach((p, i) => {
    const l = outline[lowest]!;
    if (p.y < l.y || (p.y === l.y && p.x < l.x)) lowest = i;
  });
  return [...outline.slice(lowest), ...outline.slice(0, lowest)];
}

/** Every a - b for a in one convex outline and b in another: a convex outline, anticlockwise like both. */
function difference(a: Point[], b: Point[]): Point[] {
  const p = fromLowest(a);
  const q = fromLowest(b.map((v) => ({ x: -v.x, y: -v.y })));
  if (p.length === 1 || q.length === 1) {
    const [one, many] = p.length === 1 ? [p[0]!, q] : [q[0]!, p];
    return many.map((v) => ({ x: v.x + one.x, y: v.y + one.y }));
  }
  const result: Point[] = [];
  let i = 0;
  let j = 0;
  while (i < p.length || j < q.length) {
    const pi = p[i % p.length]!;
    const qj = q[j % q.length]!;
    result.push({ x: pi.x + qj.x, y: pi.y + qj.y });
    const pn = p[(i + 1) % p.length]!;
    const qn = q[(j + 1) % q.length]!;
    const turn = cross({ x: 0, y: 0 }, { x: pn.x - pi.x, y: pn.y - pi.y }, { x: qn.x - qj.x, y: qn.y - qj.y });
    if (turn >= 0 && i < p.length) i++;
    if (turn <= 0 && j < q.length) j++;
  }
  return result;
}

/** The gap between two convex outlines; zero where they touch or overlap. */
function outlineGap(a: Point[], b: Point[]): number {
  const d = difference(a, b);
  const origin = { x: 0, y: 0 };
  if (d.length === 1) return length(d[0]!.x, d[0]!.y);
  let gap = Infinity;
  let within = true;
  for (let i = 0; i < d.length; i++) {
    const p = d[i]!;
    const q = d[(i + 1) % d.length]!;
    if (cross(p, q, origin) < 0) within = false;
    gap = Math.min(gap, pointToSegment(origin, p, q));
  }
  return within ? 0 : gap;
}

const gap = (a: Body, b: Body) => Math.max(0, outlineGap(a.outline, b.outline) - a.radius - b.radius);

/** The body among several closest to another, the first by model id on a tie. */
function closest(bodies: Body[], to: Body): Body {
  let best = bodies[0]!;
  let bestGap = gap(best, to);
  for (const body of bodies.slice(1)) {
    const g = gap(body, to);
    if (g < bestGap) [best, bestGap] = [body, g];
  }
  return best;
}

const hundredths = (n: number) => Math.round(n * 100) / 100 + 0;

export function measure(table: TableShape, from: Spot, to: Spot, via: Point[] = []): { across: number; up: number } {
  const starts = bodiesOf(table, from);
  const ends = bodiesOf(table, to);
  let start: Body;
  let end: Body;
  let across: number;
  if (via.length === 0) {
    [start, end] = [starts[0]!, ends[0]!];
    across = gap(start, end);
    for (const s of starts) {
      for (const e of ends) {
        const g = gap(s, e);
        if (g < across) [start, end, across] = [s, e, g];
      }
    }
  } else {
    const first: Body = { outline: [via[0]!], radius: 0, height: 0 };
    const last: Body = { outline: [via[via.length - 1]!], radius: 0, height: 0 };
    start = closest(starts, first);
    end = closest(ends, last);
    across = gap(start, first) + gap(last, end);
    for (let i = 1; i < via.length; i++) across += length(via[i]!.x - via[i - 1]!.x, via[i]!.y - via[i - 1]!.y);
  }
  return { across: hundredths(across), up: hundredths(end.height - start.height) };
}
