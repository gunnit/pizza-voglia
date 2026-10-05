/* =====================================================================
   PIZZA VOGLIA — "PROVA SPECIALE VALPANTENA"
   Arcade rally anni '80 in pseudo-3D (tecnica "a segmenti" alla OutRun)
   per l'opzione B.

   - Strada fatta di segmenti proiettati (curve + dossi), sprite scalati
     con la distanza, disegnata a scanline per pixel netti.
   - Logica pura (STAGE, createState, startRun, update, autopilot):
     nessun DOM, testabile in Node.
   - Renderer Canvas 2D a 256×192: sprite pixel-art generati da codice,
     cifre LED a 7 segmenti, font bitmap 5×7 / 3×5.
   - Controller DOM (mountGame): tastiera, touch, pulsanti del cabinato,
     motore WebAudio, record in localStorage, pausa automatica.
   Il modulo non tocca il DOM al caricamento.
   ===================================================================== */

export const W = 256;
export const H = 192;

/* ---------- strada e camera ---------- */
export const SEG = 200; // lunghezza di un segmento
const RUMBLE = 3; // segmenti per striscia del cordolo
const ROAD_W = 1300; // metà larghezza della strada
const CAM_H = 1000; // altezza della camera
const CAM_D = 1 / Math.tan((50 * Math.PI) / 180); // FOV 100°
const PLAYER_Z = CAM_H * CAM_D; // distanza camera → auto
const DRAW_DIST = 140; // segmenti disegnati
const SPR = CAM_H / ((W / 2) * ROAD_W); // sprite 1:1 alla distanza dell'auto
export const MAX_SPEED = SEG * 60;
const ACCEL = MAX_SPEED / 4;
const BRAKE = -MAX_SPEED;
const DECEL = -MAX_SPEED / 5;
const OFF_DECEL = -MAX_SPEED / 1.8;
const OFF_LIMIT = MAX_SPEED / 3.2;
const CENTRIFUGAL = 0.3;
const START_TIME = 23;
const START_SEG = 8;
const KMH = 186;
const OUTLINE = '#140d22';

/* ---------- palette (chiave a un carattere → colore) ---------- */
export const PAL = {
  k: '#140d22', // contorno scuro
  h: '#ffffff', // bianco
  w: '#fff4dc', // crema
  c: '#d8c6a2', // ombra crema
  r: '#ff3b3b', // pomodoro
  R: '#b3202e', // pomodoro scuro
  p: '#ff8f80', // pomodoro chiaro
  g: '#36d17a', // basilico
  G: '#178a4a', // basilico scuro
  v: '#a6f5c6', // verde chiaro
  y: '#ffd23f', // formaggio / oro
  Y: '#c98a12', // oro scuro
  o: '#ff9a2e', // arancio
  O: '#b8641c', // arancio scuro / coppi
  b: '#cf9152', // marrone chiaro
  B: '#7a4524', // marrone scuro
  t: '#f3d3a1', // beige / mollica
  m: '#f2e4c6', // cartone chiaro
  M: '#b9a07a', // alveoli della mollica
  l: '#7a4aa8', // uva / oliva
  L: '#b58ae0', // uva luce
  n: '#241a40', // vetro scuro
  q: '#ff4fd8', // rosa neon
  e: '#8d8bb3', // lilla / metallo
  E: '#3a3f73', // grigio scuro
  u: '#8fb8ff', // azzurro
  a: '#9bbd52', // carciofo
  A: '#5c7a26', // carciofo scuro
  j: '#ffa3b5', // rosa (prosciutto, muso)
  J: '#e0708a', // rosa scuro
  z: '#7a3fa0', // melanzana
  C: '#e8a456', // cornicione
  D: '#ffd79c', // cornicione luce
  K: '#b2672c', // cornicione lato
  Q: '#6b381c', // cornicione scuro / coppi scuri
  x: '#2a1a14', // bruciato
  F: '#1f5a40', // fogliame scuro
  T: '#3aa56e', // fogliame chiaro
  Z: '#4a2e22', // tronco
  U: '#3d6fd6', // auto blu
  V: '#24408a', // auto blu scuro
  N: '#2bb3a8', // auto verde acqua
  P: '#17706a', // verde acqua scuro
  I: '#a7a9c9', // pietra chiara
  W: '#c9b896', // polvere
  X: '#ff7a3d', // arancio tramonto
  d: '#f6c9a0', // pelle
  i: '#8a5a3c', // pelle scura / capelli
  H: '#62668f', // pietra
};

