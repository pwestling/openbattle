import { useState } from "react";
import type { Player } from "../core";
import { displayName } from "../i18n/names";
import { formatList, t, tn } from "../i18n";
import { TablePicker } from "../tables/TableLibrary";
import { useStore } from "../store";
import { gameTitle } from "./systemLabels";
import { ArmyImport } from "./ArmyImport";
import { MissionPicker, missionOf } from "./Missions";
import { copyInvite, DeployTray, useRoomWaiting } from "./Room";

/**
 * The room before the battle as a checklist, in the order it's done (UX 515):
 * invite your opponent, your army, the table and mission, then Ready. Each
 * step says when it's done; Start battle lights up once both armies are down.
 */
export function SetupSteps({ mine }: { mine: Player[] }) {
  const game = useStore((s) => s.game);
  const mode = useStore((s) => s.mode);
  const waiting = useRoomWaiting();
  const [copied, setCopied] = useState(false);
  const [armyOpen, setArmyOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const seated = Object.values(game.players)
    .filter((p) => p.seat !== undefined)
    .sort((a, b) => a.seat! - b.seat!);
  const online = mode !== "hotseat";
  // A guest came by an invite: their steps start at their own army, under the host's table and game (UX 513).
  const net = useStore((s) => s.net);
  const guest = online && net?.role === "client";
  const hostName = net?.hostId ? game.players[net.hostId]?.name : undefined;
  const others = seated.filter((p) => !mine.some((m) => m.id === p.id));
  const unitsOf = (id: string) => Object.values(game.units).filter((u) => u.owner === id);
  const armed = mine.every((p) => unitsOf(p.id).length > 0);
  const units = mine.reduce((n, p) => n + unitsOf(p.id).length, 0);
  const mission = missionOf(game);
  const ready = seated.filter((p) => p.ready);
  const allReady = seated.length > 1 && ready.length === seated.length;
  // One next step lit at a time (UX 515, Porter's flows): the invite counts as done once it's sent.
  const [sent, setSent] = useState(false);
  // The table and mission are the host's to set; a guest sees what they are.
  const done = [!online || guest || !waiting || sent, armed, guest || !!mission, allReady];
  const now = done.findIndex((d) => !d);
  const cls = (i: number) => (done[i] ? "done" : i === now ? "now" : "later");
  let n = 0;
  const step = (i: number, title: string) => (
    <strong className={done[i] ? "done" : ""}>
      {++n}. {title}
      {done[i] ? " ✓" : ""}
    </strong>
  );
  return (
    <ol className="setup-steps" aria-label={t("Before the battle")}>
      {guest && (
        <li className="setup-where">
          <strong>
            {hostName
              ? t("{name}'s table · {game}", { name: displayName(hostName), game: gameTitle(game) })
              : gameTitle(game)}
          </strong>
        </li>
      )}
      {online && !guest && (
        <li className={cls(0)}>
          {step(0, t("Invite your opponent"))}
          {waiting ? (
            <button
              className={copied ? "on small" : "primary small"}
              onClick={() => {
                copyInvite();
                setCopied(true);
                setSent(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? t("Copied ✓") : t("Copy invite link")}
            </button>
          ) : (
            <span className="muted small">
              {t("{names} is here", { names: formatList(others.map((p) => displayName(p.name))) })}
            </span>
          )}
        </li>
      )}
      <li className={cls(1)}>
        {step(1, mine.length > 1 ? t("Your armies") : t("Your army"))}
        {armed && !armyOpen ? (
          <span className="muted small">
            {tn(units, "{n} unit on the table", "{n} units on the table")}{" "}
            <button className="link small" onClick={() => setArmyOpen(true)}>
              {t("Change")}
            </button>
          </span>
        ) : null}
        {cls(1) === "later" && !armyOpen && (
          <button className="link small" onClick={() => setArmyOpen(true)}>
            {t("Pick it now")}
          </button>
        )}
        {(cls(1) === "now" || armyOpen) && <ArmyImport players={mine} />}
        {cls(1) !== "later" && <DeployTray players={mine} />}
      </li>
      <li className={cls(2)}>
        {step(2, t("Table and mission"))}
        <span className="muted small">
          {mission ? mission.name : t("No mission yet")}{" "}
          {!guest && (
            <button className="link small" aria-expanded={tableOpen} onClick={() => setTableOpen(!tableOpen)}>
              {tableOpen || cls(2) === "now" ? t("Done") : t("Change ▸")}
            </button>
          )}
        </span>
        {!guest && (tableOpen || cls(2) === "now") && (
          <>
            <TablePicker />
            <MissionPicker />
          </>
        )}
      </li>
      <li className={cls(3)}>
        {step(3, t("Ready"))}
        <span className="muted small">
          {allReady
            ? t("Everyone's ready: start the battle")
            : seated.filter((p) => !p.ready).length
              ? t("Not ready yet: {names}", {
                  names: formatList(seated.filter((p) => !p.ready).map((p) => displayName(p.name))),
                })
              : t("Waiting for your opponent")}
        </span>
      </li>
    </ol>
  );
}
