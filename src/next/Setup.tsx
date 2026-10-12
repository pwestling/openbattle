import { useEffect, useState } from "react";
import { useTtsNote } from "../tts/TtsNote";
import { openTts } from "../figures/open";
import { leadPairs } from "../ui/leading";
import { applyLayout } from "../tables/actions";
import { starterLayout, starters } from "../tables/starters";
import { sideName, sides, type GameRecord, type Player } from "../core";
import { formatList, t, tn } from "../i18n";
import { displayName } from "../i18n/names";
import { TablePicker } from "../tables/TableLibrary";
import { useCanControl, useJoining, useStore } from "../store";
import { ArmyImport } from "../ui/ArmyImport";
import { deployChecks } from "../ui/deployment";
import { EarlyNameCard, RejoinCard } from "../ui/Hud";
import { MissionPicker, missionOf } from "../ui/Missions";
import { copyInvite, DeployTray, RoomCard, useRoomWaiting } from "../ui/Room";
import { gameTitle } from "../ui/systemLabels";
import { pickUnit } from "./StepBar";
import { useInviteCopied } from "./start";
import { systemModule } from "../systems";
import { isPlaceholder } from "../core/content/systems";
import { EventSlot } from "./EventSlot";
import { useDeployed } from "../ui/shelfActions";
import { systemOf } from "../core/content/turn";
import { armyColor, spawnIntents } from "../systems/wh40k/deploy";

/**
 * The side's sample army straight onto the table, for each player without one. A game with a list of
 * armies (Rift Lanterns, Brinewatch, a package's) gives each side a different one, in the list's order.
 */
function sampleFor(players: Player[]): (() => void) | null {
  const { game } = useStore.getState();
  // Until the game's rules package is running there's no sample to give (a guest joining a package game).
  if (game.system && isPlaceholder(game.system)) return null;
  let mod;
  try {
    mod = systemModule(game.system);
    if (systemOf(game).unitShape.kind === "ranked") return null;
  } catch {
    return null;
  }
  const armies = mod.armies ?? [];
  return () => {
    for (const p of players) {
      const { game: now, dispatch } = useStore.getState();
      const seat = p.seat ?? 0;
      const roster = armies.length ? armies[seat % armies.length]! : mod.sample(seat === 1 ? 1 : 0);
      const prefix = `${p.id}-${crypto.randomUUID().slice(0, 6)}`;
      for (const intent of spawnIntents(now, p.id, roster.units, prefix, roster.name, false))
        dispatch(intent, p.id);
      // Deployed as the army picker deploys: it can go on the shelf, and an event checks it against the entry.
      useDeployed.setState({ [p.id]: { roster, prefix } });
      if (roster.army) dispatch({ type: "player/army", army: roster.army }, p.id);
      const color = armyColor(useStore.getState().game, p.id, roster.color);
      if (color) dispatch(color, p.id);
    }
  };
}

/** The last first-turn roll-off in the log, if any: one die a side. */
function lastRollOff(record: GameRecord): number[] | null {
  for (let i = record.events.length - 1; i >= 0; i--) {
    const e = record.events[i]!.event;
    if (e.type === "dice/roll" && e.roll.label === "first turn") return e.roll.results;
  }
  return null;
}

interface Line {
  id: string;
  title: string;
  done: boolean;
  /** Whose line it waits on, when it isn't this screen's. */
  waits?: string;
  note?: string;
}

/**
 * Before the battle (ui-next): the room's checklist on the left, in the order
 * it's done, and the step bar with the one lit button for the first line not
 * done. Invite, armies, table and mission, deployment, who goes first, start.
 * Armies that arrive already placed (a TTS save, a shelf army with positions)
 * skip straight to checking the deployment.
 */
