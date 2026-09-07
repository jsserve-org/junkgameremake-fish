class_name DriftUI
extends CanvasLayer
## "The logbook" interface for DRIFT/30 — ported from App.tsx + styles.css.
## Built in code: a paper log, a salvaged gauge board, and manila tags.

signal action_picked(index: int)
signal aim_changed(upgrade_name: String)
signal start_requested
signal restart_requested
signal mute_toggled
signal pause_restart_requested

const PAPER := Color("#ecdfc2")
const PAPER2 := Color("#dcc9a4")
const PAPER3 := Color("#c9b68f")
const INK := Color("#16252a")
const ABYSS := Color("#05161c")
const BRASS := Color("#d8a93f")
const RUST := Color("#b64d29")
const SIGNAL := Color("#ff6a3c")

const STAT_META := {
	"food": {"color": Color("#dd9331"), "short": "FOOD"},
	"water": {"color": Color("#4fb0c6"), "short": "WATER"},
	"spirit": {"color": Color("#cf5a58"), "short": "SPIRIT"},
	"hull": {"color": Color("#93a06a"), "short": "HULL"},
	"scrap": {"color": Color("#f2c14e"), "short": "SALVAGE"},
}
const STAT_ORDER := ["food", "water", "spirit", "hull", "scrap"]

const DEATH_LINE := {
	"food": "The stores ran out. Hunger finished what the sea started.",
	"water": "The tanks ran dry. Salt water is not an option, and you knew it.",
	"hull": "The raft came apart under you, plank by plank.",
	"spirit": "You stopped bailing. Some mornings there is simply nothing left.",
	"scrap": "The raft came apart under you, plank by plank.",
}

var root: Control
var hud: Control
var title_layer: Control
var tally: TallyControl
var day_label: Label
var left_label: Label
var toll_row: HBoxContainer
var forecast_panel: PanelContainer
var forecast_name: Label
var forecast_row: HBoxContainer
var board: VBoxContainer
var tubes := {}
var salvage_value: Label
var salvage_delta: Label
var goal_panel: PanelContainer
var goal_kicker: Label
var goal_name: Label
var goal_bar: Control
var goal_note: Label
var ladder: VBoxContainer
var output_row: HBoxContainer
var output_panel: PanelContainer
var tag_row: HBoxContainer
var log_head_day: Label
var log_message: Label
var log_event: Label
var prompt: Label
var ending_layer: Control
var ending_title: Label
var ending_body: Label
var ending_stats: Label
var danger_edge: Panel
var toast_panel: PanelContainer
var toast_name: Label
var mute_btn: Button
var burst_layer: Control
var journal_btn: Button
var journal_layer: Control
var journal_list: VBoxContainer
var journal_entries: Array = []
var prologue_layer: Control
var prologue_text: Label
var prologue_page_label: Label
var prologue_page := 0
var act_layer: Control
var act_title: Label
var act_sub: Label
var log_story: Label
var setback_panel: PanelContainer
var pause_layer: Control
var paused := false


func _ready() -> void:
	# the UI keeps running (and listens for Esc/F11) while the tree is paused
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_build_vignette()
	_build_header()
	_build_footer()
	_build_board()
	_build_right_rail()
	_build_log()
	_build_tag_row()
	_build_bursts()
	_build_toast()
	_build_danger_edge()
	_build_title()
	_build_ending()
	_build_journal()
	_build_prologue()
	_build_act_card()
	_build_setback()
	_build_pause()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key := OS.get_keycode_string(event.keycode).to_lower()
		if key == "escape":
			if journal_layer.visible:
				toggle_journal()
			else:
				_toggle_pause()
		elif key == "f11":
			var mode := DisplayServer.window_get_mode()
			DisplayServer.window_set_mode(
				DisplayServer.WINDOW_MODE_WINDOWED if mode == DisplayServer.WINDOW_MODE_FULLSCREEN
				else DisplayServer.WINDOW_MODE_FULLSCREEN)


func _toggle_pause() -> void:
	if title_layer.visible or ending_layer.visible or prologue_layer.visible:
		return
	paused = not paused
	get_tree().paused = paused
	pause_layer.visible = paused


# ---------------------------------------------------------------- pause

