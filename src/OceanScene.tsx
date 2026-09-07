import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox, Sparkles } from "@react-three/drei";
import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import * as THREE from "three";

export type Ending = "rescued" | "adrift" | "lost" | null;

/** A tappable point in the world. The scene owns where each action lives. */
export type HotspotSpec = {
  id: string;
  tone: string;
  locked: boolean;
  disabled: boolean;
  selected: boolean;
  shortcut: string;
  content: ReactNode;
};

/**
 * Where each action physically happens. Deck actions ride the raft so they rock
 * with it; water actions stay put in the world. The ring marks the spot; the
 * tag for it docks in the row along the bottom.
 */
const HOTSPOT_PLACES: Record<string, { pos: [number, number, number]; onRaft: boolean }> = {
  fish: { pos: [3.1, -0.55, 1.5], onRaft: false },
  salvage: { pos: [-3.5, -0.45, 1.1], onRaft: false },
  dive: { pos: [0.7, -0.6, 2.3], onRaft: false },
  purify: { pos: [1.5, 0.75, 1.1], onRaft: true },
  repair: { pos: [-0.2, 0.25, 0.5], onRaft: true },
  rest: { pos: [-1.15, 1.0, -0.45], onRaft: true },
  rain: { pos: [-1.15, 2.05, -0.75], onRaft: true },
  signal: { pos: [0.5, 1.5, 0.2], onRaft: true },
  bail: { pos: [1.55, 0.15, -1.05], onRaft: true },
  build: { pos: [-1.6, 0.4, 1.15], onRaft: true },
};

type SceneProps = {
  stage: number;
  /** Names of the structures actually standing — the ladder is not a fixed order. */
  built: string[];
  pulse: number;
  action: string | null;
  ending: Ending;
  storm: boolean;
  hotspots: HotspotSpec[];
  onPick: (id: string) => void;
};

/* ------------------------------------------------------------------ *
 * Ocean
 * ------------------------------------------------------------------ */

