import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CloudRain,
  Droplets,
  Fish,
  Hammer,
  Heart,
  LifeBuoy,
  Magnet,
  Moon,
  Radio,
  Recycle,
  RotateCcw,
  Search,
  Shield,
  TriangleAlert,
  Volume2,
  VolumeX,
  Waves,
  Wrench,
} from "lucide-react";
import type { Ending, HotspotSpec } from "./OceanScene";
import { audio } from "./audio";
import {
  BUILD_ID,
  INITIAL,
  RESCUE_STRUCTURE,
  TOTAL_DAYS,
  UPGRADES,
  type Choice,
  type Stats,
  type StatKey,
  buildChoice,
  buildable,
  causeOfDeath,
  costOf,
  dealHand,
  dividends,
  effort,
  finishFor,
  isDead,
  planRun,
  resolveDay,
  suggestTarget,
  upgradeByName,
  upkeepFor,
} from "./game";

const OceanScene = lazy(() => import("./OceanScene"));

const statMeta: Record<StatKey, { color: string; short: string }> = {
  food: { color: "#e8a13c", short: "FOOD" },
  water: { color: "#5fb8c4", short: "WATER" },
  spirit: { color: "#d9605b", short: "SPIRIT" },
  scrap: { color: "#f2c14e", short: "SALVAGE" },
  hull: { color: "#9a9f6b", short: "HULL" },
};

function StatIcon({ stat, size = 14 }: { stat: StatKey; size?: number }) {
  const p = { size, strokeWidth: 2.6 };
  if (stat === "food") return <Fish {...p} />;
  if (stat === "water") return <Droplets {...p} />;
  if (stat === "spirit") return <Heart {...p} />;
  if (stat === "hull") return <Shield {...p} />;
  return <Recycle {...p} />;
}

function ChoiceIcon({ id, size = 28 }: { id: string; size?: number }) {
  const p = { size, strokeWidth: 2.3 };
  if (id === "fish") return <Fish {...p} />;
  if (id === "salvage") return <Magnet {...p} />;
  if (id === "purify") return <Droplets {...p} />;
  if (id === "repair") return <Hammer {...p} />;
  if (id === "bail") return <LifeBuoy {...p} />;
  if (id === "dive") return <Search {...p} />;
  if (id === "rest") return <Moon {...p} />;
  if (id === "rain") return <CloudRain {...p} />;
  if (id === BUILD_ID) return <Wrench {...p} />;
  return <Radio {...p} />;
}

/** Segmented gauge — reads instantly at phone size, unlike a hairline bar. */
function Gauge({ value, color }: { value: number; color: string }) {
  const segments = 10;
  const filled = Math.round((value / 100) * segments);
  return (
    <span className="gauge" style={{ "--c": color } as CSSProperties}>
      {Array.from({ length: segments }, (_, i) => (
        <i key={i} className={i < filled ? "on" : ""} />
      ))}
    </span>
  );
}

function ChangeChips({ change }: { change: Partial<Stats> }) {
  const order: StatKey[] = ["food", "water", "spirit", "hull", "scrap"];
  return (
    <span className="chips">
      {order
        .filter((k) => (change[k] ?? 0) !== 0)
        .map((k) => {
          const v = change[k] ?? 0;
          return (
            <span key={k} className={`chip ${v > 0 ? "up" : "down"}`} style={{ "--c": statMeta[k].color } as CSSProperties}>
              <StatIcon stat={k} size={11} />
              <b>
                {v > 0 ? "+" : ""}
                {v}
              </b>
            </span>
          );
        })}
    </span>
  );
}

/**
 * The signature element: thirty days scratched into the deck rail, grouped in
 * fives the way anyone actually keeps a tally. Encodes elapsed and remaining
 * at once, so it replaces both the day counter and the progress bar.
 */
function Tally({ day, total }: { day: number; total: number }) {
  const groups = Math.ceil(total / 5);
  return (
    <div className="tally" aria-label={`Day ${day} of ${total}`}>
      {Array.from({ length: groups }, (_, g) => {
        const cut = Math.min(5, Math.max(0, day - g * 5));
        return (
          <svg key={g} className="tally-group" viewBox="0 0 26 20" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                className={i < cut ? "cut" : ""}
                x1={3 + i * 5.2}
                y1={2.5 + (i % 2) * 0.6}
                x2={4.1 + i * 5.2}
                y2={17.5 - (i % 3) * 0.5}
              />
            ))}
            <line className={cut >= 5 ? "cut slash" : "slash"} x1={1.4} y1={16.4} x2={20.4} y2={3.4} />
          </svg>
        );
      })}
    </div>
  );
}