func _build_pause() -> void:
	pause_layer = Control.new()
	pause_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_layer.visible = false
	root.add_child(pause_layer)
	var dim := ColorRect.new()
	dim.color = Color(0.016, 0.078, 0.102, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	pause_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.add_theme_stylebox_override("panel", _sb(Color(0.925, 0.875, 0.765, 0.98), Color("#b6a077"), 1, 20.0))
	pause_layer.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	col.custom_minimum_size = Vector2(240, 0)
	panel.add_child(col)
	var mark := _lbl(col, "PAUSED", 26, INK)
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	var resume := _pause_button("RESUME")
	resume.pressed.connect(_toggle_pause)
	col.add_child(resume)
	var restart := _pause_button("DRIFT AGAIN")
	restart.pressed.connect(func():
		paused = false
		get_tree().paused = false
		pause_layer.visible = false
		pause_restart_requested.emit())
	col.add_child(restart)
	var quit := _pause_button("QUIT TO DESKTOP")
	quit.pressed.connect(func(): get_tree().quit())
	col.add_child(quit)
	_lbl(col, "F11 fullscreen · Esc resume", 10, PAPER3).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func _pause_button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", 14)
	b.add_theme_color_override("font_color", INK)
	b.add_theme_stylebox_override("normal", _sb(BRASS, INK, 1, 8.0))
	b.add_theme_stylebox_override("hover", _sb(BRASS.lightened(0.15), INK, 1, 8.0))
	b.add_theme_stylebox_override("pressed", _sb(BRASS.darkened(0.15), INK, 1, 8.0))
	return b
	_build_setback()


func _process(_delta: float) -> void:
	pass


# ---------------------------------------------------------------- helpers

func _sb(bg: Color, border := Color.TRANSPARENT, bw := 0, margin := 8.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_content_margin_all(margin)
	return sb


func _lbl(parent: Control, text: String, size: int, color := PAPER) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	parent.add_child(l)
	return l


func _chip(parent: Control, text: String, color: Color, up: bool) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", INK)
	var sb := _sb(color.lightened(0.25) if up else color.darkened(0.35), Color(0, 0, 0, 0.35), 1, 2.0)
	sb.content_margin_left = 5
	sb.content_margin_right = 5
	l.add_theme_stylebox_override("normal", sb)
	parent.add_child(l)
	return l


func _make_chips(change: Dictionary) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	for k in STAT_ORDER:
		var v := int(change.get(k, 0))
		if v == 0:
			continue
		_chip(row, ("+" if v > 0 else "") + str(v), STAT_META[k]["color"], v > 0)
	return row


func _vignette_tex(flip := false) -> TextureRect:
	var grad := Gradient.new()
	grad.colors = PackedColorArray([Color(0.016, 0.078, 0.102, 0.9), Color(0.016, 0.078, 0.102, 0.0)])
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.fill_from = Vector2(0, 1 if flip else 0)
	tex.fill_to = Vector2(0, 0 if flip else 1)
	var tr := TextureRect.new()
	tr.texture = tex
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	return tr


# ---------------------------------------------------------------- sections

func _build_vignette() -> void:
	root.add_child(_vignette_tex(false))
	root.add_child(_vignette_tex(true))

	danger_edge = Panel.new()
	danger_edge.set_anchors_preset(Control.PRESET_FULL_RECT)
	danger_edge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var dsb := _sb(Color(0, 0, 0, 0), Color(1.0, 0.416, 0.235, 0.4), 40, 0.0)
	danger_edge.add_theme_stylebox_override("panel", dsb)
	danger_edge.visible = false
	root.add_child(danger_edge)


func _build_header() -> void:
	var edge := 44.0 if DisplayServer.is_touchscreen_available() else 16.0
	var rail := VBoxContainer.new()
	rail.set_anchors_preset(Control.PRESET_TOP_WIDE)
	rail.offset_left = edge
	rail.offset_right = -edge
	rail.offset_top = 12
	rail.add_theme_constant_override("separation", 8)
	rail.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(rail)

	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rail.add_child(top)
	var mark := HBoxContainer.new()
	mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(mark)
	var m1 := _lbl(mark, "DRIFT", 23)
	m1.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	m1.add_theme_constant_override("shadow_offset_y", 2)
	var m2 := _lbl(mark, "30", 23, BRASS)
	m2.add_theme_constant_override("separation", 0)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(spacer)
	if DisplayServer.is_touchscreen_available():
		var pause_btn := Button.new()
		pause_btn.text = "PAUSE"
		pause_btn.add_theme_font_size_override("font_size", 12)
		pause_btn.add_theme_color_override("font_color", PAPER)
		pause_btn.add_theme_stylebox_override("normal", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.24), 1, 8.0))
		pause_btn.add_theme_stylebox_override("hover", _sb(Color(0.02, 0.086, 0.11, 0.85), Color(0.925, 0.875, 0.765, 0.4), 1, 8.0))
		pause_btn.add_theme_stylebox_override("pressed", _sb(Color(0.02, 0.086, 0.11, 0.95), BRASS, 1, 8.0))
		pause_btn.pressed.connect(_toggle_pause)
		top.add_child(pause_btn)
	journal_btn = Button.new()
	journal_btn.text = "JOURNAL"
	journal_btn.add_theme_font_size_override("font_size", 12)
	journal_btn.add_theme_color_override("font_color", PAPER)
	journal_btn.add_theme_stylebox_override("normal", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.24), 1, 8.0))
	journal_btn.add_theme_stylebox_override("hover", _sb(Color(0.02, 0.086, 0.11, 0.85), Color(0.925, 0.875, 0.765, 0.4), 1, 8.0))
	journal_btn.add_theme_stylebox_override("pressed", _sb(Color(0.02, 0.086, 0.11, 0.95), BRASS, 1, 8.0))
	journal_btn.pressed.connect(toggle_journal)
	top.add_child(journal_btn)
	mute_btn = Button.new()
	mute_btn.text = "SOUND ON"
	mute_btn.add_theme_font_size_override("font_size", 12)
	mute_btn.add_theme_color_override("font_color", PAPER)
	mute_btn.add_theme_stylebox_override("normal", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.24), 1, 8.0))
	mute_btn.add_theme_stylebox_override("hover", _sb(Color(0.02, 0.086, 0.11, 0.85), Color(0.925, 0.875, 0.765, 0.4), 1, 8.0))
	mute_btn.add_theme_stylebox_override("pressed", _sb(Color(0.02, 0.086, 0.11, 0.95), BRASS, 1, 8.0))
	mute_btn.pressed.connect(func(): mute_toggled.emit())
	top.add_child(mute_btn)

	# the tally, scratched into a batten of deck timber — centered like a titlebar
	var batten := PanelContainer.new()
	batten.add_theme_stylebox_override("panel", _sb(Color("#3a2a1a"), Color("#241708"), 2, 6.0))
	batten.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	batten.custom_minimum_size = Vector2(520, 0)
	rail.add_child(batten)
	tally = TallyControl.new()
	tally.custom_minimum_size = Vector2(0, 22)
	batten.add_child(tally)

	# day / toll / forecast share one centered strip on wide screens
	var meta := HBoxContainer.new()
	meta.alignment = BoxContainer.ALIGNMENT_CENTER
	meta.add_theme_constant_override("separation", 16)
	meta.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rail.add_child(meta)
	var day_col := VBoxContainer.new()
	day_col.alignment = BoxContainer.ALIGNMENT_CENTER
	meta.add_child(day_col)
	var day_row := HBoxContainer.new()
	day_row.add_theme_constant_override("separation", 8)
	day_row.alignment = BoxContainer.ALIGNMENT_CENTER
	day_col.add_child(day_row)
	day_label = _lbl(day_row, "DAY 1", 16)
	day_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	left_label = _lbl(day_row, "29 left", 12, PAPER3)
	left_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var toll_row2 := HBoxContainer.new()
	toll_row2.add_theme_constant_override("separation", 6)
	toll_row2.alignment = BoxContainer.ALIGNMENT_CENTER
	meta.add_child(toll_row2)
	_lbl(toll_row2, "TODAY'S TOLL", 10, PAPER3).size_flags_vertical = Control.SIZE_SHRINK_CENTER
	toll_row = HBoxContainer.new()
	toll_row.add_theme_constant_override("separation", 4)
	toll_row2.add_child(toll_row)

	forecast_panel = PanelContainer.new()
	forecast_panel.add_theme_stylebox_override("panel", _sb(Color(0.02, 0.086, 0.11, 0.55), Color(0.925, 0.875, 0.765, 0.2), 1, 8.0))
	forecast_panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	rail.add_child(forecast_panel)
	var fcol := VBoxContainer.new()
	fcol.add_theme_constant_override("separation", 2)
	forecast_panel.add_child(fcol)
	var fhead := HBoxContainer.new()
	fhead.add_theme_constant_override("separation", 8)
	fhead.alignment = BoxContainer.ALIGNMENT_CENTER
	fcol.add_child(fhead)
	_lbl(fhead, "TOMORROW", 9, PAPER3).size_flags_vertical = Control.SIZE_SHRINK_CENTER
	forecast_name = _lbl(fhead, "CALM", 14)
	forecast_row = HBoxContainer.new()
	forecast_row.add_theme_constant_override("separation", 4)
	fcol.add_child(forecast_row)


