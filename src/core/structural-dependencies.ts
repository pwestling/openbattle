import type { GameEvent } from "./actions";
import type { GameRecord } from "./log";
import { applyEvent } from "./reducer";
import type { EntityRef } from "./types";
import type { Card } from "./cards";

/** Engine-owned references only: package JSON, quantities, tags and modifier source labels are opaque. */
export function structuralDependencies(
  record: GameRecord,
  undone: ReadonlySet<number>,
): Map<number, Set<number>> {
  const dependencies = new Map<number, Set<number>>();
  const identities = new Map<string, Set<number>>();
  const memberships = new Map<string, Set<number>>();
  const secrets = new Map<string, Set<number>>();
  const runs = new Map<number, number>();
  const absent = new Map<string, Set<number>>();
  const collectionChanges = new Map<string, Set<number>>();
  let state = record.initial;
  const identity = (kind: string, id: string) => `${kind}:${id}`;
  const secret = (player: string, key: string) => JSON.stringify([player, key]);

  for (const logged of record.events) {
    if (undone.has(logged.seq) || logged.event.type === "undo") continue;
    const seq = logged.seq;
    const needs = new Set<number>();
    dependencies.set(seq, needs);
    const read = (providers: Set<number> | undefined) => {
      for (const provider of providers ?? []) if (provider !== seq) needs.add(provider);
    };
    const readId = (kind: string, id: string) => read(identities.get(identity(kind, id)));
    const provide = (kind: string, id: string) => identities.set(identity(kind, id), new Set([seq]));
    const forget = (kind: string, id: string) => identities.delete(identity(kind, id));
    const owner = (player: unknown) => {
      if (typeof player === "string") readId("player", player);
    };
    const ref = (target: EntityRef) => {
      readId(target.kind, target.id);
      if (target.kind === "model") {
        read(memberships.get(identity("model", target.id)));
        const unit = state.models[target.id]?.unitId;
        if (unit) readId("unit", unit);
      }
    };
    const members = (id: string) => {
      ref({ kind: "unit", id });
      for (const model of Object.values(state.models))
        if (model.unitId === id) ref({ kind: "model", id: model.id });
    };
    const cardOwners = (card: Partial<Card>) => {
      owner(card.owner);
      if (Array.isArray(card.visibility)) for (const player of card.visibility) owner(player);
    };
    const cardRef = (id: string) => {
      readId("card", id);
      read(memberships.get(identity("card", id)));
      for (const collection of Object.values(state.cardCollections))
        if (collection.cards.includes(id)) readId("collection", collection.id);
    };
    const changeCollection = (id: string) => {
      const changes = collectionChanges.get(id);
      if (changes) changes.add(seq);
      else collectionChanges.set(id, new Set([seq]));
    };
    const visit = (event: GameEvent): void => {
      switch (event.type) {
        case "macro/step": {
          const previous = runs.get(event.run);
          if (previous !== undefined && previous !== seq) needs.add(previous);
          if (event.cause !== undefined) needs.add(event.cause);
          owner(event.by);
          if (!event.started && state.macro) {
            owner(state.macro.by);
            for (const player of Object.values(state.macro.identities ?? {})) owner(player);
            const waiting = state.macro.waiting;
            if (waiting) {
              owner(waiting.player);
              if ("reveal" in waiting && waiting.reveal !== undefined)
                read(secrets.get(secret(waiting.player, waiting.reveal)));
            }
          }
          readId("composition", "system");
          readId("composition", "packages");
          for (const inner of event.events) visit(inner);
          if (event.script) {
            owner(event.script.by);
            for (const player of Object.values(event.script.identities ?? {})) owner(player);
            const waiting = event.script.waiting;
            if (waiting) {
              owner(waiting.player);
              if ("reveal" in waiting && waiting.reveal !== undefined)
                read(secrets.get(secret(waiting.player, waiting.reveal)));
            }
          }
          runs.set(event.run, seq);
          state = { ...state, macro: event.script };
          return;
        }
        case "player/join":
          // A repeated join preserves the recorded seat and therefore requires the old player.
          if (event.player.seat === undefined && state.players[event.player.id]?.seat !== undefined)
            readId("player", event.player.id);
          provide("player", event.player.id);
          break;
        case "player/claim": {
          ref({ kind: "player", id: event.player });
          // Claims rename existing identities; secret commitments still require their original commit.
          for (const key of Object.keys(state.secrets?.[event.player] ?? {})) {
            const oldKey = secret(event.player, key);
            secrets.set(secret(event.by, key), new Set([...(secrets.get(oldKey) ?? []), seq]));
            secrets.delete(oldKey);
          }
          forget("player", event.player);
          provide("player", event.by);
          break;
        }
        case "player/set":
          ref({ kind: "player", id: event.player });
          break;
        case "game/system":
          provide("composition", "system");
          break;
        case "game/packages":
          provide("composition", "packages");
          break;
        case "layout/set":
          for (const token of Object.values(state.tokens)) forget("token", token.id);
          for (const piece of state.terrain) forget("terrain", piece.id);
          for (const token of event.layout.tokens) {
            owner(token.owner);
            provide("token", token.id);
          }
          for (const piece of event.layout.terrain) provide("terrain", piece.id);
          if (event.layout.cards && event.layout.cardCollections) {
            for (const card of Object.values(state.cards)) {
              forget("card", card.id);
              memberships.delete(identity("card", card.id));
              absent.set(identity("card", card.id), new Set([seq]));
            }
            for (const collection of Object.values(state.cardCollections)) {
              forget("collection", collection.id);
              absent.set(identity("collection", collection.id), new Set([seq]));
              collectionChanges.delete(collection.id);
            }
            for (const card of event.layout.cards) {
              cardOwners(card);
              provide("card", card.id);
              memberships.set(identity("card", card.id), new Set([seq]));
              absent.delete(identity("card", card.id));
            }
            for (const collection of event.layout.cardCollections) {
              provide("collection", collection.id);
              absent.delete(identity("collection", collection.id));
              collectionChanges.set(collection.id, new Set([seq]));
            }
          }
          break;
        case "terrain/add":
        case "terrain/update":
          provide("terrain", event.piece.id);
          break;
        case "terrain/remove":
          readId("terrain", event.id);
          forget("terrain", event.id);
          break;
        case "unit/add": {
          owner(event.unit.owner);
          const incoming = new Set(event.models.map((model) => model.id));
          for (const model of Object.values(state.models))
            if (!incoming.has(model.id) && model.unitId === event.unit.id)
              memberships.set(identity("model", model.id), new Set([seq]));
          provide("unit", event.unit.id);
          for (const model of event.models) {
            owner(model.owner);
            provide("model", model.id);
            memberships.set(identity("model", model.id), new Set([seq]));
          }
          break;
        }
        case "unit/remove":
          members(event.id);
          for (const model of Object.values(state.models))
            if (model.unitId === event.id) {
              forget("model", model.id);
              memberships.delete(identity("model", model.id));
            }
          forget("unit", event.id);
          break;
        case "unit/members":
          ref({ kind: "unit", id: event.id });
          for (const id of [...(event.remove ?? []), ...(event.add ?? [])]) ref({ kind: "model", id });
          for (const id of event.remove ?? [])
            if (state.models[id]?.unitId === event.id) memberships.set(identity("model", id), new Set([seq]));
          for (const id of event.add ?? []) memberships.set(identity("model", id), new Set([seq]));
          break;
        case "model/add":
          owner(event.model.owner);
          if (event.model.unitId) readId("unit", event.model.unitId);
          provide("model", event.model.id);
          memberships.set(identity("model", event.model.id), new Set([seq]));
          break;
        case "model/remove":
          ref({ kind: "model", id: event.id });
          forget("model", event.id);
          memberships.delete(identity("model", event.id));
          break;
        case "token/add":
          owner(event.token.owner);
          provide("token", event.token.id);
          break;
        case "token/remove":
          ref({ kind: "token", id: event.id });
          forget("token", event.id);
          break;
        case "entity/set":
          ref(event.ref);
          if (event.ref.kind !== "player") owner(event.set.owner);
          break;
        case "q/set":
        case "q/adjust":
        case "tag/set":
          ref(event.ref);
          break;
        case "models/move":
          for (const move of event.moves) ref({ kind: "model", id: move.id });
          break;
        case "unit/move":
          members(event.id);
          break;
        case "mod/add":
          ref(event.mod.target);
          provide("mod", event.mod.id);
          break;
        case "mod/remove":
          for (const mod of state.mods)
            if (
              (event.id !== undefined && mod.id === event.id) ||
              (event.source !== undefined && mod.source === event.source)
            ) {
              readId("mod", mod.id);
              ref(mod.target);
              forget("mod", mod.id);
            }
          break;
        case "secret/commit":
          owner(event.player);
          for (const entry of event.secrets)
            if (!state.secrets?.[event.player]?.[entry.key])
              secrets.set(secret(event.player, entry.key), new Set([seq]));
          break;
        case "secret/reveal":
          owner(event.player);
          read(secrets.get(secret(event.player, event.key)));
          break;
        case "collection/add":
          read(absent.get(identity("collection", event.collection.id)));
          absent.delete(identity("collection", event.collection.id));
          collectionChanges.set(event.collection.id, new Set([seq]));
          for (const id of event.collection.cards) cardRef(id);
          provide("collection", event.collection.id);
          for (const id of event.collection.cards) memberships.set(identity("card", id), new Set([seq]));
          break;
        case "collection/remove":
          readId("collection", event.id);
          read(collectionChanges.get(event.id));
          absent.set(identity("collection", event.id), new Set([seq]));
          collectionChanges.delete(event.id);
          forget("collection", event.id);
          break;
        case "card/add":
          cardOwners(event.card);
          readId("collection", event.collection);
          read(absent.get(identity("card", event.card.id)));
          absent.delete(identity("card", event.card.id));
          if (event.index !== undefined)
            for (const id of state.cardCollections[event.collection]?.cards.slice(0, event.index) ?? [])
              cardRef(id);
          changeCollection(event.collection);
          provide("card", event.card.id);
          memberships.set(identity("card", event.card.id), new Set([seq]));
          break;
        case "cards/remove":
          for (const collection of Object.values(state.cardCollections))
            if (collection.cards.some((id) => event.cards.includes(id))) changeCollection(collection.id);
          for (const id of event.cards) {
            cardRef(id);
            forget("card", id);
            memberships.delete(identity("card", id));
            absent.set(identity("card", id), new Set([seq]));
          }
          break;
        case "cards/move":
          readId("collection", event.to);
          for (const id of event.cards) cardRef(id);
          if (event.index !== undefined) {
            const remaining =
              state.cardCollections[event.to]?.cards.filter((id) => !event.cards.includes(id)) ?? [];
            for (const id of remaining.slice(0, event.index)) cardRef(id);
          }
          for (const collection of Object.values(state.cardCollections))
            if (collection.cards.some((id) => event.cards.includes(id))) changeCollection(collection.id);
          changeCollection(event.to);
          for (const id of event.cards) memberships.set(identity("card", id), new Set([seq]));
          break;
        case "card/set":
          cardRef(event.card);
          cardOwners(event.set);
          break;
        case "collection/shuffle":
          readId("collection", event.collection);
          read(collectionChanges.get(event.collection));
          for (const id of event.order) cardRef(id);
          break;
        case "dice/roll":
          owner(event.roll.by);
          break;
        case "pointer/set":
        case "module/set":
        case "log/note":
        case "player/resync":
        case "game/branch":
        case "undo":
          break;
      }
      state = applyEvent(state, event);
    };
    visit(logged.event);
    for (const reaction of logged.reactions ?? []) owner(reaction.by);
    state = { ...state, seq };
  }
  return dependencies;
}
