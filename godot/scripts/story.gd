class_name DriftStory
## The storyline for DRIFT/30: a prologue, three acts, journal beats that
## surface as the drift wears on, and an epilogue for every way it can end.

const PROLOGUE := [
	"The Sable Ann went down at 03:40 on a black sea. No distress call got out — the antenna went with the mast, and the mast went with the lightning.",
	"You woke on the raft with the sunrise: two hands, a knife, a net, and forty feet of salvaged line. The wreck is somewhere below you, leaking everything you own.",
	"Thirty days of daylight before the monsoon season closes the shipping lanes. Get water. Get food. Get salvage. Build something that can shout.",
]

const JOURNAL_PROLOGUE := "The Sable Ann went down at 03:40. You woke on the sea, on a raft the storm built out of her bones. Thirty days of daylight. Count them."

const ACTS := [
	{"day": 1, "title": "ACT I · ADRIFT", "sub": "Count the days. Tally what is left."},
	{"day": 11, "title": "ACT II · THE BUILDER", "sub": "The sea has taken its measure of you. Return the favor."},
	{"day": 21, "title": "ACT III · THE GAUNTLET", "sub": "The weather knows what you are building. It is coming to stop you."},
]

## Journal entries that surface on these days, as the drift wears on.
const DAY_BEATS := {
	5: "Five days out. Your hands have stopped shaking. You have started naming the fish, which is either a bad sign or a good one.",
	10: "Ten days. A third of the drift, gone. The horizon has become a place you visit rather than a hope you hold.",
	15: "Halfway. You caught yourself singing to the purifier. It hums back, off-key. Company is where you find it.",
	20: "Twenty days. The tally marks on the rail outnumber the planks now. The weather is only getting started, and so, apparently, are you.",
	25: "Five days left. You lash the same knot for the hundredth time and it holds, and that feels like a conversation.",
	29: "One more sunrise after this one. Whatever is standing on this raft at dusk tomorrow is the rest of your life.",
}

## What raising each structure means, past the numbers.
const STRUCTURE_BEATS := {
	"RAIN CATCHER": "The tarp drinks the sky. Tonight you drink its savings — the first sweet water since the wreck.",
	"SCRAP SHELTER": "Walls. Actual walls. You hang the flares inside like picture frames and sleep dry for the first time in weeks.",
	"SOLAR STILL": "The panel wakes with a green blink. Machines can be company too, if you don't look too closely at what they're thinking.",
	"GREENHOUSE": "Green, on the ocean. Ten tomato plants and a pepper that owes you nothing and gives anyway.",
	"RADIO TOWER": "It stands taller than you — taller than hope, which until now was the tallest thing on board. You key the transmitter and count the sweep seconds like heartbeats.",
}

const DOLPHIN_BEAT := "The dolphin came back at dawn. You have started calling her Compass. She steers a lazy circle around the raft, keeping time with you."

const EPILOGUE_RESCUED := "On the third sweep, a freighter answers in crude static. You say your name out loud, twice, to be sure you remember it. When the helicopter lowers the basket you make them wait — the tomatoes come too."

const EPILOGUE_ADRIFT := "Day thirty. The tally is finished and so are you — alive, though. The sea rolls on and so, against all odds, do you. Somewhere north there is a lane where ships pass. You point the raft at it and start to paddle."

const EPILOGUE_LOST := {
	"water": "The tanks ran dry on a calm morning. The sea kept its oldest joke: so much water, and not a drop that forgives.",
	"food": "The stores went quietly, one honest handful at a time. The sea does not starve you on purpose. It simply forgets to feed you.",
	"hull": "The raft came apart the way a sentence does — a word at a time, until the meaning was gone. The last plank held you a moment longer than it should have.",
	"spirit": "There was no storm that day. That was the trouble. You stopped bailing in the calm, and the calm closed over the work like water over a stone.",
	"scrap": "The raft came apart the way a sentence does — a word at a time, until the meaning was gone.",
}


static func act_for(day: int) -> Dictionary:
	var act: Dictionary = ACTS[0]
	for a in ACTS:
		if day >= a["day"]:
			act = a
	return act


static func day_beat(day: int) -> String:
	return DAY_BEATS.get(day, "")


static func structure_beat(name: String) -> String:
	return STRUCTURE_BEATS.get(name, "")


static func epilogue(kind: String, stats: Dictionary) -> String:
	if kind == "rescued":
		return EPILOGUE_RESCUED
	if kind == "adrift":
		return EPILOGUE_ADRIFT
	var cause = DriftGame.cause_of_death(stats)
	return EPILOGUE_LOST.get(cause if cause != null else "scrap", "")