const waterVertex = /* glsl */ `
  uniform float uTime;
  uniform float uChop;
  varying float vWave;
  varying float vFoam;
  varying vec3 vWorld;

  float waveField(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.x * 0.42 + t * 1.05) * 0.30;
    h += sin(p.y * 0.36 - t * 0.80) * 0.24;
    h += sin((p.x * 0.85 + p.y * 0.62) + t * 1.55) * 0.11;
    h += sin((p.x * 1.90 - p.y * 1.45) - t * 2.10) * 0.045;
    h += sin((p.x * 3.30 + p.y * 2.70) + t * 3.10) * 0.018;
    return h;
  }

  void main() {
    vec3 p = position;
    float t = uTime;
    float h = waveField(p.xy, t) * uChop;
    p.z += h;

    // cheap normal-ish slope for foam on the leading face of crests
    float dx = waveField(p.xy + vec2(0.35, 0.0), t) * uChop - h;
    vFoam = clamp(h * 1.5 + dx * 3.0, 0.0, 1.0);
    vWave = h;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uCrest;
  uniform vec3 uSun;
  varying float vWave;
  varying float vFoam;
  varying vec3 vWorld;

  void main() {
    float depth = clamp(vWave * 1.9 + 0.5, 0.0, 1.0);
    vec3 color = mix(uDeep, uShallow, depth);
    color = mix(color, uCrest, smoothstep(0.45, 0.95, depth) * 0.75);

    // drifting foam streaks along the crests
    float streak = smoothstep(0.55, 0.92, vFoam)
      * (0.55 + 0.45 * sin(vWorld.x * 3.1 + vWorld.z * 2.3 + uTime * 1.6));
    color = mix(color, vec3(0.94, 0.99, 1.0), clamp(streak, 0.0, 1.0) * 0.55);

    // sun glitter path running toward the camera
    float glitterBand = exp(-pow((vWorld.x - 7.0) * 0.16, 2.0));
    float glitter = pow(max(sin(vWorld.x * 5.7 + vWorld.z * 4.1 - uTime * 2.4), 0.0), 22.0);
    color += uSun * glitter * glitterBand * 1.1;

    // horizon haze
    float far = smoothstep(16.0, 46.0, length(vWorld.xz));
    color = mix(color, uShallow * 1.35, far * 0.65);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const DEEP_CALM = new THREE.Color("#05314f");
const DEEP_STORM = new THREE.Color("#04202f");

function Ocean({ storm }: { storm: boolean }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uChop: { value: 1 },
          uDeep: { value: new THREE.Color("#05314f") },
          uShallow: { value: new THREE.Color("#1391b4") },
          uCrest: { value: new THREE.Color("#57dbdb") },
          uSun: { value: new THREE.Color("#ffdba3") },
        },
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
      }),
    [],
  );

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    const targetChop = storm ? 1.85 : 1;
    material.uniforms.uChop.value = THREE.MathUtils.damp(
      material.uniforms.uChop.value as number,
      targetChop,
      2.2,
      delta,
    );
    const deep = material.uniforms.uDeep.value as THREE.Color;
    deep.lerp(storm ? DEEP_STORM : DEEP_CALM, Math.min(1, delta * 1.5));
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.04, 0]}>
      <planeGeometry args={[110, 110, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Expanding ring of foam — used for splashes, dives, impacts. */
function FoamRing({ position, scale = 1, speed = 1 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!ref.current || !material.current) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const p = ((clock.elapsedTime - born.current) * speed) % 1.6;
    const eased = 1 - Math.pow(1 - Math.min(p / 1.6, 1), 3);
    ref.current.scale.setScalar((0.3 + eased * 2.6) * scale);
    material.current.opacity = Math.max(0, 0.7 - eased * 0.7);
  });

  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.55, 0.78, 34]} />
      <meshBasicMaterial ref={material} color="#eafcff" transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ *
 * Sky
 * ------------------------------------------------------------------ */

function Cloud({ position, scale, drift }: { position: [number, number, number]; scale: number; drift: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const span = 46;
    const x = ((position[0] + clock.elapsedTime * drift + span) % (span * 2)) - span;
    ref.current.position.x = x;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.3 + position[2]) * 0.12;
  });
  const puffs: [number, number, number, number][] = [
    [-1.35, -0.1, 0, 0.78],
    [-0.5, 0.18, 0.2, 1.02],
    [0.45, 0.24, -0.15, 1.14],
    [1.35, -0.02, 0.1, 0.8],
    [0.1, -0.24, 0.3, 0.9],
  ];
  return (
    <group ref={ref} position={position} scale={scale}>
      {puffs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 14, 10]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#fffaf2" : "#ecdfe6"} />
        </mesh>
      ))}
    </group>
  );
}

function Sky({ storm }: { storm: boolean }) {
  return (
    <group>
      {/* sun disc + layered bloom */}
      <mesh position={[11, 5.4, -26]}>
        <sphereGeometry args={[2.1, 26, 20]} />
        <meshBasicMaterial color="#fff5df" />
      </mesh>
      <mesh position={[11, 5.4, -26.6]}>
        <sphereGeometry args={[3.6, 26, 20]} />
        <meshBasicMaterial color="#ffd694" transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[11, 5.4, -27.2]}>
        <sphereGeometry args={[6.4, 26, 20]} />
        <meshBasicMaterial color="#ffb877" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {!storm && (
        <>
          <Cloud position={[-13, 7.4, -22]} scale={1.9} drift={0.16} />
          <Cloud position={[6, 9.2, -30]} scale={2.6} drift={0.1} />
          <Cloud position={[19, 6.1, -25]} scale={1.5} drift={0.21} />
          <Cloud position={[-24, 8.5, -34]} scale={2.2} drift={0.13} />
        </>
      )}
      {storm && (
        <>
          <Cloud position={[-8, 6.6, -18]} scale={3.4} drift={0.5} />
          <Cloud position={[9, 7.2, -21]} scale={3.9} drift={0.44} />
          <Cloud position={[24, 6.0, -24]} scale={3.1} drift={0.55} />
        </>
      )}
    </group>
  );
}

function Birds() {
  const ref = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Group[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = Math.sin(t * 0.11) * 14;
      ref.current.position.z = -14 + Math.cos(t * 0.11) * 7;
      ref.current.rotation.y = -t * 0.11;
    }
    wings.current.forEach((w, i) => {
      if (w) w.rotation.z = Math.sin(t * 7 + i * 1.4) * 0.6;
    });
  });
  return (
    <group ref={ref} position={[0, 8.5, -14]}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[i * 1.3 - 1.3, i % 2 ? 0.5 : 0, i * 0.7]}>
          <group
            ref={(node) => {
              if (node) wings.current[i] = node;
            }}
          >
            <mesh rotation={[0, 0, 0.35]}>
              <boxGeometry args={[0.9, 0.04, 0.16]} />
              <meshBasicMaterial color="#2c3f4b" />
            </mesh>
            <mesh rotation={[0, 0, -0.35]} position={[0.0, 0, 0]}>
              <boxGeometry args={[0.9, 0.04, 0.16]} />
              <meshBasicMaterial color="#38505e" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Floating debris
 * ------------------------------------------------------------------ */

type DebrisKind = 0 | 1 | 2 | 3 | 4;

function DebrisPiece({ position, kind, seed }: { position: [number, number, number]; kind: DebrisKind; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.15 + seed) * 0.14;
    ref.current.position.x = position[0] + Math.sin(t * 0.14 + seed) * 0.4;
    ref.current.position.z = position[2] + Math.cos(t * 0.11 + seed * 0.7) * 0.3;
    ref.current.rotation.z = Math.sin(t * 0.6 + seed) * 0.16;
    ref.current.rotation.x = Math.cos(t * 0.45 + seed) * 0.1;
  });

  return (
    <group ref={ref} position={position} rotation={[0, seed, 0]}>
      {kind === 0 && (
        <group>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.3, 0.3, 0.86, 14]} />
            <meshStandardMaterial color="#e6a326" roughness={0.6} metalness={0.25} />
          </mesh>
          {[-0.24, 0.24].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.32, 0.32, 0.09, 14]} />
              <meshStandardMaterial color="#a86f14" roughness={0.7} metalness={0.3} />
            </mesh>
          ))}
        </group>
      )}
      {kind === 1 && (
        <group rotation={[0.1, 0.4, 0.05]}>
          <RoundedBox args={[0.86, 0.24, 0.34]} radius={0.03}>
            <meshStandardMaterial color="#a15c2c" roughness={0.95} />
          </RoundedBox>
          <RoundedBox args={[0.8, 0.2, 0.3]} radius={0.03} position={[0.06, 0.2, 0.05]} rotation={[0, 0.2, 0.08]}>
            <meshStandardMaterial color="#8a4a22" roughness={0.95} />
          </RoundedBox>
        </group>
      )}
      {kind === 2 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.36, 0.14, 10, 20]} />
          <meshStandardMaterial color="#1b2427" roughness={0.95} />
        </mesh>
      )}
      {kind === 3 && (
        <group>
          <mesh>
            <sphereGeometry args={[0.34, 18, 14]} />
            <meshStandardMaterial color="#ff6a3d" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.1, 18]} />
            <meshStandardMaterial color="#f6f1e2" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
            <meshStandardMaterial color="#cfd8d6" metalness={0.6} />
          </mesh>
        </group>
      )}
      {kind === 4 && (
        <group rotation={[0, 0.6, 0.12]}>
          <RoundedBox args={[0.62, 0.5, 0.58]} radius={0.05}>
            <meshStandardMaterial color="#d9954a" roughness={0.85} />
          </RoundedBox>
          <mesh position={[0, 0.02, 0.3]}>
            <boxGeometry args={[0.64, 0.07, 0.02]} />
            <meshStandardMaterial color="#8c5a2a" roughness={0.9} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Castaway
 * ------------------------------------------------------------------ */

const SKIN = "#d08a55";
const SKIN_DARK = "#b26f3f";
const CLOTH = "#e8dfc6";
const CLOTH_DARK = "#b9543a";

/** Small helper so limbs read as chunky, rounded, toy-like shapes. */
function Limb({
  length,
  radius,
  color,
  position,
  rotation,
}: {
  length: number;
  radius: number;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <capsuleGeometry args={[radius, length, 8, 16]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Castaway({ action }: { action: string | null }) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rod = useRef<THREE.Group>(null);
  const hammer = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Group>(null);
  const startedAt = useRef<number | null>(null);
  const prevAction = useRef<string | null>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (prevAction.current !== action) {
      prevAction.current = action;
      startedAt.current = t;
    }
    if (startedAt.current === null) startedAt.current = t;
    const p = t - startedAt.current;

    // --- idle: breathing, weight shift, subtle bob ---
    const breath = Math.sin(t * 1.7) * 0.5 + 0.5;
    if (torso.current) {
      torso.current.position.y = 0.62 + Math.sin(t * 1.7) * 0.018;
      torso.current.rotation.z = Math.sin(t * 0.85) * 0.035;
      torso.current.scale.y = 1 + breath * 0.02;
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.42) * 0.2 + Math.sin(t * 0.17) * 0.13;
      head.current.rotation.x = Math.sin(t * 0.6) * 0.06 - 0.03;
    }

    // --- dive: the survivor actually leaves the deck ---
    if (root.current) {
      const diving = action === "dive";
      const dip = diving ? Math.sin(Math.min(p / 1.1, 1) * Math.PI) : 0;
      root.current.position.y = THREE.MathUtils.damp(root.current.position.y, 0.12 - dip * 2.4, 6, delta);
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, diving ? -dip * 1.5 : 0, 6, delta);
      const crouch = action === "repair" || action === "build" ? 0.9 : 1;
      root.current.scale.setScalar(THREE.MathUtils.damp(root.current.scale.x, crouch * 0.95, 6, delta));
    }

    // --- arms per action ---
    const swing = (base: number, amt: number, speed: number) => base + Math.sin(p * speed) * amt;
    if (rightArm.current && leftArm.current) {
      let rz = 0.34;
      let rx = 0;
      let lz = -0.3;
      let lx = 0;
      if (action === "fish") {
        rz = swing(1.5, 0.45, 5.5);
        rx = -0.35;
        lz = swing(-1.2, 0.3, 5.5);
      } else if (action === "salvage") {
        rz = swing(1.35, 0.5, 6.5);
        lz = swing(-1.25, 0.5, 6.5);
        rx = -0.5;
        lx = -0.5;
      } else if (action === "repair" || action === "build") {
        rz = swing(1.95, 0.85, 13);
        rx = -0.25;
        lz = -1.35;
        lx = -0.6;
      } else if (action === "signal") {
        rz = 2.65;
        rx = -0.45;
        lz = -0.5;
      } else if (action === "rain") {
        rz = 2.2;
        lz = -2.05;
        rx = -0.25;
        lx = -0.25;
      } else if (action === "purify") {
        rz = 1.25;
        rx = -0.55;
      } else if (action === "rest") {
        rz = swing(0.26, 0.05, 1.1);
        lz = swing(-0.22, 0.05, 1.1);
      } else {
        rz = swing(0.34, 0.05, 1.7);
        lz = swing(-0.3, 0.05, 1.7);
      }
      const k = 1 - Math.pow(0.001, delta);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, rz, k);
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, rx, k);
      leftArm.current.rotation.z = THREE.MathUtils.lerp(leftArm.current.rotation.z, lz, k);
      leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, lx, k);
    }

    // held props fade in/out with their action
    const show = (group: THREE.Group | null, visible: boolean) => {
      if (!group) return;
      const target = visible ? 1 : 0.001;
      const s = THREE.MathUtils.damp(group.scale.x, target, 12, delta);
      group.scale.setScalar(s);
      group.visible = s > 0.05;
    };
    show(rod.current, action === "fish");
    show(hammer.current, action === "repair" || action === "build");
    show(flare.current, action === "signal");
  });

  return (
    <group ref={root} position={[0.42, 0.12, 0.5]} rotation={[0, -0.34, 0]} scale={0.95}>
      {/* legs */}
      <Limb length={0.46} radius={0.15} color="#33566b" position={[-0.18, 0.32, 0]} rotation={[0, 0, 0.05]} />
      <Limb length={0.46} radius={0.15} color="#3b5f76" position={[0.2, 0.32, 0]} rotation={[0, 0, -0.04]} />
      {[-0.19, 0.21].map((x) => (
        <RoundedBox key={x} args={[0.24, 0.14, 0.36]} radius={0.05} position={[x, 0.05, 0.07]} castShadow>
          <meshStandardMaterial color="#2b2018" roughness={1} />
        </RoundedBox>
      ))}

      <group ref={torso} position={[0, 0.62, 0]}>
        {/* hips + belt */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.1, 8, 18]} />
          <meshStandardMaterial color={CLOTH} roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.11, 20]} />
          <meshStandardMaterial color="#7a4a2a" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.11, 0.3]}>
          <boxGeometry args={[0.12, 0.12, 0.05]} />
          <meshStandardMaterial color="#e0b64a" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* torso */}
        <mesh position={[0, 0.44, 0]} castShadow>
          <capsuleGeometry args={[0.31, 0.46, 10, 20]} />
          <meshStandardMaterial color={CLOTH} roughness={0.9} />
        </mesh>
        {/* weathered open jacket */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.18 * s, 0.44, 0.13]} rotation={[0, 0.32 * s, 0.05 * s]} castShadow>
            <boxGeometry args={[0.17, 0.66, 0.14]} />
            <meshStandardMaterial color={CLOTH_DARK} roughness={0.88} />
          </mesh>
        ))}
        {/* rope strap across the chest */}
        <mesh position={[0.02, 0.46, 0.26]} rotation={[0, 0, 0.62]}>
          <cylinderGeometry args={[0.045, 0.045, 0.78, 8]} />
          <meshStandardMaterial color="#c9a45f" roughness={0.9} />
        </mesh>

        {/* neck */}
        <mesh position={[0, 0.76, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.14, 14]} />
          <meshStandardMaterial color={SKIN_DARK} roughness={0.85} />
        </mesh>

        {/* right arm (+ held tools) */}
        <group ref={rightArm} position={[0.32, 0.66, 0]}>
          <Limb length={0.4} radius={0.11} color={CLOTH} position={[0.02, -0.26, 0]} />
          <Limb length={0.24} radius={0.095} color={SKIN} position={[0.04, -0.56, 0]} />
          <mesh position={[0.05, -0.74, 0]} castShadow>
            <sphereGeometry args={[0.115, 14, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.85} />
          </mesh>

          <group ref={rod} position={[0.05, -0.78, 0.02]} rotation={[0, 0, -0.4]} visible={false}>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.018, 0.032, 1.7, 8]} />
              <meshStandardMaterial color="#6b4326" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.05, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.07, 12]} />
              <meshStandardMaterial color="#c8d3d3" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>

          <group ref={hammer} position={[0.06, -0.82, 0]} rotation={[0, 0, 0.2]} visible={false}>
            <mesh position={[0, -0.16, 0]}>
              <cylinderGeometry args={[0.035, 0.04, 0.42, 8]} />
              <meshStandardMaterial color="#7a4d29" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.38, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.14, 0.28, 0.14]} />
              <meshStandardMaterial color="#9aa7ac" metalness={0.75} roughness={0.35} />
            </mesh>
          </group>

          <group ref={flare} position={[0.06, -0.8, 0]} visible={false}>
            <mesh rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.1, 0.26, 0.1]} />
              <meshStandardMaterial color="#e04a2c" roughness={0.5} />
            </mesh>
            <mesh position={[0.05, 0.18, 0]} rotation={[0, 0, 0.3]}>
              <cylinderGeometry args={[0.06, 0.06, 0.18, 10]} />
              <meshStandardMaterial color="#2f3a3e" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        </group>

        {/* left arm */}
        <group ref={leftArm} position={[-0.32, 0.66, 0]}>
          <Limb length={0.4} radius={0.11} color={CLOTH} position={[-0.02, -0.26, 0]} />
          <Limb length={0.24} radius={0.095} color={SKIN} position={[-0.04, -0.56, 0]} />
          <mesh position={[-0.05, -0.74, 0]} castShadow>
            <sphereGeometry args={[0.115, 14, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.85} />
          </mesh>
        </group>

        {/* head — deliberately oversized for a chunky, readable silhouette */}
        <group ref={head} position={[0, 0.98, 0]} scale={1.12}>
          <mesh castShadow>
            <sphereGeometry args={[0.3, 30, 24]} />
            <meshStandardMaterial color={SKIN} roughness={0.75} />
          </mesh>
          {[-0.29, 0.29].map((x) => (
            <mesh key={x} position={[x, -0.02, 0]}>
              <sphereGeometry args={[0.07, 12, 10]} />
              <meshStandardMaterial color={SKIN_DARK} roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, -0.04, 0.29]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.055, 0.13, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.8} />
          </mesh>
          {/* big cartoon eyes read at phone size */}
          {[-0.11, 0.11].map((x) => (
            <group key={x} position={[x, 0.05, 0.24]}>
              <mesh>
                <sphereGeometry args={[0.056, 16, 12]} />
                <meshStandardMaterial color="#fbf8ec" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0, 0.035]}>
                <sphereGeometry args={[0.03, 12, 10]} />
                <meshBasicMaterial color="#16262b" />
              </mesh>
              <mesh position={[0.012, 0.014, 0.05]}>
                <sphereGeometry args={[0.01, 8, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {[-0.11, 0.11].map((x) => (
            <mesh key={x} position={[x, 0.15, 0.25]} rotation={[0, 0, x < 0 ? 0.22 : -0.22]}>
              <boxGeometry args={[0.1, 0.026, 0.03]} />
              <meshStandardMaterial color="#3a2a1e" />
            </mesh>
          ))}
          {/* salt-crusted beard */}
          <mesh position={[0, -0.17, 0.13]} scale={[1.18, 0.9, 0.85]}>
            <sphereGeometry args={[0.22, 18, 14]} />
            <meshStandardMaterial color="#4d3524" roughness={1} />
          </mesh>
          {/* bandana + wide brim hat */}
          <mesh position={[0, 0.14, 0]} rotation={[0.07, 0, 0.04]} castShadow>
            <cylinderGeometry args={[0.5, 0.52, 0.05, 26]} />
            <meshStandardMaterial color="#caa063" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.26, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.29, 0.22, 22]} />
            <meshStandardMaterial color="#b98a4e" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.06, 22]} />
            <meshStandardMaterial color="#8a512a" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Raft + modules
 * ------------------------------------------------------------------ */

/** Pops a newly-built module into the world with an overshoot and a spark burst. */
function BuildIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const progress = useRef(0);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (born.current === null) born.current = clock.elapsedTime + delay;
    const p = THREE.MathUtils.clamp((clock.elapsedTime - born.current) / 0.85, 0, 1);
    progress.current = p;
    // elastic overshoot
    const e = p >= 1 ? 1 : 1 - Math.pow(2, -9 * p) * Math.cos((p * 10 - 0.75) * 2.4);
    ref.current.scale.setScalar(Math.max(0.001, e));
    ref.current.rotation.y = (1 - p) * 0.8;
    ref.current.visible = clock.elapsedTime >= born.current;
  });

  return (
    <group ref={ref} scale={0.001}>
      {children}
      <Sparkles count={14} scale={[1.8, 1.8, 1.8]} size={5} speed={2} color="#ffd66b" />
    </group>
  );
}

const PLANKS = ["#d18b4c", "#b8703a", "#dc9553", "#ac6a31", "#c67e42"];

/** The hull grows in three visible tiers as the player survives. */
function Hull({ stage }: { stage: number }) {
  const wide = stage >= 2;
  const huge = stage >= 4;
  const logXs = huge ? [-2.6, -1.85, -1.1, -0.35, 0.4, 1.15, 1.9, 2.65] : wide ? [-1.9, -1.15, -0.4, 0.35, 1.1, 1.85] : [-1.45, -0.72, 0, 0.72, 1.45];
  const deckWidth = huge ? 6.1 : wide ? 4.6 : 3.85;
  const rows = huge ? 11 : wide ? 9 : 7;
  const zs = Array.from({ length: rows }, (_, i) => (i - (rows - 1) / 2) * 0.48);
  const halfZ = ((rows - 1) / 2) * 0.48 + 0.3;

  return (
    <group>
      {/* buoyancy logs */}
      {logXs.map((x, i) => (
        <mesh key={x} position={[x, -0.38, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.32, 0.35, halfZ * 2 + 0.5, 16]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#7c4a26" : "#8f5a31" } roughness={0.95} />
        </mesh>
      ))}
      {/* deck planks */}
      {zs.map((z, i) => (
        <mesh key={z} position={[0, -0.04, z]} rotation={[0, i % 2 ? 0.011 : -0.009, 0]} castShadow receiveShadow>
          <boxGeometry args={[deckWidth, 0.15, 0.42]} />
          <meshStandardMaterial color={PLANKS[i % PLANKS.length]} roughness={0.92} />
        </mesh>
      ))}
      {/* lashing beams + rope wraps */}
      {[-deckWidth / 2 + 0.3, deckWidth / 2 - 0.3].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.05, 0]} castShadow>
            <boxGeometry args={[0.14, 0.07, halfZ * 2]} />
            <meshStandardMaterial color="#5a3b22" roughness={0.85} />
          </mesh>
          {zs.filter((_, i) => i % 3 === 0).map((z) => (
            <mesh key={z} position={[x, 0.06, z]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.17, 0.035, 8, 16]} />
              <meshStandardMaterial color="#cfa961" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* tire fenders */}
      {[
        [-deckWidth / 2 - 0.15, 0.3],
        [deckWidth / 2 + 0.15, -0.6],
        [-deckWidth / 2 - 0.15, -1.4],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, -0.36, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.4, 0.14, 12, 22]} />
          <meshStandardMaterial color="#1c2424" roughness={0.85} />
        </mesh>
      ))}
      {/* safety railing once the base is established */}
      {stage >= 3 &&
        [-deckWidth / 2 + 0.15, deckWidth / 2 - 0.15].map((x) => (
          <BuildIn key={x}>
            <group>
              <mesh position={[x, 0.45, 0]}>
                <boxGeometry args={[0.06, 0.06, halfZ * 2]} />
                <meshStandardMaterial color="#8a5a30" roughness={0.9} />
              </mesh>
              {zs.filter((_, i) => i % 4 === 0).map((z) => (
                <mesh key={z} position={[x, 0.24, z]} castShadow>
                  <cylinderGeometry args={[0.045, 0.05, 0.5, 8]} />
                  <meshStandardMaterial color="#7a4d29" roughness={0.9} />
                </mesh>
              ))}
            </group>
          </BuildIn>
        ))}
      {/* upper deck: the raft becomes a real base */}
      {huge && (
        <BuildIn>
          <group position={[1.5, 0, -0.4]}>
            <mesh position={[0, 1.32, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.5, 0.16, 2.4]} />
              <meshStandardMaterial color="#c07f45" roughness={0.9} />
            </mesh>
            {[
              [-1.1, -1.05],
              [1.1, -1.05],
              [-1.1, 1.05],
              [1.1, 1.05],
            ].map(([x, z]) => (
              <mesh key={`${x}-${z}`} position={[x, 0.64, z]} castShadow>
                <boxGeometry args={[0.17, 1.4, 0.17]} />
                <meshStandardMaterial color="#6f4526" roughness={0.95} />
              </mesh>
            ))}
            {/* ladder */}
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[-1.32, 0.2 + i * 0.26, 1.05]} castShadow>
                <boxGeometry args={[0.42, 0.06, 0.06]} />
                <meshStandardMaterial color="#8a5a30" roughness={0.9} />
              </mesh>
            ))}
          </group>
        </BuildIn>
      )}
      {/* supply clutter */}
      <RoundedBox args={[0.72, 0.62, 0.68]} radius={0.06} position={[-1.35, 0.33, 1.0]} castShadow>
        <meshStandardMaterial color="#cd8f47" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.44, 0.48]} radius={0.05} position={[-1.42, 0.85, 0.92]} rotation={[0, 0.4, 0]} castShadow>
        <meshStandardMaterial color="#b3763a" roughness={0.85} />
      </RoundedBox>
      <group position={[1.5, 0.29, 1.1]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.27, 0.27, 0.64, 18]} />
          <meshStandardMaterial color="#3f7d86" metalness={0.35} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.285, 0.285, 0.13, 18]} />
          <meshStandardMaterial color="#2c5960" metalness={0.35} roughness={0.45} />
        </mesh>
      </group>
      {/* coiled rope */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.5, 0.07 + i * 0.06, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24 - i * 0.04, 0.05, 8, 20]} />
          <meshStandardMaterial color="#c9a45f" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function RainCatcher({ collecting }: { collecting: boolean }) {
  const funnel = useRef<THREE.Mesh>(null);
  const level = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (funnel.current) funnel.current.rotation.z = -0.06 + Math.sin(t * 1.3) * 0.035;
    if (level.current) {
      const target = collecting ? 0.5 : 0.16;
      const h = THREE.MathUtils.damp(level.current.scale.y, target, 2.5, delta);
      level.current.scale.y = h;
      level.current.position.y = 0.12 + h * 0.5;
    }
  });
  return (
    <group position={[-1.15, 0.05, -0.75]}>
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 1.7, 8]} />
          <meshStandardMaterial color="#5a3418" roughness={0.95} />
        </mesh>
      ))}
      {/* stretched tarp funnel */}
      <mesh ref={funnel} position={[0, 1.6, 0]} castShadow>
        <coneGeometry args={[1.3, 0.55, 4, 1, true]} />
        <meshStandardMaterial color="#f2762f" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.32, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
        <meshStandardMaterial color="#9fb0b4" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* collection drum with a visible water level */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.38, 0.85, 20]} />
        <meshStandardMaterial color="#3d6f78" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh ref={level} position={[0, 0.2, 0]} scale={[1, 0.16, 1]}>
        <cylinderGeometry args={[0.33, 0.33, 0.8, 20]} />
        <meshStandardMaterial color="#57d8ee" transparent opacity={0.85} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Shelter() {
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 3.2) * 0.35;
  });
  return (
    <group position={[-1.1, 0.05, -0.45]} rotation={[0, 0.16, 0]}>
      {/* corrugated walls */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.75, 1.45, 1.6]} />
        <meshStandardMaterial color="#7d5330" roughness={0.98} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.75, 0.82]}>
          <boxGeometry args={[0.16, 1.4, 0.05]} />
          <meshStandardMaterial color="#8e6038" roughness={0.95} />
        </mesh>
      ))}
      {/* patched tin roof */}
      <mesh position={[0, 1.62, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[1.35, 1.35, 1.9]} />
        <meshStandardMaterial color="#c2603a" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0.5, 1.86, 0.4]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.5, 0.5, 0.55]} />
        <meshStandardMaterial color="#9aa7ac" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* doorway + warm interior glow */}
      <mesh position={[0.89, 0.68, 0.35]}>
        <boxGeometry args={[0.05, 1.0, 0.6]} />
        <meshStandardMaterial color="#2a1a10" />
      </mesh>
      <pointLight position={[0.7, 0.7, 0.35]} color="#ffb257" intensity={2.4} distance={2.4} />
      {/* pennant */}
      <mesh position={[-0.7, 2.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 6]} />
        <meshStandardMaterial color="#cfd8d6" metalness={0.5} />
      </mesh>
      <mesh ref={flag} position={[-0.55, 2.45, 0]}>
        <boxGeometry args={[0.36, 0.22, 0.02]} />
        <meshStandardMaterial color="#ffd23f" side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
    </group>
  );
}

function SolarStill({ active }: { active: boolean }) {
  const panel = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (panel.current) panel.current.rotation.x = -0.5 + Math.sin(t * 0.4) * 0.06;
    if (glow.current) {
      glow.current.emissiveIntensity = THREE.MathUtils.damp(
        glow.current.emissiveIntensity,
        active ? 2.6 : 0.35 + Math.sin(t * 2) * 0.12,
        4,
        delta,
      );
    }
  });
  return (
    <group position={[1.35, 0.28, -0.85]} rotation={[0, -0.24, 0]}>
      {/* twin panels on a frame */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 1.0, 10]} />
        <meshStandardMaterial color="#8a949a" metalness={0.7} roughness={0.4} />
      </mesh>
      <group ref={panel} position={[0, 1.0, 0]}>
        {[-0.72, 0.72].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[1.34, 0.09, 0.92]} />
              <meshStandardMaterial color="#17324f" metalness={0.6} roughness={0.25} />
            </mesh>
            {[-0.42, 0, 0.42].map((c) => (
              <mesh key={c} position={[c, 0.055, 0]}>
                <boxGeometry args={[0.34, 0.02, 0.84]} />
                <meshStandardMaterial color="#2f7fc4" metalness={0.4} roughness={0.15} emissive="#2b7fd0" emissiveIntensity={0.5} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* purifier tank */}
      <group position={[0.55, 0.3, 0.6]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.78, 18]} />
          <meshStandardMaterial color="#48c3d2" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.44, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.18, 12]} />
          <meshStandardMaterial color="#2b6f7c" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.1, 0.34]}>
          <boxGeometry args={[0.22, 0.16, 0.05]} />
          <meshStandardMaterial ref={glow} color="#0d2a30" emissive="#5cffd0" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function Greenhouse() {
  const crops = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crops.current) crops.current.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.05;
  });
  return (
    <group position={[1.2, 1.4, -0.35]}>
      {/* glass box */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.7, 1.0, 1.4]} />
        <meshPhysicalMaterial color="#a7f2e2" transparent opacity={0.3} roughness={0.08} transmission={0.6} thickness={0.4} />
      </mesh>
      {/* frame edges */}
      {[-0.85, 0.85].map((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.5, z]}>
            <boxGeometry args={[0.07, 1.02, 0.07]} />
            <meshStandardMaterial color="#d8e6e2" metalness={0.4} roughness={0.4} />
          </mesh>
        )),
      )}
      <mesh position={[0, 1.16, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.9, 0.9, 1.45]} />
        <meshPhysicalMaterial color="#c6fff2" transparent opacity={0.32} roughness={0.1} transmission={0.55} />
      </mesh>
      {/* soil bed + crops */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[1.5, 0.22, 1.2]} />
        <meshStandardMaterial color="#4a3323" roughness={1} />
      </mesh>
      <group ref={crops} position={[0, 0.3, 0]}>
        {[-0.5, -0.17, 0.17, 0.5].map((x) =>
          [-0.3, 0.3].map((z) => (
            <group key={`${x}-${z}`} position={[x, 0, z]}>
              <mesh>
                <cylinderGeometry args={[0.03, 0.04, 0.24, 6]} />
                <meshStandardMaterial color="#3f8a35" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <sphereGeometry args={[0.15, 12, 10]} />
                <meshStandardMaterial color="#63cc49" roughness={0.85} />
              </mesh>
              <mesh position={[0.08, 0.26, 0.06]}>
                <sphereGeometry args={[0.06, 10, 8]} />
                <meshStandardMaterial color="#ff5f4d" roughness={0.6} />
              </mesh>
            </group>
          )),
        )}
      </group>
    </group>
  );
}

function RadioTower({ ending }: { ending: Ending }) {
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const dish = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beacon.current) {
      const base = ending === "rescued" ? 5 : 2;
      beacon.current.emissiveIntensity = base * (0.55 + 0.45 * Math.sin(t * (ending === "rescued" ? 9 : 3.4)));
    }
    if (dish.current) dish.current.rotation.y = t * 0.6;
  });
  return (
    <group position={[-1.55, 0.05, -0.6]}>
      {/* lattice mast */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.11, 3.8, 8]} />
        <meshStandardMaterial color="#ccdfe2" metalness={0.8} roughness={0.28} />
      </mesh>
      {[0.7, 1.5, 2.3, 3.1].map((y, i) => (
        <group key={y} position={[0, y, 0]} rotation={[0, i * 0.4, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.028, 0.028, 0.9 - i * 0.13, 6]} />
            <meshStandardMaterial color="#e3f0f2" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.9 - i * 0.13, 6]} />
            <meshStandardMaterial color="#e3f0f2" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* guy wires */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.5, 1.3, 0]} rotation={[0, 0, s * 0.38]}>
          <cylinderGeometry args={[0.012, 0.012, 2.8, 4]} />
          <meshStandardMaterial color="#9fb0b4" metalness={0.5} />
        </mesh>
      ))}
      {/* rotating dish */}
      <group ref={dish} position={[0, 3.2, 0]}>
        <mesh position={[0.28, 0, 0]} rotation={[0, 0, -1.1]} castShadow>
          <sphereGeometry args={[0.34, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
          <meshStandardMaterial color="#eef6f7" side={THREE.DoubleSide} metalness={0.4} roughness={0.35} />
        </mesh>
      </group>
      <mesh position={[0, 3.85, 0]}>
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshStandardMaterial ref={beacon} color="#ff6a45" emissive="#ff2d0d" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 3.85, 0]} color="#ff5230" intensity={ending === "rescued" ? 9 : 3} distance={6} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Action effects
 * ------------------------------------------------------------------ */

function ActionFX({ action }: { action: string | null }) {
  const group = useRef<THREE.Group>(null);
  const startedAt = useRef<number | null>(null);

  const droplets = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: (((i * 37) % 41) / 41) * 9 - 4.5,
        y: (((i * 23) % 29) / 29) * 4,
        z: (((i * 13) % 19) / 19) * 7 - 3.5,
        len: 0.35 + (((i * 7) % 11) / 11) * 0.5,
      })),
    [],
  );

  const bubbles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: Math.sin(i * 1.9) * 0.45,
        z: Math.cos(i * 2.3) * 0.4,
        y: i * 0.2,
        r: 0.05 + (i % 5) * 0.018,
      })),
    [],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    if (startedAt.current === null) startedAt.current = t;
    const p = t - startedAt.current;
    const eased = Math.min(p / 1.05, 1);

    if (action === "fish") {
      // fish arcs out of the water and onto the deck
      group.current.position.set(2.9 - eased * 2.3, -0.7 + Math.sin(eased * Math.PI) * 2.3, 0.9 - eased * 0.3);
      group.current.rotation.z = -0.5 + eased * 2.4;
      group.current.rotation.y = Math.sin(t * 12) * 0.35;
    } else if (action === "salvage") {
      // crate is hauled in along the rope
      group.current.position.set(4.2 - eased * 3.4, -0.55 + Math.sin(eased * Math.PI) * 0.85, 0.5 - eased * 0.2);
      group.current.rotation.z = Math.sin(t * 3) * 0.18;
    } else if (action === "signal") {
      group.current.position.set(0.5 + p * 0.55, 1.7 + p * 3.4, 0);
    } else if (action === "dive") {
      group.current.position.y = -1.2 + ((p * 1.5) % 2.2);
    } else if (action === "rain") {
      group.current.position.y = 3.6 - ((p * 6.5) % 5.4);
    } else if (action === "purify") {
      group.current.rotation.y = Math.sin(t * 2) * 0.1;
    }
  });

  if (!action) return null;

  if (action === "repair") {
    return (
      <group position={[0.2, 0.5, 0.9]}>
        <Sparkles count={46} scale={[2.6, 1.5, 2.0]} size={6} speed={3.4} color="#ffc63f" opacity={1} />
        <Sparkles count={20} scale={[1.4, 0.8, 1.2]} size={9} speed={5} color="#fff2c0" opacity={1} />
        <pointLight color="#ff9a1e" intensity={16} distance={5} />
      </group>
    );
  }

  if (action === "rest") {
    return (
      <group position={[0.4, 1.9, 0.4]}>
        <Sparkles count={18} scale={[1.4, 1.6, 1.4]} size={5} speed={0.6} color="#ffe9a8" />
        <pointLight color="#ffd58a" intensity={7} distance={5} />
      </group>
    );
  }

  if (action === "rain") {
    return (
      <group ref={group} position={[0, 2, 0]}>
        {droplets.map((d, i) => (
          <mesh key={i} position={[d.x, d.y, d.z]} rotation={[0, 0, -0.14]}>
            <boxGeometry args={[0.02, d.len, 0.02]} />
            <meshBasicMaterial color="#d9fbff" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
    );
  }

  if (action === "purify") {
    return (
      <group ref={group} position={[1.85, 0.35, -0.3]}>
        {/* flowing stream from the purifier spout into the tank */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.05, 0.11, 1.5, 10]} />
          <meshPhysicalMaterial color="#7ef0ff" transmission={0.5} transparent opacity={0.85} roughness={0.05} />
        </mesh>
        <Sparkles count={26} scale={[0.9, 1.5, 0.9]} size={4} speed={2.4} color="#c6fbff" />
        <pointLight color="#5fe6ff" intensity={7} distance={3.5} />
      </group>
    );
  }

  if (action === "fish") {
    return (
      <group ref={group} position={[2.9, -0.7, 0.9]}>
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.42, 8, 16]} />
          <meshStandardMaterial color="#ffa63f" metalness={0.35} roughness={0.35} />
        </mesh>
        <mesh position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.26, 0.42, 3]} />
          <meshStandardMaterial color="#ffd062" roughness={0.4} />
        </mesh>
        <mesh position={[0.18, 0.08, 0.16]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshBasicMaterial color="#1c2b30" />
        </mesh>
        <Sparkles count={16} scale={[1, 1, 1]} size={4} speed={2} color="#bff4ff" />
      </group>
    );
  }

  if (action === "salvage") {
    return (
      <group ref={group} position={[4.2, -0.55, 0.5]}>
        <RoundedBox args={[0.9, 0.6, 0.72]} radius={0.06} castShadow>
          <meshStandardMaterial color="#e08c33" metalness={0.3} roughness={0.65} />
        </RoundedBox>
        <mesh position={[0, 0.02, 0.37]}>
          <boxGeometry args={[0.92, 0.09, 0.03]} />
          <meshStandardMaterial color="#8a5325" roughness={0.9} />
        </mesh>
        {/* tow rope back toward the raft */}
        <mesh position={[-2.0, 0.55, 0]} rotation={[0, 0, 0.35]}>
          <cylinderGeometry args={[0.022, 0.022, 4.2, 6]} />
          <meshBasicMaterial color="#eee9cf" />
        </mesh>
        <Sparkles count={14} scale={[1.4, 0.6, 1]} size={4} speed={1.5} color="#d8f6ff" />
      </group>
    );
  }

  if (action === "dive") {
    return (
      <group>
        <FoamRing position={[0.6, -0.95, 1.7]} scale={1.3} speed={1.4} />
        <FoamRing position={[0.6, -0.95, 1.7]} scale={0.8} speed={2.1} />
        <group ref={group} position={[0.6, -1.2, 1.7]}>
          {bubbles.map((b, i) => (
            <mesh key={i} position={[b.x, b.y, b.z]}>
              <sphereGeometry args={[b.r, 12, 10]} />
              <meshPhysicalMaterial color="#cffaff" transparent opacity={0.6} transmission={0.5} roughness={0.05} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }

  if (action === "signal") {
    return (
      <group ref={group} position={[0.5, 1.7, 0]}>
        <mesh>
          <sphereGeometry args={[0.19, 18, 14]} />
          <meshBasicMaterial color="#ff502a" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.42, 18, 14]} />
          <meshBasicMaterial color="#ff9a48" transparent opacity={0.35} depthWrite={false} />
        </mesh>
        <pointLight color="#ff4022" intensity={30} distance={14} />
        <Sparkles count={34} scale={[0.6, 3.2, 0.6]} size={5} speed={2.4} color="#ffb066" />
      </group>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Raft assembly + camera
 * ------------------------------------------------------------------ */

/**
 * A place in the world you can act on: a pulsing marker on the surface with a
 * label tethered above it. The label is real DOM, so it stays legible at any
 * distance and gives a proper touch target.
 */
function Hotspot({ spec }: { spec: HotspotSpec }) {
  const place = HOTSPOT_PLACES[spec.id];
  const ring = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const beat = (Math.sin(t * 2.4) * 0.5 + 0.5);
    if (ring.current) {
      const s = 1 + beat * 0.28;
      ring.current.scale.set(s, s, s);
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = spec.locked ? 0.22 : 0.35 + (1 - beat) * 0.45;
    }
    if (inner.current) inner.current.rotation.z = t * 0.6;
  });

  if (!place) return null;

  return (
    <group position={place.pos}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.46, 28]} />
        <meshBasicMaterial color={spec.locked ? "#7d8a8c" : spec.tone} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.16, 6]} />
        <meshBasicMaterial color={spec.locked ? "#7d8a8c" : spec.tone} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {!spec.locked && <pointLight color={spec.tone} intensity={2.6} distance={2.4} />}
    </group>
  );
}

function Hotspots({ hotspots }: { hotspots: HotspotSpec[] }) {
  const onDeck = hotspots.filter((h) => HOTSPOT_PLACES[h.id]?.onRaft);
  const inWater = hotspots.filter((h) => !HOTSPOT_PLACES[h.id]?.onRaft);
  return (
    <>
      {inWater.map((h) => (
        <Hotspot key={h.id} spec={h} />
      ))}
      <RaftAnchored>
        {onDeck.map((h) => (
          <Hotspot key={h.id} spec={h} />
        ))}
      </RaftAnchored>
    </>
  );
}

/** Mirrors the raft's buoyancy so deck hotspots rock along with the deck. */
function RaftAnchored({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 1.15) * 0.12 + Math.sin(t * 0.53) * 0.05;
    ref.current.rotation.z = Math.sin(t * 0.72) * 0.035;
    ref.current.rotation.x = Math.cos(t * 0.55) * 0.026;
    ref.current.rotation.y = -0.25 + Math.sin(t * 0.31) * 0.03;
  });
  return <group ref={ref}>{children}</group>;
}

function Raft({ stage, built, pulse, action, ending }: SceneProps) {
  const ref = useRef<THREE.Group>(null);
  const previousPulse = useRef(pulse);
  const kick = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    if (previousPulse.current !== pulse) {
      previousPulse.current = pulse;
      kick.current = 1;
    }
    kick.current = THREE.MathUtils.damp(kick.current, 0, 5, delta);

    // buoyancy: heave, roll and pitch on offset frequencies so it never loops obviously
    const sink = ending === "lost" ? -1.1 : 0;
    ref.current.position.y = Math.sin(t * 1.15) * 0.12 + Math.sin(t * 0.53) * 0.05 + kick.current * 0.12 + sink;
    ref.current.rotation.z = Math.sin(t * 0.72) * 0.035 + kick.current * 0.03;
    ref.current.rotation.x = Math.cos(t * 0.55) * 0.026;
    ref.current.rotation.y = -0.25 + Math.sin(t * 0.31) * 0.03 + (ending === "lost" ? 0.25 : 0);
    const s = 1 + kick.current * 0.05;
    ref.current.scale.setScalar(s);
  });

  return (
    <group ref={ref} rotation={[0, -0.25, 0]}>
      <Hull stage={stage} />
      <Castaway action={action} />
      {built.includes("RAIN CATCHER") && (
        <BuildIn>
          <RainCatcher collecting={action === "rain"} />
        </BuildIn>
      )}
      {built.includes("SCRAP SHELTER") && (
        <BuildIn>
          <Shelter />
        </BuildIn>
      )}
      {built.includes("SOLAR STILL") && (
        <BuildIn>
          <SolarStill active={action === "purify"} />
        </BuildIn>
      )}
      {built.includes("GREENHOUSE") && (
        <BuildIn delay={0.15}>
          <Greenhouse />
        </BuildIn>
      )}
      {built.includes("RADIO TOWER") && (
        <BuildIn delay={0.3}>
          <RadioTower ending={ending} />
        </BuildIn>
      )}
      {/* wake foam hugging the hull */}
      <FoamRing position={[0, -0.92, 0]} scale={1.9} speed={0.45} />
    </group>
  );
}

/** Cinematic reframing — each action gets its own camera composition. */
const SHOTS: Record<string, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
  idle: { pos: [0, 4.6, 11.0], look: [0, 0.75, 0], fov: 42 },
  fish: { pos: [3.6, 2.0, 6.4], look: [1.2, 0.4, 0.6], fov: 40 },
  salvage: { pos: [4.2, 2.6, 6.8], look: [1.4, 0.1, 0.4], fov: 44 },
  purify: { pos: [3.0, 2.4, 5.6], look: [1.3, 0.9, -0.4], fov: 38 },
  repair: { pos: [1.6, 1.6, 5.2], look: [0.3, 0.4, 0.7], fov: 40 },
  dive: { pos: [2.2, 1.1, 6.0], look: [0.6, -0.7, 1.4], fov: 46 },
  rest: { pos: [-1.8, 3.2, 8.6], look: [0.2, 1.0, 0.2], fov: 40 },
  rain: { pos: [-2.6, 3.6, 8.2], look: [-0.6, 1.2, -0.3], fov: 46 },
  signal: { pos: [-1.2, 4.6, 9.0], look: [0.4, 2.4, 0], fov: 48 },
  bail: { pos: [2.4, 1.9, 6.2], look: [0.9, 0.1, -0.5], fov: 42 },
  build: { pos: [-2.2, 2.4, 6.6], look: [-0.7, 0.7, 0.6], fov: 44 },
  rescued: { pos: [-2.4, 3.0, 8.0], look: [-0.6, 2.0, -0.4], fov: 44 },
  adrift: { pos: [0.6, 3.4, 9.4], look: [0, 0.9, 0], fov: 46 },
  lost: { pos: [1.4, 1.0, 7.0], look: [0, -0.2, 0], fov: 50 },
};

function CameraRig({ action, ending }: { action: string | null; ending: Ending }) {
  const { camera, pointer } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.55, 0));

  useFrame(({ clock }, delta) => {
    const key = ending ?? action ?? "idle";
    const shot = SHOTS[key] ?? SHOTS.idle;
    const t = clock.elapsedTime;

    // gentle handheld drift + pointer parallax layered on top of the framed shot
    const driftX = Math.sin(t * 0.23) * 0.18 + pointer.x * 0.4;
    const driftY = Math.sin(t * 0.31) * 0.1 + pointer.y * 0.2;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, shot.pos[0] + driftX, 1.8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, shot.pos[1] + driftY, 1.8, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, shot.pos[2], 1.8, delta);

    look.current.x = THREE.MathUtils.damp(look.current.x, shot.look[0], 2.2, delta);
    look.current.y = THREE.MathUtils.damp(look.current.y, shot.look[1], 2.2, delta);
    look.current.z = THREE.MathUtils.damp(look.current.z, shot.look[2], 2.2, delta);
    camera.lookAt(look.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const portrait = THREE.MathUtils.clamp(0.75 / camera.aspect, 1, 1.5);
      const next = THREE.MathUtils.damp(camera.fov, shot.fov * portrait, 2, delta);
      if (Math.abs(next - camera.fov) > 0.001) {
        camera.fov = next;
        camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}

/* ------------------------------------------------------------------ *
 * Ending set-pieces
 * ------------------------------------------------------------------ */

function RescueChopper() {
  const ref = useRef<THREE.Group>(null);
  const rotor = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.position.x = THREE.MathUtils.damp(ref.current.position.x, -2.2, 0.4, delta);
      ref.current.position.y = 5.4 + Math.sin(t * 1.4) * 0.22;
      ref.current.rotation.z = Math.sin(t * 0.9) * 0.06;
    }
    if (rotor.current) rotor.current.rotation.y = t * 34;
  });
  return (
    <group ref={ref} position={[-16, 5.4, -4]} rotation={[0, 0.3, 0]} scale={0.9}>
      <RoundedBox args={[1.9, 0.9, 0.95]} radius={0.32} castShadow>
        <meshStandardMaterial color="#f0f4f2" roughness={0.4} metalness={0.3} />
      </RoundedBox>
      <mesh position={[0.55, 0.05, 0.46]}>
        <sphereGeometry args={[0.36, 16, 12]} />
        <meshPhysicalMaterial color="#9fdcf0" transmission={0.7} transparent opacity={0.7} roughness={0.05} />
      </mesh>
      <mesh position={[-1.5, 0.16, 0]}>
        <boxGeometry args={[1.5, 0.16, 0.16]} />
        <meshStandardMaterial color="#e04a2c" roughness={0.5} />
      </mesh>
      <mesh position={[-2.2, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.05, 4]} />
        <meshStandardMaterial color="#c8d3d3" metalness={0.5} />
      </mesh>
      <mesh ref={rotor} position={[0, 0.62, 0]}>
        <boxGeometry args={[4.6, 0.04, 0.22]} />
        <meshStandardMaterial color="#4d5a60" metalness={0.4} />
      </mesh>
      {/* search beam cone + the pool of light it throws on the deck */}
      <mesh position={[0, -2.2, 0]}>
        <coneGeometry args={[1.5, 4, 20, 1, true]} />
        <meshBasicMaterial color="#fff3cd" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, -2.6, 0]} color="#fff2c8" intensity={26} distance={12} />
      <pointLight position={[-2.2, 0.42, 0]} color="#ff3b1e" intensity={6} distance={5} />
    </group>
  );
}

function StormOverlay() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.elapsedTime;
    const strike = Math.max(0, Math.sin(t * 2.3) - 0.93) * 40 + Math.max(0, Math.sin(t * 5.7) - 0.97) * 60;
    light.current.intensity = strike;
  });
  return (
    <group>
      <pointLight ref={light} position={[-6, 9, -6]} color="#dbeaff" intensity={0} distance={60} />
      <Sparkles count={60} scale={[16, 6, 12]} position={[0, 1, 0]} size={2} speed={4} color="#a9d6e6" opacity={0.5} />
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * World
 * ------------------------------------------------------------------ */

const DEBRIS: { position: [number, number, number]; kind: DebrisKind }[] = [
  { position: [-5.6, -0.72, -1.6], kind: 0 },
  { position: [5.1, -0.76, -2.6], kind: 3 },
  { position: [-4.3, -0.78, 4.0], kind: 1 },
  { position: [4.1, -0.74, 2.8], kind: 4 },
  { position: [-7.6, -0.76, -6.2], kind: 2 },
  { position: [7.2, -0.75, -5.4], kind: 1 },
  { position: [1.4, -0.76, 5.6], kind: 0 },
  { position: [-2.6, -0.75, -5.8], kind: 4 },
  { position: [9.4, -0.74, 1.2], kind: 2 },
  { position: [-9.2, -0.75, 2.4], kind: 3 },
];

function World(props: SceneProps) {
  const { storm, ending } = props;
  const stormy = storm || ending === "lost";

  return (
    <>
      <color attach="background" args={[stormy ? "#3d5f74" : "#8fd9ea"]} />
      <fog attach="fog" args={[stormy ? "#4a6b7d" : "#a6e2ea", 18, 62]} />

      <ambientLight intensity={stormy ? 0.7 : 1.0} color="#cfeeff" />
      <directionalLight
        position={[9, 10, 5]}
        intensity={stormy ? 1.4 : 3.4}
        color="#ffd8a0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-7, 4, -9]} intensity={1.3} color="#ff9d63" />
      <hemisphereLight args={[stormy ? "#7e9aa8" : "#cdf3ff", "#0d3040", 1.3]} />

      <Sky storm={stormy} />
      {!stormy && <Birds />}
      <Ocean storm={stormy} />

      {DEBRIS.map((d, i) => (
        <DebrisPiece key={i} position={d.position} kind={d.kind} seed={i * 1.73} />
      ))}

      <Raft {...props} />
      <ActionFX key={props.pulse} action={props.action} />
      {!props.action && !ending && <Hotspots hotspots={props.hotspots} />}

      {ending === "rescued" && <RescueChopper />}
      {stormy && <StormOverlay />}

      <ContactShadows
        key={`deck-shadow-${props.stage}`}
        position={[0, -0.98, 0]}
        opacity={0.4}
        scale={11}
        blur={2.8}
        far={4}
        color="#001c26"
        frames={1}
        resolution={512}
      />
      <Sparkles count={30} scale={[11, 3, 8]} position={[0, 0.3, 0]} size={2.4} speed={0.3} color="#d8fbff" opacity={0.35} />
      <CameraRig action={props.action} ending={ending} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Canvas host
 * ------------------------------------------------------------------ */

/**
 * The tags dock in a row instead of floating at their anchors. Three or four
 * labels cannot fit around a raft this small without covering each other, and
 * a tag you cannot read or reach is worse than one that is not tied on.
 * The pulsing ring in the water still marks where the work happens.
 */
function TagRow({ hotspots, onPick }: { hotspots: HotspotSpec[]; onPick: (id: string) => void }) {
  if (!hotspots.length) return null;
  return (
    <div className="tag-row">
      {hotspots.map((spec) => (
        <button
          key={spec.id}
          type="button"
          className={`hotspot ${spec.locked ? "locked" : ""} ${spec.selected ? "selected" : ""}`}
          style={{ "--tone": spec.tone } as CSSProperties}
          disabled={spec.locked || spec.disabled}
          onClick={() => onPick(spec.id)}
          aria-keyshortcuts={spec.shortcut}
        >
          <kbd className="hotspot-key" aria-hidden="true">{spec.shortcut}</kbd>
          {spec.content}
        </button>
      ))}
    </div>
  );
}

export default function OceanScene(props: SceneProps) {
  return (
    <>
    <div className="ocean-canvas" aria-label="Animated 3D survival raft at sea">
      <Canvas
        camera={{ position: [0, 3.4, 9.4], fov: 42 }}
        dpr={[1, 1.5]}
        shadows
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <World {...props} />
      </Canvas>
    </div>
    {/* sibling of the canvas, so tags stack above the instruments */}
    <div className="label-layer">
      <TagRow hotspots={props.hotspots} onPick={props.onPick} />
    </div>
    </>
  );
}
