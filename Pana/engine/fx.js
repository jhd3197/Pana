// Sounds, smoke puffs, flying debris and speech bubbles.

import * as THREE from 'three';

// ---------- sound (WebAudio, no files) ----------
export const sound = {
  ctx: null,
  muted: false,
  volume: 1,
  musicVolume: 0.5,
  engine: null,
  master: null,
  musicBus: null,
  maxVoices: 12,
  voices: [],
  dropped: 0,

  unlock() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  // every sound goes through one gain node, so volume applies to all of them
  out() {
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    return this.master;
  },

  // music rides its own gain under the master, so its slider leaves effects alone
  musicOut() {
    if (!this.musicBus) {
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.out());
    }
    return this.musicBus;
  },

  setMusicVolume(v) {
    this.musicVolume = Math.min(1, Math.max(0, v));
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.02);
  },

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  },

  // One-shots share a voice budget: past maxVoices sounding at once, a new one
  // gets in only by outranking the lowest-priority live voice, which fades out
  // early. Keeps a pileup of ticks and bonks from smearing into mud; music and
  // the engine hum ride their own nodes and never count here.
  liveVoices() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    this.voices = this.voices.filter(v => v.until > now);
    return this.voices.reduce((n, v) => n + (v.start <= now ? 1 : 0), 0);
  },

  // Returns a slot for the caller to fill with its gain nodes, null if refused.
  admit(priority, start, until) {
    if (this.liveVoices() >= this.maxVoices) {
      let low = -1;
      for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        if (v.start <= this.ctx.currentTime && (low < 0 || v.priority < this.voices[low].priority)) low = i;
      }
      if (low < 0 || priority <= this.voices[low].priority) { this.dropped++; return null; }
      const old = this.voices.splice(low, 1)[0];
      const now = this.ctx.currentTime;
      for (const g of old.gs) {
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0, now, 0.015);
      }
      this.dropped++;
    }
    const v = { priority, start, until, gs: [] };
    this.voices.push(v);
    return v;
  },

  tone(freq, start, dur, type = 'square', vol = 0.12, priority = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + start;
    const v = this.admit(priority, t, t + dur);
    if (!v) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    v.gs.push(g);
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.out());
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  horn(kind, priority = 1) {
    if (kind === 'cucaracha') {
      // la cu-ca-ra-cha, la cu-ca-ra-cha
      const notes = [[392, 0.11], [392, 0.11], [392, 0.11], [523, 0.28], [659, 0.3],
        [392, 0.11], [392, 0.11], [392, 0.11], [523, 0.28], [659, 0.4]];
      let t = 0;
      for (const [f, d] of notes) {
        this.tone(f, t, d * 0.92, 'square', 0.08, priority);
        this.tone(f * 1.26, t, d * 0.92, 'square', 0.04, priority);
        t += d;
      }
      return 1.9;
    }
    if (kind === 'grave') {
      // big truck horn: two long low blasts
      for (const t of [0, 0.42]) {
        this.tone(175, t, 0.34, 'sawtooth', 0.09, priority);
        this.tone(220, t, 0.34, 'square', 0.05, priority);
      }
      return 0.8;
    }
    if (kind === 'fiesta') {
      // party jingle: up the arpeggio and a happy hold
      const notes = [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.12], [784, 0.1], [1047, 0.32]];
      let t = 0;
      for (const [f, d] of notes) {
        this.tone(f, t, d * 0.9, 'square', 0.07, priority);
        this.tone(f / 2, t, d * 0.9, 'triangle', 0.06, priority);
        t += d;
      }
      return 0.9;
    }
    this.tone(640, 0, 0.13, 'square', 0.1, priority);
    this.tone(860, 0, 0.13, 'square', 0.06, priority);
    this.tone(640, 0.18, 0.16, 'square', 0.1, priority);
    this.tone(860, 0.18, 0.16, 'square', 0.06, priority);
    return 0.4;
  },

  bonk(power = 1, priority = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = 0.25;
    const v = this.admit(priority, t, t + 0.32);
    if (!v) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = Math.min(0.5, 0.15 * power);
    src.connect(f).connect(g).connect(this.out());
    v.gs.push(g);
    src.start(t);
    // cartoon "boing" thump
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    v.gs.push(og);
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    og.gain.setValueAtTime(Math.min(0.4, 0.12 * power), t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(this.out());
    o.start(t);
    o.stop(t + 0.32);
  },

  boing(priority = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const v = this.admit(priority, t, t + 0.32);
    if (!v) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    v.gs.push(g);
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.out());
    o.start(t);
    o.stop(t + 0.32);
  },

  // a pitch glide: slide whistles, whooshes, turbos
  sweep(f0, f1, dur, type = 'sine', vol = 0.1, priority = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const v = this.admit(priority, t, t + dur);
    if (!v) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    v.gs.push(g);
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out());
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  pickup(streak = 0) {
    const mult = Math.pow(1.06, Math.min(12, Math.max(0, streak)));
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f * mult, i * 0.055, 0.08, 'square', 0.07));
  },
  clickDown() {
    this.sweep(260, 135, 0.045, 'triangle', 0.07);
  },
  clickUp() {
    this.sweep(540, 880, 0.055, 'sine', 0.06);
  },
  tick(step = 0) {
    const base = 780 + Math.min(16, step) * 45 + Math.random() * 120;
    this.tone(base, 0, 0.032, 'square', 0.045);
  },
  whoosh() { this.sweep(720, 150, 0.28, 'triangle', 0.14); },
  skid(power = 1, priority = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, len = 0.18;
    const v = this.admit(priority, t, t + len);
    if (!v) return;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.18) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1450; f.Q.value = 3.5;
    const g = this.ctx.createGain(); g.gain.value = Math.min(0.18, 0.08 * power);
    v.gs.push(g);
    src.connect(f).connect(g).connect(this.out());
    src.start(t);
  },
  turbo() {
    this.sweep(160, 900, 0.45, 'sawtooth', 0.07);
    this.sweep(240, 1350, 0.45, 'square', 0.03);
  },
  plop() { this.sweep(500, 120, 0.15, 'sine', 0.18); },
  slip() { this.sweep(1400, 260, 0.7, 'sine', 0.12); },
  splat() {
    this.bonk(0.8);
    this.sweep(420, 70, 0.22, 'square', 0.06);
  },
  explode(power = 1, priority = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const v = this.admit(priority, t, t + 0.7);
    if (!v) return;
    // Step 1: sharp high-frequency transient CRACK!
    this.sweep(1800, 220, 0.07, 'sawtooth', Math.min(0.28, 0.16 * power), priority);
    // Step 2: deep sub-bass BOOM!
    const o = this.ctx.createOscillator(), og = this.ctx.createGain();
    v.gs.push(og);
    o.type = 'sine';
    o.frequency.setValueAtTime(155, t + 0.015);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.62);
    og.gain.setValueAtTime(Math.min(0.55, 0.28 * power), t + 0.015);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
    o.connect(og).connect(this.out());
    o.start(t + 0.015); o.stop(t + 0.7);
    // Step 3: rolling low-pass blast rumble
    const len = 0.65;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(620, t); f.frequency.exponentialRampToValueAtTime(110, t + len);
    const g = this.ctx.createGain(); g.gain.value = Math.min(0.45, 0.22 * power);
    v.gs.push(g);
    src.connect(f).connect(g).connect(this.out());
    src.start(t);
  },
  thunder(power = 1, priority = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, len = 1.25;
    const v = this.admit(priority, t, t + len);
    if (!v) return;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const u = i / d.length;
      const env = (u < 0.08 ? u / 0.08 : Math.pow(1 - u, 1.6)) * (0.7 + 0.3 * Math.sin(u * 28));
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const g = this.ctx.createGain(); g.gain.value = Math.min(0.38, 0.2 * power);
    v.gs.push(g);
    src.connect(f).connect(g).connect(this.out());
    src.start(t);
    this.sweep(110, 32, 0.85, 'triangle', Math.min(0.22, 0.12 * power), priority);
  },
  chestOpen(rarity = 'gold', priority = 1) {
    if (!this.ctx || this.muted) return;
    // Creak + thump + ascending rarity jingle
    this.sweep(190, 340, 0.11, 'sawtooth', 0.05, priority);
    this.bonk(0.65, priority);
    const scales = {
      blue: [523, 659, 784],
      purple: [523, 659, 784, 1047],
      gold: [523, 659, 784, 1047, 1319, 1568],
    };
    const notes = scales[rarity] || scales.gold;
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      this.tone(f, 0.1 + i * 0.065, last ? 0.26 : 0.09, 'triangle', 0.09, priority);
      this.tone(f * 1.5, 0.1 + i * 0.065, last ? 0.22 : 0.07, 'sine', 0.04, priority);
    });
  },

  startEngine() {
    if (!this.ctx || this.engine) return;
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    f.type = 'lowpass';
    f.frequency.value = 420;
    lfo.frequency.value = 9;      // putt-putt
    lfoGain.gain.value = 0.025;
    g.gain.value = 0.035;
    lfo.connect(lfoGain).connect(g.gain);
    o.connect(f).connect(g).connect(this.out());
    o.start();
    lfo.start();
    this.engine = { o, lfo, g };
  },

  setEngine(speed) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.o.frequency.setTargetAtTime(42 + Math.abs(speed) * 3.2, t, 0.08);
    this.engine.lfo.frequency.setTargetAtTime(8 + Math.abs(speed) * 0.5, t, 0.1);
    this.engine.g.gain.setTargetAtTime(this.muted ? 0 : 0.035, t, 0.05);
  },

  stopEngine() {
    if (!this.engine) return;
    this.engine.o.stop();
    this.engine.lfo.stop();
    this.engine = null;
  },
};

