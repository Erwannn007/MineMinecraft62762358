// Textures pixel art 16x16 générées procéduralement, sprites isométriques et icônes.
import { mulberry32 } from './noise.js';
import { BLOCKS, ITEMS, B, I } from './blocks.js';

const S = 16;

class Tex {
  constructor() { this.d = new Uint8ClampedArray(S * S * 4); }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = c[3] ?? 255;
  }
  get(x, y) {
    const i = (((y + S) % S) * S + ((x + S) % S)) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  alpha(x, y) {
    if (x < 0 || y < 0 || x >= S || y >= S) return 0;
    return this.d[(y * S + x) * 4 + 3];
  }
  clone() { const t = new Tex(); t.d.set(this.d); return t; }
}

const sh = (c, f) => [c[0] * f, c[1] * f, c[2] * f, c[3] ?? 255];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Champ aléatoire lissé (bords bouclés pour que la texture se répète).
function field(r, blur = 1) {
  let f = new Float32Array(S * S);
  for (let i = 0; i < f.length; i++) f[i] = r();
  for (let k = 0; k < blur; k++) {
    const g = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        s += f[((y + dy + S) % S) * S + ((x + dx + S) % S)];
      }
      g[y * S + x] = s / 9;
    }
    f = g;
  }
  let mn = Infinity, mx = -Infinity;
  for (const v of f) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - mn) / (mx - mn || 1);
  return f;
}

function noisy(t, r, base, amt, blur = 1, bias = 0.85) {
  const f = field(r, blur);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = bias + f[y * S + x] * amt + (r() - 0.5) * amt * 0.4;
    v = Math.round(v * 10) / 10;
    t.set(x, y, sh(base, v));
  }
}

function cobbleLike(t, r, base, mortar) {
  const pts = [];
  for (let i = 0; i < 11; i++) pts.push([r() * S, r() * S, 0.78 + r() * 0.3]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = 1e9, d2 = 1e9, best = 0, bdx = 0, bdy = 0;
    pts.forEach((p, i) => {
      let dx = x + 0.5 - p[0], dy = y + 0.5 - p[1];
      if (dx > 8) dx -= 16; if (dx < -8) dx += 16;
      if (dy > 8) dy -= 16; if (dy < -8) dy += 16;
      const d = Math.hypot(dx, dy);
      if (d < d1) { d2 = d1; d1 = d; best = i; bdx = dx; bdy = dy; } else if (d < d2) d2 = d;
    });
    if (d2 - d1 < 0.9) t.set(x, y, sh(mortar, 0.9 + r() * 0.2));
    else {
      let v = pts[best][2] + (r() - 0.5) * 0.08;
      if (bdx + bdy < -1.5) v *= 1.14; else if (bdx + bdy > 2) v *= 0.88;
      t.set(x, y, sh(base, v));
    }
  }
}

function dirtTex(t, r) {
  noisy(t, r, [134, 96, 67], 0.3, 1, 0.82);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = r();
    if (k < 0.07) t.set(x, y, [100, 72, 50]);
    else if (k < 0.11) t.set(x, y, [158, 120, 86]);
  }
}

function grassPixel(r) {
  const k = r();
  if (k < 0.08) return [122, 186, 72];
  if (k < 0.16) return [74, 128, 40];
  return sh([96, 160, 54], 0.88 + r() * 0.2);
}

function planks(t, r, base) {
  for (let y = 0; y < S; y++) {
    const board = y >> 2;
    for (let x = 0; x < S; x++) {
      let v = 0.92 + Math.sin((x + board * 5) * 1.3) * 0.04 + (r() - 0.5) * 0.08;
      if ((y & 3) === 3) v = 0.62;
      t.set(x, y, sh(base, v));
    }
  }
  for (let b = 0; b < 4; b++) {
    const sx = (b * 7 + 3 + Math.floor(r() * 4)) % S;
    for (let y = b * 4; y < b * 4 + 3; y++) t.set(sx, y, sh(base, 0.68));
  }
}

function logSide(t, r, base, dark) {
  const cols = [];
  for (let x = 0; x < S; x++) cols.push(0.82 + r() * 0.26);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = cols[x] + (r() - 0.5) * 0.1;
    t.set(x, y, sh(base, v));
  }
  for (let k = 0; k < 10; k++) {
    const x = Math.floor(r() * S), y0 = Math.floor(r() * S), len = 2 + Math.floor(r() * 5);
    for (let i = 0; i < len; i++) t.set(x, (y0 + i) % S, dark);
  }
}

function logTop(t, r, ring1, ring2, bark) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.6) t.set(x, y, sh(bark, 0.9 + r() * 0.2));
    else t.set(x, y, sh(Math.floor(d) % 2 ? ring1 : ring2, 0.95 + r() * 0.1));
  }
}

