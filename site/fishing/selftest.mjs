// Headless self-test for site/fishing — drives the real fishing.js with stubbed DOM/canvas.
// Run: bun site/fishing/selftest.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./fishing.js', import.meta.url), 'utf8');

// ---------- stubs ----------
const NOW0 = 1_000_000;
let fakeNow = NOW0;

const magicEl = () => {
  const el = {
    textContent: '', innerHTML: '', innerText: '', value: '',
    style: {}, onclick: null,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
  };
  return el;
};
const els = new Map();
const q = (sel) => { if (sel === '#c') return canvas; if (!els.has(sel)) els.set(sel, magicEl()); return els.get(sel); };

const canvas2d = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (prop === 'measureText') return () => ({ width: 10 });
    return typeof prop === 'string' ? (() => {}) : undefined;
  },
  set() { return true; },
});
const canvas = { getContext: () => canvas2d, style: {}, width: 0, height: 0 };

const listeners = {};
const addListener = (map) => (ev, fn) => { (map[ev] = map[ev] || []).push(fn); };

const store = new Map();
const localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
};

let rafCb = null;
const requestAnimationFrame = cb => { rafCb = cb; };

const documentStub = {
  querySelector: q,
  addEventListener: addListener(listeners),
  hidden: false,
};

const windowStub = {};

const fn = new Function(
  'window', 'document', 'localStorage', 'location', 'performance',
  'requestAnimationFrame', 'addEventListener', 'innerWidth', 'innerHeight',
  'devicePixelRatio', 'URLSearchParams',
  src + '\n;return window.__dw;',
);
const dw = fn(
  windowStub, documentStub, localStorage, { search: '?fast=50&debug=1' },
  { now: () => fakeNow },
  requestAnimationFrame, addListener(listeners), 1280, 800, 1, URLSearchParams,
);

const pump = (n, dtMs = 50) => {
  for (let i = 0; i < n; i++) {
    fakeNow += dtMs;
    const cb = rafCb; rafCb = null;
    if (cb) cb(fakeNow);
  }
};

// ---------- tests ----------
let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
};

// rig a mid-game save
dw.S.money = 50; dw.S.cap = 3; dw.S.depth = 11; dw.S.reel = 4;

// 1. spawn density scales with depth
dw.cast();
pump(1);
ok(dw.fish.length >= 20, 'spawnColumn fills the column (' + dw.fish.length + ' fish for 450m)');

// 2. catch sweep + sell tally
dw.fish.forEach(f => { f.x = 640; f.dir = 0; });
pump(30);
const caughtVals = dw.fish.filter(f => f.caught).reduce((a, f) => a + f.sp.val, 0);
const capN = [3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 26, 30][dw.S.cap];
ok(dw.fish.filter(f => f.caught).length === Math.min(capN, dw.fish.length), 'hook catches up to capacity (' + dw.fish.filter(f => f.caught).length + '/' + capN + ')');
ok(dw.S.money === 50 + caughtVals, 'sell credits the ledger (+ ' + caughtVals + ')', dw.S.money);
ok(dw.S.best === caughtVals, 'best haul recorded', dw.S.best);
ok(q('#haul').classList.contains('on'), 'haul popup shows after a sale');
ok(q('#haultotal').textContent.startsWith('+'), 'haul total rendered', q('#haultotal').textContent);
ok(q('#haulrows').innerHTML.includes('×'), 'haul rows list species counts', q('#haulrows').innerHTML);
pump(50);
ok(!q('#haul').classList.contains('on'), 'haul popup fades out');

// 3. zone banners fire at depth boundaries
const zoneSeen = q('#zoneh').textContent;
ok(zoneSeen.length > 0, 'zone banner text set during dive', zoneSeen);

// 4. hook returns to idle and casts again
ok(dw.hook.st === 'idle' && dw.hook.y === 0, 'hook back on deck after the haul');
dw.cast();
pump(1);
ok(dw.hook.st === 'down', 'second cast starts sinking');

// 5. shop purchase deducts and levels
dw.S.depth = 8; dw.S.money = 10000; pump(1); // refreshShop ran on the sale → handler reads live state
const lvlBefore = dw.S.depth;
const cost = Math.round(20 * Math.pow(1.75, lvlBefore));
q('#b-depth').onclick();
ok(dw.S.depth === lvlBefore + 1 && dw.S.money === 10000 - cost, 'buying LONGER LINE works (-' + cost + ')', { lvl: dw.S.depth, money: dw.S.money });

// 6. maxed row shows MAX and refuses to buy
dw.S.depth = 11; dw.S.money = 0; dw.refreshShop();
q('#b-depth').onclick();
ok(String(q('#b-depth').className).includes('max'), 'maxed upgrade row locked', q('#b-depth').className);

// 7. legendary haul flags the gold banner
q('#zone').classList.remove('gold');
dw.S.cap = 0; // cap 3
dw.cast(); pump(1);
dw.fish.forEach(f => { f.x = 640; f.dir = 0; });
pump(30);
ok(q('#zone').classList.contains('gold') === dw.fish.some(f => f.caught && f.sp.legendary), 'legendary haul flags the gold banner');

// 8. save round-trips after the last sale
const saved = JSON.parse(localStorage.getItem('deepwater-save-v1'));
ok(typeof saved.money === 'number' && saved.money === dw.S.money, 'save writes the ledger', { saved: saved.money, live: dw.S.money });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