func _build_footer() -> void:
	if DisplayServer.is_touchscreen_available():
		return  # no keyboard hints on phones
	var hint := _lbl(root, "F11 fullscreen · Esc pause", 9, Color(0.925, 0.875, 0.765, 0.4))
	hint.anchor_left = 1.0
	hint.anchor_right = 1.0
	hint.anchor_top = 1.0
	hint.anchor_bottom = 1.0
	hint.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	hint.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hint.offset_left = -240
	hint.offset_top = -24
	hint.offset_right = -10
	hint.offset_bottom = -8
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _build_board() -> void:
	board = VBoxContainer.new()
	board.set_anchors_preset(Control.PRESET_CENTER_LEFT)
	board.anchor_top = 0.52
	board.anchor_bottom = 0.52
	board.grow_vertical = Control.GROW_DIRECTION_BOTH
	board.offset_left = 40.0 if DisplayServer.is_touchscreen_available() else 12.0
	board.add_theme_constant_override("separation", 6)
	board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(board)
	for k in ["food", "water", "spirit", "hull"]:
		var meta: Dictionary = STAT_META[k]
		var panel := PanelContainer.new()
		panel.add_theme_stylebox_override("panel", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.22), 1, 6.0))
		panel.custom_minimum_size = Vector2(112, 0)
		board.add_child(panel)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 3)
		panel.add_child(col)
		var head := HBoxContainer.new()
		head.add_theme_constant_override("separation", 4)
		col.add_child(head)
		_lbl(head, meta["short"], 10, meta["color"]).size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		head.add_child(sp)
		var value := _lbl(head, "64", 14)
		value.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var gauge := GaugeControl.new()
		gauge.color = meta["color"]
		gauge.custom_minimum_size = Vector2(0, 9)
		col.add_child(gauge)
		var foot_row := HBoxContainer.new()
		foot_row.add_theme_constant_override("separation", 4)
		col.add_child(foot_row)
		var delta := _lbl(foot_row, "", 10)
		var extra := _lbl(foot_row, "", 9, PAPER3)
		tubes[k] = {"value": value, "gauge": gauge, "delta": delta, "extra": extra, "panel": panel}


