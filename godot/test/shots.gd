extends SceneTree
## Screenshot harness: captures title, prologue, action, journal, act, ending.

var main: Node
var frame := 0


func _initialize() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	process_frame.connect(_tick)


func _shot(name: String) -> void:
	var img: Image = root.get_texture().get_image()
	img.save_png("/tmp/drift30_%s.png" % name)
	print("SHOT: ", name)


func _tick() -> void:
	frame += 1
	if frame == 40:
		_shot("title")
		main._on_start()
	if frame == 80:
		_shot("prologue")
	if frame == 90 or frame == 100 or frame == 110:
		main.ui._prologue_next()
	if frame == 130:
		main._choose(main.actions[main.actions.size() - 1])
	if frame == 200:
		_shot("action")
	if frame == 210:
		main.ui.toggle_journal()
	if frame == 240:
		_shot("journal")
		main.ui.toggle_journal()
	if frame == 250:
		main.ui.show_act("ACT II · THE BUILDER", "The sea has taken its measure of you. Return the favor.")
	if frame == 290:
		_shot("act")
	if frame == 300:
		main.ended = "rescued"
		main._sync_world()
		main._sync_ui()
	if frame == 380:
		_shot("ending")
		quit(0)
