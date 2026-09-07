class_name DriftWorld
extends Node3D
## The 3D world for DRIFT/30 — ported from src/OceanScene.tsx.
## Everything is built procedurally in code; no imported assets.

signal hotspot_clicked(id: String)

const OCEAN_SHADER := preload("res://shaders/ocean.gdshader")

## Cinematic reframing — each action gets its own camera composition.
const SHOTS := {
	"idle": {"pos": Vector3(0, 4.6, 11.0), "look": Vector3(0, 0.75, 0), "fov": 42.0},
	"fish": {"pos": Vector3(3.6, 2.0, 6.4), "look": Vector3(1.2, 0.4, 0.6), "fov": 40.0},
	"salvage": {"pos": Vector3(4.2, 2.6, 6.8), "look": Vector3(1.4, 0.1, 0.4), "fov": 44.0},
	"purify": {"pos": Vector3(3.0, 2.4, 5.6), "look": Vector3(1.3, 0.9, -0.4), "fov": 38.0},
	"repair": {"pos": Vector3(1.6, 1.6, 5.2), "look": Vector3(0.3, 0.4, 0.7), "fov": 40.0},
	"dive": {"pos": Vector3(2.2, 1.1, 6.0), "look": Vector3(0.6, -0.7, 1.4), "fov": 46.0},
	"rest": {"pos": Vector3(-1.8, 3.2, 8.6), "look": Vector3(0.2, 1.0, 0.2), "fov": 40.0},
	"rain": {"pos": Vector3(-2.6, 3.6, 8.2), "look": Vector3(-0.6, 1.2, -0.3), "fov": 46.0},
	"signal": {"pos": Vector3(-1.2, 4.6, 9.0), "look": Vector3(0.4, 2.4, 0), "fov": 48.0},
	"bail": {"pos": Vector3(2.4, 1.9, 6.2), "look": Vector3(0.9, 0.1, -0.5), "fov": 42.0},
	"build": {"pos": Vector3(-2.2, 2.4, 6.6), "look": Vector3(-0.7, 0.7, 0.6), "fov": 44.0},
	"rescued": {"pos": Vector3(-2.4, 3.0, 8.0), "look": Vector3(-0.6, 2.0, -0.4), "fov": 44.0},
	"adrift": {"pos": Vector3(0.6, 3.4, 9.4), "look": Vector3(0, 0.9, 0), "fov": 46.0},
	"lost": {"pos": Vector3(1.4, 1.0, 7.0), "look": Vector3(0, -0.2, 0), "fov": 50.0},
}

## Where each action physically happens. Deck actions ride the raft.
const HOTSPOT_PLACES := {
	"fish": {"pos": Vector3(3.1, -0.55, 1.5), "on_raft": false},
	"salvage": {"pos": Vector3(-3.5, -0.45, 1.1), "on_raft": false},
	"dive": {"pos": Vector3(0.7, -0.6, 2.3), "on_raft": false},
	"purify": {"pos": Vector3(1.5, 0.75, 1.1), "on_raft": true},
	"repair": {"pos": Vector3(-0.2, 0.25, 0.5), "on_raft": true},
	"rest": {"pos": Vector3(-1.15, 1.0, -0.45), "on_raft": true},
	"rain": {"pos": Vector3(-1.15, 2.05, -0.75), "on_raft": true},
	"signal": {"pos": Vector3(0.5, 1.5, 0.2), "on_raft": true},
	"bail": {"pos": Vector3(1.55, 0.15, -1.05), "on_raft": true},
	"build": {"pos": Vector3(-1.6, 0.4, 1.15), "on_raft": true},
}

const DEBRIS := [
	{"pos": Vector3(-5.6, -0.72, -1.6), "kind": 0},
	{"pos": Vector3(5.1, -0.76, -2.6), "kind": 3},
	{"pos": Vector3(-4.3, -0.78, 4.0), "kind": 1},
	{"pos": Vector3(4.1, -0.74, 2.8), "kind": 4},
	{"pos": Vector3(-7.6, -0.76, -6.2), "kind": 2},
	{"pos": Vector3(7.2, -0.75, -5.4), "kind": 1},
	{"pos": Vector3(1.4, -0.76, 5.6), "kind": 0},
	{"pos": Vector3(-2.6, -0.75, -5.8), "kind": 4},
	{"pos": Vector3(9.4, -0.74, 1.2), "kind": 2},
	{"pos": Vector3(-9.2, -0.75, 2.4), "kind": 3},
]

const PLANKS := [Color("#d18b4c"), Color("#b8703a"), Color("#dc9553"), Color("#ac6a31"), Color("#c67e42")]
const DEEP_CALM := Color("#05314f")
const DEEP_STORM := Color("#04202f")
const SKIN := Color("#d08a55")
const SKIN_DARK := Color("#b26f3f")
const CLOTH := Color("#e8dfc6")
const CLOTH_DARK := Color("#b9543a")

var time := 0.0
var storm := false
var action := ""
var ending := ""
var stage := -1
var pulse := 0

var cam: Camera3D
var ocean_mat: ShaderMaterial
var env: Environment
var sun_light: DirectionalLight3D
## Phones and tablets skip shadows and get lighter particle work.
var low_gfx := OS.has_feature("mobile")
var chop := 1.0
var deep := DEEP_CALM
var bg_calm := true

var raft: Node3D
var hull_node: Node3D
var castaway_root: Node3D
var ca_torso: Node3D
var ca_head: Node3D
var ca_right_arm: Node3D
var ca_left_arm: Node3D
var ca_rod: Node3D
var ca_hammer: Node3D
var ca_flare: Node3D
var action_started := 0.0
var prev_action := ""
var last_pulse := -1
var kick := 0.0

var struct_refs := {}          # structure name -> {animatable refs}
var buildins: Array = []       # [{node, born}]
var rings: Array = []          # [{node, mat, born, speed, scale}]
var hotspots: Array = []       # [{id, ring, inner, locked, tone}]
var fx_root: Node3D
var fx := {}                   # current action fx state
var debris_nodes: Array = []
var clouds_calm: Array = []    # [{node, base, drift, seed}]
var clouds_storm: Array = []
var birds: Node3D
var bird_wings: Array = []
var chopper: Node3D
var chopper_rotor: MeshInstance3D
var storm_light: OmniLight3D
var cam_look := Vector3(0, 0.55, 0)
var dolphin: Node3D
var dolphin_angle := 0.0


func _ready() -> void:
	_build_environment()
	_build_ocean()
	_build_sky()
	_build_birds()
	_build_debris()
	_build_raft()
	fx_root = Node3D.new()
	add_child(fx_root)
	_build_chopper()
	_build_storm_overlay()
	_build_ambient_sparkles()


func _unhandled_input(event: InputEvent) -> void:
	# The pulsing rings in the world are tappable too, not just the tags.
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if action != "" or ending != "" or hotspots.is_empty():
			return
		for h in hotspots:
			if h["locked"] or not h["ring"].visible:
				continue
			var sp: Vector2 = cam.unproject_position(h["ring"].global_position)
			if sp.distance_to(event.position) < 36.0:
				hotspot_clicked.emit(h["id"])
				return


func _process(delta: float) -> void:
	time += delta
	_anim_ocean(delta)
	_anim_raft(delta)
	_anim_castaway(delta)
	_anim_structures(delta)
	_anim_sky()
	_anim_debris()
	_anim_hotspots()
	_anim_buildins()
	_anim_fx()
	_anim_rings()
	_anim_chopper(delta)
	_anim_storm(delta)
	_anim_dolphin(delta)
	_anim_camera(delta)


# ================================================================ builders