func _build_right_rail() -> void:
	var rail := VBoxContainer.new()
	rail.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
	rail.anchor_top = 0.5
	rail.anchor_bottom = 0.5
	rail.grow_vertical = Control.GROW_DIRECTION_BOTH
	rail.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	rail.offset_right = -(40.0 if DisplayServer.is_touchscreen_available() else 12.0)
	rail.add_theme_constant_override("separation", 8)
	rail.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(rail)

	var salv := PanelContainer.new()
	salv.add_theme_stylebox_override("panel", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.22), 1, 6.0))
	salv.size_flags_horizontal = Control.SIZE_SHRINK_END
	rail.add_child(salv)
	var salv_col := VBoxContainer.new()
	salv_col.alignment = BoxContainer.ALIGNMENT_CENTER
	salv.add_child(salv_col)
	salvage_value = _lbl(salv_col, "14", 22, STAT_META["scrap"]["color"])
	salvage_value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_lbl(salv_col, "SALVAGE", 9, PAPER3).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	salvage_delta = _lbl(salv_col, "", 10)
	salvage_delta.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	goal_panel = PanelContainer.new()
	goal_panel.add_theme_stylebox_override("panel", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.22), 1, 6.0))
	rail.add_child(goal_panel)
	var gcol := VBoxContainer.new()
	gcol.add_theme_constant_override("separation", 2)
	goal_panel.add_child(gcol)
	goal_kicker = _lbl(gcol, "BUILDING TOWARD", 9, PAPER3)
	goal_name = _lbl(gcol, "RAIN CATCHER", 14, BRASS)
	goal_bar = GoalBar.new()
	goal_bar.custom_minimum_size = Vector2(120, 6)
	gcol.add_child(goal_bar)
	goal_note = _lbl(gcol, "", 10, PAPER3)
	goal_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	goal_note.custom_minimum_size = Vector2(120, 0)

	ladder = VBoxContainer.new()
	ladder.add_theme_constant_override("separation", 3)
	rail.add_child(ladder)

	output_panel = PanelContainer.new()
	output_panel.add_theme_stylebox_override("panel", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.22), 1, 6.0))
	rail.add_child(output_panel)
	var ocol := VBoxContainer.new()
	ocol.add_theme_constant_override("separation", 3)
	output_panel.add_child(ocol)
	_lbl(ocol, "EVERY DAY", 9, PAPER3)
	output_row = HBoxContainer.new()
	output_row.add_theme_constant_override("separation", 4)
	ocol.add_child(output_row)


func _build_log() -> void:
	var decision := VBoxContainer.new()
	decision.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	decision.grow_horizontal = Control.GROW_DIRECTION_BOTH
	decision.grow_vertical = Control.GROW_DIRECTION_BEGIN
	decision.offset_bottom = -14
	decision.add_theme_constant_override("separation", 6)
	decision.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(decision)

	var log_panel := PanelContainer.new()
	log_panel.custom_minimum_size = Vector2(680, 0)
	log_panel.add_theme_stylebox_override("panel", _sb(Color(0.925, 0.875, 0.765, 0.96), Color("#b6a077"), 1, 10.0))
	decision.add_child(log_panel)
	var lcol := VBoxContainer.new()
	lcol.add_theme_constant_override("separation", 3)
	log_panel.add_child(lcol)
	var lhead := HBoxContainer.new()
	lcol.add_child(lhead)
	_lbl(lhead, "SHIP'S LOG", 10, RUST).size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lhead.add_child(sp)
	log_head_day = _lbl(lhead, "Day 1", 10, Color("#6b5c40"))
	log_head_day.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	log_message = _lbl(lcol, "", 13, INK)
	log_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	log_event = _lbl(lcol, "", 12, Color("#4a5560"))
	log_event.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	log_story = _lbl(lcol, "", 11, RUST)
	log_story.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	prompt = _lbl(decision, "", 11, PAPER3)
	prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func _build_tag_row() -> void:
	var holder := Control.new()
	holder.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	holder.grow_vertical = Control.GROW_DIRECTION_BEGIN
	holder.offset_bottom = -170
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(holder)
	tag_row = HBoxContainer.new()
	tag_row.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	tag_row.grow_horizontal = Control.GROW_DIRECTION_BOTH
	tag_row.grow_vertical = Control.GROW_DIRECTION_BEGIN
	tag_row.offset_bottom = 0
	tag_row.add_theme_constant_override("separation", 8)
	holder.add_child(tag_row)


func _build_bursts() -> void:
	burst_layer = Control.new()
	burst_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	burst_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(burst_layer)


