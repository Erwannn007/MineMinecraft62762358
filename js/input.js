// Entrées unifiées : clavier/souris (PC), tactile (mobile), manette (Ayn Thor, Xbox, PS...).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.scale = 1;
    this.keys = new Set();
    this.events = [];
    this.device = matchMedia('(pointer: coarse)').matches ? 'touch' : 'kb';
    // état de jeu
    this.move = [0, 0];
    this.jump = false; this.sneak = false; this.sprint = false;
    this.primary = false; this.primaryPos = null;
    this.secondary = null; // position d'un clic droit / tap ponctuel
    this.secondaryHeld = false;
    this.pointer = null;   // dernière position souris
    // tactile
    this.joy = null; this.worldTouch = null;
    this.btnJump = false; this.btnSneak = false;
    // manette
    this.padPrev = [];
    this.padHeld = [];
    this.padPressed = new Set();
    this.padMove = [0, 0];
    this.padCursor = [0, 0];
    this.padCursorActive = false;
    this.padCursorIdle = 0;
    this.sprintToggle = false;
    this.uiOpen = () => false;
    this.bind();
  }

  toInternal(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    return [(cx - r.left) / this.scale, (cy - r.top) / this.scale];
  }

  emit(type, data) { this.events.push({ type, data }); }
  takeEvents() { const e = this.events; this.events = []; return e; }

  bind() {
    const c = this.canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.device = 'kb';
      if (!e.repeat) {
        const code = e.code;
        if (code === 'KeyE' || code === 'KeyI') this.emit('inventory');
        else if (code === 'Escape') this.emit('pause');
        else if (code === 'KeyQ' && !this.uiOpen()) this.emit('drop', e.ctrlKey);
        else if (code === 'KeyF') this.emit('fly');
        else if (code === 'F3' || code === 'KeyP') this.emit('debug');
        else if (code.startsWith('Digit')) {
          const n = Number(code.slice(5));
          if (n >= 1 && n <= 9) this.emit('hotbar', n - 1);
        }
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.primary = false; });

    c.addEventListener('mousedown', (e) => {
      this.device = 'kb';
      const p = this.toInternal(e.clientX, e.clientY);
      this.pointer = p;
      if (e.button === 0) { this.primary = true; this.primaryPos = p; }
      else if (e.button === 2) { this.secondary = p; this.secondaryHeld = true; this.secondaryTimer = 0.3; }
      else if (e.button === 1) { this.emit('pick', p); e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.primary = false;
      if (e.button === 2) this.secondaryHeld = false;
    });
    c.addEventListener('mousemove', (e) => {
      const p = this.toInternal(e.clientX, e.clientY);
      this.pointer = p;
      if (this.primary) this.primaryPos = p;
      if (this.secondaryHeld) this.secondaryPos = p;
      if (this.device !== 'kb' && (Math.abs(e.movementX) + Math.abs(e.movementY)) > 2) this.device = 'kb';
    });
    c.addEventListener('mouseleave', () => { this.pointer = null; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) this.emit('zoom', e.deltaY > 0 ? -1 : 1);
      else this.emit('hotbarDelta', e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // --- tactile ---
    const opt = { passive: false };
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.device = 'touch';
      const r = c.getBoundingClientRect();
      for (const t of e.changedTouches) {
        const inJoyZone = t.clientX - r.left < r.width * 0.45 && t.clientY - r.top > r.height * 0.42;
        if (!this.joy && inJoyZone) {
          this.joy = { id: t.identifier, bx: t.clientX, by: t.clientY, x: t.clientX, y: t.clientY };
          this.emit('joy', this.joy);
        } else if (!this.worldTouch) {
          const p = this.toInternal(t.clientX, t.clientY);
          this.worldTouch = { id: t.identifier, sx: t.clientX, sy: t.clientY, t0: performance.now(), pos: p, holding: false };
        }
      }
    }, opt);
    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          this.joy.x = t.clientX; this.joy.y = t.clientY;
          this.emit('joy', this.joy);
        } else if (this.worldTouch && t.identifier === this.worldTouch.id) {
          const w = this.worldTouch;
          w.pos = this.toInternal(t.clientX, t.clientY);
          if (!w.holding && Math.hypot(t.clientX - w.sx, t.clientY - w.sy) > 14) w.holding = true;
          if (w.holding) { this.primary = true; this.primaryPos = w.pos; }
        }
      }
    }, opt);
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.emit('joy', null); }
        else if (this.worldTouch && t.identifier === this.worldTouch.id) {
          const w = this.worldTouch;
          if (!w.holding) this.secondary = w.pos;
          this.primary = false;
          this.worldTouch = null;
        }
      }
    };
    c.addEventListener('touchend', end, opt);
    c.addEventListener('touchcancel', end, opt);

    window.addEventListener('gamepadconnected', () => { this.device = 'pad'; this.emit('padconnected'); });
  }

  // Appelé à chaque image.
  update(dt) {
    // appui long tactile -> minage
    const w = this.worldTouch;
    if (w && !w.holding && performance.now() - w.t0 > 260) w.holding = true;
    if (w && w.holding) { this.primary = true; this.primaryPos = w.pos; }

    this.pollPad(dt);

    let mx = 0, my = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (this.joy) {
      const R = 46;
      let dx = this.joy.x - this.joy.bx, dy = this.joy.y - this.joy.by;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      mx += dx / R; my += dy / R;
    }
    mx += this.padMove[0]; my += this.padMove[1];
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move = [mx, my];
    const padA = this.padHeld[0];
    this.jump = k.has('Space') || this.btnJump || (!!padA && !this.uiOpen());
    this.sneak = k.has('ShiftLeft') || k.has('ShiftRight') || this.btnSneak || (!!this.padHeld[1] && !this.uiOpen());
    this.sprint = k.has('ControlLeft') || (this.joy && len > 0.98 && Math.hypot(this.joy.x - this.joy.bx, this.joy.y - this.joy.by) > 52) || (this.sprintToggle && len > 0.5);
    if (len < 0.2) this.sprintToggle = false;
    if (this.secondaryHeld) {
      this.secondaryTimer -= dt;
      if (this.secondaryTimer <= 0) { this.secondary = this.secondaryPos || this.pointer; this.secondaryTimer = 0.22; }
    }
  }

  pollPad(dt) {
    this.padPressed.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) { this.padMove = [0, 0]; this.padHeld = []; return; }
    const held = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    for (let i = 0; i < held.length; i++) if (held[i] && !this.padPrev[i]) { this.padPressed.add(i); this.device = 'pad'; }
    this.padPrev = held;
    this.padHeld = held;
    const dz = (v) => (Math.abs(v) < 0.22 ? 0 : (v - Math.sign(v) * 0.22) / 0.78);
    const lx = dz(pad.axes[0] || 0), ly = dz(pad.axes[1] || 0);
    const rx = dz(pad.axes[2] || 0), ry = dz(pad.axes[3] || 0);
    if (lx || ly || rx || ry) this.device = 'pad';
    this.padMove = this.uiOpen() ? [0, 0] : [lx, ly];
    this.padStick = [lx, ly];
    if (!this.uiOpen()) {
      if (rx || ry) {
        this.padCursorActive = true;
        this.padCursorIdle = 0;
        this.padCursor[0] += rx * dt * 170;
        this.padCursor[1] += ry * dt * 170;
        const d = Math.hypot(this.padCursor[0], this.padCursor[1]);
        if (d > 110) { this.padCursor[0] *= 110 / d; this.padCursor[1] *= 110 / d; }
      } else if (this.padCursorActive) {
        this.padCursorIdle += dt;
        if (this.padCursorIdle > 4 && Math.hypot(lx, ly) > 0.3) this.padCursorActive = false;
      }
      const P = this.padPressed;
      if (P.has(3) || P.has(8)) this.emit('inventory');
      if (P.has(9)) this.emit('pause');
      if (P.has(4)) this.emit('hotbarDelta', -1);
      if (P.has(5)) this.emit('hotbarDelta', 1);
      if (P.has(14)) this.emit('hotbarDelta', -1);
      if (P.has(15)) this.emit('hotbarDelta', 1);
      if (P.has(12)) this.emit('fly');
      if (P.has(13) || P.has(2)) this.emit('drop', false);
      if (P.has(10)) this.sprintToggle = !this.sprintToggle;
      if (P.has(11)) { this.padCursorActive = false; this.padCursor = [0, 0]; }
      this.padPrimary = !!held[7];
      if (P.has(6)) { this.padSecondary = true; this.padSecTimer = 0.3; }
      else if (held[6]) {
        this.padSecTimer -= dt;
        if (this.padSecTimer <= 0) { this.padSecondary = true; this.padSecTimer = 0.25; }
      }
    } else {
      this.padPrimary = false;
    }
  }
}
