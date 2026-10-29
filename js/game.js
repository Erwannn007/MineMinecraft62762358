// Une partie en cours : joueur, monde, mobs, objets, temps, actions.
import { World, WH, SEA } from './world.js';
import { B, I, BLOCKS, IS_SOLID, IS_OPAQUE, itemDef, dropsFor, breakTime } from './blocks.js';
import { Player, Mob, ItemEntity } from './entities.js';
import { Inventory } from './inventory.js';
import { project } from './renderer.js';
import { storage } from './storage.js';
import { sfx } from './audio.js';
import { mulberry32 } from './noise.js';

const DAY = 1200; // durée d'une journée complète (s)
const SQ = Math.SQRT1_2;

export class Game {
  constructor(app, meta) {
    this.app = app;
    this.meta = meta;
    this.world = new World(meta, true);
    this.creative = meta.mode === 'creative';
    this.mobs = [];
    this.items = [];
    this.time = meta.time ?? 0.03;
    this.selected = meta.player?.selected ?? 0;
    this.inv = new Inventory(36, meta.player?.inv);
    this.fuel = meta.player?.fuel ?? 0;
    this.chests = meta.chests || {};
    this.mining = null;
    this.attackCd = 0;
    this.spawnTimer = 2;
    this.saveTimer = 15;
    this.unloadTimer = 5;
    this.cut = { on: false, t: 0, z: null };
    this.rng = mulberry32(Date.now() & 0xffffff);
    this.debug = false;
    this.stepDist = 0;
    this.hungerT = 0; this.regenT = 0; this.starveT = 0; this.drownT = 0;
    this.touchTarget = null;
    this.cam = null;
  }

  async load(progress) {
    const world = this.world;
    await world.init();
    this.app.renderer.setWorld(world);
    const mp = this.meta.player;
    let pos = mp && !mp.respawn ? [mp.x, mp.y, mp.z] : null;
    if (!this.meta.spawn) this.meta.spawn = world.gen.findSpawn();
    const [sx, sy] = pos || this.meta.spawn;
    const pcx = Math.floor(sx / 16), pcy = Math.floor(sy / 16);
    const R = 2;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) world.request(pcx + dx, pcy + dy);
    world.focus = [pcx, pcy];
    const total = (2 * R + 1) ** 2;
    while (world.genQueue.length || world.pending.size) {
      world.update(25);
      progress && progress(1 - (world.genQueue.length + world.pending.size) / total);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (!pos) {
      const top = world.topSolid(Math.floor(sx), Math.floor(sy));
      pos = [sx, sy, top + 1];
    }
    this.player = new Player(world, pos[0], pos[1], pos[2]);
    const p = this.player;
    if (this.meta.player) {
      p.health = this.meta.player.health ?? 20;
      p.food = this.meta.player.food ?? 20;
      p.yaw = this.meta.player.yaw ?? p.yaw;
      p.flying = !!this.meta.player.flying && this.creative;
    } else if (this.creative) {
      const starter = [B.GRASS, B.STONE, B.OAK_PLANKS, B.COBBLE, B.GLASS, B.OAK_LOG, B.TORCH, B.BRICKS, B.WOOL_RED];
      starter.forEach((id, i) => { this.inv.slots[i] = { id, count: 64, dmg: 0 }; });
    }
    p.air = 10;
    p.fallStart = p.z;
    this.cam = [p.x, p.y, p.z];
    this.app.ui.showItemName(this.heldDef()?.name);
  }

  // ---------- utilitaires ----------
  heldSlot() { return this.inv.slots[this.selected]; }
  heldDef() { const s = this.heldSlot(); return s ? itemDef(s.id) : null; }
  selectSlot(i) {
    this.selected = ((i % 9) + 9) % 9;
    this.mining = null;
    this.app.ui.showItemName(this.heldDef()?.name);
  }
  canBeAttacked() { return !this.creative && this.app.settings.mobs; }

  getChest(key) {
    if (!this.chests[key]) this.chests[key] = new Array(27).fill(null);
    return this.chests[key];
  }

