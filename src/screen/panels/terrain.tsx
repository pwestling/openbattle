// The terrain panel: add a box, cylinder or ramp, or load a mesh file; size and remove pieces.
// Moving and turning a piece is done on the table, like a model.
import { useState } from "react";
import type { Floor, Shape, Terrain } from "../../record/index.ts";
import { usePlay } from "../play.tsx";
import { floors } from "../../measure/index.ts";
import { meshOf, readMesh, trianglesOf } from "../table/meshes.ts";
import { solidGeometry } from "../table/pieces.ts";

type Size = { width: number; depth: number; height: number };

/** The floors of a shape at a size, worked out once here so every browser keeps the same ones. */
async function floorsOf(shape: Shape): Promise<Floor[]> {
  if (shape.kind !== "mesh") return floors(trianglesOf(solidGeometry(shape)), shape);
  const mesh = await meshOf(shape.mesh);
  return mesh ? floors({ positions: mesh.positions }, shape) : [];
}

const round = (n: number) => Math.round(n * 100) / 100;

function SizeFields({ size, setSize }: { size: Size; setSize: (s: Size) => void }) {
  return (
    <div className="size-fields">
      {(["width", "depth", "height"] as const).map((k) => (
        <label key={k}>
          {k[0]!.toUpperCase() + k.slice(1)}
          <input type="number" min={0.1} step="any" value={size[k]} onChange={(e) => setSize({ ...size, [k]: Number(e.target.value) })} />
        </label>
      ))}
    </div>
  );
}

export function TerrainPanel() {
  const { table, act, readOnly, newId, session, note } = usePlay();
  const pieces = Object.values(table.terrain);
  const locked = pieces.filter((t) => t.locked).map((t) => t.id);
  const unlocked = pieces.filter((t) => !t.locked).map((t) => t.id);
  const [kind, setKind] = useState<"box" | "cylinder" | "ramp">("box");
  const [size, setSize] = useState<Size>({ width: 6, depth: 6, height: 3 });
  const [busy, setBusy] = useState(false);
  // New pieces go in a row across the middle of the table, so they don't land inside each other.
  const n = Object.keys(table.terrain).length;
  const centre = { x: table.size.width / 2 + (((n + 2) % 5) - 2) * 9, y: table.size.depth / 2 + (Math.floor(n / 5) % 3) * 9 };

  const place = async (name: string, shape: Shape) => {
    const terrain: Terrain = { id: newId(), name, shape, position: centre, facing: 0, floors: await floorsOf(shape) };
    return act({ kind: "place terrain", terrain });
  };

  const load = async (file: File) => {
    setBusy(true);
    try {
      const mesh = await readMesh(file);
      const fingerprint = await session.addFile(file);
      const n = mesh.natural;
      const shape: Shape = { kind: "mesh", mesh: fingerprint, width: round(n.width), depth: round(n.depth), height: round(n.height) };
      await place(file.name.replace(/\.[^.]+$/, ""), shape);
    } catch (e) {
      note(e instanceof Error ? e.message : "That mesh could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="terrain" aria-label="Terrain">
      {!readOnly && (
        <>
          <form
            className="add-terrain"
            onSubmit={(e) => {
              e.preventDefault();
              void place(kind[0]!.toUpperCase() + kind.slice(1), { kind, ...size });
            }}
          >
            <label>
              Shape
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="box">Box</option>
                <option value="cylinder">Cylinder</option>
                <option value="ramp">Ramp</option>
              </select>
            </label>
            <SizeFields size={size} setSize={setSize} />
            <button type="submit">Add terrain</button>
          </form>
          <label className="file">
            Load a mesh file (.glb, .gltf, .obj or .stl)
            <input
              type="file"
              accept=".glb,.gltf,.obj,.stl"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void load(file);
              }}
            />
          </label>
          <p className="muted">Drag a piece on the table to move it; Q and E turn it while carried.</p>
        </>
      )}
      {pieces.length > 0 && (
        <p>
          <button disabled={readOnly || unlocked.length === 0} onClick={() => void act({ kind: "lock terrain", terrain: unlocked, locked: true })}>
            Lock all
          </button>{" "}
          <button disabled={readOnly || locked.length === 0} onClick={() => void act({ kind: "lock terrain", terrain: locked, locked: false })}>
            Unlock all
          </button>
        </p>
      )}
      {Object.values(table.terrain).map((t) => (
        <Piece key={t.id} terrain={t} />
      ))}
    </section>
  );
}

function Piece({ terrain }: { terrain: Terrain }) {
  const { act, readOnly } = usePlay();
  const locked = !!terrain.locked;
  const [size, setSize] = useState<Size>({ width: terrain.shape.width, depth: terrain.shape.depth, height: terrain.shape.height });
  const changed = (["width", "depth", "height"] as const).some((k) => size[k] !== terrain.shape[k]);
  return (
    <article className="piece" aria-label={terrain.name}>
      <header>
        <strong>{terrain.name}</strong>
        <span className="muted">
          {terrain.shape.kind}, {terrain.floors.length === 1 ? "1 floor" : `${terrain.floors.length} floors`}
        </span>
        <button
          aria-pressed={locked}
          disabled={readOnly}
          title="A locked piece can't be picked up or selected on the table, by anyone."
          onClick={() => void act({ kind: "lock terrain", terrain: [terrain.id], locked: !locked })}
        >
          {locked ? "Unlock" : "Lock"}
        </button>
        {!readOnly && <button onClick={() => void act({ kind: "remove terrain", terrain: terrain.id })}>Remove</button>}
      </header>
      {!readOnly && (
        <>
          <SizeFields size={size} setSize={setSize} />
          {changed && (
            <button
              onClick={async () => {
                const shape = { ...terrain.shape, ...size };
                await act({ kind: "place terrain", terrain: { ...terrain, shape, floors: await floorsOf(shape) } });
              }}
            >
              Resize
            </button>
          )}
        </>
      )}
    </article>
  );
}