function leaves(t, r, base) {
  const f = field(r, 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0.7 + f[y * S + x] * 0.45 + (r() - 0.5) * 0.2;
    if (r() < 0.1) v = 0.5;
    t.set(x, y, sh(base, Math.round(v * 8) / 8));
  }
}

function ore(t, r, c1, c2) {
  GEN.stone(t, r);
  const n = 4 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const cx = 2 + Math.floor(r() * 12), cy = 2 + Math.floor(r() * 12);
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    const cnt = 3 + Math.floor(r() * 3);
    for (let i = 0; i < cnt; i++) {
      const [dx, dy] = cells[i];
      t.set(cx + dx, cy + dy, i === 0 ? c2 : c1);
    }
  }
}

function sideWithTop(t, r, topColorFn, depthBase) {
  dirtTex(t, r);
  for (let x = 0; x < S; x++) {
    let depth = depthBase + (r() < 0.55 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
    for (let y = 0; y < depth; y++) t.set(x, y, topColorFn(r));
  }
}

function wool(base) {
  return (t, r) => {
    const f = field(r, 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 0.9 + f[y * S + x] * 0.12 + (r() - 0.5) * 0.06;
      if (((x + y * 3) & 7) === 0) v *= 0.93;
      t.set(x, y, sh(base, v));
    }
  };
}

function line(t, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    t.set(Math.round(x0 + (x1 - x0) * i / (n || 1)), Math.round(y0 + (y1 - y0) * i / (n || 1)), c);
  }
}

