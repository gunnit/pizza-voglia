/* =====================================================================
   PIZZA VOGLIA — "ACCHIAPPA GLI INGREDIENTI"
   Mini-gioco arcade dell'opzione B "Sala giochi".

   - Logica pura (createState / startRun / update / autopilot): nessun DOM,
     testabile in Node.
   - Renderer Canvas 2D a bassa risoluzione (256×192) con sprite pixel-art
     generati da matrici indicizzate sulla palette + font bitmap 5×7.
   - Controller DOM (mountGame): input tastiera / mouse / touch, audio
     WebAudio 8-bit, record in localStorage, pausa automatica.
   Il modulo non tocca il DOM al caricamento.
   ===================================================================== */

export const W = 256;
export const H = 192;
export const GROUND_Y = 176;
export const MAX_LIVES = 3;
export const PIZZA_GOAL = 12;

const PIZZA_W = 36;
const PIZZA_H = 13;
const PLAYER_Y = GROUND_Y - PIZZA_H - 2;
const SPEED = 172;
const SPEED_TURBO = 270;
const ACCEL = 1500;
const TURBO_TIME = 5;
const MAX_PARTICLES = 280;
const OUTLINE = '#140d22';

/* ---------------------------------------------------------------------
   Palette (chiave a un carattere → colore)
   --------------------------------------------------------------------- */
export const PAL = {
  k: '#140d22', // contorno scuro
  h: '#ffffff', // riflesso
  w: '#fff4dc', // crema
  c: '#d8c6a2', // ombra crema
  r: '#ff3b3b', // pomodoro
  R: '#b3202e', // pomodoro scuro
  p: '#ff8f80', // pomodoro chiaro
  g: '#36d17a', // basilico
  G: '#178a4a', // basilico scuro
  v: '#a6f5c6', // venatura
  y: '#ffd23f', // formaggio / oro
  Y: '#c98a12', // oro scuro
  o: '#ff9a2e', // arancio
  O: '#b8641c', // arancio scuro
  b: '#cf9152', // marrone chiaro
  B: '#7a4524', // marrone scuro
  t: '#f3d3a1', // beige
  m: '#f2e4c6', // gambo fungo
  M: '#b9a07a', // gambo ombra
  s: '#d93a4c', // salame
  S: '#8c1c30', // salame scuro
  f: '#ffc9c0', // grasso del salame
  l: '#5b4384', // oliva
  L: '#a58fd6', // oliva luce
  n: '#2c1f45', // oliva scura
  q: '#ff4fd8', // rosa neon
  e: '#8d8bb3', // lilla
  E: '#3a3f73', // lilla scuro
  u: '#8fb8ff', // azzurro (gorgonzola)
  a: '#9bbd52', // carciofo
  A: '#5c7a26', // carciofo scuro
  j: '#ffa3b5', // prosciutto
  J: '#e0708a', // prosciutto scuro
  z: '#7a3fa0', // melanzana
  C: '#e8a456', // cornicione
  D: '#ffd79c', // cornicione luce
  K: '#b2672c', // cornicione lato
  Q: '#6b381c', // cornicione scuro
  x: '#2a1a14', // bruciato
};

/* ---------------------------------------------------------------------
   Utilità
   --------------------------------------------------------------------- */
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
const pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
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
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

/* ---------------------------------------------------------------------
   Generatori di pixel-art
   --------------------------------------------------------------------- */
