// Génération procédurale du terrain : relief, biomes, grottes, minerais, arbres.
import { Simplex, hash2, mulberry32 } from './noise.js';
import { B } from './blocks.js';

export const CS = 16;      // taille d'un chunk (x, y)
export const WH = 64;      // hauteur du monde (z)
export const SEA = 28;     // niveau de la mer

export const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, SNOW: 5, MOUNTAIN: 6, BIRCH: 7 };
export const BIOME_NAMES = ['Océan', 'Plage', 'Plaine', 'Forêt', 'Désert', 'Toundra', 'Montagne', 'Forêt de bouleaux'];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const idx = (lx, ly, z) => lx + (ly << 4) + (z << 8);

export class WorldGen {
  constructor(seed) {
    this.seed = seed | 0;
    this.nCont = new Simplex(seed);
    this.nHill = new Simplex(seed + 1);
    this.nMount = new Simplex(seed + 2);
    this.nClim = new Simplex(seed + 3);
    this.nDetail = new Simplex(seed + 4);
    this.cave1 = new Simplex(seed + 10);
    this.cave2 = new Simplex(seed + 11);
    this.cave3 = new Simplex(seed + 12);
  }

  column(x, y) {
    const c = this.nCont.fbm2(x * 0.0016, y * 0.0016, 5);
    const hills = this.nHill.fbm2(x * 0.009, y * 0.009, 3);
    let h = SEA + 3 + c * 26 + hills * 4.5;
    const m = this.nMount.ridge2(x * 0.0045, y * 0.0045, 3);
    h += smooth(0.06, 0.32, c) * Math.max(0, m - 0.45) * 52;
    h = Math.round(Math.max(4, Math.min(WH - 9, h)));
    const temp = this.nClim.noise2(x * 0.0011 + 50, y * 0.0011) - Math.max(0, h - SEA - 10) * 0.012;
    const humid = this.nClim.noise2(x * 0.0013 - 80, y * 0.0013 + 120);
    let biome;
    if (h < SEA - 1) biome = BIOME.OCEAN;
    else if (h <= SEA + 1 && temp > -0.35) biome = BIOME.BEACH;
    else if (h > SEA + 19) biome = BIOME.MOUNTAIN;
    else if (temp < -0.32) biome = BIOME.SNOW;
    else if (temp > 0.28 && humid < 0.12) biome = BIOME.DESERT;
    else if (humid > 0.18) biome = this.nDetail.noise2(x * 0.004, y * 0.004) > 0.35 ? BIOME.BIRCH : BIOME.FOREST;
    else biome = BIOME.PLAINS;
    return { h, biome, temp };
  }

