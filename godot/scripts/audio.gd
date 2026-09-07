extends Node
## Procedural audio for DRIFT 30.
##
## Everything is synthesised at startup into AudioStreamWAVs — no asset files,
## no licensing. A looped filtered-noise bed stands in for the surf, with a
## slow LFO on the cutoff so it rises and falls like swell.

const SR := 22050

## Voice name -> rendered AudioStreamWAV
var _voices := {}
var _players: Array = []
var _player_idx := 0
var _ambient: AudioStreamPlayer
var _ambient_fx: AudioEffectLowPassFilter
var _storm := false
var _amb_gain := 0.055
var _time := 0.0

const ACTION_VOICE := {
	"fish": "catch", "salvage": "haul", "purify": "pour", "repair": "spark",
	"dive": "splash", "rest": "rest", "rain": "pour", "signal": "flare",
	"bail": "splash", "build": "spark",
}


func _ready() -> void:
	_build_voices()
	_setup_ambience()
	for i in 8:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_players.append(p)


func _process(delta: float) -> void:
	_time += delta
	if _ambient_fx != null:
		# slow LFO on the cutoff so the surf breathes like swell
		_ambient_fx.cutoff_hz = 520.0 + 260.0 * sin(_time * TAU * 0.09)
	var target := 0.16 if _storm else 0.055
	_amb_gain = lerpf(_amb_gain, target, minf(1.0, delta / 1.2))
	if _ambient != null:
		_ambient.volume_db = linear_to_db(_amb_gain)


func set_muted(muted: bool) -> void:
	AudioServer.set_bus_mute(0, muted)


func set_storm(storm: bool) -> void:
	_storm = storm


func play(voice: String) -> void:
	if not _voices.has(voice):
		return
	var p: AudioStreamPlayer = _players[_player_idx]
	_player_idx = (_player_idx + 1) % _players.size()
	p.stream = _voices[voice]
	p.play()


func play_action(action_id: String) -> void:
	play(ACTION_VOICE.get(action_id, "click"))


## Rising arpeggio when a structure finishes building.
func play_upgrade() -> void:
	play("upgrade")


func play_win() -> void:
	play("win")


func play_lose() -> void:
	play("lose")


# ---------------------------------------------------------------- synthesis

func _tone_part(start: float, dur: float, peak: float, wave: String, f0: float, f1 := -1.0) -> Dictionary:
	return {"kind": "tone", "start": start, "dur": dur, "peak": peak, "wave": wave, "f0": f0, "f1": f1}


func _noise_part(start: float, dur: float, peak: float, c0: float, c1 := -1.0) -> Dictionary:
	return {"kind": "noise", "start": start, "dur": dur, "peak": peak, "c0": c0, "c1": c1}