function grid(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += fn(x, y) || '.';
    rows.push(row);
  }
  return rows;
}
/** Sovrappone `art` a `rows` (il '.' lascia invariato, '_' rende trasparente). */
function overlay(rows, art, ox = 0, oy = 0) {
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
/** Riempie una forma con luce dall'alto a sinistra e bordo in ombra a destra/in basso. */
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

function makeTomato() {
  let r = lit(12, 12, ellipse(6, 7, 5.6, 4.95), 6, 7, 5.6, 4.95, { base: 'r', light: 'r', dark: 'R', rim: 'R', rimLight: 'p' });
  r = overlay(r, [
    '....G..G....',
    '...GgGgGG...',
    '....gGGg....',
    '.....G......',
    '..hp........',
    '..p.........',
  ]);
  return r;
}
function makeMozzarella() {
  let r = lit(12, 11, ellipse(6, 6, 5.7, 4.9), 6, 6, 5.7, 4.9, { base: 'w', light: 'h', dark: 'c', rim: 'c', rimLight: 'h' });
  r = overlay(r, [
    '............',
    '.....cc.....',
    '....c..c....',
    '............',
    '...hh.......',
    '..hh........',
  ]);
  return r;
}
function makeBasil() {
  // foglia a lente lungo la diagonale, con nervatura centrale
  const ax = 1.2, ay = 10.8, bx = 10.8, by = 1.2;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const half = Math.hypot(bx - ax, by - ay) / 2;
  const hw = 3.1;
  const R = (half * half + hw * hw) / (2 * hw);
  const dd = R - hw;
  const px = 1 / Math.SQRT2, py = 1 / Math.SQRT2;
  const c1 = [mx + px * dd, my + py * dd];
  const c2 = [mx - px * dd, my - py * dd];
  const inside = (x, y) => Math.hypot(x + 0.5 - c1[0], y + 0.5 - c1[1]) <= R && Math.hypot(x + 0.5 - c2[0], y + 0.5 - c2[1]) <= R;
  const rows = grid(12, 12, (x, y) => {
    if (!inside(x, y)) return '.';
    const side = (x + 0.5) + (y + 0.5) - 12; // <0 sopra la diagonale
    const onVein = Math.abs((x + 0.5) - (12 - (y + 0.5))) < 0.75;
    const edge = !inside(x + 1, y) || !inside(x, y + 1) || !inside(x - 1, y) || !inside(x, y - 1);
    if (onVein && !edge) return 'v';
    if (edge) return side > 0 ? 'G' : 'g';
    return side > 1.2 ? 'G' : 'g';
  });
  return overlay(rows, ['G'], 0, 11);
}
function makeOlive() {
  let r = lit(9, 11, ellipse(4.5, 5.6, 4.2, 5.2), 4.5, 5.6, 4.2, 5.2, { base: 'l', light: 'L', dark: 'n', rim: 'n', rimLight: 'L' });
  r = overlay(r, ['', '', '..h......', '.hL......']);
  return r;
}
function makeMushroom() {
  const cap = ellipse(6, 6.2, 5.9, 5.4);
  const capRows = grid(12, 12, (x, y) => (y <= 6 && cap(x, y) ? 'X' : '.'));
  const inCap = (x, y) => x >= 0 && y >= 0 && x < 12 && y < 12 && capRows[y][x] === 'X';
  const shaded = lit(12, 12, inCap, 6, 4.5, 5.9, 4.4, { base: 'b', light: 't', dark: 'B', rim: 'B', rimLight: 't' });
  return overlay(shaded, [
    '............',
    '............',
    '...hh.......',
    '..ht........',
    '............',
    '............',
    '.BBBBBBBBBB.',
    '....mmmM....',
    '....mmmM....',
    '....mmmM....',
    '...mmmmMM...',
    '...MMMMMM...',
  ]);
}
function makeSalame() {
  let r = lit(12, 12, ellipse(6, 6, 5.6, 5.6), 6, 6, 5.6, 5.6, { base: 's', light: 's', dark: 's', rim: 'S', rimLight: 'S' });
  r = overlay(r, [
    '............',
    '............',
    '...f...f....',
    '.....f......',
    '..f......f..',
    '......f.....',
    '...f.....f..',
    '.......f....',
    '..f..f......',
    '.........f..',
    '.....f......',
  ]);
  return r;
}
function makeChili() {
  return [
    '..........G.',
    '.........GG.',
    '.......GGgG.',
    '......rrGG..',
    '.....rpprR..',
    '....rprrRR..',
    '...rprrRR...',
    '..rrrrRR....',
    '..rrrRR.....',
    '.rrrRR......',
    '.rRR........',
    'rR..........',
  ];
}
function makeStar() {
  return [
    '......y......',
    '.....yhy.....',
    '.....yhy.....',
    '....yhyyY....',
    'yyyyyhyyyyyyY',
    '.yyhyyyyyyyY.',
    '..yyyrwgyyY..',
    '...yyyyyyY...',
    '...yyyyyyY...',
    '..yyyyYyyyY..',
    '..yyyY.YyyY..',
    '.yyY.....YyY.',
    '.YY.......YY.',
  ];
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
    return (x + 0.5 - 6.5) + (y + 0.5 - 10.6) * 0.6 > 2.2 ? 'o' : 'y';
  });
  return overlay(body, [
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
const HEART = [
  '.rr.rr.',
  'rprrrrr',
  'rrrrrrR',
  '.rrrrR.',
  '..rRR..',
  '...R...',
];
const HEART_EMPTY = [
  '.EE.EE.',
  'E..E..E',
  'E.....E',
  '.E...E.',
  '..E.E..',
  '...E...',
];

export const SPRITES = {
  tomato: makeTomato(),
  mozzarella: makeMozzarella(),
  basil: makeBasil(),
  olive: makeOlive(),
  mushroom: makeMushroom(),
  salame: makeSalame(),
  chili: makeChili(),
  star: makeStar(),
  pineapple: makePineapple(),
  heart: HEART,
  heartEmpty: HEART_EMPTY,
};

/* Mini-condimenti che si posano sulla pizza del giocatore */
const MINI = {
  tomato: ['pRp', 'Rp.'],
  mozzarella: ['hw.', 'wwc'],
  basil: ['.gG', 'gG.'],
  olive: ['nl', 'ln'],
  mushroom: ['tbb', '.m.'],
  salame: ['sfS', 'SsS'],
  chili: ['rrG'],
  star: ['.y.', 'yhy', '.y.'],
  pineapple: ['yo', 'oy'],
};

/* Pizza del giocatore: ellisse vista leggermente dall'alto, con spessore */
function makePizza() {
  const cx = PIZZA_W / 2, cy = 5.5, rx = PIZZA_W / 2 - 0.3, ry = 5.4;
  const top = ellipse(cx, cy, rx, ry);
  const sauce = ellipse(cx, cy + 0.25, rx - 3.6, ry - 1.75);
  return grid(PIZZA_W, PIZZA_H, (x, y) => {
    if (top(x, y)) {
      if (sauce(x, y)) {
        const ny = (y + 0.5 - cy) / (ry - 1.75);
        const nx = (x + 0.5 - cx) / (rx - 3.6);
        if (ny > 0.62) return 'R';
        if (ny < -0.45 && nx < -0.1) return 'p';
        return 'r';
      }
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const l = -(0.45 * nx + 0.9 * ny);
      if (!top(x, y - 1) && l > -0.35) return 'D';
      if (l > 0.3) return 'D';
      if (l < -0.55) return 'K';
      return 'C';
    }
    if (y > cy && top(x, y - 1)) return 'K';
    if (y > cy && top(x, y - 2)) return 'Q';
    return '.';
  });
}
const PIZZA_ROWS = makePizza();
const BURNT = { r: 'x', R: 'x', p: 'Q', C: 'Q', D: 'K', K: 'x', Q: 'k' };

/* Posizioni dei condimenti sulla superficie della pizza */
function makeSlots() {
  const out = [];
  const cx = PIZZA_W / 2;
  for (let row = 0; row < 3; row++) {
    const y = 2 + row * 2;
    const dy = y + 1 - 5.75;
    const half = (PIZZA_W / 2 - 4.5) * Math.sqrt(Math.max(0, 1 - (dy / 3.9) ** 2)) - 1.5;
    const off = row % 2 ? 2 : 0;
    for (let x = Math.ceil(cx - half) + off; x + 3 <= cx + half; x += 4) out.push({ x, y });
  }
  return out;
}
const SLOTS = makeSlots();
function shuffledSlots(rng) {
  const a = SLOTS.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------------------------------------------------
   Font bitmap 5×7
   --------------------------------------------------------------------- */
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
  '·': '..... ..... ..... ..#.. ..... ..... .....',
  '_': '..... ..... ..... ..... ..... ..... #####',
  '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
};
const GLYPHS = {};
for (const [ch, src] of Object.entries(GLYPH_SRC)) GLYPHS[ch] = src.split(' ');

export function normText(t) {
  return String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[’‘]/g, "'");
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
    const gw = bold ? 6 : 5;
    c = this.cc(gw, 7);
    const g = c.getContext('2d');
    for (let y = 0; y < 7; y++) {
      g.fillStyle = Array.isArray(color) ? (y < 4 ? color[0] : color[1]) : color;
      for (let x = 0; x < 5; x++) {
        if (rows[y][x] !== '#') continue;
        g.fillRect(x, y, bold ? 2 : 1, 1);
      }
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

/* ---------------------------------------------------------------------
   Tipi di oggetti che cadono
   --------------------------------------------------------------------- */
export const KINDS = {
  tomato: { pts: 10, good: true, weight: 18, label: 'POMODORO', fx: ['r', 'p', 'g'] },
  mozzarella: { pts: 10, good: true, weight: 17, label: 'MOZZARELLA', fx: ['w', 'h', 'c'] },
  basil: { pts: 10, good: true, weight: 16, label: 'BASILICO', fx: ['g', 'v', 'G'], sway: 7 },
  olive: { pts: 10, good: true, weight: 12, label: 'OLIVA', fx: ['l', 'L', 'n'] },
  mushroom: { pts: 15, good: true, weight: 12, label: 'FUNGHI', fx: ['b', 't', 'm'] },
  salame: { pts: 15, good: true, weight: 12, label: 'SALAME', fx: ['s', 'f', 'S'] },
  chili: { pts: 5, good: true, power: 'turbo', label: 'PEPERONCINO', fx: ['r', 'o', 'y'] },
  star: { pts: 100, good: true, power: 'star', label: 'MARGHERITA STELLA', fx: ['y', 'h', 'o', 'q'] },
  pineapple: { pts: 0, good: false, label: 'ANANAS', fx: ['y', 'o', 'g'] },
};
const BASIC = ['tomato', 'mozzarella', 'basil', 'olive', 'mushroom', 'salame'];
const BASIC_TOTAL = BASIC.reduce((s, k) => s + KINDS[k].weight, 0);
const SIZE = {};
for (const k of Object.keys(KINDS)) SIZE[k] = { w: SPRITES[k][0].length, h: SPRITES[k].length };

/* ---------------------------------------------------------------------
   Difficoltà
   --------------------------------------------------------------------- */
export function levelParams(level) {
  const L = Math.max(0, level - 1);
  return {
    fall: Math.min(134, 40 + L * 9),
    interval: Math.max(0.34, 1.02 - L * 0.075),
    pine: Math.min(0.38, 0.12 + L * 0.033),
    drift: L >= 3,
  };
}
export function levelForScore(score) {
  let lv = 1;
  let need = 250;
  let acc = 0;
  while (score >= acc + need && lv < 30) {
    acc += need;
    lv++;
    need += 100;
  }
  return lv;
}

/* ---------------------------------------------------------------------
   Stato e simulazione (logica pura)
   --------------------------------------------------------------------- */
export function createState({ seed = 1, demo = false, hiscore = 0 } = {}) {
  const s = {
    seed,
    rng: makeRng(seed),
    demo,
    hiscore,
    mode: 'title',
    t: 0,
    score: 0,
    lives: MAX_LIVES,
    level: 1,
    combo: 0,
    mult: 1,
    bestCombo: 0,
    pizzas: 0,
    caught: 0,
    missed: 0,
    newRecord: false,
    player: null,
    items: [],
    particles: [],
    floaters: [],
    toppings: [],
    slots: [],
    spawnT: 0,
    banner: null,
    shake: 0,
    flash: 0,
    flashColor: '#ffffff',
    dying: 0,
    events: [],
  };
  resetRun(s);
  s.mode = 'title';
  return s;
}

export function resetRun(s) {
  s.t = 0;
  s.score = 0;
  s.lives = MAX_LIVES;
  s.level = 1;
  s.combo = 0;
  s.mult = 1;
  s.bestCombo = 0;
  s.pizzas = 0;
  s.caught = 0;
  s.missed = 0;
  s.newRecord = false;
  s.player = { x: (W - PIZZA_W) / 2, y: PLAYER_Y, w: PIZZA_W, h: PIZZA_H, vx: 0, inv: 0, boost: 0, squash: 0, hurt: 0, dir: 0, trail: [], trailT: 0 };
  s.items.length = 0;
  s.particles.length = 0;
  s.floaters.length = 0;
  s.toppings.length = 0;
  s.slots = shuffledSlots(s.rng);
  s.spawnT = 0.7;
  s.banner = null;
  s.shake = 0;
  s.flash = 0;
  s.dying = 0;
  s.events.length = 0;
}

export function startRun(s) {
  resetRun(s);
  s.mode = 'playing';
  s.banner = { text: 'VIA!', t: 1, max: 1, color: 'y' };
}

const NO_INPUT = { left: false, right: false, targetX: null };

/** Avanza la simulazione di `dt` secondi. Restituisce gli eventi del passo. */
export function update(s, dt, input = NO_INPUT) {
  const ev = s.events;
  ev.length = 0;
  if (!(dt > 0)) return ev;
  dt = Math.min(dt, 0.05);
  s.t += dt;
  stepFx(s, dt);
  if (s.mode === 'dying') {
    s.dying -= dt;
    if (s.rng() < dt * 26) smoke(s);
    if (s.dying <= 0) {
      s.mode = 'gameover';
      if (s.score > s.hiscore) {
        s.hiscore = s.score;
        s.newRecord = true;
      }
      ev.push({ type: 'gameover', score: s.score, hiscore: s.hiscore, newRecord: s.newRecord });
    }
    return ev;
  }
  if (s.mode !== 'playing') return ev;
  stepPlayer(s, dt, input || NO_INPUT);
  const P = levelParams(s.level);
  s.spawnT -= dt;
  if (s.spawnT <= 0) {
    spawn(s, P);
    s.spawnT = P.interval * (0.7 + s.rng() * 0.6);
  }
  stepItems(s, dt);
  const lv = levelForScore(s.score);
  if (lv > s.level) {
    s.level = lv;
    s.banner = { text: 'LIVELLO ' + lv, t: 1.4, max: 1.4, color: 'g' };
    ev.push({ type: 'levelup', level: lv });
  }
  return ev;
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
    if (p.drag) {
      p.vx *= Math.max(0, 1 - p.drag * dt);
      p.vy *= Math.max(0, 1 - p.drag * dt * 0.5);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.floor && p.y > GROUND_Y + 1) {
      p.y = GROUND_Y + 1;
      p.vy *= -0.35;
      p.vx *= 0.6;
    }
  }
  const fl = s.floaters;
  for (let i = fl.length - 1; i >= 0; i--) {
    const f = fl[i];
    f.life -= dt;
    f.y += f.vy * dt;
    f.vy *= Math.max(0, 1 - 2.6 * dt);
    if (f.life <= 0) fl.splice(i, 1);
  }
  if (s.banner) {
    s.banner.t -= dt;
    if (s.banner.t <= 0) s.banner = null;
  }
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
  if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
  const pl = s.player;
  pl.inv = Math.max(0, pl.inv - dt);
  pl.hurt = Math.max(0, pl.hurt - dt);
  pl.squash = Math.max(0, pl.squash - dt);
}

function stepPlayer(s, dt, input) {
  const pl = s.player;
  if (pl.boost > 0) pl.boost = Math.max(0, pl.boost - dt);
  const max = pl.boost > 0 ? SPEED_TURBO : SPEED;
  const dirKeys = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let desired = 0;
  if (dirKeys !== 0) desired = dirKeys * max;
  else if (input.targetX != null && Number.isFinite(input.targetX)) {
    const dx = input.targetX - (pl.x + pl.w / 2);
    desired = Math.abs(dx) < 0.75 ? 0 : clamp(dx * 9, -max, max);
  }
  const turning = pl.vx !== 0 && desired !== 0 && Math.sign(desired) !== Math.sign(pl.vx);
  pl.vx = approach(pl.vx, desired, (turning ? ACCEL * 1.7 : ACCEL) * dt);
  pl.x += pl.vx * dt;
  if (pl.x < 2) {
    pl.x = 2;
    pl.vx = 0;
  } else if (pl.x > W - pl.w - 2) {
    pl.x = W - pl.w - 2;
    pl.vx = 0;
  }
  pl.dir = Math.abs(pl.vx) > 25 ? Math.sign(pl.vx) : 0;
  if (pl.boost > 0) {
    pl.trailT -= dt;
    if (pl.trailT <= 0) {
      pl.trailT = 0.035;
      pl.trail.unshift({ x: pl.x });
      if (pl.trail.length > 4) pl.trail.pop();
    }
    if (Math.abs(pl.vx) > 40 && s.rng() < dt * 40) {
      const bx = pl.vx > 0 ? pl.x + 2 : pl.x + pl.w - 3;
      addParticle(s, bx, pl.y + 6 + s.rng() * 5, -Math.sign(pl.vx) * (20 + s.rng() * 30), -10 - s.rng() * 20, s.rng() < 0.5 ? 'o' : 'y', 0.35, { g: -30 });
    }
  } else if (pl.trail.length) {
    pl.trail.length = 0;
  }
}

function tooClose(s, x, w) {
  for (const it of s.items) {
    if (it.y < 34 && Math.abs(it.x + it.w / 2 - (x + w / 2)) < 20) return true;
  }
  return false;
}

function spawn(s, P) {
  const r = s.rng;
  let kind;
  if (r() < P.pine) kind = 'pineapple';
  else if (s.level >= 2 && r() < 0.04 && !s.items.some((i) => i.kind === 'star')) kind = 'star';
  else if (s.level >= 2 && r() < 0.06 && s.player.boost <= 0 && !s.items.some((i) => i.kind === 'chili')) kind = 'chili';
  else {
    let roll = r() * BASIC_TOTAL;
    kind = BASIC[BASIC.length - 1];
    for (const k of BASIC) {
      roll -= KINDS[k].weight;
      if (roll < 0) {
        kind = k;
        break;
      }
    }
  }
  const { w, h } = SIZE[kind];
  let x = 0;
  for (let tries = 0; tries < 8; tries++) {
    x = 4 + r() * (W - 8 - w);
    if (!tooClose(s, x, w)) break;
  }
  let vy = P.fall * (0.85 + r() * 0.3);
  if (kind === 'star') vy *= 1.3;
  if (kind === 'pineapple') vy *= 1.04;
  let vx = 0;
  if (kind === 'pineapple' && P.drift && r() < 0.45) vx = (r() < 0.5 ? -1 : 1) * (12 + r() * 16);
  s.items.push({ kind, x, bx: x, y: -h - 1, w, h, vx, vy, t: 0, phase: r() * Math.PI * 2 });
}

function stepItems(s, dt) {
  const pl = s.player;
  const catchTop = pl.y + 1;
  const catchBottom = pl.y + 9;
  for (let i = s.items.length - 1; i >= 0; i--) {
    const it = s.items[i];
    const k = KINDS[it.kind];
    it.t += dt;
    it.y += it.vy * dt;
    if (it.vx) {
      it.bx += it.vx * dt;
      if (it.bx < 2) {
        it.bx = 2;
        it.vx = Math.abs(it.vx);
      } else if (it.bx > W - it.w - 2) {
        it.bx = W - it.w - 2;
        it.vx = -Math.abs(it.vx);
      }
    }
    it.x = k.sway ? clamp(it.bx + Math.sin(it.t * 3.2 + it.phase) * k.sway, 2, W - it.w - 2) : it.bx;
    const bottom = it.y + it.h;
    const inset = k.good ? -1 : 3;
    if (bottom >= catchTop && it.y + it.h * 0.5 <= catchBottom && it.x + it.w - inset > pl.x + 2 && it.x + inset < pl.x + pl.w - 2) {
      s.items.splice(i, 1);
      if (k.good) onCatch(s, it, k);
      else onHit(s, it);
      if (s.mode !== 'playing') return;
      continue;
    }
    if (bottom >= GROUND_Y + 3) {
      s.items.splice(i, 1);
      onGround(s, it, k);
    }
  }
}

function onCatch(s, it, k) {
  const ev = s.events;
  const pl = s.player;
  s.combo++;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  const mult = Math.min(8, 1 + Math.floor(s.combo / 5));
  if (mult > s.mult) {
    s.banner = { text: 'COMBO ×' + mult + '!', t: 1, max: 1, color: 'y' };
    ev.push({ type: 'combo', mult });
  }
  s.mult = mult;
  const pts = k.pts * s.mult;
  s.score += pts;
  s.caught++;
  const cx = it.x + it.w / 2;
  if (k.power === 'turbo') {
    pl.boost = TURBO_TIME;
    s.banner = { text: 'TURBO!', t: 1, max: 1, color: 'o' };
    addFloater(s, cx, pl.y - 10, 'PICCANTE!', 'o');
    ev.push({ type: 'turbo' });
  } else if (k.power === 'star') {
    addFloater(s, cx, pl.y - 10, '+' + pts + ' STELLA!', 'y');
    if (s.lives < MAX_LIVES) {
      s.lives++;
      addFloater(s, cx, pl.y - 20, '+1 VITA', 'q');
    }
    burst(s, cx, pl.y, ['y', 'h', 'q', 'o'], 26, { speed: 110, life: 0.9 });
    ev.push({ type: 'bonus', pts });
  } else {
    addFloater(s, cx, pl.y - 8, '+' + pts, s.mult > 1 ? 'y' : 'w');
    ev.push({ type: 'catch', combo: s.combo, pts });
  }
  burst(s, cx, pl.y + 1, k.fx, 10, { speed: 70, life: 0.55 });
  pl.squash = 0.09;
  addTopping(s, it.kind);
}

function onHit(s, it) {
  const ev = s.events;
  const pl = s.player;
  const cx = it.x + it.w / 2;
  if (pl.inv > 0) {
    burst(s, cx, pl.y, ['y', 'o'], 8, { speed: 60, life: 0.4 });
    addFloater(s, cx, pl.y - 8, 'SCHIVATO!', 'e');
    return;
  }
  s.lives--;
  s.combo = 0;
  s.mult = 1;
  s.shake = 0.38;
  s.flash = 0.12;
  s.flashColor = '#ff3b3b';
  pl.inv = 1.5;
  pl.hurt = 0.12;
  burst(s, cx, pl.y, ['y', 'o', 'O', 'g'], 18, { speed: 95, life: 0.7 });
  addFloater(s, cx, pl.y - 10, "L'ANANAS NO!", 'r');
  addTopping(s, 'pineapple');
  ev.push({ type: 'hit', lives: s.lives });
  if (s.lives <= 0) {
    s.mode = 'dying';
    s.dying = 1.15;
    s.shake = 0.55;
    s.banner = null;
    burst(s, pl.x + pl.w / 2, pl.y + 4, ['x', 'Q', 'K', 'e'], 30, { speed: 120, life: 1 });
    ev.push({ type: 'dead' });
  }
}

function onGround(s, it, k) {
  const cx = it.x + it.w / 2;
  if (k.good) {
    if (s.combo >= 5) addFloater(s, cx, GROUND_Y - 12, 'COMBO PERSO', 'e');
    s.combo = 0;
    s.mult = 1;
    s.missed++;
    s.events.push({ type: 'miss' });
    burst(s, cx, GROUND_Y + 1, k.fx, 6, { speed: 45, life: 0.45, up: 0.5, floor: true });
  } else {
    burst(s, cx, GROUND_Y + 1, ['y', 'o'], 5, { speed: 40, life: 0.4, up: 0.5, floor: true });
  }
}

function addTopping(s, kind) {
  const slot = s.slots[s.toppings.length % s.slots.length];
  s.toppings.push({ kind, x: slot.x, y: slot.y });
  if (kind === 'pineapple') return;
  let good = 0;
  for (const tp of s.toppings) if (tp.kind !== 'pineapple') good++;
  if (good >= PIZZA_GOAL) {
    const pl = s.player;
    const bonus = 50 * s.mult;
    s.score += bonus;
    s.pizzas++;
    s.banner = { text: 'PIZZA SFORNATA!', t: 1.3, max: 1.3, color: 'y' };
    addFloater(s, pl.x + pl.w / 2, pl.y - 18, '+' + bonus + ' BONUS', 'g');
    burst(s, pl.x + pl.w / 2, pl.y + 2, ['y', 'w', 'g', 'r', 'h'], 30, { speed: 120, life: 0.9 });
    s.toppings.length = 0;
    s.slots = shuffledSlots(s.rng);
    s.events.push({ type: 'complete', pizzas: s.pizzas });
  }
}

function addParticle(s, x, y, vx, vy, c, life, o = {}) {
  if (s.particles.length >= MAX_PARTICLES) s.particles.shift();
  s.particles.push({ x, y, vx, vy, c, life, max: life, g: o.g ?? 260, drag: o.drag ?? 0, size: o.size ?? 1, floor: !!o.floor });
}
function burst(s, x, y, colors, n, o = {}) {
  const { speed = 70, life = 0.6, up = 1, floor = false } = o;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (s.rng() - 0.5) * Math.PI * 1.5 * up;
    const v = speed * (0.4 + s.rng() * 0.8);
    addParticle(s, x + (s.rng() - 0.5) * 6, y, Math.cos(a) * v, Math.sin(a) * v, colors[i % colors.length], life * (0.6 + s.rng() * 0.6), {
      size: s.rng() < 0.3 ? 2 : 1,
      floor,
    });
  }
}
function smoke(s) {
  const pl = s.player;
  addParticle(s, pl.x + 6 + s.rng() * (pl.w - 12), pl.y + 2, (s.rng() - 0.5) * 16, -18 - s.rng() * 22, s.rng() < 0.5 ? 'e' : 'E', 0.9, { g: -10, size: 2 });
}
function addFloater(s, x, y, text, color) {
  const half = (normText(text).length * 6) / 2;
  s.floaters.push({ x: clamp(x, half + 2, W - half - 2), y, text, color, life: 0.95, vy: -26 });
}

/** Pilota automatico per la demo della schermata titolo. */
export function autopilot(s) {
  const pl = s.player;
  const cx = pl.x + pl.w / 2;
  let best = null;
  let bestT = Infinity;
  for (const it of s.items) {
    if (!KINDS[it.kind].good) continue;
    const tLand = (pl.y - (it.y + it.h)) / it.vy;
    if (tLand < 0) continue;
    const icx = it.x + it.w / 2;
    if (Math.abs(icx - cx) > SPEED * 0.8 * tLand + 12) continue;
    const score = tLand - (it.kind === 'star' ? 0.6 : 0);
    if (score < bestT) {
      bestT = score;
      best = icx;
    }
  }
  let target = best ?? W / 2 + Math.sin(s.t * 0.7) * 60;
  for (const it of s.items) {
    if (KINDS[it.kind].good) continue;
    const tLand = (pl.y - (it.y + it.h)) / it.vy;
    if (tLand < -0.15 || tLand > 0.9) continue;
    const icx = it.x + it.w / 2;
    if (Math.abs(icx - target) < pl.w / 2 + 8) target = icx + (target >= icx ? 1 : -1) * (pl.w / 2 + 14);
  }
  return { left: false, right: false, targetX: clamp(target, pl.w / 2 + 2, W - pl.w / 2 - 2) };
}

/* ---------------------------------------------------------------------
   Canvas helpers (usano solo createImageData/putImageData/fillRect/drawImage)
   --------------------------------------------------------------------- */
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

function buildBackground(cc) {
  const c = cc(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const set = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const [r, gg, b] = hexToRgb(hex);
    const i = (y * W + x) * 4;
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    d[i + 3] = 255;
  };
  const dith = (x, y) => (BAYER4[y & 3][x & 3] + 0.5) / 16;
  // cielo notturno con dithering ordinato
  const SKY = ['#05071a', '#070a20', '#0a0d28', '#0d1031', '#11133b', '#171645', '#1e184e', '#271a55', '#331b5a', '#3f1c5c'];
  for (let y = 0; y < GROUND_Y; y++) {
    const f = clamp((y - 10) / 140, 0, 1);
    const v = Math.pow(f, 1.3) * (SKY.length - 1);
    const i0 = Math.floor(v);
    const fr = v - i0;
    for (let x = 0; x < W; x++) set(x, y, SKY[Math.min(SKY.length - 1, i0 + (fr > dith(x, y) ? 1 : 0))]);
  }
  // luna-pizza
  const mx = 214, my = 38, mr = 10.5;
  for (let y = my - 20; y <= my + 20; y++) {
    for (let x = mx - 20; x <= mx + 20; x++) {
      const dd = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (dd > mr && dd < mr + 7 && (1 - (dd - mr) / 7) * 0.55 > dith(x, y)) set(x, y, '#2a2160');
    }
  }
  const craters = [[-4, -2, 1.8], [3, -4, 1.4], [2, 3, 2.2], [-3, 5, 1.2], [5, 1, 1.1]];
  for (let y = my - 11; y <= my + 11; y++) {
    for (let x = mx - 11; x <= mx + 11; x++) {
      const dx = x + 0.5 - mx, dy = y + 0.5 - my;
      const dd = Math.hypot(dx, dy);
      if (dd > mr) continue;
      let col = '#ffe9a6';
      if (dd > mr - 1.7) col = dx + dy < 2 ? '#ffd79c' : '#e8a456';
      else {
        for (const [ox, oy, rr] of craters) if (Math.hypot(dx - ox, dy - oy) <= rr) col = rr > 1.6 ? '#ee8a64' : '#f2c96a';
        if (dx + dy > 7 && col === '#ffe9a6') col = '#f6d98a';
      }
      set(x, y, col);
    }
  }
  // Monti Lessini in lontananza
  for (let x = 0; x < W; x++) {
    const top = Math.round(121 + 7 * Math.sin(x * 0.043 + 1.2) + 5 * Math.sin(x * 0.11 + 0.3) + 2 * Math.sin(x * 0.29 + 2));
    for (let y = top; y < GROUND_Y; y++) set(x, y, y === top ? '#2f2a6e' : y < top + 3 && dith(x, y) > 0.6 ? '#25205c' : '#1b1848');
  }
  // colline con filari di vigneto
  const hill = (x) => Math.round(147 + 5 * Math.sin(x * 0.028 + 0.6) + 3 * Math.sin(x * 0.075 + 2.1));
  for (let x = 0; x < W; x++) {
    const top = hill(x);
    for (let y = top; y < GROUND_Y; y++) {
      let col = y === top ? '#27235e' : '#121036';
      if (y > top + 2 && (y - top) % 3 === 0 && (x + y) % 4 < 2) col = '#1e1b4c';
      set(x, y, col);
    }
  }
  // il borgo: case, campanile e cipressi
  const rng = makeRng(2002);
  const HOUSE = '#0c0a26';
  const RIDGE = '#2a2360';
  const houses = [
    [12, 16, 7], [31, 12, 9], [45, 17, 6], [84, 15, 8], [101, 12, 10], [115, 16, 6], [163, 17, 7], [182, 12, 9], [196, 16, 6],
  ];
  for (const [hx, hw, hh] of houses) {
    const base = hill(hx + (hw >> 1)) + 3;
    const top = base - hh;
    for (let x = hx; x < hx + hw; x++) for (let y = top; y < GROUND_Y; y++) set(x, y, HOUSE);
    const rh = Math.max(2, Math.floor(hw / 4));
    for (let r = 0; r < rh; r++) {
      for (let x = hx - 1 + r * 2; x <= hx + hw - r * 2; x++) set(x, top - 1 - r, r === rh - 1 ? RIDGE : HOUSE);
    }
    const wy = top + Math.max(2, Math.floor(hh / 2) - 1);
    for (let wx = hx + 2; wx < hx + hw - 3; wx += 4) {
      const v = rng();
      if (v < 0.6) {
        const col = v < 0.38 ? '#ffd23f' : '#ff9a2e';
        set(wx, wy, col);
        set(wx + 1, wy, col);
      }
    }
  }
  // campanile
  const tx = 74, tw = 7, tBase = hill(tx + 3) + 2, tTop = tBase - 30;
  for (let x = tx; x < tx + tw; x++) for (let y = tTop; y < GROUND_Y; y++) set(x, y, HOUSE);
  for (let i = 0; i < 6; i++) for (let x = tx + Math.floor(i / 2); x < tx + tw - Math.floor(i / 2); x++) set(x, tTop - 1 - i, HOUSE);
  set(tx + 3, tTop - 7, HOUSE);
  set(tx + 2, tTop + 3, '#ffd23f');
  set(tx + 3, tTop + 3, '#ffd23f');
  set(tx + 4, tTop + 3, '#ffd23f');
  set(tx + 3, tTop + 2, '#ffe9a6');
  set(tx + 3, tTop + 10, '#ff9a2e');
  // cipressi
  for (const [cxp, ch] of [[8, 17], [50, 21], [124, 18], [131, 24], [158, 16], [214, 20], [236, 18]]) {
    const base = hill(cxp) + 2;
    for (let y = 0; y < ch; y++) {
      const t = y / ch;
      const half = Math.round(Math.sin(Math.min(1, t * 1.15) * Math.PI) * 2.1);
      for (let x = cxp - half; x <= cxp + half; x++) set(x, base - ch + y, '#0a0920');
    }
  }
  // la tovaglia a quadri del bancone
  for (let y = GROUND_Y; y < H; y++) {
    const yy = y - GROUND_Y;
    for (let x = 0; x < W; x++) {
      let col;
      if (yy === 0) col = '#f6e3c0';
      else if (yy === 1) col = ((x >> 3) & 1) ? '#7e1a28' : '#a89a7e';
      else {
        const check = ((x >> 3) + ((yy - 2) >> 3)) & 1;
        const darker = yy > 10 && dith(x, y) < (yy - 10) / 8;
        col = check ? (darker ? '#7a1a27' : '#a82634') : darker ? '#a99a7e' : '#d8c9aa';
      }
      set(x, y, col);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function makeStars() {
  const rng = makeRng(81);
  const out = [];
  while (out.length < 64) {
    const x = Math.floor(rng() * W);
    const y = 15 + Math.floor(rng() * 96);
    if (Math.hypot(x - 214, y - 38) < 19) continue;
    const v = rng();
    out.push({ x, y, c: v < 0.08 ? PAL.q : v < 0.18 ? PAL.y : v < 0.55 ? '#c9c4e6' : '#6f6c9a', ph: rng() * 6.28, sp: 0.6 + rng() * 2.2, big: v > 0.94 });
  }
  return out;
}

/* ---------------------------------------------------------------------
   Renderer
   --------------------------------------------------------------------- */
export class Renderer {
  constructor(ctx, cc) {
    this.g = ctx;
    this.cc = cc;
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    this.font = new PixelFont(cc);
    this.spr = {};
    for (const [k, rows] of Object.entries(SPRITES)) this.spr[k] = rowsToCanvas(cc, rows);
    this.mini = {};
    for (const [k, rows] of Object.entries(MINI)) this.mini[k] = rowsToCanvas(cc, rows);
    this.pizza = rowsToCanvas(cc, PIZZA_ROWS);
    this.pizzaWhite = rowsToCanvas(cc, PIZZA_ROWS, '#ffffff');
    this.pizzaBurnt = rowsToCanvas(cc, PIZZA_ROWS, null, BURNT);
    this.bg = buildBackground(cc);
    this.stars = makeStars();
    this.rand = makeRng(99);
    this.shown = 0;
  }

  render(s, o = {}) {
    const g = this.g;
    const reduced = !!o.reduced;
    const clock = o.clock ?? s.t;
    g.save();
    g.globalAlpha = 1;
    if (!reduced && s.shake > 0) {
      const a = Math.min(4, Math.ceil(s.shake * 11));
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.translate(Math.round((this.rand() * 2 - 1) * a), Math.round((this.rand() * 2 - 1) * a));
    }
    g.drawImage(this.bg, 0, 0);
    this.drawStars(clock, reduced);
    this.drawShadows(s);
    this.drawPlayer(s, reduced);
    this.drawItems(s, reduced);
    this.drawParticles(s);
    if (o.overlay !== 'title') this.drawFloaters(s);
    g.restore();
    if (o.hud) this.drawHud(s);
    if (o.hud && s.banner && !o.overlay) this.drawBanner(s.banner, reduced);
    if (o.overlay === 'title') this.drawTitle(o);
    else if (o.overlay === 'pause') this.drawPause(o);
    else if (o.overlay === 'gameover') this.drawGameOver(s, o);
    if (!reduced && s.flash > 0) {
      g.globalAlpha = Math.min(0.42, s.flash * 3.5);
      g.fillStyle = s.flashColor;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }

  drawStars(t, reduced) {
    const g = this.g;
    for (const st of this.stars) {
      const tw = reduced ? 1 : Math.sin(t * st.sp + st.ph);
      if (tw < -0.75) continue;
      g.fillStyle = st.c;
      g.fillRect(st.x, st.y, 1, 1);
      if (st.big && tw > 0.6) {
        g.fillRect(st.x - 1, st.y, 3, 1);
        g.fillRect(st.x, st.y - 1, 1, 3);
      }
    }
  }

  drawShadows(s) {
    const g = this.g;
    g.fillStyle = '#12051c';
    for (const it of s.items) {
      const p = clamp((it.y + it.h) / GROUND_Y, 0, 1);
      const w = Math.max(2, Math.round(it.w * (0.25 + 0.6 * p)));
      g.globalAlpha = 0.15 + 0.35 * p;
      g.fillRect(Math.round(it.x + it.w / 2 - w / 2), GROUND_Y + 2, w, 1);
    }
    g.globalAlpha = 1;
  }

  drawPlayer(s, reduced) {
    const g = this.g;
    const pl = s.player;
    const x = Math.round(pl.x);
    const y = Math.round(pl.y) + (pl.squash > 0 ? 1 : 0);
    g.fillStyle = 'rgba(14,4,26,0.5)';
    g.fillRect(x + 6, GROUND_Y + 1, pl.w - 12, 1);
    g.fillRect(x + 2, GROUND_Y + 2, pl.w - 4, 1);
    g.fillRect(x + 7, GROUND_Y + 3, pl.w - 14, 1);
    const dead = s.mode === 'dying' || (s.mode === 'gameover' && s.lives <= 0);
    if (dead) {
      g.drawImage(this.pizzaBurnt, x, y);
      for (const tp of s.toppings) {
        g.globalAlpha = 0.45;
        g.drawImage(this.mini[tp.kind], x + tp.x, y + tp.y);
      }
      g.globalAlpha = 1;
      return;
    }
    if (pl.boost > 0 && !reduced) {
      g.globalAlpha = 0.25;
      for (const tr of pl.trail) g.drawImage(this.pizza, Math.round(tr.x), y);
      g.globalAlpha = 1;
    }
    if (pl.hurt > 0) {
      g.drawImage(this.pizzaWhite, x, y);
      return;
    }
    if (pl.inv > 0 && Math.floor(pl.inv * 14) % 2 === 0) return;
    g.drawImage(this.pizza, x, y);
    for (const tp of s.toppings) g.drawImage(this.mini[tp.kind], x + tp.x, y + tp.y);
    if (pl.boost > 0 && Math.floor(s.t * 10) % 2 === 0) {
      g.fillStyle = PAL.o;
      g.fillRect(x + 3, y + 11, pl.w - 6, 1);
    }
  }

  drawItems(s, reduced) {
    const g = this.g;
    for (const it of s.items) {
      let x = Math.round(it.x);
      const y = Math.round(it.y);
      if (it.kind === 'pineapple' && !reduced) x += Math.floor(it.t * 10) & 1;
      g.drawImage(this.spr[it.kind], x, y);
      if (it.kind === 'star') {
        const ph = Math.floor(it.t * 9) % 4;
        const pts = [[-3, 3], [it.w + 1, 2], [it.w - 2, it.h + 1], [-1, it.h - 1]];
        const [px, py] = pts[ph];
        g.fillStyle = PAL.h;
        g.fillRect(x + px, y + py - 1, 1, 3);
        g.fillRect(x + px - 1, y + py, 3, 1);
      }
    }
  }

  drawParticles(s) {
    const g = this.g;
    for (const p of s.particles) {
      if (p.life < 0.18 && Math.floor(p.life * 30) & 1) continue;
      g.fillStyle = PAL[p.c] || p.c;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  drawFloaters(s) {
    for (const f of s.floaters) {
      if (f.life < 0.25 && Math.floor(f.life * 20) & 1) continue;
      this.font.draw(this.g, f.text, f.x, f.y, { color: PAL[f.color] || f.color, align: 'center', outline: OUTLINE });
    }
  }

  drawHud(s) {
    const g = this.g;
    const f = this.font;
    g.fillStyle = 'rgba(5,7,24,0.8)';
    g.fillRect(0, 0, W, 13);
    g.fillStyle = '#2a2f6a';
    g.fillRect(0, 13, W, 1);
    if (s.score < this.shown) this.shown = s.score;
    this.shown = Math.min(s.score, this.shown + Math.max(1, Math.ceil((s.score - this.shown) * 0.2)));
    f.draw(g, 'PUNTI', 4, 3, { color: PAL.q });
    f.draw(g, pad(this.shown, 6), 38, 3, { color: PAL.w });
    f.draw(g, 'LIV ' + s.level, 140, 3, { color: PAL.g, align: 'center' });
    for (let i = 0; i < MAX_LIVES; i++) g.drawImage(i < s.lives ? this.spr.heart : this.spr.heartEmpty, W - 31 + i * 9, 4);
    if (s.mult > 1) f.draw(g, '×' + s.mult + '  COMBO ' + s.combo, 4, 17, { color: PAL.y, outline: OUTLINE });
    const pl = s.player;
    if (pl.boost > 0) {
      f.draw(g, 'TURBO', W - 62, 17, { color: PAL.o, outline: OUTLINE });
      g.fillStyle = OUTLINE;
      g.fillRect(W - 31, 18, 27, 5);
      g.fillStyle = PAL.o;
      g.fillRect(W - 30, 19, Math.ceil((25 * pl.boost) / TURBO_TIME), 3);
    }
  }

  drawBanner(b, reduced) {
    if (!reduced && b.t < 0.25 && Math.floor(b.t * 16) & 1) return;
    const age = b.max - b.t;
    const y = 62 - (!reduced && age < 0.12 ? Math.round((0.12 - age) * 40) : 0);
    this.font.draw(this.g, b.text, W / 2, y, { color: PAL[b.color] || PAL.y, scale: 2, bold: true, align: 'center', outline: OUTLINE, shadow: OUTLINE, shadowOffset: 2 });
  }

  dim(a) {
    const g = this.g;
    g.fillStyle = `rgba(6,8,26,${a})`;
    g.fillRect(0, 0, W, H);
  }

  drawLogo(y) {
    const f = this.font;
    const g = this.g;
    const grad = [PAL.y, PAL.o];
    f.draw(g, 'PIZZA', W / 2, y, { color: grad, scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 3 });
    f.draw(g, 'VOGLIA', W / 2, y + 28, { color: grad, scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 3 });
    const dots = [PAL.r, PAL.g, PAL.b];
    dots.forEach((col, i) => {
      const dx = W / 2 - 14 + i * 11;
      g.fillStyle = OUTLINE;
      g.fillRect(dx - 1, y + 57, 7, 7);
      g.fillStyle = col;
      g.fillRect(dx, y + 58, 5, 5);
    });
  }

  drawTitle(o) {
    const g = this.g;
    const f = this.font;
    const t = o.titleT || 0;
    this.dim(0.6);
    const page = o.reduced ? 0 : Math.floor(t / 7) % 2;
    if (page === 0) {
      this.drawLogo(16);
      f.draw(g, 'ACCHIAPPA GLI INGREDIENTI', W / 2, 89, { color: PAL.g, align: 'center', outline: OUTLINE });
      if (o.reduced || Math.floor(t * 2) % 2 === 0) f.draw(g, 'INSERISCI GETTONE', W / 2, 112, { color: PAL.w, align: 'center', outline: OUTLINE });
      f.draw(g, o.touch ? 'TOCCA LO SCHERMO O START' : 'CLICCA QUI O PREMI START', W / 2, 126, { color: PAL.y, align: 'center', outline: OUTLINE });
      f.draw(g, 'RECORD ' + pad(o.hiscore || 0, 6), W / 2, 150, { color: PAL.q, align: 'center', outline: OUTLINE });
      f.draw(g, 'DENIS FA PIZZA DAL 2002', W / 2, 166, { color: PAL.e, align: 'center', outline: OUTLINE });
    } else {
      f.draw(g, 'TABELLA PUNTI', W / 2, 10, { color: [PAL.y, PAL.o], scale: 2, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 2 });
      const rows = [
        ['tomato', 'POMODORO', '10'],
        ['mozzarella', 'MOZZARELLA', '10'],
        ['basil', 'BASILICO', '10'],
        ['olive', 'OLIVA', '10'],
        ['mushroom', 'FUNGHI', '15'],
        ['salame', 'SALAME', '15'],
        ['chili', 'PEPERONCINO', 'TURBO'],
        ['star', 'STELLA', '100'],
        ['pineapple', 'ANANAS', '-1 VITA'],
      ];
      const shown = Math.min(rows.length, Math.floor((t % 7) * 5));
      rows.forEach(([k, label, pts], i) => {
        if (i >= shown) return;
        const y = 34 + i * 14 + (i === rows.length - 1 ? 4 : 0);
        const spr = this.spr[k];
        g.drawImage(spr, 50 - Math.floor(spr.width / 2), y + 3 - Math.floor(spr.height / 2));
        const bad = k === 'pineapple';
        const lw = f.draw(g, label, 68, y, { color: bad ? PAL.r : PAL.w, outline: OUTLINE });
        const pw = f.width(pts);
        g.fillStyle = PAL.E;
        for (let dx = 68 + lw + 4; dx < 212 - pw - 4; dx += 3) g.fillRect(dx, y + 6, 1, 1);
        f.draw(g, pts, 212, y, { color: bad ? PAL.r : k === 'star' ? PAL.q : PAL.y, align: 'right', outline: OUTLINE });
      });
    }
  }

  drawPause(o) {
    const g = this.g;
    const f = this.font;
    this.dim(0.7);
    f.draw(g, 'PAUSA', W / 2, 58, { color: [PAL.y, PAL.o], scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: PAL.R, shadowOffset: 3 });
    f.draw(g, o.touch ? 'TOCCA PER CONTINUARE' : 'PREMI P PER CONTINUARE', W / 2, 100, { color: PAL.w, align: 'center', outline: OUTLINE });
    f.draw(g, 'LA PIZZA TI ASPETTA', W / 2, 116, { color: PAL.g, align: 'center', outline: OUTLINE });
  }

  drawGameOver(s, o) {
    const g = this.g;
    const f = this.font;
    this.dim(0.74);
    // blocco testi centrato nello spazio libero sopra i pulsanti HTML (o.overTop, in pixel di gioco)
    const free = clamp(o.overTop ?? H, 88, H);
    const y = Math.max(8, Math.round((free - 72) / 2));
    f.draw(g, 'GAME OVER', W / 2, y, { color: [PAL.r, '#e02a3c'], scale: 3, bold: true, align: 'center', outline: OUTLINE, shadow: '#5a0f1e', shadowOffset: 3 });
    f.draw(g, 'PUNTEGGIO ' + pad(s.score, 6), W / 2, y + 30, { color: PAL.y, align: 'center', outline: OUTLINE });
    f.draw(g, 'RECORD    ' + pad(Math.max(s.hiscore, s.score), 6), W / 2, y + 41, { color: PAL.w, align: 'center', outline: OUTLINE });
    if (s.newRecord && (o.reduced || Math.floor((o.clock || 0) * 3) % 2 === 0)) f.draw(g, 'NUOVO RECORD!', W / 2, y + 53, { color: PAL.q, align: 'center', outline: OUTLINE });
    f.draw(g, 'PIZZE SFORNATE ' + s.pizzas + '  ·  LIV ' + s.level, W / 2, y + 65, { color: PAL.g, align: 'center', outline: OUTLINE });
  }
}

/* ---------------------------------------------------------------------
   Icone pixel per la pagina (menu, recensioni, buffet)
   --------------------------------------------------------------------- */
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
  slice: [
    'DDDDDDDDDDD.',
    'CKCCCKCCCKK.',
    '.yyyyyyyyy..',
    '.yrryyyyry..',
    '..rryyyrry..',
    '..yyyyyyy...',
    '...yyrryy...',
    '...yyrry....',
    '....yyy.....',
    '....yy......',
    '.....y......',
  ],
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

/** Disegna un'icona-pizza pixel (24×24) da una specifica: forma, base e condimenti. */
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
  if (spec.shape === 'round') {
    const cx = S / 2, cy = S / 2, R = S / 2 - 0.5, r = R - 2.4;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const dd = Math.hypot(dx, dy);
        if (dd > R) continue;
        if (dd > r) {
          const l = -(dx + dy) / R;
          set(x, y, dd > R - 0.9 && l < 0.1 ? 'K' : l > 0.35 ? 'D' : 'C');
        } else {
          set(x, y, dd > r - 1.7 && dx + dy > r * 0.55 ? baseShade : baseKey);
          if (dd < r - 1.2) area.push([x, y]);
        }
      }
    }
  } else if (spec.shape === 'slice') {
    const x0 = 1, y0 = 6, w = S - 2, h = S - 13;
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
      set(x, y0 + h, 'K');
      set(x, y0 + h + 1, (x * 7) % 5 === 0 ? 't' : 'K');
      set(x, y0 + h + 2, 'Q');
    }
  } else if (spec.shape === 'calzone') {
    const cx = S / 2, cy = 17, R = 10.5;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dy > 2.5 || Math.hypot(dx, dy * 1.05) > R) continue;
        const dd = Math.hypot(dx, dy * 1.05);
        const l = -(dx * 0.5 + dy) / R;
        let k = l > 0.55 ? 'D' : l > 0.1 ? 'C' : 'K';
        if (dd > R - 1.4) k = (Math.floor(Math.atan2(dy, dx) * 8) & 1) ? 'K' : 'Q';
        if (dy > 1.5) k = 'Q';
        set(x, y, k);
      }
    }
    [[9, 10], [14, 12], [11, 14]].forEach(([x, y]) => set(x, y, 'K'));
    [[7, 3], [8, 2], [7, 1], [13, 4], [14, 3], [13, 2], [17, 5], [18, 4]].forEach(([x, y]) => set(x, y, 'e'));
  } else if (spec.shape === 'focaccia') {
    const x0 = 2, y0 = 5, w = S - 4, h = S - 10;
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
    const x0 = 1, y0 = 6, w = S - 2, h = 13;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, y === y0 ? 'e' : x === x0 || x === x0 + w - 1 || y === y0 + h - 1 ? 'E' : 'e');
    for (let x = x0; x < x0 + w; x++) set(x, y0 + h, 'E');
    const cols = ['r', 'y', 'g'];
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 3; i++) {
        const sx = x0 + 2 + i * 7, sy = y0 + 2 + j * 5;
        for (let y = sy; y < sy + 4; y++) for (let x = sx; x < sx + 6; x++) set(x, y, y === sy || x === sx ? 'D' : x === sx + 5 || y === sy + 3 ? 'K' : cols[(i + j) % 3]);
        set(sx + 2, sy + 1, (i + j) % 2 ? 'w' : 'G');
        set(sx + 3, sy + 2, 'w');
      }
    }
  }
  const taken = new Set();
  for (const [kind, count] of spec.top || []) {
    const art = ICON_TOP[kind];
    if (!art) continue;
    const aw = art[0].length, ah = art.length;
    for (let n = 0; n < count; n++) {
      for (let tries = 0; tries < 40; tries++) {
        const [ax, ay] = area[Math.floor(rng() * area.length)] || [0, 0];
        const ox = ax - (aw >> 1), oy = ay - (ah >> 1);
        let ok = true;
        for (let j = 0; j < ah && ok; j++) {
          for (let i = 0; i < aw; i++) {
            if (art[j][i] === '.') continue;
            const key = (oy + j) * S + (ox + i);
            if (taken.has(key) || !area.some(([qx, qy]) => qx === ox + i && qy === oy + j)) {
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
  return rowsToCanvas(cc, rows);
}

/* ---------------------------------------------------------------------
   Audio 8-bit (WebAudio, solo dopo un gesto dell'utente)
   --------------------------------------------------------------------- */
const NOTE = { G3: 196, C4: 261.63, E4: 329.63, G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, B5: 987.77, C6: 1046.5, E6: 1318.51, G6: 1567.98 };

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
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
    if (!this.noise) {
      const len = Math.floor(c.sampleRate * 0.6);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    const src = c.createBufferSource();
    src.buffer = this.noise;
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
  play(name, arg = 0) {
    if (!this.on || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + 0.01;
      const arp = (notes, step, dur, vol = 0.26, type = 'square') => notes.forEach((f, i) => this.tone(type, f, f, t + i * step, dur, vol));
      switch (name) {
        case 'catch': {
          const f = NOTE.C5 * Math.pow(2, Math.min(arg, 18) / 12);
          this.tone('square', f, f, t, 0.05, 0.26);
          this.tone('square', f * 1.5, f * 1.5, t + 0.045, 0.07, 0.22);
          break;
        }
        case 'bonus':
          arp([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6], 0.055, 0.09);
          break;
        case 'combo':
          arp([NOTE.G5, NOTE.C6, NOTE.E6], 0.05, 0.08, 0.22);
          break;
        case 'turbo':
          this.tone('sawtooth', 200, 1200, t, 0.32, 0.18);
          break;
        case 'hit':
          this.hiss(t, 0.3, 0.55, 2600, 160);
          this.tone('square', 320, 70, t, 0.34, 0.3);
          break;
        case 'dead':
          this.hiss(t, 0.7, 0.45, 1800, 90);
          break;
        case 'miss':
          this.tone('triangle', 190, 90, t, 0.09, 0.28);
          break;
        case 'levelup':
          arp([NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.07, 0.11, 0.24);
          break;
        case 'complete':
          arp([NOTE.C5, NOTE.E5, NOTE.G5], 0.08, 0.1, 0.24);
          this.tone('square', NOTE.C6, NOTE.C6, t + 0.24, 0.38, 0.26);
          this.tone('triangle', NOTE.C5, NOTE.C5, t + 0.24, 0.38, 0.3);
          break;
        case 'start':
          this.tone('square', NOTE.B5, NOTE.B5, t, 0.08, 0.24);
          this.tone('square', NOTE.E6, NOTE.E6, t + 0.08, 0.42, 0.24);
          break;
        case 'gameover':
          [NOTE.G4, NOTE.E4, NOTE.C4, NOTE.G3].forEach((f, i) => {
            this.tone('square', f, f, t + i * 0.22, i === 3 ? 0.7 : 0.2, 0.24);
            this.tone('triangle', f / 2, f / 2, t + i * 0.22, i === 3 ? 0.7 : 0.2, 0.3);
          });
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
      /* audio non disponibile: si gioca in silenzio */
    }
  }
}

/* ---------------------------------------------------------------------
   Controller DOM
   --------------------------------------------------------------------- */
const HI_KEY = 'pizzavoglia-arcade-record';
function readHi() {
  try {
    return Math.max(0, parseInt(window.localStorage.getItem(HI_KEY), 10) || 0);
  } catch (err) {
    return 0;
  }
}
function writeHi(v) {
  try {
    window.localStorage.setItem(HI_KEY, String(v));
  } catch (err) {
    /* storage non disponibile */
  }
}

/**
 * Monta il gioco nel cabinato.
 * @param {object} el  { cabinet, screen, canvas, start, left, right, over, replay, live }
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
  let hi = readHi();
  const game = createState({ seed: (Date.now() ^ 0x5f3759df) >>> 0, hiscore: hi });
  let demo = newDemo();
  let titleT = 0;
  let clock = 0;
  let overAt = 0;
  let raf = 0;
  let last = 0;
  let inView = true;
  let pageVisible = !document.hidden;
  let lastDir = 0;
  const keys = { left: false, right: false };
  const btn = { left: false, right: false };
  let pointerX = null;
  let pointerId = null;
  let mouseX = null;

  function newDemo() {
    const d = createState({ seed: 20020 + Math.floor(Math.random() * 9999), demo: true });
    startRun(d);
    d.banner = null;
    for (let i = 0; i < 150; i++) update(d, 1 / 60, autopilot(d));
    d.particles.length = 0;
    d.floaters.length = 0;
    d.banner = null;
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
      const aria = game.mode === 'playing' ? 'Metti in pausa' : game.mode === 'paused' ? 'Riprendi la partita' : 'Inizia la partita';
      const span = el.start.querySelector('[data-label]');
      if (span) span.textContent = label;
      el.start.setAttribute('aria-label', aria);
    }
    if (el.over) el.over.hidden = game.mode !== 'gameover';
  }

  function fit() {
    const avail = screen.clientWidth;
    if (!avail) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const wide = window.matchMedia('(min-width: 960px)').matches;
    const maxH = wide ? Math.max(220, window.innerHeight - 330) : Infinity;
    let s = Math.min(avail / W, maxH / H);
    const dev = s * dpr;
    let k = Math.max(1, Math.ceil(dev - 0.001));
    const fl = Math.floor(dev + 0.001);
    if (fl >= 1 && fl / dev >= 0.9) {
      s = fl / dpr;
      k = fl;
    }
    // il canvas visibile è un multiplo intero (max 4×) del buffer 256×192:
    // se il browser deve solo ridurlo resta nitido; se dovesse ingrandirlo, niente sfocatura
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
    return { left, right, targetX: left || right ? null : pointerX ?? mouseX };
  }

  let overTop = H;
  function measureOver() {
    overTop = H;
    if (!el.over || el.over.hidden) return;
    const r = canvas.getBoundingClientRect();
    const b = el.over.querySelector('button, a');
    if (!r.height || !b) return;
    overTop = ((b.getBoundingClientRect().top - r.top) / r.height) * H - 4;
  }

  function draw() {
    const o = { reduced, touch, clock, titleT, overTop, hiscore: Math.max(hi, game.hiscore) };
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
        if (demo.mode === 'gameover') demo = newDemo();
      }
    } else if (game.mode !== 'paused') {
      const ev = update(game, dt, input());
      if (ev.length) handle(ev);
    }
    const dir = game.mode === 'playing' ? game.player.dir : 0;
    if (dir !== lastDir) {
      lastDir = dir;
      cabinet.dataset.dir = String(dir);
    }
  }

  function handle(evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'catch':
          sfx.play('catch', e.combo);
          break;
        case 'bonus':
          sfx.play('bonus');
          break;
        case 'combo':
          sfx.play('combo');
          break;
        case 'turbo':
          sfx.play('turbo');
          break;
        case 'miss':
          sfx.play('miss');
          break;
        case 'complete':
          sfx.play('complete');
          break;
        case 'levelup':
          sfx.play('levelup');
          say(`Livello ${e.level}!`);
          break;
        case 'hit':
          sfx.play('hit');
          if (e.lives > 0) say(`Ananas! ${e.lives === 1 ? 'Ultima vita' : `Restano ${e.lives} vite`}.`);
          break;
        case 'dead':
          sfx.play('dead');
          break;
        case 'gameover':
          onOver(e);
          break;
        default:
          break;
      }
    }
  }

  function onOver(e) {
    overAt = performance.now();
    if (e.score > hi) {
      hi = e.score;
      writeHi(hi);
    }
    sfx.play('gameover');
    releaseAll();
    setMode();
    measureOver();
    say(`Game over. Punteggio ${e.score}. Record ${hi}.${e.newRecord ? ' Nuovo record!' : ''}`);
    if (document.activeElement === canvas && el.replay) el.replay.focus({ preventScroll: true });
  }

  function releaseAll() {
    keys.left = keys.right = btn.left = btn.right = false;
    pointerX = null;
    pointerId = null;
    mouseX = null;
    el.left && el.left.classList.remove('is-down');
    el.right && el.right.classList.remove('is-down');
  }

  function start() {
    if (game.mode === 'gameover' && performance.now() - overAt < 650) return;
    game.hiscore = hi;
    startRun(game);
    renderer.shown = 0;
    releaseAll();
    setMode();
    sfx.play('start');
    say('Partita iniziata: muovi la pizza con le frecce e prendi gli ingredienti.');
    if (document.activeElement !== canvas) canvas.focus({ preventScroll: true });
    ensureLoop();
  }
  function pause() {
    if (game.mode !== 'playing') return;
    game.mode = 'paused';
    releaseAll();
    setMode();
    sfx.play('pause');
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
  }
  function ensureLoop() {
    if (!raf && shouldRun()) {
      last = 0;
      raf = window.requestAnimationFrame(frame);
    }
  }

  const toGameX = (clientX) => {
    const r = canvas.getBoundingClientRect();
    return r.width ? ((clientX - r.left) / r.width) * W : null;
  };
  const press = (side, on) => {
    const b = side === 'left' ? el.left : el.right;
    if (b) b.classList.toggle('is-down', on);
  };

  const LEFT = new Set(['ArrowLeft', 'a', 'A']);
  const RIGHT = new Set(['ArrowRight', 'd', 'D']);
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement;
    if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) return;
    const onCanvas = active === canvas;
    const k = e.key;
    if (game.mode === 'playing') {
      if (LEFT.has(k) && inView) {
        keys.left = true;
        mouseX = null;
        press('left', true);
        e.preventDefault();
      } else if (RIGHT.has(k) && inView) {
        keys.right = true;
        mouseX = null;
        press('right', true);
        e.preventDefault();
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        pause();
        e.preventDefault();
      } else if (onCanvas && (k === ' ' || k === 'Enter' || k === 'ArrowUp' || k === 'ArrowDown')) {
        e.preventDefault();
      }
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
      start();
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (LEFT.has(e.key)) {
      keys.left = false;
      press('left', false);
    }
    if (RIGHT.has(e.key)) {
      keys.right = false;
      press('right', false);
    }
  });

  canvas.addEventListener('click', () => {
    if (game.mode === 'title') start();
    else if (game.mode === 'paused') resume();
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (game.mode !== 'playing') return;
    pointerId = e.pointerId;
    pointerX = toGameX(e.clientX);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ok */
    }
    if (e.pointerType !== 'mouse') e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (game.mode !== 'playing') return;
    if (e.pointerId === pointerId) pointerX = toGameX(e.clientX);
    else if (e.pointerType === 'mouse') mouseX = toGameX(e.clientX);
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
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') mouseX = null;
  });

  function bindHold(button, side) {
    if (!button) return;
    const up = () => {
      btn[side] = false;
      press(side, false);
    };
    button.addEventListener('pointerdown', (e) => {
      if (game.mode === 'title') {
        start();
        return;
      }
      if (game.mode !== 'playing') return;
      btn[side] = true;
      press(side, true);
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
      btn[side] = true;
      press(side, true);
      window.setTimeout(up, 160);
    });
  }
  bindHold(el.left, 'left');
  bindHold(el.right, 'right');

  if (el.start) {
    el.start.addEventListener('click', () => {
      if (game.mode === 'playing') pause();
      else if (game.mode === 'paused') resume();
      else start();
    });
  }
  if (el.replay) el.replay.addEventListener('click', () => start());

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