func _build_toast() -> void:
	toast_panel = PanelContainer.new()
	toast_panel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	toast_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	toast_panel.offset_top = 130
	toast_panel.add_theme_stylebox_override("panel", _sb(Color("#2a1d0e", 0.95), BRASS, 1, 8.0))
	toast_panel.visible = false
	toast_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(toast_panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	toast_panel.add_child(row)
	var tcol := VBoxContainer.new()
	row.add_child(tcol)
	_lbl(tcol, "CONSTRUCTED", 9, BRASS)
	toast_name = _lbl(tcol, "", 14, PAPER)


func _build_danger_edge() -> void:
	pass  # built in _build_vignette


func _build_title() -> void:
	title_layer = Control.new()
	title_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(title_layer)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.086, 0.11, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	title_layer.add_child(dim)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.add_theme_stylebox_override("panel", _sb(Color(0.925, 0.875, 0.765, 0.97), Color("#b6a077"), 1, 18.0))
	title_layer.add_child(panel)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	col.custom_minimum_size = Vector2(320, 0)
	panel.add_child(col)

	_lbl(col, "NOTHING BUT WATER IN EVERY DIRECTION", 10, RUST).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var mark := _lbl(col, "DRIFT 30", 40, INK)
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var rule := ColorRect.new()
	rule.color = BRASS
	rule.custom_minimum_size = Vector2(0, 2)
	col.add_child(rule)
	var blurb := _lbl(col, "You have a raft, a net, and thirty days of daylight. The sea takes a little more every morning than it did the last.", 12, Color("#3d4a50"))
	blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_rule_item("01", "Each day buys exactly one action. Everything you don't do still costs you."))
	col.add_child(_rule_item("02", "Salvage builds the raft. What you build is the only thing that outlasts you."))
	col.add_child(_rule_item("03", "Surviving day thirty is not rescue. Raise the radio tower, or drift on."))

	var start := Button.new()
	start.text = "BEGIN THE DRIFT"
	start.add_theme_font_size_override("font_size", 16)
	start.add_theme_color_override("font_color", INK)
	start.add_theme_stylebox_override("normal", _sb(BRASS, INK, 1, 10.0))
	start.add_theme_stylebox_override("hover", _sb(BRASS.lightened(0.15), INK, 1, 10.0))
	start.add_theme_stylebox_override("pressed", _sb(BRASS.darkened(0.15), INK, 1, 10.0))
	start.pressed.connect(func(): start_requested.emit())
	col.add_child(start)
	_lbl(col, "30 days · 5 structures · 1 way home · press Enter", 10, PAPER3).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func _rule_item(num: String, text: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_lbl(row, num, 12, RUST).size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var l := _lbl(row, text, 11, Color("#3d4a50"))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return row


func _build_ending() -> void:
	ending_layer = Control.new()
	ending_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	ending_layer.visible = false
	root.add_child(ending_layer)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.086, 0.11, 0.5)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	ending_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.add_theme_stylebox_override("panel", _sb(Color(0.925, 0.875, 0.765, 0.97), Color("#b6a077"), 1, 18.0))
	ending_layer.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	col.custom_minimum_size = Vector2(320, 0)
	panel.add_child(col)
	ending_title = _lbl(col, "", 26, INK)
	ending_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ending_body = _lbl(col, "", 12, Color("#3d4a50"))
	ending_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ending_stats = _lbl(col, "", 13, RUST)
	ending_stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var restart := Button.new()
	restart.text = "DRIFT AGAIN"
	restart.add_theme_font_size_override("font_size", 15)
	restart.add_theme_color_override("font_color", INK)
	restart.add_theme_stylebox_override("normal", _sb(BRASS, INK, 1, 10.0))
	restart.add_theme_stylebox_override("hover", _sb(BRASS.lightened(0.15), INK, 1, 10.0))
	restart.add_theme_stylebox_override("pressed", _sb(BRASS.darkened(0.15), INK, 1, 10.0))
	restart.pressed.connect(func(): restart_requested.emit())
	col.add_child(restart)


# ---------------------------------------------------------------- updates

func set_muted(muted: bool) -> void:
	mute_btn.text = "SOUND OFF" if muted else "SOUND ON"


