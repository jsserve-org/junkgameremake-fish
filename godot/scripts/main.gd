extends Node
## Game loop for DRIFT/30 — ported from App.tsx.
## Owns the run state, drives the world and the logbook UI, handles keys.

const TOTAL_DAYS := DriftGame.TOTAL_DAYS

var world: DriftWorld
var ui: DriftUI

var plan: Dictionary
var day := 1
var stats: Dictionary
var built: Array = []
var hand: Array = []
var day_stats: Dictionary
var target: String = ""
var selected: String = ""
var ended: String = ""
var started := false
var muted := false
var storm := false
var message := ""
var event_text := ""
var story_text := ""
var deltas := {}
var run_id := 0
var journal: Array = []
var dolphin_spawned := false

## The build option is derived live, so re-aiming updates the deck immediately.
var actions: Array:
	get:
		var ready = DriftGame.buildable(day, day_stats, built, target)
		if ready != null:
			return hand + [DriftGame.build_choice(ready)]
		return hand


func _ready() -> void:
	world = DriftWorld.new()
	add_child(world)
	world.cam = Camera3D.new()
	world.cam.position = Vector3(0, 3.4, 9.4)
	world.cam.fov = 63.0
	world.add_child(world.cam)
	world.cam.current = true

	ui = DriftUI.new()
	add_child(ui)
	ui.action_picked.connect(_on_action_picked)
	ui.aim_changed.connect(_on_aim)
	ui.start_requested.connect(_on_start)
	ui.restart_requested.connect(restart)
	ui.mute_toggled.connect(_on_mute)
	ui.pause_restart_requested.connect(restart)
	world.hotspot_clicked.connect(_on_hotspot_clicked)

	_new_run(true)


func _new_run(first := false) -> void:
	run_id += 1
	plan = DriftGame.plan_run()
	day = 1
	stats = DriftGame.INITIAL.duplicate()
	built = []
	hand = DriftGame.deal_hand(plan, 1, stats, built)
	day_stats = stats.duplicate()
	target = str(DriftGame.suggest_target(1, built))
	selected = ""
	ended = ""
	deltas = {}
	storm = false
	story_text = ""
	journal = []
	dolphin_spawned = false
	message = "Thirty days. One raft. A day buys exactly one thing." if first else "A new drift. New weather, new luck. A day buys exactly one thing."
	event_text = ""
	_sync_world()
	_sync_ui()


func _sync_world() -> void:
	world.set_stage(mini(5, built.size()))
	world.set_built(built)
	world.set_storm(storm)
	world.set_ending(ended)
	world.set_action(selected)
	var specs: Array = []
	if started and ended == "":
		for c in actions:
			specs.append({
				"id": c["id"],
				"tone": c["tone"],
				"locked": DriftGame.cost_of(c) > stats["scrap"],
			})
	world.set_hotspots(specs)


func _sync_ui() -> void:
	var ready = DriftGame.buildable(day, day_stats, built, target)
	var forecast = plan["events"][day + 1] if day < TOTAL_DAYS else null
	var grit := int(round(DriftGame.effort(stats["spirit"]) * 100))
	var epilogue := DriftStory.epilogue(ended, stats) if ended != "" else ""
	ui.set_journal(journal)
	ui.set_state({
		"day": day,
		"total_days": TOTAL_DAYS,
		"stats": stats,
		"deltas": deltas,
		"built": built,
		"target": target,
		"goal": DriftGame.upgrade_by_name(target),
		"ready": ready != null,
		"forecast": forecast,
		"actions": actions,
		"selected": selected,
		"busy": selected != "",
		"started": started,
		"ended": ended,
		"message": message,
		"event_text": event_text,
		"story_text": story_text,
		"epilogue": epilogue,
		"upkeep": DriftGame.upkeep_for(day),
		"output": DriftGame.dividends(built),
		"grit": grit,
		"critical": stats["food"] <= 20 or stats["water"] <= 20 or stats["spirit"] <= 20 or stats["hull"] <= 20,
	})


# ---------------------------------------------------------------- input

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key: String = OS.get_keycode_string(event.keycode).to_lower()
		match key:
			"m":
				_on_mute()
			"enter", "space":
				if not started:
					_on_start()
				elif ended != "" and key == "enter":
					restart()
			"r":
				if ended != "":
					restart()
			_:
				if ui.blocking() or not started or ended != "" or selected != "":
					return
				if key.length() == 1 and key >= "1" and key <= "4":
					var index := int(key) - 1
					if index < actions.size():
						_choose(actions[index])


