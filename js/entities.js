// Entités : physique voxel, joueur, animaux, zombies, objets au sol.
import { B, IS_SOLID, I, itemDef } from './blocks.js';
import { MODELS, drawModel, handPosition } from './models.js';
import { iconCanvas } from './textures.js';
import { project } from './renderer.js';

const EPS = 1e-4;

export function boxHitsSolid(world, x0, y0, z0, x1, y1, z1) {
  for (let z = Math.floor(z0); z <= Math.floor(z1); z++)
    for (let y = Math.floor(y0); y <= Math.floor(y1); y++)
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++)
        if (IS_SOLID[world.getBlock(x, y, z)]) return true;
  return false;
}

export class Entity {
  constructor(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.hw = 0.3; this.height = 1.8;
    this.onGround = false; this.inWater = false;
    this.yaw = Math.PI / 4;
    this.walk = 0; this.walkAmp = 0;
    this.hurt = 0;
    this.dead = false;
    this.groundZ = z;
    this.rect = [0, 0, 0, 0];
  }

  hits(x, y, z) {
    const w = this.hw;
    return boxHitsSolid(this.world, x - w + EPS, y - w + EPS, z + EPS, x + w - EPS, y + w - EPS, z + this.height - EPS);
  }

  // Déplacement avec collisions, axe par axe, en petits pas.
  move(dx, dy, dz) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.35) || 1;
    let hitX = false, hitY = false;
    this.onGround = false;
    const w = this.hw;
    for (let s = 0; s < steps; s++) {
      const sz = dz / steps;
      if (sz) {
        const nz = this.z + sz;
        if (this.hits(this.x, this.y, nz)) {
          if (sz < 0) { this.z = Math.floor(nz) + 1; this.onGround = true; }
          else this.z = Math.floor(nz + this.height) - this.height - EPS;
          this.vz = 0;
        } else this.z = nz;
      }
      const sx = dx / steps;
      if (sx) {
        const nx = this.x + sx;
        if (this.hits(nx, this.y, this.z)) {
          this.x = sx > 0 ? Math.floor(nx + w) - w - EPS : Math.floor(nx - w) + 1 + w + EPS;
          hitX = true;
        } else this.x = nx;
      }
      const sy = dy / steps;
      if (sy) {
        const ny = this.y + sy;
        if (this.hits(this.x, ny, this.z)) {
          this.y = sy > 0 ? Math.floor(ny + w) - w - EPS : Math.floor(ny - w) + 1 + w + EPS;
          hitY = true;
        } else this.y = ny;
      }
    }
    if (!this.onGround && dz <= 0 && this.hits(this.x, this.y, this.z - 0.02)) this.onGround = true;
    return { hitX, hitY };
  }

  // Peut-on monter une marche d'un bloc dans la direction (dx, dy) ?
  canStepUp(dx, dy) {
    const nx = this.x + Math.sign(dx) * 0.4, ny = this.y + Math.sign(dy) * 0.4;
    return this.hits(nx, ny, this.z) && !this.hits(nx, ny, this.z + 1.05) && !this.hits(this.x, this.y, this.z + 1.05);
  }

  physics(dt, wish, speed, opts = {}) {
    const world = this.world;
    const feet = world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z + 0.3));
    const chest = world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z + 1.1));
    this.inWater = feet === B.WATER || chest === B.WATER;
    this.headInWater = world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z + this.height - 0.2)) === B.WATER;
    let sp = speed * (this.inWater ? 0.55 : 1);
    const tx = wish[0] * sp, ty = wish[1] * sp;
    const acc = this.onGround || opts.flying ? 14 : this.inWater ? 5 : 4;
    const k = Math.min(1, dt * acc);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    if (opts.flying) {
      this.vz += ((opts.up ? 7 : 0) - (opts.down ? 7 : 0) - this.vz) * Math.min(1, dt * 10);
    } else if (this.inWater) {
      this.vz -= 9 * dt;
      if (opts.up) this.vz = Math.min(this.vz + 30 * dt, 3.6);
      this.vz = Math.max(this.vz, -3.2);
      this.vz *= 1 - Math.min(1, dt * 2);
    } else {
      this.vz -= 28 * dt;
      if (this.vz < -38) this.vz = -38;
      if (opts.up && this.onGround) this.vz = 8.6;
    }
    const before = this.z;
    const { hitX, hitY } = this.move(this.vx * dt, this.vy * dt, this.vz * dt);
    if ((hitX || hitY) && (opts.autoJump !== false) && this.onGround && !opts.flying) {
      if (this.canStepUp(hitX ? this.vx || tx : 0, hitY ? this.vy || ty : 0) || this.canStepUp(tx, ty)) this.vz = 8.6;
    }
    if (this.inWater && (hitX || hitY) && opts.up !== false && (tx || ty)) this.vz = Math.max(this.vz, 3.6);
    if (hitX) this.vx = 0;
    if (hitY) this.vy = 0;
    const hs = Math.hypot(this.vx, this.vy);
    if (hs > 0.3) {
      const target = Math.atan2(this.vy, this.vx);
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 12);
    }
    this.walk += hs * dt * 2.6;
    this.walkAmp += ((this.onGround || this.inWater ? Math.min(1, hs / 4) : 0.3) - this.walkAmp) * Math.min(1, dt * 10);
    if (this.hurt > 0) this.hurt -= dt;
    // sol sous l'entité (pour l'ombre)
    let gz = Math.floor(this.z);
    for (let i = 0; i < 12 && gz > 0; i++, gz--) if (IS_SOLID[world.getBlock(Math.floor(this.x), Math.floor(this.y), gz - 1)]) break;
    this.groundZ = gz;
    return this.z - before;
  }

  updateRect() {
    const [sx, sy] = project(this.x, this.y, this.z);
    const hh = this.height * 16 + 8, hw = (this.rectW || 12) + 3;
    this.rect = [sx - hw, sy - hh, sx + hw, sy + 4];
  }

  drawShadow(ctx, ox, oy) {
    const d = this.z - this.groundZ;
    if (d > 8) return;
    const [sx, sy] = project(this.x, this.y, this.groundZ);
    const r = (this.rectW || 10) * 0.75 * (1 - d / 12);
    ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - d / 10)})`;
    ctx.beginPath();
    ctx.ellipse(sx + ox, sy + oy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx, ox, oy, ghost) {
    if (!ghost) this.drawShadow(ctx, ox, oy);
    drawModel(ctx, this.model, this, ox, oy);
  }
}

// ---------- Joueur ----------
export class Player extends Entity {
  constructor(world, x, y, z) {
    super(x, y, z);
    this.world = world;
    this.model = MODELS.player;
    this.health = 20; this.food = 20;
    this.swing = 0;
    this.flying = false;
    this.fallStart = z;
    this.ghost = true;
    this.rectW = 11;
    this.held = 0;
    this.invuln = 0;
    this.airTime = 0;
  }

  draw(ctx, ox, oy, ghost) {
    super.draw(ctx, ox, oy, ghost);
    if (this.held && !ghost) {
      const hp = handPosition(this.model, this);
      if (hp) {
        const [sx, sy] = project(hp[0], hp[1], hp[2]);
        const ic = iconCanvas(this.held);
        ctx.drawImage(ic, Math.round(sx + ox - 6), Math.round(sy + oy - 8), 12, 12);
      }
    }
  }
}

// ---------- Mobs ----------
const MOB_DEFS = {
  pig: { health: 10, speed: 1.6, hw: 0.45, height: 0.9, rectW: 14, drops: (r) => [[I.PORK_RAW, 1 + Math.floor(r() * 3)]] },
  sheep: { health: 8, speed: 1.5, hw: 0.45, height: 1.2, rectW: 14, drops: (r) => [[B.WOOL_WHITE, 1], [I.MUTTON_RAW, 1 + Math.floor(r() * 2)]] },
  zombie: { health: 20, speed: 2.5, hw: 0.3, height: 1.8, rectW: 11, hostile: true, drops: (r) => [[I.ROTTEN_FLESH, Math.floor(r() * 3)]] },
};

export class Mob extends Entity {
  constructor(world, kind, x, y, z) {
    super(x, y, z);
    this.world = world;
    this.kind = kind;
    const d = MOB_DEFS[kind];
    this.def = d;
    this.model = MODELS[kind];
    this.health = d.health;
    this.hw = d.hw; this.height = d.height; this.rectW = d.rectW;
    this.yaw = Math.random() * Math.PI * 2;
    this.aiTimer = 0;
    this.wish = [0, 0];
    this.attackCd = 0;
    this.flee = 0;
    this.armsForward = kind === 'zombie';
    this.swing = 0;
    this.burn = 0;
  }

  update(dt, game) {
    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.aiTimer -= dt;
    this.attackCd -= dt;
    if (this.def.hostile && !p.dead && game.canBeAttacked() && dist < 18 && Math.abs(p.z - this.z) < 6) {
      this.wish = dist > 0.8 ? [dx / dist, dy / dist] : [0, 0];
      if (dist < 1.3 && Math.abs(p.z - this.z) < 1.5 && this.attackCd <= 0) {
        this.attackCd = 1;
        this.swing = 1;
        game.damagePlayer(3, this);
      }
    } else if (this.flee > 0) {
      this.flee -= dt;
      const d = dist || 1;
      this.wish = [-dx / d, -dy / d];
    } else if (this.aiTimer <= 0) {
      this.aiTimer = 2 + Math.random() * 4;
      if (Math.random() < 0.55) { const a = Math.random() * Math.PI * 2; this.wish = [Math.cos(a), Math.sin(a)]; }
      else this.wish = [0, 0];
    }
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3);
    const speed = this.def.speed * (this.flee > 0 ? 1.8 : 1);
    this.physics(dt, this.wish, speed, { up: this.inWater, autoJump: true });
    if (this.z < -10) this.dead = true;
  }

  draw(ctx, ox, oy, ghost) {
    super.draw(ctx, ox, oy, ghost);
  }
}

// ---------- Objet au sol ----------
export class ItemEntity extends Entity {
  constructor(world, id, count, x, y, z) {
    super(x, y, z);
    this.world = world;
    this.id = id; this.count = count;
    this.hw = 0.15; this.height = 0.3;
    this.age = 0;
    this.rectW = 7;
    this.vx = (Math.random() - 0.5) * 3;
    this.vy = (Math.random() - 0.5) * 3;
    this.vz = 4;
  }

  update(dt) {
    this.age += dt;
    this.vx *= 1 - Math.min(1, dt * (this.onGround ? 8 : 1));
    this.vy *= 1 - Math.min(1, dt * (this.onGround ? 8 : 1));
    this.vz -= 22 * dt;
    if (this.inWater) this.vz = Math.max(this.vz, -1);
    const w = this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    this.inWater = w === B.WATER;
    if (this.inWater) this.vz += 30 * dt;
    // sorti d'un bloc solide (placé dessus) : remonte
    if (this.hits(this.x, this.y, this.z)) { this.z = Math.floor(this.z) + 1; this.vz = 0; }
    this.move(this.vx * dt, this.vy * dt, this.vz * dt);
    let gz = Math.floor(this.z);
    for (let i = 0; i < 12 && gz > 0; i++, gz--) if (IS_SOLID[this.world.getBlock(Math.floor(this.x), Math.floor(this.y), gz - 1)]) break;
    this.groundZ = gz;
    if (this.age > 300 || this.z < -10) this.dead = true;
  }

  updateRect() {
    const [sx, sy] = project(this.x, this.y, this.z);
    this.rect = [sx - 8, sy - 20, sx + 8, sy + 2];
  }

  draw(ctx, ox, oy, ghost) {
    if (!ghost) this.drawShadow(ctx, ox, oy);
    const [sx, sy] = project(this.x, this.y, this.z);
    const bob = Math.sin(this.age * 3) * 2 - 6;
    const isBlock = itemDef(this.id)?.isBlock;
    const size = isBlock ? 14 : 12;
    ctx.drawImage(iconCanvas(this.id), Math.round(sx + ox - size / 2), Math.round(sy + oy - size + bob), size, size);
  }
}
