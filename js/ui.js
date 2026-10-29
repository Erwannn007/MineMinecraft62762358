// Interface façon Minecraft : HUD, barre rapide, menus, inventaire, artisanat, coffres.
import { ITEMS, BLOCKS, B, I, itemDef } from './blocks.js';
import { iconURL, textureURL, TEX } from './textures.js';
import { RECIPES, canCraft, craft, maxStack } from './inventory.js';
import { sfx } from './audio.js';

// ---------- petits utilitaires DOM ----------
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

function pixelImage(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }
  }));
  return c.toDataURL();
}

const HEART = [
  '.KK.KK..',
  'KRWKRRK.',
  'KWRRRRRK',
  'KRRRRRRK',
  '.KRRRRK.',
  '..KRRK..',
  '...KK...',
  '........',
  '........',
];
const FOOD = [
  '.....KK.',
  '....KWWK',
  '...KBWBK',
  '..KMMKK.',
  '.KMMMMK.',
  'KMLMMK..',
  'KMMMK...',
  '.KKK....',
  '........',
];
const BUBBLE = [
  '..KKKK..',
  '.KWWBBK.',
  'KWBBBBBK',
  'KBBBBBBK',
  'KBBBBBBK',
  '.KBBBBK.',
  '..KKKK..',
  '........',
  '........',
];
function heartIcons() {
  const full = { K: '#1a0000', R: '#d81818', W: '#ffb4b4' };
  const empty = { K: '#1a0000', R: '#3a1010', W: '#3a1010' };
  const half = HEART.map((r) => [...r].map((c, x) => (x >= 4 && (c === 'R' || c === 'W') ? 'E' : c)).join(''));
  return {
    full: pixelImage(HEART, full),
    empty: pixelImage(HEART, empty),
    half: pixelImage(half, { ...full, E: '#3a1010' }),
  };
}
function foodIcons() {
  const full = { K: '#2a1200', W: '#f0e6dc', B: '#c8b8a8', M: '#b8642c', L: '#e08a4a' };
  const empty = { K: '#2a1200', W: '#3a2a20', B: '#3a2a20', M: '#3a2a20', L: '#3a2a20' };
  const half = FOOD.map((r) => [...r].map((c, x) => (x < 4 && 'WBML'.includes(c) ? 'E' : c)).join(''));
  return { full: pixelImage(FOOD, full), empty: pixelImage(FOOD, empty), half: pixelImage(half, { ...full, E: '#3a2a20' }) };
}

function hotbarImage() {
  const c = document.createElement('canvas');
  c.width = 182; c.height = 22;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.75)';
  g.fillRect(0, 0, 182, 22);
  for (let i = 0; i < 9; i++) {
    const x = 1 + i * 20;
    g.fillStyle = 'rgba(70,70,70,0.75)';
    g.fillRect(x, 1, 20, 20);
    g.fillStyle = 'rgba(150,150,150,0.9)';
    g.fillRect(x, 1, 20, 1); g.fillRect(x, 1, 1, 20);
    g.fillStyle = 'rgba(40,40,40,0.9)';
    g.fillRect(x, 20, 20, 1); g.fillRect(x + 19, 1, 1, 20);
    g.fillStyle = 'rgba(110,110,110,0.45)';
    g.fillRect(x + 2, 3, 16, 16);
  }
  return c.toDataURL();
}
function selectorImage() {
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 24, 24);
  g.clearRect(3, 3, 18, 18);
  g.fillStyle = '#fff'; g.fillRect(1, 1, 22, 22);
  g.clearRect(3, 3, 18, 18);
  g.fillStyle = '#a0a0a0';
  g.fillRect(3, 3, 18, 1); g.fillRect(3, 3, 1, 18); g.fillRect(3, 20, 18, 1); g.fillRect(20, 3, 1, 18);
  g.clearRect(4, 4, 16, 16);
  return c.toDataURL();
}

