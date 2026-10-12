import { Html } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  RepeatWrapping,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { type TerrainPiece, type Vec2 } from "../core";
import { OBJECTIVE_MARKER_MM, OBJECTIVE_RANGE } from "../systems/wh40k/rules";
import { TerrainModel } from "./TerrainModel";
import { useAssets } from "../assets/store";
import { LABEL_Z } from "./boardLabels";

/** The table itself: its grid, deployment zones, terrain pieces and objective markers. */

/** One line per inch, a brighter line every 6". */
export function InchGrid({ width, depth }: { width: number; depth: number }) {
  const [minor, major] = useMemo(() => {
    const lines: [number[], number[]] = [[], []];
    for (let x = 0; x <= width; x++) {
      lines[x % 6 === 0 ? 1 : 0].push(x - width / 2, 0, -depth / 2, x - width / 2, 0, depth / 2);
    }
    for (let z = 0; z <= depth; z++) {
      lines[z % 6 === 0 ? 1 : 0].push(-width / 2, 0, z - depth / 2, width / 2, 0, z - depth / 2);
    }
    return lines.map((l) => new Float32Array(l));
  }, [width, depth]);

  return (
    <group position-y={0.01}>
      <lineSegments raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[minor!, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#56653f" />
      </lineSegments>
      <lineSegments raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[major!, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#77895c" />
      </lineSegments>
    </group>
  );
}

export function ZoneShape({ points, color }: { points: Vec2[]; color: string }) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, 0.015, (y0 + y1) / 2]} raycast={() => null}>
      <planeGeometry args={[x1 - x0, y1 - y0]} />
      <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
    </mesh>
  );
}

/** Diagonal stripes, for obscuring footprints. */
let hatch: CanvasTexture | null = null;
function hatchTexture(): CanvasTexture {
  if (hatch) return hatch;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.lineWidth = 6;
  for (const o of [-32, 0, 32]) {
    g.beginPath();
    g.moveTo(o, 32);
    g.lineTo(o + 32, 0);
    g.stroke();
  }
  hatch = new CanvasTexture(c);
  hatch.wrapS = hatch.wrapT = RepeatWrapping;
  return hatch;
}

/**
 * A mottled felt for the table (ui-next, Jobs review: "the green needs texture, not a grid"): soft light
 * and dark blots tinted by the material's colour, one tile every foot. Drawn once per table size.
 */
const felts = new Map<string, CanvasTexture>();
export function feltTexture(width: number, depth: number): CanvasTexture {
  const key = `${width}x${depth}`;
  const kept = felts.get(key);
  if (kept) return kept;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d8d8d8";
  g.fillRect(0, 0, 256, 256);
  // A fixed sequence, so every screen's felt looks the same.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 900; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 4 + rand() * 22;
    const light = rand() > 0.5;
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, light ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)");
    blot.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = blot;
    // Drawn again across each edge it crosses, so the tile repeats without a seam.
    for (const dx of [-256, 0, 256])
      for (const dy of [-256, 0, 256]) {
        g.setTransform(1, 0, 0, 1, dx, dy);
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  const felt = new CanvasTexture(c);
  felt.wrapS = felt.wrapT = RepeatWrapping;
  felt.repeat.set(width / 12, depth / 12);
  felts.set(key, felt);
  return felt;
}

const FOOTPRINT_COLORS = { open: "#e5e7eb", obscuring: "#facc15", blocking: "#ef4444" };

/** Footprint line of sight: clear outline for open, stripes for obscuring, solid for blocking. */
function FootprintTint({
  width,
  depth,
  kind,
  strong,
}: {
  width: number;
  depth: number;
  kind: "open" | "obscuring" | "blocking";
  strong: boolean;
}) {
  const map = useMemo(() => {
    if (kind !== "obscuring") return null;
    const t = hatchTexture().clone();
    t.repeat.set(width / 1.5, depth / 1.5);
    t.needsUpdate = true;
    return t;
  }, [kind, width, depth]);
  const outline = useMemo(() => {
    const [w, d] = [width / 2, depth / 2];
    return new Float32Array([-w, 0, -d, w, 0, -d, w, 0, -d, w, 0, d, w, 0, d, -w, 0, d, -w, 0, d, -w, 0, -d]);
  }, [width, depth]);
  const color = FOOTPRINT_COLORS[kind];
  return (
    <group position-y={0.05}>
      {kind !== "open" && (
        <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial
            color={color}
            {...(map ? { map } : {})}
            transparent
            opacity={(kind === "blocking" ? 0.35 : 0.5) * (strong ? 1.6 : 1)}
            depthWrite={false}
          />
        </mesh>
      )}
      <lineSegments raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outline, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} />
      </lineSegments>
    </group>
  );
}

const CATEGORY_COLORS: Record<TerrainPiece["category"], string> = {
  exposed: "#6f6450",
  light: "#6b6257",
  dense: "#3d5a32",
  solid: "#4b4b52",
  // Other games' categories.
  open: "#6f6450",
  broken: "#6f6450",
  traversable: "#6b6257",
  obscuring: "#3d5a32",
  blocking: "#4b4b52",
};

