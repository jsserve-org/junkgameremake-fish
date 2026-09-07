shader_type spatial;
render_mode unshaded;

// DRIFT/30 ocean — ported from the three.js ShaderMaterial in OceanScene.tsx.
// The plane lies flat (XZ), waves displace along Y.

uniform float u_time = 0.0;
uniform float u_chop = 1.0;
uniform vec3 u_deep = vec3(0.0196, 0.1922, 0.3098);
uniform vec3 u_shallow = vec3(0.0745, 0.5686, 0.7059);
uniform vec3 u_crest = vec3(0.3412, 0.8588, 0.8588);
uniform vec3 u_sun = vec3(1.0, 0.8588, 0.6392);

varying float v_wave;
varying float v_foam;
varying vec3 v_world;

float wave_field(vec2 p, float t) {
	float h = 0.0;
	h += sin(p.x * 0.42 + t * 1.05) * 0.30;
	h += sin(p.y * 0.36 - t * 0.80) * 0.24;
	h += sin((p.x * 0.85 + p.y * 0.62) + t * 1.55) * 0.11;
	h += sin((p.x * 1.90 - p.y * 1.45) - t * 2.10) * 0.045;
	h += sin((p.x * 3.30 + p.y * 2.70) + t * 3.10) * 0.018;
	return h;
}

void vertex() {
	vec3 p = VERTEX;
	float t = u_time;
	float h = wave_field(p.xz, t) * u_chop;
	p.y += h;

	// cheap slope sample for foam on the leading face of crests
	float dx = wave_field(p.xz + vec2(0.35, 0.0), t) * u_chop - h;
	v_foam = clamp(h * 1.5 + dx * 3.0, 0.0, 1.0);
	v_wave = h;

	VERTEX = p;
	v_world = (MODEL_MATRIX * vec4(p, 1.0)).xyz;
}

void fragment() {
	float depth = clamp(v_wave * 1.9 + 0.5, 0.0, 1.0);
	vec3 color = mix(u_deep, u_shallow, depth);
	color = mix(color, u_crest, smoothstep(0.45, 0.95, depth) * 0.75);

	// drifting foam streaks along the crests
	float streak = smoothstep(0.55, 0.92, v_foam)
		* (0.55 + 0.45 * sin(v_world.x * 3.1 + v_world.z * 2.3 + u_time * 1.6));
	color = mix(color, vec3(0.94, 0.99, 1.0), clamp(streak, 0.0, 1.0) * 0.55);

	// sun glitter path running toward the camera
	float glitter_band = exp(-pow((v_world.x - 7.0) * 0.16, 2.0));
	float glitter = pow(max(sin(v_world.x * 5.7 + v_world.z * 4.1 - u_time * 2.4), 0.0), 22.0);
	color += u_sun * glitter * glitter_band * 1.1;

	// horizon haze
	float far = smoothstep(16.0, 46.0, length(v_world.xz));
	color = mix(color, u_shallow * 1.35, far * 0.65);

	ALBEDO = color;
}