export { dizzyStars } from '/engine/models/effects/dizzy-stars.js';

// ---------- puffs (smoke, dust) ----------
// Every puff of one Puffs is an instance of a single mesh: one draw call and no
// allocation per puff, however much smoke the cars kick up. Each instance has
// its own colour (instanceColor) and fade (the instanceOpacity attribute).
const puffGeo = new THREE.IcosahedronGeometry(0.35, 0);
const puffMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, transparent: true, depthWrite: false });
puffMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vInstanceOpacity );');
};
puffMaterial.customProgramCacheKey = () => 'pana-puffs';
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class Puffs {
  constructor(scene) {
    this.scene = scene;
    this.count = 0;
    this.grow(64);
  }

  // Room for `capacity` live puffs; the live ones are copied over.
  grow(capacity) {
    const old = this.mesh;
    const mesh = new THREE.InstancedMesh(puffGeo, puffMaterial, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    mesh.geometry = puffGeo.clone();   // the opacity attribute is per mesh; the shape is shared data
    mesh.geometry.setAttribute('instanceOpacity', opacity);
    mesh.frustumCulled = false;   // instances spread over the map; the bounding sphere is the template's
    mesh.count = this.count;
    // Per puff: position (3), velocity (3), rotation (2), age, life, size.
    const data = new Float32Array(capacity * 11);
    if (old) {
      data.set(this.data.subarray(0, this.count * 11));
      mesh.instanceColor.array.set(old.instanceColor.array.subarray(0, this.count * 3));
      this.scene.remove(old); old.geometry.dispose(); old.dispose();
    }
    this.mesh = mesh; this.data = data; this.opacity = opacity; this.capacity = capacity;
    this.scene.add(mesh);
  }

  spawn(pos, { color = 0x8a8a92, count = 6, spread = 0.8, size = 1, rise = 1.5, life = 1.1 } = {}) {
    _c.set(color);
    for (let i = 0; i < count; i++) {
      if (this.count === this.capacity) this.grow(this.capacity * 2);
      const n = this.count++, d = this.data, o = n * 11;
      d[o] = pos.x + (Math.random() - 0.5) * spread; d[o + 1] = pos.y + Math.random() * 0.3; d[o + 2] = pos.z + (Math.random() - 0.5) * spread;
      d[o + 3] = (Math.random() - 0.5) * 2; d[o + 4] = rise * (0.6 + Math.random()); d[o + 5] = (Math.random() - 0.5) * 2;
      d[o + 6] = Math.random() * 6; d[o + 7] = Math.random() * 6;
      d[o + 8] = 0; d[o + 9] = life * (0.7 + Math.random() * 0.6); d[o + 10] = size * (0.6 + Math.random() * 0.6);
      this.mesh.setColorAt(n, _c);
    }
    if (this.scene !== this.mesh.parent) this.scene.add(this.mesh);   // a clear()ed scene may have dropped it
    this.mesh.instanceColor.needsUpdate = true;
    this.write();
  }

  update(dt) {
    const d = this.data;
    for (let n = 0; n < this.count;) {
      const o = n * 11;
      d[o + 8] += dt;
      if (d[o + 8] >= d[o + 9]) { this.remove(n); continue; }   // the last puff moved into n: look at it next
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      n++;
    }
    this.write();
  }

  remove(n) {
    const last = --this.count;
    if (n === last) return;
    this.data.copyWithin(n * 11, last * 11, last * 11 + 11);
    const c = this.mesh.instanceColor.array; c.copyWithin(n * 3, last * 3, last * 3 + 3);
    this.mesh.instanceColor.needsUpdate = true;
  }

  // Instance matrices and fades from the puffs' state.
  write() {
    const d = this.data, mesh = this.mesh, fade = this.opacity.array;
    for (let n = 0; n < this.count; n++) {
      const o = n * 11, k = d[o + 8] / d[o + 9];
      _p.set(d[o], d[o + 1], d[o + 2]);
      _q.setFromEuler(_e.set(d[o + 6], d[o + 7], 0));
      _s.setScalar(d[o + 10] * (1 + k * 1.6));
      mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      fade[n] = 0.9 * (1 - k);
    }
    mesh.count = this.count;
    mesh.instanceMatrix.needsUpdate = true;
    this.opacity.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.mesh.count = 0;
  }
}

// ---------- shockwaves, fireballs, scorch marks & ground ripples ----------
const ringGeo = new THREE.RingGeometry(0.72, 1.0, 36);
ringGeo.rotateX(-Math.PI / 2);
const scorchGeo = new THREE.CircleGeometry(1.0, 24);
scorchGeo.rotateX(-Math.PI / 2);
const fireballGeo = new THREE.IcosahedronGeometry(1.0, 1);
const sparkGeo = new THREE.OctahedronGeometry(0.22, 0);

export class Shockwaves {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  ring(pos, { color = 0xffffff, startRadius = 0.35, maxRadius = 4.2, life = 0.42, yOffset = 0.06, opacity = 0.85 } = {}) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.position.set(pos.x, pos.y + yOffset, pos.z);
    m.scale.setScalar(startRadius);
    m.raycast = () => {};
    this.scene.add(m);
    this.items.push({ kind: 'ring', m, t: 0, life, startRadius, maxRadius, opacity });
  }

  sparkle(pos, { color = 0xffd23f, count = 6, spread = 0.6, life = 0.38 } = {}) {
    // Quick central flash ring + bursting star octahedra
    this.ring(pos, { color, startRadius: 0.2, maxRadius: 1.45, life: 0.24, yOffset: 0.25, opacity: 0.9 });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      m.position.set(pos.x, pos.y + 0.35, pos.z);
      m.raycast = () => {};
      this.scene.add(m);
      const speed = 2.2 + Math.random() * 2.4;
      this.items.push({
        kind: 'spark', m, t: 0, life: life * (0.8 + Math.random() * 0.4),
        v: new THREE.Vector3(Math.cos(a) * speed * spread, 1.8 + Math.random() * 2.2, Math.sin(a) * speed * spread),
      });
    }
  }

  afterimage(pos, heading = 0, { color = 0x5ce1e6, radius = 0.55, height = 1.1, life = 0.22 } = {}) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.45, depthWrite: false,
    }));
    m.position.set(pos.x, pos.y + height * 0.55, pos.z);
    m.rotation.y = heading;
    m.scale.set(radius * 1.4, height * 1.3, radius * 2.1);
    m.raycast = () => {};
    this.scene.add(m);
    this.items.push({ kind: 'ghost', m, t: 0, life, s: m.scale.clone() });
  }

  explode(pos, { radius = 5.2, scorch = true } = {}) {
    // 1. Impact frame flash (pure white/yellow sphere that flashes hard for ~60ms)
    const flash = new THREE.Mesh(fireballGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 1, depthWrite: false,
    }));
    flash.position.set(pos.x, pos.y + 0.9, pos.z);
    flash.scale.setScalar(radius * 0.55);
    flash.raycast = () => {};
    this.scene.add(flash);
    this.items.push({ kind: 'flash', m: flash, t: 0, life: 0.08, maxRadius: radius * 0.75 });

    // 2. Fireball that grows fast and fades slow
    const fire = new THREE.Mesh(fireballGeo, new THREE.MeshBasicMaterial({
      color: 0xff9e2c, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    fire.position.set(pos.x, pos.y + 0.85, pos.z);
    fire.scale.setScalar(0.3);
    fire.raycast = () => {};
    this.scene.add(fire);
    this.items.push({ kind: 'fireball', m: fire, t: 0, life: 0.52, maxRadius: radius * 0.52 });

    // 3. Expanding ground shockwave rings (outer white + inner orange)
    this.ring(pos, { color: 0xfff3d1, startRadius: 0.4, maxRadius: radius * 1.15, life: 0.46, yOffset: 0.08, opacity: 0.92 });
    this.ring(pos, { color: 0xff6b2b, startRadius: 0.25, maxRadius: radius * 0.8, life: 0.58, yOffset: 0.06, opacity: 0.78 });

    // 4. Scorch mark on the floor
    if (scorch) {
      const decal = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({
        color: 0x181412, transparent: true, opacity: 0.62, depthWrite: false,
      }));
      decal.position.set(pos.x, pos.y + 0.03, pos.z);
      decal.scale.setScalar(radius * 0.42);
      decal.raycast = () => {};
      this.scene.add(decal);
      this.items.push({ kind: 'scorch', m: decal, t: 0, life: 4.5, opacity: 0.62 });
    }
  }

  update(dt) {
    this.items = this.items.filter((it) => {
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        this.scene.remove(it.m);
        it.m.material.dispose();
        return false;
      }
      if (it.kind === 'ring') {
        const easeOut = 1 - Math.pow(1 - k, 2.4);
        it.m.scale.setScalar(it.startRadius + (it.maxRadius - it.startRadius) * easeOut);
        it.m.material.opacity = it.opacity * (1 - k);
      } else if (it.kind === 'flash') {
        it.m.scale.setScalar(it.maxRadius * (0.7 + k * 0.5));
        it.m.material.color.setHex(k < 0.45 ? 0xffffff : 0x16161a);
        it.m.material.opacity = 1 - k * 0.5;
      } else if (it.kind === 'fireball') {
        // Fast grow (first 22%), slow fade and rise
        const grow = k < 0.22 ? (k / 0.22) : 1 + (k - 0.22) * 0.35;
        it.m.scale.setScalar(it.maxRadius * grow);
        it.m.position.y += dt * 1.4;
        it.m.rotation.y += dt * 3.5;
        if (k < 0.35) it.m.material.color.setHex(0xffb833);
        else if (k < 0.68) it.m.material.color.setHex(0xff5a1f);
        else it.m.material.color.setHex(0x3a3532);
        it.m.material.opacity = k < 0.25 ? 0.95 : 0.95 * (1 - (k - 0.25) / 0.75);
      } else if (it.kind === 'scorch') {
        it.m.material.opacity = k < 0.7 ? it.opacity : it.opacity * (1 - (k - 0.7) / 0.3);
      } else if (it.kind === 'spark') {
        it.v.y -= 9.5 * dt;
        it.m.position.addScaledVector(it.v, dt);
        it.m.rotation.x += dt * 9;
        it.m.rotation.y += dt * 11;
        it.m.scale.setScalar(k < 0.25 ? 1 + k * 2 : Math.max(0.01, 1.5 * (1 - k)));
        it.m.material.opacity = 1 - k;
      } else if (it.kind === 'ghost') {
        it.m.scale.copy(it.s).multiplyScalar(1 - k * 0.25);
        it.m.material.opacity = 0.42 * (1 - k);
      }
      return true;
    });
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.m);
      it.m.material.dispose();
    }
    this.items = [];
  }
}