type Burst = { id: number; stat: StatKey; value: number };

export default function App() {
  const [plan, setPlan] = useState(() => planRun());
  const [day, setDay] = useState(1);
  const [stats, setStats] = useState<Stats>(INITIAL);
  const [built, setBuilt] = useState<string[]>([]);
  // dealt once per day, so the hand cannot reshuffle under the player mid-animation
  const [hand, setHand] = useState<Choice[]>(() => dealHand(plan, 1, INITIAL, []));
  // the stats the hand was dealt against, so the deck cannot reshuffle while a day plays out
  const [dayStats, setDayStats] = useState<Stats>(INITIAL);
  // which structure the day's work would go into — the player's call, not a queue
  const [target, setTarget] = useState<string | null>(() => suggestTarget(1, []));
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("Thirty days. One raft. A day buys exactly one thing.");
  const [eventText, setEventText] = useState<string | null>(null);
  const [ended, setEnded] = useState<Ending>(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [deltas, setDeltas] = useState<Partial<Stats>>({});
  const [storm, setStorm] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [setback, setSetback] = useState(false);
  const burstId = useRef(0);
  const timers = useRef<number[]>([]);

  // the raft's silhouette tracks real construction, so progress is earned
  const stage = Math.min(5, built.length);
  const busy = selected !== null;
  const goal = useMemo(() => upgradeByName(target), [target]);
  const ready = useMemo(() => buildable(day, dayStats, built, target), [day, dayStats, built, target]);
  // the build option is derived live, so re-aiming updates the deck immediately
  const actions = useMemo(() => (ready ? [...hand, buildChoice(ready)] : hand), [hand, ready]);
  const forecast = day < TOTAL_DAYS ? plan.events[day + 1] : null;
  const output = useMemo(() => dividends(built), [built]);
  const bill = useMemo(() => upkeepFor(day), [day]);
  const grit = Math.round(effort(stats.spirit) * 100);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  useEffect(() => audio.setMuted(muted), [muted]);
  useEffect(() => audio.setStorm(storm), [storm]);

  const choose = (choice: Choice) => {
    if (busy || ended) return;
    audio.start();

    const cost = costOf(choice);
    if (cost > stats.scrap) {
      setMessage(`Not enough salvage — that plan needs ${cost}.`);
      setEventText(null);
      audio.play("deny");
      setShake(true);
      after(420, () => setShake(false));
      return;
    }

    setSelected(choice.id);
    setPulse((v) => v + 1);
    audio.play("click");
    audio.playAction(choice.id);

    const result = resolveDay(plan, day, stats, choice, built, target);
    const standing = result.built ? [...built, result.built] : built;
    setStorm(result.storm);
    setSetback(result.failed);
    setStats(result.stats);
    setMessage(result.message);
    setEventText(result.eventText);

    if (result.built) {
      const raised = result.built;
      setBuilt(standing);
      setTarget(suggestTarget(day, standing));
      after(700, () => {
        setToast(raised);
        audio.playUpgrade();
      });
      after(3100, () => setToast(null));
    }

    setDeltas(result.delta);
    after(1500, () => setDeltas({}));

    // big centre-frame numbers so the payoff lands inside the 3D shot
    const order: StatKey[] = ["food", "water", "spirit", "hull", "scrap"];
    setBursts(
      order
        .filter((k) => (result.delta[k] ?? 0) !== 0)
        .map((k) => ({ id: burstId.current++, stat: k, value: result.delta[k] ?? 0 })),
    );
    after(1600, () => setBursts([]));

    after(1500, () => {
      setStorm(false);
      setSetback(false);
      if (isDead(result.stats)) {
        setEnded("lost");
        audio.playLose();
      } else if (day >= TOTAL_DAYS) {
        const finish = finishFor(result.stats, standing);
        setEnded(finish === "rescued" ? "rescued" : "adrift");
        if (finish === "rescued") audio.playWin();
        else audio.playUpgrade();
      } else {
        setDay(day + 1);
        setHand(dealHand(plan, day + 1, result.stats, standing));
        setDayStats(result.stats);
      }
      setSelected(null);
    });
  };

  const restart = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    const fresh = planRun();
    setPlan(fresh);
    setDay(1);
    setStats(INITIAL);
    setBuilt([]);
    setHand(dealHand(fresh, 1, INITIAL, []));
    setDayStats(INITIAL);
    setTarget(suggestTarget(1, []));
    setSelected(null);
    setEnded(null);
    setStorm(false);
    setBursts([]);
    setToast(null);
    setSetback(false);
    setMessage("A new drift. New weather, new luck. A day buys exactly one thing.");
    setEventText(null);
  };

  // The cards are the primary controls, but number keys make repeated runs
  // much less click-heavy. Enter/Space starts and R restarts from an ending.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const targetElement = event.target;
      if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) return;

      if (event.key.toLowerCase() === "m") {
        audio.start();
        setMuted((value) => !value);
        return;
      }
      if (!started && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        audio.start();
        audio.play("click");
        setStarted(true);
        return;
      }
      if (ended && (event.key.toLowerCase() === "r" || event.key === "Enter")) {
        restart();
        return;
      }
      if (!started || ended || busy) return;
      const index = Number(event.key) - 1;
      const choice = actions[index];
      if (Number.isInteger(index) && choice) choose(choice);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, busy, ended, started]);

  const critical = (["food", "water", "spirit", "hull"] as const).some((k) => stats[k] <= 20);

  const hotspots: HotspotSpec[] = (started && !ended ? actions : []).map((choice, index) => {
    const cost = costOf(choice);
    const riskPct = choice.risk ? Math.round(choice.risk * 100) : 0;
    const isBuild = choice.id === BUILD_ID;
    return {
      id: choice.id,
      tone: choice.tone,
      locked: cost > stats.scrap,
      disabled: busy,
      selected: selected === choice.id,
      shortcut: String(index + 1),
      content: (
        <>
          <span className="hotspot-title">
            <ChoiceIcon id={choice.id} size={19} />
            {choice.label}
          </span>
          <ChangeChips change={choice.change} />
          {isBuild && <span className="hotspot-build">Costs the whole day</span>}
          {riskPct > 0 && <span className="hotspot-risk">{riskPct}% risk</span>}
          {cost > stats.scrap && <span className="hotspot-need">Need {cost} salvage</span>}
        </>
      ),
    };
  });

  return (
    <main className="shell">
      <section
        className={`game ${critical ? "critical" : ""} ${shake ? "shake" : ""}`}
        data-stage={stage}
        data-phase={started ? "play" : "title"}
      >
        <Suspense fallback={<div className="ocean-loading" aria-hidden="true" />}>
          <OceanScene
            stage={stage}
            built={built}
            pulse={pulse}
            action={selected}
            ending={ended}
            storm={storm}
            hotspots={hotspots}
            onPick={(id) => {
              const choice = actions.find((c) => c.id === id);
              if (choice) choose(choice);
            }}
          />
        </Suspense>
        <div className="vignette" aria-hidden="true" />
        {!started && (
          <TitleScreen
            onStart={() => {
              audio.start();
              audio.play("click");
              setStarted(true);
            }}
          />
        )}
        {critical && !ended && <div className="danger-edge" aria-hidden="true" />}
        {setback && <div className="setback-flash" aria-hidden="true" />}

        {/* ---------- deck rail: wordmark, tally, forecast ---------- */}
        <header className="rail">
          <div className="rail-top">
            <span className="wordmark">DRIFT<i>30</i></span>
            <button className="iconbtn" onClick={() => { audio.start(); setMuted((v) => !v); }} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          </div>

          <div className="batten">
            <Tally day={day} total={TOTAL_DAYS} />
          </div>

          <div className="rail-foot">
            <span className="dayread">
              <b>DAY {day}</b>
              <em>{TOTAL_DAYS - day} left</em>
            </span>
            <span className="upkeep" title="What today costs you no matter what you do">
              <small>TODAY'S TOLL</small>
              <ChangeChips change={bill} />
            </span>
          </div>

          {/* The forecast is a planning tool now that late weather really bites. */}
          {forecast && !ended && (
            <div className={`forecast ${forecast.storm ? "rough" : ""}`}>
              <small>TOMORROW</small>
              <b>{forecast.label}</b>
              <ChangeChips change={forecast.change} />
            </div>
          )}
        </header>

        {/* ---------- the gauge board ---------- */}
        <aside className="board" aria-label="Survival resources">
          {(["food", "water", "spirit", "hull"] as const).map((key) => {
            const d = deltas[key] ?? 0;
            const level = stats[key] <= 20 ? "low" : stats[key] <= 45 ? "warn" : "";
            return (
              <div key={key} className={`tube ${level}`} style={{ "--c": statMeta[key].color } as CSSProperties}>
                <span className="tube-icon">
                  <StatIcon stat={key} size={12} />
                </span>
                <span className="tube-glass">
                  <i style={{ height: `${stats[key]}%` }} />
                </span>
                <b className="tube-value">{stats[key]}</b>
                <span className="tube-label">{statMeta[key].short}</span>
                {/* spirit is a multiplier on your labour, so the board states the rate */}
                {key === "spirit" && <i className={`grit ${grit < 85 ? "weak" : ""}`}>{grit}% GRIT</i>}
                {d !== 0 && <span className={`delta ${d > 0 ? "up" : "down"}`}>{d > 0 ? "+" : ""}{d}</span>}
              </div>
            );
          })}
        </aside>

        {/* ---------- salvage and the next build ---------- */}
        <div className="rightrail">
          <div className="salvage">
            <b>{stats.scrap}</b>
            <small>SALVAGE</small>
            {(deltas.scrap ?? 0) !== 0 && (
              <span className={`delta ${(deltas.scrap ?? 0) > 0 ? "up" : "down"}`}>
                {(deltas.scrap ?? 0) > 0 ? "+" : ""}
                {deltas.scrap}
              </span>
            )}
          </div>

          {/* Build order is the strategy, so aiming is a control, not a readout. */}
          {goal && !built.includes(goal.name) && (
            <div className={`goal ${ready ? "ready" : ""} ${goal.name === RESCUE_STRUCTURE ? "rescue" : ""}`}>
              <small>{day >= goal.day ? `BUILDING TOWARD · ${goal.cost}` : `Unlocks day ${goal.day}`}</small>
              <b>{goal.name}</b>
              <span className="goal-bar">
                <i style={{ width: `${Math.min(100, (stats.scrap / goal.cost) * 100)}%` }} />
              </span>
              <em>
                {day < goal.day
                  ? goal.blurb
                  : ready
                    ? "Ready — spend a day on it"
                    : `${goal.cost - stats.scrap} more salvage`}
              </em>
            </div>
          )}

          {UPGRADES.some((u) => !built.includes(u.name)) && (
            <div className="ladder" role="group" aria-label="Choose what to build toward">
              <div className="ladder-head">Manifest · tap to aim</div>
              {UPGRADES.map((u) => {
                const done = built.includes(u.name);
                const locked = day < u.day;
                return (
                  <button
                    key={u.name}
                    type="button"
                    className={`rung ${done ? "done" : ""} ${u.name === target ? "aimed" : ""} ${locked ? "locked" : ""}`}
                    disabled={done || ended !== null}
                    onClick={() => { audio.start(); audio.play("click"); setTarget(u.name); }}
                    title={`${u.name} — ${u.cost} salvage, ${u.blurb}`}
                  >
                    <span className="rung-box" aria-hidden="true" />
                    <span className="rung-name">{u.name}</span>
                    <span className="rung-cost">{done ? "BUILT" : locked ? `DAY ${u.day}` : u.cost}</span>
                  </button>
                );
              })}
            </div>
          )}

          {built.length > 0 && (
            <div className="output">
              <small>EVERY DAY</small>
              <ChangeChips change={output} />
            </div>
          )}
        </div>

        {/* ---------- world feedback ---------- */}
        <div className="bursts" aria-hidden="true">
          {bursts.map((b, i) => (
            <span
              key={b.id}
              className={b.value > 0 ? "up" : "down"}
              style={{ "--c": statMeta[b.stat].color, animationDelay: `${i * 90}ms` } as CSSProperties}
            >
              <StatIcon stat={b.stat} size={18} />
              {b.value > 0 ? "+" : ""}
              {b.value}
            </span>
          ))}
        </div>

        {setback && (
          <div className="setback-banner" role="status">
            <TriangleAlert size={14} /> SETBACK
          </div>
        )}

        {toast && (
          <div className="build-toast" role="status">
            <Wrench size={16} />
            <span>
              <small>CONSTRUCTED</small>
              <b>{toast}</b>
            </span>
          </div>
        )}

        {/* ---------- the log ---------- */}
        <section className="decision">
          <div className={`log ${setback ? "bad" : ""}`} aria-live="polite" aria-atomic="true">
            <div className="log-head">
              <span>Ship's log</span>
              <span>Day {day}</span>
            </div>
            <p className="log-entry">{message}</p>
            {eventText && <p className="log-entry log-then">{eventText}</p>}
          </div>

          {!ended ? (
            <p className={`prompt ${busy ? "resolving" : ""}`}>
              {busy ? "The day plays out…" : "Choose an action · keys 1–4"}
            </p>
          ) : (
            <EndingPanel kind={ended} day={day} stats={stats} built={built} onRestart={restart} />
          )}
        </section>
      </section>
      <p className="desktop-note">Make the call · Survive the consequence</p>
    </main>
  );
}