func set_state(s: Dictionary) -> void:
	title_layer.visible = not s["started"]

	ending_layer.visible = s["ended"] != ""
	if s["ended"] != "":
		_fill_ending(s)

	# header
	tally.day = s["day"]
	tally.queue_redraw()
	day_label.text = "DAY %d" % s["day"]
	left_label.text = "%d left" % (s["total_days"] - s["day"])
	for c in toll_row.get_children():
		c.queue_free()
	toll_row.add_child(_make_chips(s["upkeep"]))

	# forecast
	var fc = s["forecast"]
	forecast_panel.visible = fc != null and s["ended"] == ""
	if fc != null:
		forecast_name.text = fc["label"]
		forecast_panel.modulate = Color(1, 0.85, 0.85) if fc.get("storm", false) else Color.WHITE
		for c in forecast_row.get_children():
			c.queue_free()
		forecast_row.add_child(_make_chips(fc["change"]))

	# gauge board
	for k in tubes:
		var t: Dictionary = tubes[k]
		var v: float = s["stats"][k]
		t["value"].text = str(int(v))
		t["gauge"].value = v
		t["gauge"].queue_redraw()
		var d := int(s["deltas"].get(k, 0))
		t["delta"].text = ("+%d" % d) if d > 0 else (str(d) if d < 0 else "")
		t["delta"].add_theme_color_override("font_color", STAT_META[k]["color"].lightened(0.3) if d > 0 else RUST)
		if k == "spirit":
			t["extra"].text = "%d%% GRIT" % s["grit"]
			t["extra"].add_theme_color_override("font_color", PAPER3 if s["grit"] >= 85 else SIGNAL)
		if v <= 20:
			t["panel"].modulate = Color(1.0, 0.75, 0.72)
		elif v <= 45:
			t["panel"].modulate = Color(1.0, 0.9, 0.8)
		else:
			t["panel"].modulate = Color.WHITE

	# salvage
	salvage_value.text = str(int(s["stats"]["scrap"]))
	var sd := int(s["deltas"].get("scrap", 0))
	salvage_delta.text = ("+%d" % sd) if sd > 0 else (str(sd) if sd < 0 else "")

	# goal
	var goal = s["goal"]
	var show_goal: bool = goal != null and not s["built"].has(goal["name"]) and s["ended"] == ""
	goal_panel.visible = show_goal
	if show_goal:
		goal_kicker.text = "BUILDING TOWARD · %d" % goal["cost"] if s["day"] >= goal["day"] else "Unlocks day %d" % goal["day"]
		goal_name.text = goal["name"]
		goal_bar.fraction = clampf(s["stats"]["scrap"] / float(goal["cost"]), 0.0, 1.0)
		goal_bar.queue_redraw()
		goal_panel.add_theme_stylebox_override("panel", _sb(Color(0.02, 0.086, 0.11, 0.75), BRASS, 2, 6.0) if s["ready"] else _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.22), 1, 6.0))
		if s["day"] < goal["day"]:
			goal_note.text = goal["blurb"]
		elif s["ready"]:
			goal_note.text = "Ready — spend a day on it"
		else:
			goal_note.text = "%d more salvage" % (goal["cost"] - int(s["stats"]["scrap"]))

	# ladder
	for c in ladder.get_children():
		c.queue_free()
	var any_open := false
	for u in DriftGame.UPGRADES:
		if not s["built"].has(u["name"]):
			any_open = true
			break
	var ladder_holder: VBoxContainer = ladder
	if not any_open:
		ladder_holder.visible = false
	else:
		ladder_holder.visible = true
		var head := _lbl(ladder_holder, "MANIFEST · TAP TO AIM", 9, PAPER3)
		head.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		for u in DriftGame.UPGRADES:
			var done: bool = s["built"].has(u["name"])
			var locked: bool = s["day"] < u["day"]
			var b := Button.new()
			b.text = "%s  ·  %s" % [u["name"], "BUILT" if done else ("DAY %d" % u["day"] if locked else str(u["cost"]))]
			b.add_theme_font_size_override("font_size", 11)
			b.disabled = done or s["ended"] != ""
			if done:
				b.add_theme_color_override("font_color", PAPER3)
				b.add_theme_color_override("font_disabled_color", PAPER3)
				b.add_theme_stylebox_override("disabled", _sb(Color(0.05, 0.14, 0.17, 0.5), Color(0.4, 0.5, 0.5, 0.3), 1, 4.0))
			elif u["name"] == s["target"]:
				b.add_theme_color_override("font_color", INK)
				b.add_theme_stylebox_override("normal", _sb(BRASS, INK, 1, 4.0))
				b.add_theme_stylebox_override("hover", _sb(BRASS.lightened(0.1), INK, 1, 4.0))
			else:
				b.add_theme_color_override("font_color", PAPER)
				b.add_theme_stylebox_override("normal", _sb(Color(0.02, 0.086, 0.11, 0.6), Color(0.925, 0.875, 0.765, 0.22), 1, 4.0))
				b.add_theme_stylebox_override("hover", _sb(Color(0.05, 0.15, 0.19, 0.8), Color(0.925, 0.875, 0.765, 0.4), 1, 4.0))
			if not done:
				var uname: String = u["name"]
				b.pressed.connect(func(): aim_changed.emit(uname))
			ladder_holder.add_child(b)

	# output
	output_panel.visible = not s["built"].is_empty()
	for c in output_row.get_children():
		c.queue_free()
	output_row.add_child(_make_chips(s["output"]))

	# action cards
	for c in tag_row.get_children():
		c.queue_free()
	if s["started"] and s["ended"] == "":
		var cards: Array = s["actions"]
		for i in cards.size():
			tag_row.add_child(_build_card(cards[i], i, s))

	# log
	log_head_day.text = "Day %d" % s["day"]
	log_message.text = s["message"]
	log_event.text = s["event_text"]
	log_story.text = s.get("story_text", "")
	log_story.visible = log_story.text != ""
	if s["busy"]:
		prompt.text = "The day plays out…"
	elif s["ended"] == "" and s["started"]:
		prompt.text = "Choose an action · keys 1–%d" % mini(4, s["actions"].size())
	else:
		prompt.text = ""
	danger_edge.visible = s["critical"] and s["ended"] == ""


func _build_card(choice: Dictionary, index: int, s: Dictionary) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(128, 0)
	var tone := Color(choice["tone"])
	var cost := DriftGame.cost_of(choice)
	var locked: bool = cost > s["stats"]["scrap"]
	var selected: bool = choice["id"] == s["selected"]
	var normal := _sb(Color(0.925, 0.875, 0.765, 0.96), tone, 2 if selected else 1, 8.0)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", _sb(Color(0.96, 0.93, 0.85, 0.98), tone, 2 if selected else 1, 8.0))
	b.add_theme_stylebox_override("pressed", _sb(BRASS, tone, 2, 8.0))
	b.disabled = s["busy"] or locked
	if locked:
		b.add_theme_stylebox_override("disabled", _sb(Color(0.55, 0.52, 0.45, 0.8), Color("#7d8a8c"), 1, 8.0))
	else:
		b.add_theme_stylebox_override("disabled", normal)
	b.pressed.connect(func(): action_picked.emit(index))

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 3)
	b.add_child(col)
	var title := _lbl(col, "%d  %s" % [index + 1, choice["label"]], 12, INK)
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.custom_minimum_size = Vector2(116, 30)
	col.add_child(_make_chips(choice["change"]))
	if choice.get("risk", 0.0) > 0:
		_lbl(col, "%d%% risk" % int(round(choice["risk"] * 100)), 9, RUST)
	if locked:
		_lbl(col, "Need %d salvage" % cost, 9, Color("#5d6b6d"))
	# Button is not a container: size it to its content explicitly
	var touch := DisplayServer.is_touchscreen_available()
	var min_size: Vector2 = col.get_combined_minimum_size()
	b.custom_minimum_size = Vector2(maxf(148.0 if touch else 126.0, min_size.x + 16.0), min_size.y + (18.0 if touch else 14.0))
	return b


