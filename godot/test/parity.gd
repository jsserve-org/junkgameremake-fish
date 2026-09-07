extends SceneTree
## Parity test: plays fixed-policy runs against the TS implementation.

func _initialize() -> void:
	var G: GDScript = load("res://scripts/game.gd")
	for seed in [1, 2, 3, 42, 123456789]:
		var plan: Dictionary = G.plan_run(seed)
		var stats: Dictionary = G.INITIAL.duplicate()
		var built: Array = []
		var day := 1
		while day <= G.TOTAL_DAYS:
			var hand: Array = G.deal_hand(plan, day, stats, built)
			if hand.is_empty():
				break
			var choice: Dictionary = hand[0]
			var r: Dictionary = G.resolve_day(plan, day, stats, choice, built, "")
			stats = r["stats"]
			if r["built"] != null:
				built.append(r["built"])
			print("%d|%d|%d|%d|%d|%d|%d|%s|%s" % [seed, day, int(stats["food"]), int(stats["water"]), int(stats["spirit"]), int(stats["scrap"]), int(stats["hull"]), r["failed"], r["built"] if r["built"] != null else "-"])
			if G.is_dead(stats):
				break
			day += 1
		print("%d|END|%s|%s" % [seed, G.finish_for(stats, built), built])
	quit(0)