/**
 * The cold open. The sea is already running behind this card, so the screen
 * sells the situation rather than a menu: where you are, what a day costs,
 * and the one thing that gets you off the water.
 */
function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="title">
      <p className="title-eyebrow">Nothing but water in every direction</p>
      <h1 className="title-mark">
        <span>DRIFT</span>
        <span>30</span>
      </h1>
      <div className="title-rule" aria-hidden="true" />
      <p className="title-blurb">
        You have a raft, a net, and thirty days of daylight. The sea takes a little more
        every morning than it did the last.
      </p>
      <ul className="title-rules">
        <li>
          <b>01</b>
          <span>Each day buys exactly one action. Everything you don't do still costs you.</span>
        </li>
        <li>
          <b>02</b>
          <span>Salvage builds the raft. What you build is the only thing that outlasts you.</span>
        </li>
        <li>
          <b>03</b>
          <span>Surviving day thirty is not rescue. Raise the radio tower, or drift on.</span>
        </li>
      </ul>
      <button className="title-start" type="button" onClick={onStart} autoFocus>
        <Waves size={18} /> BEGIN THE DRIFT
      </button>
      <p className="title-foot">30 days · 5 structures · 1 way home · press Enter</p>
    </div>
  );
}

const DEATH_LINE: Record<StatKey, string> = {
  food: "The stores ran out. Hunger finished what the sea started.",
  water: "The tanks ran dry. Salt water is not an option, and you knew it.",
  hull: "The raft came apart under you, plank by plank.",
  spirit: "You stopped bailing. Some mornings there is simply nothing left.",
  scrap: "The raft came apart under you, plank by plank.",
};

