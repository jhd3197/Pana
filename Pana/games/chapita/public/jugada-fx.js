// The jugadas' effects, from the Studio workbench: dust puffs, star bursts,
// an impact flash, confetti and the comic lettering (¡PRAAA!, ¡TOING!…).
// Pooled sprites redrawn every frame from the jugada's clock, so scrubbing in
// Studio and a live match show the same thing: begin(), draw, end() hides
// whatever this frame did not use. Sizes are in pana units times `k`.
import * as THREE from 'three';

const clamp01 = x => Math.min(1, Math.max(0, x));
const elasticOut = x => { x = clamp01(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * 2 * Math.PI / 3) + 1; };
export const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const PALETTE = ['#ff4b4b', '#2ad1b2', '#ffc629', '#3d7bf2', '#ffffff', '#ff8fd0', '#9b6bff', '#8dff8a'];

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export function createJugadaFx(parent, { k = .6, text = 1 } = {}) {
  const root = new THREE.Group(); root.name = 'Jugadas · efectos'; parent.add(root);
  let seed = 11; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const soft = canvasTexture(64, 64, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const star = canvasTexture(128, 128, x => { x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 24 : 56, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r); } x.closePath(); x.lineJoin = 'round'; x.lineWidth = 9; x.strokeStyle = '#2b2030'; x.stroke(); x.fillStyle = '#fff'; x.fill(); });
  const flashMap = canvasTexture(256, 256, x => { x.beginPath(); for (let i = 0; i < 28; i++) { const r = i % 2 ? 50 + random() * 20 : 105 + random() * 20, a = i * Math.PI / 14; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x.closePath(); x.fillStyle = '#fff6c9'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#ffd23f'; x.stroke(); const g = x.createRadialGradient(128, 128, 0, 128, 128, 60); g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(128, 128, 60, 0, Math.PI * 2); x.fill(); });
  const words = new Map();
  function word(str, fill) {
    const key = str + fill; if (words.has(key)) return words.get(key);
    const texture = canvasTexture(512, 256, x => {
      let size = 150; const font = s => `900 ${s}px "Luckiest Guy", Nunito, "Arial Black", system-ui, sans-serif`;
      x.font = font(size); const w = x.measureText(str).width; if (w > 430) { size *= 430 / w; x.font = font(size); }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      x.lineWidth = 30; x.strokeStyle = 'rgba(43,32,48,.3)'; x.strokeText(str, 264, 142);
      x.lineWidth = 24; x.strokeStyle = '#2b2030'; x.strokeText(str, 256, 128); x.fillStyle = fill; x.fillText(str, 256, 128);
      x.save(); x.beginPath(); x.rect(0, 0, 512, 116); x.clip(); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillText(str, 256, 128); x.restore();
    });
    words.set(key, texture); return texture;
  }

  let on = true; const pools = [], owned = [];
  function pool(n, make) {
    // Grown on demand: a scene that never throws confetti never builds any.
    const p = { items: [], i: 0 };
    pools.push(p);
    return () => {
      if (!on || p.i >= n) return null;
      if (p.i === p.items.length) { const made = make(p.i); root.add(made); p.items.push(made); }
      const o = p.items[p.i++]; o.visible = true; return o;
    };
  }
  const sprite = (map, o = {}) => { const m = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, ...o }); owned.push(m); return new THREE.Sprite(m); };
  const confettiGeometry = new THREE.PlaneGeometry(.12 * k, .2 * k);
  const takeDust = pool(160, () => sprite(soft)), takeStar = pool(110, () => sprite(star));
  const takeFlash = pool(3, () => { const s = sprite(flashMap, { depthTest: false }); s.renderOrder = 9; return s; });
  const paper = PALETTE.map(color => { const m = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: .5 }); owned.push(m); return m; });
  const takeConfetti = pool(160, j => new THREE.Mesh(confettiGeometry, paper[j % paper.length]));
  const takeLabel = pool(16, () => { const s = sprite(null, { depthTest: false, fog: false }); s.renderOrder = 10; return s; });

  const fx = {
    root, k,
    begin(enabled = true) { on = enabled; pools.forEach(p => { p.i = 0; }); },
    end() { pools.forEach(p => { for (let j = p.i; j < p.items.length; j++) p.items[j].visible = false; }); },
    puff(p, size, opacity, color = '#fffaf0') { const s = takeDust(); if (!s) return; s.position.copy(p); s.scale.setScalar(size * k); s.material.opacity = opacity; s.material.color.set(color); },
    dust(p, age, o = {}) {
      const life = o.life ?? .6; if (age < 0 || age >= life) return;
      const n = o.count ?? 8, q = age / life, e = 1 - Math.pow(1 - q, 3), s0 = o.seed ?? 0;
      for (let j = 0; j < n; j++) {
        const r = hsh(s0 + j * 5.3), a = j / n * Math.PI * 2 + r, rad = (o.spread ?? .8) * k * e * (.7 + .5 * r);
        fx.puff(new THREE.Vector3(p.x + Math.cos(a) * rad, p.y + (.05 + e * .3 * (.5 + r)) * k, p.z + Math.sin(a) * rad), (o.size ?? .4) * (.5 + e * .9), (1 - q) * .85, o.color ?? '#f3e6d0');
      }
    },
    burst(p, age, o = {}) {
      const life = o.life ?? .75; if (age < 0 || age >= life) return;
      const n = o.count ?? 10, q = age / life, e = 1 - Math.pow(1 - q, 2.5), s0 = o.seed ?? 0;
      for (let j = 0; j < n; j++) {
        const s = takeStar(); if (!s) return;
        const r = hsh(s0 + j * 9.1), r2 = hsh(s0 + j * 2.7), a = j / n * Math.PI * 2 + r * .4, el = -.3 + r2 * 1.6, rad = (o.radius ?? 1.4) * k * e;
        s.position.set(p.x + Math.cos(a) * Math.cos(el) * rad, p.y + Math.sin(el) * rad - q * q * .5 * k, p.z + Math.sin(a) * Math.cos(el) * rad);
        s.scale.setScalar((o.size ?? .3) * k * (q < .12 ? q / .12 : 1 - (q - .12) * .85));
        s.material.rotation = age * 6 + j; s.material.opacity = 1 - q * q;
        s.material.color.set(o.color ?? (o.multi ? PALETTE[j % PALETTE.length] : '#ffd23f'));
      }
    },
    star(p, size, rot, opacity, color = '#ffd23f') { const s = takeStar(); if (!s) return; s.position.copy(p); s.scale.setScalar(size * k); s.material.rotation = rot; s.material.opacity = opacity; s.material.color.set(color); },
    flash(p, age, size = 1.6, life = .22) {
      if (age < 0 || age >= life) return; const s = takeFlash(); if (!s) return;
      const q = age / life; s.position.copy(p); s.scale.setScalar(size * k * (.6 + q * .8)); s.material.opacity = 1 - q * q; s.material.rotation = q * .6;
    },
    confetti(p, age, o = {}) {
      if (age < 0) return;
      const n = o.count ?? 60, s0 = o.seed ?? 0, pw = (o.power ?? 1) * k, kd = 2, g = 4 * k, e = (1 - Math.exp(-kd * age)) / kd;
      for (let j = 0; j < n; j++) {
        const m = takeConfetti(); if (!m) return;
        const r1 = hsh(s0 + j * 3.1), r2 = hsh(s0 + j * 7.7), r3 = hsh(s0 + j * 1.3), a = r1 * Math.PI * 2, hs = (1 + r2 * 3) * pw, vy = (4 + r3 * 4) * pw;
        let y = p.y + (vy + g / kd) * e - (g / kd) * age;
        const x = p.x + Math.cos(a) * hs * e + Math.sin(age * 4 + j) * .1 * k * Math.min(age, 1), z = p.z + Math.sin(a) * hs * e;
        if (y < .03) { y = .03 + r1 * .01; m.rotation.set(-Math.PI / 2, 0, a * 3); } else m.rotation.set(age * (6 + r2 * 8) + j, age * (4 + r3 * 6), age * 3 + j);
        m.position.set(x, y, z); m.scale.setScalar(Math.min(1, age * 8));
      }
    },
    // Comic lettering that pops in, wobbles and floats away; hold keeps it up.
    text(str, color, p, age, o = {}) {
      const life = o.life ?? 1.2; if (age < 0 || (!o.hold && age >= life)) return;
      const s = takeLabel(); if (!s) return;
      const map = word(str, color); if (s.material.map !== map) { s.material.map = map; s.material.needsUpdate = true; }
      const pop = age < .45 ? elasticOut(age / .45) : 1, fade = o.hold ? 1 : clamp01((life - age) / .25), rise = o.hold ? 0 : Math.max(0, age - .35) * .5 * k;
      const size = (o.size ?? 1) * .72 * k * text;
      s.scale.set(2 * size * pop, size * pop, 1); s.position.set(p.x, p.y + rise, p.z);
      s.material.opacity = fade; s.material.rotation = (o.tilt ?? -.07) + Math.sin(age * 8) * .06 * Math.max(0, 1 - age);
    },
    dispose() {
      root.removeFromParent(); confettiGeometry.dispose(); owned.forEach(m => m.dispose());
      [soft, star, flashMap, ...words.values()].forEach(t => t.dispose()); words.clear();
    },
  };
  return fx;
}