const GEN = {
  grass_top(t, r) { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) t.set(x, y, grassPixel(r)); },
  grass_side(t, r) { sideWithTop(t, r, grassPixel, 3); },
  dirt: dirtTex,
  stone(t, r) {
    const f = field(r, 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 0.8 + f[y * S + x] * 0.28 + (r() - 0.5) * 0.08;
      t.set(x, y, sh([126, 126, 126], Math.round(v * 12) / 12));
    }
  },
  cobble(t, r) { cobbleLike(t, r, [122, 122, 122], [62, 62, 62]); },
  mossy_cobble(t, r) {
    cobbleLike(t, r, [118, 120, 116], [58, 62, 56]);
    const f = field(r, 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (f[y * S + x] > 0.55 && r() < 0.85) t.set(x, y, sh([82, 122, 52], 0.85 + r() * 0.3));
    }
  },
  sand(t, r) {
    noisy(t, r, [219, 210, 158], 0.08, 1, 0.94);
    for (let i = 0; i < 18; i++) t.set(Math.floor(r() * S), Math.floor(r() * S), [196, 182, 132]);
  },
  gravel(t, r) {
    const pal = [[156, 150, 146], [124, 118, 114], [96, 90, 88], [176, 166, 156], [110, 104, 96]];
    const f = field(r, 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = clamp(Math.floor((f[y * S + x] * 0.6 + r() * 0.4) * pal.length), 0, pal.length - 1);
      t.set(x, y, pal[k]);
    }
  },
  water(t, r) {
    const f = field(r, 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 0.88 + f[y * S + x] * 0.16;
      t.set(x, y, [46 * v, 94 * v, 206 * v, 175]);
    }
    for (let k = 0; k < 7; k++) {
      const y = Math.floor(r() * S), x0 = Math.floor(r() * S), len = 2 + Math.floor(r() * 4);
      for (let i = 0; i < len; i++) t.set((x0 + i) % S, y, [96, 146, 232, 185]);
    }
  },
  oak_log(t, r) { logSide(t, r, [104, 82, 50], [70, 54, 32]); },
  oak_log_top(t, r) { logTop(t, r, [176, 142, 86], [152, 120, 70], [104, 82, 50]); },
  oak_leaves(t, r) { leaves(t, r, [62, 128, 36]); },
  oak_planks(t, r) { planks(t, r, [166, 134, 80]); },
  birch_planks(t, r) { planks(t, r, [200, 182, 126]); },
  spruce_planks(t, r) { planks(t, r, [116, 86, 50]); },
  glass(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) t.set(x, y, [200, 225, 235, 28]);
    for (let i = 0; i < S; i++) {
      t.set(i, 0, [220, 238, 242]); t.set(i, 15, [190, 214, 222]);
      t.set(0, i, [220, 238, 242]); t.set(15, i, [190, 214, 222]);
    }
    line(t, 3, 6, 6, 3, [240, 248, 250, 200]);
    line(t, 4, 9, 9, 4, [240, 248, 250, 160]);
    line(t, 10, 13, 13, 10, [240, 248, 250, 160]);
  },
  bedrock(t, r) {
    const pal = [[30, 30, 30], [56, 56, 56], [86, 86, 86], [118, 118, 118]];
    const f = field(r, 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      t.set(x, y, pal[clamp(Math.floor((f[y * S + x] * 0.5 + r() * 0.5) * 4), 0, 3)]);
    }
  },
  coal_ore(t, r) { ore(t, r, [44, 44, 44], [70, 70, 70]); },
  iron_ore(t, r) { ore(t, r, [210, 168, 138], [236, 204, 180]); },
  gold_ore(t, r) { ore(t, r, [246, 214, 60], [255, 248, 160]); },
  diamond_ore(t, r) { ore(t, r, [92, 228, 222], [200, 255, 252]); },
  snow(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      t.set(x, y, r() < 0.12 ? [222, 234, 242] : sh([246, 252, 252], 0.96 + r() * 0.04));
    }
  },
  snow_grass_side(t, r) {
    sideWithTop(t, r, (rr) => (rr() < 0.15 ? [222, 234, 242] : [246, 252, 252]), 3);
  },
  ice(t, r) {
    const f = field(r, 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 0.9 + f[y * S + x] * 0.14;
      t.set(x, y, [146 * v, 186 * v, 248 * v, 215]);
    }
    line(t, 2, 12, 7, 7, [220, 236, 255, 230]);
    line(t, 9, 14, 14, 9, [220, 236, 255, 230]);
    line(t, 5, 4, 7, 2, [220, 236, 255, 230]);
  },
  cactus_side(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 0.95 + (r() - 0.5) * 0.12;
      if (x % 5 === 2) v = 0.76;
      if (x === 0 || x === 15) v = 0.7;
      t.set(x, y, sh([88, 144, 46], v));
    }
    for (let k = 0; k < 9; k++) t.set(1 + Math.floor(r() * 14), Math.floor(r() * S), [228, 226, 186]);
  },
  cactus_top(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      let c = d > 6.6 ? [62, 104, 32] : d > 4.6 ? [96, 152, 54] : [116, 170, 70];
      t.set(x, y, sh(c, 0.94 + r() * 0.1));
    }
  },
  sandstone(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 0.97 + (r() - 0.5) * 0.06;
      if (y <= 2) v = 1.04;
      if (y === 3 || y === 12) v = 0.86;
      if (y >= 13) v = 0.92 + (r() - 0.5) * 0.06;
      t.set(x, y, sh([216, 202, 152], v));
    }
  },
  sandstone_top(t, r) { noisy(t, r, [218, 205, 156], 0.06, 1, 0.96); },
  birch_log(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) t.set(x, y, sh([214, 212, 206], 0.94 + r() * 0.08));
    for (let k = 0; k < 9; k++) {
      const y = Math.floor(r() * S), x0 = Math.floor(r() * S), len = 2 + Math.floor(r() * 3);
      const c = r() < 0.7 ? [44, 44, 40] : [150, 150, 140];
      for (let i = 0; i < len; i++) t.set((x0 + i) % S, y, c);
    }
  },
  birch_log_top(t, r) { logTop(t, r, [198, 178, 126], [182, 162, 112], [214, 212, 206]); },
  birch_leaves(t, r) { leaves(t, r, [110, 152, 70]); },
  spruce_log(t, r) { logSide(t, r, [64, 46, 26], [42, 30, 16]); },
  spruce_log_top(t, r) { logTop(t, r, [114, 84, 50], [98, 72, 42], [64, 46, 26]); },
  spruce_leaves(t, r) { leaves(t, r, [50, 88, 56]); },
  tall_grass(t, r) {
    for (let b = 0; b < 9; b++) {
      const x0 = 1 + r() * 13, h = 5 + Math.floor(r() * 9), lean = (r() - 0.5) * 0.5;
      for (let i = 0; i < h; i++) {
        t.set(Math.round(x0 + lean * i), 15 - i, sh([92, 156, 52], 0.75 + (i / h) * 0.4));
      }
    }
  },
  flower_red(t, r) {
    line(t, 7, 15, 7, 8, [58, 128, 40]);
    t.set(6, 12, [70, 146, 48]); t.set(5, 11, [70, 146, 48]); t.set(8, 11, [70, 146, 48]); t.set(9, 10, [70, 146, 48]);
    for (let y = 4; y <= 6; y++) for (let x = 6; x <= 8; x++) t.set(x, y, [206, 32, 30]);
    t.set(7, 3, [206, 32, 30]); t.set(5, 5, [206, 32, 30]); t.set(9, 5, [206, 32, 30]); t.set(7, 7, [170, 24, 24]);
    t.set(6, 4, [240, 86, 76]); t.set(7, 5, [70, 20, 14]);
  },
  flower_yellow(t, r) {
    line(t, 7, 15, 7, 9, [58, 128, 40]);
    t.set(8, 12, [70, 146, 48]); t.set(9, 11, [70, 146, 48]); t.set(6, 13, [70, 146, 48]);
    for (let y = 5; y <= 7; y++) for (let x = 6; x <= 8; x++) t.set(x, y, [244, 220, 40]);
    t.set(7, 4, [244, 220, 40]); t.set(5, 6, [244, 220, 40]); t.set(9, 6, [244, 220, 40]); t.set(7, 8, [214, 180, 30]);
    t.set(6, 5, [255, 246, 140]); t.set(7, 6, [255, 236, 90]);
  },
  dead_bush(t, r) {
    const c = [132, 92, 44];
    line(t, 7, 15, 7, 9, c); line(t, 7, 11, 3, 7, c); line(t, 7, 10, 11, 5, c);
    line(t, 5, 9, 4, 11, c); line(t, 9, 7, 12, 8, c); line(t, 4, 7, 2, 6, [110, 76, 36]);
    line(t, 11, 5, 12, 3, [110, 76, 36]);
  },
  torch(t, r) {
    for (let y = 6; y < 16; y++) { t.set(7, y, [128, 98, 56]); t.set(8, y, [96, 72, 40]); }
    t.set(7, 5, [255, 196, 60]); t.set(8, 5, [255, 170, 40]);
    t.set(7, 4, [255, 236, 140]); t.set(8, 4, [255, 214, 90]);
    t.set(7, 3, [255, 252, 220]);
  },
  crafting_top(t, r) {
    planks(t, r, [166, 134, 80]);
    for (let i = 0; i < S; i++) { t.set(i, 0, [92, 66, 36]); t.set(i, 15, [92, 66, 36]); t.set(0, i, [92, 66, 36]); t.set(15, i, [92, 66, 36]); }
    for (let i = 3; i <= 12; i++) { t.set(i, 3, [110, 82, 46]); t.set(i, 12, [110, 82, 46]); t.set(3, i, [110, 82, 46]); t.set(12, i, [110, 82, 46]); t.set(i, 7, [130, 98, 56]); t.set(7, i, [130, 98, 56]); }
  },
  crafting_side(t, r) {
    planks(t, r, [150, 116, 66]);
    for (let x = 0; x < S; x++) { t.set(x, 0, [120, 92, 52]); t.set(x, 1, [176, 142, 86]); t.set(x, 2, [92, 66, 36]); }
    // scie
    for (let x = 2; x <= 7; x++) for (let y = 6; y <= 8; y++) t.set(x, y, [168, 168, 170]);
    for (let x = 2; x <= 7; x += 2) t.set(x, 9, [120, 120, 124]);
    t.set(8, 7, [96, 70, 40]); t.set(9, 7, [96, 70, 40]);
    // marteau
    for (let y = 6; y <= 13; y++) t.set(12, y, [110, 82, 46]);
    for (let x = 10; x <= 14; x++) { t.set(x, 5, [140, 140, 144]); t.set(x, 6, [110, 110, 114]); }
  },
  crafting_front(t, r) {
    planks(t, r, [150, 116, 66]);
    for (let x = 0; x < S; x++) { t.set(x, 0, [120, 92, 52]); t.set(x, 1, [176, 142, 86]); t.set(x, 2, [92, 66, 36]); }
    // pioche et pinces
    line(t, 4, 13, 9, 8, [110, 82, 46]);
    line(t, 6, 5, 10, 5, [150, 150, 154]); line(t, 10, 5, 12, 7, [150, 150, 154]); line(t, 6, 5, 5, 7, [150, 150, 154]);
    for (let y = 9; y <= 13; y++) t.set(12, y, [140, 140, 144]);
    t.set(11, 9, [140, 140, 144]); t.set(13, 9, [140, 140, 144]);
  },
  smooth_stone(t, r) {
    noisy(t, r, [160, 160, 160], 0.06, 1, 0.95);
    for (let i = 0; i < S; i++) { t.set(i, 15, [118, 118, 118]); t.set(i, 0, [176, 176, 176]); }
  },
  furnace_side(t, r) {
    noisy(t, r, [120, 120, 120], 0.12, 1, 0.9);
    for (let i = 0; i < S; i++) { t.set(i, 0, [150, 150, 150]); t.set(i, 15, [76, 76, 76]); t.set(0, i, [96, 96, 96]); t.set(15, i, [86, 86, 86]); }
  },
  furnace_top(t, r) {
    GEN.furnace_side(t, r);
    for (let i = 3; i <= 12; i++) { t.set(i, 3, [92, 92, 92]); t.set(i, 12, [140, 140, 140]); t.set(3, i, [92, 92, 92]); t.set(12, i, [140, 140, 140]); }
  },
  furnace_front(t, r) {
    GEN.furnace_side(t, r);
    for (let y = 8; y <= 13; y++) for (let x = 3; x <= 12; x++) t.set(x, y, [26, 26, 26]);
    for (let x = 3; x <= 12; x++) { t.set(x, 7, [72, 72, 72]); t.set(x, 14, [72, 72, 72]); }
    for (let x = 4; x <= 11; x += 2) t.set(x, 10, [52, 52, 52]);
    t.set(5, 13, [120, 50, 20]); t.set(8, 13, [140, 60, 24]); t.set(10, 13, [110, 44, 18]);
    for (let x = 4; x <= 11; x++) t.set(x, 3, [96, 96, 96]);
  },
  chest_side(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      t.set(x, y, sh([164, 112, 44], 0.9 + Math.sin(x * 1.7 + y * 0.3) * 0.04 + (r() - 0.5) * 0.08));
    }
    for (let i = 0; i < S; i++) { t.set(i, 0, [70, 46, 18]); t.set(i, 15, [70, 46, 18]); t.set(0, i, [70, 46, 18]); t.set(15, i, [70, 46, 18]); t.set(i, 5, [70, 46, 18]); }
  },
  chest_front(t, r) {
    GEN.chest_side(t, r);
    for (let y = 4; y <= 7; y++) for (let x = 7; x <= 8; x++) t.set(x, y, [206, 206, 206]);
    t.set(6, 4, [50, 50, 50]); t.set(9, 4, [50, 50, 50]); t.set(6, 7, [50, 50, 50]); t.set(9, 7, [50, 50, 50]);
    t.set(7, 8, [60, 60, 60]); t.set(8, 8, [60, 60, 60]);
  },
  chest_top(t, r) {
    GEN.chest_side(t, r);
    for (let i = 1; i < 15; i++) t.set(i, 5, sh([164, 112, 44], 0.9));
  },
  bricks(t, r) {
    const shades = {};
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const row = y >> 2, off = row % 2 ? 4 : 0;
      const bx = Math.floor((x + off) / 8);
      if ((y & 3) === 3 || ((x + off) & 7) === 7) t.set(x, y, sh([182, 172, 160], 0.92 + r() * 0.1));
      else {
        const key = row + ':' + bx;
        if (!(key in shades)) shades[key] = 0.84 + r() * 0.26;
        t.set(x, y, sh([150, 72, 54], shades[key] + (r() - 0.5) * 0.08));
      }
    }
  },
  stone_bricks(t, r) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const row = y >> 3, off = row % 2 ? 8 : 0;
      const lx = (x + off) & 15, ly = y & 7;
      let c = sh([124, 124, 124], 0.94 + (r() - 0.5) * 0.08);
      if (ly === 7 || lx === 15) c = [74, 74, 74];
      else if (ly === 0 || lx === 0) c = [150, 150, 150];
      else if (ly === 6 || lx === 14) c = [100, 100, 100];
      t.set(x, y, c);
    }
  },
  bookshelf(t, r) {
    planks(t, r, [166, 134, 80]);
    const pal = [[150, 40, 36], [44, 70, 150], [60, 120, 50], [170, 140, 60], [110, 50, 120], [40, 110, 110]];
    for (const [y0, y1] of [[2, 6], [9, 13]]) {
      for (let x = 1; x < 15; x += 2) {
        const c = pal[Math.floor(r() * pal.length)], top = y0 + (r() < 0.3 ? 1 : 0);
        for (let y = y0; y <= y1; y++) {
          if (y < top) { t.set(x, y, [40, 28, 16]); t.set(x + 1, y, [40, 28, 16]); continue; }
          t.set(x, y, c); t.set(x + 1, y, sh(c, 0.7));
        }
      }
      for (let x = 0; x < S; x++) t.set(x, y1 + 1, [92, 66, 36]);
    }
  },
  lamp(t, r) {
    const f = field(r, 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = f[y * S + x];
      t.set(x, y, v > 0.62 ? [255, 236, 160] : v > 0.35 ? [232, 186, 96] : [150, 104, 52]);
    }
  },
  obsidian(t, r) {
    const f = field(r, 1);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = f[y * S + x];
      t.set(x, y, v > 0.75 ? [64, 44, 96] : v > 0.4 ? [30, 22, 46] : [16, 12, 26]);
    }
  },
  clay(t, r) { noisy(t, r, [160, 166, 180], 0.1, 1, 0.92); },
};

