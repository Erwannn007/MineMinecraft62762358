// Point d'entrée : application, boucle principale, menus, monde de démonstration.
import { initModels } from './models.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { World, SEA } from './world.js';
import { storage, loadSettings, saveSettings } from './storage.js';
import { seedFromString } from './noise.js';
import { unlockAudio, setVolume } from './audio.js';

class App {
  constructor() {
    initModels();
    this.settings = loadSettings();
    this.canvas = document.getElementById('view');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);
    this.input.uiOpen = () => this.ui.isOpen();
    this.game = null;
    this.fps = 0;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (ios && !standalone) this.canInstallHint = 'Astuce : Partager → « Sur l\'écran d\'accueil » pour jouer en plein écran';
    this.ui = new UI(this);
    setVolume(this.settings.volume);
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    const unlock = () => unlockAudio();
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.game) this.game.save(); });
    addEventListener('pagehide', () => { if (this.game) this.game.save(); });
    // bouton "retour" Android (et manette) : ouvre le menu au lieu de quitter la page
    history.pushState({ mm: 1 }, '');
    addEventListener('popstate', () => {
      history.pushState({ mm: 1 }, '');
      if (this.game) {
        if (this.ui.current) { if (this.ui.current !== 'death') this.ui.close(); } else this.ui.pauseScreen();
      }
    });
    this.startDemo();
    this.ui.titleScreen();
    this.last = performance.now();
    this.fpsT = 0; this.fpsN = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  zoomLevel() {
    const dpr = window.devicePixelRatio || 1;
    if (this.settings.zoom > 0) return this.settings.zoom;
    const short = Math.min(innerWidth, innerHeight) * dpr;
    return Math.max(1, Math.round(short / (12.5 * 32)));
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.resize(innerWidth, innerHeight, dpr, this.zoomLevel());
    this.input.scale = this.renderer.scale;
    const u = Math.max(1, Math.min(4, Math.floor(Math.min(innerWidth / 190, innerHeight / 250) * 2) / 2));
    document.documentElement.style.setProperty('--u', u + 'px');
    if (this.ui.current === 'inventory' && this.ui.inv) this.ui.renderInventory();
  }

  changeZoom(d) {
    const z = this.zoomLevel() + d;
    this.settings.zoom = Math.max(1, Math.min(8, z));
    this.applySettings();
  }

  applySettings() {
    saveSettings(this.settings);
    setVolume(this.settings.volume);
    this.resize();
    this.ui.updateTouchVisibility();
  }

  // ---------- mondes ----------
  listWorlds() { return storage.listWorlds().catch(() => []); }
  deleteWorld(id) { return storage.deleteWorld(id); }

  async createWorld(name, seedStr, mode) {
    const meta = {
      id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name, seed: seedFromString(seedStr), mode,
      created: Date.now(), lastPlayed: Date.now(),
    };
    await storage.putWorld(meta);
    this.startWorld(meta);
  }

  async startWorld(meta) {
    const progress = this.ui.loadingScreen('Génération du terrain...');
    this.demo = null;
    const game = new Game(this, meta);
    await game.load(progress);
    meta.lastPlayed = Date.now();
    this.game = game;
    this.ui.close();
    this.ui.setHUDVisible(true);
    this.ui.hudKey = '';
    if (!meta.welcomed) {
      meta.welcomed = true;
      const dev = this.input.device;
      this.ui.toast(dev === 'touch' ? 'Appui long : casser · Toucher : poser / utiliser'
        : dev === 'pad' ? 'RT : casser · LT : poser · Y : inventaire' : 'Clic gauche : casser · Clic droit : poser · E : inventaire', 5000);
    }
    game.save();
  }

  async quitToTitle() {
    const g = this.game;
    this.ui.close();
    this.ui.loadingScreen('Sauvegarde du monde...');
    if (g) await g.save();
    this.game = null;
    this.ui.setHUDVisible(false);
    this.startDemo();
    this.ui.titleScreen();
  }

  startDemo() {
    const world = new World({ id: 'demo', seed: 20251029 }, false);
    this.renderer.setWorld(world);
    this.renderer.cutZ = null;
    const spawn = world.gen.findSpawn();
    this.demo = { world, x: spawn[0], y: spawn[1], t: 0 };
  }

  // ---------- boucle ----------
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsT); this.fpsT = 0; this.fpsN = 0; }
    this.input.update(dt);
    if (this.game) {
      this.game.update(dt);
      if (this.game) this.game.render(dt);
    } else {
      this.input.takeEvents();
      if (this.ui.current) this.ui.handlePad(this.input, dt);
      if (this.demo) {
        const d = this.demo;
        d.t += dt;
        d.x += dt * 1.6; d.y -= dt * 0.6;
        d.world.focus = [Math.floor(d.x / 16), Math.floor(d.y / 16)];
        d.world.update(6);
        d.world.unloadFar(d.world.focus[0], d.world.focus[1], 8);
        this.renderer.focusCx = d.world.focus[0]; this.renderer.focusCy = d.world.focus[1];
        this.renderer.trim(80);
        this.renderer.render({ x: d.x, y: d.y, z: SEA + 6, entities: [], time: t / 1000, clouds: this.settings.clouds ? 0.1 : 0, dark: 0, buildBudget: 6 });
      }
    }
  }
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.fonts.load('9px Monocraft').finally(() => { window.app = new App(); });
