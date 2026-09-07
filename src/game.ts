/**
 * Game rules for DRIFT 30.
 *
 * Kept free of React so the loop can be reasoned about (and tuned) on its
 * own. Every run is driven by a seed, so the weather and the outcome of each
 * gamble differ between playthroughs.
 *
 * The shape of the game: you are always short of something. Each day you get
 * a hand of three actions and may take exactly one. The hand always contains
 * a way to address your most urgent need, so a loss is a chain of decisions
 * rather than a bad deal — but taking that lifeline is a day you did not
 * spend building, and the raft is the only thing that survives the back half.
 */

export type Stats = { food: number; water: number; spirit: number; scrap: number; hull: number };
export type StatKey = keyof Stats;

export type Outcome = { log: string; change: Partial<Stats> };

export type Choice = {
  id: string;
  label: string;
  detail: string;
  tone: string;
  /** Which need this action exists to answer. Drives the guaranteed-relief deal. */
  covers: StatKey;
  /** The advertised result — this is what the card promises. */
  change: Partial<Stats>;
  log: string;
  /** Chance the gamble goes wrong, 0..1. Absent means it always works. */
  risk?: number;
  /** Applied instead of `change` when the risk roll fails. */
  fail?: Outcome;
};

export type GameEvent = { text: string; change: Partial<Stats>; storm?: boolean; label: string };

export const INITIAL: Stats = { food: 64, water: 60, spirit: 72, scrap: 14, hull: 80 };

export const TOTAL_DAYS = 30;

/**
 * The drift wears you down: hunger and thirst climb in four steps across the
 * run. The point of the curve is that no single day's work ever covers a
 * single day's bill by the end — one action can feed you or water you, never
 * both. The gap is what the raft is for.
 */
export const UPKEEP_STEPS: { from: number; food: number; water: number }[] = [
  { from: 1, food: -8, water: -9 },
  { from: 9, food: -10, water: -11 },
  { from: 17, food: -12, water: -13 },
  { from: 25, food: -14, water: -15 },
];

export function upkeepFor(day: number): Partial<Stats> {
  const step = [...UPKEEP_STEPS].reverse().find((s) => day >= s.from) ?? UPKEEP_STEPS[0];
  return { food: step.food, water: step.water, spirit: -2, hull: day >= 17 ? -2 : -1 };
}

/**
 * Morale is a multiplier on your own labour, not a fifth death clock. A broken
 * castaway hauls a thinner net, which is a far more interesting pressure than
 * a number that silently ticks toward zero.
 */
export function effort(spirit: number): number {
  return 0.62 + 0.58 * (spirit / 100);
}

/** Scales the upside of an action by morale. Costs and damage are never scaled. */
export function applyEffort(change: Partial<Stats>, spirit: number): Partial<Stats> {
  const k = effort(spirit);
  const out: Partial<Stats> = {};
  for (const [key, value] of Object.entries(change) as [StatKey, number][]) {
    out[key] = value > 0 ? Math.round(value * k) : value;
  }
  return out;
}

export const CHOICES: Choice[] = [
  {
    id: "fish",
    label: "CAST THE NET",
    detail: "A reliable meal. If the sea cooperates.",
    tone: "#ffad3f",
    covers: "food",
    change: { food: 30, spirit: 3 },
    log: "The net comes up silver and wriggling.",
    risk: 0.2,
    fail: { log: "The net snags and tears. You eat what you can find.", change: { food: 9, spirit: -6 } },
  },
  {
    id: "salvage",
    label: "HOOK THE JUNK",
    detail: "Parts build a future. Rust cuts deep.",
    tone: "#a8ef3c",
    covers: "scrap",
    change: { scrap: 26, spirit: -3 },
    log: "A good haul: wire, timber, and one decent hinge.",
    risk: 0.22,
    fail: { log: "The hook comes back empty and your hands come back bloody.", change: { scrap: 7, spirit: -8 } },
  },
  {
    id: "purify",
    label: "RUN PURIFIER",
    detail: "Clean water costs spare parts.",
    tone: "#48d8ff",
    covers: "water",
    change: { water: 34, scrap: -7 },
    log: "The filter coughs, then runs crystal clear.",
  },
  {
    id: "repair",
    label: "PATCH THE RAFT",
    detail: "Spend scrap before the sea takes it all.",
    tone: "#ff7b42",
    covers: "hull",
    change: { hull: 30, scrap: -10 },
    log: "The deck creaks less. That counts as progress.",
  },
  {
    id: "bail",
    label: "BAIL AND LASH",
    detail: "No parts needed. Just your back.",
    tone: "#c98f5a",
    covers: "hull",
    change: { hull: 16, spirit: -4 },
    log: "You bail her dry and re-lash the deck by hand.",
  },
  {
    id: "dive",
    label: "DIVE THE WRECK",
    detail: "Big haul. Bigger risk.",
    tone: "#8bdcff",
    covers: "scrap",
    change: { scrap: 38, hull: -6, spirit: -8 },
    log: "You surface with a battery and a new fear of eels.",
    risk: 0.32,
    fail: { log: "Something moved down there. You surface with nothing but panic.", change: { scrap: 6, hull: -12, spirit: -20 } },
  },
  {
    id: "rest",
    label: "TAKE IT EASY",
    detail: "A quiet day steadies the nerves.",
    tone: "#f9dd72",
    covers: "spirit",
    change: { spirit: 30, food: -4 },
    log: "For one afternoon, the ocean feels almost kind.",
  },
  {
    id: "rain",
    label: "CATCH THE RAIN",
    detail: "Fill every bucket you own.",
    tone: "#7cc8ff",
    covers: "water",
    change: { water: 26, spirit: -2 },
    log: "The storm leaves you soaked, but the tanks are full.",
    risk: 0.2,
    fail: { log: "The squall passes to the north. Your buckets stay dry.", change: { water: 7, spirit: -6 } },
  },
  {
    id: "signal",
    label: "LIGHT A FLARE",
    detail: "Hope is useful. Flares are not reusable.",
    tone: "#ff5f50",
    covers: "spirit",
    change: { spirit: 26, scrap: -5 },
    log: "No ship answers. Still, someone might have seen.",
  },
];