const WOOL_COLORS = {
  white: [234, 236, 237], red: [161, 39, 34], orange: [240, 118, 19], yellow: [248, 197, 39],
  lime: [112, 185, 25], green: [84, 109, 27], cyan: [21, 137, 145], blue: [53, 57, 157],
  purple: [121, 42, 172], pink: [237, 141, 172], gray: [62, 68, 71], black: [26, 27, 31], brown: [114, 71, 40],
};
for (const k in WOOL_COLORS) GEN['wool_' + k] = wool(WOOL_COLORS[k]);

// ---------- Génération ----------
export const TEX = {};
let seedCounter = 1;
for (const name in GEN) {
  const t = new Tex();
  GEN[name](t, mulberry32(0xbeef + seedCounter++ * 7919));
  TEX[name] = t;
}

function texToCanvas(t, scale = 1) {
  const c = document.createElement('canvas');
  c.width = S * scale; c.height = S * scale;
  const g = c.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(t.d), S, S);
  if (scale === 1) g.putImageData(img, 0, 0);
  else {
    const tmp = document.createElement('canvas');
    tmp.width = S; tmp.height = S;
    tmp.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, 0, 0, S * scale, S * scale);
  }
  return c;
}

// Faces isométriques dans une cellule 32x32.
// top : losange (0..31, 0..15) ; left (face +y) ; right (face +x).
function paintFace(img, t, face, shade, alphaMul = 1) {
  const d = img.data;
  const put = (c, r, u, v) => {
    u = clamp(Math.floor(u), 0, 15); v = clamp(Math.floor(v), 0, 15);
    const si = (v * S + u) * 4;
    const a = t.d[si + 3];
    if (a === 0) return;
    const di = (r * 32 + c) * 4;
    d[di] = t.d[si] * shade; d[di + 1] = t.d[si + 1] * shade; d[di + 2] = t.d[si + 2] * shade;
    d[di + 3] = a * alphaMul;
  };
  if (face === 'top') {
    for (let c = 0; c < 32; c++) {
      const cc = c < 16 ? c : 31 - c;
      const top = 7 - (cc >> 1), bot = 8 + (cc >> 1);
      for (let r = top; r <= bot; r++) {
        const u = (c + 0.5 - 16 + 2 * (r + 0.5)) / 2;
        const v = (2 * (r + 0.5) - (c + 0.5) + 16) / 2;
        put(c, r, u, v);
      }
    }
  } else if (face === 'left') {
    for (let c = 0; c < 16; c++) {
      const r0 = 9 + (c >> 1);
      for (let v = 0; v < 16; v++) put(c, r0 + v, c, v);
    }
  } else {
    for (let c = 16; c < 32; c++) {
      const cc = 31 - c;
      const r0 = 9 + (cc >> 1);
      for (let v = 0; v < 16; v++) put(c, r0 + v, c - 16, v);
    }
  }
}

