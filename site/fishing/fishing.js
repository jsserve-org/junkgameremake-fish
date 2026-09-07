(() => {
'use strict';

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const fmt = n => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString('en-US');
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
};

// ---------- config ----------
const PPM = 44;                       // px per meter
const FAST = (() => { const m = location.search.match(/fast=([\d.]+)/); return m ? +m[1] : 1; })();
const SINK = 9, REEL = 15;            // m/s
const DEPTHS = [25, 40, 60, 85, 115, 150, 190, 235, 285, 340, 400, 450];
const CAPS = [3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 26, 30];
const REELS = [1, 1.15, 1.32, 1.5, 1.75, 2, 2.35, 2.7, 3.1, 3.6];
const IDLE_RATE = [0, .2, .5, 1, 2, 4, 7, 12, 20, 32, 50];
const COSTS = {
  depth: l => Math.round(20 * Math.pow(1.75, l)),
  cap: l => Math.round(35 * Math.pow(1.9, l)),
  reel: l => Math.round(25 * Math.pow(1.8, l)),
  idle: l => Math.round(30 * Math.pow(1.7, l)),
};
const MAXLVL = { depth: DEPTHS.length - 1, cap: CAPS.length - 1, reel: REELS.length - 1, idle: IDLE_RATE.length - 1 };

const WATER_STOPS = [
  [0, '#2a9db5'], [30, '#1f7f96'], [60, '#1a6580'], [100, '#14496b'],
  [150, '#0e3252'], [200, '#0a2038'], [260, '#071426'], [320, '#050b18'],
  [400, '#030610'], [460, '#02040a'],
];

const ZONES = [
  { d0: 0, name: 'THE SHALLOWS', sub: 'everything here is bait' },
  { d0: 40, name: 'THE GREEN REACH', sub: 'where the schools thicken' },
  { d0: 100, name: 'THE TWILIGHT LINE', sub: 'lights come on below' },
  { d0: 180, name: 'MIDNIGHT HILLS', sub: 'angler country' },
  { d0: 300, name: 'THE ABYSSAL PLAIN', sub: 'old things live here' },
];

const SPECIES = [
  { id: 'sardine', name: 'Sardine', val: 3, d0: 0, d1: 60, w: 10, size: 10, speed: 60, shape: 'fish', c1: '#9fc4d4', c2: '#628096', belly: '#e8f4f8' },
  { id: 'mackerel', name: 'Mackerel', val: 6, d0: 0, d1: 80, w: 8, size: 14, speed: 70, shape: 'fish', c1: '#7ba7bd', c2: '#41637a', belly: '#dcebf2', stripe: '#2e4d61' },
  { id: 'bream', name: 'Sea Bream', val: 11, d0: 10, d1: 110, w: 6, size: 16, speed: 50, shape: 'fish', c1: '#d8a35f', c2: '#9c6f3a', belly: '#f2e3c8', stripe: '#7a5426' },
  { id: 'parrot', name: 'Parrotfish', val: 20, d0: 40, d1: 160, w: 5, size: 19, speed: 45, shape: 'fish', c1: '#39b3a6', c2: '#1f7d84', belly: '#bfe9e2', stripe: '#e0798f' },
  { id: 'jelly', name: 'Moon Jelly', val: 32, d0: 30, d1: 200, w: 4, size: 16, speed: 14, shape: 'jelly', c1: '#c9b8e6', c2: '#8f7cc0', belly: '#efe7fb' },
  { id: 'lantern', name: 'Lanternfish', val: 55, d0: 100, d1: 260, w: 5, size: 13, speed: 60, shape: 'fish', c1: '#2c4a66', c2: '#16283c', belly: '#4f708c', glow: '#7fe3ff' },
  { id: 'squid', name: 'Neon Squid', val: 88, d0: 120, d1: 300, w: 4, size: 20, speed: 48, shape: 'squid', c1: '#e0799f', c2: '#9c4a6e', belly: '#f6c6da', glow: '#ff8fb4' },
  { id: 'angler', name: 'Anglerfish', val: 185, d0: 180, d1: 430, w: 3, size: 22, speed: 26, shape: 'angler', c1: '#3a3550', c2: '#221f33', belly: '#5a5178', glow: '#9fffb0' },
  { id: 'coelacanth', name: 'Coelacanth', val: 360, d0: 200, d1: 450, w: 2, size: 26, speed: 34, shape: 'fish', c1: '#4d6b8a', c2: '#2c4258', belly: '#7593b0', stripe: '#1d2f42' },
  { id: 'gulper', name: 'Gulper Eel', val: 680, d0: 260, d1: 450, w: 2, size: 30, speed: 30, shape: 'eel', c1: '#2e2b45', c2: '#181628', belly: '#4a4568', glow: '#c46bff' },
  { id: 'barreleye', name: 'Barreleye', val: 950, d0: 300, d1: 450, w: 1.5, size: 18, speed: 36, shape: 'fish', c1: '#5a7d8f', c2: '#33495a', belly: '#8fb4c4', dome: '#9fdcff' },
  { id: 'goldkoi', name: 'GOLDEN KOI', val: 2200, d0: 80, d1: 450, w: 0, size: 22, speed: 40, shape: 'fish', c1: '#ffd23f', c2: '#d88f1a', belly: '#fff3c4', legendary: true },
  { id: 'goldshark', name: 'THE GOLDEN SHARK', val: 6000, d0: 250, d1: 450, w: 0, size: 40, speed: 65, shape: 'shark', c1: '#ffd23f', c2: '#c9860f', belly: '#ffe9a8', legendary: true },
];

// ---------- save ----------
const SAVE_KEY = 'deepwater-save-v1';
let S = { money: 0, depth: 0, cap: 0, reel: 0, idle: 0, best: 0, casts: 0, t: Date.now() };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) S = Object.assign(S, JSON.parse(raw));
} catch (e) { /* fresh water */ }
const save = () => { S.t = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* full */ } };