func _on_hotspot_clicked(id: String) -> void:
	if not started or ended != "" or selected != "" or ui.blocking():
		return
	for c in actions:
		if c["id"] == id:
			_choose(c)
			return


func _on_action_picked(index: int) -> void:
	if index < actions.size():
		_choose(actions[index])


func _on_aim(uname: String) -> void:
	Audio.play("click")
	target = uname
	_sync_world()
	_sync_ui()


func _on_start() -> void:
	if started:
		return
	Audio.play("click")
	started = true
	journal.append({"day": 0, "text": DriftStory.JOURNAL_PROLOGUE})
	var act := DriftStory.act_for(1)
	ui.show_act(act["title"], act["sub"])
	journal.append({"day": 1, "text": "%s — %s" % [act["title"], act["sub"]]})
	ui.open_prologue()
	_sync_world()
	_sync_ui()


func _on_mute() -> void:
	muted = not muted
	Audio.set_muted(muted)
	ui.set_muted(muted)


# ---------------------------------------------------------------- the day

func _choose(choice: Dictionary) -> void:
	if selected != "" or ended != "":
		return

	var cost := DriftGame.cost_of(choice)
	if cost > stats["scrap"]:
		message = "Not enough salvage — that plan needs %d." % cost
		event_text = ""
		Audio.play("deny")
		ui.shake()
		_sync_ui()
		return

	selected = choice["id"]
	Audio.play("click")
	Audio.play_action(selected)

	var rid := run_id
	var result := DriftGame.resolve_day(plan, day, stats, choice, built, target)
	var standing := built.duplicate()
	if result["built"] != null:
		standing.append(result["built"])
	storm = result["storm"]

	# --- storyline: day beats, structure epiphanies, the dolphin ---
	var beat := DriftStory.day_beat(day)
	if beat != "":
		journal.append({"day": day, "text": beat})
		story_text = beat
	if result["built"] != null:
		var sbeat := DriftStory.structure_beat(result["built"])
		if sbeat != "":
			journal.append({"day": day, "text": sbeat})
			story_text = sbeat
	var ev: Dictionary = plan["events"][day]
	if ev["label"] == "DOLPHINS" and not dolphin_spawned:
		dolphin_spawned = true
		world.spawn_dolphin()
		journal.append({"day": day, "text": DriftStory.DOLPHIN_BEAT})
		story_text = (story_text + "\n" if story_text != "" else "") + DriftStory.DOLPHIN_BEAT

	if result["failed"]:
		ui.show_setback()
	if storm:
		ui.shake()
	stats = result["stats"]
	message = result["message"]
	event_text = result["event_text"]
	deltas = result["delta"]

	world.pulse_up()
	_sync_world()
	_sync_ui()

	if result["built"] != null:
		var raised: String = result["built"]
		# timers pause with the tree, so pausing mid-resolution freezes the day
		await get_tree().create_timer(0.7, false).timeout
		if run_id != rid:
			return
		ui.show_toast(raised)
		Audio.play_upgrade()

	var order := ["food", "water", "spirit", "hull", "scrap"]
	var bursts: Array = []
	for k in order:
		if deltas.get(k, 0) != 0:
			bursts.append({"stat": k, "value": int(deltas[k])})
	ui.show_bursts(bursts)

	await get_tree().create_timer(1.5, false).timeout
	if run_id != rid:
		return

	storm = false
	deltas = {}
	if DriftGame.is_dead(stats):
		ended = "lost"
		Audio.play_lose()
	elif day >= TOTAL_DAYS:
		ended = DriftGame.finish_for(stats, standing)
		if ended == "rescued":
			Audio.play_win()
		else:
			Audio.play_upgrade()
	else:
		day += 1
		hand = DriftGame.deal_hand(plan, day, stats, standing)
		day_stats = stats
		built = standing
		story_text = ""
		# act transitions
		if day == DriftStory.ACTS[1]["day"] or day == DriftStory.ACTS[2]["day"]:
			var act := DriftStory.act_for(day)
			ui.show_act(act["title"], act["sub"])
			journal.append({"day": day, "text": "%s — %s" % [act["title"], act["sub"]]})
	if ended != "":
		journal.append({"day": day, "text": DriftStory.epilogue(ended, stats)})
	selected = ""
	_sync_world()
	_sync_ui()


func restart() -> void:
	run_id += 1
	_new_run(false)