export const SHADE = { top: 1, left: 0.8, right: 0.62 };
export const CELL = 32;
// Atlas : une ligne par bloc, colonnes : 0 top, 1 left, 2 right, 3 top coupé (sombre).
export const atlas = document.createElement('canvas');
atlas.width = CELL * 4;
atlas.height = CELL * BLOCKS.length;
{
  const g = atlas.getContext('2d');
  for (const b of BLOCKS) {
    if (!b || !b.tex) continue;
    const row = b.id * CELL;
    if (b.cross) {
      g.drawImage(texToCanvas(TEX[b.tex.top]), 8, row + 8);
      continue;
    }
    const faces = [
      ['top', TEX[b.tex.top], SHADE.top],
      ['left', TEX[b.tex.front || b.tex.side], SHADE.left],
      ['right', TEX[b.tex.side], SHADE.right],
      ['top', TEX[b.tex.top], 0.6],
    ];
    faces.forEach(([face, t, shade], col) => {
      const img = new ImageData(32, 32);
      paintFace(img, t, face, shade);
      g.putImageData(img, col * CELL, row);
    });
  }
}

// Fissures (10 étapes) projetées sur les 3 faces.
export const crackAtlas = document.createElement('canvas');
crackAtlas.width = CELL * 10;
crackAtlas.height = CELL;
{
  const r = mulberry32(4242);
  const pts = [];
  // marches aléatoires depuis le centre
  for (let w = 0; w < 7; w++) {
    let x = 7 + Math.floor(r() * 3) - 1, y = 7 + Math.floor(r() * 3) - 1;
    const dir = r() * Math.PI * 2;
    for (let i = 0; i < 12; i++) {
      pts.push([x, y, w * 1.4 + i * 0.75]);
      const a = dir + (r() - 0.5) * 1.6;
      x = clamp(Math.round(x + Math.cos(a)), 0, 15);
      y = clamp(Math.round(y + Math.sin(a)), 0, 15);
    }
  }
  const g = crackAtlas.getContext('2d');
  for (let s = 0; s < 10; s++) {
    const t = new Tex();
    const lim = (s + 1) * 2.2;
    for (const [x, y, k] of pts) if (k <= lim) t.set(x, y, [20, 20, 20, 200]);
    const img = new ImageData(32, 32);
    paintFace(img, t, 'top', 1);
    paintFace(img, t, 'left', 1);
    paintFace(img, t, 'right', 1);
    g.putImageData(img, s * CELL, 0);
  }
}