export function Setup() {
  const game = useStore((s) => s.game);
  const record = useStore((s) => s.record);
  const mode = useStore((s) => s.mode);
  const role = useStore((s) => s.role);
  const net = useStore((s) => s.net);
  const session = useStore((s) => s.session);
  const dispatch = useStore((s) => s.dispatch);
  const canControl = useCanControl();
  const joining = useJoining();
  const waiting = useRoomWaiting();
  const [copiedHere, setCopied] = useState(false);
  // Hosting from a TTS save copies the link on the way in, and says so (UX N16 follow-up).
  const copied = useInviteCopied((s) => s.copied) || copiedHere;
  const [kept, setKept] = useState(false);
  const [changing, setChanging] = useState<"army" | "table" | null>(null);
  const seated = Object.values(game.players)
    .filter((p) => p.seat !== undefined)
    .sort((a, b) => a.seat! - b.seat!);
  const mine = seated.filter((p) => canControl(p.id));
  const others = seated.filter((p) => !canControl(p.id));
  const online = mode !== "hotseat";
  const guest = online && net?.role === "client";
  const host = net?.hostId ? game.players[net.hostId] : undefined;
  const unitsOf = (id: string) => Object.values(game.units).filter((u) => u.owner === id);
  const armyless = mine.filter((p) => !unitsOf(p.id).length);
  const mission = missionOf(game);
  // A game opened from a TTS save is on the save's table already (UX N3).
  const savedTable = useTtsNote((s) => s.table);
  const onSave = !!savedTable && game.tableSource?.key === `table:${savedTable}` && !game.tableSource.changed;
  const fromSave = onSave && game.terrain.length > 0;
  // Its terrain couldn't load (UX N16): the table isn't done, whatever the checklist assumed.
  const saveEmpty = onSave && !game.terrain.length;
  const checks = mine.flatMap((p) => deployChecks(record, game, p.id));
  // A save's armies stand where the save put them: placing them is done (Sprint, TTS save hosted online).
  const toPlace = onSave ? [] : checks.filter((c) => c.untouched || c.outside);
  const readyNeeded = online;
  const notReady = seated.filter((p) => !p.ready);
  const myReady = mine.every((p) => p.ready);
  const roll = lastRollOff(record);
  const seats = sides(game);
  // A tie rolls again by itself (UX N13): the host's screen rolls, so it happens once.
  const tie = !!roll && roll[0] === roll[1] && !guest && role !== "spectator";
  const rolls = record.events.length;
  useEffect(() => {
    if (!tie) return;
    const id = setTimeout(
      () => dispatch({ type: "dice/roll", count: 2, sides: 6, label: "first turn" }),
      1500,
    );
    return () => clearTimeout(id);
  }, [tie, rolls, dispatch]);

  if (role === "spectator")
    return (
      <aside className="obn-setup">
        <RoomCard />
        <p className="obn-muted">{t("You're watching. The battle starts when the players are ready.")}</p>
      </aside>
    );
  if (role === "client" && !mine.length)
    return (
      <aside className="obn-setup">
        <RoomCard />
        {seated.length >= 2 * (game.settings.teamSize ?? 1) ? (
          <RejoinCard seated={seated} />
        ) : (
          <EarlyNameCard />
        )}
      </aside>
    );

  const lines: Line[] = [];
  if (online && !guest)
    lines.push({
      id: "invite",
      title: t("Invite your opponent"),
      done: !waiting || copied,
      note: !waiting
        ? t("{names} is here", { names: formatList(others.map((p) => displayName(p.name))) })
        : copied
          ? t("Link copied. Waiting for them to open it.")
          : undefined,
    });
  lines.push({
    id: "army",
    title: mine.length > 1 ? t("Both armies") : t("Your army"),
    done: !armyless.length,
    note: armyless.length
      ? mine.length > 1
        ? t("{names} has no army yet", { names: formatList(armyless.map((p) => sideName(game, p.seat!))) })
        : undefined
      : tn(
          mine.reduce((n, p) => n + unitsOf(p.id).length, 0),
          "{n} unit on the table",
          "{n} units on the table",
        ),
  });
  lines.push({
    id: "table",
    title: t("Table and mission"),
    done: guest || fromSave || kept,
    waits: guest && host ? displayName(host.name) : undefined,
    note: [
      ...(fromSave ? [t("From your save")] : []),
      ...(saveEmpty ? [t("{name}: its terrain couldn't load", { name: game.tableSource?.name ?? "" })] : []),
      mission ? mission.name : t("No mission: you'll score by hand"),
    ].join(" · "),
  });
  lines.push({
    id: "deploy",
    title: t("Deployment"),
    done: !toPlace.length && (!readyNeeded || myReady),
    note: toPlace.length
      ? tn(toPlace.length, "{n} unit to place", "{n} units to place")
      : readyNeeded && !myReady
        ? t("Everything placed. Say you're ready.")
        : readyNeeded && notReady.length
          ? t("Waiting for {names}", { names: formatList(notReady.map((p) => displayName(p.name))) })
          : undefined,
  });
  lines.push({
    id: "first",
    title: t("Who goes first"),
    done: !!roll && roll[0] !== roll[1],
    note: !roll
      ? undefined
      : roll[0] === roll[1]
        ? t("A tie, {a} each: rolling again…", { a: roll[0] ?? 0 })
        : t("Rolled {a} – {b}", { a: roll[0] ?? 0, b: roll[1] ?? 0 }),
  });
  const now = lines.find((l) => !l.done)?.id ?? "start";
  const opponentHere = !waiting || mode === "hotseat";

  // The lit button for the current line, in the step bar.
  let say: string;
  let sub: string;
  let lit: { label: string; run: () => void } | null = null;
  const plain: { label: string; run: () => void }[] = [];
  switch (now) {
    case "invite":
      say = t("Send the invite link to your opponent");
      sub = t("They open it in their browser: nothing to install, no account.");
      lit = {
        label: t("Copy invite link"),
        run: () => {
          copyInvite();
          setCopied(true);
        },
      };
      break;
    case "army":
      say = mine.length > 1 ? t("Put both armies on the table") : t("Pick your army");
      sub = t(
        "A sample army, one from your shelf, or import a list (New Recruit, BattleScribe, Yellowscribe).",
      );
      {
        const sample = sampleFor(armyless);
        if (sample)
          lit = {
            label: armyless.length > 1 ? t("Use the sample armies") : t("Use the sample army"),
            run: sample,
          };
      }
      break;
    case "table":
      if (saveEmpty) {
        say = t("The save's terrain couldn't load");
        sub = t("Pick your TTS folder so it comes from there, or play on a starter table.");
        lit = {
          label: t("Use a starter table"),
          run: () => {
            const first = starters()[0];
            if (first)
              void applyLayout(starterLayout(game.system, game.table, first.id, 1), {
                key: `starter:${first.id}`,
                name: first.name,
              });
          },
        };
        plain.push({ label: t("Pick your TTS folder"), run: () => openTts() });
        plain.push({ label: t("Play on the empty table"), run: () => setKept(true) });
        break;
      }
      say = t("Table and mission: {mission}", { mission: mission?.name ?? t("none") });
      sub = t("Keep them, or change the table or mission first.");
      lit = { label: t("Keep these"), run: () => setKept(true) };
      plain.push({ label: t("Change"), run: () => setChanging(changing === "table" ? null : "table") });
      break;
    case "deploy":
      if (toPlace.length) {
        say = t("Place your units in your zone");
        sub = t("Drag each one into the shaded strip.");
        plain.push({ label: t("Next unit"), run: () => pickUnit(toPlace[0]!.unit.id) });
        if (readyNeeded)
          plain.push({
            label: t("Ready anyway"),
            run: () =>
              mine.forEach((p) => dispatch({ type: "player/ready", player: p.id, ready: true }, p.id)),
          });
      } else {
        // Characters standing with a squad: leading is the step people forget (UX N10).
        const pairs = mine.flatMap((p) => leadPairs(game, p.id).map((x) => ({ ...x, as: p.id })));
        const ready = () =>
          mine.forEach((p) => dispatch({ type: "player/ready", player: p.id, ready: true }, p.id));
        if (pairs.length) {
          say = tn(pairs.length, "{n} character stands with a squad", "{n} characters stand with a squad");
          sub = formatList(
            pairs.map((x) => t("{leader} with {unit}", { leader: x.leader.name, unit: x.near.name })),
          );
          lit = {
            label: pairs.length > 1 ? tn(pairs.length, "Lead all {n}", "Lead all {n}") : t("Lead it"),
            run: () =>
              pairs.forEach((x) => dispatch({ type: "unit/attach", id: x.leader.id, to: x.near.id }, x.as)),
          };
          plain.push({ label: t("Ready anyway"), run: ready });
        } else {
          say = t("Check your deployment, then say you're ready");
          sub = t("Everything is placed. Drag any unit to adjust it first.");
          lit = { label: t("Ready"), run: ready };
        }
      }
      break;
    case "first":
      say = t("Roll off for the first turn");
      sub = t("One die each, both screens see it. The winner chooses who goes first.");
      lit = {
        label: t("Roll off"),
        run: () => dispatch({ type: "dice/roll", count: 2, sides: 6, label: "first turn" }),
      };
      break;
    default: {
      const winner = roll && roll[0] !== roll[1] ? (roll[0]! > roll[1]! ? seats[0] : seats[1]) : null;
      say =
        winner !== null && winner !== undefined
          ? t("{side} won the roll-off and goes first", { side: sideName(game, game.turn.firstSeat) })
          : t("Start the battle");
      sub = opponentHere
        ? notReady.length && readyNeeded
          ? t("Waiting for {names} to be ready", {
              names: formatList(notReady.map((p) => displayName(p.name))),
            })
          : t("{side} takes the first turn.", { side: sideName(game, game.turn.firstSeat) })
        : t("Nobody has joined yet.");
      const ready = opponentHere && !(readyNeeded && notReady.length);
      const start = {
        label: ready ? t("Start the battle") : t("Start anyway"),
        run: () => dispatch({ type: "turn/next" }),
      };
      if (ready) lit = start;
      else plain.push(start);
    }
  }

  const firstPicker = seats.length === 2 && (now === "start" || now === "first") && (
    <label className="obn-row">
      <span>{t("First turn")}</span>
      <select
        value={game.turn.firstSeat}
        onChange={(e) => dispatch({ type: "turn/first", seat: Number(e.target.value) })}
      >
        {seats.map((seat) => (
          <option key={seat} value={seat}>
            {sideName(game, seat)}
          </option>
        ))}
      </select>
    </label>
  );
  // A roll-off's winner is set as first, once: they can change it with the picker above.
  const winnerSeat = roll && roll[0] !== roll[1] ? (roll[0]! > roll[1]! ? seats[0] : seats[1]) : undefined;
  if (
    winnerSeat !== undefined &&
    now === "start" &&
    game.turn.firstSeat !== winnerSeat &&
    !firstSet.has(roll!.join())
  )
    queueMicrotask(() => {
      firstSet.add(roll!.join());
      dispatch({ type: "turn/first", seat: winnerSeat });
    });

  return (
    <>
      <aside className="obn-setup" aria-label={t("Before the battle")}>
        <div className="obn-setup-head">
          <span className="obn-label">{t("Before the battle")}</span>
          <strong>
            {guest && host
              ? t("{name}'s table · {game}", { name: displayName(host.name), game: gameTitle(game) })
              : gameTitle(game)}
          </strong>
        </div>
        <EventSlot />
        {online && <RoomCard />}
        <ol className="obn-check">
          {lines.map((l) => (
            <li key={l.id} className={l.done ? "done" : l.id === now ? "now" : "later"}>
              <span className="obn-mark" aria-hidden="true">
                {l.done ? "✓" : ""}
              </span>
              <div>
                <strong>{l.title}</strong>
                {l.waits && !l.done && (
                  <span className="obn-muted"> · {t("{name} chooses", { name: l.waits })}</span>
                )}
                {l.note && <div className="obn-muted small">{l.note}</div>}
                {l.id === "army" && (l.id === now || changing === "army") && <ArmyImport players={mine} />}
                {l.id === "army" && l.done && l.id !== now && changing !== "army" && (
                  <button className="obn-link small" onClick={() => setChanging("army")}>
                    {t("Change")}
                  </button>
                )}
                {l.id === "table" && !guest && (changing === "table" || l.id === now) && (
                  <div className="obn-stack">
                    <TablePicker />
                    <MissionPicker />
                  </div>
                )}
                {l.id === "table" && !guest && l.done && changing !== "table" && (
                  <button className="obn-link small" onClick={() => setChanging("table")}>
                    {t("Change")}
                  </button>
                )}
                {l.id === "deploy" && (l.id === now || toPlace.length > 0) && (
                  <DeployTray players={mine as Player[]} />
                )}
              </div>
            </li>
          ))}
        </ol>
        {firstPicker}
      </aside>
      <section className="obn-bar job" aria-label={t("Next step")} data-lit={lit ? "bar" : "none"}>
        <div className="obn-bar-row">
          <div className="obn-say" role="status" aria-live="polite">
            <strong>{joining ? t("Joining the game…") : say}</strong>
            {!joining && <span>{sub}</span>}
          </div>
          <div className="obn-buttons">
            {plain.map((b) => (
              <button key={b.label} className="obn-plain" onClick={b.run}>
                {b.label}
              </button>
            ))}
            {lit && !joining && session && (
              <button className="obn-lit" onClick={lit.run}>
                {lit.label} ▸
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

const firstSet = new Set<string>();