// ---------- 3D hold-to-charge radial floor ring ----------
export function createChargeRing({ radius = 1.35, color = 0xffc629 } = {}) {
  const geo = new THREE.RingGeometry(radius * 0.78, radius, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { progress: { value: 0 }, color: { value: new THREE.Color(color) }, pulse: { value: 0 } },
    vertexShader: `varying vec2 vPos;
      void main() { vPos = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float progress; uniform vec3 color; uniform float pulse; varying vec2 vPos;
      void main() {
        float angle = fract((atan(vPos.x, vPos.y) + 3.14159265) / 6.2831853);
        float fill = step(angle, progress);
        vec3 col = mix(vec3(1.0, 1.0, 1.0) * 0.25, mix(color, vec3(1.0, 0.96, 0.75), pulse), fill);
        float alpha = mix(0.22, 0.92, fill);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.raycast = () => {};
  return {
    mesh,
    set(x, y, z, progress = 0) {
      mesh.visible = progress > 0.005;
      if (!mesh.visible) return;
      mesh.position.set(x, y + 0.06, z);
      mat.uniforms.progress.value = Math.min(1, Math.max(0, progress));
      mat.uniforms.pulse.value = progress > 0.85 ? 0.5 + 0.5 * Math.sin(performance.now() * 0.025) : 0;
      const s = 1 + Math.sin(progress * Math.PI) * 0.08;
      mesh.scale.setScalar(s);
    },
    hide() { mesh.visible = false; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// ---------- screen-edge speed lines & HUD counter pop / flying pickups ----------
let speedLinesEl = null;
let speedLinesTimer = 0;

export function setSpeedLines(intensity = 0) {
  if (typeof document === 'undefined') return;
  if (!speedLinesEl && intensity > 0.01) {
    speedLinesEl = document.createElement('div');
    speedLinesEl.className = 'pk-speed-lines';
    speedLinesEl.setAttribute('aria-hidden', 'true');
    document.body.append(speedLinesEl);
  }
  if (!speedLinesEl) return;
  const clamped = Math.min(1, Math.max(0, intensity));
  speedLinesEl.style.opacity = clamped > 0.02 ? String(clamped.toFixed(2)) : '0';
}

export function pulseSpeedLines(durationMs = 340, intensity = 0.85) {
  if (typeof window === 'undefined') return;
  setSpeedLines(intensity);
  clearTimeout(speedLinesTimer);
  speedLinesTimer = window.setTimeout(() => setSpeedLines(0), durationMs);
}

export function popCounter(targetEl, { streak = 0 } = {}) {
  if (!targetEl || typeof document === 'undefined') return;
  targetEl.classList.remove('pk-counter-pop');
  void targetEl.offsetWidth;
  targetEl.classList.add('pk-counter-pop');
  if (streak >= 2) {
    let badge = targetEl.parentElement?.querySelector('.pk-combo-badge');
    if (!badge && targetEl.parentElement) {
      badge = document.createElement('span');
      badge.className = 'pk-combo-badge';
      targetEl.parentElement.append(badge);
    }
    if (badge) {
      badge.textContent = `×${Math.min(5, streak)}`;
      badge.classList.remove('is-on');
      void badge.offsetWidth;
      badge.classList.add('is-on');
      clearTimeout(badge._hideT);
      badge._hideT = window.setTimeout(() => badge.classList.remove('is-on'), 1100);
    }
  }
}

export function flyToCounter(worldPos, camera, targetEl, { color = '#ffc629', streak = 0 } = {}) {
  if (!targetEl || typeof document === 'undefined') return;
  if (!worldPos || !camera) {
    popCounter(targetEl, { streak });
    return;
  }
  const rect = targetEl.getBoundingClientRect();
  if (!rect.width && !rect.height) {
    popCounter(targetEl, { streak });
    return;
  }
  const projected = worldPos.clone().project(camera);
  const startX = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const startY = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  const endX = rect.left + rect.width * 0.5;
  const endY = rect.top + rect.height * 0.5;
  const token = document.createElement('div');
  token.className = 'pk-fly-coin';
  token.style.setProperty('--fly-color', color);
  token.style.left = `${startX}px`;
  token.style.top = `${startY}px`;
  document.body.append(token);
  const anim = token.animate([
    { transform: 'translate(-50%, -50%) scale(1.35)', opacity: 1 },
    { transform: `translate(${(endX - startX) * 0.45}px, ${(endY - startY) * 0.45 - 28}px) scale(1.1)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.55)`, opacity: 0.85 },
  ], { duration: 290, easing: 'cubic-bezier(.22, .88, .36, 1)' });
  anim.onfinish = () => {
    token.remove();
    popCounter(targetEl, { streak });
  };
}

// ---------- debris (parts that pop off) ----------
export class Debris {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  launch(obj, vel) {
    this.scene.attach(obj);   // keep its world position
    this.list.push({
      obj, t: 0, vel,
      spin: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
    });
  }

  update(dt) {
    this.list = this.list.filter((d) => {
      d.t += dt;
      if (d.t > 14) {
        this.scene.remove(d.obj);
        return false;
      }
      d.vel.y -= 30 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      d.obj.rotation.x += d.spin.x * dt;
      d.obj.rotation.y += d.spin.y * dt;
      d.obj.rotation.z += d.spin.z * dt;
      if (d.obj.position.y < 0.2) {
        d.obj.position.y = 0.2;
        d.vel.y = Math.abs(d.vel.y) * 0.35;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
        d.spin.multiplyScalar(0.6);
      }
      return true;
    });
  }

  clear() {
    for (const d of this.list) this.scene.remove(d.obj);
    this.list = [];
  }
}

// ---------- speech bubbles ----------
export function makeBubble() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(3.2, 1.2, 1);
  sprite.renderOrder = 10;
  sprite.visible = false;
  return {
    sprite,
    t: 0,
    say(text, time = 1.1) {
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, 512, 192);
      g.fillStyle = '#fff';
      g.strokeStyle = '#16161a';
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(14, 14, 484, 130, 40);
      g.moveTo(220, 142);
      g.lineTo(256, 186);
      g.lineTo(290, 142);
      g.fill();
      g.stroke();
      g.fillRect(222, 128, 66, 20);
      g.fillStyle = '#16161a';
      let size = 64;   // shrink long lines until they fit inside the bubble
      do g.font = `${size}px "Luckiest Guy", system-ui, sans-serif`;
      while (g.measureText(text).width > 440 && (size -= 4) > 28);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 256, 84);
      tex.needsUpdate = true;
      sprite.visible = true;
      this.t = this.dur = time;
    },
    update(dt) {
      if (this.t <= 0) return;
      this.t -= dt;
      const k = Math.min(1, 0.4 + (this.dur - this.t) * 6);   // quick pop-in
      sprite.scale.set(3.2 * k, 1.2 * k, 1);
      if (this.t <= 0) sprite.visible = false;
    },
  };
}