const maxDepthM = () => DEPTHS[S.depth];
const capN = () => CAPS[S.cap];
const reelMul = () => REELS[S.reel];

// ---------- canvas ----------
const cv = $('#c'), ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1;
const resize = () => {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};
addEventListener('resize', resize); resize();
const boatX = () => W * 0.5;

// ---------- game state ----------
let camY = -7, time = 0, playing = false;
const hook = { st: 'idle', y: 0, x: 0, catch: [], zones: null };
let fish = [], bubbles = [], snow = [], floaters = [];
let pointerX = boatX();

// ---------- audio ----------
let AC = null, muted = false;
function tone(f0, f1, dur, type, g, delay) {
  const t = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function sfx(kind) {
  if (muted) return;
  try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  if (AC.state === 'suspended') AC.resume();
  switch (kind) {
    case 'plop': tone(300, 90, 0.16, 'sine', 0.22); break;
    case 'catch': tone(620, 900, 0.07, 'square', 0.06); break;
    case 'sell': tone(660, 660, 0.09, 'triangle', 0.1); tone(880, 880, 0.1, 'triangle', 0.1, 0.09); break;
    case 'legend': tone(523, 523, 0.12, 'triangle', 0.14); tone(659, 659, 0.12, 'triangle', 0.14, 0.11); tone(784, 784, 0.2, 'triangle', 0.16, 0.22); break;
    case 'buy': tone(520, 780, 0.12, 'triangle', 0.12); break;
    case 'zone': tone(240, 180, 0.4, 'sine', 0.07); break;
  }
}

// ---------- spawning ----------
const makeFish = (sp, y) => ({
  sp, y, x: rand(30, W - 30),
  dir: Math.random() < .5 ? -1 : 1,
  speed: sp.speed * rand(.7, 1.3),
  size: sp.size * rand(.85, 1.2),
  phase: rand(0, TAU), caught: false,
});

function spawnColumn() {
  fish.length = 0;
  const maxD = maxDepthM();
  const n = clamp(2 + Math.floor(maxD / 12), 4, 26);
  for (let i = 0; i < n; i++) {
    const y = rand(6, maxD - 2);
    const pool = SPECIES.filter(s => s.w > 0 && y >= s.d0 && y <= s.d1);
    if (!pool.length) continue;
    let tw = 0; for (const s of pool) tw += s.w;
    let r = Math.random() * tw, sp = pool[0];
    for (const s of pool) { r -= s.w; if (r <= 0) { sp = s; break; } }
    fish.push(makeFish(sp, y));
  }
  if (maxD >= 80 && Math.random() < 0.055)
    fish.push(makeFish(SPECIES.find(s => s.id === 'goldkoi'), rand(30, Math.min(120, maxD - 5))));
  if (maxD >= 250 && Math.random() < 0.022)
    fish.push(makeFish(SPECIES.find(s => s.id === 'goldshark'), rand(maxD * 0.55, maxD - 4)));
}

// ---------- actions ----------
function cast() {
  if (hook.st === 'down') { hook.st = 'up'; return; }
  if (hook.st !== 'idle') return;
  spawnColumn();
  hook.st = 'down'; hook.y = 0; hook.x = boatX(); hook.catch = []; hook.zones = new Set();
  sfx('plop'); S.casts++;
}
function sell() {
  const tally = {};
  let total = 0;
  for (const f of hook.catch) {
    total += f.sp.val;
    const k = f.sp.name;
    tally[k] = tally[k] || { sp: f.sp, n: 0, v: 0 };
    tally[k].n++; tally[k].v += f.sp.val;
  }
  hook.catch = []; hook.st = 'idle'; hook.y = 0;
  if (total > 0) {
    S.money += total;
    if (total > S.best) S.best = total;
    showHaul(tally, total);
    sfx('sell');
  }
  save(); refreshShop();
}

// ---------- UI ----------
const el = {
  money: $('#money'), depth: $('#depthlbl'), cap: $('#caplbl'), cast: $('#cast'),
  shop: $('#shop'), haul: $('#haul'), haulrows: $('#haulrows'), haultotal: $('#haultotal'),
  zone: $('#zone'), zoneh: $('#zoneh'), zonep: $('#zonep'), beststat: $('#beststat'),
};
let shopOpen = false;
$('#shopbtn').onclick = () => { shopOpen = !shopOpen; el.shop.classList.toggle('open', shopOpen); refreshShop(); };
$('#mutebtn').onclick = () => { muted = !muted; $('#mutebtn').textContent = muted ? '♪ OFF' : '♪ ON'; };
el.cast.onclick = cast;
$('#play').onclick = () => {
  playing = true;
  $('#start').classList.add('off');
  sfx('buy');
};

function refreshShop() {
  const rows = [['depth', 'LONGER LINE'], ['cap', 'MORE HOOKS'], ['reel', 'FASTER WINCH'], ['idle', 'NIGHT SKIPPER']];
  for (const [k] of rows) {
    const lvl = S[k], maxed = lvl >= MAXLVL[k];
    const p = $('#p-' + k), b = $('#b-' + k);
    if (maxed) { b.textContent = 'MAX'; b.className = 'buy max'; }
    else {
      const cost = COSTS[k](lvl);
      b.innerHTML = 'UPGRADE<b>' + fmt(cost) + '</b>';
      b.className = 'buy' + (S.money < cost ? ' cant' : '');
      b.onclick = () => {
        if (S.money >= COSTS[k](S[k]) && S[k] < MAXLVL[k]) {
          S.money -= COSTS[k](S[k]); S[k]++;
          save(); sfx('buy'); refreshShop();
        }
      };
    }
  }
  $('#p-depth').textContent = 'next: ' + maxDepthM() + 'm → ' + (S.depth < MAXLVL.depth ? DEPTHS[S.depth + 1] : maxDepthM()) + 'm of line';
  $('#p-cap').textContent = 'next: ' + capN() + ' → ' + (S.cap < MAXLVL.cap ? CAPS[S.cap + 1] : capN()) + ' fish per cast';
  $('#p-reel').textContent = 'sink & reel ×' + reelMul().toFixed(2) + (S.reel < MAXLVL.reel ? ' → ×' + REELS[S.reel + 1].toFixed(2) : '');
  $('#p-idle').textContent = 'earn while away: ' + IDLE_RATE[S.idle].toFixed(1) + '/s' + (S.idle < MAXLVL.idle ? ' → ' + IDLE_RATE[S.idle + 1].toFixed(1) + '/s' : '');
  el.beststat.textContent = S.casts > 0 ? 'casts: ' + S.casts + ' · best haul: ' + fmt(S.best) : 'no casts logged yet · the sea is patient';
}
refreshShop();

let zoneTimer = 0;
function showZone(name, sub, gold) {
  el.zoneh.textContent = name; el.zonep.textContent = sub;
  el.zone.classList.toggle('gold', !!gold);
  el.zone.classList.add('on');
  zoneTimer = gold ? 2.6 : 1.8;
}
let haulTimer = 0;
function showHaul(tally, total) {
  let html = '';
  for (const k in tally) html += `<div class="hl"><span><i style="background:${tally[k].sp.c1}"></i>${k} ×${tally[k].n}</span><b>+${fmt(tally[k].v)}</b></div>`;
  el.haulrows.innerHTML = html;
  el.haultotal.textContent = '+' + fmt(total);
  el.haul.classList.add('on');
  haulTimer = 2.6;
}

// ---------- input ----------
addEventListener('pointermove', e => { pointerX = e.clientX; });
addEventListener('pointerdown', e => {
  pointerX = e.clientX;
  if (playing && !e.target.closest('button') && !e.target.closest('#shop')) {
    if (hook.st === 'idle') cast();
  }
});
addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); cast(); } });
addEventListener('contextmenu', e => e.preventDefault());