// ---------- Objets pixel art ----------
const MAT_COL = {
  wood: [[184, 146, 92], [146, 112, 64], [100, 76, 42]],
  stone: [[160, 160, 160], [122, 122, 122], [80, 80, 80]],
  iron: [[250, 250, 250], [212, 212, 212], [150, 150, 150]],
  diamond: [[170, 255, 246], [78, 220, 210], [30, 140, 140]],
};
const STICK = [[170, 130, 72], [128, 96, 52], [86, 62, 32]];

function outline(t, c) {
  const add = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (t.alpha(x, y)) continue;
    if (t.alpha(x - 1, y) || t.alpha(x + 1, y) || t.alpha(x, y - 1) || t.alpha(x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) t.set(x, y, c);
}

function maskDraw(t, test) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = test(x + y, x - y, x, y);
    if (c) t.set(x, y, c);
  }
}

function handle(t, bMin, bMax) {
  maskDraw(t, (a, b) => (b >= bMin && b <= bMax ? (a === 15 ? STICK[0] : a === 16 ? STICK[1] : null) : null));
}

const ITEM_GEN = {
  stick(t) { handle(t, -9, 9); outline(t, [50, 34, 16]); },
  coal(t, r) { blob(t, r, [46, 46, 48], [92, 92, 96], [24, 24, 26]); },
  charcoal(t, r) { blob(t, r, [58, 48, 38], [104, 88, 72], [30, 24, 18]); },
  iron_ingot(t) { ingot(t, [250, 250, 250], [210, 210, 210], [140, 140, 140]); },
  gold_ingot(t) { ingot(t, [255, 248, 150], [244, 204, 46], [184, 130, 20]); },
  diamond(t) {
    maskDraw(t, (a, b, x, y) => {
      const dx = Math.abs(x - 7.5), dy = y - 7.5;
      if (dy < -4.5 || dy > 5.5) return null;
      const w = dy < -2.5 ? 5.5 - (-2.5 - dy) * 0.8 : 5.5 - (dy + 2.5) * 0.7;
      if (dx > w) return null;
      return dy < -2.5 ? [200, 255, 250] : x < 7 ? [96, 232, 222] : [44, 170, 170];
    });
    t.set(5, 4, [255, 255, 255]); t.set(6, 6, [230, 255, 252]);
    outline(t, [16, 70, 74]);
  },
  apple(t) {
    maskDraw(t, (a, b, x, y) => {
      const d = Math.hypot(x - 7.5, (y - 9) * 1.1);
      if (d > 5.6) return null;
      if (x - 7.5 + (y - 9) < -5) return [244, 110, 96];
      return d > 4.4 ? [150, 16, 20] : [212, 32, 34];
    });
    t.set(8, 2, [96, 66, 30]); t.set(8, 3, [96, 66, 30]); t.set(9, 2, [70, 140, 40]); t.set(10, 1, [70, 140, 40]);
    t.set(5, 6, [255, 200, 190]);
    outline(t, [60, 10, 10]);
  },
  pork_raw(t) { meat(t, [238, 150, 150], [252, 222, 212], [190, 96, 100]); },
  pork_cooked(t) { meat(t, [196, 124, 72], [236, 196, 144], [140, 80, 40]); },
  mutton_raw(t) { meat(t, [204, 64, 62], [240, 200, 190], [150, 36, 36]); },
  mutton_cooked(t) { meat(t, [154, 84, 50], [214, 170, 120], [100, 50, 26]); },
  rotten_flesh(t, r) {
    meat(t, [146, 112, 70], [118, 140, 66], [96, 72, 40]);
    for (let i = 0; i < 8; i++) { const x = 3 + Math.floor(r() * 10), y = 5 + Math.floor(r() * 6); if (t.alpha(x, y)) t.set(x, y, [96, 128, 56]); }
  },
  bread(t) {
    maskDraw(t, (a, b, x, y) => {
      const d = Math.hypot((x - 7.5) / 6.5, (y - 8.5) / 3.6);
      if (d > 1) return null;
      return y < 7 ? [222, 172, 88] : [196, 140, 62];
    });
    for (const x of [4, 7, 10]) { t.set(x, 6, [150, 100, 40]); t.set(x + 1, 7, [150, 100, 40]); }
    outline(t, [90, 56, 20]);
  },
};