/* ---------- utilità ---------- */
export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const lerp = (a, b, p) => a + (b - a) * p;
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
const accel = (v, a, dt) => v + a * dt;
const pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');
function overlap(x1, w1, x2, w2, percent = 1) {
  const half = percent / 2;
  return !(x1 + w1 * half < x2 - w2 * half || x1 - w1 * half > x2 + w2 * half);
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const rgbCache = new Map();
function hexToRgb(hex) {
  let v = rgbCache.get(hex);
  if (v) return v;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  rgbCache.set(hex, v);
  return v;
}
function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

/** Tempo in formato rally: 0:52.3 */
export function fmtTime(sec) {
  if (!(sec > 0)) return '-:--.-';
  const t = Math.floor(sec * 10);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${t % 10}`;
}

/* =====================================================================
   PIXEL ART
   ===================================================================== */
function grid(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += fn(x, y) || '.';
    rows.push(row);
  }
  return rows;
}
function overlayArt(rows, art, ox = 0, oy = 0) {
  const out = rows.map((r) => r.split(''));
  art.forEach((line, j) => {
    const y = oy + j;
    if (y < 0 || y >= out.length) return;
    for (let i = 0; i < line.length; i++) {
      const x = ox + i;
      const ch = line[i];
      if (ch === '.' || x < 0 || x >= out[y].length) continue;
      out[y][x] = ch === '_' ? '.' : ch;
    }
  });
  return out.map((r) => r.join(''));
}
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function lit(w, h, inside, cx, cy, rx, ry, c) {
  return grid(w, h, (x, y) => {
    if (!inside(x, y)) return '.';
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    const l = -(0.6 * nx + 0.8 * ny);
    const edgeDark = !inside(x + 1, y) || !inside(x, y + 1);
    const edgeLight = !inside(x - 1, y) || !inside(x, y - 1);
    if (edgeDark && l < 0.2) return c.rim;
    if (edgeLight && l > -0.2) return c.rimLight || c.base;
    if (l < -0.42) return c.dark;
    if (l > 0.5) return c.light || c.base;
    return c.base;
  });
}

/* ---------- font 5×7 e 3×5 ---------- */
const GLYPH_SRC = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# #...# ##..# #.#.# #..## #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.',
  1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  2: '.###. #...# ....# ...#. ..#.. .#... #####',
  3: '##### ...#. ..#.. ...#. ....# #...# .###.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  5: '##### #.... ####. ....# ....# #...# .###.',
  6: '..##. .#... #.... ####. #...# #...# .###.',
  7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.',
  9: '.###. #...# #...# .#### ....# ...#. .##..',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  '.': '..... ..... ..... ..... ..... .##.. .##..',
  ',': '..... ..... ..... ..... .##.. ..#.. .#...',
  ':': '..... .##.. .##.. ..... .##.. .##.. .....',
  '-': '..... ..... ..... ##### ..... ..... .....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '×': '..... #...# .#.#. ..#.. .#.#. #...# .....',
  '/': '....# ...#. ...#. ..#.. .#... .#... #....',
  "'": '..#.. ..#.. .#... ..... ..... ..... .....',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '%': '##... ##..# ...#. ..#.. .#... #..## ...##',
  '=': '..... ..... ##### ..... ##### ..... .....',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  '★': '..#.. ..#.. ##### .###. .#.#. #...# .....',
  '♥': '..... .#.#. ##### ##### .###. ..#.. .....',
  '→': '..... ..#.. ...#. ##### ...#. ..#.. .....',
  '←': '..... ..#.. .#... ##### .#... ..#.. .....',
  '↑': '..#.. .###. #.#.# ..#.. ..#.. ..#.. .....',
  '↓': '..... ..#.. ..#.. ..#.. #.#.# .###. ..#..',
  '·': '..... ..... ..... ..#.. ..... ..... .....',
  '_': '..... ..... ..... ..... ..... ..... #####',
  '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
};
const GLYPHS = {};
for (const [ch, src] of Object.entries(GLYPH_SRC)) GLYPHS[ch] = src.split(' ');
const TINY_SRC = {
  A: '.#. #.# ### #.# #.#', C: '### #.. #.. #.. ###', D: '##. #.# #.# #.# ##.', E: '### #.. ##. #.. ###',
  G: '### #.. #.# #.# ###', I: '### .#. .#. .#. ###', L: '#.. #.. #.. #.. ###', N: '#.# ### ### #.# #.#',
  O: '### #.# #.# #.# ###', P: '### #.# ### #.. #..', R: '##. #.# ##. #.# #.#', S: '### #.. ### ..# ###',
  T: '### .#. .#. .#. .#.', V: '#.# #.# #.# #.# .#.', Z: '### ..# .#. #.. ###',
  0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '### ..# ### #.. ###', 3: '### ..# .## ..# ###',
  4: '#.# #.# ### ..# ..#', 5: '### #.. ### ..# ###', 6: '### #.. ### #.# ###', 7: '### ..# .#. .#. .#.',
  8: '### #.# ### #.# ###', 9: '### #.# ### ..# ###',
};
const TINY = {};
for (const [ch, src] of Object.entries(TINY_SRC)) TINY[ch] = src.split(' ');

export function normText(t) {
  return String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[’‘]/g, "'");
}
const textW = (s, tiny = false, scale = 1) => {
  const n = [...normText(s)].length;
  return n ? (n * ((tiny ? 3 : 5) + 1) - 1) * scale : 0;
};

/** Piccolo "pennello" su griglia di caratteri-palette. */
class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.a = [];
    for (let y = 0; y < h; y++) this.a.push(new Array(w).fill('.'));
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y][x] = c;
    return this;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.a[y][x] : '.';
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  art(x, y, rows) {
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) if (r[i] !== '.') this.set(x + i, y + j, r[i] === '_' ? '.' : r[i]);
    });
    return this;
  }
  text(x, y, str, c, tiny = false, scale = 1) {
    let cx = x;
    const gw = tiny ? 3 : 5;
    for (const ch of normText(str)) {
      const gl = tiny ? TINY[ch] : GLYPHS[ch];
      if (gl) {
        for (let j = 0; j < gl.length; j++) for (let i = 0; i < gw; i++) if (gl[j][i] === '#') this.rect(cx + i * scale, y + j * scale, scale, scale, c);
      }
      cx += (gw + 1) * scale;
    }
    return this;
  }
  mirror() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w >> 1; x++) this.a[y][this.w - 1 - x] = this.a[y][x];
    return this;
  }
  flipX() {
    for (const r of this.a) r.reverse();
    return this;
  }
  rows() {
    return this.a.map((r) => r.join(''));
  }
}

/* ---------- oggetti da raccogliere ---------- */
function makeTomato() {
  let r = lit(12, 12, ellipse(6, 7, 5.6, 4.95), 6, 7, 5.6, 4.95, { base: 'r', light: 'r', dark: 'R', rim: 'R', rimLight: 'p' });
  r = overlayArt(r, ['....G..G....', '...GgGgGG...', '....gGGg....', '.....G......', '..hp........', '..p.........']);
  return r;
}
function makeBasil() {
  const ax = 1.2, ay = 10.8, bx = 10.8, by = 1.2;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const half = Math.hypot(bx - ax, by - ay) / 2;
  const hw = 3.1;
  const R = (half * half + hw * hw) / (2 * hw);
  const dd = R - hw;
  const p = 1 / Math.SQRT2;
  const c1 = [mx + p * dd, my + p * dd];
  const c2 = [mx - p * dd, my - p * dd];
  const inside = (x, y) => Math.hypot(x + 0.5 - c1[0], y + 0.5 - c1[1]) <= R && Math.hypot(x + 0.5 - c2[0], y + 0.5 - c2[1]) <= R;
  const rows = grid(12, 12, (x, y) => {
    if (!inside(x, y)) return '.';
    const side = x + 0.5 + (y + 0.5) - 12;
    const onVein = Math.abs(x + 0.5 - (12 - (y + 0.5))) < 0.75;
    const edge = !inside(x + 1, y) || !inside(x, y + 1) || !inside(x - 1, y) || !inside(x, y - 1);
    if (onVein && !edge) return 'v';
    if (edge) return side > 0 ? 'G' : 'g';
    return side > 1.2 ? 'G' : 'g';
  });
  return overlayArt(rows, ['G'], 0, 11);
}
function makePineapple() {
  const inside = ellipse(6.5, 10.6, 5.6, 6.2);
  const body = grid(13, 17, (x, y) => {
    if (y < 4 || !inside(x, y)) return '.';
    const edgeR = !inside(x + 1, y) || !inside(x, y + 1);
    const edgeL = !inside(x - 1, y) || !inside(x, y - 1);
    if (edgeR) return 'O';
    if ((x + y) % 3 === 0 || (x - y + 99) % 3 === 0) return 'O';
    if (edgeL) return 'y';
    return x + 0.5 - 6.5 + (y + 0.5 - 10.6) * 0.6 > 2.2 ? 'o' : 'y';
  });
  return overlayArt(body, [
    '...G..g..G...',
    '...GG.g.GG...',
    '....GgggG....',
    '.....GgG.....',
    '.....GgG.....',
    '.............',
    '.............',
    '..kk.....kk..',
    '...kk...kk...',
    '...hk...kh...',
    '...yy...yy...',
    '.............',
    '.....kkk.....',
    '....k...k....',
  ]);
}
function makeCheese() {
  // Monte Veronese: una forma vista di tre quarti, con bollino rosso
  const w = 20;
  const g = new Grid(w, 13);
  const cx = 10, rx = 9.6, ry = 3.1;
  for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - cx) / rx;
    if (Math.abs(dx) > 1) continue;
    const e = Math.sqrt(1 - dx * dx) * ry;
    const t0 = Math.round(3.4 - e);
    const t1 = Math.round(3.4 + e);
    for (let y = t1 + 1; y <= t1 + 6; y++) g.set(x, y, dx > 0.55 ? 'Y' : dx < -0.75 ? 'D' : 'y');
    g.set(x, t1 + 6, 'Y');
    for (let y = t0; y <= t1; y++) g.set(x, y, 'w');
    g.set(x, t0, dx < 0 ? 'h' : 'c');
  }
  g.rect(7, 8, 6, 3, 'R').rect(8, 9, 4, 1, 'h');
  return g.rows();
}
function makeBroccoli() {
  const g = new Grid(14, 16);
  g.rect(5, 9, 4, 7, 'v').rect(8, 9, 1, 7, 'g').rect(4, 12, 1, 2, 'v').rect(9, 11, 2, 1, 'v');
  const blob = (cx, cy, r) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 14; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r) g.set(x, y, x + 0.5 - cx + (y + 0.5 - cy) > r * 0.45 ? 'F' : 'T');
      }
    }
  };
  blob(4, 6.5, 3.6);
  blob(10, 6.5, 3.6);
  blob(7, 4.2, 4);
  for (const [x, y] of [[3, 5], [6, 2], [9, 4], [7, 6], [11, 6], [2, 7]]) g.set(x, y, 'v');
  return g.rows();
}
function makeGrapes() {
  const g = new Grid(12, 16);
  g.rect(5, 0, 1, 3, 'Z').rect(6, 1, 4, 2, 'T').set(9, 0, 'T');
  const berry = (x, y) => g.rect(x, y, 3, 3, 'l').set(x, y, 'L').set(x + 2, y + 2, 'n');
  [[1, 3], [4, 3], [7, 3], [2, 6], [5, 6], [8, 6], [3, 9], [6, 9], [4, 12]].forEach(([x, y]) => berry(x, y));
  return g.rows();
}

/* ---------- l'auto n. 46 (vista posteriore) ---------- */
function makeRallyCar(brake) {
  const g = new Grid(64, 40);
  // gomme posteriori
  g.rect(2, 29, 12, 11, 'k');
  for (let y = 31; y < 39; y += 2) g.rect(3, y, 9, 1, 'E');
  // scocca + passaruota allargati
  g.rect(3, 20, 29, 9, 'w');
  g.rect(1, 23, 3, 7, 'w').rect(1, 23, 1, 7, 'c');
  g.rect(3, 28, 29, 1, 'c');
  // montanti + lunotto
  for (let y = 10; y <= 19; y++) {
    const k = Math.round((19 - y) * 0.45);
    g.rect(7 + k, y, 25 - k, 1, 'w');
    if (y <= 18) g.rect(12 + k, y, 20 - k, 1, 'n');
  }
  for (let i = 0; i < 5; i++) g.set(16 + i, 17 - i, 'E');
  // spoiler sul tetto
  g.rect(6, 7, 26, 2, 'w').rect(6, 9, 26, 1, 'c').rect(5, 5, 2, 6, 'k');
  // portapacchi
  g.rect(12, 6, 20, 1, 'E');
  // la teglia di pizza al taglio sul tetto (scatola quadrata)
  g.rect(16, 0, 16, 6, 't').rect(16, 0, 16, 1, 'm').rect(16, 5, 16, 1, 'b').rect(16, 2, 16, 2, 'r').rect(21, 0, 1, 7, 'k');
  // fanali
  g.rect(4, 21, 8, 5, 'R').rect(5, 22, 6, 3, brake ? 'p' : 'r');
  if (brake) g.rect(6, 22, 3, 2, 'h');
  // livrea a chevron: pomodoro, formaggio, basilico
  for (let y = 20; y <= 27; y++) {
    for (let x = 13; x <= 31; x++) {
      const v = y + (31 - x) * 0.27;
      if (v >= 23.4 && v < 25) g.set(x, y, 'r');
      else if (v >= 25 && v < 26.2) g.set(x, y, 'y');
      else if (v >= 26.2 && v < 27.8) g.set(x, y, 'g');
    }
  }
  // paraurti, sottoscocca, paraspruzzi
  g.rect(3, 29, 29, 6, 'k');
  g.rect(14, 35, 18, 3, 'k');
  g.rect(3, 34, 9, 5, 'r').rect(3, 34, 9, 1, 'R');
  g.mirror();
  // dettagli asimmetrici
  g.text(8, 30, 'PIZZA VOGLIA', 'w', true);
  g.rect(26, 11, 12, 7, 'h').rect(26, 11, 12, 1, 'c');
  g.text(28, 12, '46', 'k', true);
  g.rect(42, 36, 5, 2, 'E').set(43, 36, 'k').set(44, 36, 'k');
  return g.rows();
}
/** Rollio in curva: la parte alta dell'auto si sposta verso la curva. */
function leanRows(rows, dir) {
  return rows.map((r, y) => {
    const s = y < 10 ? 2 * dir : y < 20 ? dir : 0;
    if (!s) return r;
    return s > 0 ? '.'.repeat(s) + r.slice(0, r.length - s) : r.slice(-s) + '.'.repeat(-s);
  });
}

/* ---------- traffico ---------- */
function makeCar(body, dark) {
  const g = new Grid(40, 26);
  g.rect(1, 18, 8, 8, 'k');
  for (let y = 20; y < 25; y += 2) g.rect(2, y, 6, 1, 'E');
  g.rect(3, 11, 17, 8, body).rect(1, 13, 3, 7, body).rect(1, 13, 1, 7, dark).rect(3, 18, 17, 1, dark);
  for (let y = 2; y <= 10; y++) {
    const k = Math.round((10 - y) * 0.5);
    g.rect(5 + k, y, 15 - k, 1, body);
    if (y >= 3 && y <= 9) g.rect(8 + k, y, 12 - k, 1, 'n');
  }
  g.rect(8, 1, 12, 1, body);
  g.rect(3, 12, 5, 3, 'R').rect(4, 13, 3, 1, 'r');
  g.rect(2, 19, 18, 3, 'k');
  g.mirror();
  g.rect(16, 15, 8, 3, 'h').rect(17, 16, 6, 1, 'H');
  return g.rows();
}
function makeTractor() {
  const g = new Grid(36, 32);
  g.rect(0, 8, 10, 24, 'k');
  for (let y = 10; y < 31; y += 3) g.rect(1, y, 3, 1, 'E').rect(5, y + 1, 4, 1, 'E');
  g.rect(0, 5, 12, 3, 'g').rect(0, 7, 12, 1, 'G');
  g.rect(10, 10, 8, 18, 'g').rect(10, 26, 8, 2, 'G');
  g.rect(12, 6, 6, 7, 'k');
  g.rect(11, 22, 2, 2, 'r');
  g.mirror();
  g.rect(15, 0, 6, 2, 'r').rect(15, 2, 6, 4, 'd');
  g.rect(27, 0, 2, 10, 'e');
  g.rect(15, 27, 6, 3, 'E');
  return g.rows();
}

/* ---------- bordo strada ---------- */
function makeCypress(h = 56) {
  const w = 12;
  const g = new Grid(w, h);
  const body = h - 6;
  const cx = 6;
  const rng = makeRng(h * 7);
  for (let y = 0; y < body; y++) {
    const t = y / (body - 1);
    const half = t < 0.75 ? 5.6 * Math.sqrt(t / 0.75) : 5.6 * (1 - (t - 0.75) * 0.9);
    for (let x = 0; x < w; x++) {
      const d = x + 0.5 - cx;
      if (Math.abs(d) > half) continue;
      let c = d < -half * 0.2 ? 'T' : 'F';
      if (Math.abs(d) > half - 1) c = 'F';
      if (rng() < 0.12) c = c === 'T' ? 'F' : 'T';
      g.set(x, y, c);
    }
  }
  g.rect(5, body, 2, 6, 'Z');
  return g.rows();
}
function makeVine() {
  const g = new Grid(34, 20);
  const rng = makeRng(5);
  g.rect(1, 3, 2, 17, 'Z').rect(31, 3, 2, 17, 'Z');
  for (let x = 2; x < 32; x++) {
    const top = 2 + Math.round(rng() * 2);
    const bot = 11 + Math.round(rng() * 2);
    for (let y = top; y <= bot; y++) g.set(x, y, rng() < 0.3 ? 'T' : 'F');
  }
  g.rect(1, 6, 32, 1, 'e');
  for (let k = 0; k < 7; k++) {
    const x = 4 + Math.round(rng() * 25);
    const y = 11 + Math.round(rng() * 2);
    g.rect(x, y, 2, 3, 'l').set(x, y, 'L').set(x + 1, y + 3, 'l');
  }
  return g.rows();
}
function makeWall() {
  const g = new Grid(46, 13);
  const rng = makeRng(13);
  g.rect(0, 1, 46, 12, 'E');
  for (const [y0, hh] of [[1, 4], [5, 4], [9, 4]]) {
    let x = y0 === 5 ? -3 : 0;
    while (x < 46) {
      const len = 4 + Math.floor(rng() * 5);
      g.rect(x, y0, len - 1, hh - 1, 'H').rect(x, y0, len - 1, 1, 'I');
      x += len;
    }
  }
  for (let x = 0; x < 46; x += 5) if (rng() < 0.7) g.rect(x + 1, 0, 3, 1, 'I');
  return g.rows();
}
function makeSign(text, blue) {
  const w = textW(text) + 8;
  const g = new Grid(w, 30);
  g.rect(0, 0, w, 13, blue ? 'h' : 'k').rect(1, 1, w - 2, 11, blue ? 'V' : 'h');
  g.text(4, 3, text, blue ? 'h' : 'k');
  g.rect(3, 13, 2, 17, 'e').rect(w - 5, 13, 2, 17, 'e');
  return g.rows();
}
function makeBales() {
  const g = new Grid(28, 16);
  const bale = (x, y) => {
    g.rect(x, y, 13, 7, 'y').rect(x, y + 6, 13, 1, 'Y').rect(x + 12, y, 1, 7, 'Y').rect(x + 3, y, 1, 7, 'o').rect(x + 9, y, 1, 7, 'o');
    for (let i = 0; i < 5; i++) g.set(x + 1 + i * 2, y + 2 + (i % 3), 'Y');
  };
  bale(0, 9);
  bale(14, 9);
  bale(7, 2);
  return g.rows();
}
function makeCow() {
  const g = new Grid(32, 22);
  g.rect(9, 5, 19, 10, 'h').rect(9, 14, 19, 1, 'c');
  g.rect(13, 6, 6, 5, 'b').rect(21, 8, 5, 4, 'b').rect(10, 11, 3, 3, 'b');
  for (const x of [10, 13, 23, 26]) g.rect(x, 15, 2, 5, 'h').rect(x, 20, 2, 1, 'k');
  g.rect(28, 6, 1, 8, 'c').rect(28, 13, 2, 2, 'b');
  g.rect(18, 15, 3, 2, 'j');
  g.rect(3, 9, 7, 6, 'b').rect(1, 13, 4, 4, 'b').rect(1, 15, 3, 2, 'j');
  g.rect(5, 10, 3, 3, 'h').set(4, 11, 'k');
  g.rect(6, 7, 2, 2, 'c').rect(9, 8, 2, 1, 'c');
  g.rect(0, 20, 7, 1, 'T').set(1, 19, 'T').set(3, 19, 'T');
  return g.rows();
}
function makeCrowd(seed) {
  const g = new Grid(48, 28);
  const rng = makeRng(seed * 31 + 7);
  const cols = ['r', 'g', 'y', 'q', 'U', 'w', 'X', 'N'];
  const person = (x, y, raise) => {
    const c = cols[Math.floor(rng() * cols.length)];
    g.rect(x, y + 3, 5, 7, c);
    g.rect(x + 1, y + 10, 1, 4, 'V').rect(x + 3, y + 10, 1, 4, 'V');
    if (raise) g.rect(x - 1, y - 3, 1, 6, 'd').rect(x + 5, y - 3, 1, 6, 'd');
    else g.rect(x - 1, y + 3, 1, 5, 'd').rect(x + 5, y + 3, 1, 5, 'd');
    g.rect(x + 1, y, 3, 3, rng() < 0.7 ? 'd' : 'i').rect(x + 1, y, 3, 1, rng() < 0.5 ? 'k' : 'i');
  };
  for (let i = 0; i < 7; i++) person(1 + i * 7, 5 + Math.round(rng() * 2), rng() < 0.5);
  for (let i = 0; i < 6; i++) person(4 + i * 7, 12 + Math.round(rng() * 2), rng() < 0.45);
  const fx = 5 + Math.floor(rng() * 30);
  g.rect(fx, 0, 1, 13, 'e');
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) g.set(fx + 1 + i, j, (i + j) % 2 ? 'k' : 'h');
  return g.rows();
}
function makeArch(text, bg) {
  const w = 360;
  const h = 86;
  const g = new Grid(w, h);
  const post = (x) => {
    for (let y = 0; y < h; y++) g.rect(x, y, 8, 1, Math.floor(y / 6) % 2 ? 'h' : 'r');
  };
  post(0);
  post(w - 8);
  g.rect(8, 4, w - 16, 26, bg);
  for (let x = 8; x < w - 8; x++) {
    for (let y = 4; y < 8; y++) g.set(x, y, (Math.floor(x / 4) + Math.floor((y - 4) / 2)) % 2 ? 'k' : 'h');
    for (let y = 26; y < 30; y++) g.set(x, y, (Math.floor(x / 4) + Math.floor((y - 26) / 2)) % 2 ? 'k' : 'h');
  }
  g.text(Math.round((w - textW(text, false, 2)) / 2), 10, text, 'y', false, 2);
  return g.rows();
}
function makeChevron(dir) {
  const g = new Grid(26, 30);
  g.rect(0, 0, 26, 16, 'h').rect(1, 1, 24, 14, 'r');
  for (let k = 0; k < 2; k++) {
    const x0 = 4 + k * 9;
    for (let i = 0; i < 6; i++) g.rect(x0 + i, 2 + i, 3, 1, 'h').rect(x0 + i, 13 - i, 3, 1, 'h');
  }
  g.rect(12, 16, 2, 14, 'e');
  if (dir < 0) g.flipX();
  return g.rows();
}
function makeBillboard(l1, l2) {
  const w = Math.max(textW(l1), textW(l2)) + 12;
  const g = new Grid(w, 46);
  g.rect(0, 0, w, 28, 'q').rect(2, 2, w - 4, 24, 'n');
  g.text(Math.round((w - textW(l1)) / 2), 5, l1, 'w');
  g.text(Math.round((w - textW(l2)) / 2), 15, l2, 'y');
  g.rect(8, 28, 2, 18, 'e').rect(w - 10, 28, 2, 18, 'e');
  return g.rows();
}
function makePine() {
  const g = new Grid(26, 48);
  for (let tier = 0; tier < 4; tier++) {
    const y0 = 2 + tier * 9;
    const hh = 14;
    for (let j = 0; j < hh; j++) {
      const half = 2 + (j / hh) * (5 + tier * 2);
      for (let x = 0; x < 26; x++) {
        const d = x + 0.5 - 13;
        if (Math.abs(d) <= half) g.set(x, y0 + j, d < -half * 0.3 ? 'T' : 'F');
      }
    }
  }
  g.rect(12, 42, 2, 6, 'Z');
  return g.rows();
}
function makeHouse(seed) {
  const g = new Grid(46, 38);
  const rng = makeRng(seed);
  g.rect(3, 14, 40, 24, 'c').rect(3, 14, 40, 1, 'w');
  for (let j = 0; j < 12; j++) {
    const half = 6 + j * 1.45;
    g.rect(Math.round(23 - half), 2 + j, Math.round(half * 2), 1, j % 3 === 2 ? 'Q' : 'O');
  }
  g.rect(0, 13, 46, 2, 'Q');
  const win = (x, y) => g.rect(x, y, 6, 7, 'B').rect(x + 1, y + 1, 4, 5, rng() < 0.7 ? 'y' : 'n');
  win(7, 18);
  win(33, 18);
  win(7, 28);
  win(33, 28);
  g.rect(19, 26, 8, 12, 'B').rect(20, 27, 6, 11, 'Z');
  return g.rows();
}
function makeFlag() {
  const g = new Grid(14, 34);
  g.rect(1, 0, 1, 34, 'e');
  for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) g.set(2 + i, 1 + j, ((i >> 1) + (j >> 1)) % 2 ? 'k' : 'h');
  return g.rows();
}
function makePsBoard() {
  const g = new Grid(30, 34);
  g.rect(0, 0, 30, 18, 'h').rect(1, 1, 28, 16, 'r');
  g.text(Math.round((30 - textW('PS1')) / 2), 5, 'PS1', 'h');
  g.rect(14, 18, 2, 16, 'e');
  return g.rows();
}
function makePost() {
  const g = new Grid(4, 15);
  g.rect(0, 0, 4, 15, 'h').rect(3, 0, 1, 15, 'c').rect(0, 2, 4, 3, 'k').rect(1, 3, 2, 1, 'r');
  return g.rows();
}
const makeRock = () => lit(18, 10, ellipse(9, 6, 8.6, 5), 9, 6, 8.6, 5, { base: 'H', light: 'I', dark: 'E', rim: 'E', rimLight: 'I' });

const HEART = ['.rr.rr.', 'rprrrrr', 'rrrrrrR', '.rrrrR.', '..rRR..', '...R...'];

export const SPRITES = {
  // raccolta
  cheese: makeCheese(),
  broccoli: makeBroccoli(),
  grapes: makeGrapes(),
  tomato: makeTomato(),
  basil: makeBasil(),
  pineapple: makePineapple(),
  // traffico
  car1: makeCar('U', 'V'),
  car2: makeCar('N', 'P'),
  car3: makeCar('y', 'Y'),
  tractor: makeTractor(),
  // bordo strada
  cypress: makeCypress(56),
  cypressTall: makeCypress(70),
  vine: makeVine(),
  wall: makeWall(),
  bales: makeBales(),
  cow: makeCow(),
  crowd1: makeCrowd(1),
  crowd2: makeCrowd(2),
  crowd3: makeCrowd(3),
  pine: makePine(),
  rock: makeRock(),
  house1: makeHouse(3),
  house2: makeHouse(8),
  flag: makeFlag(),
  psboard: makePsBoard(),
  chevronL: makeChevron(-1),
  chevronR: makeChevron(1),
  signQuinto: makeSign('QUINTO'),
  signGrezzana: makeSign('GREZZANA'),
  signLessinia: makeSign('LESSINIA'),
  signVerona: makeSign('← VERONA', true),
  board1: makeBillboard('PIZZA VOGLIA', 'AL TAGLIO'),
  board2: makeBillboard('CHIAMA E ORDINA', '366 220 5988'),
  archStart: makeArch('PARTENZA · PS1 VALPANTENA', 'V'),
  archGrezzana: makeArch('CHECKPOINT · GREZZANA', 'P'),
  archLessinia: makeArch('CHECKPOINT · LESSINIA', 'P'),
  archFinish: makeArch('ARRIVO · PIZZA VOGLIA', 'R'),
  post: makePost(),
  heart: HEART,
};
const CAR_ROWS = makeRallyCar(false);
const CAR_ROWS_B = makeRallyCar(true);
const SIZE = {};
for (const [k, rows] of Object.entries(SPRITES)) SIZE[k] = { w: rows[0].length, h: rows.length };
const SOLID = new Set(['cypress', 'cypressTall', 'vine', 'wall', 'bales', 'cow', 'pine', 'rock', 'house1', 'house2', 'psboard', 'signQuinto', 'signGrezzana', 'signLessinia', 'signVerona', 'board1', 'board2', 'chevronL', 'chevronR', 'flag']);
const PLAYER_W = 64 * SPR;
const ITEM_MUL = 1.7;
const CAR_MUL = 1.45;
const SCENE_MUL = 2.2;
// gli archi attraversano la strada: scala propria
const ARCH = new Set(['archStart', 'archGrezzana', 'archLessinia', 'archFinish']);

/** Prodotti del territorio (e l'ananas). */
export const PRODUCTS = {
  cheese: { label: 'MONTE VERONESE DOP', pts: 500, sec: 1, color: 'y' },
  broccoli: { label: 'BROCCOLO DI NOVAGLIE', pts: 300, sec: 0.5, color: 'T' },
  grapes: { label: 'UVA', pts: 200, sec: 0, color: 'L' },
  tomato: { label: 'POMODORO', pts: 100, sec: 0, color: 'r' },
  basil: { label: 'BASILICO', pts: 100, sec: 0, color: 'g' },
  pineapple: { label: "L'ANANAS NO!", pts: 0, sec: -2, color: 'r' },
};

/* =====================================================================
   LA PROVA SPECIALE: QUINTO → GREZZANA → TORNANTI → LESSINIA → ARRIVO
   ===================================================================== */
function point(y, z) {
  return { world: { x: 0, y, z }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } };
}
/** Note del navigatore generate dalla geometria. */
export function paceNote(curve, len, hill) {
  const a = Math.abs(curve);
  if (a >= 1.5) {
    const dir = curve > 0 ? 'DESTRA' : 'SINISTRA';
    if (a >= 5.5) return `TORNANTE ${dir} - NON TAGLIARE`;
    const grade = a >= 4.5 ? '2' : a >= 3.5 ? '3' : a >= 2.5 ? '4' : '5';
    let t = `${dir} ${grade}`;
    if (len > 100) t += ' LUNGA';
    if (hill > 12) t += ' IN SALITA';
    else if (a >= 3.5) t += ' - NON TAGLIARE';
    return t;
  }
  return '';
}

function buildStage() {
  const segs = [];
  const notes = [];
  const items = [];
  const rng = makeRng(4646);
  let zone = 'valle';
  const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);
  const add = (curve, y) => {
    const n = segs.length;
    segs.push({ i: n, curve, zone, p1: point(lastY(), n * SEG), p2: point(y, (n + 1) * SEG), sprites: [], items: [], clip: H, mark: 0 });
  };
  const road = (enter, hold, leave, curve, hill = 0, note) => {
    const start = segs.length;
    const y0 = lastY();
    const y1 = y0 + hill * SEG;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(y0, y1, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / total));
    const text = note === undefined ? paceNote(curve, total, hill) : note;
    if (text) notes.push({ seg: start, text });
    return start;
  };
  const hairpins = [];

  // QUINTO: partenza e fondovalle tra vigneti e cipressi
  zone = 'valle';
  road(0, 72, 0, 0, 0, '');
  road(20, 50, 20, 2, 4);
  road(20, 70, 20, -3, 10);
  road(0, 30, 0, 0, 0, '');
  road(20, 30, 20, 4, -6);
  road(20, 30, 20, -4, 6);
  road(25, 40, 25, 1, 18, 'DRITTO IN SALITA - PIENO');
  road(15, 20, 15, 0, 26, 'DOSSO - NON FRENARE');
  road(15, 20, 15, 0, -26, '');
  road(25, 60, 25, 3, 0);
  road(0, 40, 0, 0, 0, '');
  road(20, 30, 20, -5, 4);
  road(20, 40, 20, -2, 0);
  const valleEnd = segs.length;
  // GREZZANA
  zone = 'paese';
  const cp1 = road(0, 50, 0, 0, 0, 'CHECKPOINT GREZZANA');
  road(20, 40, 20, 3, 8);
  road(15, 25, 15, 4, 0, 'DESTRA 3 IN PAESE');
  road(15, 25, 15, -4, 0, 'SINISTRA 3 - OCCHIO AI MURI');
  road(20, 40, 20, -3, 8);
  // I TORNANTI sopra Grezzana
  zone = 'tornanti';
  const tornStart = segs.length;
  for (let k = 0; k < 4; k++) {
    hairpins.push({ start: segs.length, dir: k % 2 ? -1 : 1 });
    road(10, 30, 10, k % 2 ? -6 : 6, 22);
    if (k < 3) road(10, 24, 10, 0, 12, '');
  }
  road(20, 40, 20, 3, 14);
  road(15, 30, 15, -3, 16);
  road(15, 30, 15, 3, 10);
  // LESSINIA: l'altopiano
  zone = 'lessinia';
  const cp2 = road(0, 50, 0, 0, 0, 'CHECKPOINT LESSINIA');
  road(25, 50, 25, -2, -8);
  road(25, 40, 25, 3, 12);
  road(15, 25, 15, 0, 30, 'GRAN DOSSO - PIENO!');
  road(15, 25, 15, 0, -30, '');
  road(20, 30, 20, -4, 0);
  road(20, 30, 20, 4, 0);
  road(15, 20, 15, 0, 22, 'DOSSO - TIENI DRITTO');
  road(15, 20, 15, 0, -22, '');
  road(20, 40, 20, -3, 0);
  road(30, 60, 30, -1, -10, '');
  // ARRIVO
  zone = 'arrivo';
  const fin = road(0, 40, 0, 0, 0, 'ULTIMO RETTILINEO - PIENO!');
  road(0, 190, 0, 0, 0, '');
  const startLine = START_SEG + 4;
  const finishSeg = fin + 28;
  const cps = [
    { seg: cp1 + 8, name: 'GREZZANA', bonus: 16 },
    { seg: cp2 + 8, name: 'LESSINIA', bonus: 15 },
  ];

  const spr = (n, kind, offset, mul) => {
    if (segs[n]) segs[n].sprites.push({ kind, offset, mul: mul ?? (ARCH.has(kind) ? 1 : SCENE_MUL) });
  };
  const item = (n, kind, offset) => {
    if (!segs[n]) return;
    const id = items.length;
    items.push({ id, seg: n, kind, offset });
    segs[n].items.push(id);
  };

  // linee a scacchi
  segs[startLine].mark = 1;
  segs[startLine + 1].mark = 2;
  segs[finishSeg].mark = 1;
  segs[finishSeg + 1].mark = 2;

  // scenografia per zona
  for (let n = 0; n < segs.length; n++) {
    const s = segs[n];
    const z = s.zone;
    const r = rng();
    if (n % 8 === 0 && n > startLine + 20 && Math.abs(n - finishSeg) > 30) {
      spr(n, 'post', -1.06);
      spr(n, 'post', 1.06);
    }
    if (z === 'valle') {
      if (n % 7 === 0) spr(n, r < 0.25 ? 'cypressTall' : 'cypress', (n % 14 ? -1 : 1) * (1.25 + rng() * 0.5));
      const vineSide = Math.floor(n / 160) % 2 ? -1 : 1;
      if (n % 4 === 2 && n > 30) spr(n, 'vine', vineSide * (1.5 + (n % 8 === 2 ? 0 : 0.9)));
      if (n % 41 === 20) spr(n, 'bales', -vineSide * 2.1);
      if (n < 70 && n % 12 === 6) spr(n, n % 24 ? 'house1' : 'house2', (n % 24 ? 1 : -1) * 2.3);
    } else if (z === 'paese') {
      if (n % 9 === 0) spr(n, rng() < 0.5 ? 'house1' : 'house2', (n % 18 ? 1 : -1) * (1.6 + rng() * 0.5));
      if (n % 13 === 4) spr(n, 'cypress', (n % 26 ? -1 : 1) * 1.3);
    } else if (z === 'tornanti') {
      if (n % 3 === 0) {
        spr(n, 'wall', -1.12);
        spr(n, 'wall', 1.12);
      }
      if (n % 11 === 5) spr(n, 'rock', (n % 22 ? 1 : -1) * 1.5);
      if (n % 8 === 2) spr(n, 'pine', (n % 16 ? -1 : 1) * (1.7 + rng() * 0.8));
    } else if (z === 'lessinia') {
      if (n % 6 === 0) spr(n, 'pine', (n % 12 ? -1 : 1) * (1.6 + rng() * 1.2));
      if (n % 23 === 7) spr(n, 'cow', (n % 46 ? 1 : -1) * (2 + rng() * 0.8));
      if (n % 5 === 1) spr(n, 'wall', (Math.floor(n / 120) % 2 ? -1 : 1) * 1.25);
      if (n % 31 === 15) spr(n, 'bales', (n % 62 ? -1 : 1) * 2.4);
    } else if (z === 'arrivo') {
      if (n % 4 === 0 && n < finishSeg + 30) {
        spr(n, ['crowd1', 'crowd2', 'crowd3'][n % 3], -1.6);
        spr(n, ['crowd2', 'crowd3', 'crowd1'][n % 3], 1.6);
      }
      if (n % 8 === 2 && n < finishSeg + 20) {
        spr(n, 'flag', -1.3);
        spr(n, 'flag', 1.3);
      }
      if (n % 6 === 3 && n > finishSeg + 30) spr(n, 'pine', (n % 12 ? -1 : 1) * 1.9);
    }
  }
  // tifosi ai tornanti e chevron in ingresso curva
  for (const hp of hairpins) {
    for (let k = 0; k < 10; k += 3) spr(hp.start + k, hp.dir > 0 ? 'chevronR' : 'chevronL', -hp.dir * 1.15);
    spr(hp.start + 22, 'crowd' + (1 + (hp.start % 3)), hp.dir * 1.7);
    spr(hp.start + 30, 'crowd' + (1 + ((hp.start + 1) % 3)), hp.dir * 1.8);
  }
  // partenza
  for (let n = 0; n < startLine + 24; n += 4) {
    spr(n, ['crowd1', 'crowd2', 'crowd3'][n % 3], -1.7);
    spr(n, ['crowd3', 'crowd1', 'crowd2'][n % 3], 1.7);
  }
  spr(START_SEG + 2, 'psboard', -1.2);
  spr(startLine, 'archStart', 0);
  spr(startLine + 6, 'signVerona', 1.25);
  spr(startLine + 22, 'signQuinto', 1.25);
  spr(150, 'board1', -1.3);
  spr(340, 'board2', 1.3);
  spr(560, 'board1', 1.3);
  spr(cp1 - 30, 'signGrezzana', 1.25);
  spr(cps[0].seg, 'archGrezzana', 0);
  for (let k = -12; k < 12; k += 4) {
    spr(cps[0].seg + k, 'crowd' + (1 + ((k + 12) % 3)), -1.7);
    spr(cps[1].seg + k, 'crowd' + (1 + ((k + 13) % 3)), 1.7);
  }
  spr(cp2 - 30, 'signLessinia', 1.25);
  spr(cps[1].seg, 'archLessinia', 0);
  spr(cps[1].seg + 140, 'board2', -1.3);
  spr(fin - 20, 'board1', 1.3);
  spr(finishSeg, 'archFinish', 0);

  // prodotti e ananas
  const lanes = [-0.5, 0.5];
  const lane = () => lanes[Math.floor(rng() * 2)];
  const rowOf = (n, kind, off, count = 3, gap = 6) => {
    for (let k = 0; k < count; k++) item(n + k * gap, kind, off);
  };
  for (let n = 100; n < valleEnd - 30; n += 52) {
    const k = rng();
    const off = lane();
    if (k < 0.22) {
      item(n, 'pineapple', off);
      rowOf(n + 8, 'tomato', -off, 2);
    } else if (k < 0.45) rowOf(n, 'grapes', off, 4, 5);
    else if (k < 0.6) item(n, 'cheese', 0);
    else if (k < 0.8) rowOf(n, 'tomato', off);
    else rowOf(n, 'basil', off);
  }
  for (let n = cp1 + 30; n < tornStart - 10; n += 40) {
    const off = lane();
    if (rng() < 0.35) item(n, 'pineapple', off);
    rowOf(n + 12, 'basil', -off, 3);
  }
  hairpins.forEach((hp, i) => {
    const off = lane();
    rowOf(hp.start + 52, 'broccoli', off, 2, 7);
    if (i % 2) item(hp.start + 46, 'pineapple', -off);
    if (i === 1) item(hp.start + 58, 'cheese', -off);
  });
  for (let n = cp2 + 30; n < fin - 20; n += 48) {
    const k = rng();
    const off = lane();
    if (k < 0.4) item(n, 'cheese', off);
    else if (k < 0.62) {
      item(n, 'pineapple', off);
      item(n + 10, 'cheese', -off);
    } else rowOf(n, 'basil', off);
  }
  rowOf(fin + 4, 'tomato', 0.5, 3, 5);

  // traffico
  const cars = [];
  for (let k = 0; k < 13; k++) {
    const sg = 190 + k * 140 + Math.floor(rng() * 50);
    if (sg > finishSeg - 70) break;
    const zz = segs[sg].zone;
    const kind = (zz === 'valle' || zz === 'lessinia') && rng() < 0.35 ? 'tractor' : ['car1', 'car2', 'car3'][Math.floor(rng() * 3)];
    cars.push({ z: sg * SEG, offset: rng() < 0.5 ? -0.5 : 0.5, speed: MAX_SPEED * (kind === 'tractor' ? 0.17 : 0.3 + rng() * 0.16), kind, phase: rng() * 6 });
  }

  notes.sort((a, b) => a.seg - b.seg);
  return { segs, notes, items, cars, checkpoints: cps, finishSeg, startLine, length: segs.length * SEG, zones: { cp1, cp2, tornStart, fin } };
}
export const STAGE = buildStage();
const segAt = (z) => STAGE.segs[clamp(Math.floor(z / SEG), 0, STAGE.segs.length - 1)];

/* =====================================================================
   STATO E SIMULAZIONE (logica pura)
   ===================================================================== */
export function createState({ seed = 1, demo = false, best = 0 } = {}) {
  const s = { seed, rng: makeRng(seed), demo, best, mode: 'title', events: [], particles: [], cars: [], taken: new Uint8Array(STAGE.items.length) };
  resetRun(s);
  s.mode = 'title';
  return s;
}

export function resetRun(s) {
  s.t = 0;
  s.position = START_SEG * SEG - PLAYER_Z;
  s.playerX = 0;
  s.speed = 0;
  s.steer = 0;
  s.braking = false;
  s.offroad = false;
  s.slip = 0;
  s.timeLeft = START_TIME;
  s.elapsed = 0;
  s.points = 0;
  s.cpIdx = 0;
  s.splits = [];
  s.finished = false;
  s.timeUp = false;
  s.newRecord = false;
  s.countdown = 0;
  s.spin = 0;
  s.shake = 0;
  s.flash = 0;
  s.crashCd = 0;
  s.note = null;
  s.noteIdx = 0;
  s.msg = null;
  s.pop = null;
  s.skyOffset = 0;
  s.hillOffset = 0;
  s.lastTick = 99;
  s.idle = 0;
  s.particles.length = 0;
  s.events.length = 0;
  s.taken.fill(0);
  s.cars = STAGE.cars.map((c) => ({ ...c }));
}

export function startRun(s) {
  resetRun(s);
  s.mode = 'playing';
  s.countdown = s.demo ? 0 : 3.2;
}

const NO_INPUT = { left: false, right: false, gas: false, brake: false, targetX: null };

/** Avanza la simulazione di `dt` secondi; restituisce gli eventi del passo. */
export function update(s, dt, input = NO_INPUT) {
  const ev = s.events;
  ev.length = 0;
  if (!(dt > 0)) return ev;
  dt = Math.min(dt, 0.05);
  s.t += dt;
  stepFx(s, dt);
  if (s.mode === 'gameover') {
    if (s.speed > 0) {
      s.speed = Math.max(0, s.speed + DECEL * 2.4 * dt);
      s.position = Math.min(s.position + s.speed * dt, STAGE.length - PLAYER_Z - SEG * 2);
    }
    moveCars(s, dt);
    return ev;
  }
  if (s.mode !== 'playing') return ev;
  moveCars(s, dt);
  if (s.countdown > 0) {
    const before = Math.ceil(s.countdown);
    s.countdown -= dt;
    const after = Math.ceil(s.countdown);
    if (after !== before) ev.push(after > 0 ? { type: 'beep', n: after } : { type: 'go' });
    if (s.countdown > 0) return ev;
    s.msg = { text: 'VIA!', sub: '', t: 1.1, color: 'g' };
  }
  drive(s, dt, input || NO_INPUT);
  return ev;
}

function moveCars(s, dt) {
  const end = STAGE.length - SEG * 4;
  for (const c of s.cars) {
    c.z = Math.min(end, c.z + c.speed * dt);
    c.offset = (c.offset > 0 ? 0.5 : -0.5) + Math.sin(s.t * 0.6 + c.phase) * 0.06;
  }
}

function drive(s, dt, input) {
  const st = STAGE;
  const ev = s.events;
  const pz0 = s.position + PLAYER_Z;
  const seg = segAt(pz0);
  const pct = s.speed / MAX_SPEED;
  const dx = dt * 2.2 * pct;
  let steer = 0;
  if (s.spin > 0) {
    s.spin = Math.max(0, s.spin - dt);
    steer = Math.sin(s.spin * 26) * 0.6;
  } else if (input.left || input.right) steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  else if (input.targetX != null && Number.isFinite(input.targetX)) {
    const d = input.targetX - s.playerX;
    steer = Math.abs(d) < 0.03 ? 0 : clamp(d * 5, -1, 1);
  }
  s.playerX += steer * dx;
  s.playerX -= dx * pct * seg.curve * CENTRIFUGAL;
  s.steer = approach(s.steer, steer, dt * 9);
  s.slip = Math.abs(seg.curve) * pct;
  s.braking = !!input.brake;
  if (s.braking) s.speed = accel(s.speed, BRAKE, dt);
  else if (input.gas) s.speed = accel(s.speed, ACCEL, dt);
  else s.speed = accel(s.speed, DECEL, dt);
  s.offroad = Math.abs(s.playerX) > 1;
  if (s.offroad && s.speed > OFF_LIMIT) s.speed = accel(s.speed, OFF_DECEL, dt);
  s.crashCd = Math.max(0, s.crashCd - dt);
  if (s.offroad && s.crashCd <= 0) {
    for (const sp of seg.sprites) {
      if (!SOLID.has(sp.kind)) continue;
      const sw = SIZE[sp.kind].w * SPR * sp.mul;
      const sx = sp.offset + (sw / 2) * Math.sign(sp.offset);
      if (overlap(s.playerX, PLAYER_W, sx, sw, 0.8)) {
        s.speed = Math.min(s.speed, MAX_SPEED / 6);
        s.playerX -= Math.sign(s.playerX) * 0.18;
        s.shake = 0.35;
        s.crashCd = 0.6;
        ev.push({ type: 'crash' });
        break;
      }
    }
  }
  s.playerX = clamp(s.playerX, -2.6, 2.6);
  s.speed = clamp(s.speed, 0, MAX_SPEED);
  s.position = Math.min(s.position + s.speed * dt, st.length - PLAYER_Z - SEG * 2);
  const pz1 = s.position + PLAYER_Z;

  // prodotti e ananas sui segmenti attraversati
  const i0 = Math.floor(pz0 / SEG);
  const i1 = Math.floor(pz1 / SEG);
  for (let i = i0; i <= i1; i++) {
    const sg = st.segs[i];
    if (!sg) continue;
    for (const id of sg.items) {
      if (s.taken[id]) continue;
      const it = st.items[id];
      if (overlap(s.playerX, PLAYER_W, it.offset, SIZE[it.kind].w * SPR * ITEM_MUL, 0.95)) pick(s, it);
    }
  }
  // auto lente
  for (const c of s.cars) {
    if (c.z < pz0 - SEG * 0.5 || c.z > pz1 + SEG * 0.6 || s.speed <= c.speed) continue;
    if (!overlap(s.playerX, PLAYER_W, c.offset, SIZE[c.kind].w * SPR * CAR_MUL, 0.8)) continue;
    s.speed = c.speed * 0.7;
    s.position = c.z - PLAYER_Z - SEG * 0.7;
    s.shake = 0.3;
    ev.push({ type: 'bump' });
  }

  // polvere, fumo e ritorni di fiamma (in coordinate schermo)
  if (s.offroad && s.speed > 300) {
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1;
      addParticle(s, W / 2 + side * (20 + s.rng() * 8), H - 3, side * (10 + s.rng() * 40), -12 - s.rng() * 34, s.rng() < 0.5 ? 'W' : 'b', 0.55, { g: 50, size: 2 });
    }
  } else if (s.slip > 2.4 && Math.abs(s.steer) > 0.5 && s.rng() < 0.6) {
    addParticle(s, W / 2 + (s.rng() < 0.5 ? -24 : 24), H - 2, (s.rng() - 0.5) * 30, -10 - s.rng() * 16, 'e', 0.5, { g: -6, size: 2 });
  }
  if (!input.gas && pct > 0.85 && s.rng() < 0.08) addParticle(s, W / 2 + 12, H - 5, 0, -6, s.rng() < 0.5 ? 'o' : 'y', 0.16, { g: 0, size: 2 });

  // cronometro e controlli
  s.elapsed += dt;
  s.timeLeft -= dt;
  const sec = Math.ceil(s.timeLeft);
  if (s.timeLeft <= 5 && s.timeLeft > 0 && sec !== s.lastTick) {
    s.lastTick = sec;
    ev.push({ type: 'tick', n: sec });
  }
  if (!input.gas && s.speed < MAX_SPEED * 0.05) s.idle += dt;
  else s.idle = 0;
  const cp = st.checkpoints[s.cpIdx];
  if (cp && pz1 >= cp.seg * SEG) {
    s.cpIdx++;
    s.timeLeft += cp.bonus;
    s.splits.push(s.elapsed);
    s.msg = { text: 'CHECKPOINT!', sub: `${cp.name} ${fmtTime(s.elapsed)}  +${cp.bonus} SEC`, t: 2.4, color: 'g' };
    ev.push({ type: 'checkpoint', name: cp.name, bonus: cp.bonus, split: s.elapsed });
  }
  if (pz1 >= st.finishSeg * SEG) {
    s.mode = 'gameover';
    s.finished = true;
    if (!s.demo && (!s.best || s.elapsed < s.best)) {
      s.best = s.elapsed;
      s.newRecord = true;
    }
    s.msg = null;
    s.note = null;
    ev.push({ type: 'finish', time: s.elapsed, best: s.best, newRecord: s.newRecord, points: s.points });
  } else if (s.timeLeft <= 0) {
    s.timeLeft = 0;
    s.mode = 'gameover';
    s.timeUp = true;
    s.msg = null;
    s.note = null;
    ev.push({ type: 'timeup', points: s.points, reached: reachedName(s) });
  }

  // note del navigatore
  while (s.noteIdx < st.notes.length && st.notes[s.noteIdx].seg - i1 < 48) {
    const nt = st.notes[s.noteIdx++];
    if (nt.seg - i1 >= -4) {
      s.note = { text: nt.text, t: 2.7 };
      ev.push({ type: 'note', text: nt.text });
    }
  }

  // parallasse
  const travelled = (pz1 - pz0) / SEG;
  s.skyOffset += 0.0011 * seg.curve * travelled;
  s.hillOffset += 0.0024 * seg.curve * travelled;
}

export function reachedName(s) {
  return s.cpIdx > 0 ? STAGE.checkpoints[s.cpIdx - 1].name : 'QUINTO';
}

function pick(s, it) {
  s.taken[it.id] = 1;
  const P = PRODUCTS[it.kind];
  if (it.kind === 'pineapple') {
    s.spin = 0.85;
    s.speed *= 0.5;
    s.timeLeft = Math.max(0, s.timeLeft - 2);
    s.shake = 0.4;
    s.flash = 0.12;
    s.pop = { title: "L'ANANAS NO!", sub: '-2 SEC', color: 'r', t: 1.4 };
    for (let k = 0; k < 14; k++) addParticle(s, W / 2 + (s.rng() - 0.5) * 30, H - 30, (s.rng() - 0.5) * 120, -40 - s.rng() * 80, s.rng() < 0.5 ? 'y' : 'o', 0.7, { g: 200 });
    s.events.push({ type: 'pineapple' });
    return;
  }
  s.points += P.pts;
  s.timeLeft += P.sec;
  s.pop = { title: P.label, sub: `+${P.pts}` + (P.sec ? `  +${P.sec} SEC` : ''), color: P.color, t: 1.4 };
  for (let k = 0; k < 10; k++) addParticle(s, W / 2 + (s.rng() - 0.5) * 24, H - 34, (s.rng() - 0.5) * 90, -50 - s.rng() * 70, ['y', 'h', P.color][k % 3], 0.6, { g: 220 });
  s.events.push({ type: 'pickup', kind: it.kind, pts: P.pts });
}

function addParticle(s, x, y, vx, vy, c, life, o = {}) {
  if (s.particles.length > 160) s.particles.shift();
  s.particles.push({ x, y, vx, vy, c, life, g: o.g ?? 120, size: o.size ?? 1 });
}
function stepFx(s, dt) {
  const ps = s.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) {
      ps[i] = ps[ps.length - 1];
      ps.pop();
      continue;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (const k of ['msg', 'pop', 'note']) {
    if (s[k]) {
      s[k].t -= dt;
      if (s[k].t <= 0) s[k] = null;
    }
  }
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
  if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
}

/** Pilota automatico (demo della schermata titolo e test). */
export function autopilot(s) {
  const st = STAGE;
  const pz = s.position + PLAYER_Z;
  const i = Math.floor(pz / SEG);
  let ahead = 0;
  for (let n = 3; n < 15; n++) ahead += st.segs[i + n] ? st.segs[i + n].curve : 0;
  ahead /= 12;
  let target = clamp(ahead * 0.05 + Math.sin(s.t * 0.35) * 0.28, -0.6, 0.6);
  search: for (let n = 5; n < 24; n++) {
    const sg = st.segs[i + n];
    if (!sg) break;
    for (const id of sg.items) {
      if (!s.taken[id] && st.items[id].kind !== 'pineapple') {
        target = st.items[id].offset;
        break search;
      }
    }
  }
  for (let n = 1; n < 16; n++) {
    const sg = st.segs[i + n];
    if (!sg) break;
    for (const id of sg.items) {
      const it = st.items[id];
      if (!s.taken[id] && it.kind === 'pineapple' && Math.abs(it.offset - target) < 0.5) target = it.offset > 0 ? it.offset - 1 : it.offset + 1;
    }
  }
  for (const c of s.cars) {
    const dz = c.z - pz;
    if (dz > -SEG && dz < SEG * 20 && Math.abs(c.offset - target) < 0.6) target = c.offset > 0 ? c.offset - 1 : c.offset + 1;
  }
  const brake = Math.abs(ahead) > 4 && s.speed > MAX_SPEED * 0.6;
  return { left: false, right: false, targetX: clamp(target, -0.8, 0.8), gas: !brake, brake };
}

/* =====================================================================
   RENDERER
   ===================================================================== */
function rowsToCanvas(cc, rows, solid = null, remap = null) {
  const h = rows.length;
  const w = rows[0].length;
  const c = cc(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      if (remap && remap[ch]) ch = remap[ch];
      const hex = solid || PAL[ch];
      if (!hex) continue;
      const [r, gg, b] = hexToRgb(hex);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

class PixelFont {
  constructor(cc) {
    this.cc = cc;
    this.cache = new Map();
  }
  glyph(ch, color, bold) {
    const key = ch + '|' + (Array.isArray(color) ? color.join(',') : color) + (bold ? '|b' : '');
    let c = this.cache.get(key);
    if (c) return c;
    const rows = GLYPHS[ch] || GLYPHS['?'];
    c = this.cc(bold ? 6 : 5, 7);
    const g = c.getContext('2d');
    for (let y = 0; y < 7; y++) {
      g.fillStyle = Array.isArray(color) ? (y < 4 ? color[0] : color[1]) : color;
      for (let x = 0; x < 5; x++) if (rows[y][x] === '#') g.fillRect(x, y, bold ? 2 : 1, 1);
    }
    this.cache.set(key, c);
    return c;
  }
  width(text, scale = 1, bold = false) {
    const n = [...normText(text)].length;
    return n ? (n * (bold ? 7 : 6) - 1) * scale : 0;
  }
  draw(g, text, x, y, o = {}) {
    const { color = PAL.w, scale = 1, align = 'left', bold = false, shadow = null, shadowOffset = 1, outline = null } = o;
    const s = normText(text);
    const w = this.width(s, scale, bold);
    const x0 = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
    const y0 = Math.round(y);
    if (outline) {
      this.run(g, s, x0 - 1, y0, outline, scale, bold);
      this.run(g, s, x0 + 1, y0, outline, scale, bold);
      this.run(g, s, x0, y0 - 1, outline, scale, bold);
      this.run(g, s, x0, y0 + 1, outline, scale, bold);
    }
    if (shadow) this.run(g, s, x0 + shadowOffset, y0 + shadowOffset, shadow, scale, bold);
    this.run(g, s, x0, y0, color, scale, bold);
    return w;
  }
  run(g, s, x, y, color, scale, bold) {
    const adv = (bold ? 7 : 6) * scale;
    const gw = (bold ? 6 : 5) * scale;
    let cx = x;
    for (const ch of s) {
      if (ch !== ' ') g.drawImage(this.glyph(ch, color, bold), cx, y, gw, 7 * scale);
      cx += adv;
    }
  }
}

/* cifre LED a 7 segmenti */
const SEG7 = { 0: 0x7e, 1: 0x30, 2: 0x6d, 3: 0x79, 4: 0x33, 5: 0x5b, 6: 0x5f, 7: 0x70, 8: 0x7f, 9: 0x7b, '-': 0x01, ' ': 0 };
function seg7(g, ch, x, y, w, t, hh, on, off) {
  const m = SEG7[ch] ?? 0;
  const rects = [
    [x + t, y, w - 2 * t, t],
    [x + w - t, y + t, t, hh],
    [x + w - t, y + 2 * t + hh, t, hh],
    [x + t, y + 2 * t + 2 * hh, w - 2 * t, t],
    [x, y + 2 * t + hh, t, hh],
    [x, y + t, t, hh],
    [x + t, y + t + hh, w - 2 * t, t],
  ];
  for (let i = 0; i < 7; i++) {
    const litSeg = m & (1 << (6 - i));
    if (!litSeg && !off) continue;
    g.fillStyle = litSeg ? on : off;
    g.fillRect(rects[i][0], rects[i][1], rects[i][2], rects[i][3]);
  }
}

/* colori della strada al tramonto */
const ROAD_C = ['#4c4664', '#443e5a'];
const RUMBLE_C = ['#fff4dc', '#ff3b3b'];
const LANE_C = '#fff4dc';
const GRASS_C = {
  valle: ['#2b5a3f', '#254f37'],
  paese: ['#30593d', '#2a4f36'],
  tornanti: ['#3b4a3e', '#344236'],
  lessinia: ['#316c46', '#2b5f3d'],
  arrivo: ['#316c46', '#2b5f3d'],
};
const FOG_C = '#5a2466';
const NEAR_BASE = '#21123f';

function buildSky(cc) {
  const c = cc(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const set = (x, y, hex) => {
    const [r, gg, b] = hexToRgb(hex);
    const i = (y * W + x) * 4;
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    d[i + 3] = 255;
  };
  const SKY = ['#060818', '#0a0c26', '#120f33', '#1c1240', '#2a144b', '#3d1653', '#561a5a', '#74205f', '#96295f', '#b8355c', '#d84a55', '#ef6a4a', '#ff8a3d'];
  for (let y = 0; y < H; y++) {
    const f = Math.pow(clamp(y / 124, 0, 1), 1.25) * (SKY.length - 1);
    const i0 = Math.floor(f);
    const fr = f - i0;
    for (let x = 0; x < W; x++) set(x, y, SKY[Math.min(SKY.length - 1, i0 + (fr > (BAYER4[y & 3][x & 3] + 0.5) / 16 ? 1 : 0))]);
  }
  const rng = makeRng(77);
  for (let k = 0; k < 46; k++) {
    const x = Math.floor(rng() * W);
    const y = 2 + Math.floor(rng() * 46);
    set(x, y, rng() < 0.2 ? '#ffd23f' : rng() < 0.5 ? '#fff4dc' : '#8d8bb3');
  }
  // sole synthwave a strisce
  const SUN = ['#fff1a6', '#ffe06a', '#ffd23f', '#ffb02e', '#ff8a3d', '#ff6a4f', '#ff4f6e', '#ff4fd8'];
  const cx = W / 2;
  const cy = 98;
  const r = 38;
  for (let y = cy - r; y < cy + 6; y++) {
    const rel = (y - (cy - r)) / (r + 6);
    if (y > cy - r * 0.45) {
      const k = y - (cy - r * 0.45);
      const gap = 1 + Math.floor(k / 6);
      if (k % 7 < gap) continue;
    }
    for (let x = cx - r; x < cx + r; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
      set(x, y, SUN[Math.min(SUN.length - 1, Math.floor(rel * SUN.length))]);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function buildLayer(cc, w, h, fn) {
  const c = cc(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const hex = fn(x, y);
      if (!hex) continue;
      const [r, gg, b] = hexToRgb(hex);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
const TAU = Math.PI * 2;
function buildFar(cc) {
  const w = 512;
  const h = 46;
  const top = (x) => Math.round(h - (22 + 9 * Math.sin((TAU * 3 * x) / w + 1) + 5 * Math.sin((TAU * 7 * x) / w + 2) + 3 * Math.sin((TAU * 17 * x) / w)));
  return buildLayer(cc, w, h, (x, y) => {
    const t = top(x);
    if (y < t) return null;
    if (y === t) return '#9a3a78';
    if (y < t + 3 && (x + y) % 3 === 0) return '#5a2366';
    return '#3a1a55';
  });
}
function buildNear(cc) {
  const w = 512;
  const h = 34;
  const top = (x) => Math.round(h - (13 + 5 * Math.sin((TAU * 2 * x) / w) + 4 * Math.sin((TAU * 5 * x) / w + 1) + 2 * Math.sin((TAU * 11 * x) / w + 3)));
  const rng = makeRng(31);
  const lights = new Set();
  for (let k = 0; k < 26; k++) lights.add(Math.floor(rng() * w) + ',' + Math.floor(rng() * 6));
  const cypress = [40, 47, 130, 300, 306, 420];
  return buildLayer(cc, w, h, (x, y) => {
    let t = top(x);
    for (const cx of cypress) if (Math.abs(x - cx) <= 1) t = Math.min(t, top(cx) - 9 + Math.abs(x - cx) * 3);
    if (y < t) return null;
    if (y === t) return '#3d2560';
    const dy = y - t;
    if (lights.has(x + ',' + (dy - 2)) && dy > 2) return '#ffd23f';
    if (dy > 2 && dy % 3 === 0 && (x + y) % 4 < 2) return '#2c1a4c';
    return NEAR_BASE;
  });
}

export class Renderer {
  constructor(ctx, cc) {
    this.g = ctx;
    this.cc = cc;
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    this.font = new PixelFont(cc);
    this.spr = {};
    for (const [k, rows] of Object.entries(SPRITES)) this.spr[k] = rowsToCanvas(cc, rows);
    this.cars = {};
    for (const [k, rows] of Object.entries({ S: CAR_ROWS, SB: CAR_ROWS_B })) {
      this.cars[k] = rowsToCanvas(cc, rows);
      this.cars[k.replace('S', 'L')] = rowsToCanvas(cc, leanRows(rows, -1));
      this.cars[k.replace('S', 'R')] = rowsToCanvas(cc, leanRows(rows, 1));
    }
    this.sky = buildSky(cc);
    this.far = buildFar(cc);
    this.near = buildNear(cc);
    this.fogCache = new Map();
    this.hy = H / 2;
    this.rand = makeRng(5);
    this.shownPts = 0;
  }

  fog(hex, level) {
    if (!level) return hex;
    const key = hex + level;
    let c = this.fogCache.get(key);
    if (!c) {
      c = mixHex(hex, FOG_C, (level / 6) * 0.82);
      this.fogCache.set(key, c);
    }
    return c;
  }

  render(s, o = {}) {
    const g = this.g;
    const st = STAGE;
    const reduced = !!o.reduced;
    const base = segAt(s.position);
    const basePct = (s.position % SEG) / SEG;
    const pz = s.position + PLAYER_Z;
    const pSeg = segAt(pz);
    const pPct = (pz % SEG) / SEG;
    const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
    const camY = playerY + CAM_H;

    // 1) proiezione (da vicino a lontano) con clipping per i dossi
    let x = 0;
    let dx = -(base.curve * basePct);
    let clipY = H;
    let top = H;
    const vis = [];
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = st.segs[base.i + n];
      if (!seg) break;
      this.project(seg.p1, s.playerX * ROAD_W - x, camY, s.position);
      this.project(seg.p2, s.playerX * ROAD_W - x - dx, camY, s.position);
      x += dx;
      dx += seg.curve;
      seg.clip = clipY;
      seg.n = n;
      if (seg.p1.camera.z <= CAM_D || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= clipY) continue;
      vis.push(seg);
      clipY = Math.max(0, Math.min(clipY, seg.p2.screen.y));
      top = clipY;
    }

    g.save();
    g.globalAlpha = 1;
    if (!reduced && s.shake > 0) {
      const a = Math.min(3, Math.ceil(s.shake * 9));
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.translate(Math.round((this.rand() * 2 - 1) * a), Math.round((this.rand() * 2 - 1) * a));
    }
    // 2) cielo e colline in parallasse
    this.drawBackground(s, top);
    // 3) strada a scanline
    for (const seg of vis) this.drawSegment(seg);
    // 4) sprite, auto e prodotti da lontano a vicino
    const buckets = new Map();
    for (const c of s.cars) {
      const idx = Math.floor(c.z / SEG);
      const n = idx - base.i;
      if (n <= 0 || n >= DRAW_DIST) continue;
      if (!buckets.has(idx)) buckets.set(idx, []);
      buckets.get(idx).push(c);
    }
    const last = Math.min(st.segs.length - 1, base.i + DRAW_DIST - 1);
    for (let i = last; i > base.i; i--) {
      const seg = st.segs[i];
      if (seg.p1.camera.z <= CAM_D) continue;
      const sc = seg.p1.screen.scale;
      for (const sp of seg.sprites) {
        const img = this.spr[sp.kind];
        const sx = seg.p1.screen.x + (sc * sp.offset * ROAD_W * W) / 2;
        this.drawSprite(img, sc, sx, seg.p1.screen.y, sp.offset === 0 ? -0.5 : sp.offset < 0 ? -1 : 0, -1, seg.clip, sp.mul);
      }
      for (const id of seg.items) {
        if (s.taken[id]) continue;
        const it = st.items[id];
        const img = this.spr[it.kind];
        const sx = seg.p1.screen.x + (sc * it.offset * ROAD_W * W) / 2;
        const bob = Math.sin(s.t * 6 + id) > 0 ? 1 : 0;
        this.drawSprite(img, sc, sx, seg.p1.screen.y - bob * sc * CAM_H * 2, -0.5, -1, seg.clip, ITEM_MUL);
      }
      const cars = buckets.get(i);
      if (cars) {
        for (const c of cars) {
          const p = (c.z % SEG) / SEG;
          const csc = lerp(seg.p1.screen.scale, seg.p2.screen.scale, p);
          const cx = lerp(seg.p1.screen.x, seg.p2.screen.x, p) + (csc * c.offset * ROAD_W * W) / 2;
          const cy = lerp(seg.p1.screen.y, seg.p2.screen.y, p);
          this.drawSprite(this.spr[c.kind], csc, cx, cy, -0.5, -1, seg.clip, CAR_MUL);
        }
      }
      if (seg === pSeg) this.drawPlayer(s, pSeg, pPct, reduced);
    }
    if (pSeg.i <= base.i) this.drawPlayer(s, pSeg, pPct, reduced);
    this.drawParticles(s);
    g.restore();

    // 5) HUD e messaggi
    if (o.hud) this.drawHud(s, reduced);
    if (o.overlay === 'title') this.drawTitle(o);
    else if (o.overlay === 'pause') this.drawPause(o);
    else if (o.overlay === 'gameover') this.drawFinish(s, o);
    if (!reduced && s.flash > 0) {
      g.globalAlpha = Math.min(0.4, s.flash * 3.2);
      g.fillStyle = '#ff3b3b';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }

  project(p, camX, camY, camZ) {
    p.camera.x = p.world.x - camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    const sc = CAM_D / p.camera.z;
    p.screen.scale = sc;
    p.screen.x = Math.round(W / 2 + (sc * p.camera.x * W) / 2);
    p.screen.y = Math.round(H / 2 - (sc * p.camera.y * H) / 2);
    p.screen.w = Math.round((sc * ROAD_W * W) / 2);
  }

  drawBackground(s, roadTop) {
    const g = this.g;
    g.drawImage(this.sky, 0, 0);
    const target = clamp(roadTop + 1, 60, 128);
    this.hy += (target - this.hy) * 0.3;
    const hy = Math.round(this.hy);
    const far = this.far;
    const fx = -Math.round(((((s.skyOffset % 1) + 1) % 1) * far.width));
    g.drawImage(far, fx, hy - far.height + 2);
    g.drawImage(far, fx + far.width, hy - far.height + 2);
    const near = this.near;
    const nx = -Math.round(((((s.hillOffset % 1) + 1) % 1) * near.width));
    g.drawImage(near, nx, hy - near.height + 6);
    g.drawImage(near, nx + near.width, hy - near.height + 6);
    g.fillStyle = NEAR_BASE;
    g.fillRect(0, hy + 6, W, H - hy - 6);
  }

  drawSegment(seg) {
    const g = this.g;
    const p1 = seg.p1.screen;
    const p2 = seg.p2.screen;
    const f = 1 - Math.exp(-((seg.n / DRAW_DIST) ** 2) * 3.4);
    const lvl = Math.min(6, Math.floor(f * 7));
    const dark = Math.floor(seg.i / RUMBLE) % 2;
    const grass = this.fog(GRASS_C[seg.zone][dark], lvl);
    const road = this.fog(ROAD_C[dark], lvl);
    const rumble = this.fog(RUMBLE_C[dark], lvl);
    const lane = dark ? null : this.fog(LANE_C, lvl);
    const y0 = Math.max(0, p2.y);
    const y1 = Math.min(seg.clip, p1.y);
    const span = p1.y - p2.y;
    for (let y = y0; y < y1; y++) {
      const t = (y + 0.5 - p2.y) / span;
      const cx = p2.x + (p1.x - p2.x) * t;
      const w = p2.w + (p1.w - p2.w) * t;
      const L = Math.round(cx - w);
      const R = Math.round(cx + w);
      const rw = Math.max(1, Math.round(w / 7));
      g.fillStyle = grass;
      g.fillRect(0, y, W, 1);
      g.fillStyle = rumble;
      g.fillRect(L - rw, y, rw, 1);
      g.fillRect(R, y, rw, 1);
      if (seg.mark) {
        const sq = (R - L) / 10;
        for (let k = 0; k < 10; k++) {
          g.fillStyle = (k + seg.mark) % 2 ? this.fog('#fff4dc', lvl) : this.fog('#140d22', lvl);
          g.fillRect(Math.round(L + k * sq), y, Math.ceil(sq), 1);
        }
      } else {
        g.fillStyle = road;
        g.fillRect(L, y, R - L, 1);
        if (lane) {
          const lw = Math.max(1, Math.round(w / 36));
          g.fillStyle = lane;
          g.fillRect(Math.round(cx - lw / 2), y, lw, 1);
        }
      }
    }
  }

  drawSprite(img, scale, x, y, ox, oy, clipY, mul = 1) {
    const k = scale * CAM_H * mul;
    const dw = img.width * k;
    const dh = img.height * k;
    if (dw < 0.8 || dh < 0.8) return;
    const dx = x + dw * ox;
    const dy = y + dh * oy;
    if (dx > W || dx + dw < 0) return;
    const clipH = clipY != null ? Math.max(0, dy + dh - clipY) : 0;
    if (clipH >= dh - 0.5) return;
    const sh = img.height * (1 - clipH / dh);
    this.g.drawImage(img, 0, 0, img.width, Math.max(1, sh), Math.round(dx), Math.round(dy), Math.max(1, Math.round(dw)), Math.max(1, Math.round(dh - clipH)));
  }

  drawPlayer(s, pSeg, pPct, reduced) {
    const g = this.g;
    const camY = lerp(pSeg.p1.camera.y, pSeg.p2.camera.y, pPct);
    const y = H / 2 - ((CAM_D / PLAYER_Z) * camY * H) / 2;
    const bounce = s.speed > 200 && !reduced ? (Math.floor(s.t * 16) % 2) * (s.offroad ? 2 : 1) : 0;
    const steer = s.spin > 0 ? (Math.floor(s.t * 18) % 2 ? 1 : -1) : s.steer;
    const key = (steer < -0.35 ? 'L' : steer > 0.35 ? 'R' : 'S') + (s.braking ? 'B' : '');
    const img = this.cars[key];
    const px = Math.round(W / 2 - img.width / 2);
    const py = Math.round(y - img.height - 2 - bounce);
    g.fillStyle = 'rgba(8,4,20,0.45)';
    g.fillRect(px + 4, py + img.height - 2, img.width - 8, 2);
    g.drawImage(img, px, py);
  }

  drawParticles(s) {
    const g = this.g;
    for (const p of s.particles) {
      if (p.life < 0.12 && Math.floor(p.life * 40) & 1) continue;
      g.fillStyle = PAL[p.c] || p.c;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  drawHud(s, reduced) {
    const g = this.g;
    const f = this.font;
    g.fillStyle = 'rgba(5,7,24,0.82)';
    g.fillRect(0, 0, W, 25);
    g.fillStyle = '#2a2f6a';
    g.fillRect(0, 25, W, 1);
    // tempo
    const warn = s.timeLeft <= 5 && s.mode === 'playing' && s.countdown <= 0;
    const blinkOff = warn && !reduced && Math.floor(s.t * 4) % 2 === 0;
    f.draw(g, 'TEMPO', 4, 2, { color: PAL.q });
    const tl = Math.max(0, s.timeLeft);
    const secs = Math.min(99, Math.floor(tl));
    const on = warn ? PAL.r : PAL.y;
    const off = 'rgba(255,210,63,0.12)';
    if (!blinkOff) {
      seg7(g, String(Math.floor(secs / 10)), 4, 10, 8, 2, 4, on, off);
      seg7(g, String(secs % 10), 14, 10, 8, 2, 4, on, off);
      g.fillStyle = on;
      g.fillRect(24, 22, 2, 2);
      seg7(g, String(Math.floor((tl * 10) % 10)), 28, 14, 5, 1, 3, on, off);
    }
    // avanzamento della prova
    const x0 = 66;
    const x1 = 190;
    const span = STAGE.finishSeg - STAGE.startLine;
    const prog = clamp((s.position + PLAYER_Z - STAGE.startLine * SEG) / (span * SEG), 0, 1);
    f.draw(g, 'PS1 VALPANTENA', (x0 + x1) / 2, 2, { color: PAL.e, align: 'center' });
    g.fillStyle = '#3a3f73';
    g.fillRect(x0, 15, x1 - x0, 2);
    g.fillStyle = PAL.g;
    g.fillRect(x0, 15, Math.round((x1 - x0) * prog), 2);
    for (const cp of STAGE.checkpoints) {
      const cx = x0 + Math.round(((cp.seg - STAGE.startLine) / span) * (x1 - x0));
      g.fillStyle = PAL.y;
      g.fillRect(cx, 12, 1, 8);
    }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
      g.fillStyle = (i + j) % 2 ? '#140d22' : '#fff4dc';
      g.fillRect(x1 + 1 + i, 12 + j * 2, 1, 2);
    }
    const mx = x0 + Math.round((x1 - x0) * prog);
    g.fillStyle = PAL.q;
    g.fillRect(mx - 1, 13, 3, 6);
    f.draw(g, 'Q', x0 - 7, 13, { color: PAL.e });
    // velocità e punti
    const kmh = Math.round((s.speed / MAX_SPEED) * KMH);
    const kStr = String(kmh).padStart(3, ' ');
    for (let i = 0; i < 3; i++) seg7(g, kStr[i], W - 52 + i * 7, 3, 5, 1, 3, PAL.g, 'rgba(54,209,122,0.12)');
    f.draw(g, 'KM/H', W - 4, 4, { color: PAL.e, align: 'right' });
    if (s.points < this.shownPts) this.shownPts = s.points;
    this.shownPts = Math.min(s.points, this.shownPts + Math.max(5, Math.ceil((s.points - this.shownPts) * 0.2)));
    const pw = f.draw(g, pad(this.shownPts, 5), W - 4, 15, { color: PAL.w, align: 'right' });
    f.draw(g, 'PT', W - 4 - pw - 4, 15, { color: PAL.q, align: 'right' });

    // note del navigatore
    if (s.note && s.mode === 'playing') {
      const tw = f.width(s.note.text);
      const bw = tw + 30;
      const bx = Math.round(W / 2 - bw / 2);
      g.fillStyle = 'rgba(5,7,24,0.82)';
      g.fillRect(bx, 29, bw, 13);
      g.fillStyle = PAL.q;
      g.fillRect(bx, 29, 22, 13);
      f.draw(g, 'NAV', bx + 3, 32, { color: '#140d22' });
      f.draw(g, s.note.text, bx + 26, 32, { color: PAL.y });
    }
    // prodotto raccolto
    if (s.pop) {
      const y = 48;
      f.draw(g, s.pop.title, W / 2, y, { color: PAL[s.pop.color] || PAL.y, align: 'center', outline: OUTLINE });
      f.draw(g, s.pop.sub, W / 2, y + 10, { color: PAL.w, align: 'center', outline: OUTLINE });
    }
    // messaggi grandi
    if (s.msg && !(s.msg.t < 0.25 && !reduced && Math.floor(s.msg.t * 16) & 1)) {
      f.draw(g, s.msg.text, W / 2, 70, { color: PAL[s.msg.color] || PAL.y, scale: 2, bold: true, align: 'center', outline: OUTLINE, shadow: OUTLINE, shadowOffset: 2 });
      if (s.msg.sub) f.draw(g, s.msg.sub, W / 2, 90, { color: PAL.w, align: 'center', outline: OUTLINE });
    }
    // conto alla rovescia con semaforo
    if (s.mode === 'playing' && s.countdown > 0) {
      const n = Math.ceil(s.countdown);
      // orologio di partenza: semaforo + cifra LED
      g.fillStyle = '#140d22';
      g.fillRect(W / 2 - 34, 40, 68, 62);
      g.fillStyle = '#3a3f73';
      g.fillRect(W / 2 - 34, 40, 68, 1);
      g.fillRect(W / 2 - 34, 101, 68, 1);
      for (let i = 0; i < 3; i++) {
        const litLamp = 3 - n >= i;
        g.fillStyle = litLamp ? PAL.r : '#3a1020';
        g.fillRect(W / 2 - 27 + i * 20, 46, 14, 10);
      }
      seg7(g, String(n), W / 2 - 10, 62, 20, 4, 11, PAL.y, 'rgba(255,210,63,0.1)');
    }
    if (s.mode === 'playing' && s.countdown <= 0 && s.idle > 1.6 && Math.floor(s.t * 2) % 2 === 0) {
      f.draw(g, 'TIENI PREMUTO ↑ PER ACCELERARE', W / 2, 112, { color: PAL.w, align: 'center', outline: OUTLINE });
    }
  }

  dim(a) {
    this.g.fillStyle = `rgba(6,8,26,${a})`;
    this.g.fillRect(0, 0, W, H);
  }

  checkers(x, y, w, h, sq = 2) {
    const g = this.g;
    for (let j = 0; j < h; j += sq) {
      for (let i = 0; i < w; i += sq) {
        g.fillStyle = ((i + j) / sq) % 2 ? '#140d22' : '#fff4dc';
        g.fillRect(x + i, y + j, sq, sq);
      }
    }
  }

  drawTitle(o) {
    const g = this.g;
    const f = this.font;
    const t = o.titleT || 0;
    this.dim(0.52);
    const page = o.reduced ? 0 : Math.floor(t / 7) % 2;
    if (page === 0) {
      const grad = [PAL.y, PAL.o];
      f.draw(g, 'PIZZA', W / 2, 12, { color: grad, scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 3 });
      f.draw(g, 'VOGLIA', W / 2, 40, { color: grad, scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 3 });
      this.checkers(W / 2 - 60, 69, 120, 4, 2);
      f.draw(g, 'PROVA SPECIALE VALPANTENA', W / 2, 78, { color: PAL.g, align: 'center', outline: OUTLINE });
      if (o.reduced || Math.floor(t * 2) % 2 === 0) f.draw(g, 'INSERISCI GETTONE', W / 2, 98, { color: PAL.w, align: 'center', outline: OUTLINE });
      f.draw(g, o.touch ? 'TOCCA LO SCHERMO O START' : 'CLICCA QUI O PREMI START', W / 2, 111, { color: PAL.y, align: 'center', outline: OUTLINE });
      f.draw(g, 'RECORD PS1 ' + fmtTime(o.best), W / 2, 128, { color: PAL.q, align: 'center', outline: OUTLINE });
      f.draw(g, 'AUTO N.46 · DENIS FA PIZZA DAL 2002', W / 2, 141, { color: PAL.e, align: 'center', outline: OUTLINE });
    } else {
      f.draw(g, 'BONUS', W / 2, 8, { color: [PAL.y, PAL.o], scale: 2, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 2 });
      f.draw(g, 'PRODOTTI DEL TERRITORIO', W / 2, 26, { color: PAL.g, align: 'center', outline: OUTLINE });
      const rows = ['cheese', 'broccoli', 'grapes', 'tomato', 'basil', 'pineapple'];
      const shown = Math.min(rows.length, Math.floor((t % 7) * 5));
      rows.forEach((k, i) => {
        if (i >= shown) return;
        const P = PRODUCTS[k];
        const y = 42 + i * 15;
        const img = this.spr[k];
        g.drawImage(img, 34 - Math.floor(img.width / 2), y + 3 - Math.floor(img.height / 2));
        const bad = k === 'pineapple';
        const label = bad ? 'ANANAS' : P.label;
        const lw = f.draw(g, label, 50, y, { color: bad ? PAL.r : PAL.w, outline: OUTLINE });
        const pts = bad ? '-2 SEC' : '+' + P.pts;
        const pw = f.width(pts);
        g.fillStyle = PAL.E;
        for (let dx = 50 + lw + 4; dx < 226 - pw - 4; dx += 3) g.fillRect(dx, y + 6, 1, 1);
        f.draw(g, pts, 226, y, { color: bad ? PAL.r : PAL.y, align: 'right', outline: OUTLINE });
      });
      if (shown >= rows.length) f.draw(g, 'CHECKPOINT = TEMPO EXTRA', W / 2, 136, { color: PAL.q, align: 'center', outline: OUTLINE });
    }
  }

  drawPause(o) {
    const g = this.g;
    const f = this.font;
    this.dim(0.7);
    f.draw(g, 'PAUSA', W / 2, 54, { color: [PAL.y, PAL.o], scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 3 });
    f.draw(g, o.touch ? 'TOCCA PER CONTINUARE' : 'PREMI P PER CONTINUARE', W / 2, 96, { color: PAL.w, align: 'center', outline: OUTLINE });
    f.draw(g, 'IL NAVIGATORE TI ASPETTA', W / 2, 112, { color: PAL.g, align: 'center', outline: OUTLINE });
  }

  drawFinish(s, o) {
    const g = this.g;
    const f = this.font;
    this.dim(0.62);
    const free = clamp(o.overTop ?? H, 96, H);
    const y = Math.max(6, Math.round((free - 84) / 2));
    if (s.finished) {
      this.checkers(16, y, 24, 16, 4);
      this.checkers(W - 40, y, 24, 16, 4);
      f.draw(g, 'ARRIVO!', W / 2, y, { color: [PAL.y, PAL.o], scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 3 });
      f.draw(g, 'TEMPO DI PROVA ' + fmtTime(s.elapsed), W / 2, y + 32, { color: PAL.w, align: 'center', outline: OUTLINE });
      f.draw(g, 'RECORD ' + fmtTime(s.best || s.elapsed), W / 2, y + 44, { color: PAL.q, align: 'center', outline: OUTLINE });
      if (s.newRecord && (o.reduced || Math.floor((o.clock || 0) * 3) % 2 === 0)) f.draw(g, 'NUOVO RECORD!', W / 2, y + 56, { color: PAL.y, align: 'center', outline: OUTLINE });
    } else {
      f.draw(g, 'TEMPO', W / 2, y, { color: [PAL.r, '#e02a3c'], scale: 2, bold: true, align: 'center', outline: OUTLINE, shadow: '#5a0f1e', shadowOffset: 2 });
      f.draw(g, 'SCADUTO', W / 2, y + 16, { color: [PAL.r, '#e02a3c'], scale: 2, bold: true, align: 'center', outline: OUTLINE, shadow: '#5a0f1e', shadowOffset: 2 });
      f.draw(g, 'ULTIMO PASSAGGIO: ' + reachedName(s), W / 2, y + 40, { color: PAL.w, align: 'center', outline: OUTLINE });
      f.draw(g, 'SERVE PIU GAS... O UNA PIZZA', W / 2, y + 52, { color: PAL.e, align: 'center', outline: OUTLINE });
    }
    f.draw(g, 'PRODOTTI ' + s.points + ' PT', W / 2, y + 70, { color: PAL.g, align: 'center', outline: OUTLINE });
  }
}

/* =====================================================================
   ICONE PIXEL PER LA PAGINA (menu, recensioni, territorio, feste)
   ===================================================================== */
function makeSliceIcon() {
  const g = new Grid(14, 11);
  g.rect(0, 0, 14, 6, 'C').rect(0, 0, 14, 1, 'D').rect(0, 0, 1, 6, 'D');
  g.rect(1, 1, 12, 4, 'r');
  for (const [x, y] of [[3, 2], [4, 2], [8, 3], [9, 3], [11, 2]]) g.set(x, y, 'w');
  for (const [x, y] of [[6, 1], [10, 1], [2, 4]]) g.set(x, y, 'g');
  g.rect(0, 6, 14, 4, 't');
  for (const [x, y] of [[2, 7], [5, 8], [8, 7], [11, 8], [4, 6]]) g.set(x, y, 'M');
  g.rect(0, 10, 14, 1, 'K');
  return g.rows();
}
function makeFlagIcon() {
  const g = new Grid(13, 13);
  g.rect(0, 0, 1, 13, 'e');
  for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) g.set(1 + i, j + (i > 3 && i < 9 ? 1 : 0), ((i >> 1) + (j >> 1)) % 2 ? 'k' : 'h');
  return g.rows();
}
function makeHelmet() {
  return [
    '....wwwww...',
    '..wwwwwwwww.',
    '.wwrrrrrwwww',
    'wwrrrrrrrwww',
    'wwnnnnnnnrww',
    'wwnunnnnnrww',
    'wwnnnnnnrrww',
    'wwwggggggwww',
    'wwwwwwwwwwww',
    '.wwwwwwwwwk.',
    '..kkkkkkkk..',
  ];
}
export const ICONS = {
  trophy: [
    '..YyyyyyyY..',
    'YYyhyyyyyyYY',
    'Y.yhyyyyyY.Y',
    'Y.yhyyyyyY.Y',
    '.YyyyyyyyYY.',
    '..YyyyyyY...',
    '....yyY.....',
    '.....yY.....',
    '....yyYY....',
    '...YyyyyY...',
    '..YYYYYYYY..',
  ],
  star: [
    '......y......',
    '.....yhy.....',
    '.....yhy.....',
    '....yhyyY....',
    'yyyyyhyyyyyyY',
    '.yyhyyyyyyyY.',
    '..yyyyyyyyY..',
    '...yyyyyyY...',
    '...yyyyyyY...',
    '..yyyyYyyyY..',
    '..yyyY.YyyY..',
    '.yyY.....YyY.',
    '.YY.......YY.',
  ],
  slice: makeSliceIcon(),
  wheel: makeCheese(),
  broccoli: makeBroccoli(),
  grapes: makeGrapes(),
  flag: makeFlagIcon(),
  helmet: makeHelmet(),
  shop: [
    '............',
    '.rwrwrwrwrw.',
    'rwrwrwrwrwrw',
    'RRRRRRRRRRRR',
    '.R.R.R.R.R..',
    '.eeeeeeeeee.',
    '.eyyye.eEEe.',
    '.eyyye.eEEe.',
    '.eeeee.eEye.',
    '.eeeee.eEEe.',
    'EEEEEEEEEEEE',
  ],
  glass: [
    '.........yo.',
    '..e.....yoo.',
    '..eooooooOe.',
    '..ehoooooOe.',
    '...ehoooOe..',
    '....eooOe...',
    '.....eee....',
    '......e.....',
    '......e.....',
    '......e.....',
    '....eeeee...',
  ],
  balloon: [
    '...qqqq.....',
    '..qhqqqq....',
    '.qhqqqqqq...',
    '.qqqqqqqq...',
    '.qqqqqqqq...',
    '..qqqqqq....',
    '...qqqq.....',
    '....qq......',
    '....e.......',
    '.....e......',
    '....e.......',
    '.....e......',
  ],
  cake: [
    '.....y......',
    '....yoy.....',
    '.....w......',
    '.....w......',
    '..wwwwwwww..',
    '.wqwwqwwqww.',
    '.qqqqqqqqqq.',
    '.wwwwwwwwww.',
    '.qqqqqqqqqq.',
    '.BBBBBBBBBB.',
  ],
  briefcase: [
    '....BBBB....',
    '....B..B....',
    '.bbbbbbbbbb.',
    '.btttttttbB.',
    '.bbbbyybbbB.',
    '.BBBBYYBBBB.',
    '.bbbbbbbbbB.',
    '.bbbbbbbbbB.',
    '.BBBBBBBBBB.',
  ],
  toque: [
    '...hw.hww...',
    '..hwwhwwww..',
    '.hwwwwwwwwc.',
    '.wwwwwwwwwc.',
    '..wwwwwwwc..',
    '..wwwwwwwc..',
    '..cwcwcwcc..',
    '..wwwwwwwc..',
    '..cccccccc..',
  ],
};

export function spriteCanvas(name, cc) {
  const rows = ICONS[name] || SPRITES[name];
  return rows ? rowsToCanvas(cc, rows) : null;
}
/** L'auto n. 46 da usare nella pagina (vista posteriore). */
export function carCanvas(cc) {
  return rowsToCanvas(cc, CAR_ROWS);
}

const ICON_TOP = {
  mozz: ['hw.', 'wwc', '.c.'],
  basil: ['.g', 'gG'],
  salame: ['sS.', 'sfS', '.S.'],
  garlic: ['w'],
  oregano: ['G'],
  ham: ['jj.', 'jJj'],
  mushroom: ['tbb', '.m.'],
  olive: ['ln', 'nl'],
  artichoke: ['.a.', 'aAa'],
  gorgonzola: ['uw', 'wu'],
  shaving: ['yt'],
  bufala: ['.hw.', 'hwww', 'wwwc', '.wc.'],
  zucchini: ['gvg'],
  pepper: ['yyo'],
  pepperR: ['rrR'],
  eggplant: ['zz', 'zl'],
  potato: ['tt', 'tb'],
  rosemary: ['G.', '.G'],
  flake: ['o'],
  broccoli: ['gvg', 'GgG', '.G.'],
  tarallo: ['bbb', 'b.b', 'bbb'],
  salt: ['h'],
};
const ICON_PAL_EXTRA = { s: '#d93a4c', S: '#8c1c30', f: '#ffc9c0' };

/** Icona-pizza pixel (24×24): sempre rettangolare, al taglio. */
export function pizzaIcon(spec, cc, size = 24) {
  const S = size;
  const px = new Array(S * S).fill(null);
  const area = [];
  const set = (x, y, k) => {
    if (x >= 0 && y >= 0 && x < S && y < S) px[y * S + x] = k;
  };
  const rng = makeRng(hashStr(spec.id || JSON.stringify(spec)));
  const baseKey = spec.base === 'white' ? 'w' : spec.base === 'cheese' ? 'y' : 'r';
  const baseShade = spec.base === 'white' ? 'c' : spec.base === 'cheese' ? 'Y' : 'R';
  const tray = (x0, y0, w, h, band) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1;
        if (edge) set(x, y, y === y0 || x === x0 ? 'D' : 'C');
        else {
          set(x, y, x > x0 + w - 4 && y > y0 + h - 4 ? baseShade : baseKey);
          if (x > x0 + 1 && x < x0 + w - 2 && y > y0 + 1 && y < y0 + h - 2) area.push([x, y]);
        }
      }
    }
    for (let x = x0; x < x0 + w; x++) {
      for (let j = 0; j < band; j++) set(x, y0 + h + j, j === band - 1 ? 'Q' : (x * 7 + j * 3) % 5 === 0 ? 'M' : 't');
      set(x, y0 + h + band, 'K');
    }
  };
  if (spec.shape === 'slice') tray(1, 6, S - 2, S - 14, 2);
  else if (spec.shape === 'square') tray(3, 3, S - 6, S - 10, 3);
  else if (spec.shape === 'calzone') {
    const x0 = 2;
    const y0 = 8;
    const w = S - 4;
    const h = 11;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const corner = (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1);
        if (corner) continue;
        let k = y < y0 + 3 ? 'D' : y > y0 + h - 3 ? 'K' : 'C';
        if (y === y0 + 1 && x % 2 === 0) k = 'K';
        if (y === y0 + 4 && x > x0 + 1 && x < x0 + w - 2) k = 'K';
        set(x, y, k);
      }
    }
    for (const [x, y] of [[7, 3], [8, 2], [7, 1], [13, 4], [14, 3], [13, 2], [17, 5], [18, 4]]) set(x, y, 'e');
  } else if (spec.shape === 'focaccia') {
    const x0 = 2;
    const y0 = 5;
    const w = S - 4;
    const h = S - 10;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1;
        let k = edge ? (y === y0 || x === x0 ? 'D' : 'K') : (x + y) % 9 === 0 ? 'D' : 'C';
        if (!edge && (x - x0) % 4 === 2 && (y - y0) % 4 === 2) k = 'K';
        set(x, y, k);
        if (!edge && x > x0 + 1 && y > y0 + 1 && x < x0 + w - 2 && y < y0 + h - 2) area.push([x, y]);
      }
    }
    for (let x = x0; x < x0 + w; x++) set(x, y0 + h, 'Q');
  } else if (spec.shape === 'tray') {
    const x0 = 1;
    const y0 = 6;
    const w = S - 2;
    const h = 13;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, x === x0 || x === x0 + w - 1 || y === y0 + h - 1 ? 'E' : 'e');
    for (let x = x0; x < x0 + w; x++) set(x, y0 + h, 'E');
    const cols = ['r', 'y', 'g'];
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 3; i++) {
        const sx = x0 + 2 + i * 7;
        const sy = y0 + 2 + j * 5;
        for (let y = sy; y < sy + 4; y++) for (let x = sx; x < sx + 6; x++) set(x, y, y === sy || x === sx ? 'D' : x === sx + 5 || y === sy + 3 ? 'K' : cols[(i + j) % 3]);
        set(sx + 2, sy + 1, (i + j) % 2 ? 'w' : 'G');
        set(sx + 3, sy + 2, 'w');
      }
    }
  }
  const taken = new Set();
  const inArea = new Set(area.map(([x, y]) => y * S + x));
  for (const [kind, count] of spec.top || []) {
    const art = ICON_TOP[kind];
    if (!art) continue;
    const aw = art[0].length;
    const ah = art.length;
    for (let n = 0; n < count; n++) {
      for (let tries = 0; tries < 40; tries++) {
        const [ax, ay] = area[Math.floor(rng() * area.length)] || [0, 0];
        const ox = ax - (aw >> 1);
        const oy = ay - (ah >> 1);
        let ok = true;
        for (let j = 0; j < ah && ok; j++) {
          for (let i = 0; i < aw; i++) {
            if (art[j][i] === '.') continue;
            const key = (oy + j) * S + (ox + i);
            if (taken.has(key) || !inArea.has(key)) {
              ok = false;
              break;
            }
          }
        }
        if (!ok && tries < 39) continue;
        for (let j = 0; j < ah; j++) {
          for (let i = 0; i < aw; i++) {
            if (art[j][i] === '.') continue;
            set(ox + i, oy + j, art[j][i]);
            taken.add((oy + j) * S + (ox + i));
            taken.add((oy + j) * S + (ox + i + 1));
          }
        }
        break;
      }
    }
  }
  const rows = [];
  for (let y = 0; y < S; y++) {
    let row = '';
    for (let x = 0; x < S; x++) row += px[y * S + x] || '.';
    rows.push(row);
  }
  const c = cc(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  rows.forEach((row, y) => {
    for (let x = 0; x < S; x++) {
      const ch = row[x];
      const hex = ICON_PAL_EXTRA[ch] || PAL[ch];
      if (ch === '.' || !hex) continue;
      const [r, gg, b] = hexToRgb(hex);
      const i = (y * S + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  });
  g.putImageData(img, 0, 0);
  return c;
}

/* =====================================================================
   AUDIO 8-BIT + MOTORE (WebAudio, solo dopo un gesto dell'utente)
   ===================================================================== */
const NOTE = { G3: 196, C4: 261.63, E4: 329.63, G4: 392, A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.51, G6: 1567.98 };

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.eng = null;
    this.on = false;
  }
  get supported() {
    return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  }
  enable() {
    if (!this.supported) return false;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.on = true;
    } catch (err) {
      this.on = false;
    }
    return this.on;
  }
  disable() {
    this.on = false;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
  noiseBuffer() {
    if (!this.noise) {
      const c = this.ctx;
      const len = Math.floor(c.sampleRate * 0.8);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }
  tone(type, f0, f1, at, dur, vol = 0.3) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.03);
  }
  hiss(at, dur, vol, f0, f1) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(at);
    src.stop(at + dur + 0.02);
  }
  /** Motore: dente di sega + sub-oscillatore, filtrati, con il rumore della ghiaia. */
  engine(running, pct = 0, offroad = false) {
    if (!this.on || !this.ctx) return;
    try {
      const c = this.ctx;
      if (!this.eng) {
        if (!running) return;
        const o1 = c.createOscillator();
        o1.type = 'sawtooth';
        const o2 = c.createOscillator();
        o2.type = 'square';
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 5;
        const g = c.createGain();
        g.gain.value = 0;
        const g2 = c.createGain();
        g2.gain.value = 0.35;
        o1.connect(f);
        o2.connect(g2);
        g2.connect(f);
        f.connect(g);
        g.connect(this.master);
        const ns = c.createBufferSource();
        ns.buffer = this.noiseBuffer();
        ns.loop = true;
        const nf = c.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.value = 900;
        nf.Q.value = 0.7;
        const ng = c.createGain();
        ng.gain.value = 0;
        ns.connect(nf);
        nf.connect(ng);
        ng.connect(this.master);
        o1.start();
        o2.start();
        ns.start();
        this.eng = { o1, o2, f, g, ng };
      }
      const e = this.eng;
      const t = c.currentTime;
      const freq = 46 + pct * 160;
      e.o1.frequency.setTargetAtTime(freq, t, 0.06);
      e.o2.frequency.setTargetAtTime(freq / 2, t, 0.06);
      e.f.frequency.setTargetAtTime(280 + pct * 1500, t, 0.08);
      e.g.gain.setTargetAtTime(running ? 0.12 + pct * 0.08 : 0, t, 0.08);
      e.ng.gain.setTargetAtTime(running && offroad ? 0.2 * Math.min(1, pct * 2) : 0, t, 0.05);
    } catch (err) {
      /* nessun motore: si guida in silenzio */
    }
  }
  play(name, arg = 0) {
    if (!this.on || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + 0.01;
      const arp = (notes, step, dur, vol = 0.24, type = 'square') => notes.forEach((f, i) => this.tone(type, f, f, t + i * step, dur, vol));
      switch (name) {
        case 'beep':
          this.tone('square', NOTE.A4, NOTE.A4, t, 0.16, 0.26);
          break;
        case 'go':
          this.tone('square', NOTE.A5, NOTE.A5, t, 0.45, 0.28);
          break;
        case 'tick':
          this.tone('square', NOTE.E6, NOTE.E6, t, 0.05, 0.16);
          break;
        case 'pickup': {
          const f0 = arg >= 500 ? NOTE.C6 : arg >= 300 ? NOTE.G5 : NOTE.E5;
          this.tone('square', f0, f0, t, 0.05, 0.22);
          this.tone('square', f0 * 1.5, f0 * 1.5, t + 0.05, 0.08, 0.2);
          if (arg >= 300) this.tone('square', f0 * 2, f0 * 2, t + 0.11, 0.1, 0.18);
          break;
        }
        case 'pineapple':
          this.hiss(t, 0.35, 0.5, 2400, 160);
          [NOTE.C6, NOTE.G5, NOTE.E5, NOTE.C5].forEach((f, i) => this.tone('square', f, f * 0.94, t + i * 0.06, 0.07, 0.2));
          break;
        case 'crash':
          this.hiss(t, 0.4, 0.6, 1800, 90);
          this.tone('square', 180, 50, t, 0.3, 0.28);
          break;
        case 'bump':
          this.hiss(t, 0.18, 0.45, 1400, 200);
          this.tone('triangle', 150, 80, t, 0.14, 0.3);
          break;
        case 'checkpoint':
          arp([NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6], 0.07, 0.12, 0.22);
          break;
        case 'finish':
          arp([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.1, 0.14, 0.24);
          this.tone('square', NOTE.E6, NOTE.E6, t + 0.42, 0.5, 0.24);
          this.tone('triangle', NOTE.C5, NOTE.C5, t + 0.42, 0.5, 0.3);
          break;
        case 'timeup':
          [NOTE.G4, NOTE.E4, NOTE.C4, NOTE.G3].forEach((f, i) => this.tone('square', f, f, t + i * 0.22, i === 3 ? 0.7 : 0.2, 0.24));
          break;
        case 'start':
          this.tone('square', NOTE.B5, NOTE.B5, t, 0.08, 0.24);
          this.tone('square', NOTE.E6, NOTE.E6, t + 0.08, 0.42, 0.24);
          break;
        case 'note':
          this.tone('triangle', 1200, 900, t, 0.04, 0.12);
          break;
        case 'pause':
          this.tone('square', NOTE.E5, NOTE.E5, t, 0.06, 0.2);
          this.tone('square', NOTE.C5, NOTE.C5, t + 0.07, 0.08, 0.2);
          break;
        case 'select':
          this.tone('square', 880, 1320, t, 0.07, 0.18);
          break;
        case 'power':
          arp([NOTE.C5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6], 0.06, 0.08, 0.2);
          break;
        default:
          break;
      }
    } catch (err) {
      /* audio non disponibile */
    }
  }
}

/* =====================================================================
   CONTROLLER DOM
   ===================================================================== */
export const RECORD_KEY = 'pizzavoglia-ps1-record';
export function readRecord() {
  try {
    const v = parseFloat(window.localStorage.getItem(RECORD_KEY));
    return v > 0 ? v : 0;
  } catch (err) {
    return 0;
  }
}
function writeRecord(v) {
  try {
    window.localStorage.setItem(RECORD_KEY, String(v));
  } catch (err) {
    /* storage non disponibile */
  }
}

/**
 * Monta il gioco nel cabinato.
 * @param {object} el  { cabinet, screen, canvas, start, left, right, brake, over, replay, live }
 * @param {object} opt { sfx, reducedMotion }
 */
export function mountGame(el, opt = {}) {
  const { cabinet, screen, canvas } = el;
  const reduced = !!opt.reducedMotion;
  const sfx = opt.sfx || new Sfx();
  const cc = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const buffer = cc(W, H);
  const bctx = buffer.getContext('2d');
  const renderer = new Renderer(bctx, cc);
  const dctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  let best = readRecord();
  const game = createState({ seed: (Date.now() ^ 0x5f3759df) >>> 0, best });
  let demo = newDemo();
  let demoWait = 0;
  let titleT = 0;
  let clock = 0;
  let overAt = 0;
  let raf = 0;
  let last = 0;
  let inView = true;
  let pageVisible = !document.hidden;
  let lastDir = 0;
  let autoGas = touch;
  const keys = { left: false, right: false, gas: false, brake: false };
  const btn = { left: false, right: false, brake: false };
  let pointerX = null;
  let pointerId = null;
  let overTop = H;

  function newDemo() {
    const d = createState({ seed: 20020 + Math.floor(Math.random() * 9999), demo: true });
    startRun(d);
    for (let i = 0; i < 90; i++) update(d, 1 / 60, autopilot(d));
    d.particles.length = 0;
    d.msg = null;
    d.pop = null;
    return d;
  }

  function say(msg) {
    if (!el.live || !msg) return;
    el.live.textContent = '';
    window.setTimeout(() => {
      el.live.textContent = msg;
    }, 40);
  }

  function setMode() {
    cabinet.dataset.mode = game.mode;
    canvas.classList.toggle('is-playing', game.mode === 'playing');
    if (el.start) {
      const label = game.mode === 'playing' ? 'PAUSA' : game.mode === 'paused' ? 'RIPRENDI' : 'START';
      const aria = game.mode === 'playing' ? 'Metti in pausa' : game.mode === 'paused' ? 'Riprendi la prova' : 'Inizia la prova speciale';
      const span = el.start.querySelector('[data-label]');
      if (span) span.textContent = label;
      el.start.setAttribute('aria-label', aria);
    }
    if (el.over) el.over.hidden = game.mode !== 'gameover';
  }

  function measureOver() {
    overTop = H;
    if (!el.over || el.over.hidden) return;
    const r = canvas.getBoundingClientRect();
    const b = el.over.querySelector('button, a');
    if (!r.height || !b) return;
    overTop = ((b.getBoundingClientRect().top - r.top) / r.height) * H - 4;
  }

  function fit() {
    const avail = screen.clientWidth;
    if (!avail) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const wide = window.matchMedia('(min-width: 960px)').matches;
    const maxH = wide ? Math.max(220, window.innerHeight - 350) : Infinity;
    let s = Math.min(avail / W, maxH / H);
    const dev = s * dpr;
    let k = Math.max(1, Math.ceil(dev - 0.001));
    const fl = Math.floor(dev + 0.001);
    if (fl >= 1 && fl / dev >= 0.9) {
      s = fl / dpr;
      k = fl;
    }
    k = Math.min(k, 4);
    canvas.style.imageRendering = k + 0.001 < s * dpr ? 'pixelated' : 'auto';
    if (canvas.width !== W * k || canvas.height !== H * k) {
      canvas.width = W * k;
      canvas.height = H * k;
    }
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
    cabinet.style.setProperty('--px', `${s}px`);
    measureOver();
    draw();
  }

  function input() {
    const left = keys.left || btn.left;
    const right = keys.right || btn.right;
    return {
      left,
      right,
      gas: keys.gas || autoGas,
      brake: keys.brake || btn.brake,
      targetX: left || right ? null : pointerX,
    };
  }

  function draw() {
    const o = { reduced, touch, clock, titleT, overTop, best };
    if (game.mode === 'title') renderer.render(demo, { ...o, hud: false, overlay: 'title' });
    else renderer.render(game, { ...o, hud: game.mode !== 'gameover', overlay: game.mode === 'paused' ? 'pause' : game.mode === 'gameover' ? 'gameover' : null });
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  }

  function tick(dt) {
    clock += dt;
    if (game.mode === 'title') {
      titleT += dt;
      if (!reduced) {
        update(demo, dt, autopilot(demo));
        if (demo.mode === 'gameover') {
          demoWait += dt;
          if (demoWait > 2.5) {
            demo = newDemo();
            demoWait = 0;
          }
        }
      }
      sfx.engine(false);
    } else if (game.mode !== 'paused') {
      const ev = update(game, dt, input());
      if (ev.length) handle(ev);
      sfx.engine(game.mode === 'playing', game.speed / MAX_SPEED, game.offroad);
    } else sfx.engine(false);
    const dir = game.mode === 'playing' ? Math.round(game.steer) : 0;
    if (dir !== lastDir) {
      lastDir = dir;
      cabinet.dataset.dir = String(dir);
    }
  }

  function handle(evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'beep':
          sfx.play('beep');
          break;
        case 'go':
          sfx.play('go');
          say('Via!');
          break;
        case 'tick':
          sfx.play('tick');
          break;
        case 'pickup':
          sfx.play('pickup', e.pts);
          break;
        case 'pineapple':
          sfx.play('pineapple');
          break;
        case 'crash':
          sfx.play('crash');
          break;
        case 'bump':
          sfx.play('bump');
          break;
        case 'note':
          sfx.play('note');
          break;
        case 'checkpoint':
          sfx.play('checkpoint');
          say(`Checkpoint ${e.name.toLowerCase()}: più ${e.bonus} secondi.`);
          break;
        case 'finish':
          onOver(e, true);
          break;
        case 'timeup':
          onOver(e, false);
          break;
        default:
          break;
      }
    }
  }

  function onOver(e, finished) {
    overAt = performance.now();
    if (finished && e.newRecord) {
      best = e.best;
      writeRecord(best);
      try {
        window.dispatchEvent(new CustomEvent('pv:record', { detail: { best } }));
      } catch (err) {
        /* ok */
      }
    }
    sfx.play(finished ? 'finish' : 'timeup');
    sfx.engine(false);
    releaseAll();
    setMode();
    measureOver();
    if (finished) say(`Arrivo! Tempo di prova ${fmtTime(e.time)}. Record ${fmtTime(best)}.${e.newRecord ? ' Nuovo record!' : ''}`);
    else say(`Tempo scaduto. Ultimo passaggio: ${e.reached.toLowerCase()}.`);
    if (document.activeElement === canvas && el.replay) el.replay.focus({ preventScroll: true });
  }

  function releaseAll() {
    keys.left = keys.right = keys.gas = keys.brake = false;
    btn.left = btn.right = btn.brake = false;
    pointerX = null;
    pointerId = null;
    for (const b of [el.left, el.right, el.brake]) if (b) b.classList.remove('is-down');
  }

  function start(viaPointer) {
    if (game.mode === 'gameover' && performance.now() - overAt < 650) return;
    if (viaPointer) autoGas = true;
    game.best = best;
    startRun(game);
    renderer.shownPts = 0;
    releaseAll();
    setMode();
    sfx.play('start');
    say('Prova speciale Valpantena: tre, due, uno...');
    if (document.activeElement !== canvas) canvas.focus({ preventScroll: true });
    ensureLoop();
  }
  function pause() {
    if (game.mode !== 'playing') return;
    game.mode = 'paused';
    releaseAll();
    setMode();
    sfx.play('pause');
    sfx.engine(false);
    say('Pausa.');
    draw();
  }
  function resume() {
    if (game.mode !== 'paused') return;
    game.mode = 'playing';
    setMode();
    say('Si riparte!');
    ensureLoop();
  }

  function shouldRun() {
    return inView && pageVisible && game.mode !== 'paused' && !(reduced && game.mode === 'title');
  }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    tick(dt);
    draw();
    if (shouldRun()) raf = window.requestAnimationFrame(frame);
    else sfx.engine(false);
  }
  function ensureLoop() {
    if (!raf && shouldRun()) {
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
  }

  const toTarget = (clientX) => {
    const r = canvas.getBoundingClientRect();
    return r.width ? clamp((((clientX - r.left) / r.width) * 2 - 1) * 1.15, -1.3, 1.3) : null;
  };
  const press = (name, on) => {
    const b = el[name];
    if (b) b.classList.toggle('is-down', on);
  };

  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake' };
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement;
    if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) return;
    const onCanvas = active === canvas;
    const k = e.key;
    if (game.mode === 'playing') {
      const act = KEYMAP[k];
      if (act && inView) {
        keys[act] = true;
        if (act === 'gas') autoGas = false;
        if (act === 'left' || act === 'right' || act === 'brake') press(act, true);
        e.preventDefault();
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        pause();
        e.preventDefault();
      } else if (onCanvas && (k === ' ' || k === 'Enter')) e.preventDefault();
      return;
    }
    if (game.mode === 'paused') {
      if (k === 'p' || k === 'P' || (onCanvas && (k === 'Enter' || k === ' ' || k === 'Escape'))) {
        resume();
        e.preventDefault();
      }
      return;
    }
    if ((game.mode === 'title' || game.mode === 'gameover') && onCanvas && (k === 'Enter' || k === ' ')) {
      start(false);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const act = KEYMAP[e.key];
    if (!act) return;
    keys[act] = false;
    if (act !== 'gas') press(act, false);
  });

  canvas.addEventListener('click', () => {
    if (game.mode === 'title') start(true);
    else if (game.mode === 'paused') resume();
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (game.mode !== 'playing') return;
    pointerId = e.pointerId;
    pointerX = toTarget(e.clientX);
    autoGas = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ok */
    }
    if (e.pointerType !== 'mouse') e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (game.mode === 'playing' && e.pointerId === pointerId) pointerX = toTarget(e.clientX);
  });
  const endPointer = (e) => {
    if (e.pointerId === pointerId) {
      pointerId = null;
      pointerX = null;
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  function bindHold(button, name) {
    if (!button) return;
    const up = () => {
      btn[name] = false;
      press(name, false);
    };
    button.addEventListener('pointerdown', (e) => {
      if (game.mode === 'title') {
        start(true);
        return;
      }
      if (game.mode !== 'playing') return;
      autoGas = true;
      btn[name] = true;
      press(name, true);
      try {
        button.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ok */
      }
      e.preventDefault();
    });
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    button.addEventListener('click', (e) => {
      if (e.detail !== 0 || game.mode !== 'playing') return;
      btn[name] = true;
      press(name, true);
      window.setTimeout(up, 180);
    });
  }
  bindHold(el.left, 'left');
  bindHold(el.right, 'right');
  bindHold(el.brake, 'brake');

  if (el.start) {
    el.start.addEventListener('click', (e) => {
      if (game.mode === 'playing') pause();
      else if (game.mode === 'paused') resume();
      else start(e.detail !== 0);
    });
  }
  if (el.replay) el.replay.addEventListener('click', (e) => start(e.detail !== 0 || autoGas));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          inView = en.isIntersecting && en.intersectionRatio >= 0.12;
          if (!inView && game.mode === 'playing') pause();
          ensureLoop();
        }
      },
      { threshold: [0, 0.12, 0.5] }
    );
    io.observe(screen);
  }
  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    if (!pageVisible && game.mode === 'playing') pause();
    if (!pageVisible) sfx.engine(false);
    ensureLoop();
  });
  window.addEventListener('blur', () => {
    if (game.mode === 'playing') pause();
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => fit()).observe(screen);
  else window.addEventListener('resize', fit);

  setMode();
  fit();
  ensureLoop();
  cabinet.classList.add('is-on');

  return {
    sfx,
    start,
    pause,
    resume,
    get mode() {
      return game.mode;
    },
  };
}
