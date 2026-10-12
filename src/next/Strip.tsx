import { characterName, levelName, useSolo } from "../bot/solo";
import { sidePlayers, sides, systemOf } from "../core";
import { poolUsed } from "../core/content/player";
import { t } from "../i18n";
import { displayName } from "../i18n/names";
import { RankedChip } from "../ranked/RankedGame";
import { useCanControl, useJoining, useStore } from "../store";
import { useReel } from "../broadcast/reel";
import { SideClock } from "../ui/Clocks";
import { useHelp } from "../ui/help";
import { useGame } from "../ui/hooks";
import { NetBanner } from "../ui/NetBanner";
import { seatShape } from "../ui/sides";
import { Counter, DicePool, SoundToggle, WatchingChip, YourTurnFlash } from "../ui/TopBar";
import { useVoice } from "../voice/voice";

/**
 * The score strip (ui-next): ⋯ for everything else, each side's name, counters
 * (CP, VP), clocks and dice pools, and the round. A player who has dropped
 * says so by their name. Nothing here is lit: the step bar holds the next step.
 */
export function Strip({ onMenu }: { onMenu: () => void }) {
  const game = useGame();
  const final = useStore((s) => s.game);
  const reeling = useReel((s) => s.index !== null);
  const { dispatch, scrub, role, net, session, mode } = useStore();
  const canControl = useCanControl();
  const joining = useJoining();
  const live = scrub === null && role !== "spectator" && !joining;
  const speaking = useVoice((s) => s.speaking);
  const solo = useSolo((s) => (s.level && s.session === session ? s : null));
  const system = (() => {
    try {
      return systemOf(game);
    } catch {
      return null;
    }
  })();
  const counters = (system?.resources ?? []).filter((r) => r.kind !== "dicePool");
  const pools = (system?.resources ?? []).filter((r) => r.kind === "dicePool");
  const rounds = typeof system?.turn.rounds === "number" ? system.turn.rounds : null;
  const deploying = game.turn.round === 0;
  const over = rounds !== null && game.turn.round > rounds;
  const peers = net?.peers ?? [];
  const away = (id: string) =>
    mode !== "hotseat" && !!net && id !== session?.selfId && !peers.includes(id) && net.role !== "spectator";
  return (
    <div className="obn-strip">
      <button
        className="obn-menu"
        onClick={onMenu}
        title={t("Everything else: view, log, settings, leave")}
        aria-label={t("Menu")}
      >
        ⋯
      </button>
      {sides(game).map((seat, i) => {
        const team = sidePlayers(game, seat);
        const lead = team[0]!;
        const mine = team.find((p) => canControl(p.id));
        return (
          <div
            key={seat}
            className={`obn-side${seat === game.turn.activeSeat && !deploying && !over ? " on" : ""}${i % 2 ? " right" : ""}`}
            style={{ ["--side" as string]: lead.color }}
          >
            <span className="obn-shape" aria-hidden="true">
              {seatShape(seat)}
            </span>
            {team.map((p, j) => (
              <strong key={p.id} className={`obn-name${speaking[p.id] ? " speaking" : ""}`}>
                {j > 0 && " & "}
                {solo && !solo.both && p.seat === solo.seat ? (
                  <>
                    {characterName(solo.level!)} <small>{levelName(solo.level!)}</small>
                  </>
                ) : (
                  displayName(p.name)
                )}
                {away(p.id) && <small className="obn-away">{t("reconnecting…")}</small>}
              </strong>
            ))}
            {counters.map(({ id: r }) => (
              <Counter
                key={r}
                label={r}
                value={(reeling ? final : game).resources[lead.id]?.[r] ?? 0}
                step={
                  live && mine
                    ? (delta) =>
                        dispatch({ type: "resource/adjust", player: mine.id, resource: r, delta }, mine.id)
                    : null
                }
              />
            ))}
            {mine && <YourTurnFlash />}
            <SideClock seat={seat} />
            {team.flatMap((p) =>
              pools.map((pool) => (
                <DicePool
                  key={`${p.id}-${pool.id}`}
                  label={pool.short ?? pool.name}
                  title={pool.name}
                  faces={game.pools?.[p.id]?.[pool.id] ?? []}
                  editable={live && canControl(p.id)}
                  rerollOnce={pool.rerollOnce ? (poolUsed(game, p.id, pool.id) ?? "open") : undefined}
                  onReady={() => dispatch({ type: "pool/ready", player: p.id, resource: pool.id }, p.id)}
                  onSpend={(indices) =>
                    dispatch({ type: "pool/spend", player: p.id, resource: pool.id, indices }, p.id)
                  }
                  onReroll={(indices) =>
                    dispatch({ type: "pool/reroll", player: p.id, resource: pool.id, indices }, p.id)
                  }
                />
              )),
            )}
          </div>
        );
      })}
      <div className="obn-round">
        {deploying
          ? joining
            ? t("Joining the game…")
            : t("Setting up")
          : over
            ? t("Battle over")
            : rounds
              ? t("Round {round} of {rounds}", { round: game.turn.round, rounds })
              : t("Round {round}", { round: game.turn.round })}
        <WatchingChip />
        <RankedChip />
        {role === "spectator" && <span className="obn-chip">{!session ? t("Replay") : t("Watching")}</span>}
      </div>
      <div className="obn-tools">
        {/* No ⚠ count up here (naive players 4): a warning shows on the move or attack it is about. */}
        <SoundToggle />
        <button
          className="obn-quiet"
          title={t("Controls (?)")}
          aria-label={t("Controls")}
          onClick={() => useHelp.setState({ keys: true })}
        >
          ?
        </button>
      </div>
      <NetBanner />
    </div>
  );
}
