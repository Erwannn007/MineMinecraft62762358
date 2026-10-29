// Modèles "en cubes" (joueur, animaux, zombies) rendus en isométrique par transformations affines.
import { mulberry32 } from './noise.js';

// Unité locale = 1/16 de bloc. Axes locaux : x = avant, y = gauche, z = haut.

function faceCanvas(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    const col = fn(u, v, w, h);
    const i = (v * w + u) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = col[3] ?? 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const vary = (c, r, a = 0.08) => { const f = 1 + (r() - 0.5) * a * 2; return [c[0] * f, c[1] * f, c[2] * f]; };

// part: { size:[sx,sy,sz], offset:[ox,oy,oz] (coin min relatif au pivot), pivot:[px,py,pz], skin: (face,u,v,w,h,r)=>color, anim }
function buildPart(p, seed) {
  const [sx, sy, sz] = p.size;
  const dims = { front: [sy, sz], back: [sy, sz], left: [sx, sz], right: [sx, sz], top: [sy, sx], bottom: [sy, sx] };
  p.tex = {};
  for (const f in dims) {
    const r = mulberry32(seed + f.length * 131 + sx * 7 + sz);
    p.tex[f] = faceCanvas(dims[f][0], dims[f][1], (u, v, w, h) => p.skin(f, u, v, w, h, r));
  }
  p.shaded = new Map();
  return p;
}

function shadedFace(part, face, level, hurt) {
  const k = face + level + (hurt ? 'h' : '');
  let c = part.shaded.get(k);
  if (c) return c;
  const src = part.tex[face];
  c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const s = level / 10;
  for (let i = 0; i < img.data.length; i += 4) {
    let r = img.data[i] * s, gg = img.data[i + 1] * s, b = img.data[i + 2] * s;
    if (hurt) { r = r * 0.5 + 140; gg *= 0.45; b *= 0.45; }
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b;
  }
  g.putImageData(img, 0, 0);
  part.shaded.set(k, c);
  return c;
}

// ---------- Définitions ----------
function humanoid(colors, seed) {
  const { skin, hair, eye, shirt, pants, shoes, mouth, eyeWhite } = colors;
  const head = (f, u, v, w, h, r) => {
    if (f === 'top') return vary(hair, r);
    if (f === 'bottom') return vary(skin, r, 0.04);
    if (f === 'back') return v < 7 ? vary(hair, r) : vary(skin, r, 0.04);
    if (f === 'left' || f === 'right') {
      const backU = f === 'left' ? u >= 5 : u < 3; // vers l'arrière de la tête
      if (v < 2 || (backU && v < 6)) return vary(hair, r);
      return vary(skin, r, 0.04);
    }
    // face avant
    if (v < 2 || (v === 2 && (u === 0 || u === 7))) return vary(hair, r);
    if (v === 4) {
      if (u === 1 || u === 6) return eyeWhite;
      if (u === 2 || u === 5) return eye;
    }
    if (v === 5 && (u === 3 || u === 4)) return [skin[0] * 0.8, skin[1] * 0.76, skin[2] * 0.76];
    if (v === 6 && u >= 2 && u <= 5) return mouth;
    return vary(skin, r, 0.04);
  };
  const body = (f, u, v, w, h, r) => {
    if (f === 'front' && v >= 10) return vary(pants, r);
    if (f === 'front' && v === 0 && u >= 3 && u <= 4) return vary(skin, r, 0.04);
    return vary(shirt, r);
  };
  const arm = (f, u, v, w, h, r) => {
    if (f === 'top') return vary(shirt, r);
    if (v < 4) return vary(shirt, r);
    return vary(skin, r, 0.05);
  };
  const leg = (f, u, v, w, h, r) => {
    if (f === 'bottom' || v >= h - 2) return vary(shoes, r);
    return vary(pants, r);
  };
  return {
    scale: 0.9,
    height: 32,
    parts: [
      buildPart({ name: 'legR', size: [4, 4, 12], pivot: [0, -2, 12], offset: [-2, -2, -12], skin: leg, swing: 1 }, seed + 1),
      buildPart({ name: 'legL', size: [4, 4, 12], pivot: [0, 2, 12], offset: [-2, -2, -12], skin: leg, swing: -1 }, seed + 2),
      buildPart({ name: 'body', size: [4, 8, 12], pivot: [0, 0, 12], offset: [-2, -4, 0], skin: body }, seed + 3),
      buildPart({ name: 'armR', size: [4, 4, 12], pivot: [0, -6, 22], offset: [-2, -2, -10], skin: arm, swing: -1, arm: true, right: true }, seed + 4),
      buildPart({ name: 'armL', size: [4, 4, 12], pivot: [0, 6, 22], offset: [-2, -2, -10], skin: arm, swing: 1, arm: true }, seed + 5),
      buildPart({ name: 'head', size: [8, 8, 8], pivot: [0, 0, 24], offset: [-4, -4, 0], skin: head, head: true }, seed + 6),
    ],
    hand: [0, -6, 12],
  };
}

function quadruped(o, seed) {
  const { body, head, legs, extra } = o;
  const parts = [];
  const [lx, ly, lh] = o.legPos;
  [[lx, ly, 1], [lx, -ly, -1], [-lx, ly, -1], [-lx, -ly, 1]].forEach(([x, y, s], i) => {
    parts.push(buildPart({ name: 'leg' + i, size: [4, 4, lh], pivot: [x, y, lh], offset: [-2, -2, -lh], skin: legs, swing: s }, seed + i));
  });
  parts.push(buildPart({ name: 'body', size: o.bodySize, pivot: [0, 0, lh], offset: o.bodyOffset, skin: body }, seed + 10));
  parts.push(buildPart({ name: 'head', size: o.headSize, pivot: o.headPivot, offset: o.headOffset, skin: head, head: true }, seed + 11));
  if (extra) parts.push(buildPart(extra, seed + 12));
  return { scale: 1, height: o.height, parts };
}

export const MODELS = {};

export function initModels() {
  MODELS.player = humanoid({
    skin: [214, 160, 124], hair: [76, 50, 30], eye: [60, 90, 200], eyeWhite: [240, 240, 240],
    shirt: [38, 168, 176], pants: [58, 58, 150], shoes: [80, 80, 86], mouth: [140, 80, 66],
  }, 100);
  MODELS.zombie = humanoid({
    skin: [96, 148, 84], hair: [62, 100, 56], eye: [20, 30, 20], eyeWhite: [62, 100, 56],
    shirt: [44, 132, 150], pants: [64, 66, 140], shoes: [56, 56, 64], mouth: [50, 80, 46],
  }, 200);
  const pink = [238, 158, 160];
  MODELS.pig = quadruped({
    legPos: [5, 3, 6], height: 15,
    bodySize: [16, 10, 8], bodyOffset: [-8, -5, 0],
    headSize: [8, 8, 8], headPivot: [8, 0, 8], headOffset: [0, -4, 0],
    body: (f, u, v, w, h, r) => vary(pink, r, 0.06),
    legs: (f, u, v, w, h, r) => (v >= h - 1 ? [120, 80, 80] : vary(pink, r, 0.06)),
    head: (f, u, v, w, h, r) => {
      if (f === 'front') {
        if (v === 2 && (u === 1 || u === 6)) return [20, 20, 20];
        if (v === 2 && (u === 0 || u === 7)) return [240, 240, 240];
      }
      return vary(pink, r, 0.06);
    },
    extra: { name: 'snout', size: [1, 4, 3], pivot: [16, 0, 9], offset: [0, -2, 0],
      skin: (f, u, v) => (f === 'front' && v === 1 && (u === 0 || u === 3) ? [120, 50, 60] : [226, 128, 140]) },
  }, 300);
  MODELS.sheep = quadruped({
    legPos: [5, 3, 8], height: 18,
    bodySize: [16, 12, 10], bodyOffset: [-8, -6, 0],
    headSize: [7, 6, 7], headPivot: [8, 0, 11], headOffset: [0, -3, 0],
    body: (f, u, v, w, h, r) => vary([234, 234, 230], r, 0.06),
    legs: (f, u, v, w, h, r) => (v < 3 ? vary([234, 234, 230], r, 0.06) : vary([214, 186, 166], r, 0.05)),
    head: (f, u, v, w, h, r) => {
      if (f === 'front') {
        if (v === 2 && (u === 1 || u === 5)) return [30, 30, 30];
        if (v === 2 && (u === 0 || u === 6)) return [240, 240, 240];
        if (v === 0) return vary([234, 234, 230], r, 0.06);
        return vary([214, 186, 166], r, 0.05);
      }
      if (f === 'top' || f === 'back' || v < 2) return vary([234, 234, 230], r, 0.06);
      return vary([214, 186, 166], r, 0.05);
    },
  }, 400);
}

// ---------- Rendu ----------
const corners = new Float64Array(24);

// e : { x, y, z, yaw, walk (phase), walkAmp, swing (0..1 bras), hurt }
// ox, oy : décalage écran (pixels) de l'origine monde.
export function drawModel(ctx, model, e, ox, oy) {
  const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
  const sc = model.scale / 16;
  const walkA = Math.sin(e.walk || 0) * (e.walkAmp || 0) * 0.9;
  const items = [];
  for (const p of model.parts) {
    let ang = 0;
    if (p.swing) ang = walkA * p.swing;
    if (p.arm && e.armsForward) ang = -1.45 + walkA * 0.15 * p.swing;
    if (p.right && e.swing > 0) ang = -Math.sin(e.swing * Math.PI) * 1.6 - 0.3;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const [sx, sy2, sz] = p.size;
    const [px, py, pz] = p.pivot;
    const [ox0, oy0, oz0] = p.offset;
    let n = 0, cxs = 0, cys = 0, czs = 0;
    for (let k = 0; k < 8; k++) {
      const lx = ox0 + (k & 1 ? sx : 0), ly = oy0 + (k & 2 ? sy2 : 0), lz = oz0 + (k & 4 ? sz : 0);
      // rotation du membre autour de l'axe y local (pivot)
      const rx = lx * ca + lz * sa, rz = -lx * sa + lz * ca;
      const mx = (px + rx) * sc, my = (py + ly) * sc, mz = (pz + rz) * sc;
      const wx = mx * cy - my * sy, wy = mx * sy + my * cy;
      corners[n++] = wx; corners[n++] = wy; corners[n++] = mz;
      cxs += wx; cys += wy; czs += mz;
    }
    items.push({ p, c: corners.slice(), depth: (cxs + cys + czs) / 8, ca, sa });
  }
  items.sort((a, b) => a.depth - b.depth);
  const bx = e.x, by = e.y, bz = e.z;
  const proj = (c, k) => {
    const wx = bx + c[k * 3], wy = by + c[k * 3 + 1], wz = bz + c[k * 3 + 2];
    return [ox + (wx - wy) * 16, oy + (wx + wy) * 8 - wz * 16];
  };
  // faces : [nom, coin origine, coin +u, coin +v, normale locale]
  const FACES = [
    ['front', 5, 7, 1, [1, 0, 0]],
    ['back', 6, 4, 2, [-1, 0, 0]],
    ['left', 7, 6, 3, [0, 1, 0]],
    ['right', 4, 5, 0, [0, -1, 0]],
    ['top', 5, 7, 4, [0, 0, 1]],
    ['bottom', 0, 2, 1, [0, 0, -1]],
  ];
  for (const it of items) {
    const { p, c, ca, sa } = it;
    for (const [face, i0, iu, iv, nl] of FACES) {
      // normale : rotation du membre puis lacet
      const nx0 = nl[0] * ca + nl[2] * sa, nz = -nl[0] * sa + nl[2] * ca, ny0 = nl[1];
      const nx = nx0 * cy - ny0 * sy, ny = nx0 * sy + ny0 * cy;
      const vis = nx + ny + nz;
      if (vis <= 0.02) continue;
      const wxp = Math.max(0, nx), wyp = Math.max(0, ny), wzp = Math.max(0, nz);
      const shade = (wzp * 1 + wyp * 0.8 + wxp * 0.62) / (wxp + wyp + wzp || 1);
      const level = Math.max(3, Math.min(10, Math.round(shade * 10)));
      const img = shadedFace(p, face, level, e.hurt > 0);
      const P0 = proj(c, i0), PU = proj(c, iu), PV = proj(c, iv);
      const w = img.width, h = img.height;
      ctx.setTransform((PU[0] - P0[0]) / w, (PU[1] - P0[1]) / w, (PV[0] - P0[0]) / h, (PV[1] - P0[1]) / h, P0[0], P0[1]);
      ctx.drawImage(img, 0, 0);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Position monde de la main droite (pour dessiner l'objet tenu).
export function handPosition(model, e) {
  const p = model.parts.find((q) => q.right);
  if (!p) return null;
  let ang = Math.sin(e.walk || 0) * (e.walkAmp || 0) * 0.9 * p.swing;
  if (e.swing > 0) ang = -Math.sin(e.swing * Math.PI) * 1.6 - 0.3;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const lx = 1, lz = -9;
  const rx = lx * ca + lz * sa, rz = -lx * sa + lz * ca;
  const sc = model.scale / 16;
  const mx = (p.pivot[0] + rx) * sc, my = p.pivot[1] * sc, mz = (p.pivot[2] + rz) * sc;
  const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
  return [e.x + mx * cy - my * sy, e.y + mx * sy + my * cy, e.z + mz];
}
