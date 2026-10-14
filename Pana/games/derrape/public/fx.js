// Sounds, smoke puffs, flying debris and speech bubbles.

import * as THREE from 'three';

// ---------- sound (WebAudio, no files) ----------
export const sound = {
  ctx: null,
  muted: false,
  engine: null,

  unlock() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, start, dur, type = 'square', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  horn(kind) {
    if (kind === 'cucaracha') {
      // la cu-ca-ra-cha, la cu-ca-ra-cha
      const notes = [[392, 0.11], [392, 0.11], [392, 0.11], [523, 0.28], [659, 0.3],
        [392, 0.11], [392, 0.11], [392, 0.11], [523, 0.28], [659, 0.4]];
      let t = 0;
      for (const [f, d] of notes) {
        this.tone(f, t, d * 0.92, 'square', 0.08);
        this.tone(f * 1.26, t, d * 0.92, 'square', 0.04);
        t += d;
      }
      return 1.9;
    }
    if (kind === 'grave') {
      // big truck horn: two long low blasts
      for (const t of [0, 0.42]) {
        this.tone(175, t, 0.34, 'sawtooth', 0.09);
        this.tone(220, t, 0.34, 'square', 0.05);
      }
      return 0.8;
    }
    if (kind === 'fiesta') {
      // party jingle: up the arpeggio and a happy hold
      const notes = [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.12], [784, 0.1], [1047, 0.32]];
      let t = 0;
      for (const [f, d] of notes) {
        this.tone(f, t, d * 0.9, 'square', 0.07);
        this.tone(f / 2, t, d * 0.9, 'triangle', 0.06);
        t += d;
      }
      return 0.9;
    }
    this.tone(640, 0, 0.13, 'square', 0.1);
    this.tone(860, 0, 0.13, 'square', 0.06);
    this.tone(640, 0.18, 0.16, 'square', 0.1);
    this.tone(860, 0.18, 0.16, 'square', 0.06);
    return 0.4;
  },

  bonk(power = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = 0.25;
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
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
    // cartoon "boing" thump
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    og.gain.setValueAtTime(Math.min(0.4, 0.12 * power), t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.32);
  },

  boing() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.32);
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
    o.connect(f).connect(g).connect(this.ctx.destination);
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

// ---------- puffs (smoke, dust) ----------
const puffGeo = new THREE.IcosahedronGeometry(0.35, 0);

export class Puffs {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(pos, { color = 0x8a8a92, count = 6, spread = 0.8, size = 1, rise = 1.5, life = 1.1 } = {}) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({
        color, flatShading: true, roughness: 1, transparent: true, opacity: 0.9,
      }));
      m.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + Math.random() * 0.3, pos.z + (Math.random() - 0.5) * spread);
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      const s = size * (0.6 + Math.random() * 0.6);
      m.scale.setScalar(s);
      this.scene.add(m);
      this.list.push({
        m, t: 0, life: life * (0.7 + Math.random() * 0.6), s,
        v: new THREE.Vector3((Math.random() - 0.5) * 2, rise * (0.6 + Math.random()), (Math.random() - 0.5) * 2),
      });
    }
  }

  update(dt) {
    this.list = this.list.filter((p) => {
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        this.scene.remove(p.m);
        p.m.material.dispose();
        return false;
      }
      p.m.position.addScaledVector(p.v, dt);
      p.m.scale.setScalar(p.s * (1 + k * 1.6));
      p.m.material.opacity = 0.9 * (1 - k);
      return true;
    });
  }

  clear() {
    for (const p of this.list) this.scene.remove(p.m);
    this.list = [];
  }
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
      g.font = '64px "Luckiest Guy", system-ui, sans-serif';
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