// ---------- water palette ----------
function colAt(d) {
  d = clamp(d, 0, 460);
  let i = 0;
  while (i < WATER_STOPS.length - 2 && WATER_STOPS[i + 1][0] < d) i++;
  const [d0, c0] = WATER_STOPS[i], [d1, c1] = WATER_STOPS[i + 1];
  return mix(c0, c1, d1 === d0 ? 0 : clamp((d - d0) / (d1 - d0), 0, 1));
}

// ---------- update ----------
function update(dt) {
  time += dt;
  if (zoneTimer > 0 && (zoneTimer -= dt) <= 0) el.zone.classList.remove('on');
  if (haulTimer > 0 && (haulTimer -= dt) <= 0) el.haul.classList.remove('on');

  // hook motion
  hook.py = hook.y;
  if (hook.st === 'down') hook.y += SINK * reelMul() * FAST * dt;
  else if (hook.st === 'up') hook.y -= REEL * reelMul() * FAST * dt;
  const targetX = hook.st === 'idle' ? boatX() : clamp(pointerX, 20, W - 20);
  hook.x += (targetX - hook.x) * Math.min(1, dt * 7);

  // zones
  if (hook.st !== 'idle' && hook.zones) {
    for (const z of ZONES) {
      if (hook.y >= z.d0 && !hook.zones.has(z.name)) {
        hook.zones.add(z.name);
        if (z.d0 > 0) { showZone(z.name, z.sub); sfx('zone'); }
      }
    }
    if (hook.st === 'down' && (hook.y >= maxDepthM() || hook.catch.length >= capN())) hook.st = 'up';
    if (hook.st === 'up' && hook.y <= 0) { hook.y = 0; sell(); }
  }

  // fish
  for (const f of fish) {
    if (f.caught) continue;
    f.x += f.dir * f.speed * dt;
    if (f.x < -50) f.x = W + 50;
    if (f.x > W + 50) f.x = -50;
  }

  // catch (swept along the hook's path so fast sinks don't tunnel past fish)
  if (hook.st !== 'idle' && hook.catch.length < capN()) {
    const y0 = Math.min(hook.py, hook.y), y1 = Math.max(hook.py, hook.y);
    for (const f of fish) {
      if (f.caught) continue;
      const bobM = f.sp.shape === 'jelly' ? Math.sin(time * 0.9 + f.phase) * 1.4 : Math.sin(time * 1.7 + f.phase) * 0.25;
      const fy = f.y + bobM;
      const dx = Math.abs(f.x - hook.x), r = f.size + 16;
      if (dx < r && fy >= y0 - 0.6 && fy <= y1 + 0.6) {
        f.caught = true; hook.catch.push(f);
        sfx('catch');
        if (f.sp.legendary) { showZone(f.sp.name + '!!', 'hooked the legend — haul it home', true); sfx('legend'); }
        if (hook.catch.length >= capN() && hook.st === 'down') hook.st = 'up';
        break;
      }
    }
  }

  // camera
  const camT = hook.st === 'idle' ? -7 : hook.y - (H / PPM) * 0.42;
  camY += (camT - camY) * Math.min(1, dt * 3.2);

  // bubbles + snow
  if (Math.random() < dt * 4) bubbles.push({ x: rand(0, W), y: camY + rand(2, H / PPM), r: rand(1, 3), v: rand(12, 26), ph: rand(0, TAU) });
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.y -= b.v * dt; b.x += Math.sin(time * 2 + b.ph) * 8 * dt;
    if (b.y < Math.max(0, camY - 2) || b.y < 0) bubbles.splice(i, 1);
  }
  if (Math.random() < dt * 3 && camY > 120) snow.push({ x: rand(0, W), y: camY + H / PPM + 2, r: rand(0.6, 1.6), v: rand(3, 9) });
  for (let i = snow.length - 1; i >= 0; i--) {
    const s = snow[i]; s.y -= s.v * dt;
    if (s.y < camY - 2) snow.splice(i, 1);
  }

  // floaters
  for (let i = floaters.length - 1; i >= 0; i--) {
    const fl = floaters[i]; fl.life -= dt; fl.y -= 26 * dt;
    if (fl.life <= 0) floaters.splice(i, 1);
  }

  // idle earnings
  if (playing && IDLE_RATE[S.idle] > 0) S.money += IDLE_RATE[S.idle] * dt;
}