function blob(t, r, main, light, dark) {
  maskDraw(t, (a, b, x, y) => {
    const d = Math.hypot(x - 7.5, y - 8);
    if (d > 5.2 + Math.sin(x * 2.1 + y) * 0.7) return null;
    if (x + y < 12) return light;
    if (x + y > 19) return dark;
    return main;
  });
  for (let i = 0; i < 6; i++) { const x = 4 + Math.floor(r() * 8), y = 4 + Math.floor(r() * 8); if (t.alpha(x, y)) t.set(x, y, light); }
  outline(t, sh(dark, 0.6));
}

function ingot(t, light, main, dark) {
  for (let y = 6; y <= 11; y++) {
    const top = y <= 7;
    const x0 = top ? 5 + (7 - y) : 2 + (y - 8) * 0, x1 = top ? 13 - (7 - y) : 12;
    for (let x = x0; x <= x1; x++) t.set(x, y, top ? light : y === 11 || x === x1 ? dark : main);
  }
  t.set(13, 8, dark); t.set(13, 9, dark); t.set(13, 10, dark);
  outline(t, sh(dark, 0.5));
}

function meat(t, main, fat, dark) {
  maskDraw(t, (a, b, x, y) => {
    const d = Math.hypot((x - 7.5) / 6.4, (y - 8) / 4.6);
    if (d > 1) return null;
    if (d > 0.8 && y < 8) return fat;
    if (d > 0.82) return dark;
    return main;
  });
  outline(t, sh(dark, 0.5));
}