// Logo en lettres-blocs de pierre.
const GLYPHS = {
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  I: ['XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X.X.X', 'X..XX', 'X...X', 'X...X'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
};
function logoImage(text) {
  const P = 6, D = 3;
  let cols = 0;
  for (const ch of text) cols += GLYPHS[ch][0].length + 1;
  const c = document.createElement('canvas');
  c.width = cols * P + D + 2; c.height = 7 * P + D + 2;
  const g = c.getContext('2d');
  const stone = TEX.stone;
  const cells = [];
  let cx = 0;
  for (const ch of text) {
    const gl = GLYPHS[ch];
    gl.forEach((row, y) => [...row].forEach((v, x) => { if (v === 'X') cells.push([cx + x, y]); }));
    cx += gl[0].length + 1;
  }
  // extrusion
  g.fillStyle = '#1c1c1c';
  for (const [x, y] of cells) for (let d = 1; d <= D; d++) g.fillRect(1 + x * P + d, 1 + y * P + d, P, P);
  for (const [x, y] of cells) {
    for (let py = 0; py < P; py++) for (let px = 0; px < P; px++) {
      const [r, gg, b] = stone.get(x * P + px, y * P + py);
      let f = 1.05;
      if (px === 0 || py === 0) f = 1.35; else if (px === P - 1 || py === P - 1) f = 0.7;
      g.fillStyle = `rgb(${Math.min(255, r * f)},${Math.min(255, gg * f)},${Math.min(255, b * f)})`;
      g.fillRect(1 + x * P + px, 1 + y * P + py, 1, 1);
    }
  }
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#000';
  for (const [x, y] of cells) g.fillRect(x * P, y * P, P + 2, P + 2);
  return c.toDataURL();
}

const SPLASHES = ['Édition perso !', 'Monde infini !', '100% pixel !', 'Vue 3/4 !', 'Rien qu\'à moi !', 'Isométrique !', 'Fait main !', 'Creuse droit !'];

export class UI {
  constructor(app) {
    this.app = app;
    this.screenEl = document.getElementById('screen');
    this.current = null;
    this.focusIdx = -1;
    this.navRepeat = 0;
    this.icons = { heart: heartIcons(), food: foodIcons(), bubble: pixelImage(BUBBLE, { K: '#1c3d7a', W: '#ffffff', B: '#5f9ae8' }) };
    this.dirtBg = `url(${textureURL('dirt', 1, 0.72)})`;
    this.stoneBg = `url(${textureURL('stone', 1, 0.42)})`;
    this.buildHUD();
    this.buildTouch();
    this.tooltip = h('div', { id: 'tooltip', class: 'shadow' });
    this.cursorEl = h('div', { id: 'cursor-stack' });
    document.body.append(this.tooltip, this.cursorEl);
    window.addEventListener('pointermove', (e) => {
      this.lastPointer = [e.clientX, e.clientY];
      this.positionCursor();
      if (this.tooltip.style.display === 'block') this.positionTooltip();
    });
  }

  // ---------- HUD ----------
  buildHUD() {
    const hud = document.getElementById('hud');
    this.debugEl = h('div', { id: 'debug', class: 'shadow' });
    this.itemNameEl = h('div', { id: 'itemname', class: 'shadow' });
    this.heartsEl = h('div', { id: 'hearts', class: 'bar-row' });
    this.hungerEl = h('div', { id: 'hunger', class: 'bar-row right' });
    this.airEl = h('div', { id: 'air', class: 'bar-row right' });
    this.barsEl = h('div', { id: 'bars' }, this.heartsEl, this.airEl, this.hungerEl);
    this.hbSlots = [];
    this.hotbarEl = h('div', { id: 'hotbar', style: `background-image:url(${hotbarImage()})` });
    for (let i = 0; i < 9; i++) {
      const s = h('div', { class: 'hb-slot' });
      s.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const g = this.app.game;
        if (g) { g.selectSlot(i); }
      });
      this.hbSlots.push(s);
      this.hotbarEl.append(s);
    }
    this.selEl = h('div', { id: 'hb-sel', style: `background-image:url(${selectorImage()})` });
    this.hotbarEl.append(this.selEl);
    this.toastEl = h('div', { id: 'toast', class: 'shadow' });
    this.damageEl = h('div', { id: 'damage' });
    hud.append(this.debugEl, this.toastEl, h('div', { id: 'bottom' }, this.itemNameEl, this.barsEl, this.hotbarEl));
    document.body.append(this.damageEl);
    this.hudKey = '';
  }

  slotContent(s) {
    const out = [];
    if (!s) return out;
    out.push(h('img', { class: 'icon', src: iconURL(s.id), draggable: 'false' }));
    if (s.count > 1) out.push(h('span', { class: 'count' }, String(s.count)));
    const t = itemDef(s.id)?.tool;
    if (t && s.dmg > 0) {
      const f = Math.max(0, 1 - s.dmg / t.durability);
      const col = `hsl(${Math.round(f * 120)},100%,50%)`;
      out.push(h('div', { class: 'dur' }, h('i', { style: `width:${Math.round(f * 100)}%;background:${col}` })));
    }
    return out;
  }

  updateHUD(game) {
    const p = game.player;
    const inv = game.inv;
    const key = JSON.stringify([inv.slots.slice(0, 9), game.selected, p.health, p.food, Math.ceil(p.air), game.creative]);
    if (key === this.hudKey) return;
    this.hudKey = key;
    for (let i = 0; i < 9; i++) {
      const el = this.hbSlots[i];
      el.replaceChildren(...this.slotContent(inv.slots[i]));
    }
    this.selEl.style.left = `calc(var(--u) * ${game.selected * 20 - 1})`;
    this.barsEl.style.visibility = game.creative ? 'hidden' : 'visible';
    const row = (el, val, icons, max = 20) => {
      const kids = [];
      for (let i = 0; i < max / 2; i++) {
        const v = val - i * 2;
        kids.push(h('img', { src: v >= 2 ? icons.full : v === 1 ? icons.half : icons.empty }));
      }
      el.replaceChildren(...kids);
    };
    row(this.heartsEl, Math.ceil(p.health), this.icons.heart);
    row(this.hungerEl, Math.ceil(p.food), this.icons.food);
    if (p.air < 10) {
      const n = Math.max(0, Math.ceil(p.air));
      this.airEl.replaceChildren(...Array.from({ length: n }, () => h('img', { src: this.icons.bubble })));
    } else this.airEl.replaceChildren();
  }

  showItemName(name) {
    this.itemNameEl.textContent = name || '';
    this.itemNameEl.style.opacity = '1';
    clearTimeout(this.itemNameT);
    this.itemNameT = setTimeout(() => { this.itemNameEl.style.opacity = '0'; }, 1800);
  }

  toast(msg, ms = 2200) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  flashDamage() {
    this.damageEl.classList.add('show');
    requestAnimationFrame(() => requestAnimationFrame(() => this.damageEl.classList.remove('show')));
  }

  setHUDVisible(v) {
    document.getElementById('hud').classList.toggle('hidden', !v);
    this.updateTouchVisibility();
  }

  // ---------- Contrôles tactiles ----------
  buildTouch() {
    const t = document.getElementById('touch');
    const icon = (id) => h('img', { src: iconURL(id) });
    const mk = (id, content, cls = '') => h('button', { id, class: 'tbtn ' + cls }, content);
    this.joyBase = h('div', { id: 'joy-base' }, h('div', { id: 'joy-knob' }));
    this.joyHint = h('div', { id: 'joy-hint' });
    const arrowUp = pixelImage(['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '...XX...', '...XX...', '...XX...', '...XX...'], { X: '#ffffff' });
    const arrowDown = pixelImage(['...XX...', '...XX...', '...XX...', '...XX...', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'], { X: '#ffffff' });
    const pauseImg = pixelImage(['XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX'], { X: '#ffffff' });
    const dots = pixelImage(['........', '........', '........', 'XX.XX.XX', 'XX.XX.XX', '........', '........', '........'], { X: '#ffffff' });
    const wing = pixelImage(['X......X', 'XX....XX', 'XXX..XXX', '.XXXXXX.', '..XXXX..', '...XX...', '........', '........'], { X: '#ffffff' });
    const drop = pixelImage(['...XX...', '...XX...', '...XX...', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', 'XXXXXXXX'], { X: '#ffffff' });
    this.tJump = mk('t-jump', h('img', { src: arrowUp }));
    this.tSneak = mk('t-sneak', h('img', { src: arrowDown }));
    this.tFly = mk('t-fly', h('img', { src: wing }), 'small');
    this.tInv = mk('t-inv', h('img', { src: dots }));
    this.tPause = mk('t-pause', h('img', { src: pauseImg }), 'small');
    this.tDrop = mk('t-drop', h('img', { src: drop }), 'small');
    t.append(this.joyHint, this.joyBase, this.tJump, this.tSneak, this.tFly, this.tInv, this.tPause, this.tDrop);
    const hold = (el, on, off) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); on(); });
      const up = (e) => { el.classList.remove('on'); off && off(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    };
    const inp = () => this.app.input;
    hold(this.tJump, () => { inp().btnJump = true; }, () => { inp().btnJump = false; });
    hold(this.tSneak, () => { inp().btnSneak = true; }, () => { inp().btnSneak = false; });
    hold(this.tFly, () => inp().emit('fly'));
    hold(this.tInv, () => inp().emit('inventory'));
    hold(this.tPause, () => inp().emit('pause'));
    hold(this.tDrop, () => inp().emit('drop', false));
  }

  updateJoy(j) {
    if (!j) { this.joyBase.style.display = 'none'; this.joyHint.style.display = ''; return; }
    this.joyHint.style.display = 'none';
    this.joyBase.style.display = 'block';
    this.joyBase.style.left = j.bx + 'px';
    this.joyBase.style.top = j.by + 'px';
    let dx = j.x - j.bx, dy = j.y - j.by;
    const d = Math.hypot(dx, dy);
    if (d > 46) { dx *= 46 / d; dy *= 46 / d; }
    this.joyBase.firstChild.style.transform = `translate(${dx}px,${dy}px)`;
  }

  updateTouchVisibility() {
    const s = this.app.settings.touch;
    const dev = this.app.input.device;
    const show = !!this.app.game && !this.current && (s === 'on' || (s === 'auto' && dev === 'touch'));
    document.getElementById('touch').classList.toggle('hidden', !show);
    const g = this.app.game;
    if (g) {
      this.tFly.style.display = g.creative ? '' : 'none';
      this.tSneak.style.display = g.creative || g.player.inWater ? '' : 'none';
    }
  }

  // ---------- Écrans ----------
  open(name, build, cls = 'dirt') {
    this.current = name;
    this.screenEl.className = 'open ' + cls;
    this.screenEl.style.backgroundImage = cls === 'dirt' ? this.dirtBg : '';
    this.screenEl.replaceChildren(...[].concat(build()));
    this.focusIdx = -1;
    this.tooltip.style.display = 'none';
    this.updateTouchVisibility();
    if (this.app.input.device === 'pad') this.moveFocus(null);
  }

  close() {
    if (this.current === 'inventory') this.closeInventory();
    this.current = null;
    this.screenEl.className = '';
    this.screenEl.replaceChildren();
    this.tooltip.style.display = 'none';
    this.cursorEl.classList.remove('show');
    this.updateTouchVisibility();
  }

  isOpen() { return !!this.current; }

  btn(label, onclick, opts = {}) {
    const b = h('button', { class: 'btn nav', style: this.stoneBgStyle() }, label);
    if (opts.disabled) b.disabled = true;
    b.addEventListener('click', () => { if (!b.disabled) { sfx.click(); onclick(b); } });
    return b;
  }
  stoneBgStyle() { return `background-image:${this.stoneBg}`; }

  titleScreen() {
    const splash = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    this.open('title', () => [
      h('div', { class: 'logo-wrap' },
        h('img', { class: 'logo', src: logoImage('MINEMINECRAFT'), draggable: 'false' }),
        h('div', { class: 'splash' }, splash)),
      h('div', { class: 'spacer' }),
      h('div', { class: 'col' },
        this.btn('Solo', () => this.worldsScreen()),
        this.btn('Options', () => this.optionsScreen(() => this.titleScreen())),
        this.app.canInstallHint ? h('div', { class: 'muted shadow', style: 'text-align:center' }, this.app.canInstallHint) : null,
      ),
      h('div', { class: 'spacer' }),
      h('div', { class: 'foot shadow' }, h('span', {}, 'MineMinecraft v1.0'), h('span', {}, 'Monde perso')),
    ], 'center');
  }

  async worldsScreen() {
    const worlds = await this.app.listWorlds();
    let sel = worlds[0]?.id || null;
    const list = h('div', { class: 'list' });
    const playBtn = this.btn('Jouer au monde', () => { const w = worlds.find((x) => x.id === sel); if (w) this.app.startWorld(w); });
    const delBtn = this.btn('Supprimer', () => sel && this.confirmDelete(worlds.find((x) => x.id === sel)));
    const refresh = () => {
      list.replaceChildren(...(worlds.length ? worlds.map((w) => {
        const d = new Date(w.lastPlayed || w.created);
        const item = h('div', { class: 'list-item nav' + (w.id === sel ? ' sel' : '') },
          h('div', { class: 'shadow' }, w.name),
          h('div', { class: 'sub' }, `${w.mode === 'creative' ? 'Créatif' : 'Survie'} · ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`));
        item.addEventListener('click', () => {
          if (sel === w.id) { this.app.startWorld(w); return; }
          sel = w.id; sfx.click(); refresh();
        });
        return item;
      }) : [h('div', { class: 'muted', style: 'padding:calc(var(--u)*8);text-align:center' }, 'Aucun monde. Crée-en un !')]));
      playBtn.disabled = !sel; delBtn.disabled = !sel;
    };
    refresh();
    this.open('worlds', () => [
      h('div', { class: 'title-h shadow' }, 'Choisir un monde'),
      list,
      h('div', { class: 'col', style: 'margin-top:calc(var(--u)*6)' },
        playBtn,
        this.btn('Créer un nouveau monde', () => this.createWorldScreen()),
        h('div', { class: 'row' }, delBtn, this.btn('Retour', () => this.titleScreen()))),
    ]);
  }

  confirmDelete(w) {
    if (!w) return;
    this.open('confirm', () => [
      h('div', { class: 'spacer' }),
      h('div', { class: 'title-h shadow' }, 'Supprimer ce monde ?'),
      h('div', { class: 'muted shadow', style: 'text-align:center;margin-bottom:calc(var(--u)*10)' }, `« ${w.name} » sera perdu pour toujours !`),
      h('div', { class: 'col' },
        h('div', { class: 'row' },
          this.btn('Supprimer', async () => { await this.app.deleteWorld(w.id); this.worldsScreen(); }),
          this.btn('Annuler', () => this.worldsScreen()))),
      h('div', { class: 'spacer' }),
    ]);
  }

  createWorldScreen() {
    let mode = 'survival';
    const name = h('input', { type: 'text', value: 'Nouveau monde', maxlength: '32', class: 'nav', enterkeyhint: 'done' });
    const seed = h('input', { type: 'text', value: '', placeholder: 'aléatoire', maxlength: '32', class: 'nav', enterkeyhint: 'done' });
    const modeBtn = this.btn('', () => { mode = mode === 'survival' ? 'creative' : 'survival'; setMode(); });
    const desc = h('div', { class: 'muted shadow', style: 'text-align:center' });
    const setMode = () => {
      modeBtn.textContent = 'Mode de jeu : ' + (mode === 'survival' ? 'Survie' : 'Créatif');
      desc.textContent = mode === 'survival' ? 'Récolte, fabrique, survis aux zombies.' : 'Blocs illimités, vol, aucun danger.';
    };
    setMode();
    this.open('create', () => [
      h('div', { class: 'title-h shadow' }, 'Créer un nouveau monde'),
      h('div', { class: 'col' },
        h('div', { class: 'field' }, h('label', { class: 'shadow' }, 'Nom du monde'), name),
        h('div', { class: 'field' }, h('label', { class: 'shadow' }, 'Graine (seed)'), seed),
        modeBtn, desc,
        h('div', { class: 'spacer' }),
        h('div', { class: 'row' },
          this.btn('Créer le monde', () => this.app.createWorld(name.value.trim() || 'Nouveau monde', seed.value, mode)),
          this.btn('Annuler', () => this.worldsScreen()))),
    ]);
  }

  optionsScreen(back) {
    const s = this.app.settings;
    const set = (k, v) => { s[k] = v; this.app.applySettings(); };
    const items = [
      ['zoom', () => 'Zoom : ' + (s.zoom === 0 ? 'Auto' : 'x' + s.zoom), () => set('zoom', (s.zoom + 1) % 7)],
      ['volume', () => 'Son : ' + (s.volume === 0 ? 'Coupé' : Math.round(s.volume * 100) + '%'), () => set('volume', s.volume >= 1 ? 0 : Math.round((s.volume + 0.1) * 10) / 10)],
      ['autoJump', () => 'Saut automatique : ' + (s.autoJump ? 'OUI' : 'NON'), () => set('autoJump', !s.autoJump)],
      ['mobs', () => 'Monstres la nuit : ' + (s.mobs ? 'OUI' : 'NON'), () => set('mobs', !s.mobs)],
      ['clouds', () => 'Ombres des nuages : ' + (s.clouds ? 'OUI' : 'NON'), () => set('clouds', !s.clouds)],
      ['showCoords', () => 'Coordonnées : ' + (s.showCoords ? 'OUI' : 'NON'), () => set('showCoords', !s.showCoords)],
      ['touch', () => 'Contrôles tactiles : ' + ({ auto: 'Auto', on: 'Toujours', off: 'Jamais' })[s.touch], () => set('touch', s.touch === 'auto' ? 'on' : s.touch === 'on' ? 'off' : 'auto')],
    ];
    const ingame = !!this.app.game;
    this.open('options', () => [
      h('div', { class: 'title-h shadow' }, 'Options'),
      h('div', { class: 'col' },
        ...items.map(([, label, act]) => {
          const b = this.btn(label(), () => { act(); b.textContent = label(); });
          return b;
        }),
        h('div', { class: 'spacer' }),
        h('div', { class: 'muted shadow', style: 'text-align:center' }, 'PC : ZQSD/WASD, Espace, clic gauche/droit, E, 1-9, molette, F (vol), Q (jeter)'),
        h('div', { class: 'muted shadow', style: 'text-align:center' }, 'Manette : stick G bouger, stick D viser, RT casser, LT poser, A sauter, Y inventaire'),
        this.btn('Terminé', back)),
    ], ingame ? 'dim' : 'dirt');
  }

  pauseScreen() {
    this.open('pause', () => [
      h('div', { class: 'spacer' }),
      h('div', { class: 'title-h shadow' }, 'Menu du jeu'),
      h('div', { class: 'col' },
        this.btn('Retour au jeu', () => this.close()),
        this.btn('Options', () => this.optionsScreen(() => this.pauseScreen())),
        this.btn('Sauvegarder et quitter', () => this.app.quitToTitle())),
      h('div', { class: 'spacer' }),
    ], 'dim center');
  }

  deathScreen(score) {
    this.open('death', () => [
      h('div', { class: 'title-h shadow', style: 'font-size:calc(var(--u)*18)' }, 'Vous êtes mort !'),
      h('div', { class: 'shadow', style: 'margin-bottom:calc(var(--u)*12)' }, score),
      h('div', { class: 'col' },
        this.btn('Réapparaître', () => { this.close(); this.app.game.respawn(); }),
        this.btn('Écran titre', () => this.app.quitToTitle())),
    ], 'death');
  }

  loadingScreen(text) {
    const bar = h('i');
    this.open('loading', () => [
      h('div', { class: 'spacer' }),
      h('div', { class: 'title-h shadow' }, text),
      h('div', { class: 'bar' }, bar),
      h('div', { class: 'spacer' }),
    ], 'dirt');
    return (p) => { bar.style.width = Math.round(p * 100) + '%'; };
  }

  // ---------- Inventaire / artisanat / coffre ----------
  openInventory(game, mode = 'inventory', chestKey = null) {
    const near = game.nearStations();
    this.inv = {
      game, mode, chestKey,
      table: mode === 'table' || near.table,
      furnace: mode === 'furnace' || near.furnace,
      cursor: null,
      tab: mode === 'furnace' ? 'four' : 'tout',
      ctab: 'blocs',
    };
    this.renderInventory();
  }

  closeInventory() {
    const st = this.inv;
    if (!st) return;
    if (st.cursor) {
      const left = st.game.inv.add(st.cursor.id, st.cursor.count, st.cursor.dmg);
      if (left > 0) st.game.dropItem(st.cursor.id, left, st.cursor.dmg);
      st.cursor = null;
    }
    this.inv = null;
    this.cursorEl.classList.remove('show');
  }

  renderInventory(keepScroll = true) {
    const st = this.inv;
    const game = st.game;
    const scrollers = keepScroll ? [...this.screenEl.querySelectorAll('.recipes,.palette')].map((e) => e.scrollTop) : [];
    const focusKey = this.focusIdx >= 0 ? this.navEls()[this.focusIdx]?.dataset.key : null;
    const landscape = innerWidth > innerHeight * 1.15 && innerWidth > 640;
    const titles = { inventory: game.creative ? 'Créatif' : 'Inventaire', table: 'Établi', furnace: 'Four', chest: 'Coffre' };
    const info = h('span', { class: 'info' });
    this.invInfo = info;
    const closeBtn = h('button', { class: 'close-x nav', 'data-key': 'close' }, 'X');
    closeBtn.addEventListener('click', () => { sfx.click(); this.close(); });

    let top;
    if (st.mode === 'chest') {
      const chest = game.getChest(st.chestKey);
      top = this.slotGrid({ slots: chest }, 0, 27, 'c');
    } else if (game.creative && st.mode === 'inventory') {
      top = this.creativePalette();
    } else {
      top = this.recipeList();
    }
    const invGrid = this.slotGrid(game.inv, 9, 36, 'i');
    const hotGrid = this.slotGrid(game.inv, 0, 9, 'h');
    hotGrid.classList.add('hot');
    const right = h('div', {}, invGrid, hotGrid);
    if (game.creative && st.mode === 'inventory') {
      const trash = h('div', { class: 'slot nav', 'data-key': 'trash', title: 'Supprimer' }, h('span', { style: 'color:#ff5555' }, 'X'));
      this.bindSlot(trash, () => { if (st.cursor) { st.cursor = null; this.renderInventory(); } }, () => {});
      right.append(h('div', { style: 'display:flex;justify-content:flex-end;margin-top:calc(var(--u)*4);gap:calc(var(--u)*4);align-items:center' }, h('span', {}, 'Corbeille'), trash));
    }
    const layout = h('div', { class: 'inv-layout' + (landscape ? '' : ' portrait') }, top, right);
    const panel = h('div', { class: 'panel' },
      h('h3', {}, h('span', {}, titles[st.mode]), info, closeBtn),
      layout);
    if (!game.creative && st.mode !== 'chest') {
      panel.append(h('div', { class: 'fuel' }, `Combustible : ${Math.floor(game.fuel)} cuisson(s)`));
    }
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.open('inventory', () => [panel], 'dim center');
    this.screenEl.onpointerdown = (e) => {
      if (e.target === this.screenEl && st.cursor) {
        game.dropItem(st.cursor.id, st.cursor.count, st.cursor.dmg, true);
        st.cursor = null;
        this.renderInventory();
      }
    };
    [...this.screenEl.querySelectorAll('.recipes,.palette')].forEach((e, i) => { if (scrollers[i]) e.scrollTop = scrollers[i]; });
    this.updateCursor();
    if (focusKey) {
      const els = this.navEls();
      const i = els.findIndex((e) => e.dataset.key === focusKey);
      if (i >= 0) this.setFocus(i);
    } else if (this.app.input.device === 'pad') this.moveFocus(null);
  }

  setInfo(text) { if (this.invInfo) this.invInfo.textContent = text || ''; }

  bindSlot(el, act, alt) {
    el._act = act; el._alt = alt;
    let timer = null, longDone = false;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      longDone = false;
      if (e.button === 2) { alt(e); return; }
      if (e.pointerType === 'touch') {
        timer = setTimeout(() => { longDone = true; alt(e); }, 450);
      }
    });
    el.addEventListener('pointerup', (e) => {
      clearTimeout(timer);
      if (e.button === 2 || longDone) return;
      act(e);
    });
    el.addEventListener('pointerleave', () => clearTimeout(timer));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  slotGrid(container, from, to, prefix) {
    const st = this.inv;
    const grid = h('div', { class: 'grid' });
    for (let i = from; i < to; i++) {
      const s = container.slots[i];
      const el = h('div', { class: 'slot nav', 'data-key': prefix + i }, ...this.slotContent(s));
      if (prefix === 'h' && i === st.game.selected) el.classList.add('sel');
      el.addEventListener('pointerenter', () => this.showTooltip(container.slots[i]));
      el.addEventListener('pointerleave', () => this.hideTooltip());
      this.bindSlot(el, (e) => {
        if (e && e.shiftKey && !st.game.creative) this.quickMove(container, i, prefix);
        else this.slotClick(container, i, false);
      }, () => this.slotClick(container, i, true));
      grid.append(el);
    }
    return grid;
  }

  slotClick(container, i, alt) {
    const st = this.inv;
    const slots = container.slots;
    const s = slots[i];
    let cur = st.cursor;
    if (!alt) {
      if (!cur) { if (s) { st.cursor = s; slots[i] = null; } }
      else if (!s) { slots[i] = cur; st.cursor = null; }
      else if (s.id === cur.id && maxStack(s.id) > 1) {
        const n = Math.min(cur.count, maxStack(s.id) - s.count);
        s.count += n; cur.count -= n;
        if (cur.count <= 0) st.cursor = null;
      } else { slots[i] = cur; st.cursor = s; }
    } else {
      if (!cur) {
        if (s) {
          const half = Math.ceil(s.count / 2);
          st.cursor = { ...s, count: half };
          s.count -= half;
          if (s.count <= 0) slots[i] = null;
        }
      } else if (!s) { slots[i] = { ...cur, count: 1 }; cur.count--; }
      else if (s.id === cur.id && s.count < maxStack(s.id)) { s.count++; cur.count--; }
      if (st.cursor && st.cursor.count <= 0) st.cursor = null;
    }
    const shown = slots[i] || st.cursor;
    this.setInfo(shown ? itemDef(shown.id).name : '');
    sfx.click();
    this.renderInventory();
  }

  quickMove(container, i, prefix) {
    const st = this.inv;
    const s = container.slots[i];
    if (!s) return;
    const game = st.game;
    if (prefix === 'c') {
      const left = game.inv.add(s.id, s.count, s.dmg);
      if (left) s.count = left; else container.slots[i] = null;
    } else if (st.mode === 'chest') {
      const chest = game.getChest(st.chestKey);
      const tmp = { slots: chest, size: 27 };
      let left = s.count;
      for (let k = 0; k < 27 && left; k++) {
        const c = chest[k];
        if (c && c.id === s.id && c.count < maxStack(s.id)) { const n = Math.min(left, maxStack(s.id) - c.count); c.count += n; left -= n; }
      }
      for (let k = 0; k < 27 && left; k++) if (!chest[k]) { chest[k] = { id: s.id, count: left, dmg: s.dmg }; left = 0; }
      if (left) s.count = left; else container.slots[i] = null;
      void tmp;
    } else {
      const [a, b] = i < 9 ? [9, 36] : [0, 9];
      for (let k = a; k < b; k++) if (!container.slots[k]) { container.slots[k] = s; container.slots[i] = null; break; }
    }
    this.renderInventory();
  }

  showTooltip(s) {
    if (!s || this.app.input.device === 'touch') return this.hideTooltip();
    this.tooltip.textContent = itemDef(s.id).name;
    this.tooltip.style.display = 'block';
    this.positionTooltip();
  }
  hideTooltip() { this.tooltip.style.display = 'none'; }
  positionTooltip() {
    const [x, y] = this.lastPointer || [0, 0];
    this.tooltip.style.left = x + 14 + 'px';
    this.tooltip.style.top = y - 24 + 'px';
  }

  updateCursor() {
    const st = this.inv;
    if (!st || !st.cursor) { this.cursorEl.classList.remove('show'); return; }
    this.cursorEl.replaceChildren(...this.slotContent(st.cursor));
    this.cursorEl.classList.add('show');
    this.positionCursor();
  }
  positionCursor() {
    if (!this.cursorEl.classList.contains('show')) return;
    let x, y;
    const f = this.focusIdx >= 0 && this.app.input.device === 'pad' ? this.navEls()[this.focusIdx] : null;
    if (f) { const r = f.getBoundingClientRect(); x = r.right - 6; y = r.bottom - 6; }
    else {
      [x, y] = this.lastPointer || [innerWidth / 2, innerHeight / 2];
      if (this.app.input.device === 'touch') y -= 34;
    }
    const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 2;
    this.cursorEl.style.left = x - 8 * u + 'px';
    this.cursorEl.style.top = y - 8 * u + 'px';
  }

  recipeList() {
    const st = this.inv;
    const game = st.game;
    const tabs = [['tout', 'Tout'], ['outils', 'Outils'], ['blocs', 'Blocs'], ['four', 'Four']];
    const tabEls = tabs.map(([k, label]) => {
      const t = h('div', { class: 'tab nav' + (st.tab === k ? ' on' : ''), 'data-key': 'tab' + k }, label);
      t._act = () => { st.tab = k; this.renderInventory(false); };
      t.addEventListener('click', t._act);
      return t;
    });
    const avail = (r) => !r.station || (r.station === 'table' && st.table) || (r.station === 'furnace' && st.furnace);
    let list = RECIPES.filter((r) => {
      if (st.tab === 'tout') return r.station !== 'furnace';
      if (st.tab === 'four') return r.station === 'furnace';
      if (st.tab === 'outils') return r.cat === 'outils';
      return r.cat !== 'outils' && r.station !== 'furnace';
    });
    list = list.map((r) => ({ r, ok: avail(r) && canCraft(game.inv, r) && (r.station !== 'furnace' || game.hasFuel()) }))
      .sort((a, b) => (b.ok - a.ok) || (avail(b.r) - avail(a.r)));
    const box = h('div', { class: 'recipes' });
    list.forEach(({ r, ok }, n) => {
      const ings = r.inputs.map(([ids, cnt]) => {
        const arr = Array.isArray(ids) ? ids : [ids];
        const have = game.inv.count(arr);
        const showId = arr.find((id) => game.inv.count(id) > 0) ?? arr[0];
        return h('div', { class: 'ing' + (have < cnt ? ' miss' : '') },
          h('img', { class: 'icon', src: iconURL(showId) }), h('span', { class: 'count' }, String(cnt)));
      });
      const row = h('div', { class: 'recipe nav' + (ok ? '' : ' off'), 'data-key': 'r' + RECIPES.indexOf(r) },
        h('div', { class: 'out' }, h('img', { class: 'icon', src: iconURL(r.out) }), r.count > 1 ? h('span', { class: 'count' }, String(r.count)) : null),
        h('span', { class: 'arrow' }, '←'),
        ...ings,
        r.station ? h('img', { class: 'station px', src: iconURL(r.station === 'table' ? B.CRAFTING_TABLE : B.FURNACE) }) : null);
      const doCraft = (max) => {
        const name = itemDef(r.out).name;
        this.setInfo(name);
        if (!avail(r)) { this.app.ui.toast(r.station === 'table' ? 'Il faut un établi à proximité' : 'Il faut un four à proximité'); return; }
        let n = 0;
        const times = max ? 64 : 1;
        for (let k = 0; k < times; k++) {
          if (r.station === 'furnace' && !game.useFuel()) { if (!n) this.app.ui.toast('Pas de combustible (charbon, bois...)'); break; }
          if (!craft(game.inv, r)) { if (r.station === 'furnace') game.fuel += 1; break; }
          const left = game.inv.add(r.out, r.count);
          if (left) game.dropItem(r.out, left);
          n++;
        }
        if (n) { sfx.craft(); game.onCraft(r.out); }
        this.renderInventory();
      };
      this.bindSlot(row, (e) => doCraft(e && e.shiftKey), () => doCraft(true));
      row.addEventListener('pointerenter', () => this.setInfo(itemDef(r.out).name));
      box.append(row);
      void n;
    });
    if (!list.length) box.append(h('div', { class: 'muted', style: 'padding:var(--u)' }, 'Aucune recette'));
    const hint = h('div', { class: 'hint' }, this.app.input.device === 'touch'
      ? 'Toucher : 1 · Appui long : max'
      : this.app.input.device === 'pad' ? 'A : fabriquer 1 · X : max' : 'Clic : 1 · Clic droit : max');
    return h('div', {}, h('div', { class: 'tabs' }, tabEls), box, hint);
  }

  creativePalette() {
    const st = this.inv;
    const tabs = [['blocs', 'Blocs'], ['nature', 'Nature'], ['objets', 'Objets']];
    const tabEls = tabs.map(([k, label]) => {
      const t = h('div', { class: 'tab nav' + (st.ctab === k ? ' on' : ''), 'data-key': 'ct' + k }, label);
      t._act = () => { st.ctab = k; this.renderInventory(false); };
      t.addEventListener('click', t._act);
      return t;
    });
    const natural = new Set([B.GRASS, B.DIRT, B.STONE, B.SAND, B.GRAVEL, B.OAK_LOG, B.OAK_LEAVES, B.BIRCH_LOG, B.BIRCH_LEAVES,
      B.SPRUCE_LOG, B.SPRUCE_LEAVES, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.SNOW_GRASS, B.SNOW, B.ICE, B.CACTUS,
      B.TALL_GRASS, B.FLOWER_RED, B.FLOWER_YELLOW, B.DEAD_BUSH, B.CLAY, B.BEDROCK, B.OBSIDIAN]);
    let ids;
    if (st.ctab === 'objets') ids = ITEMS.filter((it) => it && !it.isBlock).map((it) => it.id);
    else ids = BLOCKS.filter((b) => b && b.id && b.id !== B.WATER && (st.ctab === 'nature') === natural.has(b.id)).map((b) => b.id);
    const pal = h('div', { class: 'palette' });
    ids.forEach((id) => {
      const el = h('div', { class: 'slot nav', 'data-key': 'p' + id }, h('img', { class: 'icon', src: iconURL(id) }));
      el.addEventListener('pointerenter', () => this.showTooltip({ id }));
      el.addEventListener('pointerleave', () => this.hideTooltip());
      const give = (all) => {
        const ms = maxStack(id);
        this.setInfo(itemDef(id).name);
        if (this.app.input.device === 'touch' || this.app.input.device === 'pad' || all) {
          // directement dans la case sélectionnée de la barre rapide
          st.game.inv.slots[st.game.selected] = { id, count: ms, dmg: 0 };
        } else {
          st.cursor = { id, count: ms, dmg: 0 };
        }
        sfx.click();
        this.renderInventory();
      };
      this.bindSlot(el, (e) => give(e && e.shiftKey), () => give(true));
      pal.append(el);
    });
    const hint = h('div', { class: 'hint' }, this.app.input.device === 'kb'
      ? 'Clic : prendre · Maj+clic : mettre dans la case sélectionnée'
      : 'Toucher un bloc : il va dans la case sélectionnée de la barre');
    return h('div', {}, h('div', { class: 'tabs' }, tabEls), pal, hint);
  }

  // ---------- Navigation manette ----------
  navEls() {
    return [...this.screenEl.querySelectorAll('.nav')].filter((e) => e.offsetParent !== null && !e.disabled);
  }

  setFocus(i) {
    const els = this.navEls();
    els.forEach((e) => e.classList.remove('focus'));
    this.focusIdx = i;
    const el = els[i];
    if (!el) return;
    el.classList.add('focus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (el.tagName === 'INPUT') el.focus(); else if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    this.positionCursor();
  }

  moveFocus(dir) {
    const els = this.navEls();
    if (!els.length) return;
    if (this.focusIdx < 0 || this.focusIdx >= els.length || !dir) { this.setFocus(0); return; }
    const cur = els[this.focusIdx].getBoundingClientRect();
    const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
    let best = -1, bestScore = Infinity;
    els.forEach((e, i) => {
      if (i === this.focusIdx) return;
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      let main, side;
      if (dir === 'up') { main = -dy; side = Math.abs(dx); }
      else if (dir === 'down') { main = dy; side = Math.abs(dx); }
      else if (dir === 'left') { main = -dx; side = Math.abs(dy); }
      else { main = dx; side = Math.abs(dy); }
      if (main <= 2) return;
      const score = main + side * 2.5;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) this.setFocus(best);
  }

  handlePad(input, dt) {
    const P = input.padPressed;
    if (!P.size && !input.padStick) return;
    const [lx, ly] = input.padStick || [0, 0];
    let dir = null;
    if (P.has(12)) dir = 'up'; else if (P.has(13)) dir = 'down'; else if (P.has(14)) dir = 'left'; else if (P.has(15)) dir = 'right';
    if (!dir && (Math.abs(lx) > 0.5 || Math.abs(ly) > 0.5)) {
      this.navRepeat -= dt;
      if (this.navRepeat <= 0) {
        dir = Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? 'right' : 'left') : (ly > 0 ? 'down' : 'up');
        this.navRepeat = this.navRepeatFast ? 0.12 : 0.3;
        this.navRepeatFast = true;
      }
    } else if (!dir) { this.navRepeat = 0; this.navRepeatFast = false; }
    if (dir) { this.moveFocus(dir); return; }
    const els = this.navEls();
    const el = els[this.focusIdx];
    if (P.has(0)) {
      if (!el) { this.moveFocus(null); return; }
      if (el._act) el._act({}); else el.click();
    } else if (P.has(2) && el && el._alt) {
      el._alt({});
    } else if (P.has(1) || P.has(3) || P.has(9)) {
      if (this.current === 'inventory' || this.current === 'pause') this.close();
      else if (this.current === 'options' || this.current === 'worlds' || this.current === 'create') {
        const back = [...this.screenEl.querySelectorAll('.btn')].find((b) => /Retour|Terminé|Annuler/.test(b.textContent));
        if (back) back.click();
      }
    }
  }
}