// ---------- drawing ----------
function drawSky(surfaceY) {
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(surfaceY, 1));
  g.addColorStop(0, '#a8d8e6'); g.addColorStop(0.75, '#d3ecf2'); g.addColorStop(1, '#e8f4ee');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(surfaceY, 0));
  // sun
  const sx = W * 0.78, sy = surfaceY * 0.32;
  const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130);
  sg.addColorStop(0, 'rgba(255,236,170,0.95)'); sg.addColorStop(0.25, 'rgba(255,220,140,0.35)'); sg.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = sg; ctx.fillRect(sx - 140, sy - 140, 280, 280);
  ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, TAU); ctx.fill();
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [cx, cy, s] of [[W * 0.15, surfaceY * 0.3, 1], [W * 0.42, surfaceY * 0.18, 0.7], [W * 0.68, surfaceY * 0.42, 0.5]]) {
    for (const [ox, oy, r] of [[0, 0, 18], [14, 4, 13], [-14, 5, 12], [4, -8, 12]]) {
      ctx.beginPath(); ctx.arc(cx + ox * s, cy + oy * s, r * s, 0, TAU); ctx.fill();
    }
  }
}

function drawWaves(surfaceY) {
  ctx.save();
  for (let l = 0; l < 3; l++) {
    const yy = surfaceY + l * 5;
    ctx.strokeStyle = `rgba(255,255,255,${0.28 - l * 0.07})`;
    ctx.lineWidth = 2.5 - l * 0.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) {
      const y = yy + Math.sin(x * 0.02 + time * (1.4 - l * 0.3) + l * 2) * (4 - l);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRays(surfaceY) {
  const depthBottom = camY + H / PPM;
  if (depthBottom > 90) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = W * (0.12 + i * 0.18) + Math.sin(time * 0.4 + i) * 26;
    const a = 0.05 * clamp(1 - depthBottom / 90, 0, 1);
    const g = ctx.createLinearGradient(x, surfaceY, x + 70, surfaceY + H * 0.7);
    g.addColorStop(0, `rgba(210,255,240,${a})`); g.addColorStop(1, 'rgba(210,255,240,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, surfaceY); ctx.lineTo(x + 42, surfaceY);
    ctx.lineTo(x + 130, surfaceY + H * 0.7); ctx.lineTo(x + 58, surfaceY + H * 0.7);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawRuler() {
  const rx = W - 40;
  ctx.strokeStyle = 'rgba(236,223,194,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, H); ctx.stroke();
  ctx.font = '9px "Courier Prime"'; ctx.fillStyle = 'rgba(236,223,194,0.55)';
  ctx.textAlign = 'left';
  const m0 = Math.max(0, Math.floor(camY / 10) * 10), m1 = camY + H / PPM;
  for (let m = m0; m <= m1; m += 10) {
    if (m < 0) continue;
    const y = (m - camY) * PPM, major = m % 50 === 0;
    ctx.strokeStyle = major ? 'rgba(236,223,194,0.4)' : 'rgba(236,223,194,0.2)';
    ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx + (major ? 10 : 5), y); ctx.stroke();
    if (major && m > 0) ctx.fillText(m + 'm', rx + 13, y + 3);
  }
  for (const z of ZONES) {
    const y = (z.d0 - camY) * PPM;
    if (y > -20 && y < H && z.d0 > 0) {
      ctx.save(); ctx.strokeStyle = 'rgba(216,169,63,0.5)'; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rx, y); ctx.stroke(); ctx.restore();
    }
  }
  if (hook.st !== 'idle') {
    const y = (hook.y - camY) * PPM;
    ctx.fillStyle = '#d8a93f';
    ctx.beginPath(); ctx.arc(rx, y, 3.5, 0, TAU); ctx.fill();
    ctx.fillText(Math.floor(hook.y) + 'm', rx + 13, y + 3);
  }
}

function boatPos() {
  const sy = (0 - camY) * PPM;
  return { sy, bob: Math.sin(time * 1.2) * 3 };
}

function drawBoat() {
  const { sy, bob } = boatPos();
  if (sy < -80 || sy > H + 80) return;
  const bx = boatX();
  ctx.save(); ctx.translate(bx, sy + bob); ctx.rotate(Math.sin(time * 1.2) * 0.03);
  // hull
  ctx.fillStyle = '#1b2c33';
  ctx.beginPath();
  ctx.moveTo(-52, -8); ctx.lineTo(52, -8); ctx.lineTo(38, 16); ctx.lineTo(-40, 16);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ecdfc2'; ctx.fillRect(-52, -11, 104, 4);
  // cabin
  ctx.fillStyle = '#22363d'; ctx.fillRect(-18, -26, 26, 16);
  ctx.fillStyle = '#d8a93f'; ctx.fillRect(-12, -22, 6, 6);
  ctx.fillStyle = '#16252a'; ctx.fillRect(-2, -34, 3, 10);
  // skipper silhouette + rod
  ctx.fillStyle = '#0d171b';
  ctx.beginPath(); ctx.arc(30, -19, 4, 0, TAU); ctx.fill();
  ctx.fillRect(27, -16, 6, 9);
  ctx.strokeStyle = '#0d171b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(28, -10); ctx.lineTo(48, -34); ctx.stroke();
  ctx.restore();
  return { tipX: bx + 48, tipY: sy + bob - 34 };
}

function drawLine(tip) {
  const hy = (hook.y - camY) * PPM;
  if (tip) {
    ctx.strokeStyle = 'rgba(235,244,244,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tip.tipX, tip.tipY);
    ctx.quadraticCurveTo((tip.tipX + hook.x) / 2, (tip.tipY + hy) / 2 - 50, hook.x, hy);
    ctx.stroke();
  }
  // caught fish stack along the line
  for (let i = 0; i < hook.catch.length; i++) {
    const f = hook.catch[i];
    const sy = hy - 20 - i * 15;
    drawCreature(f, f.x + (hook.x - f.x) * 0.4, sy, 0);
  }
  // hook
  ctx.save(); ctx.translate(hook.x, hy);
  ctx.strokeStyle = '#d8a93f'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -2, 6, -0.4, Math.PI * 0.9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -2); ctx.stroke();
  ctx.fillStyle = '#d8a93f'; ctx.beginPath(); ctx.arc(-3.4, -8.5, 2.4, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCreature(f, x, y, bobM) {
  const sp = f.sp, s = f.size, dir = f.dir || 1;
  const yy = y + (f.caught ? 0 : bobM * PPM);
  ctx.save(); ctx.translate(x, yy);
  if (sp.glow || sp.legendary) {
    ctx.shadowColor = sp.glow || '#ffd23f';
    ctx.shadowBlur = sp.legendary ? 24 : 12;
  }
  const grad = ctx.createLinearGradient(-s, 0, s, 0);
  grad.addColorStop(0, sp.c2); grad.addColorStop(0.55, sp.c1); grad.addColorStop(1, sp.c2);
  ctx.scale(dir, 1);
  const sway = Math.sin(time * 6 + f.phase) * 0.15;

  if (sp.shape === 'fish' || sp.shape === 'shark') {
    const shark = sp.shape === 'shark';
    // tail
    ctx.fillStyle = sp.c2; ctx.save(); ctx.translate(-s * 0.9, 0); ctx.rotate(sway);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.7, -s * (shark ? 0.6 : 0.45)); ctx.lineTo(-s * 0.55, 0); ctx.lineTo(-s * 0.7, s * 0.45); ctx.closePath(); ctx.fill(); ctx.restore();
    // dorsal
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.42); ctx.lineTo(-s * 0.55, -s * (shark ? 0.95 : 0.7)); ctx.lineTo(-s * 0.75, -s * 0.35); ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * (shark ? 0.42 : 0.55), 0, 0, TAU); ctx.fill();
    // belly
    ctx.fillStyle = sp.belly; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.18, s * 0.7, s * 0.28, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // stripes
    if (sp.stripe) {
      ctx.strokeStyle = sp.stripe; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.arc(i * s * 0.3, 0, s * 0.45, -0.7, 0.7); ctx.stroke();
      }
    }
    // barreleye dome
    if (sp.dome) {
      ctx.fillStyle = sp.dome; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.15, s * 0.42, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    // eye
    ctx.fillStyle = '#f4f8f8'; ctx.beginPath(); ctx.arc(s * 0.52, -s * 0.1, s * 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101c22'; ctx.beginPath(); ctx.arc(s * 0.56, -s * 0.1, s * 0.08, 0, TAU); ctx.fill();
  }
  else if (sp.shape === 'jelly') {
    const pulse = 1 + Math.sin(time * 2.4 + f.phase) * 0.12;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -2, s * pulse, s * 0.8 * pulse, 0, Math.PI, 0);
    ctx.quadraticCurveTo(s * pulse, s * 0.25, 0, s * 0.2);
    ctx.quadraticCurveTo(-s * pulse, s * 0.25, -s * pulse, -2);
    ctx.fill();
    ctx.globalAlpha = 0.4; ctx.fillStyle = sp.belly;
    ctx.beginPath(); ctx.ellipse(0, -4, s * 0.5 * pulse, s * 0.4, 0, Math.PI, 0); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.strokeStyle = sp.c2; ctx.lineWidth = 1.4;
    for (let tN = 0; tN < 5; tN++) {
      const tx = (tN - 2) * s * 0.32;
      ctx.beginPath(); ctx.moveTo(tx, s * 0.18);
      ctx.quadraticCurveTo(tx + Math.sin(time * 3 + tN + f.phase) * 4, s * 0.7, tx + Math.sin(time * 2.2 + tN) * 6, s * 1.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  else if (sp.shape === 'squid') {
    ctx.fillStyle = grad;
    // mantle
    ctx.beginPath(); ctx.ellipse(0, -s * 0.35, s * 0.38, s * 0.75, 0, 0, TAU); ctx.fill();
    // fins
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.7); ctx.lineTo(0, -s * 1.05); ctx.lineTo(s * 0.3, -s * 0.7); ctx.closePath(); ctx.fill();
    // head + eye
    ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.32, s * 0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.14, s * 0.3, s * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.arc(s * 0.17, s * 0.3, s * 0.06, 0, TAU); ctx.fill();
    // tentacles
    ctx.strokeStyle = sp.c2; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let tN = 0; tN < 5; tN++) {
      const tx = (tN - 2) * s * 0.16;
      ctx.beginPath(); ctx.moveTo(tx, s * 0.55);
      ctx.quadraticCurveTo(tx + Math.sin(time * 3.4 + tN * 1.3 + f.phase) * 4, s * 0.95, tx + Math.sin(time * 2.6 + tN) * 7, s * 1.35);
      ctx.stroke();
    }
  }
  else if (sp.shape === 'eel') {
    ctx.strokeStyle = grad; ctx.lineCap = 'round';
    const L = 9;
    for (let i = 0; i < L; i++) {
      const t0 = i / L, t1 = (i + 1) / L;
      const x0 = -t0 * s * 2.6, x1 = -t1 * s * 2.6;
      const y0 = Math.sin(time * 3 + t0 * 5 + f.phase) * s * 0.45 * t0;
      const y1 = Math.sin(time * 3 + t1 * 5 + f.phase) * s * 0.45 * t1;
      ctx.lineWidth = Math.max(1.5, s * 0.4 * (1 - t0));
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    // head
    ctx.fillStyle = sp.c1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4f8f8'; ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.08, s * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101c22'; ctx.beginPath(); ctx.arc(s * 0.21, -s * 0.08, s * 0.05, 0, TAU); ctx.fill();
  }
  else if (sp.shape === 'angler') {
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s * 0.6, 0, 0, TAU); ctx.fill();
    // tail
    ctx.save(); ctx.translate(-s * 0.75, 0); ctx.rotate(sway);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.5, -s * 0.4); ctx.lineTo(-s * 0.35, 0); ctx.lineTo(-s * 0.5, s * 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
    // open mouth
    ctx.fillStyle = '#120e1e';
    ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 0.1); ctx.lineTo(s * 0.85, -s * 0.05); ctx.lineTo(s * 0.25, s * 0.32); ctx.closePath(); ctx.fill();
    // teeth
    ctx.fillStyle = '#f2ecd8';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(s * (0.3 + i * 0.14), s * 0.02);
      ctx.lineTo(s * (0.36 + i * 0.14), s * 0.14); ctx.lineTo(s * (0.42 + i * 0.14), s * 0.02); ctx.closePath(); ctx.fill();
    }
    // eye
    ctx.fillStyle = '#f4f8f8'; ctx.beginPath(); ctx.arc(s * 0.25, -s * 0.2, s * 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101c22'; ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.2, s * 0.07, 0, TAU); ctx.fill();
    // lure
    ctx.strokeStyle = sp.c2; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.55);
    ctx.quadraticCurveTo(s * 0.7, -s * 1.1, s * 0.95, -s * 0.75); ctx.stroke();
    ctx.shadowColor = sp.glow; ctx.shadowBlur = 14;
    ctx.fillStyle = sp.glow; ctx.beginPath(); ctx.arc(s * 0.95, -s * 0.75, s * 0.12, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawSeabed() {
  const y = (462 - camY) * PPM;
  if (y > H + 60) return;
  ctx.fillStyle = '#0a0d14';
  ctx.beginPath(); ctx.moveTo(0, y + 10);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.013) * 12 + Math.sin(x * 0.05) * 4);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#11151f';
  for (let i = 0; i < 8; i++) {
    const rx = (i * 167 + 40) % W;
    ctx.beginPath(); ctx.ellipse(rx, y + Math.sin(rx * 0.013) * 12 + 4, 12 + (i % 3) * 7, 6 + (i % 3) * 3, 0, 0, TAU); ctx.fill();
  }
}