func _fill_ending(s: Dictionary) -> void:
	var kind: String = s["ended"]
	var cause = DriftGame.cause_of_death(s["stats"])
	var title := ""
	var body := ""
	if kind == "rescued":
		title = "SIGNAL ANSWERED"
		body = "The tower catches a freighter on the third sweep. You built the thing that could shout, and someone was listening."
	elif kind == "adrift":
		title = "STILL ADRIFT"
		body = "Thirty days and you are alive — but nothing on this deck can call for help. Raise the %s next time." % DriftGame.RESCUE_STRUCTURE.to_lower()
	else:
		title = "THE SEA WON"
		body = DEATH_LINE[cause] if cause != null else "The ocean took the rest."
	var epilogue: String = s.get("epilogue", "")
	if epilogue != "":
		body += "\n\n" + epilogue
	ending_title.text = title
	ending_body.text = body
	ending_stats.text = "DAYS %d   ·   BUILT %d/%d" % [s["day"], s["built"].size(), DriftGame.UPGRADES.size()]


# ---------------------------------------------------------------- transients

func show_bursts(list: Array) -> void:
	for i in list.size():
		var b: Dictionary = list[i]
		var l := Label.new()
		l.text = ("+" if b["value"] > 0 else "") + str(b["value"])
		l.add_theme_font_size_override("font_size", 26)
		l.add_theme_color_override("font_color", STAT_META[b["stat"]]["color"])
		l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
		l.add_theme_constant_override("shadow_offset_y", 2)
		l.position = Vector2(root.size.x * 0.5 - 30 + i * 22, root.size.y * 0.4)
		burst_layer.add_child(l)
		var tw := create_tween()
		tw.tween_property(l, "position:y", l.position.y - 70.0, 1.4).set_delay(i * 0.09)
		tw.parallel().tween_property(l, "modulate:a", 0.0, 1.4).set_delay(i * 0.09)
		tw.tween_callback(l.queue_free)


func show_toast(name: String) -> void:
	toast_name.text = name
	toast_panel.visible = true
	toast_panel.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(toast_panel, "modulate:a", 1.0, 0.25)
	tw.tween_interval(2.4)
	tw.tween_property(toast_panel, "modulate:a", 0.0, 0.4)
	tw.tween_callback(func(): toast_panel.visible = false)


func shake() -> void:
	var tw := create_tween()
	var origin := root.position
	tw.tween_property(root, "position", origin + Vector2(8, 0), 0.05)
	tw.tween_property(root, "position", origin - Vector2(6, 0), 0.05)
	tw.tween_property(root, "position", origin + Vector2(4, 0), 0.05)
	tw.tween_property(root, "position", origin, 0.05)


# ---------------------------------------------------------------- journal

func _build_journal() -> void:
	journal_layer = Control.new()
	journal_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	journal_layer.visible = false
	root.add_child(journal_layer)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.086, 0.11, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	dim.gui_input.connect(func(ev): if ev is InputEventMouseButton and ev.pressed: toggle_journal())
	journal_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.add_theme_stylebox_override("panel", _sb(Color(0.925, 0.875, 0.765, 0.98), Color("#b6a077"), 1, 14.0))
	journal_layer.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	col.custom_minimum_size = Vector2(340, 0)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	_lbl(head, "SHIP'S JOURNAL", 15, INK)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)
	var close := Button.new()
	close.text = "CLOSE"
	close.add_theme_font_size_override("font_size", 11)
	close.add_theme_color_override("font_color", INK)
	close.add_theme_stylebox_override("normal", _sb(PAPER2, Color("#b6a077"), 1, 4.0))
	close.pressed.connect(toggle_journal)
	head.add_child(close)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 420)
	col.add_child(scroll)
	journal_list = VBoxContainer.new()
	journal_list.add_theme_constant_override("separation", 8)
	journal_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(journal_list)


func set_journal(entries: Array) -> void:
	journal_entries = entries
	if journal_layer.visible:
		refresh_journal()


func refresh_journal() -> void:
	for c in journal_list.get_children():
		c.queue_free()
	for e in journal_entries:
		var day := _lbl(journal_list, "DAY %d" % e["day"], 10, RUST)
		day.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var text := _lbl(journal_list, e["text"], 12, Color("#2c3a40"))
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(300, 0)
		var rule := ColorRect.new()
		rule.color = Color("#b6a077")
		rule.custom_minimum_size = Vector2(0, 1)
		journal_list.add_child(rule)


func toggle_journal() -> void:
	if prologue_layer.visible:
		return
	journal_layer.visible = not journal_layer.visible
	if journal_layer.visible:
		refresh_journal()


# ---------------------------------------------------------------- prologue

func _build_prologue() -> void:
	prologue_layer = Control.new()
	prologue_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	prologue_layer.visible = false
	root.add_child(prologue_layer)
	var dim := ColorRect.new()
	dim.color = Color(0.016, 0.078, 0.102, 0.82)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	prologue_layer.add_child(dim)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.add_theme_stylebox_override("panel", _sb(Color(0.925, 0.875, 0.765, 0.98), Color("#b6a077"), 1, 18.0))
	prologue_layer.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	col.custom_minimum_size = Vector2(320, 0)
	panel.add_child(col)
	_lbl(col, "PROLOGUE", 11, RUST).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prologue_text = _lbl(col, "", 13, Color("#2c3a40"))
	prologue_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	prologue_page_label = _lbl(col, "", 10, PAPER3)
	prologue_page_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var next_btn := Button.new()
	next_btn.text = "CONTINUE"
	next_btn.add_theme_font_size_override("font_size", 14)
	next_btn.add_theme_color_override("font_color", INK)
	next_btn.add_theme_stylebox_override("normal", _sb(BRASS, INK, 1, 8.0))
	next_btn.add_theme_stylebox_override("hover", _sb(BRASS.lightened(0.15), INK, 1, 8.0))
	next_btn.pressed.connect(_prologue_next)
	col.add_child(next_btn)


