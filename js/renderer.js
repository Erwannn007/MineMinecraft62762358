// Rendu isométrique : chunks pré-dessinés en cache, entités triées, lumière jour/nuit.
import { atlas, crackAtlas, CELL } from './textures.js';
import { B, IS_OPAQUE, IS_CROSS, LIGHT } from './blocks.js';
import { WH, idx } from './worldgen.js';
import { mulberry32 } from './noise.js';

export const project = (x, y, z) => [(x - y) * 16, (x + y) * 8 - z * 16];

function occludes(id, nb) {
  if (nb === 255) return true;
  if (IS_OPAQUE[nb]) return true;
  if (nb === id) return true;
  if (id === B.WATER && nb === B.ICE) return true;
  return false;
}

function makeCloudTile() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const r = mulberry32(99);
  for (let i = 0; i < 26; i++) {
    const x = r() * 512, y = r() * 512, rad = 30 + r() * 70;
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)');
      gr.addColorStop(0.6, 'rgba(0,0,0,0.6)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.caches = new Map();
    this.pool = [];
    this.cutZ = null;
    this.W = 1; this.H = 1;
    this.lightCanvas = document.createElement('canvas');
    this.cloudTile = makeCloudTile();
    this.cloudPattern = null;
    this.stats = { builds: 0, chunks: 0 };
    this.list = new Float64Array(4 * 50000); // 16x16x64 blocs x 3 faces max
  }

  resize(cssW, cssH, dpr, zoom) {
    const W = Math.ceil((cssW * dpr) / zoom), H = Math.ceil((cssH * dpr) / zoom);
    this.W = W; this.H = H;
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.style.width = (W * zoom) / dpr + 'px';
    this.canvas.style.height = (H * zoom) / dpr + 'px';
    this.lightCanvas.width = W; this.lightCanvas.height = H;
    this.ctx.imageSmoothingEnabled = false;
    this.scale = zoom / dpr; // pixels CSS par pixel interne
  }

  setWorld(world) {
    for (const c of this.caches.values()) this.release(c);
    this.caches.clear();
    this.world = world;
    world.onChange((cx, cy) => {
      const c = this.caches.get(cx + ',' + cy);
      if (c) c.stale = true;
    });
  }

  release(c) { if (c.canvas) this.pool.push(c.canvas); c.canvas = null; }

  // Bitmask des faces visibles : 1 gauche, 2 droite, 4 dessus, 8 dessus coupé.
  faces(get, id, z, x, y) {
    const cut = this.cutZ;
    let m = 0;
    const above = z + 1 < WH ? get(x, y, z + 1) : 0;
    if (cut !== null && z + 1 >= cut) m |= above !== 0 && above !== 255 && !IS_CROSS[above] ? 8 : 4;
    else if (!occludes(id, above)) m |= 4;
    if (!occludes(id, get(x, y + 1, z))) m |= 1;
    if (!occludes(id, get(x + 1, y, z))) m |= 2;
    return m;
  }

  buildCache(ch) {
    const world = this.world;
    const data = ch.data;
    const x0 = ch.cx * 16, y0 = ch.cy * 16;
    const cut = this.cutZ;
    const get = (lx, ly, z) => (lx < 16 && ly < 16 ? data[idx(lx, ly, z)] : world.getBlock(x0 + lx, y0 + ly, z));
    const L = this.list;
    let n = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const lights = [];
    const zTop = cut !== null ? Math.min(WH, cut) : WH;
    const push = (X, Y, id, col) => {
      if (n >= L.length) return;
      L[n++] = X; L[n++] = Y; L[n++] = id; L[n++] = col;
      if (X < minX) minX = X; if (Y < minY) minY = Y;
      if (X > maxX) maxX = X; if (Y > maxY) maxY = Y;
    };
    for (let s = 0; s <= 30; s++) {
      const a = Math.max(0, s - 15), b = Math.min(15, s);
      for (let lx = a; lx <= b; lx++) {
        const ly = s - lx;
        const x = x0 + lx, y = y0 + ly;
        const X = (x - y) * 16 - 16;
        for (let z = 0; z < zTop; z++) {
          const id = data[idx(lx, ly, z)];
          if (id === 0) continue;
          const Y = (x + y) * 8 - (z + 1) * 16;
          if (LIGHT[id]) lights.push([x + 0.5, y + 0.5, z + 0.5, LIGHT[id]]);
          if (IS_CROSS[id]) { push(X, Y, id, 0); continue; }
          const m = this.faces(get, id, z, lx, ly);
          if (m & 1) push(X, Y, id, 1);
          if (m & 2) push(X, Y, id, 2);
          if (m & 4) push(X, Y, id, 0);
          if (m & 8) push(X, Y, id, 3);
        }
      }
    }
    let cache = this.caches.get(ch.cx + ',' + ch.cy);
    if (!cache) { cache = {}; this.caches.set(ch.cx + ',' + ch.cy, cache); }
    cache.cx = ch.cx; cache.cy = ch.cy;
    cache.stale = false; cache.cut = cut; cache.lights = lights;
    if (n === 0) { this.release(cache); cache.empty = true; return cache; }
    cache.empty = false;
    const w = maxX - minX + CELL, h = maxY - minY + CELL;
    let cv = cache.canvas || this.pool.pop() || document.createElement('canvas');
    cv.width = w; cv.height = h; // réinitialise aussi le contenu
    cache.canvas = cv;
    cache.x = minX; cache.y = minY; cache.w = w; cache.h = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < n; i += 4) {
      g.drawImage(atlas, L[i + 3] * CELL, L[i + 2] * CELL, CELL, CELL, L[i] - minX, L[i + 1] - minY, CELL, CELL);
    }
    this.stats.builds++;
    return cache;
  }

  // Redessine les blocs situés devant une entité (pour qu'elle soit correctement cachée).
  redrawFront(ctx, e, ox, oy) {
    const world = this.world;
    const [l, t, r, b] = e.rect;
    const eDepth = e.x + e.y + e.z + e.height * 0.5;
    const zEnd = this.cutZ !== null ? Math.min(WH, this.cutZ) : WH;
    const get = (x, y, z) => world.getBlock(x, y, z);
    let covered = false;
    for (let z = Math.floor(e.z + 0.05); z < zEnd; z++) {
      const sMin = Math.floor((t + (z + 1) * 16 - 32) / 8), sMax = Math.ceil((b + (z + 1) * 16) / 8);
      const dMin = Math.floor((l - 16) / 16), dMax = Math.ceil((r + 16) / 16);
      for (let s = sMin; s <= sMax; s++) {
        for (let d = dMin; d <= dMax; d++) {
          if (((s + d) & 1) !== 0) continue;
          const x = (s + d) / 2, y = (s - d) / 2;
          const id = get(x, y, z);
          if (id === 0 || id === 255) continue;
          if (x + y + 1 + z + 0.5 <= eDepth || z + 1 <= e.z + 0.05) continue;
          const X = (x - y) * 16 - 16 + ox, Y = (x + y) * 8 - (z + 1) * 16 + oy;
          if (IS_CROSS[id]) { ctx.drawImage(atlas, 0, id * CELL, CELL, CELL, X, Y, CELL, CELL); continue; }
          const m = this.faces(get, id, z, x, y);
          if (!m) continue;
          if (IS_OPAQUE[id]) covered = true;
          if (m & 1) ctx.drawImage(atlas, CELL, id * CELL, CELL, CELL, X, Y, CELL, CELL);
          if (m & 2) ctx.drawImage(atlas, 2 * CELL, id * CELL, CELL, CELL, X, Y, CELL, CELL);
          if (m & 4) ctx.drawImage(atlas, 0, id * CELL, CELL, CELL, X, Y, CELL, CELL);
          if (m & 8) ctx.drawImage(atlas, 3 * CELL, id * CELL, CELL, CELL, X, Y, CELL, CELL);
        }
      }
    }
    return covered;
  }

  // view : { x, y, z (point suivi), entities, target, crack, dark, time, buildBudget }
  render(view) {
    const ctx = this.ctx, W = this.W, H = this.H, world = this.world;
    const [fx, fy] = project(view.x, view.y, view.z);
    const ox = Math.round(W / 2 - fx), oy = Math.round(H / 2 - fy);
    this.ox = ox; this.oy = oy;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = view.bg || '#10121a';
    ctx.fillRect(0, 0, W, H);

    // --- chunks candidats ---
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const [sx, sy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const X = sx - ox, Y = sy - oy;
      for (const z of [8, WH]) {
        const s = (Y + 16 * z) / 8, d = X / 16;
        const x = (s + d) / 2, y = (s - d) / 2;
        mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y);
      }
    }
    const cx0 = Math.floor(mnx / 16) - 1, cx1 = Math.floor(mxx / 16) + 1;
    const cy0 = Math.floor(mny / 16) - 1, cy1 = Math.floor(mxy / 16) + 1;
    const vis = [];
    const fcx = Math.floor(view.x / 16), fcy = Math.floor(view.y / 16);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = this.caches.get(cx + ',' + cy);
      let x0, y0, x1, y1;
      if (c && !c.empty && c.canvas) { x0 = c.x; y0 = c.y; x1 = c.x + c.w; y1 = c.y + c.h; }
      else {
        x0 = (cx * 16 - cy * 16 - 16) * 16 - 16; x1 = (cx * 16 + 16 - cy * 16) * 16 + 16;
        y0 = (cx + cy) * 128 - WH * 16; y1 = ((cx + cy) * 16 + 32) * 8 - 8 * 16;
      }
      if (x1 + ox < 0 || x0 + ox > W || y1 + oy < 0 || y0 + oy > H) continue;
      vis.push([cx, cy, c]);
    }
    this.stats.chunks = vis.length;

    // --- chargement et construction des caches ---
    const toBuild = [];
    for (const v of vis) {
      const [cx, cy, c] = v;
      world.request(cx, cy);
      world.request(cx + 1, cy);
      world.request(cx, cy + 1);
      const ch = world.getChunk(cx, cy);
      if (!ch || !world.getChunk(cx + 1, cy) || !world.getChunk(cx, cy + 1)) continue;
      if (!c || c.stale || c.cut !== this.cutZ) toBuild.push([ch, c ? (c.stale ? 0 : 1) : 2]);
    }
    toBuild.sort((a, b) => {
      const da = Math.abs(a[0].cx - fcx) + Math.abs(a[0].cy - fcy) + (a[1] === 2 ? 0 : 0);
      const db = Math.abs(b[0].cx - fcx) + Math.abs(b[0].cy - fcy);
      return da - db;
    });
    const t0 = performance.now();
    const budget = view.buildBudget ?? 8;
    for (const [ch] of toBuild) {
      const c = this.buildCache(ch);
      const v = vis.find((q) => q[0] === ch.cx && q[1] === ch.cy);
      if (v) v[2] = c;
      if (performance.now() - t0 > budget) break;
    }

    // --- dessin des chunks (de l'arrière vers l'avant) ---
    vis.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
    for (const [, , c] of vis) {
      if (c && !c.empty && c.canvas) ctx.drawImage(c.canvas, c.x + ox, c.y + oy);
    }

    // --- ombres des nuages ---
    if (view.clouds > 0) {
      if (!this.cloudPattern) this.cloudPattern = ctx.createPattern(this.cloudTile, 'repeat');
      const wind = view.time * 6;
      ctx.save();
      ctx.globalAlpha = view.clouds;
      ctx.translate(((ox + wind) % 512 + 512) % 512 - 512, ((oy + wind * 0.5) % 512 + 512) % 512 - 512);
      ctx.fillStyle = this.cloudPattern;
      ctx.fillRect(0, 0, W + 1024, H + 1024);
      ctx.restore();
    }

    // --- entités ---
    const ents = view.entities || [];
    for (const e of ents) e._depth = e.x + e.y + e.z + e.height * 0.5;
    ents.sort((a, b) => a._depth - b._depth);
    for (const e of ents) {
      e.draw(ctx, ox, oy);
      const covered = this.redrawFront(ctx, e, ox, oy);
      if (covered && e.ghost) {
        ctx.globalAlpha = 0.38;
        e.draw(ctx, ox, oy, true);
        ctx.globalAlpha = 1;
      }
    }

    // --- bloc visé ---
    if (view.target) {
      const [x, y, z] = view.target;
      const X = (x - y) * 16 - 16 + ox, Y = (x + y) * 8 - (z + 1) * 16 + oy;
      if (view.crack >= 0) ctx.drawImage(crackAtlas, view.crack * CELL, 0, CELL, CELL, X, Y, CELL, CELL);
      ctx.strokeStyle = view.targetColor || 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const px = X + 0.5, py = Y + 0.5;
      ctx.moveTo(px + 15.5, py); ctx.lineTo(px + 31, py + 7.5); ctx.lineTo(px + 31, py + 23.5);
      ctx.lineTo(px + 15.5, py + 31); ctx.lineTo(px, py + 23.5); ctx.lineTo(px, py + 7.5); ctx.closePath();
      ctx.moveTo(px, py + 7.5); ctx.lineTo(px + 15.5, py + 15.5); ctx.lineTo(px + 31, py + 7.5);
      ctx.moveTo(px + 15.5, py + 15.5); ctx.lineTo(px + 15.5, py + 31);
      ctx.stroke();
    }

    // --- lumière (nuit, grottes) ---
    const dark = view.dark || 0;
    if (dark > 0.01) {
      const lc = this.lightCanvas, lg = lc.getContext('2d');
      lg.globalCompositeOperation = 'source-over';
      lg.clearRect(0, 0, W, H);
      lg.fillStyle = `rgba(6,8,26,${dark})`;
      lg.fillRect(0, 0, W, H);
      lg.globalCompositeOperation = 'destination-out';
      const lights = [];
      for (const [, , c] of vis) if (c && c.lights) for (const L of c.lights) {
        if (this.cutZ !== null && L[2] >= this.cutZ) continue;
        lights.push(L);
      }
      if (view.lights) lights.push(...view.lights);
      const glows = [];
      for (const [x, y, z, lv] of lights) {
        const [sx, sy] = project(x, y, z);
        const X = sx + ox, Y = sy + oy, rad = lv * 15;
        if (X < -rad || X > W + rad || Y < -rad || Y > H + rad) continue;
        const gr = lg.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, 'rgba(0,0,0,1)');
        gr.addColorStop(0.45, 'rgba(0,0,0,0.75)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        lg.fillStyle = gr;
        lg.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
        if (lv >= 5) glows.push([X, Y, rad]);
      }
      ctx.drawImage(lc, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (const [X, Y, rad] of glows) {
        const gr = ctx.createRadialGradient(X, Y, 0, X, Y, rad * 0.7);
        gr.addColorStop(0, `rgba(255,150,50,${0.22 * dark})`);
        gr.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (view.tint) {
      ctx.fillStyle = view.tint;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Libère les caches hors de l'écran.
  trim(maxCaches = 90) {
    if (this.caches.size <= maxCaches) return;
    const fx = this.focusCx || 0, fy = this.focusCy || 0;
    const arr = [...this.caches.entries()].sort((a, b) =>
      (Math.abs(b[1].cx - fx) + Math.abs(b[1].cy - fy)) - (Math.abs(a[1].cx - fx) + Math.abs(a[1].cy - fy)));
    while (this.caches.size > maxCaches && arr.length) {
      const [k, c] = arr.shift();
      this.release(c);
      this.caches.delete(k);
    }
  }

  // Écran (pixels internes) -> bloc visé, en lançant un rayon dans la direction de vue.
  pick(sx, sy, filter) {
    const world = this.world;
    const X = sx - this.ox, Y = sy - this.oy;
    const z0 = (this.cutZ !== null ? this.cutZ : WH) + 0.001;
    const s = (Y + 16 * z0) / 8, d = X / 16;
    let x = (s + d) / 2, y = (s - d) / 2, z = z0;
    let ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let tx = x - ix, ty = y - iy, tz = z - iz;
    let face = 'top';
    for (let i = 0; i < 3 * WH + 10; i++) {
      if (iz < 0) return null;
      if (iz < WH && (this.cutZ === null || iz < this.cutZ)) {
        const id = world.getBlock(ix, iy, iz);
        if (id === 255) return null;
        if (id !== 0 && (!filter || filter(id, ix, iy, iz))) return { x: ix, y: iy, z: iz, id, face };
      }
      if (tx <= ty && tx <= tz) { ix--; ty -= tx; tz -= tx; tx = 1; face = 'x'; }
      else if (ty <= tz) { iy--; tx -= ty; tz -= ty; ty = 1; face = 'y'; }
      else { iz--; tx -= tz; ty -= tz; tz = 1; face = 'top'; }
    }
    return null;
  }
}