function toolGen(type, mat) {
  const [L, M, D] = MAT_COL[mat];
  return (t) => {
    if (type === 'pickaxe') {
      handle(t, -11, 5);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - 3, dy = y + 0.5 - 12.5;
        const rr = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        if (ang < -102 || ang > 8) continue;
        const e = Math.abs(ang + 47) / 55;
        const rin = 8.2 + e * e * 0.8, rout = 10.2 - e * e * 0.8;
        if (rr < rin || rr > rout) continue;
        t.set(x, y, rr > rout - 0.9 ? L : rr < rin + 0.8 ? D : M);
      }
    } else if (type === 'axe') {
      handle(t, -11, 6);
      maskDraw(t, (a, b) => {
        if (b < 0 || b > 8) return null;
        const amin = 8 + ((b - 4) / 4) ** 2 * 2.2;
        if (a < amin || a > 16) return null;
        if (a >= 15 && (b < 2 || b > 6)) return null;
        return a < amin + 1.2 ? L : a >= 14 ? D : M;
      });
    } else if (type === 'shovel') {
      handle(t, -11, 4);
      maskDraw(t, (a, b) => {
        const da = Math.abs(a - 15.5);
        if (b < 5 || b > 12 - da * 0.7 || da > 2.6) return null;
        return a < 14 ? L : a > 17 ? D : M;
      });
    } else {
      maskDraw(t, (a, b) => {
        const da = a - 15;
        if (b >= -3 && b <= 13 && Math.abs(da) <= (b > 10 ? 0 : 1)) return da < 0 ? L : da > 0 ? D : M;
        if (b === -4 || b === -5) { if (Math.abs(da) <= 4) return [90, 70, 40]; }
        if (b >= -10 && b <= -6 && (a === 15 || a === 16)) return a === 15 ? STICK[0] : STICK[1];
        return null;
      });
    }
    outline(t, sh(D, 0.45));
  };
}
for (const it of ITEMS) {
  if (it && it.tool) ITEM_GEN[it.key] = toolGen(it.tool.type, it.tool.material);
}

// ---------- Icônes (canvas 32x32) ----------
const iconCache = new Map();
const iconURLCache = new Map();

export function iconCanvas(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const def = ITEMS[id];
  if (def && def.isBlock) {
    const b = def.block;
    if (b.cross) g.drawImage(texToCanvas(TEX[b.tex.top], 2), 0, 0);
    else {
      for (let col = 0; col < 3; col++) g.drawImage(atlas, col * CELL, b.id * CELL, CELL, CELL, 0, 0, 32, 32);
    }
  } else if (def && ITEM_GEN[def.key]) {
    const t = new Tex();
    ITEM_GEN[def.key](t, mulberry32(id * 31 + 7));
    g.drawImage(texToCanvas(t, 2), 0, 0);
  }
  iconCache.set(id, c);
  return c;
}

export function iconURL(id) {
  if (!iconURLCache.has(id)) iconURLCache.set(id, iconCanvas(id).toDataURL());
  return iconURLCache.get(id);
}

export function textureURL(name, scale = 1, darken = 0) {
  const c = texToCanvas(TEX[name], scale);
  if (darken) {
    const g = c.getContext('2d');
    g.fillStyle = `rgba(0,0,0,${darken})`;
    g.fillRect(0, 0, c.width, c.height);
  }
  return c.toDataURL();
}