function draw() {
  const surfaceY = (0 - camY) * PPM;
  const topM = Math.max(camY, 0), botM = camY + H / PPM;

  // sky + water
  if (surfaceY > 0) drawSky(surfaceY);
  const g = ctx.createLinearGradient(0, Math.max(surfaceY, 0), 0, H);
  g.addColorStop(0, colAt(Math.max(topM, 0.1)));
  g.addColorStop(1, colAt(botM));
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(surfaceY, 0), W, H - Math.max(surfaceY, 0));

  drawRays(surfaceY);
  if (surfaceY > -40) drawWaves(surfaceY);
  drawSeabed();

  // marine snow
  if (topM > 120) {
    ctx.fillStyle = 'rgba(220,235,255,0.16)';
    for (const s of snow) { const sy = (s.y - camY) * PPM; ctx.fillRect(s.x, sy, s.r, s.r); }
  }

  // fish (skip caught)
  for (const f of fish) {
    const sy = (f.y - camY) * PPM;
    if (sy < -60 || sy > H + 60) continue;
    drawCreature(f, f.x, sy, f.sp.shape === 'jelly' ? Math.sin(time * 0.9 + f.phase) * 1.4 * PPM : Math.sin(time * 1.7 + f.phase) * 0.25 * PPM);
  }

  // boat + line
  const tip = drawBoat();
  drawLine(tip);

  // bubbles
  ctx.strokeStyle = 'rgba(235,248,250,0.4)'; ctx.lineWidth = 1;
  for (const b of bubbles) {
    const by = (b.y - camY) * PPM;
    if (by < -10 || by > H + 10) continue;
    ctx.beginPath(); ctx.arc(b.x, by, b.r, 0, TAU); ctx.stroke();
  }

  drawRuler();

  // coin floaters
  ctx.textAlign = 'center'; ctx.font = '700 15px "Barlow Condensed"';
  for (const fl of floaters) {
    ctx.globalAlpha = clamp(fl.life / 0.6, 0, 1);
    ctx.fillStyle = fl.col; ctx.fillText(fl.txt, fl.x, fl.y);
  }
  ctx.globalAlpha = 1;

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ---------- HUD sync ----------
let lastMoney = -1;
function hud() {
  const m = Math.floor(S.money);
  if (m !== lastMoney) { el.money.textContent = fmt(m); lastMoney = m; if (shopOpen) refreshShop(); }
  el.depth.textContent = Math.floor(Math.max(hook.y, 0)) + 'm / ' + maxDepthM() + 'm';
  el.cap.textContent = hook.catch.length + '/' + capN();
  const label = hook.st === 'idle' ? 'CAST LINE' : (hook.st === 'down' ? 'REEL IN' : 'REELING…');
  if (el.cast.textContent !== label) {
    el.cast.textContent = label;
    el.cast.classList.toggle('reel', hook.st !== 'idle');
  }
}

// ---------- idle / offline ----------
let idleAcc = 0;
setInterval(() => {
  if (!playing) return;
  idleAcc += 1;
  if (idleAcc >= 10) { idleAcc = 0; save(); }
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// offline earnings on boot
const away = clamp((Date.now() - S.t) / 1000, 0, 8 * 3600);
const awayGain = Math.floor(IDLE_RATE[S.idle] * away);
if (awayGain > 0) S.money += awayGain;

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  draw();
  hud();
  requestAnimationFrame(frame);
}
refreshShop();
if (new URLSearchParams(location.search).has('debug')) window.__dw = { S, fish, hook, cast, sell, spawnColumn, refreshShop };
if (awayGain > 0) {
  showHaul({ 'WHILE YOU WERE AWAY': { sp: { name: 'WHILE YOU WERE AWAY', c1: '#d8a93f' }, n: Math.floor(away / 60), v: awayGain } }, awayGain);
  haulTimer = 4;
}
requestAnimationFrame(frame);
})();
