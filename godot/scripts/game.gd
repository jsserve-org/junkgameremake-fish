class_name DriftGame
## Game rules for DRIFT 30, ported from src/game.ts.
##
## Every run is driven by a seed, so the weather and the outcome of each
## gamble differ between playthroughs. You are always short of something;
## each day you get a hand of three actions and may take exactly one.

const INITIAL := {"food": 64, "water": 60, "spirit": 72, "scrap": 14, "hull": 80}

const TOTAL_DAYS := 30

const BUILD_ID := "build"
const RESCUE_STRUCTURE := "RADIO TOWER"

## What finishing a structure does to you on the spot, beyond its daily yield.
const BUILD_BONUS := {"hull": 8, "spirit": 14}

## The drift wears you down: hunger and thirst climb in four steps.
const UPKEEP_STEPS := [
	{"from": 1, "food": -8, "water": -9},
	{"from": 9, "food": -10, "water": -11},
	{"from": 17, "food": -12, "water": -13},
	{"from": 25, "food": -14, "water": -15},
]

const CHOICES := [
	{
		"id": "fish", "label": "CAST THE NET",
		"detail": "A reliable meal. If the sea cooperates.",
		"tone": "#ffad3f", "covers": "food",
		"change": {"food": 30, "spirit": 3},
		"log": "The net comes up silver and wriggling.",
		"risk": 0.2,
		"fail": {"log": "The net snags and tears. You eat what you can find.", "change": {"food": 9, "spirit": -6}},
	},
	{
		"id": "salvage", "label": "HOOK THE JUNK",
		"detail": "Parts build a future. Rust cuts deep.",
		"tone": "#a8ef3c", "covers": "scrap",
		"change": {"scrap": 26, "spirit": -3},
		"log": "A good haul: wire, timber, and one decent hinge.",
		"risk": 0.22,
		"fail": {"log": "The hook comes back empty and your hands come back bloody.", "change": {"scrap": 7, "spirit": -8}},
	},
	{
		"id": "purify", "label": "RUN PURIFIER",
		"detail": "Clean water costs spare parts.",
		"tone": "#48d8ff", "covers": "water",
		"change": {"water": 34, "scrap": -7},
		"log": "The filter coughs, then runs crystal clear.",
	},
	{
		"id": "repair", "label": "PATCH THE RAFT",
		"detail": "Spend scrap before the sea takes it all.",
		"tone": "#ff7b42", "covers": "hull",
		"change": {"hull": 30, "scrap": -10},
		"log": "The deck creaks less. That counts as progress.",
	},
	{
		"id": "bail", "label": "BAIL AND LASH",
		"detail": "No parts needed. Just your back.",
		"tone": "#c98f5a", "covers": "hull",
		"change": {"hull": 16, "spirit": -4},
		"log": "You bail her dry and re-lash the deck by hand.",
	},
	{
		"id": "dive", "label": "DIVE THE WRECK",
		"detail": "Big haul. Bigger risk.",
		"tone": "#8bdcff", "covers": "scrap",
		"change": {"scrap": 38, "hull": -6, "spirit": -8},
		"log": "You surface with a battery and a new fear of eels.",
		"risk": 0.32,
		"fail": {"log": "Something moved down there. You surface with nothing but panic.", "change": {"scrap": 6, "hull": -12, "spirit": -20}},
	},
	{
		"id": "rest", "label": "TAKE IT EASY",
		"detail": "A quiet day steadies the nerves.",
		"tone": "#f9dd72", "covers": "spirit",
		"change": {"spirit": 30, "food": -4},
		"log": "For one afternoon, the ocean feels almost kind.",
	},
	{
		"id": "rain", "label": "CATCH THE RAIN",
		"detail": "Fill every bucket you own.",
		"tone": "#7cc8ff", "covers": "water",
		"change": {"water": 26, "spirit": -2},
		"log": "The storm leaves you soaked, but the tanks are full.",
		"risk": 0.2,
		"fail": {"log": "The squall passes to the north. Your buckets stay dry.", "change": {"water": 7, "spirit": -6}},
	},
	{
		"id": "signal", "label": "LIGHT A FLARE",
		"detail": "Hope is useful. Flares are not reusable.",
		"tone": "#ff5f50", "covers": "spirit",
		"change": {"spirit": 26, "scrap": -5},
		"log": "No ship answers. Still, someone might have seen.",
	},
]