  generate(cx, cy) {
    const data = new Uint8Array(CS * CS * WH);
    const x0 = cx * CS, y0 = cy * CS;
    const seed = this.seed;
    const cols = [];
    for (let ly = 0; ly < CS; ly++) for (let lx = 0; lx < CS; lx++) cols.push(this.column(x0 + lx, y0 + ly));

    // --- terrain de base ---
    for (let ly = 0; ly < CS; ly++) for (let lx = 0; lx < CS; lx++) {
      const { h, biome, temp } = cols[ly * CS + lx];
      const x = x0 + lx, y = y0 + ly;
      const dirtDepth = 3 + Math.floor(hash2(seed + 7, x, y) * 2);
      for (let z = 0; z <= h; z++) {
        let id;
        if (z === 0 || (z <= 2 && hash2(seed + 9 + z, x, y) < 0.5)) id = B.BEDROCK;
        else if (z < h - dirtDepth) id = B.STONE;
        else if (z < h) {
          if (biome === BIOME.DESERT) id = z < h - 2 ? B.SANDSTONE : B.SAND;
          else if (biome === BIOME.BEACH) id = B.SAND;
          else if (biome === BIOME.OCEAN) id = h < SEA - 6 ? B.GRAVEL : B.SAND;
          else if (biome === BIOME.MOUNTAIN && h > SEA + 24) id = B.STONE;
          else id = B.DIRT;
        } else {
          if (biome === BIOME.OCEAN) {
            const n = this.nDetail.noise2(x * 0.05, y * 0.05);
            id = h < SEA - 6 ? B.GRAVEL : n > 0.55 && h > SEA - 6 ? B.CLAY : B.SAND;
          } else if (biome === BIOME.BEACH || biome === BIOME.DESERT) id = B.SAND;
          else if (biome === BIOME.MOUNTAIN) id = h > SEA + 30 ? B.SNOW : h > SEA + 24 ? B.STONE : temp < -0.2 ? B.SNOW_GRASS : B.GRASS;
          else if (biome === BIOME.SNOW) id = B.SNOW_GRASS;
          else id = B.GRASS;
        }
        data[idx(lx, ly, z)] = id;
      }
      for (let z = h + 1; z <= SEA; z++) {
        data[idx(lx, ly, z)] = z === SEA && temp < -0.38 ? B.ICE : B.WATER;
      }
    }

    // --- grottes (bruit 3D échantillonné tous les 4 blocs puis interpolé) ---
    const GX = 5, GZ = 17;
    const ga = new Float32Array(GX * GX * GZ), gb = new Float32Array(GX * GX * GZ), gc = new Float32Array(GX * GX * GZ);
    for (let k = 0; k < GZ; k++) for (let j = 0; j < GX; j++) for (let i = 0; i < GX; i++) {
      const x = x0 + i * 4, y = y0 + j * 4, z = k * 4;
      const n = i + j * GX + k * GX * GX;
      ga[n] = this.cave1.noise3(x / 26, y / 26, z / 14);
      gb[n] = this.cave2.noise3(x / 26, y / 26, z / 14);
      gc[n] = this.cave3.noise3(x / 44, y / 44, z / 18);
    }
    const sample = (g, lx, ly, z) => {
      const fx = lx / 4, fy = ly / 4, fz = z / 4;
      const i = Math.min(GX - 2, fx | 0), j = Math.min(GX - 2, fy | 0), k = Math.min(GZ - 2, fz | 0);
      const tx = fx - i, ty = fy - j, tz = fz - k;
      const at = (a, b, c) => g[(i + a) + (j + b) * GX + (k + c) * GX * GX];
      const l = (a, b, t) => a + (b - a) * t;
      return l(
        l(l(at(0, 0, 0), at(1, 0, 0), tx), l(at(0, 1, 0), at(1, 1, 0), tx), ty),
        l(l(at(0, 0, 1), at(1, 0, 1), tx), l(at(0, 1, 1), at(1, 1, 1), tx), ty),
        tz,
      );
    };
    for (let ly = 0; ly < CS; ly++) for (let lx = 0; lx < CS; lx++) {
      const { h } = cols[ly * CS + lx];
      const top = h <= SEA + 2 ? h - 5 : h;
      for (let z = 3; z <= top; z++) {
        const a = sample(ga, lx, ly, z), b = sample(gb, lx, ly, z);
        let cave = a * a + b * b < 0.011;
        if (!cave && z < 34 && z < h - 6) cave = sample(gc, lx, ly, z) > 0.62;
        if (cave) {
          const i = idx(lx, ly, z);
          if (data[i] !== B.BEDROCK && data[i] !== B.WATER) data[i] = B.AIR;
        }
      }
    }

    // --- minerais ---
    const rng = mulberry32(hash2(seed + 77, cx, cy) * 4294967296);
    const vein = (id, count, maxZ, size) => {
      for (let v = 0; v < count; v++) {
        let x = Math.floor(rng() * CS), y = Math.floor(rng() * CS), z = 1 + Math.floor(rng() * maxZ);
        const n = size[0] + Math.floor(rng() * (size[1] - size[0] + 1));
        for (let i = 0; i < n; i++) {
          if (x >= 0 && x < CS && y >= 0 && y < CS && z > 0 && z < WH) {
            const k = idx(x, y, z);
            if (data[k] === B.STONE) data[k] = id;
          }
          const d = Math.floor(rng() * 6);
          if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
        }
      }
    };
    vein(B.COAL_ORE, 14, 52, [4, 10]);
    vein(B.IRON_ORE, 9, 40, [3, 7]);
    vein(B.GOLD_ORE, 2, 22, [3, 6]);
    vein(B.DIAMOND_ORE, 1, 13, [2, 5]);
    vein(B.GRAVEL, 4, 50, [6, 14]);
    vein(B.DIRT, 4, 50, [6, 14]);

    // --- végétation au sol ---
    for (let ly = 0; ly < CS; ly++) for (let lx = 0; lx < CS; lx++) {
      const { h, biome } = cols[ly * CS + lx];
      if (h >= WH - 2 || h < SEA) continue;
      const below = data[idx(lx, ly, h)], above = idx(lx, ly, h + 1);
      if (data[above] !== B.AIR) continue;
      const r = hash2(seed + 5, x0 + lx, y0 + ly);
      if (below === B.GRASS) {
        const grassP = biome === BIOME.PLAINS ? 0.16 : 0.07;
        if (r < grassP) data[above] = B.TALL_GRASS;
        else if (r < grassP + 0.012) data[above] = B.FLOWER_RED;
        else if (r < grassP + 0.026) data[above] = B.FLOWER_YELLOW;
      } else if (below === B.SAND && biome === BIOME.DESERT) {
        if (r < 0.008) data[above] = B.DEAD_BUSH;
        else if (r < 0.014) {
          const th = 1 + Math.floor(hash2(seed + 6, x0 + lx, y0 + ly) * 3);
          for (let z = h + 1; z <= h + th && z < WH; z++) data[idx(lx, ly, z)] = B.CACTUS;
        }
      }
    }

    // --- arbres (y compris ceux des chunks voisins qui débordent ici) ---
    const G = 5;
    const gx0 = Math.floor((x0 - 3) / G), gx1 = Math.floor((x0 + CS + 3) / G);
    const gy0 = Math.floor((y0 - 3) / G), gy1 = Math.floor((y0 + CS + 3) / G);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const tx = gx * G + Math.floor(hash2(seed + 21, gx, gy) * G);
      const ty = gy * G + Math.floor(hash2(seed + 22, gx, gy) * G);
      const inside = tx >= x0 && tx < x0 + CS && ty >= y0 && ty < y0 + CS;
      const col = inside ? cols[(ty - y0) * CS + (tx - x0)] : this.column(tx, ty);
      const { h, biome } = col;
      if (h < SEA + 1 || h > WH - 12) continue;
      let p = 0;
      if (biome === BIOME.FOREST) p = 0.7;
      else if (biome === BIOME.BIRCH) p = 0.65;
      else if (biome === BIOME.SNOW) p = 0.3;
      else if (biome === BIOME.PLAINS) p = 0.035;
      else if (biome === BIOME.MOUNTAIN && h < SEA + 26) p = 0.08;
      const r = hash2(seed + 23, gx, gy);
      if (r >= p) continue;
      if (inside) {
        const ground = data[idx(tx - x0, ty - y0, h)];
        if (ground !== B.GRASS && ground !== B.SNOW_GRASS && ground !== B.DIRT) continue;
      }
      let kind = 'oak';
      if (biome === BIOME.BIRCH) kind = 'birch';
      else if (biome === BIOME.SNOW || biome === BIOME.MOUNTAIN) kind = 'spruce';
      else if (biome === BIOME.FOREST && hash2(seed + 24, gx, gy) < 0.25) kind = 'birch';
      this.tree(data, x0, y0, tx, ty, h + 1, kind, hash2(seed + 25, gx, gy));
    }
    return data;
  }

  tree(data, x0, y0, tx, ty, base, kind, r) {
    const put = (x, y, z, id, force) => {
      const lx = x - x0, ly = y - y0;
      if (lx < 0 || ly < 0 || lx >= CS || ly >= CS || z < 0 || z >= WH) return;
      const k = idx(lx, ly, z);
      const cur = data[k];
      if (force ? cur !== B.BEDROCK : cur === B.AIR || cur === B.TALL_GRASS || cur === B.FLOWER_RED || cur === B.FLOWER_YELLOW) data[k] = id;
    };
    const rr = mulberry32(r * 4294967296);
    if (kind === 'spruce') {
      const th = 6 + Math.floor(rr() * 3);
      const top = base + th;
      put(tx, ty, top, B.SPRUCE_LEAVES);
      let rad = 0;
      for (let z = top - 1; z >= base + 2; z--) {
        rad = rad >= 2 ? 1 : rad + 1;
        if (z === top - 1) rad = 1;
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
          if (rad > 1 && Math.abs(dx) === rad && Math.abs(dy) === rad) continue;
          put(tx + dx, ty + dy, z, B.SPRUCE_LEAVES);
        }
      }
      for (let z = base; z < top; z++) put(tx, ty, z, B.SPRUCE_LOG, true);
      return;
    }
    const log = kind === 'birch' ? B.BIRCH_LOG : B.OAK_LOG;
    const leaf = kind === 'birch' ? B.BIRCH_LEAVES : B.OAK_LEAVES;
    const th = (kind === 'birch' ? 5 : 4) + Math.floor(rr() * 3);
    const top = base + th - 1;
    for (let z = top - 2; z <= top + 1; z++) {
      const rad = z >= top ? 1 : 2;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const corner = Math.abs(dx) === rad && Math.abs(dy) === rad;
        if (corner && (z === top + 1 || rr() < 0.5)) continue;
        put(tx + dx, ty + dy, z, leaf);
      }
    }
    for (let z = base; z <= top; z++) put(tx, ty, z, log, true);
  }

  findSpawn() {
    const good = [BIOME.PLAINS, BIOME.FOREST, BIOME.BIRCH];
    for (const strict of [true, false]) {
      for (let r = 0; r < (strict ? 1200 : 400); r += 6) {
        for (let a = 0; a < 16; a++) {
          const x = Math.round(Math.cos(a / 16 * Math.PI * 2) * r), y = Math.round(Math.sin(a / 16 * Math.PI * 2) * r);
          const c = this.column(x, y);
          if (strict && !good.includes(c.biome)) continue;
          if (c.h > SEA + 1 && c.h < SEA + 16 && c.biome !== BIOME.OCEAN) return [x + 0.5, y + 0.5, c.h + 1];
        }
      }
    }
    return [0.5, 0.5, WH - 4];
  }
}
