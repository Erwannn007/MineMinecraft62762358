// Monde infini découpé en chunks : chargement, génération, modifications, sauvegarde.
import { WorldGen, CS, WH, SEA, idx } from './worldgen.js';
import { B, BLOCKS, IS_SOLID } from './blocks.js';
import { storage } from './storage.js';

export { CS, WH, SEA };

export class Chunk {
  constructor(cx, cy, data) {
    this.cx = cx; this.cy = cy;
    this.data = data;
    this.version = 1;
    this.dirty = false;
  }
}

const key = (cx, cy) => cx + ',' + cy;

export class World {
  // meta : { id, seed, ... } ; persist=false pour le monde de démonstration du menu.
  constructor(meta, persist = true) {
    this.meta = meta;
    this.persist = persist;
    this.gen = new WorldGen(meta.seed);
    this.chunks = new Map();
    this.pending = new Set();
    this.genQueue = [];
    this.savedKeys = new Set();
    this.listeners = [];
    this.waterQueue = [];
    this.focus = [0, 0];
  }

  async init() {
    if (this.persist) this.savedKeys = await storage.chunkKeys(this.meta.id);
  }

  onChange(fn) { this.listeners.push(fn); }
  emit(cx, cy) { for (const fn of this.listeners) fn(cx, cy); }

  getChunk(cx, cy) { return this.chunks.get(key(cx, cy)); }

  getBlock(x, y, z) {
    if (z < 0) return B.BEDROCK;
    if (z >= WH) return B.AIR;
    const ch = this.chunks.get(key(x >> 4, y >> 4));
    if (!ch) return 255;
    return ch.data[idx(x & 15, y & 15, z)];
  }

  // Demande le chargement d'un chunk (lecture de la sauvegarde ou génération).
  request(cx, cy) {
    const k = key(cx, cy);
    if (this.chunks.has(k) || this.pending.has(k)) return;
    this.pending.add(k);
    if (this.savedKeys.has(k)) {
      storage.loadChunk(this.meta.id, k).then((data) => {
        if (data) this.install(cx, cy, data instanceof Uint8Array ? data : new Uint8Array(data));
        else this.genQueue.push([cx, cy]);
      }).catch(() => this.genQueue.push([cx, cy]));
    } else {
      this.genQueue.push([cx, cy]);
    }
  }

  install(cx, cy, data) {
    const k = key(cx, cy);
    this.pending.delete(k);
    if (this.chunks.has(k)) return;
    this.chunks.set(k, new Chunk(cx, cy, data));
    this.emit(cx, cy);
    this.emit(cx - 1, cy);
    this.emit(cx, cy - 1);
    this.emit(cx - 1, cy - 1);
  }

  // Génère des chunks en attente dans la limite du budget (ms).
  update(budget = 6) {
    const t0 = performance.now();
    if (this.genQueue.length > 1) {
      const [fx, fy] = this.focus;
      this.genQueue.sort((a, b) => (Math.abs(b[0] - fx) + Math.abs(b[1] - fy)) - (Math.abs(a[0] - fx) + Math.abs(a[1] - fy)));
    }
    while (this.genQueue.length) {
      const [cx, cy] = this.genQueue.pop();
      this.install(cx, cy, this.gen.generate(cx, cy));
      if (performance.now() - t0 > budget) break;
    }
    this.flowWater(64);
  }

  // Oublie les chunks éloignés (après les avoir sauvegardés).
  unloadFar(cx, cy, radius) {
    for (const [k, ch] of this.chunks) {
      if (Math.abs(ch.cx - cx) > radius || Math.abs(ch.cy - cy) > radius) {
        if (ch.dirty && this.persist) continue; // sera sauvegardé puis retiré plus tard
        this.chunks.delete(k);
      }
    }
    this.genQueue = this.genQueue.filter(([x, y]) => {
      const keep = Math.abs(x - cx) <= radius && Math.abs(y - cy) <= radius;
      if (!keep) this.pending.delete(key(x, y));
      return keep;
    });
  }

  setBlock(x, y, z, id) {
    if (z < 0 || z >= WH) return false;
    const cx = x >> 4, cy = y >> 4;
    const ch = this.chunks.get(key(cx, cy));
    if (!ch) return false;
    const i = idx(x & 15, y & 15, z);
    const old = ch.data[i];
    if (old === id) return false;
    ch.data[i] = id;
    ch.dirty = true;
    ch.version++;
    this.emit(cx, cy);
    if ((x & 15) === 0) this.emit(cx - 1, cy);
    if ((y & 15) === 0) this.emit(cx, cy - 1);
    if ((x & 15) === 0 && (y & 15) === 0) this.emit(cx - 1, cy - 1);

    if (BLOCKS[id] && BLOCKS[id].falls) this.checkFall(x, y, z);
    if (!IS_SOLID[id]) {
      this.checkFall(x, y, z + 1);
      if (id === B.AIR) this.scheduleWater(x, y, z);
    }
    return true;
  }

  checkFall(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!BLOCKS[id] || !BLOCKS[id].falls) return;
    let zz = z;
    while (zz > 0) {
      const below = this.getBlock(x, y, zz - 1);
      if (IS_SOLID[below]) break;
      zz--;
    }
    if (zz === z) return;
    this.setBlock(x, y, zz, id);
    this.setBlock(x, y, z, B.AIR);
  }

  // Écoulement simplifié : l'eau tombe toujours, et ne s'étale qu'au niveau de la mer ou en dessous.
  scheduleWater(x, y, z) {
    this.waterQueue.push([x, y, z]);
  }

  flowWater(budget) {
    let n = 0;
    while (this.waterQueue.length && n < budget) {
      const [x, y, z] = this.waterQueue.shift();
      n++;
      if (this.getBlock(x, y, z) !== B.AIR) continue;
      let fill = this.getBlock(x, y, z + 1) === B.WATER;
      if (!fill && z <= SEA) {
        fill = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.getBlock(x + dx, y + dy, z) === B.WATER);
      }
      if (!fill) continue;
      const ch = this.chunks.get(key(x >> 4, y >> 4));
      if (!ch) continue;
      ch.data[idx(x & 15, y & 15, z)] = B.WATER;
      ch.dirty = true; ch.version++;
      this.emit(x >> 4, y >> 4);
      if ((x & 15) === 0) this.emit((x >> 4) - 1, y >> 4);
      if ((y & 15) === 0) this.emit(x >> 4, (y >> 4) - 1);
      if (this.getBlock(x, y, z - 1) === B.AIR) this.waterQueue.push([x, y, z - 1]);
      if (z <= SEA) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.getBlock(x + dx, y + dy, z) === B.AIR) this.waterQueue.push([x + dx, y + dy, z]);
      }
    }
    if (this.waterQueue.length > 5000) this.waterQueue.length = 5000;
  }

  // Plus haut bloc solide d'une colonne (ou -1).
  topSolid(x, y) {
    for (let z = WH - 1; z >= 0; z--) {
      const id = this.getBlock(x, y, z);
      if (id === 255) return -1;
      if (IS_SOLID[id]) return z;
    }
    return -1;
  }

  async save() {
    if (!this.persist) return;
    const entries = [];
    for (const [k, ch] of this.chunks) {
      if (!ch.dirty) continue;
      entries.push([k, ch.data.slice()]);
      ch.dirty = false;
      this.savedKeys.add(k);
    }
    await storage.saveChunks(this.meta.id, entries);
  }
}
