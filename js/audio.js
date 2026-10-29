// Sons synthétisés avec WebAudio (aucun fichier audio).

let ctx = null, master = null, noiseBuf = null;
let volume = 0.7;

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function noise(dur, freq, q, gain, type = 'bandpass', when = 0) {
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(freq, dur, gain, type = 'sine', slide = 1, when = 0) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

const MAT = {
  stone: [1800, 1.2, 0.12], grass: [900, 0.7, 0.1], gravel: [700, 0.9, 0.12], sand: [2600, 0.6, 0.1],
  wood: [420, 2.5, 0.14], glass: [3200, 3, 0.1], snow: [1400, 0.5, 0.12], wool: [500, 0.5, 0.08],
};

export const sfx = {
  dig(mat = 'stone') {
    if (!ctx || !volume) return;
    const [f, q, d] = MAT[mat] || MAT.stone;
    noise(d, f * (0.85 + Math.random() * 0.3), q, 0.5);
    if (mat === 'wood') tone(160 + Math.random() * 40, 0.08, 0.25, 'triangle', 0.7);
  },
  breakBlock(mat = 'stone') {
    if (!ctx || !volume) return;
    const [f, q, d] = MAT[mat] || MAT.stone;
    noise(d * 2, f * 0.8, q, 0.7);
    noise(d * 1.5, f * 1.3, q, 0.4, 'bandpass', 0.03);
    if (mat === 'glass') { tone(2400, 0.2, 0.08, 'sine', 1.5); tone(3100, 0.25, 0.06, 'sine', 1.3, 0.04); }
  },
  place(mat = 'stone') {
    if (!ctx || !volume) return;
    const [f, q, d] = MAT[mat] || MAT.stone;
    noise(d * 1.2, f * 0.7, q, 0.6);
  },
  step(mat = 'grass') {
    if (!ctx || !volume) return;
    const [f, q] = MAT[mat] || MAT.grass;
    noise(0.07, f * 0.8, q, 0.12);
  },
  pop() { if (ctx && volume) tone(500 + Math.random() * 300, 0.09, 0.15, 'sine', 2.2); },
  click() { if (ctx && volume) { tone(1200, 0.04, 0.12, 'square', 0.5); } },
  hurt() { if (ctx && volume) { tone(220, 0.18, 0.3, 'square', 0.5); noise(0.1, 600, 1, 0.2); } },
  hit() { if (ctx && volume) { noise(0.08, 900, 1, 0.35); tone(140, 0.08, 0.2, 'triangle', 0.6); } },
  eat() {
    if (!ctx || !volume) return;
    for (let i = 0; i < 3; i++) noise(0.06, 1500, 2, 0.25, 'bandpass', i * 0.12);
  },
  splash() { if (ctx && volume) noise(0.35, 1100, 0.6, 0.35, 'lowpass'); },
  zombie() {
    if (!ctx || !volume) return;
    tone(95 + Math.random() * 30, 0.6, 0.12, 'sawtooth', 0.7);
    tone(120 + Math.random() * 20, 0.5, 0.06, 'sawtooth', 0.8, 0.1);
  },
  pig() { if (ctx && volume) { tone(300, 0.15, 0.1, 'sawtooth', 0.6); tone(260, 0.12, 0.08, 'sawtooth', 0.7, 0.16); } },
  sheep() { if (ctx && volume) { for (let i = 0; i < 4; i++) tone(420 + (i % 2) * 30, 0.08, 0.06, 'sawtooth', 1, i * 0.07); } },
  craft() { if (ctx && volume) { noise(0.12, 600, 1.5, 0.3); tone(700, 0.1, 0.1, 'triangle', 1.4, 0.05); } },
  levelUp() { if (ctx && volume) { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 0.12, 'triangle', 1, i * 0.09)); } },
};