## The sea gets meaner. Early weather is scenery; late weather is the thing
## that kills you. Tomorrow's event is pre-rolled and shown as a forecast.
const EVENT_TIERS := [
	[
		{"label": "CALM", "text": "Quiet water. The raft drifts east.", "change": {}},
		{"label": "FISH RUN", "text": "A school of flying fish lands on deck.", "change": {"food": 12}},
		{"label": "DOLPHINS", "text": "Dolphins pace the raft until sunset.", "change": {"spirit": 10}},
		{"label": "SQUALL", "text": "A hard squall tears through the lashings.", "change": {"hull": -8, "spirit": -4}, "storm": true},
		{"label": "SALT", "text": "Salt gets into the purifier intake.", "change": {"water": -6, "scrap": -4}},
		{"label": "FLOTSAM", "text": "A pallet of good timber bumps the hull.", "change": {"scrap": 8}},
	],
	[
		{"label": "CALM", "text": "Quiet water. The raft drifts east.", "change": {}},
		{"label": "DOLPHINS", "text": "Dolphins pace the raft until sunset.", "change": {"spirit": 10}},
		{"label": "FLOTSAM", "text": "A pallet of good timber bumps the hull.", "change": {"scrap": 8}},
		{"label": "GALE", "text": "A gale works at the lashings all night.", "change": {"hull": -14, "spirit": -6}, "storm": true},
		{"label": "ROT", "text": "The stores have turned. Half of it goes over the side.", "change": {"food": -14}},
		{"label": "SHARK", "text": "Something big circles the raft and will not leave.", "change": {"spirit": -11, "hull": -6}},
		{"label": "BECALMED", "text": "No wind, no cloud, no relief. The tanks drop.", "change": {"water": -9, "spirit": -6}},
	],
	[
		{"label": "CALM", "text": "Quiet water. The raft drifts east.", "change": {}},
		{"label": "FLOTSAM", "text": "A pallet of good timber bumps the hull.", "change": {"scrap": 8}},
		{"label": "CURRENT", "text": "A warm current takes the raft and does the work for a day.", "change": {"spirit": 12, "food": 6}},
		{"label": "TEMPEST", "text": "The tempest takes the deck apart and nearly takes you.", "change": {"hull": -22, "spirit": -10}, "storm": true},
		{"label": "HEAT", "text": "Windless heat. The water goes fast and so does your patience.", "change": {"water": -16, "spirit": -5}},
		{"label": "SWARM", "text": "Rats — actual rats — have found the stores.", "change": {"food": -18, "spirit": -4}},
		{"label": "GALE", "text": "A gale works at the lashings all night.", "change": {"hull": -14, "spirit": -6}, "storm": true},
	],
]

## Structures unlock on their day and are built by spending a whole day.
const UPGRADES := [
	{"day": 3, "name": "RAIN CATCHER", "cost": 24, "yield": {"water": 5}, "blurb": "+5 water each day"},
	{"day": 7, "name": "SCRAP SHELTER", "cost": 34, "yield": {"spirit": 3, "hull": 1}, "blurb": "+3 spirit, +1 hull each day"},
	{"day": 12, "name": "SOLAR STILL", "cost": 46, "yield": {"water": 5, "food": 2}, "blurb": "+5 water, +2 food each day"},
	{"day": 17, "name": "GREENHOUSE", "cost": 50, "yield": {"food": 9}, "blurb": "+9 food each day"},
	{"day": 21, "name": "RADIO TOWER", "cost": 80, "yield": {"spirit": 4}, "blurb": "+4 spirit each day, and a way to call for help"},
]


