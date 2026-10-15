// The decks panel: make a deck from a typed or pasted list of cards, with optional pictures,
// ordered as listed or shuffled; shuffle an ordered deck; draw. Drawing is also done by
// clicking a deck on the table.
import { useState } from "react";
import type { Deck, Fingerprint, NewCard } from "../../record/index.ts";
import { edgeOf, usePlay } from "../play.tsx";

/** One card per line: a name, then optionally a colon and its text. */
function readCards(text: string): { name: string; text?: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const at = l.indexOf(":");
      if (at < 0) return { name: l };
      const rest = l.slice(at + 1).trim();
      return rest ? { name: l.slice(0, at).trim(), text: rest } : { name: l.slice(0, at).trim() };
    });
}

export function DecksPanel() {
  const { table, me, readOnly, act, newId, session, note } = usePlay();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<"me" | "game">("game");
  const [order, setOrder] = useState<"ordered" | "shuffled">("shuffled");
  const [list, setList] = useState("");
  const [pictures, setPictures] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const decks = Object.values(table.decks);

  const add = async () => {
    setBusy(true);
    try {
      // Pictures go to the cards in the order they are listed.
      const prints: Fingerprint[] = [];
      for (const p of pictures) prints.push(await session.addFile(p));
      const cards: NewCard[] = readCards(list).map((c, i) => ({ id: newId(), ...c, ...(prints[i] ? { picture: prints[i] } : {}) }));
      const k = decks.length;
      const edge = edgeOf(table, me);
      const ok = await act({
        kind: "add deck",
        deck: newId(),
        name: name.trim(),
        owner: owner === "me" ? me : null,
        order,
        cards,
        // Decks lie just off the table along your edge, side by side.
        position: { x: table.size.width / 2 - 14 + (k % 4) * 7, y: edge > 0 ? table.size.depth + 3 : edge < 0 ? -3 : table.size.depth / 2 },
      });
      if (ok) {
        setName("");
        setList("");
        setPictures([]);
      }
    } catch (e) {
      note(e instanceof Error ? e.message : "The deck could not be added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="decks" aria-label="Decks">
      {!readOnly && (
        <details className="add-deck" open={decks.length === 0}>
          <summary>New deck</summary>
          <label>
            Deck name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Cards, one per line (Name: text)
            <textarea
              rows={5}
              value={list}
              placeholder={"Ambush: Deploy one unit anywhere.\nSecure the centre"}
              onChange={(e) => setList(e.target.value)}
            />
          </label>
          <label className="file">
            Pictures, in the order of the cards (optional)
            <input type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setPictures([...(e.target.files ?? [])])} />
          </label>
          <fieldset className="choice">
            <label>
              <input type="radio" checked={order === "shuffled"} onChange={() => setOrder("shuffled")} /> Shuffled
            </label>
            <label>
              <input type="radio" checked={order === "ordered"} onChange={() => setOrder("ordered")} /> Ordered as listed
            </label>
          </fieldset>
          <fieldset className="choice">
            <label>
              <input type="radio" checked={owner === "game"} onChange={() => setOwner("game")} /> The game's
            </label>
            <label>
              <input type="radio" checked={owner === "me"} onChange={() => setOwner("me")} /> Mine
            </label>
          </fieldset>
          <button disabled={busy || !name.trim() || !readCards(list).length} onClick={() => void add()}>
            Add deck
          </button>
        </details>
      )}
      {decks.map((d) => (
        <DeckRow key={d.id} deck={d} />
      ))}
      <p className="muted">Click a deck on the table to draw, Shift-click to draw face up. Drag cards to play them; F flips a card.</p>
    </section>
  );
}

function DeckRow({ deck }: { deck: Deck }) {
  const { table, act, readOnly, session, note } = usePlay();
  const draw = (to: "hand" | "table") => {
    if (deck.cards.length === 0) return note(`${deck.name} is empty.`);
    session.draw(deck.id, 1, to).catch((e: unknown) => note(e instanceof Error ? e.message : "No card could be drawn."));
  };
  const discarded = Object.values(table.cards).filter((c) => c.place.in === "discard" && c.place.deck === deck.id).length;
  return (
    <article className="deck" aria-label={deck.name}>
      <header>
        <strong>{deck.name}</strong>
        <span className="muted">
          {deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"}, {deck.order}
          {discarded > 0 && `, ${discarded} discarded`}
        </span>
      </header>
      {!readOnly && (
        <div className="row">
          <button onClick={() => draw("hand")}>Draw</button>
          <button onClick={() => draw("table")}>Draw face up</button>
          {deck.order === "ordered" && <button onClick={() => void act({ kind: "shuffle", deck: deck.id })}>Shuffle</button>}
        </div>
      )}
    </article>
  );
}