  nearStations() {
    const p = this.player;
    const res = { table: false, furnace: false };
    for (let z = -2; z <= 2; z++) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      const id = this.world.getBlock(Math.floor(p.x) + x, Math.floor(p.y) + y, Math.floor(p.z) + z);
      if (id === B.CRAFTING_TABLE) res.table = true;
      if (id === B.FURNACE) res.furnace = true;
    }
    return res;
  }

  hasFuel() {
    if (this.creative || this.fuel >= 1) return true;
    return this.inv.slots.some((s) => s && itemDef(s.id).fuel);
  }

  useFuel() {
    if (this.creative) return true;
    if (this.fuel < 1) {
      const order = [I.COAL, I.CHARCOAL, B.OAK_LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.OAK_PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS, I.STICK];
      for (const id of order) {
        if (this.inv.count(id) > 0) { this.inv.remove(id, 1); this.fuel += itemDef(id).fuel; if (this.fuel >= 1) break; }
      }
    }
    if (this.fuel < 1) return false;
    this.fuel -= 1;
    return true;
  }

  onCraft(id) {
    if (id === B.CRAFTING_TABLE && !this.meta.tipTable) { this.meta.tipTable = true; this.app.ui.toast('Pose l\'établi pour fabriquer des outils'); }
  }

  dropItem(id, count, dmg = 0, thrown = true) {
    const p = this.player;
    const it = new ItemEntity(this.world, id, count, p.x, p.y, p.z + 1.2);
    it.dmg = dmg;
    if (thrown) {
      it.vx = Math.cos(p.yaw) * 4; it.vy = Math.sin(p.yaw) * 4; it.vz = 3;
      it.pickDelay = 1.5;
    }
    this.items.push(it);
  }

  spawnDrop(id, count, x, y, z, dmg = 0) {
    if (count <= 0) return;
    const it = new ItemEntity(this.world, id, count, x, y, z);
    it.dmg = dmg;
    it.pickDelay = 0.4;
    this.items.push(it);
  }

  // ---------- visée ----------
  // Renvoie { block, place, mob } pour un point écran (ou visée automatique manette).
  aimAt(sx, sy) {
    const r = this.app.renderer;
    const p = this.player;
    const reach = this.creative ? 8 : 5;
    const res = { block: null, place: null, mob: null };
    if (sx !== null) {
      const X = sx - r.ox, Y = sy - r.oy;
      let best = null;
      for (const m of this.mobs) {
        const [l, t, rr, b] = m.rect;
        if (X >= l && X <= rr && Y >= t && Y <= b && Math.hypot(m.x - p.x, m.y - p.y, m.z - p.z) < reach) {
          if (!best || m._depth > best._depth) best = m;
        }
      }
      res.mob = best;
      const inReach = (x, y, z) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y, z + 0.5 - (p.z + 1.5)) <= reach;
      const hit = r.pick(sx, sy, (id, x, y, z) => id !== B.WATER && inReach(x, y, z));
      if (hit) {
        {
          res.block = hit;
          if (BLOCKS[hit.id].replaceable) res.place = [hit.x, hit.y, hit.z];
          else if (hit.face === 'x') res.place = [hit.x + 1, hit.y, hit.z];
          else if (hit.face === 'y') res.place = [hit.x, hit.y + 1, hit.z];
          else res.place = [hit.x, hit.y, hit.z + 1];
        }
      }
      return res;
    }
    // visée automatique : bloc devant le joueur
    const fx = Math.floor(p.x + Math.cos(p.yaw) * 0.95), fy = Math.floor(p.y + Math.sin(p.yaw) * 0.95);
    const pz = Math.floor(p.z + 0.1);
    for (const m of this.mobs) {
      if (Math.hypot(m.x - p.x - Math.cos(p.yaw), m.y - p.y - Math.sin(p.yaw)) < 1.1 && Math.abs(m.z - p.z) < 1.5) { res.mob = m; break; }
    }
    const w = this.world;
    for (const z of [pz + 1, pz, pz - 1]) {
      const id = w.getBlock(fx, fy, z);
      if (id !== 0 && id !== 255 && id !== B.WATER) { res.block = { x: fx, y: fy, z, id, face: 'top' }; break; }
    }
    const feet = w.getBlock(fx, fy, pz), head = w.getBlock(fx, fy, pz + 1);
    if (feet === 0 || BLOCKS[feet]?.replaceable) res.place = [fx, fy, pz];
    else if (head === 0 || BLOCKS[head]?.replaceable) res.place = [fx, fy, pz + 1];
    if (res.place && res.place[2] === pz) {
      const below = w.getBlock(fx, fy, pz - 1);
      if (below === 0 || below === B.WATER) res.place = [fx, fy, pz - 1];
    }
    if (!res.block && res.place) {
      res.block = { x: res.place[0], y: res.place[1], z: res.place[2] - 1, id: w.getBlock(res.place[0], res.place[1], res.place[2] - 1), face: 'top' };
      if (res.block.id === 0 || res.block.id === B.WATER) res.block = null;
    }
    return res;
  }

  aimPoint() {
    const input = this.app.input;
    const r = this.app.renderer;
    if (input.device === 'pad') {
      if (!input.padCursorActive) return null;
      const [sx, sy] = project(this.player.x, this.player.y, this.player.z + 0.9);
      return [sx + r.ox + input.padCursor[0], sy + r.oy + input.padCursor[1]];
    }
    if (input.device === 'touch') return input.primary ? input.primaryPos : null;
    return input.pointer;
  }

  // ---------- actions ----------
  attack(m) {
    if (this.attackCd > 0) return;
    this.attackCd = 0.4;
    const p = this.player;
    p.swing = 1;
    const def = this.heldDef();
    let dmg = def?.damage ?? 1;
    if (def?.tool && def.tool.type !== 'sword') dmg = Math.max(1, dmg - 1);
    m.health -= dmg;
    m.hurt = 0.35;
    const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
    m.vx = (dx / d) * 7; m.vy = (dy / d) * 7; m.vz = 5;
    if (!m.def.hostile) m.flee = 4;
    sfx.hit();
    if (def?.tool) this.damageTool(1);
    if (m.health <= 0) {
      m.dead = true;
      for (const [id, n] of m.def.drops(this.rng)) this.spawnDrop(id, n, m.x, m.y, m.z + 0.5);
    }
  }

  damageTool(n) {
    if (this.creative) return;
    const s = this.heldSlot();
    const t = s && itemDef(s.id).tool;
    if (!t) return;
    s.dmg = (s.dmg || 0) + n;
    if (s.dmg >= t.durability) {
      this.inv.slots[this.selected] = null;
      sfx.breakBlock('wood');
      this.app.ui.toast('Ton outil s\'est cassé !');
    }
  }

  breakBlock(x, y, z) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    const def = BLOCKS[id];
    if (!def || def.hardness < 0) return;
    if (!this.creative) {
      for (const [did, n] of dropsFor(id, this.heldDef(), this.rng)) this.spawnDrop(did, n, x + 0.5, y + 0.5, z + 0.3);
      if (def.tool || def.hardness > 0) this.damageTool(def.hardness > 0 ? 1 : 0);
    }
    if (id === B.CHEST) {
      const key = x + ',' + y + ',' + z;
      const c = this.chests[key];
      if (c) for (const s of c) if (s) this.spawnDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, s.dmg);
      delete this.chests[key];
    }
    w.setBlock(x, y, z, B.AIR);
    const above = w.getBlock(x, y, z + 1);
    if (BLOCKS[above]?.cross) {
      if (!this.creative) for (const [did, n] of dropsFor(above, null, this.rng)) this.spawnDrop(did, n, x + 0.5, y + 0.5, z + 1.3);
      w.setBlock(x, y, z + 1, B.AIR);
    }
    sfx.breakBlock(def.sound);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* ignoré */ }
  }

  placeBlock(target) {
    if (!target.place) return false;
    const s = this.heldSlot();
    if (!s) return false;
    const def = itemDef(s.id);
    if (!def.isBlock) return false;
    const [x, y, z] = target.place;
    if (z < 0 || z >= WH) return false;
    const w = this.world;
    const cur = w.getBlock(x, y, z);
    if (cur === 255 || (cur !== 0 && !BLOCKS[cur].replaceable)) return false;
    const b = def.block;
    if (b.cross) {
      const below = w.getBlock(x, y, z - 1);
      if (!IS_SOLID[below] || !IS_OPAQUE[below]) return false;
      if (b.id !== B.TORCH && ![B.GRASS, B.DIRT, B.SNOW_GRASS, B.SAND].includes(below)) return false;
    }
    if (b.solid) {
      const ents = [this.player, ...this.mobs];
      for (const e of ents) {
        if (x + 1 > e.x - e.hw && x < e.x + e.hw && y + 1 > e.y - e.hw && y < e.y + e.hw && z + 1 > e.z && z < e.z + e.height) return false;
      }
    }
    w.setBlock(x, y, z, b.id);
    if (!this.creative) { s.count--; if (s.count <= 0) this.inv.slots[this.selected] = null; }
    this.player.swing = 1;
    sfx.place(b.sound);
    return true;
  }

  useItemOrBlock(target) {
    const p = this.player;
    const input = this.app.input;
    if (target.mob) { this.attack(target.mob); return; }
    const b = target.block;
    if (b && BLOCKS[b.id].usable && !input.sneak) {
      if (b.id === B.CRAFTING_TABLE) this.app.ui.openInventory(this, 'table');
      else if (b.id === B.FURNACE) this.app.ui.openInventory(this, 'furnace');
      else if (b.id === B.CHEST) this.app.ui.openInventory(this, 'chest', b.x + ',' + b.y + ',' + b.z);
      return;
    }
    const def = this.heldDef();
    if (def && def.food && (p.food < 20 || p.health < 20) && !this.creative) {
      p.food = Math.min(20, p.food + def.food);
      p.health = Math.min(20, p.health + Math.floor(def.food / 3));
      const s = this.heldSlot();
      s.count--; if (s.count <= 0) this.inv.slots[this.selected] = null;
      sfx.eat();
      return;
    }
    this.placeBlock(target);
  }

  damagePlayer(n, source) {
    const p = this.player;
    if (this.creative || p.dead || p.invuln > 0) return;
    p.health -= n;
    p.invuln = 0.6;
    p.hurt = 0.3;
    sfx.hurt();
    this.app.ui.flashDamage();
    if (source) {
      const dx = p.x - source.x, dy = p.y - source.y, d = Math.hypot(dx, dy) || 1;
      p.vx = (dx / d) * 6; p.vy = (dy / d) * 6; p.vz = 4.5;
    }
    if (p.health <= 0) this.die();
  }

  die() {
    const p = this.player;
    p.dead = true;
    p.health = 0;
    for (let i = 0; i < this.inv.size; i++) {
      const s = this.inv.slots[i];
      if (s) { this.spawnDrop(s.id, s.count, p.x, p.y, p.z + 0.5, s.dmg); this.inv.slots[i] = null; }
    }
    this.mining = null;
    const days = Math.floor((this.meta.daysPlayed || 0));
    this.app.ui.deathScreen(`Jours survécus : ${days}`);
  }

  respawn() {
    const p = this.player;
    const [sx, sy] = this.meta.spawn;
    const top = this.world.topSolid(Math.floor(sx), Math.floor(sy));
    p.x = sx; p.y = sy; p.z = (top >= 0 ? top : SEA) + 1;
    p.vx = p.vy = p.vz = 0;
    p.health = 20; p.food = 20; p.air = 10;
    p.dead = false;
    p.fallStart = p.z;
    this.cam = [p.x, p.y, p.z];
  }

  // ---------- boucle ----------
  update(dt) {
    const app = this.app, input = app.input, ui = app.ui;
    const p = this.player;
    for (const ev of input.takeEvents()) this.handleEvent(ev);
    if (ui.current === 'pause' || ui.current === 'options' || ui.current === 'death') {
      if (input.device === 'pad') ui.handlePad(input, dt);
      return;
    }
    if (ui.current) ui.handlePad(input, dt);

    this.time = (this.time + dt / DAY) % 1;
    if (this.time < this.lastTime) this.meta.daysPlayed = (this.meta.daysPlayed || 0) + 1;
    this.lastTime = this.time;
    const w = this.world;
    w.focus = [Math.floor(p.x / 16), Math.floor(p.y / 16)];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) w.request(w.focus[0] + dx, w.focus[1] + dy);
    w.update(5);

    if (!p.dead) this.updatePlayer(dt, !ui.current);
    this.attackCd -= dt;

    // objets au sol
    for (const it of this.items) {
      it.update(dt);
      if (it.pickDelay > 0) it.pickDelay -= dt;
      else if (!p.dead && Math.hypot(it.x - p.x, it.y - p.y, (it.z - (p.z + 0.6)) * 0.7) < 1.9) {
        const left = this.inv.add(it.id, it.count, it.dmg || 0);
        if (left < it.count) { sfx.pop(); this.app.ui.hudKey = ''; }
        it.count = left;
        if (left <= 0) it.dead = true;
      }
    }
    this.items = this.items.filter((i) => !i.dead);

    this.updateMobs(dt);

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 20; this.save(); }
    this.unloadTimer -= dt;
    if (this.unloadTimer <= 0) {
      this.unloadTimer = 6;
      w.unloadFar(w.focus[0], w.focus[1], 9);
      app.renderer.focusCx = w.focus[0]; app.renderer.focusCy = w.focus[1];
      app.renderer.trim(110);
    }
    ui.updateHUD(this);
    ui.tSneak.style.display = this.creative || p.inWater ? '' : 'none';
    if (app.settings.showCoords || this.debug) {
      const bi = w.gen.column(Math.floor(p.x), Math.floor(p.y));
      const names = ['Océan', 'Plage', 'Plaine', 'Forêt', 'Désert', 'Toundra', 'Montagne', 'Bouleaux'];
      let txt = `X ${p.x.toFixed(1)}  Y ${p.y.toFixed(1)}  Z ${p.z.toFixed(1)}\nBiome : ${names[bi.biome]}  Jour ${(this.meta.daysPlayed || 0) + 1}`;
      if (this.debug) txt += `\nFPS ${app.fps}  chunks ${w.chunks.size}  caches ${app.renderer.caches.size}\nmobs ${this.mobs.length}  objets ${this.items.length}  coupe ${this.cut.on ? this.cut.z : '-'}`;
      ui.debugEl.textContent = txt;
    } else if (ui.debugEl.textContent) ui.debugEl.textContent = '';
  }

  handleEvent(ev) {
    const ui = this.app.ui;
    switch (ev.type) {
      case 'inventory':
        if (ui.current === 'inventory') ui.close();
        else if (!ui.current && !this.player.dead) ui.openInventory(this, 'inventory');
        break;
      case 'pause':
        if (ui.current === 'pause') ui.close();
        else if (ui.current === 'inventory') ui.close();
        else if (ui.current === 'options') ui.pauseScreen();
        else if (!ui.current) { ui.pauseScreen(); this.save(); }
        break;
      case 'hotbar': if (!ui.current) this.selectSlot(ev.data); break;
      case 'hotbarDelta': if (!ui.current) this.selectSlot(this.selected + ev.data); break;
      case 'drop': {
        if (ui.current) break;
        const s = this.heldSlot();
        if (!s) break;
        const n = ev.data ? s.count : 1;
        this.dropItem(s.id, n, s.dmg);
        s.count -= n;
        if (s.count <= 0) this.inv.slots[this.selected] = null;
        break;
      }
      case 'fly':
        if (this.creative && !ui.current) {
          this.player.flying = !this.player.flying;
          ui.toast(this.player.flying ? 'Vol activé' : 'Vol désactivé', 1200);
        }
        break;
      case 'debug': this.debug = !this.debug; break;
      case 'zoom': this.app.changeZoom(ev.data); break;
      case 'joy': ui.updateJoy(ev.data); break;
      case 'pick': {
        if (!this.creative) break;
        const t = this.aimAt(ev.data[0], ev.data[1]);
        if (t.block) { this.inv.slots[this.selected] = { id: t.block.id, count: 64, dmg: 0 }; this.selectSlot(this.selected); }
        break;
      }
      case 'padconnected': ui.toast('Manette connectée'); ui.updateTouchVisibility(); break;
    }
  }

  updatePlayer(dt, control) {
    const app = this.app, input = app.input;
    const p = this.player;
    const [mx, my] = control ? input.move : [0, 0];
    const wish = [(mx + my) * SQ, (my - mx) * SQ];
    const flying = p.flying && this.creative;
    let speed = 4.3;
    if (control && input.sprint && !(p.food <= 6 && !this.creative)) speed *= 1.35;
    if (control && input.sneak && !flying && !p.inWater) speed *= 0.35;
    if (flying) speed *= 2.2;
    const wasGround = p.onGround;
    p.physics(dt, wish, speed, {
      up: control && input.jump, down: control && input.sneak, flying,
      autoJump: app.settings.autoJump && control && Math.hypot(mx, my) > 0.1,
    });
    if (p.swing > 0) p.swing = Math.max(0, p.swing - dt * 4);
    if (p.invuln > 0) p.invuln -= dt;
    p.held = this.heldSlot()?.id || 0;

    // chute
    if (p.onGround || p.inWater || flying) {
      if (!wasGround && p.onGround && !flying) {
        const fall = p.fallStart - p.z;
        if (fall > 3.4) this.damagePlayer(Math.floor(fall - 3));
        if (fall > 0.5) sfx.step(BLOCKS[this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z) - 1)]?.sound);
      }
      p.fallStart = p.z;
    } else p.fallStart = Math.max(p.fallStart, p.z);
    if (p.z < -30) {
      if (this.creative) { p.z = WH; p.vz = 0; } else this.damagePlayer(100);
    }
    // pas
    if (p.onGround) {
      this.stepDist += Math.hypot(p.vx, p.vy) * dt;
      if (this.stepDist > 1.7) {
        this.stepDist = 0;
        const id = this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z) - 1);
        sfx.step(BLOCKS[id]?.sound);
      }
    }
    if (p.inWater && !this.wasInWater && p.vz < -3) sfx.splash();
    this.wasInWater = p.inWater;

    // faim, vie, air
    if (!this.creative) {
      this.hungerT += dt * (input.sprint && Math.hypot(p.vx, p.vy) > 1 ? 2.2 : 1);
      if (this.hungerT > 40) { this.hungerT = 0; p.food = Math.max(0, p.food - 1); }
      if (p.food >= 18 && p.health < 20) {
        this.regenT += dt;
        if (this.regenT > 3) { this.regenT = 0; p.health = Math.min(20, p.health + 1); this.hungerT += 6; }
      }
      if (p.food <= 0) {
        this.starveT += dt;
        if (this.starveT > 4) { this.starveT = 0; if (p.health > 1) this.damagePlayer(1); }
      }
      if (p.headInWater) {
        p.air -= dt;
        if (p.air < 0) { this.drownT += dt; if (this.drownT > 1) { this.drownT = 0; this.damagePlayer(2); } }
      } else p.air = Math.min(10, p.air + dt * 5);
    } else { p.health = 20; p.food = 20; p.air = 10; }

    // visée et actions
    let aim = null;
    if (control) {
      const pt = this.aimPoint();
      const auto = input.device === 'pad' && !input.padCursorActive;
      if (pt || auto) aim = this.aimAt(auto ? null : pt[0], auto ? null : pt[1]);
    }
    this.aim = aim;
    const primary = control && (input.primary || input.padPrimary);
    if (primary && aim) {
      if (aim.mob) { this.attack(aim.mob); this.mining = null; }
      else if (aim.block) this.mine(aim.block, dt);
      else this.mining = null;
    } else this.mining = null;

    let sec = null;
    if (control && input.secondary) {
      sec = this.aimAt(input.secondary[0], input.secondary[1]);
      this.touchTarget = { t: 0.35, aim: sec };
    } else if (control && input.padSecondary) {
      sec = aim || this.aimAt(null, null);
    }
    input.secondary = null;
    input.padSecondary = false;
    if (sec) this.useItemOrBlock(sec);
    if (this.touchTarget) { this.touchTarget.t -= dt; if (this.touchTarget.t <= 0) this.touchTarget = null; }
  }

  mine(b, dt) {
    const m = this.mining;
    if (!m || m.x !== b.x || m.y !== b.y || m.z !== b.z) {
      this.mining = { x: b.x, y: b.y, z: b.z, id: b.id, t: 0, total: this.creative ? 0.18 : breakTime(b.id, this.heldDef()), snd: 0 };
      return;
    }
    m.t += dt;
    m.snd -= dt;
    this.player.swing = this.player.swing > 0.2 ? this.player.swing : 1;
    if (m.snd <= 0) { m.snd = 0.24; sfx.dig(BLOCKS[b.id].sound); }
    if (m.t >= m.total) {
      this.breakBlock(b.x, b.y, b.z);
      this.mining = null;
    }
  }

  updateMobs(dt) {
    const p = this.player, w = this.world;
    const dark = this.dayDarkness();
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      const passive = this.mobs.filter((m) => !m.def.hostile).length;
      const hostile = this.mobs.length - passive;
      const trySpawn = (kind, minD, maxD) => {
        const a = this.rng() * Math.PI * 2, d = minD + this.rng() * (maxD - minD);
        const x = Math.floor(p.x + Math.cos(a) * d), y = Math.floor(p.y + Math.sin(a) * d);
        const top = w.topSolid(x, y);
        if (top < 0 || top >= WH - 3) return;
        const ground = w.getBlock(x, y, top);
        if (kind !== 'zombie' && ground !== B.GRASS) return;
        if (ground === B.WATER || BLOCKS[ground].leaves || IS_SOLID[w.getBlock(x, y, top + 1)] || IS_SOLID[w.getBlock(x, y, top + 2)]) return;
        if (w.getBlock(x, y, top + 1) === B.WATER) return;
        this.mobs.push(new Mob(w, kind, x + 0.5, y + 0.5, top + 1));
      };
      if (passive < 7) trySpawn(this.rng() < 0.5 ? 'pig' : 'sheep', 16, 30);
      if (this.app.settings.mobs && dark > 0.5 && hostile < 6 && !this.creative) trySpawn('zombie', 14, 26);
    }
    for (const m of this.mobs) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > (m.def.hostile ? 44 : 64)) { m.dead = true; continue; }
      if (!w.getChunk(Math.floor(m.x / 16), Math.floor(m.y / 16))) continue;
      m.update(dt, this);
      if (m.def.hostile && dark < 0.2) {
        m.burn += dt;
        if (m.burn > 1) { m.burn = 0; m.health -= 2; m.hurt = 0.2; if (m.health <= 0) m.dead = true; }
      }
      if (this.rng() < dt * 0.04 && d < 16) {
        if (m.kind === 'zombie') sfx.zombie(); else if (m.kind === 'pig') sfx.pig(); else sfx.sheep();
      }
    }
    this.mobs = this.mobs.filter((m) => !m.dead);
  }

  // 0 = plein jour, ~0.8 = nuit noire
  dayDarkness() {
    const t = this.time;
    let light;
    if (t < 0.45) light = 1;
    else if (t < 0.55) light = 1 - (t - 0.45) / 0.1;
    else if (t < 0.92) light = 0;
    else light = (t - 0.92) / 0.08;
    return (1 - light) * 0.8;
  }

  // Vue en coupe quand le joueur est sous un toit (grotte, maison).
  updateCut(dt) {
    const p = this.player, w = this.world;
    const x = Math.floor(p.x), y = Math.floor(p.y), z0 = Math.floor(p.z + 0.1);
    let roof = false, thick = 0;
    for (let z = z0 + 2; z < WH; z++) {
      const id = w.getBlock(x, y, z);
      if (IS_OPAQUE[id] && !BLOCKS[id].leaves && id !== 255) { roof = true; thick++; }
    }
    const c = this.cut;
    c.t = roof ? Math.min(c.t + dt, 0.5) : Math.max(c.t - dt, -0.5);
    if (!c.on && c.t > 0.2) { c.on = true; c.z = z0 + 2; }
    else if (c.on && c.t < -0.3) { c.on = false; c.z = null; }
    if (c.on && (p.onGround || p.inWater) && c.z !== z0 + 2) c.z = z0 + 2;
    this.app.renderer.cutZ = c.on ? c.z : null;
    return Math.min(1, Math.max(0, (thick - 2) / 5));
  }

  render(dt) {
    const app = this.app, p = this.player, r = app.renderer;
    const k = Math.min(1, dt * 10);
    this.cam[0] += (p.x - this.cam[0]) * k;
    this.cam[1] += (p.y - this.cam[1]) * k;
    this.cam[2] += (p.z + 0.9 - this.cam[2]) * k;
    const cave = this.updateCut(dt);
    const dayDark = this.dayDarkness();
    const dark = Math.max(dayDark, cave * 0.74);
    const ents = [];
    if (!p.dead) { p.updateRect(); ents.push(p); }
    for (const m of this.mobs) { m.updateRect(); ents.push(m); }
    for (const it of this.items) { it.updateRect(); ents.push(it); }
    const lights = [[p.x, p.y, p.z + 1, p.held === B.TORCH ? 6.5 : p.held === B.LAMP ? 7 : cave > 0.3 ? 3.6 : 2.4]];
    let target = null, crack = -1, targetColor;
    const aim = this.aim || (this.touchTarget && this.touchTarget.aim);
    if (aim && aim.block && !aim.mob) target = [aim.block.x, aim.block.y, aim.block.z];
    if (this.mining && this.mining.total > 0) {
      crack = Math.min(9, Math.floor((this.mining.t / this.mining.total) * 10));
      target = [this.mining.x, this.mining.y, this.mining.z];
    }
    if (dark > 0.5) targetColor = 'rgba(255,255,255,0.5)';
    // teinte d'aube / crépuscule
    const t = this.time;
    let tint = null;
    const dusk = Math.max(0, 1 - Math.abs(t - 0.5) / 0.06), dawn = Math.max(0, 1 - Math.abs(t - 0.96) / 0.05);
    if (dusk + dawn > 0) tint = `rgba(255,110,40,${0.13 * (dusk + dawn)})`;
    if (p.headInWater) tint = 'rgba(20,60,160,0.28)';
    r.render({
      x: this.cam[0], y: this.cam[1], z: this.cam[2],
      entities: ents, target, crack, targetColor, dark, lights, tint,
      time: performance.now() / 1000,
      clouds: app.settings.clouds && !this.cut.on ? 0.11 * (1 - dayDark) : 0,
      bg: this.cut.on ? '#050507' : '#10121a',
    });
  }

  async save() {
    const p = this.player;
    if (!p) return;
    const m = this.meta;
    m.time = this.time;
    m.lastPlayed = Date.now();
    m.chests = this.chests;
    m.player = {
      x: p.x, y: p.y, z: p.z, yaw: p.yaw, health: p.dead ? 20 : p.health, food: p.food,
      inv: this.inv.slots, selected: this.selected, fuel: this.fuel, flying: p.flying,
    };
    if (p.dead) m.player.respawn = true;
    try {
      await this.world.save();
      await storage.putWorld(JSON.parse(JSON.stringify(m)));
    } catch (e) {
      console.warn('Sauvegarde impossible', e);
    }
  }
}