class Mulberry:
	## Small deterministic PRNG so a seed fully describes a run.
	var a: int

	func _init(seed_: int) -> void:
		a = seed_ & 0xFFFFFFFF

	func next() -> float:
		a = (a + 0x6d2b79f5) & 0xFFFFFFFF
		var t := a
		t = DriftGame.imul32(t ^ (t >> 15), t | 1) & 0xFFFFFFFF
		t = (t ^ ((t + DriftGame.imul32(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
		t = (t ^ (t >> 14)) & 0xFFFFFFFF
		return float(t) / 4294967296.0


## JS Math.imul: exact 32-bit integer multiply, returned unsigned.
static func imul32(x: int, y: int) -> int:
	var al := x & 0xFFFF
	var ah := (x >> 16) & 0xFFFF
	var bl := y & 0xFFFF
	var bh := (y >> 16) & 0xFFFF
	var high := ah * bl + al * bh
	var low := al * bl
	return ((high << 16) + low) & 0xFFFFFFFF


static func upkeep_for(day: int) -> Dictionary:
	var step: Dictionary = UPKEEP_STEPS[0]
	for s in UPKEEP_STEPS:
		if day >= s["from"]:
			step = s
	return {
		"food": step["food"], "water": step["water"], "spirit": -2,
		"hull": -2 if day >= 17 else -1,
	}


## Morale is a multiplier on your own labour, not a fifth death clock.
static func effort(spirit: float) -> float:
	return 0.62 + 0.58 * (spirit / 100.0)


## Scales the upside of an action by morale. Costs and damage are never scaled.
static func apply_effort(change: Dictionary, spirit: float) -> Dictionary:
	var k := effort(spirit)
	var out := {}
	for key in change:
		var v: float = change[key]
		out[key] = roundf(v * k) if v > 0 else v
	return out


static func event_tier(day: int) -> int:
	return 0 if day <= 10 else (1 if day <= 20 else 2)


## Combined daily output of everything standing on the deck.
static func dividends(built: Array) -> Dictionary:
	var total := {}
	for uname in built:
		var upgrade: Variant = upgrade_by_name(uname)
		if upgrade == null:
			continue
		for key in upgrade["yield"]:
			total[key] = total.get(key, 0) + upgrade["yield"][key]
	return total


static func add_stats(base: Dictionary, change: Dictionary) -> Dictionary:
	var clamped := func(n: float) -> float: return clampf(n, 0.0, 100.0)
	return {
		"food": clamped.call(base["food"] + change.get("food", 0.0)),
		"water": clamped.call(base["water"] + change.get("water", 0.0)),
		"spirit": clamped.call(base["spirit"] + change.get("spirit", 0.0)),
		"scrap": clampf(base["scrap"] + change.get("scrap", 0.0), 0.0, 999.0),
		"hull": clamped.call(base["hull"] + change.get("hull", 0.0)),
	}


static func diff_stats(before: Dictionary, after: Dictionary) -> Dictionary:
	var out := {}
	for key in before:
		out[key] = after[key] - before[key]
	return out


static func cost_of(choice: Dictionary) -> int:
	return absi(mini(0, choice["change"].get("scrap", 0)))


static func upgrade_by_name(name) -> Variant:
	if name == null or name == "":
		return null
	for u in UPGRADES:
		if u["name"] == name:
			return u
	return null


## The cheapest thing you could still usefully aim at — the default target.
static func suggest_target(day: int, built: Array) -> Variant:
	var open: Array = []
	for u in UPGRADES:
		if not built.has(u["name"]):
			open.append(u)
	if open.is_empty():
		return null
	var unlocked: Array = open.filter(func(u): return day >= u["day"])
	var pool: Array = unlocked if not unlocked.is_empty() else open
	pool.sort_custom(func(a, b): return a["cost"] < b["cost"])
	return pool[0]["name"]


## Whether the day's work can be spent raising the structure being aimed at.
static func buildable(day: int, stats: Dictionary, built: Array, target) -> Variant:
	var u: Variant = upgrade_by_name(target)
	if u == null or built.has(u["name"]):
		return null
	if day >= u["day"] and stats["scrap"] >= u["cost"]:
		return u
	return null


static func _take(hand: Array, pool: Array, rng) -> bool:
	var fresh: Array = []
	for c in pool:
		var dup := false
		for h in hand:
			if h["id"] == c["id"]:
				dup = true
				break
		if not dup:
			fresh.append(c)
	if fresh.is_empty():
		return false
	hand.append(fresh[int(rng.next() * fresh.size())])
	return true


## Deals the day's three survival actions: always affordable, and always
## including something that answers whatever is closest to killing you.
## The build is composed on top via `buildable` + `build_choice`.
static func deal_hand(plan: Dictionary, day: int, stats: Dictionary, built: Array) -> Array:
	var rng := Mulberry.new((plan["seed"] ^ (day * 0x9e3779b1)) & 0xFFFFFFFF)
	var affordable: Array = CHOICES.filter(func(c): return cost_of(c) <= stats["scrap"])

	var ranked := ["food", "water", "hull", "spirit"]
	ranked.sort_custom(func(a, b): return stats[a] < stats[b])

	var hand: Array = []
	# 1. the lifeline: something that answers the most urgent need
	_take(hand, affordable.filter(func(c): return c["covers"] == ranked[0]), rng)
	# 2. cover the second-most urgent too, so there is a real triage decision
	_take(hand, affordable.filter(func(c): return c["covers"] == ranked[1]), rng)
	# 3. a way to make progress rather than merely persist
	_take(hand, affordable.filter(func(c): return c["covers"] == "scrap"), rng)
	# fill any gaps (e.g. everything scrap-costing is locked out)
	while hand.size() < 3 and _take(hand, affordable, rng):
		pass
	while hand.size() < 3 and _take(hand, CHOICES, rng):
		pass
	return hand


## The day's work turned into a structure.
static func build_choice(upgrade: Dictionary) -> Dictionary:
	var change := {"scrap": -upgrade["cost"]}
	for key in BUILD_BONUS:
		change[key] = BUILD_BONUS[key]
	return {
		"id": BUILD_ID,
		"label": "RAISE %s" % upgrade["name"],
		"detail": "Spend the day and %d salvage. %s, forever." % [upgrade["cost"], upgrade["blurb"]],
		"tone": "#ffd479",
		"covers": "scrap",
		"change": change,
		"log": "You spend the whole day on it. By dusk the %s is standing." % String(upgrade["name"]).to_lower(),
	}


## The roll a given gamble is measured against, keyed to action and day.
static func roll_for(plan: Dictionary, day: int, choice_id: String) -> float:
	var h := (int(plan["seed"]) ^ (day * 0x9e3779b1)) & 0xFFFFFFFF
	for i in choice_id.length():
		h = imul32(h ^ choice_id.unicode_at(i), 0x01000193)
	var rng := Mulberry.new(h)
	return rng.next()


static func plan_run(seed_ := -1) -> Dictionary:
	if seed_ < 0:
		seed_ = randi() & 0xFFFFFFFF
	var rng := Mulberry.new(seed_)
	var events: Array = []
	for day in TOTAL_DAYS + 1:
		var tier: Array = EVENT_TIERS[event_tier(day)]
		events.append(tier[int(rng.next() * tier.size())])
	return {"seed": seed_, "events": events}


## Applies a day: the choice (or its failure), the event, upkeep, then dividends.
static func resolve_day(plan: Dictionary, day: int, stats: Dictionary, choice: Dictionary, built: Array, target: String = "") -> Dictionary:
	var roll := roll_for(plan, day, choice["id"])
	var failed: bool = choice.has("risk") and roll < choice["risk"]
	var outcome: Dictionary = choice["fail"] if (failed and choice.has("fail")) else {"log": choice["log"], "change": choice["change"]}

	var is_build: bool = choice["id"] == BUILD_ID
	var raised = null
	if is_build:
		raised = buildable(day, stats, built, target if target != "" else suggest_target(day, built))
	# your own labour is scaled by morale; a raised structure is not
	var effective: Dictionary = outcome["change"] if is_build else apply_effort(outcome["change"], stats["spirit"])

	var next := add_stats(stats, effective)
	var event: Dictionary = plan["events"][day] if day < plan["events"].size() else EVENT_TIERS[0][0]
	next = add_stats(next, event["change"])
	next = add_stats(next, upkeep_for(day))

	var standing := built.duplicate()
	if raised != null:
		standing.append(raised["name"])
	next = add_stats(next, dividends(standing))

	return {
		"stats": next,
		"delta": diff_stats(stats, next),
		"message": outcome["log"],
		"event_text": event["text"],
		"failed": failed,
		"storm": bool(event.get("storm", false)) or choice["id"] == "rain",
		"built": raised["name"] if raised != null else null,
	}


static func is_dead(stats: Dictionary) -> bool:
	return stats["food"] <= 0 or stats["water"] <= 0 or stats["hull"] <= 0 or stats["spirit"] <= 0


## Which need finished the run — lets the ending say something specific.
static func cause_of_death(stats: Dictionary) -> Variant:
	if stats["water"] <= 0:
		return "water"
	if stats["food"] <= 0:
		return "food"
	if stats["hull"] <= 0:
		return "hull"
	if stats["spirit"] <= 0:
		return "spirit"
	return null


## Surviving thirty days is staying alive; only a working transmitter is a way home.
static func finish_for(stats: Dictionary, built: Array) -> String:
	if is_dead(stats):
		return "lost"
	return "rescued" if built.has(RESCUE_STRUCTURE) else "adrift"
