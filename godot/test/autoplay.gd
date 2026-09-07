extends SceneTree
## Autoplay test: drives the real main scene through a full run headlessly.

var main: Node
var frame := 0
var restarts := 0


func _initialize() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	process_frame.connect(_tick)


func _tick() -> void:
	frame += 1
	if frame == 5:
		main._on_start()
	if frame % 40 == 0 and main.started and main.ended == "" and main.selected == "":
		if not main.actions.is_empty():
			main._choose(main.actions[main.actions.size() - 1])
	if main.ended != "" and restarts == 0:
		restarts = 1
		print("AUTOPLAY: ended (%s) on day %d, restarting..." % [main.ended, main.day])
		main.restart()
		frame = 0
	if frame > 9000:
		print("AUTOPLAY: timeout at day %d" % main.day)
		quit(1)
	if restarts == 1 and frame > 400 and main.day >= 3:
		print("AUTOPLAY: OK — reached day %d after restart" % main.day)
		quit(0)