func _render(parts: Array) -> AudioStreamWAV:
	var total := 0.0
	for p in parts:
		total = maxf(total, p["start"] + p["dur"])
	var n := int(total * SR) + 64
	var buf := PackedFloat32Array()
	buf.resize(n)
	for p in parts:
		var samps := _render_part(p)
		var off := int(p["start"] * SR)
		for i in samps.size():
			if off + i < n:
				buf[off + i] += samps[i]
	var bytes := PackedByteArray()
	bytes.resize(n * 2)
	for i in n:
		var v := int(clampf(buf[i], -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, v)
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SR
	wav.stereo = false
	wav.data = bytes
	return wav


func _render_part(p: Dictionary) -> PackedFloat32Array:
	var dur: float = p["dur"]
	var n := maxi(1, int(dur * SR))
	var out := PackedFloat32Array()
	out.resize(n)
	var peak: float = p["peak"]
	var phase := 0.0
	var low := 0.0
	var band := 0.0
	for i in n:
		var t := float(i) / SR
		var s := 0.0
		if p["kind"] == "tone":
			var f0: float = p["f0"]
			var f1: float = p["f1"] if p["f1"] > 0 else f0
			var f := f0 * pow(f1 / f0, t / dur) if dur > 0.0 else f0
			phase += f / SR
			match p["wave"]:
				"sine":
					s = sin(phase * TAU)
				"square":
					s = signf(sin(phase * TAU))
				"saw":
					s = fmod(phase, 1.0) * 2.0 - 1.0
				"tri":
					s = 1.0 - 4.0 * absf(fmod(phase + 0.25, 1.0) - 0.5)
		else:
			var c0: float = p["c0"]
			var c1: float = p["c1"] if p["c1"] > 0 else c0
			var c := c0 * pow(c1 / c0, t / dur) if dur > 0.0 else c0
			# Chamberlin state-variable bandpass over white noise
			var fcoef := 2.0 * sin(PI * clampf(c, 20.0, SR * 0.45) / SR)
			var input := randf() * 2.0 - 1.0
			var high := input - low - 0.9 * band
			band += fcoef * high
			low += fcoef * band
			s = band
		var env := peak * clampf(t / 0.012, 0.0, 1.0) * exp(-6.5 * t / dur)
		out[i] = s * env
	return out


func _build_voices() -> void:
	var parts: Array

	parts = [_tone_part(0.0, 0.07, 0.16, "square", 430.0, 620.0)]
	_voices["click"] = _render(parts)

	parts = [_tone_part(0.0, 0.1, 0.2, "saw", 180.0, 110.0), _tone_part(0.09, 0.12, 0.16, "saw", 150.0, 90.0)]
	_voices["deny"] = _render(parts)

	parts = [_noise_part(0.0, 0.45, 0.34, 900.0, 260.0), _noise_part(0.16, 0.5, 0.16, 500.0, 180.0)]
	_voices["splash"] = _render(parts)

	parts = [
		_noise_part(0.0, 0.22, 0.2, 1400.0, 600.0),
		_tone_part(0.12, 0.16, 0.18, "tri", 620.0, 940.0),
		_tone_part(0.24, 0.2, 0.16, "tri", 940.0, 1250.0),
	]
	_voices["catch"] = _render(parts)

	parts = [_noise_part(0.0, 0.5, 0.18, 380.0, 190.0), _tone_part(0.05, 0.4, 0.16, "saw", 150.0, 95.0)]
	_voices["haul"] = _render(parts)

	parts = []
	for i in 5:
		parts.append(_noise_part(i * 0.11, 0.09, 0.26, 2600.0 + i * 220, 900.0))
	_voices["spark"] = _render(parts)

	parts = [_noise_part(0.0, 0.9, 0.15, 1900.0, 700.0), _tone_part(0.1, 0.5, 0.09, "sine", 760.0, 1080.0)]
	_voices["pour"] = _render(parts)

	parts = [_noise_part(0.0, 0.7, 0.24, 700.0, 2600.0), _tone_part(0.0, 0.6, 0.2, "saw", 300.0, 1500.0)]
	_voices["flare"] = _render(parts)

	parts = [_tone_part(0.0, 0.5, 0.12, "sine", 392.0), _tone_part(0.12, 0.55, 0.1, "sine", 523.0)]
	_voices["rest"] = _render(parts)

	parts = []
	for i in 4:
		parts.append(_tone_part(i * 0.09, 0.42, 0.17, "tri", [523.0, 659.0, 784.0, 1047.0][i]))
	_voices["upgrade"] = _render(parts)

	parts = [_noise_part(0.5, 1.6, 0.09, 500.0, 1600.0)]
	for i in 5:
		parts.append(_tone_part(i * 0.13, 1.4, 0.19, "tri", [523.0, 659.0, 784.0, 1047.0, 1319.0][i]))
	_voices["win"] = _render(parts)

	parts = [_noise_part(0.0, 2.2, 0.2, 380.0, 120.0)]
	for i in 4:
		parts.append(_tone_part(i * 0.2, 1.1, 0.2, "saw", [392.0, 330.0, 262.0, 196.0][i]))
	_voices["lose"] = _render(parts)


func _setup_ambience() -> void:
	# looping noise bed through a lowpass bus
	var idx := AudioServer.bus_count
	AudioServer.add_bus(idx)
	AudioServer.set_bus_name(idx, "Ambient")
	AudioServer.set_bus_send(idx, "Master")
	_ambient_fx = AudioEffectLowPassFilter.new()
	_ambient_fx.cutoff_hz = 520.0
	_ambient_fx.resonance = 0.7
	AudioServer.add_bus_effect(idx, _ambient_fx)

	var frames := SR * 2
	var bytes := PackedByteArray()
	bytes.resize(frames * 2)
	for i in frames:
		bytes.encode_s16(i * 2, int((randf() * 2.0 - 1.0) * 32767.0))
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SR
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.loop_begin = 0
	wav.loop_end = frames
	wav.data = bytes

	_ambient = AudioStreamPlayer.new()
	_ambient.stream = wav
	_ambient.bus = "Ambient"
	_ambient.volume_db = linear_to_db(_amb_gain)
	add_child(_ambient)
	_ambient.play()