export function Terrain({
  piece,
  xray,
  editable,
  selected,
  standIn,
  footprint,
  grouped,
  onDown,
}: {
  piece: TerrainPiece;
  xray: boolean;
  editable: boolean;
  selected: boolean;
  /** Stand-in height to draw as a see-through block, in "heights" line of sight. */
  standIn: number | null;
  /** Sight class to tint the footprint with, in "footprint" line of sight. */
  footprint: "open" | "obscuring" | "blocking" | null;
  grouped?: boolean;
  onDown: (shift: boolean) => void;
}) {
  const handlers = editable
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          onDown(e.shiftKey);
        },
        onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
      }
    : { raycast: () => null };
  // An uploaded model replaces the solids' boxes once its meshes are here; until then the boxes stand in.
  const model = useAssets((a) => (piece.mesh ? a.assets[piece.mesh.asset] : undefined));
  return (
    <group position={[piece.position.x, 0, piece.position.y]} rotation-y={piece.facing}>
      {model && (
        <TerrainModel
          asset={model}
          scale={piece.mesh!.scale}
          xray={xray}
          selected={selected}
          handlers={handlers}
        />
      )}
      {standIn !== null && standIn > 0 && (
        <mesh position-y={standIn / 2} raycast={() => null}>
          <boxGeometry args={[piece.width, standIn, piece.depth]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      )}
      {footprint && <FootprintTint width={piece.width} depth={piece.depth} kind={footprint} strong={xray} />}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow {...handlers}>
        <planeGeometry args={[piece.width, piece.depth]} />
        <meshStandardMaterial
          color={selected ? "#a16207" : grouped ? "#7c3aed" : (CATEGORY_COLORS[piece.category] ?? "#6b6257")}
          transparent
          opacity={0.8}
        />
      </mesh>
      {!model && <TerrainSolids piece={piece} xray={xray} handlers={handlers} />}
      {selected && (
        <Html zIndexRange={LABEL_Z} position={[0, 0.5, 0]} center className="ruler terrain-label">
          {piece.name} · {piece.category}
        </Html>
      )}
    </group>
  );
}

/** A solid's colour on a piece drawn without its own model. */
function solidColor(piece: TerrainPiece, kind: string): string {
  if (kind === "floor") return "#9a8f80";
  if (kind === "block") return piece.name === "Hill" ? "#5f6e45" : "#7a5c3c";
  return "#8a8178";
}

const solidColour = new Color();

/** Each part translated into place and painted one colour, for merging. */
function painted(g: BufferGeometry, color: string, x: number, y: number, z: number): BufferGeometry {
  const part = g.translate(x, y, z).toNonIndexed();
  g.dispose();
  solidColour.set(color);
  const count = part.attributes.position!.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) solidColour.toArray(colors, i * 3);
  part.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return part;
}

function merged(parts: BufferGeometry[]): BufferGeometry | null {
  if (!parts.length) return null;
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

/**
 * A piece's walls, floors and blocks as one mesh, and its trees as a trunk mesh and a
 * canopy mesh: a few draws (and shadow draws) a piece, not one per solid. A table of
 * template terrain is dozens of solids, and the table's shadows reach all of them.
 */
function TerrainSolids({ piece, xray, handlers }: { piece: TerrainPiece; xray: boolean; handlers: object }) {
  const { solids, trunks, canopies } = useMemo(() => {
    const boxes: BufferGeometry[] = [];
    const trunks: BufferGeometry[] = [];
    const canopies: BufferGeometry[] = [];
    for (const s of piece.solids) {
      if (s.kind === "foliage") {
        trunks.push(painted(new CylinderGeometry(0.15, 0.2, 1.2, 8), "#5b4630", s.x, s.z + 0.6, s.y));
        canopies.push(
          painted(new ConeGeometry(s.w / 2, s.h - 1.2, 10), "#2f5d2a", s.x, s.z + 1.2 + (s.h - 1.2) / 2, s.y),
        );
      } else
        boxes.push(
          painted(new BoxGeometry(s.w, s.h, s.d), solidColor(piece, s.kind), s.x, s.z + s.h / 2, s.y),
        );
    }
    return { solids: merged(boxes), trunks: merged(trunks), canopies: merged(canopies) };
  }, [piece]);
  useEffect(() => () => [solids, trunks, canopies].forEach((g) => g?.dispose()), [solids, trunks, canopies]);
  return (
    <>
      {solids && (
        <mesh geometry={solids} castShadow={!xray} receiveShadow {...handlers}>
          <meshStandardMaterial vertexColors transparent opacity={xray ? 0.2 : 0.95} depthWrite={!xray} />
        </mesh>
      )}
      {trunks && (
        <mesh geometry={trunks} raycast={() => null}>
          <meshStandardMaterial vertexColors />
        </mesh>
      )}
      {canopies && (
        <mesh geometry={canopies} castShadow raycast={() => null}>
          <meshStandardMaterial vertexColors transparent opacity={xray ? 0.25 : 1} />
        </mesh>
      )}
    </>
  );
}

export function ObjectiveMarker({
  position,
  color,
  onDown,
  onHover,
}: {
  position: Vec2;
  color: string;
  onDown?: () => void;
  /** The pointer over it, or gone: who controls it, and the OC on each side (UX 84 §7). */
  onHover?: (on: boolean) => void;
}) {
  const r = OBJECTIVE_MARKER_MM / 25.4 / 2;
  const hover = onHover
    ? {
        onPointerOver: () => onHover(true),
        onPointerOut: () => onHover(false),
      }
    : {};
  return (
    <group position={[position.x, 0, position.y]}>
      <mesh
        position-y={0.05}
        {...hover}
        {...(onDown
          ? {
              onPointerDown: (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onDown();
              },
              onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
            }
          : onHover
            ? {}
            : { raycast: () => null })}
      >
        <cylinderGeometry args={[r, r, 0.1, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03} raycast={() => null}>
        <ringGeometry args={[r + OBJECTIVE_RANGE - 0.08, r + OBJECTIVE_RANGE, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