function EndingPanel({
  kind,
  day,
  stats,
  built,
  onRestart,
}: {
  kind: NonNullable<Ending>;
  day: number;
  stats: Stats;
  built: string[];
  onRestart: () => void;
}) {
  const cause = causeOfDeath(stats);
  const copy =
    kind === "rescued"
      ? {
          mark: <Radio size={26} />,
          title: "SIGNAL ANSWERED",
          body: "The tower catches a freighter on the third sweep. You built the thing that could shout, and someone was listening.",
        }
      : kind === "adrift"
        ? {
            mark: <Waves size={26} />,
            title: "STILL ADRIFT",
            body: `Thirty days and you are alive — but nothing on this deck can call for help. Raise the ${RESCUE_STRUCTURE.toLowerCase()} next time.`,
          }
        : {
            mark: <TriangleAlert size={26} />,
            title: "THE SEA WON",
            body: cause ? DEATH_LINE[cause] : "The ocean took the rest.",
          };

  return (
    <div className={`ending ${kind}`}>
      <span className="ending-mark">{copy.mark}</span>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <div className="ending-stats">
        <span>
          <small>DAYS</small>
          <b>{day}</b>
        </span>
        <span>
          <small>BUILT</small>
          <b>{built.length}/{UPGRADES.length}</b>
        </span>
      </div>
      <button onClick={onRestart} autoFocus>
        <RotateCcw size={17} /> DRIFT AGAIN
      </button>
    </div>
  );
}