func open_prologue() -> void:
	prologue_page = 0
	_show_prologue_page()
	prologue_layer.visible = true


func _show_prologue_page() -> void:
	prologue_text.text = DriftStory.PROLOGUE[prologue_page]
	prologue_page_label.text = "%d / %d" % [prologue_page + 1, DriftStory.PROLOGUE.size()]


func _prologue_next() -> void:
	prologue_page += 1
	if prologue_page >= DriftStory.PROLOGUE.size():
		prologue_layer.visible = false
	else:
		_show_prologue_page()


## While an overlay covers the deck, keyboard shortcuts must stand down.
func blocking() -> bool:
	return prologue_layer.visible or journal_layer.visible


# ---------------------------------------------------------------- act cards

func _build_act_card() -> void:
	act_layer = Control.new()
	act_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	act_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	act_layer.modulate.a = 0.0
	root.add_child(act_layer)
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_CENTER)
	col.grow_horizontal = Control.GROW_DIRECTION_BOTH
	col.grow_vertical = Control.GROW_DIRECTION_BOTH
	col.add_theme_constant_override("separation", 6)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	act_layer.add_child(col)
	act_title = _lbl(col, "", 26, PAPER)
	act_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	act_title.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	act_title.add_theme_constant_override("shadow_offset_y", 2)
	act_sub = _lbl(col, "", 13, BRASS)
	act_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func show_act(title: String, sub: String) -> void:
	act_title.text = title
	act_sub.text = sub
	var tw := create_tween()
	tw.tween_property(act_layer, "modulate:a", 1.0, 0.5)
	tw.tween_interval(2.2)
	tw.tween_property(act_layer, "modulate:a", 0.0, 0.7)


# ---------------------------------------------------------------- setback

func _build_setback() -> void:
	setback_panel = PanelContainer.new()
	setback_panel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	setback_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	setback_panel.offset_top = 96
	setback_panel.add_theme_stylebox_override("panel", _sb(Color(0.4, 0.08, 0.04, 0.95), SIGNAL, 2, 6.0))
	setback_panel.visible = false
	setback_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(setback_panel)
	_lbl(setback_panel, "SETBACK", 15, SIGNAL)


func show_setback() -> void:
	# red flash + stamped banner
	var flash := ColorRect.new()
	flash.color = Color(1.0, 0.35, 0.2, 0.25)
	flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(flash)
	var ftw := create_tween()
	ftw.tween_property(flash, "color:a", 0.0, 0.45)
	ftw.tween_callback(flash.queue_free)

	setback_panel.visible = true
	setback_panel.modulate.a = 0.0
	setback_panel.scale = Vector2(1.15, 1.15)
	setback_panel.pivot_offset = setback_panel.size / 2.0
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(setback_panel, "modulate:a", 1.0, 0.12)
	tw.tween_property(setback_panel, "scale", Vector2.ONE, 0.12)
	tw.chain().tween_interval(1.1)
	tw.chain().tween_property(setback_panel, "modulate:a", 0.0, 0.3)
	tw.chain().tween_callback(func(): setback_panel.visible = false)


# ---------------------------------------------------------------- widgets

class GaugeControl extends Control:
	var value := 100.0:
		set(v):
			value = v
			queue_redraw()
	var color := Color.WHITE

	func _draw() -> void:
		var segments := 10
		var gap := 2.0
		var w := size.x
		var h := size.y
		var cell := (w - gap * (segments - 1)) / segments
		var filled := int(round(value / 100.0 * segments))
		for i in segments:
			var r := Rect2(Vector2(i * (cell + gap), 0), Vector2(cell, h))
			if i < filled:
				draw_rect(r, color)
			else:
				draw_rect(r, Color(1, 1, 1, 0.12))


class GoalBar extends Control:
	var fraction := 0.0:
		set(v):
			fraction = v
			queue_redraw()

	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), Color(1, 1, 1, 0.12))
		draw_rect(Rect2(Vector2.ZERO, Vector2(size.x * fraction, size.y)), BRASS)


class TallyControl extends Control:
	var day := 1:
		set(v):
			day = v
			queue_redraw()

	func _draw() -> void:
		var total := 30
		var groups := int(ceil(total / 5.0))
		var gw := 26.0
		var ink := Color("#d8c8a4")
		var off := Color(1, 1, 1, 0.16)
		var start_x := (size.x - groups * gw) * 0.5
		for g in groups:
			var cut := clampi(day - g * 5, 0, 5)
			var ox := start_x + g * gw
			for i in 4:
				var c := ink if i < cut else off
				draw_line(Vector2(ox + 3 + i * 5.2, 2.5 + (i % 2) * 0.6), Vector2(ox + 4.1 + i * 5.2, 17.5 - (i % 3) * 0.5), c, 1.6)
			draw_line(Vector2(ox + 1.4, 16.4), Vector2(ox + 20.4, 3.4), ink if cut >= 5 else off, 1.6)