func _mat(color: Color, rough := 0.9, metal := 0.0, unshaded := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	if unshaded:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return m


func _glow_mat(color: Color, energy := 2.0, alpha := 1.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = energy
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color.a = alpha
	return m


func _mesh(parent: Node, mesh: Mesh, pos: Vector3, mat: Material, rot := Vector3.ZERO, scl := Vector3.ONE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.rotation = rot
	mi.scale = scl
	mi.material_override = mat
	parent.add_child(mi)
	return mi


func _cyl(rt: float, rb: float, h: float) -> CylinderMesh:
	var m := CylinderMesh.new()
	m.top_radius = rt
	m.bottom_radius = rb
	m.height = h
	m.radial_segments = 18
	return m


func _cone(r: float, h: float) -> CylinderMesh:
	return _cyl(0.0, r, h)


func _sph(r: float) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0
	m.radial_segments = 20
	m.rings = 12
	return m


func _box(x: float, y: float, z: float) -> BoxMesh:
	var m := BoxMesh.new()
	m.size = Vector3(x, y, z)
	return m


func _capsule(r: float, mid_len: float) -> CapsuleMesh:
	var m := CapsuleMesh.new()
	m.radius = r
	m.height = mid_len + r * 2.0
	return m


func _torus(inner: float, outer: float) -> TorusMesh:
	var m := TorusMesh.new()
	m.inner_radius = inner
	m.outer_radius = outer
	m.rings = 22
	m.ring_segments = 10
	return m


func _light(parent: Node, color: Color, energy: float, dist: float, pos: Vector3) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.light_color = color
	l.light_energy = energy
	l.omni_range = dist
	l.position = pos
	parent.add_child(l)
	return l


func _particles(parent: Node, color: Color, amount: int, pos: Vector3, extents: Vector3, vel: float, gravity := Vector3(0, -1, 0), lifetime := 1.0, size := 0.04, one_shot := false) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = amount / 2 if low_gfx else amount
	p.lifetime = lifetime
	p.one_shot = one_shot
	p.explosiveness = 1.0 if one_shot else 0.0
	p.mesh = _box(size, size, size)
	p.material_override = _glow_mat(color, 1.2)
	p.position = pos
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = extents
	p.initial_velocity_min = vel * 0.6
	p.initial_velocity_max = vel
	p.gravity = gravity
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.2
	parent.add_child(p)
	return p


func _build_environment() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#8fd9ea")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#cfeeff")
	env.ambient_light_energy = 1.0
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_depth_begin = 18.0
	env.fog_depth_end = 62.0
	env.fog_light_color = Color("#a6e2ea")
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.light_color = Color("#ffd8a0")
	sun.light_energy = 1.3
	sun.rotation = Vector3(deg_to_rad(-48), deg_to_rad(35), 0)
	sun.shadow_enabled = not low_gfx
	sun.directional_shadow_max_distance = 20.0 if low_gfx else 30.0
	add_child(sun)
	sun_light = sun

	var fill := DirectionalLight3D.new()
	fill.light_color = Color("#ff9d63")
	fill.light_energy = 0.45
	fill.rotation = Vector3(deg_to_rad(-24), deg_to_rad(-140), 0)
	add_child(fill)


func _build_ocean() -> void:
	ocean_mat = ShaderMaterial.new()
	ocean_mat.shader = OCEAN_SHADER
	ocean_mat.set_shader_parameter("u_deep", Color("#05314f"))
	ocean_mat.set_shader_parameter("u_shallow", Color("#1391b4"))
	ocean_mat.set_shader_parameter("u_crest", Color("#57dbdb"))
	ocean_mat.set_shader_parameter("u_sun", Color("#ffdba3"))
	var plane := PlaneMesh.new()
	plane.size = Vector2(110, 110)
	plane.subdivide_width = 128
	plane.subdivide_depth = 128
	var mi := MeshInstance3D.new()
	mi.mesh = plane
	mi.material_override = ocean_mat
	mi.position.y = -1.04
	add_child(mi)


func _build_sky() -> void:
	var sun_pos := Vector3(11, 5.4, -26)
	_mesh(self, _sph(2.1), sun_pos, _mat(Color("#fff5df"), 1.0, 0.0, true))
	_mesh(self, _sph(3.6), sun_pos + Vector3(0, 0, -0.6), _mat(Color(1.0, 0.839, 0.58, 0.42), 1.0, 0.0, true))
	_mesh(self, _sph(6.4), sun_pos + Vector3(0, 0, -1.2), _mat(Color(1.0, 0.722, 0.467, 0.18), 1.0, 0.0, true))

	# calm-day clouds
	for c in [
		{"pos": Vector3(-13, 7.4, -22), "scale": 1.9, "drift": 0.16},
		{"pos": Vector3(6, 9.2, -30), "scale": 2.6, "drift": 0.1},
		{"pos": Vector3(19, 6.1, -25), "scale": 1.5, "drift": 0.21},
		{"pos": Vector3(-24, 8.5, -34), "scale": 2.2, "drift": 0.13},
	]:
		clouds_calm.append({"node": _build_cloud(c["pos"], c["scale"]), "base": c["pos"], "drift": c["drift"], "seed": c["pos"].z})
	# storm clouds
	for c in [
		{"pos": Vector3(-8, 6.6, -18), "scale": 3.4, "drift": 0.5},
		{"pos": Vector3(9, 7.2, -21), "scale": 3.9, "drift": 0.44},
		{"pos": Vector3(24, 6.0, -24), "scale": 3.1, "drift": 0.55},
	]:
		clouds_storm.append({"node": _build_cloud(c["pos"], c["scale"]), "base": c["pos"], "drift": c["drift"], "seed": c["pos"].z})


func _build_cloud(pos: Vector3, s: float) -> Node3D:
	var g := Node3D.new()
	g.position = pos
	g.scale = Vector3.ONE * s
	add_child(g)
	var puffs := [
		Vector3(-1.35, -0.1, 0), Vector3(-0.5, 0.18, 0.2), Vector3(0.45, 0.24, -0.15),
		Vector3(1.35, -0.02, 0.1), Vector3(0.1, -0.24, 0.3),
	]
	for i in puffs.size():
		var r: float = [0.78, 1.02, 1.14, 0.8, 0.9][i]
		_mesh(g, _sph(r), puffs[i], _mat(Color("#fffaf2") if i % 2 == 0 else Color("#ecdfe6"), 1.0, 0.0, true))
	return g


func _build_birds() -> void:
	birds = Node3D.new()
	birds.position = Vector3(0, 8.5, -14)
	add_child(birds)
	for i in 3:
		var b := Node3D.new()
		b.position = Vector3(i * 1.3 - 1.3, 0.5 if i % 2 else 0.0, i * 0.7)
		birds.add_child(b)
		var wing := Node3D.new()
		b.add_child(wing)
		_mesh(wing, _box(0.9, 0.04, 0.16), Vector3.ZERO, _mat(Color("#2c3f4b"), 1.0, 0.0, true), Vector3(0, 0, 0.35))
		_mesh(wing, _box(0.9, 0.04, 0.16), Vector3.ZERO, _mat(Color("#38505e"), 1.0, 0.0, true), Vector3(0, 0, -0.35))
		bird_wings.append(wing)


func _build_debris() -> void:
	for d in DEBRIS:
		var g := Node3D.new()
		g.position = d["pos"]
		g.rotation.y = d["pos"].x
		add_child(g)
		var kind: int = d["kind"]
		match kind:
			0:
				_mesh(g, _cyl(0.3, 0.3, 0.86), Vector3.ZERO, _mat(Color("#e6a326"), 0.6, 0.25), Vector3(0, 0, PI / 2))
				for x in [-0.24, 0.24]:
					_mesh(g, _cyl(0.32, 0.32, 0.09), Vector3(x, 0, 0), _mat(Color("#a86f14"), 0.7, 0.3), Vector3(0, 0, PI / 2))
			1:
				var w := Node3D.new()
				w.rotation = Vector3(0.1, 0.4, 0.05)
				g.add_child(w)
				_mesh(w, _box(0.86, 0.24, 0.34), Vector3.ZERO, _mat(Color("#a15c2c"), 0.95))
				_mesh(w, _box(0.8, 0.2, 0.3), Vector3(0.06, 0.2, 0.05), _mat(Color("#8a4a22"), 0.95), Vector3(0, 0.2, 0.08))
			2:
				_mesh(g, _torus(0.22, 0.5), Vector3.ZERO, _mat(Color("#1b2427"), 0.95), Vector3(PI / 2, 0, 0))
			3:
				_mesh(g, _sph(0.34), Vector3.ZERO, _mat(Color("#ff6a3d"), 0.4))
				_mesh(g, _cyl(0.35, 0.35, 0.1), Vector3(0, 0.02, 0), _mat(Color("#f6f1e2"), 0.5))
				_mesh(g, _cyl(0.03, 0.03, 0.4), Vector3(0, 0.4, 0), _mat(Color("#cfd8d6"), 0.4, 0.6))
			4:
				var c := Node3D.new()
				c.rotation = Vector3(0, 0.6, 0.12)
				g.add_child(c)
				_mesh(c, _box(0.62, 0.5, 0.58), Vector3.ZERO, _mat(Color("#d9954a"), 0.85))
				_mesh(c, _box(0.64, 0.07, 0.02), Vector3(0, 0.02, 0.3), _mat(Color("#8c5a2a"), 0.9))
		debris_nodes.append({"node": g, "base": d["pos"], "seed": d["pos"].x * 1.73})


func _build_raft() -> void:
	raft = Node3D.new()
	raft.rotation.y = -0.25
	add_child(raft)
	hull_node = Node3D.new()
	raft.add_child(hull_node)
	_build_castaway()
	_add_wake_ring()


func _add_wake_ring() -> void:
	var ring := MeshInstance3D.new()
	ring.mesh = _torus(0.55, 0.78)
	var m := _mat(Color("#eafcff"), 1.0, 0.0, true)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = m
	ring.position = Vector3(0, -0.92, 0)
	ring.scale = Vector3.ONE * 1.9
	raft.add_child(ring)
	rings.append({"node": ring, "mat": m, "born": time, "speed": 0.45, "scale": 1.9})


func _build_castaway() -> void:
	castaway_root = Node3D.new()
	castaway_root.position = Vector3(0.42, 0.12, 0.5)
	castaway_root.rotation.y = -0.34
	castaway_root.scale = Vector3.ONE * 0.95
	raft.add_child(castaway_root)

	# legs + boots
	_mesh(castaway_root, _capsule(0.15, 0.46), Vector3(-0.18, 0.32, 0), _mat(Color("#33566b")), Vector3(0, 0, 0.05))
	_mesh(castaway_root, _capsule(0.15, 0.46), Vector3(0.2, 0.32, 0), _mat(Color("#3b5f76")), Vector3(0, 0, -0.04))
	_mesh(castaway_root, _box(0.24, 0.14, 0.36), Vector3(-0.19, 0.05, 0.07), _mat(Color("#2b2018"), 1.0))
	_mesh(castaway_root, _box(0.24, 0.14, 0.36), Vector3(0.21, 0.05, 0.07), _mat(Color("#2b2018"), 1.0))

	ca_torso = Node3D.new()
	ca_torso.position = Vector3(0, 0.62, 0)
	castaway_root.add_child(ca_torso)

	# hips + belt + buckle
	_mesh(ca_torso, _capsule(0.3, 0.1), Vector3(0, 0.05, 0), _mat(CLOTH, 0.92))
	_mesh(ca_torso, _cyl(0.32, 0.32, 0.11), Vector3(0, 0.11, 0), _mat(Color("#7a4a2a"), 0.75))
	_mesh(ca_torso, _box(0.12, 0.12, 0.05), Vector3(0, 0.11, 0.3), _mat(Color("#e0b64a"), 0.3, 0.7))

	# torso capsule
	_mesh(ca_torso, _capsule(0.31, 0.46), Vector3(0, 0.44, 0), _mat(CLOTH, 0.9))
	# weathered open jacket
	_mesh(ca_torso, _box(0.17, 0.66, 0.14), Vector3(-0.18, 0.44, 0.13), _mat(CLOTH_DARK, 0.88), Vector3(0, -0.32, -0.05))
	_mesh(ca_torso, _box(0.17, 0.66, 0.14), Vector3(0.18, 0.44, 0.13), _mat(CLOTH_DARK, 0.88), Vector3(0, 0.32, 0.05))
	# rope strap across the chest
	_mesh(ca_torso, _cyl(0.045, 0.045, 0.78), Vector3(0.02, 0.46, 0.26), _mat(Color("#c9a45f"), 0.9), Vector3(0, 0, 0.62))
	# neck
	_mesh(ca_torso, _cyl(0.12, 0.14, 0.14), Vector3(0, 0.76, 0), _mat(SKIN_DARK, 0.85))

	# right arm + held props
	ca_right_arm = Node3D.new()
	ca_right_arm.position = Vector3(0.32, 0.66, 0)
	ca_torso.add_child(ca_right_arm)
	_mesh(ca_right_arm, _capsule(0.11, 0.4), Vector3(0.02, -0.26, 0), _mat(CLOTH))
	_mesh(ca_right_arm, _capsule(0.095, 0.24), Vector3(0.04, -0.56, 0), _mat(SKIN, 0.85))
	_mesh(ca_right_arm, _sph(0.115), Vector3(0.05, -0.74, 0), _mat(SKIN, 0.85))

	ca_rod = Node3D.new()
	ca_rod.position = Vector3(0.05, -0.78, 0.02)
	ca_rod.rotation.z = -0.4
	ca_rod.scale = Vector3.ONE * 0.001
	ca_right_arm.add_child(ca_rod)
	_mesh(ca_rod, _cyl(0.018, 0.032, 1.7), Vector3(0, 0.7, 0), _mat(Color("#6b4326"), 0.8))
	_mesh(ca_rod, _cyl(0.09, 0.09, 0.07), Vector3(0, 0.05, 0.06), _mat(Color("#c8d3d3"), 0.3, 0.7), Vector3(PI / 2, 0, 0))

	ca_hammer = Node3D.new()
	ca_hammer.position = Vector3(0.06, -0.82, 0)
	ca_hammer.rotation.z = 0.2
	ca_hammer.scale = Vector3.ONE * 0.001
	ca_right_arm.add_child(ca_hammer)
	_mesh(ca_hammer, _cyl(0.035, 0.04, 0.42), Vector3(0, -0.16, 0), _mat(Color("#7a4d29"), 0.9))
	_mesh(ca_hammer, _box(0.14, 0.28, 0.14), Vector3(0, -0.38, 0), _mat(Color("#9aa7ac"), 0.35, 0.75), Vector3(0, 0, PI / 2))

	ca_flare = Node3D.new()
	ca_flare.position = Vector3(0.06, -0.8, 0)
	ca_flare.rotation.z = 0.3
	ca_flare.scale = Vector3.ONE * 0.001
	ca_right_arm.add_child(ca_flare)
	_mesh(ca_flare, _box(0.1, 0.26, 0.1), Vector3.ZERO, _mat(Color("#e04a2c"), 0.5))
	_mesh(ca_flare, _cyl(0.06, 0.06, 0.18), Vector3(0.05, 0.18, 0), _mat(Color("#2f3a3e"), 0.4, 0.6))

	# left arm
	ca_left_arm = Node3D.new()
	ca_left_arm.position = Vector3(-0.32, 0.66, 0)
	ca_torso.add_child(ca_left_arm)
	_mesh(ca_left_arm, _capsule(0.11, 0.4), Vector3(-0.02, -0.26, 0), _mat(CLOTH))
	_mesh(ca_left_arm, _capsule(0.095, 0.24), Vector3(-0.04, -0.56, 0), _mat(SKIN, 0.85))
	_mesh(ca_left_arm, _sph(0.115), Vector3(-0.05, -0.74, 0), _mat(SKIN, 0.85))

	# head — deliberately oversized for a chunky, readable silhouette
	ca_head = Node3D.new()
	ca_head.position = Vector3(0, 0.98, 0)
	ca_head.scale = Vector3.ONE * 1.12
	ca_torso.add_child(ca_head)
	_mesh(ca_head, _sph(0.3), Vector3.ZERO, _mat(SKIN, 0.75))
	_mesh(ca_head, _sph(0.07), Vector3(-0.29, -0.02, 0), _mat(SKIN_DARK, 0.8))
	_mesh(ca_head, _sph(0.07), Vector3(0.29, -0.02, 0), _mat(SKIN_DARK, 0.8))
	_mesh(ca_head, _cone(0.055, 0.13), Vector3(0, -0.04, 0.29), _mat(SKIN, 0.8), Vector3(PI / 2, 0, 0))
	for x in [-0.11, 0.11]:
		var eye := Node3D.new()
		eye.position = Vector3(x, 0.05, 0.24)
		ca_head.add_child(eye)
		_mesh(eye, _sph(0.056), Vector3.ZERO, _mat(Color("#fbf8ec"), 0.35))
		_mesh(eye, _sph(0.03), Vector3(0, 0, 0.035), _mat(Color("#16262b"), 1.0, 0.0, true))
		_mesh(eye, _sph(0.01), Vector3(0.012, 0.014, 0.05), _mat(Color.WHITE, 1.0, 0.0, true))
		_mesh(ca_head, _box(0.1, 0.026, 0.03), Vector3(x, 0.15, 0.25), _mat(Color("#3a2a1e")), Vector3(0, 0, 0.22 if x < 0 else -0.22))
	# salt-crusted beard
	_mesh(ca_head, _sph(0.22), Vector3(0, -0.17, 0.13), _mat(Color("#4d3524"), 1.0), Vector3.ZERO, Vector3(1.18, 0.9, 0.85))
	# bandana + wide brim hat
	_mesh(ca_head, _cyl(0.5, 0.52, 0.05), Vector3(0, 0.14, 0), _mat(Color("#caa063"), 0.95), Vector3(0.07, 0, 0.04))
	_mesh(ca_head, _cyl(0.26, 0.29, 0.22), Vector3(0, 0.26, 0), _mat(Color("#b98a4e"), 0.95))
	_mesh(ca_head, _cyl(0.3, 0.3, 0.06), Vector3(0, 0.18, 0), _mat(Color("#8a512a"), 0.9))


func _build_chopper() -> void:
	chopper = Node3D.new()
	chopper.position = Vector3(-16, 5.4, -4)
	chopper.rotation.y = 0.3
	chopper.scale = Vector3.ONE * 0.9
	add_child(chopper)
	_mesh(chopper, _box(1.9, 0.9, 0.95), Vector3.ZERO, _mat(Color("#f0f4f2"), 0.4, 0.3))
	_mesh(chopper, _sph(0.36), Vector3(0.55, 0.05, 0.46), _mat(Color(0.624, 0.863, 0.941, 0.7), 0.05, 0.0))
	_mesh(chopper, _box(1.5, 0.16, 0.16), Vector3(-1.5, 0.16, 0), _mat(Color("#e04a2c"), 0.5))
	_mesh(chopper, _cyl(0.34, 0.34, 0.05), Vector3(-2.2, 0.42, 0), _mat(Color("#c8d3d3"), 0.5, 0.5), Vector3(PI / 2, 0, 0))
	chopper_rotor = _mesh(chopper, _box(4.6, 0.04, 0.22), Vector3(0, 0.62, 0), _mat(Color("#4d5a60"), 0.4, 0.4))
	# search beam cone + the pool of light it throws on the deck
	var beam := MeshInstance3D.new()
	beam.mesh = _cone(1.5, 4.0)
	var bm := _mat(Color(1.0, 0.953, 0.804, 0.18), 1.0, 0.0, true)
	bm.cull_mode = BaseMaterial3D.CULL_DISABLED
	beam.material_override = bm
	beam.position = Vector3(0, -2.2, 0)
	chopper.add_child(beam)
	_light(chopper, Color("#fff2c8"), 2.6, 12.0, Vector3(0, -2.6, 0))
	_light(chopper, Color("#ff3b1e"), 0.6, 5.0, Vector3(-2.2, 0.42, 0))


func _build_storm_overlay() -> void:
	storm_light = OmniLight3D.new()
	storm_light.light_color = Color("#dbeaff")
	storm_light.light_energy = 0.0
	storm_light.omni_range = 60.0
	storm_light.position = Vector3(-6, 9, -6)
	add_child(storm_light)
	_particles(self, Color("#a9d6e6"), 60, Vector3(0, 3, 0), Vector3(8, 3, 6), 4.0, Vector3(0, -6, 0), 1.0, 0.03)


func _build_ambient_sparkles() -> void:
	_particles(self, Color("#d8fbff"), 30, Vector3(0, 1.8, 0), Vector3(5.5, 1.5, 4), 0.3, Vector3(0, 0.05, 0), 4.0, 0.025)


# ================================================================ structures

func _pop_in(node: Node3D, delay := 0.0) -> void:
	node.scale = Vector3.ONE * 0.001
	node.visible = false
	buildins.append({"node": node, "born": time + delay})
	var burst := CPUParticles3D.new()
	burst.amount = 14
	burst.lifetime = 0.9
	burst.one_shot = true
	burst.explosiveness = 1.0
	burst.mesh = _box(0.05, 0.05, 0.05)
	burst.material_override = _glow_mat(Color("#ffd66b"), 1.4)
	burst.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	burst.emission_sphere_radius = 0.7
	burst.initial_velocity_min = 1.0
	burst.initial_velocity_max = 2.2
	burst.gravity = Vector3(0, -2, 0)
	node.add_child(burst)
	burst.emitting = true


func set_stage(new_stage: int) -> void:
	if new_stage == stage:
		return
	stage = new_stage
	for c in hull_node.get_children():
		c.queue_free()
	_build_hull()


func set_built(built: Array) -> void:
	for sname in ["RAIN CATCHER", "SCRAP SHELTER", "SOLAR STILL", "GREENHOUSE", "RADIO TOWER"]:
		var has_node: bool = struct_refs.has(sname)
		var is_built: bool = built.has(sname)
		if is_built and not has_node:
			var g := _build_structure(sname)
			raft.add_child(g)
			_pop_in(g, 0.1 * struct_refs.size())
		elif not is_built and has_node:
			struct_refs[sname]["root"].queue_free()
			struct_refs.erase(sname)


func _build_structure(name: String) -> Node3D:
	match name:
		"RAIN CATCHER":
			return _build_rain_catcher()
		"SCRAP SHELTER":
			return _build_shelter()
		"SOLAR STILL":
			return _build_solar_still()
		"GREENHOUSE":
			return _build_greenhouse()
		"RADIO TOWER":
			return _build_radio_tower()
	return Node3D.new()


func _build_hull() -> void:
	var wide := stage >= 2
	var huge := stage >= 4
	var log_xs: Array = [-2.6, -1.85, -1.1, -0.35, 0.4, 1.15, 1.9, 2.65] if huge else ([-1.9, -1.15, -0.4, 0.35, 1.1, 1.85] if wide else [-1.45, -0.72, 0, 0.72, 1.45])
	var deck_width := 6.1 if huge else (4.6 if wide else 3.85)
	var rows := 11 if huge else (9 if wide else 7)
	var zs: Array = []
	for i in rows:
		zs.append((i - (rows - 1) / 2.0) * 0.48)
	var half_z := ((rows - 1) / 2.0) * 0.48 + 0.3

	# buoyancy logs
	for i in log_xs.size():
		var x: float = log_xs[i]
		_mesh(hull_node, _cyl(0.32, 0.35, half_z * 2.0 + 0.5), Vector3(x, -0.38, 0), _mat(Color("#7c4a26") if i % 2 == 0 else Color("#8f5a31"), 0.95), Vector3(PI / 2, 0, 0))
	# deck planks
	for i in zs.size():
		_mesh(hull_node, _box(deck_width, 0.15, 0.42), Vector3(0, -0.04, zs[i]), _mat(PLANKS[i % PLANKS.size()], 0.92), Vector3(0, 0.011 if i % 2 else -0.009, 0))
	# lashing beams + rope wraps
	for x in [-deck_width / 2.0 + 0.3, deck_width / 2.0 - 0.3]:
		_mesh(hull_node, _box(0.14, 0.07, half_z * 2.0), Vector3(x, 0.05, 0), _mat(Color("#5a3b22"), 0.85))
		for i in zs.size():
			if i % 3 == 0:
				_mesh(hull_node, _torus(0.135, 0.205), Vector3(x, 0.06, zs[i]), _mat(Color("#cfa961"), 0.9), Vector3(PI / 2, 0, 0))
	# tire fenders
	for f in [[-deck_width / 2.0 - 0.15, 0.3], [deck_width / 2.0 + 0.15, -0.6], [-deck_width / 2.0 - 0.15, -1.4]]:
		_mesh(hull_node, _torus(0.26, 0.54), Vector3(f[0], -0.36, f[1]), _mat(Color("#1c2424"), 0.85), Vector3(PI / 2, 0, 0))
	# safety railing once the base is established
	if stage >= 3:
		for x in [-deck_width / 2.0 + 0.15, deck_width / 2.0 - 0.15]:
			var rail := Node3D.new()
			hull_node.add_child(rail)
			_mesh(rail, _box(0.06, 0.06, half_z * 2.0), Vector3(x, 0.45, 0), _mat(Color("#8a5a30"), 0.9))
			for i in zs.size():
				if i % 4 == 0:
					_mesh(rail, _cyl(0.045, 0.05, 0.5), Vector3(x, 0.24, zs[i]), _mat(Color("#7a4d29"), 0.9))
			_pop_in(rail)
	# upper deck: the raft becomes a real base
	if huge:
		var upper := Node3D.new()
		upper.position = Vector3(1.5, 0, -0.4)
		hull_node.add_child(upper)
		_mesh(upper, _box(2.5, 0.16, 2.4), Vector3(0, 1.32, 0), _mat(Color("#c07f45"), 0.9))
		for p in [Vector2(-1.1, -1.05), Vector2(1.1, -1.05), Vector2(-1.1, 1.05), Vector2(1.1, 1.05)]:
			_mesh(upper, _box(0.17, 1.4, 0.17), Vector3(p.x, 0.64, p.y), _mat(Color("#6f4526"), 0.95))
		for i in 5:
			_mesh(upper, _box(0.42, 0.06, 0.06), Vector3(-1.32, 0.2 + i * 0.26, 1.05), _mat(Color("#8a5a30"), 0.9))
		_pop_in(upper)
	# supply clutter
	_mesh(hull_node, _box(0.72, 0.62, 0.68), Vector3(-1.35, 0.33, 1.0), _mat(Color("#cd8f47"), 0.85))
	_mesh(hull_node, _box(0.5, 0.44, 0.48), Vector3(-1.42, 0.85, 0.92), _mat(Color("#b3763a"), 0.85), Vector3(0, 0.4, 0))
	var drum := Node3D.new()
	drum.position = Vector3(1.5, 0.29, 1.1)
	hull_node.add_child(drum)
	_mesh(drum, _cyl(0.27, 0.27, 0.64), Vector3.ZERO, _mat(Color("#3f7d86"), 0.45, 0.35))
	_mesh(drum, _cyl(0.285, 0.285, 0.13), Vector3(0, 0.02, 0), _mat(Color("#2c5960"), 0.45, 0.35))
	# coiled rope
	for i in 3:
		_mesh(hull_node, _torus(0.24 - i * 0.04, 0.24 - i * 0.04 + 0.05), Vector3(-0.5, 0.07 + i * 0.06, 1.3), _mat(Color("#c9a45f"), 0.95))


func _build_rain_catcher() -> Node3D:
	var g := Node3D.new()
	g.position = Vector3(-1.15, 0.05, -0.75)
	_mesh(g, _cyl(0.05, 0.07, 1.7), Vector3(-0.72, 0.85, 0), _mat(Color("#5a3418"), 0.95))
	_mesh(g, _cyl(0.05, 0.07, 1.7), Vector3(0.72, 0.85, 0), _mat(Color("#5a3418"), 0.95))
	var funnel := _mesh(g, _cyl(1.3, 0.15, 0.55), Vector3(0, 1.6, 0), _mat(Color("#f2762f"), 0.8))
	funnel.rotation.z = -0.06
	_mesh(g, _cyl(0.06, 0.06, 0.5), Vector3(0, 1.32, 0), _mat(Color("#9fb0b4"), 0.4, 0.6))
	_mesh(g, _cyl(0.36, 0.38, 0.85), Vector3(0, 0.42, 0), _mat(Color("#3d6f78"), 0.6, 0.3))
	var level_mat := _mat(Color(0.341, 0.847, 0.933, 0.85), 0.15)
	level_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var level := _mesh(g, _cyl(0.33, 0.33, 0.8), Vector3(0, 0.2, 0), level_mat)
	level.scale = Vector3(1, 0.16, 1)
	struct_refs["RAIN CATCHER"] = {"root": g, "funnel": funnel, "level": level, "collecting": false}
	return g


func _build_shelter() -> Node3D:
	var g := Node3D.new()
	g.position = Vector3(-1.1, 0.05, -0.45)
	g.rotation.y = 0.16
	_mesh(g, _box(1.75, 1.45, 1.6), Vector3(0, 0.75, 0), _mat(Color("#7d5330"), 0.98))
	for x in [-0.6, -0.2, 0.2, 0.6]:
		_mesh(g, _box(0.16, 1.4, 0.05), Vector3(x, 0.75, 0.82), _mat(Color("#8e6038"), 0.95))
	_mesh(g, _box(1.35, 1.35, 1.9), Vector3(0, 1.62, 0), _mat(Color("#c2603a"), 0.85, 0.15), Vector3(0, 0, PI / 4))
	_mesh(g, _box(0.5, 0.5, 0.55), Vector3(0.5, 1.86, 0.4), _mat(Color("#9aa7ac"), 0.5, 0.6), Vector3(0, 0, PI / 4))
	_mesh(g, _box(0.05, 1.0, 0.6), Vector3(0.89, 0.68, 0.35), _mat(Color("#2a1a10")))
	_light(g, Color("#ffb257"), 0.6, 2.4, Vector3(0.7, 0.7, 0.35))
	_mesh(g, _cyl(0.03, 0.03, 0.9), Vector3(-0.7, 2.15, 0), _mat(Color("#cfd8d6"), 0.5, 0.5))
	var flag := _mesh(g, _box(0.36, 0.22, 0.02), Vector3(-0.55, 2.45, 0), _mat(Color("#ffd23f"), 0.7))
	struct_refs["SCRAP SHELTER"] = {"root": g, "flag": flag}
	return g


func _build_solar_still() -> Node3D:
	var g := Node3D.new()
	g.position = Vector3(1.35, 0.28, -0.85)
	g.rotation.y = -0.24
	_mesh(g, _cyl(0.07, 0.09, 1.0), Vector3(0, 0.5, 0), _mat(Color("#8a949a"), 0.4, 0.7))
	var panel := Node3D.new()
	panel.position = Vector3(0, 1.0, 0)
	panel.rotation.x = -0.5
	g.add_child(panel)
	for x in [-0.72, 0.72]:
		var half := Node3D.new()
		half.position = Vector3(x, 0, 0)
		panel.add_child(half)
		_mesh(half, _box(1.34, 0.09, 0.92), Vector3.ZERO, _mat(Color("#17324f"), 0.25, 0.6))
		for c in [-0.42, 0.0, 0.42]:
			var cell := _mesh(half, _box(0.34, 0.02, 0.84), Vector3(c, 0.055, 0), _mat(Color("#2f7fc4"), 0.15, 0.4))
			cell.material_override.set("emission_enabled", true)
			cell.material_override.set("emission", Color("#2b7fd0"))
			cell.material_override.set("emission_energy_multiplier", 0.5)
	var tank := Node3D.new()
	tank.position = Vector3(0.55, 0.3, 0.6)
	g.add_child(tank)
	_mesh(tank, _cyl(0.32, 0.36, 0.78), Vector3.ZERO, _mat(Color("#48c3d2"), 0.3, 0.4))
	_mesh(tank, _cyl(0.14, 0.14, 0.18), Vector3(0, 0.44, 0), _mat(Color("#2b6f7c"), 0.35, 0.6))
	var glow := _glow_mat(Color("#5cffd0"), 0.4)
	glow.albedo_color = Color("#0d2a30")
	_mesh(tank, _box(0.22, 0.16, 0.05), Vector3(0, 0.1, 0.34), glow)
	struct_refs["SOLAR STILL"] = {"root": g, "panel": panel, "glow": glow, "active": false}
	return g


func _build_greenhouse() -> Node3D:
	var g := Node3D.new()
	g.position = Vector3(1.2, 1.4, -0.35)
	var glass := _mat(Color(0.655, 0.949, 0.886, 0.3), 0.08)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mesh(g, _box(1.7, 1.0, 1.4), Vector3(0, 0.5, 0), glass)
	for x in [-0.85, 0.85]:
		for z in [-0.7, 0.7]:
			_mesh(g, _box(0.07, 1.02, 0.07), Vector3(x, 0.5, z), _mat(Color("#d8e6e2"), 0.4, 0.4))
	var roof_glass := _mat(Color(0.776, 1.0, 0.949, 0.32), 0.1)
	roof_glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mesh(g, _box(0.9, 0.9, 1.45), Vector3(0, 1.16, 0), roof_glass, Vector3(0, 0, PI / 4))
	_mesh(g, _box(1.5, 0.22, 1.2), Vector3(0, 0.12, 0), _mat(Color("#4a3323"), 1.0))
	var crops := Node3D.new()
	crops.position = Vector3(0, 0.3, 0)
	g.add_child(crops)
	for x in [-0.5, -0.17, 0.17, 0.5]:
		for z in [-0.3, 0.3]:
			var plant := Node3D.new()
			plant.position = Vector3(x, 0, z)
			crops.add_child(plant)
			_mesh(plant, _cyl(0.03, 0.04, 0.24), Vector3.ZERO, _mat(Color("#3f8a35"), 0.9))
			_mesh(plant, _sph(0.15), Vector3(0, 0.2, 0), _mat(Color("#63cc49"), 0.85))
			_mesh(plant, _sph(0.06), Vector3(0.08, 0.26, 0.06), _mat(Color("#ff5f4d"), 0.6))
	struct_refs["GREENHOUSE"] = {"root": g, "crops": crops}
	return g


func _build_radio_tower() -> Node3D:
	var g := Node3D.new()
	g.position = Vector3(-1.55, 0.05, -0.6)
	_mesh(g, _cyl(0.05, 0.11, 3.8), Vector3(0, 1.9, 0), _mat(Color("#ccdfe2"), 0.28, 0.8))
	for i in 4:
		var y: float = [0.7, 1.5, 2.3, 3.1][i]
		var cross := Node3D.new()
		cross.position = Vector3(0, y, 0)
		cross.rotation.y = i * 0.4
		g.add_child(cross)
		var length := 0.9 - i * 0.13
		_mesh(cross, _cyl(0.028, 0.028, length), Vector3.ZERO, _mat(Color("#e3f0f2"), 0.3, 0.7), Vector3(0, 0, PI / 2))
		_mesh(cross, _cyl(0.028, 0.028, length), Vector3.ZERO, _mat(Color("#e3f0f2"), 0.3, 0.7), Vector3(PI / 2, 0, 0))
	for s in [-1, 1]:
		_mesh(g, _cyl(0.012, 0.012, 2.8), Vector3(s * 0.5, 1.3, 0), _mat(Color("#9fb0b4"), 0.5, 0.5), Vector3(0, 0, s * 0.38))
	var dish := Node3D.new()
	dish.position = Vector3(0, 3.2, 0)
	g.add_child(dish)
	var dish_mesh := _mesh(dish, _sph(0.34), Vector3(0.28, 0, 0), _mat(Color("#eef6f7"), 0.35, 0.4), Vector3(0, 0, -1.1), Vector3(1, 0.5, 1))
	dish_mesh.set("cast_shadow", false)
	var beacon_mat := _glow_mat(Color("#ff6a45"), 2.0)
	beacon_mat.albedo_color = Color("#ff6a45")
	_mesh(g, _sph(0.13), Vector3(0, 3.85, 0), beacon_mat)
	var beacon_light := _light(g, Color("#ff5230"), 0.3, 6.0, Vector3(0, 3.85, 0))
	struct_refs["RADIO TOWER"] = {"root": g, "beacon": beacon_mat, "dish": dish, "light": beacon_light}
	return g


# ================================================================ hotspots

func set_hotspots(specs: Array) -> void:
	for h in hotspots:
		h["ring"].queue_free()
	hotspots.clear()
	for spec in specs:
		var place: Dictionary = HOTSPOT_PLACES.get(spec["id"], {})
		if place.is_empty():
			continue
		var parent: Node = raft if place["on_raft"] else self
		var g := Node3D.new()
		g.position = place["pos"]
		parent.add_child(g)
		var tone: Color = Color(spec["tone"])
		var ring_mat := _mat(tone if not spec["locked"] else Color("#7d8a8c"), 1.0, 0.0, true)
		ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		var ring := MeshInstance3D.new()
		ring.mesh = _torus(0.36, 0.46)
		ring.material_override = ring_mat
		g.add_child(ring)
		var inner := MeshInstance3D.new()
		inner.mesh = _torus(0.1, 0.16)
		var inner_mat := ring_mat.duplicate()
		inner_mat.albedo_color.a = 0.85
		inner.material_override = inner_mat
		g.add_child(inner)
		if not spec["locked"]:
			_light(g, tone, 0.65, 2.4, Vector3.ZERO)
		hotspots.append({"id": spec["id"], "ring": g, "ring_mesh": ring, "inner": inner, "ring_mat": ring_mat, "locked": spec["locked"]})


func _anim_hotspots() -> void:
	var show := action == "" and ending == ""
	for h in hotspots:
		h["ring"].visible = show
		if not show:
			continue
		var beat := sin(time * 2.4) * 0.5 + 0.5
		var s := 1.0 + beat * 0.28
		h["ring_mesh"].scale = Vector3.ONE * s
		h["ring_mat"].albedo_color.a = 0.22 if h["locked"] else 0.35 + (1.0 - beat) * 0.45
		h["inner"].rotation.y = time * 0.6


# ================================================================ day flow

func set_action(a: String) -> void:
	action = a
	if a != "":
		action_started = time
		prev_action = a
	_respawn_fx()


func pulse_up() -> void:
	pulse += 1
	last_pulse = pulse
	kick = 1.0
	_respawn_fx()


func set_storm(s: bool) -> void:
	storm = s
	Audio.set_storm(s)


func set_ending(e: String) -> void:
	ending = e
	bg_calm = not (storm or e == "lost")
	if chopper != null:
		chopper.visible = e == "rescued"


func _respawn_fx() -> void:
	for c in fx_root.get_children():
		c.queue_free()
	fx = {}
	if action == "" or ending != "":
		return
	match action:
		"repair":
			_particles(fx_root, Color("#ffc63f"), 46, Vector3(0.2, 0.5, 0.9), Vector3(1.3, 0.75, 1.0), 3.4, Vector3(0, -2, 0), 0.7, 0.06)
			_particles(fx_root, Color("#fff2c0"), 20, Vector3(0.2, 0.5, 0.9), Vector3(0.7, 0.4, 0.6), 5.0, Vector3(0, -3, 0), 0.5, 0.09)
			_light(fx_root, Color("#ff9a1e"), 4.0, 5.0, Vector3(0.2, 0.5, 0.9))
		"rest":
			_particles(fx_root, Color("#ffe9a8"), 18, Vector3(0.4, 1.9, 0.4), Vector3(0.7, 0.8, 0.7), 0.6, Vector3(0, 0.4, 0), 2.0, 0.05)
			_light(fx_root, Color("#ffd58a"), 1.8, 5.0, Vector3(0.4, 1.9, 0.4))
		"rain":
			_particles(fx_root, Color(0.851, 0.984, 1.0, 0.75), 46, Vector3(0, 4.2, 0), Vector3(4.5, 0.1, 3.5), 6.5, Vector3(0, -6.5, 0), 0.85, 0.05)
		"purify":
			var g := Node3D.new()
			g.position = Vector3(1.85, 0.35, -0.3)
			fx_root.add_child(g)
			var stream := _mesh(g, _cyl(0.05, 0.11, 1.5), Vector3.ZERO, _glow_mat(Color(0.494, 0.941, 1.0, 0.85), 0.8), Vector3(0, 0, -0.3))
			stream.set("cast_shadow", false)
			_particles(g, Color("#c6fbff"), 26, Vector3.ZERO, Vector3(0.45, 0.75, 0.45), 2.4, Vector3(0, -2, 0), 0.8, 0.04)
			_light(g, Color("#5fe6ff"), 1.8, 3.5, Vector3.ZERO)
			fx = {"kind": "purify", "node": g, "born": time}
		"fish":
			var g := Node3D.new()
			fx_root.add_child(g)
			_mesh(g, _capsule(0.22, 0.42), Vector3.ZERO, _mat(Color("#ffa63f"), 0.35, 0.35), Vector3(0, PI / 2, 0))
			_mesh(g, _cone(0.26, 0.42), Vector3(-0.45, 0, 0), _mat(Color("#ffd062"), 0.4), Vector3(0, 0, PI / 2))
			_mesh(g, _sph(0.06), Vector3(0.18, 0.08, 0.16), _mat(Color("#1c2b30"), 1.0, 0.0, true))
			_particles(g, Color("#bff4ff"), 16, Vector3.ZERO, Vector3(0.5, 0.5, 0.5), 2.0, Vector3(0, 0.5, 0), 0.8, 0.04)
			fx = {"kind": "fish", "node": g, "born": time}
		"salvage":
			var g := Node3D.new()
			fx_root.add_child(g)
			_mesh(g, _box(0.9, 0.6, 0.72), Vector3.ZERO, _mat(Color("#e08c33"), 0.65, 0.3))
			_mesh(g, _box(0.92, 0.09, 0.03), Vector3(0, 0.02, 0.37), _mat(Color("#8a5325"), 0.9))
			_mesh(g, _cyl(0.022, 0.022, 4.2), Vector3(-2.0, 0.55, 0), _mat(Color("#eee9cf"), 1.0, 0.0, true), Vector3(0, 0, 0.35))
			_particles(g, Color("#d8f6ff"), 14, Vector3.ZERO, Vector3(0.7, 0.3, 0.5), 1.5, Vector3(0, -1, 0), 0.9, 0.04)
			fx = {"kind": "salvage", "node": g, "born": time}
		"dive":
			_add_ring(Vector3(0.6, -0.95, 1.7), 1.3, 1.4)
			_add_ring(Vector3(0.6, -0.95, 1.7), 0.8, 2.1)
			var bubbles := Node3D.new()
			bubbles.position = Vector3(0.6, -1.2, 1.7)
			fx_root.add_child(bubbles)
			for i in 16:
				var r := 0.05 + (i % 5) * 0.018
				var bm := _mat(Color(0.812, 0.98, 1.0, 0.6), 0.05)
				bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				_mesh(bubbles, _sph(r), Vector3(sin(i * 1.9) * 0.45, i * 0.2, cos(i * 2.3) * 0.4), bm)
			fx = {"kind": "dive", "node": bubbles, "born": time}
		"signal":
			var g := Node3D.new()
			fx_root.add_child(g)
			_mesh(g, _sph(0.19), Vector3.ZERO, _mat(Color("#ff502a"), 1.0, 0.0, true))
			var halo := _mat(Color(1.0, 0.604, 0.282, 0.35), 1.0, 0.0, true)
			halo.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			var halo_mesh := _mesh(g, _sph(0.42), Vector3.ZERO, halo)
			halo_mesh.set("cast_shadow", false)
			_light(g, Color("#ff4022"), 7.5, 14.0, Vector3.ZERO)
			_particles(g, Color("#ffb066"), 34, Vector3.ZERO, Vector3(0.3, 1.6, 0.3), 2.4, Vector3(0, 2, 0), 0.9, 0.05)
			fx = {"kind": "signal", "node": g, "born": time}


func _add_ring(pos: Vector3, s: float, speed: float) -> void:
	var ring := MeshInstance3D.new()
	ring.mesh = _torus(0.55, 0.78)
	var m := _mat(Color("#eafcff"), 1.0, 0.0, true)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = m
	ring.position = pos
	fx_root.add_child(ring)
	rings.append({"node": ring, "mat": m, "born": time, "speed": speed, "scale": s})


# ================================================================ animation

func _dampf(a: float, b: float, l: float, dt: float) -> float:
	return lerpf(a, b, 1.0 - exp(-l * dt))


func _dampv(a: Vector3, b: Vector3, l: float, dt: float) -> Vector3:
	return a.lerp(b, 1.0 - exp(-l * dt))


func _anim_ocean(delta: float) -> void:
	if ocean_mat == null:
		return
	ocean_mat.set_shader_parameter("u_time", time)
	var target_chop := 1.85 if storm else 1.0
	chop = _dampf(chop, target_chop, 2.2, delta)
	ocean_mat.set_shader_parameter("u_chop", chop)
	var target_deep := DEEP_STORM if (storm or ending == "lost") else DEEP_CALM
	deep = deep.lerp(target_deep, minf(1.0, delta * 1.5))
	ocean_mat.set_shader_parameter("u_deep", deep)
	var stormy := storm or ending == "lost"
	var bg := Color("#3d5f74") if stormy else Color("#8fd9ea")
	var fog := Color("#4a6b7d") if stormy else Color("#a6e2ea")
	env.background_color = env.background_color.lerp(bg, minf(1.0, delta * 1.5))
	env.fog_light_color = env.fog_light_color.lerp(fog, minf(1.0, delta * 1.5))


func _anim_raft(delta: float) -> void:
	if raft == null:
		return
	if last_pulse != pulse:
		last_pulse = pulse
		kick = 1.0
	kick = _dampf(kick, 0.0, 5.0, delta)
	var sink := -1.1 if ending == "lost" else 0.0
	raft.position.y = sin(time * 1.15) * 0.12 + sin(time * 0.53) * 0.05 + kick * 0.12 + sink
	raft.rotation.z = sin(time * 0.72) * 0.035 + kick * 0.03
	raft.rotation.x = cos(time * 0.55) * 0.026
	raft.rotation.y = -0.25 + sin(time * 0.31) * 0.03 + (0.25 if ending == "lost" else 0.0)
	var s := 1.0 + kick * 0.05
	raft.scale = Vector3.ONE * s


func _anim_castaway(delta: float) -> void:
	if castaway_root == null:
		return
	var t := time
	var p := t - action_started
	if prev_action != action:
		prev_action = action
		action_started = t
		p = 0.0

	# idle: breathing, weight shift, subtle bob
	var breath := sin(t * 1.7) * 0.5 + 0.5
	ca_torso.position.y = 0.62 + sin(t * 1.7) * 0.018
	ca_torso.rotation.z = sin(t * 0.85) * 0.035
	ca_torso.scale = Vector3(1, 1 + breath * 0.02, 1)
	ca_head.rotation.y = sin(t * 0.42) * 0.2 + sin(t * 0.17) * 0.13
	ca_head.rotation.x = sin(t * 0.6) * 0.06 - 0.03

	# dive: the survivor actually leaves the deck
	var diving := action == "dive"
	var dip := sin(minf(p / 1.1, 1.0) * PI) if diving else 0.0
	castaway_root.position.y = _dampf(castaway_root.position.y, 0.12 - dip * 2.4, 6.0, delta)
	castaway_root.rotation.x = _dampf(castaway_root.rotation.x, -dip * 1.5 if diving else 0.0, 6.0, delta)
	var crouch := 0.9 if (action == "repair" or action == "build") else 1.0
	var cs := _dampf(castaway_root.scale.x, crouch * 0.95, 6.0, delta)
	castaway_root.scale = Vector3.ONE * cs

	# arms per action
	var swing := func(base: float, amt: float, speed: float) -> float: return base + sin(p * speed) * amt
	var rz := 0.34
	var rx := 0.0
	var lz := -0.3
	var lx := 0.0
	match action:
		"fish":
			rz = swing.call(1.5, 0.45, 5.5); rx = -0.35; lz = swing.call(-1.2, 0.3, 5.5)
		"salvage":
			rz = swing.call(1.35, 0.5, 6.5); lz = swing.call(-1.25, 0.5, 6.5); rx = -0.5; lx = -0.5
		"repair", "build":
			rz = swing.call(1.95, 0.85, 13.0); rx = -0.25; lz = -1.35; lx = -0.6
		"signal":
			rz = 2.65; rx = -0.45; lz = -0.5
		"rain":
			rz = 2.2; lz = -2.05; rx = -0.25; lx = -0.25
		"purify":
			rz = 1.25; rx = -0.55
		"rest":
			rz = swing.call(0.26, 0.05, 1.1); lz = swing.call(-0.22, 0.05, 1.1)
		_:
			rz = swing.call(0.34, 0.05, 1.7); lz = swing.call(-0.3, 0.05, 1.7)
	var k := 1.0 - pow(0.001, delta)
	ca_right_arm.rotation.z = lerpf(ca_right_arm.rotation.z, rz, k)
	ca_right_arm.rotation.x = lerpf(ca_right_arm.rotation.x, rx, k)
	ca_left_arm.rotation.z = lerpf(ca_left_arm.rotation.z, lz, k)
	ca_left_arm.rotation.x = lerpf(ca_left_arm.rotation.x, lx, k)

	# held props fade in/out with their action
	_show_prop(ca_rod, action == "fish", delta)
	_show_prop(ca_hammer, action == "repair" or action == "build", delta)
	_show_prop(ca_flare, action == "signal", delta)


func _show_prop(group: Node3D, visible: bool, delta: float) -> void:
	var target := 1.0 if visible else 0.001
	var s := _dampf(group.scale.x, target, 12.0, delta)
	group.scale = Vector3.ONE * s
	group.visible = s > 0.05


func _anim_structures(delta: float) -> void:
	if struct_refs.has("RAIN CATCHER"):
		var r: Dictionary = struct_refs["RAIN CATCHER"]
		r["funnel"].rotation.z = -0.06 + sin(time * 1.3) * 0.035
		var target := 0.5 if r["collecting"] else 0.16
		var h := _dampf(r["level"].scale.y, target, 2.5, delta)
		r["level"].scale = Vector3(1, h, 1)
		r["level"].position.y = 0.12 + h * 0.5
	if struct_refs.has("SCRAP SHELTER"):
		struct_refs["SCRAP SHELTER"]["flag"].rotation.y = sin(time * 3.2) * 0.35
	if struct_refs.has("SOLAR STILL"):
		var s: Dictionary = struct_refs["SOLAR STILL"]
		s["panel"].rotation.x = -0.5 + sin(time * 0.4) * 0.06
		var glow_target := 2.6 if s["active"] else 0.35 + sin(time * 2.0) * 0.12
		s["glow"].emission_energy_multiplier = _dampf(s["glow"].emission_energy_multiplier, glow_target, 4.0, delta)
	if struct_refs.has("GREENHOUSE"):
		struct_refs["GREENHOUSE"]["crops"].rotation.z = sin(time * 1.4) * 0.05
	if struct_refs.has("RADIO TOWER"):
		var t: Dictionary = struct_refs["RADIO TOWER"]
		var base := 5.0 if ending == "rescued" else 2.0
		var speed := 9.0 if ending == "rescued" else 3.4
		t["beacon"].emission_energy_multiplier = base * (0.55 + 0.45 * sin(time * speed))
		t["dish"].rotation.y = time * 0.6
		t["light"].light_energy = (2.2 if ending == "rescued" else 0.75) * (0.55 + 0.45 * sin(time * speed))


func _anim_sky() -> void:
	var stormy := storm or ending == "lost"
	for c in clouds_calm:
		c["node"].visible = not stormy
		if stormy:
			continue
		var base: Vector3 = c["base"]
		var span := 46.0
		var x := fmod(base.x + time * c["drift"] + span, span * 2.0) - span
		c["node"].position = Vector3(x, base.y + sin(time * 0.3 + c["seed"]) * 0.12, base.z)
	for c in clouds_storm:
		c["node"].visible = stormy
		if not stormy:
			continue
		var base: Vector3 = c["base"]
		var span := 46.0
		var x := fmod(base.x + time * c["drift"] + span, span * 2.0) - span
		c["node"].position = Vector3(x, base.y + sin(time * 0.3 + c["seed"]) * 0.12, base.z)
	birds.visible = not stormy
	if not stormy:
		birds.position.x = sin(time * 0.11) * 14.0
		birds.position.z = -14.0 + cos(time * 0.11) * 7.0
		birds.rotation.y = -time * 0.11
		for i in bird_wings.size():
			bird_wings[i].rotation.z = sin(time * 7.0 + i * 1.4) * 0.6


func _anim_debris() -> void:
	for d in debris_nodes:
		var base: Vector3 = d["base"]
		var sd: float = d["seed"]
		d["node"].position.y = base.y + sin(time * 1.15 + sd) * 0.14
		d["node"].position.x = base.x + sin(time * 0.14 + sd) * 0.4
		d["node"].position.z = base.z + cos(time * 0.11 + sd * 0.7) * 0.3
		d["node"].rotation.z = sin(time * 0.6 + sd) * 0.16
		d["node"].rotation.x = cos(time * 0.45 + sd) * 0.1


func _anim_buildins() -> void:
	for i in range(buildins.size() - 1, -1, -1):
		var b: Dictionary = buildins[i]
		var node: Node3D = b["node"]
		if time < b["born"]:
			node.visible = false
			continue
		node.visible = true
		var p := clampf((time - b["born"]) / 0.85, 0.0, 1.0)
		var e := 1.0 if p >= 1.0 else 1.0 - pow(2.0, -9.0 * p) * cos((p * 10.0 - 0.75) * 2.4)
		node.scale = Vector3.ONE * maxf(0.001, e)
		node.rotation.y = (1.0 - p) * 0.8
		if p >= 1.0:
			buildins.remove_at(i)


func _anim_rings() -> void:
	for i in range(rings.size() - 1, -1, -1):
		var r: Dictionary = rings[i]
		if not is_instance_valid(r["node"]):
			rings.remove_at(i)
			continue
		var p := fmod((time - r["born"]) * r["speed"], 1.6)
		var eased := 1.0 - pow(1.0 - p / 1.6, 3.0)
		r["node"].scale = Vector3.ONE * (0.3 + eased * 2.6) * r["scale"]
		r["mat"].albedo_color.a = maxf(0.0, 0.7 - eased * 0.7)


func _anim_fx() -> void:
	if fx.is_empty():
		return
	var node: Node3D = fx["node"]
	var p: float = time - fx["born"]
	match fx["kind"]:
		"fish":
			var eased := minf(p / 1.05, 1.0)
			node.position = Vector3(2.9 - eased * 2.3, -0.7 + sin(eased * PI) * 2.3, 0.9 - eased * 0.3)
			node.rotation.z = -0.5 + eased * 2.4
			node.rotation.y = sin(time * 12.0) * 0.35
		"salvage":
			var eased2 := minf(p / 1.05, 1.0)
			node.position = Vector3(4.2 - eased2 * 3.4, -0.55 + sin(eased2 * PI) * 0.85, 0.5 - eased2 * 0.2)
			node.rotation.z = sin(time * 3.0) * 0.18
		"signal":
			node.position = Vector3(0.5 + p * 0.55, 1.7 + p * 3.4, 0)
		"dive":
			node.position.y = -1.2 + fmod(p * 1.5, 2.2)
		"purify":
			node.rotation.y = sin(time * 2.0) * 0.1


func _anim_chopper(delta: float) -> void:
	if chopper == null or not chopper.visible:
		return
	var t := time
	chopper.position.x = _dampf(chopper.position.x, -2.2, 0.9, delta)
	chopper.position.y = 5.4 + sin(t * 1.4) * 0.22
	chopper.rotation.z = sin(t * 0.9) * 0.06
	chopper_rotor.rotation.y = t * 34.0


func _anim_storm(_delta: float) -> void:
	var stormy := storm or ending == "lost"
	if storm_light == null:
		return
	storm_light.visible = stormy
	if stormy:
		var strike := maxf(0.0, sin(time * 2.3) - 0.93) * 10.0 + maxf(0.0, sin(time * 5.7) - 0.97) * 15.0
		storm_light.light_energy = strike


## The dolphin that adopts the raft after the DOLPHINS event.
func spawn_dolphin() -> void:
	if dolphin != null:
		return
	dolphin = Node3D.new()
	add_child(dolphin)
	_mesh(dolphin, _cone(0.14, 0.52), Vector3.ZERO, _mat(Color("#3d5666"), 0.55), Vector3(0.12, 0, 0))
	_mesh(dolphin, _cone(0.07, 0.3), Vector3(0, 0.1, -0.18), _mat(Color("#4d6a7c"), 0.55), Vector3(-1.35, 0, 0))


func _anim_dolphin(delta: float) -> void:
	if dolphin == null:
		return
	var stormy := storm or ending == "lost"
	dolphin.visible = not stormy and ending != "rescued"
	if not dolphin.visible:
		return
	dolphin_angle += delta * 0.55
	var r := 4.3
	var x := cos(dolphin_angle) * r
	var z := sin(dolphin_angle) * r
	# she surfaces to breathe, and jumps every so often
	var p := fmod(time, 7.0)
	var jump := 0.0
	if p < 1.1:
		jump = sin(p / 1.1 * PI) * 1.5
	var y := -0.72 + sin(time * 1.6) * 0.08 + jump
	dolphin.position = Vector3(x, y, z)
	dolphin.rotation.y = -dolphin_angle + PI / 2.0
	dolphin.rotation.z = -cos(p / 1.1 * PI) * 0.5 if p < 1.1 else sin(time * 1.3) * 0.08


func _anim_camera(delta: float) -> void:
	if cam == null:
		return
	var key := ending if ending != "" else (action if action != "" else "idle")
	var shot: Dictionary = SHOTS.get(key, SHOTS["idle"])
	var pos: Vector3 = shot["pos"]
	var look: Vector3 = shot["look"]

	# gentle handheld drift + pointer parallax layered on top of the framed shot
	# (storms shake the lens)
	var amp := 2.1 if (storm or ending == "lost") else 1.0
	var vp := get_viewport().get_visible_rect().size
	var mouse := get_viewport().get_mouse_position()
	var pointer := Vector2(clampf(mouse.x / maxf(1.0, vp.x) * 2.0 - 1.0, -1.0, 1.0), clampf(mouse.y / maxf(1.0, vp.y) * 2.0 - 1.0, -1.0, 1.0))
	var drift_x := (sin(time * 0.23) * 0.18 + pointer.x * 0.4) * amp
	var drift_y := (sin(time * 0.31) * 0.1 - pointer.y * 0.2) * amp

	cam.position = _dampv(cam.position, Vector3(pos.x + drift_x, pos.y + drift_y, pos.z), 1.8, delta)
	cam_look = _dampv(cam_look, look, 2.2, delta)
	cam.look_at(cam_look)

	var aspect := vp.x / maxf(1.0, vp.y)
	var portrait := clampf(0.75 / aspect, 1.0, 1.5)
	var target_fov: float = shot["fov"] * portrait
	cam.fov = _dampf(cam.fov, target_fov, 2.0, delta)