/** The action that spends the day building. Dealt only when one is affordable. */
export const BUILD_ID = "build";

/**
 * The sea gets meaner. Early weather is scenery; late weather is the thing
 * that kills you. Because tomorrow's event is pre-rolled and shown in the
 * forecast, a coming TEMPEST is a reason to spend today on the hull — which
 * is the whole point of letting the player see it.
 */
export const EVENT_TIERS: GameEvent[][] = [
  [
    { label: "CALM", text: "Quiet water. The raft drifts east.", change: {} },
    { label: "FISH RUN", text: "A school of flying fish lands on deck.", change: { food: 12 } },
    { label: "DOLPHINS", text: "Dolphins pace the raft until sunset.", change: { spirit: 10 } },
    { label: "SQUALL", text: "A hard squall tears through the lashings.", change: { hull: -8, spirit: -4 }, storm: true },
    { label: "SALT", text: "Salt gets into the purifier intake.", change: { water: -6, scrap: -4 } },
    { label: "FLOTSAM", text: "A pallet of good timber bumps the hull.", change: { scrap: 8 } },
  ],
  [
    { label: "CALM", text: "Quiet water. The raft drifts east.", change: {} },
    { label: "DOLPHINS", text: "Dolphins pace the raft until sunset.", change: { spirit: 10 } },
    { label: "FLOTSAM", text: "A pallet of good timber bumps the hull.", change: { scrap: 8 } },
    { label: "GALE", text: "A gale works at the lashings all night.", change: { hull: -14, spirit: -6 }, storm: true },
    { label: "ROT", text: "The stores have turned. Half of it goes over the side.", change: { food: -14 } },
    { label: "SHARK", text: "Something big circles the raft and will not leave.", change: { spirit: -11, hull: -6 } },
    { label: "BECALMED", text: "No wind, no cloud, no relief. The tanks drop.", change: { water: -9, spirit: -6 } },
  ],
  [
    { label: "CALM", text: "Quiet water. The raft drifts east.", change: {} },
    { label: "FLOTSAM", text: "A pallet of good timber bumps the hull.", change: { scrap: 8 } },
    { label: "CURRENT", text: "A warm current takes the raft and does the work for a day.", change: { spirit: 12, food: 6 } },
    { label: "TEMPEST", text: "The tempest takes the deck apart and nearly takes you.", change: { hull: -22, spirit: -10 }, storm: true },
    { label: "HEAT", text: "Windless heat. The water goes fast and so does your patience.", change: { water: -16, spirit: -5 } },
    { label: "SWARM", text: "Rats — actual rats — have found the stores.", change: { food: -18, spirit: -4 } },
    { label: "GALE", text: "A gale works at the lashings all night.", change: { hull: -14, spirit: -6 }, storm: true },
  ],
];

export function eventTier(day: number): number {
  return day <= 10 ? 0 : day <= 20 ? 1 : 2;
}

/**
 * Structures unlock on their day and are built by spending a whole day on the
 * work. Each pays a daily dividend, so the raft you build is the reason you
 * survive the back half of the run — and the day you spent is the reason
 * building is a decision instead of a formality.
 */
