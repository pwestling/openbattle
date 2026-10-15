// The army panel: each player's units and groups with their counters and marks, and adding to your army.
import { useState } from "react";
import type { Action, Group, Model, NewModel, PlayerId, Table, Unit } from "../../record/index.ts";
import { readArmyList, type ListedUnit } from "../army-list.ts";
import { edgeOf, usePlay } from "../play.tsx";
import { MM } from "../table/pieces.ts";
import { Counters } from "./counters.tsx";

export function ArmyPanel() {
  const { table, me, readOnly } = usePlay();
  return (
    <section className="army" aria-label="Armies">
      {me && !readOnly && <AddToArmy />}
      {Object.values(table.players).map((p) => (
        <section key={p.id} className="player" aria-label={`${p.name}'s army`}>
          <h3>
            <span className="dot" style={{ background: p.colour }} /> {p.name}
          </h3>
          <Counters target={p.id} />
          <Grouping owner={p.id} />
          {Object.values(table.units)
            .filter((u) => u.owner === p.id)
            .map((u) => (
              <UnitRow key={u.id} unit={u} />
            ))}
        </section>
      ))}
    </section>
  );
}

function UnitRow({ unit }: { unit: Unit }) {
  const { table, act, readOnly } = usePlay();
  const models = Object.values(table.models).filter((m) => m.unit === unit.id);
  const aside = models.filter((m) => m.aside);
  const onTable = models.filter((m) => !m.aside);
  return (
    <article className="unit" aria-label={unit.name}>
      <header>
        <strong>{unit.name}</strong>
        <span className="muted">
          {models.length} {models.length === 1 ? "model" : "models"}
          {aside.length > 0 && `, ${aside.length} set aside`}
        </span>
        {onTable.length > 0 && (
          <button disabled={readOnly} onClick={() => void act({ kind: "set aside", models: onTable.map((m) => m.id) })}>
            Set aside
          </button>
        )}
        {aside.length > 0 && (
          <button
            disabled={readOnly}
            onClick={() =>
              void act({
                kind: "return",
                models: aside.map((m) => ({ model: m.id, position: m.position, facing: m.facing, floor: m.floor })),
              })
            }
          >
            Return
          </button>
        )}
      </header>
      <Counters target={unit.id} />
    </article>
  );
}

/** Groups of a player's units: shown with their members, made from ticked units, and dissolved. */
function Grouping({ owner }: { owner: PlayerId }) {
  const { table, act, me, readOnly, newId } = usePlay();
  const groups = Object.values(table.groups).filter((g) => g.owner === owner);
  const units = Object.values(table.units).filter((u) => u.owner === owner);
  const [ticked, setTicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const nameOf = (id: string) => table.units[id]?.name ?? table.groups[id]?.name ?? "?";
  const mine = owner === me && !readOnly;
  return (
    <>
      {groups.map((g: Group) => (
        <article key={g.id} className="group" aria-label={g.name}>
          <header>
            <strong>{g.name}</strong>
            <span className="muted">{g.members.map(nameOf).join(", ")}</span>
            {mine && <button onClick={() => void act({ kind: "ungroup", group: g.id })}>Ungroup</button>}
          </header>
          <Counters target={g.id} />
        </article>
      ))}
      {mine && units.length + groups.length > 1 && (
        <details className="make-group">
          <summary>Make a group</summary>
          {[...units, ...groups].map((u: Unit | Group) => (
            <label key={u.id} className="tick">
              <input
                type="checkbox"
                checked={ticked.includes(u.id)}
                onChange={(e) => setTicked(e.target.checked ? [...ticked, u.id] : ticked.filter((t) => t !== u.id))}
              />
              {u.name}
            </label>
          ))}
          <label>
            Group name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            disabled={!name.trim() || ticked.length === 0}
            onClick={() =>
              void act({ kind: "group", group: newId(), name: name.trim(), members: ticked }).then((ok) => {
                if (!ok) return;
                setTicked([]);
                setName("");
              })
            }
          >
            Group
          </button>
        </details>
      )}
    </>
  );
}

function AddToArmy() {
  const { table, me, act, newId, note } = usePlay();
  const [text, setText] = useState("");
  const [listed, setListed] = useState<ListedUnit[] | null>(null);
  const [unread, setUnread] = useState<string[]>([]);
  const [open, setOpen] = useState(() => Object.values(table.units).every((u) => u.owner !== me));

  const add = async () => {
    if (!listed || !me) return;
    const action = armyAction(table, me, listed, newId);
    if (await act(action)) {
      setText("");
      setListed(null);
      setUnread([]);
    } else note("The army was not added.");
  };

  return (
    <details className="add-army" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Add to your army</summary>
      <label>
        Army list
        <textarea
          rows={5}
          value={text}
          placeholder={'5x Scouts 25mm\nCaptain 40mm 1.5"\n3x Bikers 60x35mm oval'}
          onChange={(e) => {
            setText(e.target.value);
            setListed(null);
          }}
        />
      </label>
      {!listed ? (
        <button
          disabled={!text.trim()}
          onClick={() => {
            const read = readArmyList(text);
            setListed(read.units);
            setUnread(read.unread);
          }}
        >
          Read list
        </button>
      ) : (
        <>
          <table className="listed">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Models</th>
                <th>Base</th>
                <th>Height</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((u, i) => (
                <tr key={i}>
                  <td>{u.name}</td>
                  <td>{u.count}</td>
                  <td>
                    {u.base.width === u.base.depth ? u.base.width : `${u.base.width}×${u.base.depth}`}mm {u.base.shape}
                  </td>
                  <td>{u.height}″</td>
                </tr>
              ))}
            </tbody>
          </table>
          {unread.length > 0 && <p className="problem">Couldn't read: {unread.join("; ")}</p>}
          <button disabled={listed.length === 0} onClick={() => void add()}>
            Add to army
          </button>
        </>
      )}
    </details>
  );
}

/**
 * The add to army action for a read list. A line naming one of your units adds models to it.
 * New models stand in rows along your table edge, beside what you already have there.
 */
function armyAction(table: Table, me: PlayerId, listed: ListedUnit[], newId: () => string): Action {
  const edge = edgeOf(table, me);
  const { width, depth } = table.size;
  const mine = Object.values(table.models).filter((m: Model) => table.units[m.unit]?.owner === me);
  let x = mine.length ? Math.max(...mine.map((m) => m.position.x)) + 2.5 : width / 2 - 8;
  let band = 0;
  const units: { id: string; name: string }[] = [];
  const models: (NewModel & { unit: string })[] = [];
  for (const u of listed) {
    const existing = Object.values(table.units).find((t) => t.owner === me && t.name.toLowerCase() === u.name.toLowerCase());
    const unit = existing?.id ?? newId();
    if (!existing) units.push({ id: unit, name: u.name });
    const sx = u.base.width * MM + 0.6;
    const sy = u.base.depth * MM + 0.6;
    const cols = Math.min(u.count, 5);
    if (x + cols * sx > width - 1) {
      x = 1;
      band += 7;
    }
    for (let i = 0; i < u.count; i++) {
      const across = x + (i % cols) * sx + sx / 2;
      const inward = 2 + band + Math.floor(i / cols) * sy + sy / 2;
      models.push({
        id: newId(),
        unit,
        name: u.name,
        base: u.base,
        height: u.height,
        position: { x: across, y: edge > 0 ? depth - inward : edge < 0 ? inward : depth / 2 - inward },
        facing: edge > 0 ? 180 : 0,
        floor: null,
      });
    }
    x += cols * sx + 1.5;
  }
  return { kind: "add to army", units, models, groups: [] };
}