export const UPGRADES: { day: number; name: string; cost: number; yield: Partial<Stats>; blurb: string }[] = [
  { day: 3, name: "RAIN CATCHER", cost: 24, yield: { water: 5 }, blurb: "+5 water each day" },
  { day: 7, name: "SCRAP SHELTER", cost: 34, yield: { spirit: 3, hull: 1 }, blurb: "+3 spirit, +1 hull each day" },
  { day: 12, name: "SOLAR STILL", cost: 46, yield: { water: 5, food: 2 }, blurb: "+5 water, +2 food each day" },
  { day: 17, name: "GREENHOUSE", cost: 50, yield: { food: 9 }, blurb: "+9 food each day" },
  { day: 21, name: "RADIO TOWER", cost: 80, yield: { spirit: 4 }, blurb: "+4 spirit each day, and a way to call for help" },
];

/** What finishing a structure does to you on the spot, beyond its daily yield. */
export const BUILD_BONUS: Partial<Stats> = { hull: 8, spirit: 14 };

/** Combined daily output of everything standing on the deck. */
export function dividends(built: string[]): Partial<Stats> {
  const total: Partial<Stats> = {};
  for (const name of built) {
    const upgrade = UPGRADES.find((u) => u.name === name);
    if (!upgrade) continue;
    for (const [key, value] of Object.entries(upgrade.yield) as [StatKey, number][]) {
      total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function addStats(base: Stats, change: Partial<Stats>): Stats {
  return {
    food: clamp(base.food + (change.food ?? 0)),
    water: clamp(base.water + (change.water ?? 0)),
    spirit: clamp(base.spirit + (change.spirit ?? 0)),
    scrap: Math.max(0, Math.min(999, base.scrap + (change.scrap ?? 0))),
    hull: clamp(base.hull + (change.hull ?? 0)),
  };
}

export function diffStats(before: Stats, after: Stats): Partial<Stats> {
  return {
    food: after.food - before.food,
    water: after.water - before.water,
    spirit: after.spirit - before.spirit,
    hull: after.hull - before.hull,
    scrap: after.scrap - before.scrap,
  };
}

/** Small deterministic PRNG so a seed fully describes a run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The weather of a run, decided up front, so tomorrow's forecast can be shown
 * honestly. The *hand* is dealt fresh each day against your actual condition,
 * which is what keeps a losing run playable.
 */
export type Plan = {
  seed: number;
  events: GameEvent[];
};

/**
 * The roll a given gamble is measured against. It is keyed to the action as
 * well as the day: with one roll per day every risky option would succeed or
 * fail together, which quietly turns `risk` into a property of the calendar
 * instead of a property of the choice.
 */
export function rollFor(plan: Plan, day: number, choiceId: string): number {
  let h = (plan.seed ^ (day * 0x9e3779b1)) >>> 0;
  for (let i = 0; i < choiceId.length; i++) h = Math.imul(h ^ choiceId.charCodeAt(i), 0x01000193) >>> 0;
  return mulberry32(h)();
}

export function planRun(seed: number = Math.floor(Math.random() * 0xffffffff)): Plan {
  const rng = mulberry32(seed);
  const events: GameEvent[] = [];
  for (let day = 0; day <= TOTAL_DAYS; day++) {
    const tier = EVENT_TIERS[eventTier(day)];
    events.push(tier[Math.floor(rng() * tier.length)]);
  }
  return { seed, events };
}

export function costOf(choice: Choice): number {
  return Math.abs(Math.min(0, choice.change.scrap ?? 0));
}

export type Upgrade = (typeof UPGRADES)[number];

/**
 * The ladder is deliberately not a queue: rushing the tower and skipping the
 * greenhouse is a legitimate (and dangerous) plan, and letting the player
 * order the build is where the replay value of a thirty-day run lives.
 */
export function upgradeByName(name: string | null): Upgrade | null {
  return UPGRADES.find((u) => u.name === name) ?? null;
}

/** The cheapest thing you could still usefully aim at — the default target. */
export function suggestTarget(day: number, built: string[]): string | null {
  const open = UPGRADES.filter((u) => !built.includes(u.name));
  if (!open.length) return null;
  const unlocked = open.filter((u) => day >= u.day);
  return (unlocked.length ? unlocked : open).sort((a, b) => a.cost - b.cost)[0].name;
}

/** Whether the day's work can be spent raising the structure being aimed at. */
export function buildable(day: number, stats: Stats, built: string[], target: string | null): Upgrade | null {
  const u = upgradeByName(target);
  if (!u || built.includes(u.name)) return null;
  return day >= u.day && stats.scrap >= u.cost ? u : null;
}

/**
 * Deals the day's three survival actions: always affordable, and always
 * including something that answers whatever is closest to killing you.
 *
 * The build is deliberately NOT dealt here. It depends on what the player is
 * currently aiming at, which they can change at any moment, so it is composed
 * on top via `buildable` + `buildChoice` and stays live.
 */
export function dealHand(plan: Plan, day: number, stats: Stats, built: string[]): Choice[] {
  const rng = mulberry32((plan.seed ^ (day * 0x9e3779b1)) >>> 0);
  const affordable = CHOICES.filter((c) => costOf(c) <= stats.scrap);

  const needs: StatKey[] = ["food", "water", "hull", "spirit"];
  const urgency = (k: StatKey) => stats[k];
  const ranked = [...needs].sort((a, b) => urgency(a) - urgency(b));

  const hand: Choice[] = [];
  const take = (pool: Choice[]) => {
    const fresh = pool.filter((c) => !hand.some((h) => h.id === c.id));
    if (!fresh.length) return false;
    hand.push(fresh[Math.floor(rng() * fresh.length)]);
    return true;
  };

  // 1. the lifeline: something that answers the most urgent need
  take(affordable.filter((c) => c.covers === ranked[0]));
  // 2. cover the second-most urgent too, so there is a real triage decision
  take(affordable.filter((c) => c.covers === ranked[1]));
  // 3. a way to make progress rather than merely persist
  take(affordable.filter((c) => c.covers === "scrap"));
  // fill any gaps (e.g. everything scrap-costing is locked out)
  while (hand.length < 3 && take(affordable)) { /* keep dealing */ }
  while (hand.length < 3 && take(CHOICES)) { /* degenerate: nothing affordable */ }

  return hand;
}

/** The day's work turned into a structure. Split out so the UI can re-derive it
 *  the instant the player aims at a different build. */
export function buildChoice(upgrade: Upgrade): Choice {
  return {
    id: BUILD_ID,
    label: `RAISE ${upgrade.name}`,
    detail: `Spend the day and ${upgrade.cost} salvage. ${upgrade.blurb}, forever.`,
    tone: "#ffd479",
    covers: "scrap",
    change: { scrap: -upgrade.cost, ...BUILD_BONUS },
    log: `You spend the whole day on it. By dusk the ${upgrade.name.toLowerCase()} is standing.`,
  };
}

export type Resolution = {
  stats: Stats;
  delta: Partial<Stats>;
  /** What the player's own choice did. */
  message: string;
  /** What the sea did, independently — shown as its own beat. */
  eventText: string;
  failed: boolean;
  storm: boolean;
  built: string | null;
};

/** Applies a day: the choice (or its failure), the event, upkeep, then dividends. */
export function resolveDay(
  plan: Plan,
  day: number,
  stats: Stats,
  choice: Choice,
  built: string[],
  target: string | null = null,
): Resolution {
  const roll = rollFor(plan, day, choice.id);
  const failed = choice.risk !== undefined && roll < choice.risk;
  const outcome: Outcome = failed && choice.fail ? choice.fail : { log: choice.log, change: choice.change };

  const isBuild = choice.id === BUILD_ID;
  const raised = isBuild ? buildable(day, stats, built, target ?? suggestTarget(day, built)) : null;
  // your own labour is scaled by morale; a raised structure is not
  const effective = isBuild ? outcome.change : applyEffort(outcome.change, stats.spirit);

  let next = addStats(stats, effective);
  const event = plan.events[day] ?? EVENT_TIERS[0][0];
  next = addStats(next, event.change);
  next = addStats(next, upkeepFor(day));

  const standing = raised ? [...built, raised.name] : built;
  next = addStats(next, dividends(standing));

  return {
    stats: next,
    delta: diffStats(stats, next),
    message: outcome.log,
    eventText: event.text,
    failed,
    storm: Boolean(event.storm) || choice.id === "rain",
    built: raised ? raised.name : null,
  };
}

export function isDead(stats: Stats): boolean {
  return stats.food === 0 || stats.water === 0 || stats.hull === 0 || stats.spirit === 0;
}

/** Which need finished the run — lets the ending say something specific. */
export function causeOfDeath(stats: Stats): StatKey | null {
  if (stats.water === 0) return "water";
  if (stats.food === 0) return "food";
  if (stats.hull === 0) return "hull";
  if (stats.spirit === 0) return "spirit";
  return null;
}

/**
 * The raft that gets you rescued. Surviving thirty days is staying alive;
 * only a working transmitter turns that into a way home — so the last
 * structure is a real goal to chase through the worst of the weather, not a
 * footnote you build if the salvage happens to be lying around.
 */
export const RESCUE_STRUCTURE = "RADIO TOWER";

export type Finish = "rescued" | "adrift" | "lost";

export function finishFor(stats: Stats, built: string[]): Finish {
  if (isDead(stats)) return "lost";
  return built.includes(RESCUE_STRUCTURE) ? "rescued" : "adrift";
}
