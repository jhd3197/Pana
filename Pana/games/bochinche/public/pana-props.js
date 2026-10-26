import * as THREE from 'three';
// Costume props worn on the shared pana sculpt: paws are arms[0|1] (fist near (0,-0.95,0.1)), the head and the body.
// Geometries, materials and canvas textures are cached per module and shared by every fighter.
const PI = Math.PI, TAU = PI * 2, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const geos = new Map(), mats = new Map(), texs = new Map();
const geo = (key, make) => geos.get(key) ?? geos.set(key, make()).get(key);
const mat = (key, make) => mats.get(key) ?? mats.set(key, make()).get(key);
const std = (color, roughness = 0.6, extra = {}) => mat(`${color}|${roughness}|${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
const canvasTex = (key, w, h, draw) => texs.get(key) ?? texs.set(key, (() => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})()).get(key);
const steel = () => std('#8a929e', 0.35, { metalness: 0.75 });
const gold = () => std('#ffc629', 0.3, { metalness: 0.8 });
function mesh(parent, g, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; parent?.add(o); return o;
}
// a tube along points whose radius follows taper(u), u from 0 at the base to 1 at the tip
function taperTube(points, segs, radius, radial, taper) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const p = g.attributes.position, c = V3(), v = V3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c); const s = taper(i / segs);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(s).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  return g;
}
const runeTex = () => canvasTex('runes', 128, 64, (c) => {
  c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round';
  for (const g of [[[12, 10], [12, 54], [32, 30]], [[50, 54], [60, 10], [70, 54]], [[92, 10], [92, 54], [112, 40], [92, 30]]]) { c.beginPath(); g.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
});
const iceTex = () => canvasTex('ice', 64, 64, (c, w, h) => {
  ['#e0263a', '#ffd23a', '#3ab04a'].forEach((col, k) => { c.fillStyle = col; c.fillRect(0, k * h / 3, w, h / 3 + 1); });
  c.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 160; i++) c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
});
const arepaTex = () => canvasTex('arepa', 128, 128, (c, w, h) => {
  c.fillStyle = '#f2cf7a'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, TAU); c.fill();
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * w * 0.44;
    c.fillStyle = `rgba(${130 + Math.random() * 40},${70 + Math.random() * 30},20,${0.35 + Math.random() * 0.4})`;
    c.beginPath(); c.ellipse(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2 + Math.random() * 5, 1.5 + Math.random() * 3, Math.random() * PI, 0, TAU); c.fill();
  }
});
const drumTex = () => canvasTex('drum', 128, 64, (c, w, h) => {
  c.fillStyle = '#9a5a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0262d'; c.fillRect(0, 0, w, 7); c.fillRect(0, h - 7, w, 7);
  c.fillStyle = '#ffc629'; c.fillRect(0, 7, w, 3); c.fillRect(0, h - 10, w, 3);
  c.strokeStyle = '#f2e2b0'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k <= 8; k++) c.lineTo(k * w / 8, k % 2 ? h - 10 : 10); c.stroke();
});

// Each builder returns { parts: [[parent, object]], hold?, upright?, tick? }.
const BUILD = {
  helmet(ch) {
    const g = new THREE.Group(); g.position.set(0, 0.12, -0.04);
    mesh(g, geo('helmetDome', () => new THREE.SphereGeometry(0.9, 16, 7, 0, TAU, 0, PI * 0.47)), steel()).scale.set(1, 0.92, 0.98);
    const band = mesh(g, geo('helmetBand', () => new THREE.TorusGeometry(0.89, 0.07, 5, 24)), gold(), 0, 0.05); band.rotation.x = PI / 2;
    const ridge = mesh(g, geo('helmetRidge', () => new THREE.TorusGeometry(0.84, 0.05, 4, 12, PI)), gold(), 0, 0.04); ridge.rotation.y = PI / 2; ridge.scale.set(1, 0.92, 0.98);
    mesh(g, geo('helmetNose', () => new THREE.BoxGeometry(0.14, 0.42, 0.08)), gold(), 0, -0.12, 0.86);
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.84, 0.25, -0.05); w.rotation.z = s * -0.4; g.add(w);
      for (let k = 0; k < 4; k++) {
        const f = mesh(w, geo('ball8', () => new THREE.SphereGeometry(1, 8, 6)), std('#f6f6f2'), s * 0.05, 0.12 + k * 0.15, -0.12 - k * 0.07);
        f.scale.set(0.06, 0.15 + k * 0.035, 0.38 - k * 0.04); f.rotation.x = -0.45 - k * 0.2;
      }
    }
    return { parts: [[ch.head, g]] };
  },
  hammer(ch) {
    const g = new THREE.Group(); g.position.set(0, -0.85, 0.08);
    mesh(g, geo('hammerHandle', () => new THREE.CylinderGeometry(0.075, 0.09, 1.5, 8)), std('#6a3a1e', 0.8), 0, -0.55);
    for (let k = 0; k < 4; k++) mesh(g, geo('hammerWrap', () => new THREE.TorusGeometry(0.095, 0.02, 3, 10).rotateX(PI / 2)), std('#4a2812', 0.8), 0, -0.1 - k * 0.3);
    mesh(g, geo('ball8', () => new THREE.SphereGeometry(1, 8, 6)), gold(), 0, 0.22).scale.setScalar(0.12);
    mesh(g, geo('hammerHead', () => new THREE.BoxGeometry(1.05, 0.62, 0.62)), steel(), 0, -1.48);
    for (const s of [-1, 1]) mesh(g, geo('hammerCap', () => new THREE.BoxGeometry(0.08, 0.68, 0.68)), gold(), s * 0.53, -1.48);
    const runes = mat('runes', () => new THREE.MeshBasicMaterial({ map: runeTex(), color: new THREE.Color('#7ac8ff').multiplyScalar(0.6), toneMapped: false, transparent: true, depthWrite: false }));
    for (const s of [-1, 1]) { const r = mesh(g, geo('runePlane', () => new THREE.PlaneGeometry(0.8, 0.4)), runes, 0, -1.48, s * 0.315); r.castShadow = false; if (s < 0) r.rotation.y = PI; }
    return { parts: [[ch.arms[1], g]], head: () => g.localToWorld(V3(0, -1.48, 0)) };
  },
  gloves(ch) {
    const red = std('#d81e1e', 0.35);
    return { parts: ch.arms.map(a => {
      const g = new THREE.Group(); g.position.set(0, -0.9, 0.05);
      mesh(g, geo('ball12', () => new THREE.SphereGeometry(1, 12, 9)), red).scale.set(0.36, 0.414, 0.378);
      mesh(g, geo('ball8', () => new THREE.SphereGeometry(1, 8, 6)), red, 0, -0.05, 0.3).scale.setScalar(0.14);
      mesh(g, geo('gloveCuff', () => new THREE.CylinderGeometry(0.27, 0.3, 0.22, 12)), std('#f6f6f2', 0.5), 0, 0.34);
      return [a, g];
    }) };
  },
  cup(ch) {
    const g = new THREE.Group(); g.position.set(0, -0.95, 0.12);
    mesh(g, geo('cupCone', () => new THREE.ConeGeometry(0.34, 0.75, 12, 1, true).rotateX(PI)), std('#f6f2ea', 0.7, { side: THREE.DoubleSide }), 0, -0.1);
    mesh(g, geo('iceDome', () => new THREE.SphereGeometry(0.36, 12, 5, 0, TAU, 0, PI / 2)), mat('ice', () => new THREE.MeshStandardMaterial({ map: iceTex(), roughness: 0.4 })), 0, 0.27);
    mesh(g, geo('straw', () => new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5, 1, true)), std('#ff7ac0', 0.5), 0.1, 0.55).rotation.z = -0.3;
    return { parts: [[ch.arms[0], g]], upright: [g] };
  },
  bat(ch) {
    const g = new THREE.Group(), wood = std('#c8884a', 0.45), tape = std('#1a1a1a', 0.8);
    g.position.set(0, -0.85, 0.2); g.rotation.x = -PI / 2;
    mesh(g, geo('batBody', () => new THREE.CylinderGeometry(0.12, 0.34, 3.2, 10, 1, true)), wood, 0, -1.6);
    mesh(g, geo('batCap', () => new THREE.SphereGeometry(0.34, 10, 3, 0, TAU, 0, PI / 2).rotateX(PI)), wood, 0, -3.2);
    mesh(g, geo('batGrip', () => new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8, 1, true)), tape, 0, -0.2);
    mesh(g, geo('batKnob', () => new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8)), tape, 0, 0.2);
    return { parts: [[ch.arms[1], g]] };
  },
  mitt(ch) {
    const g = new THREE.Group(), mm = std('#a8642a', 0.7); g.position.set(0, -0.92, 0.08);
    mesh(g, geo('ball12', () => new THREE.SphereGeometry(1, 12, 9)), mm).scale.set(0.42, 0.483, 0.231);
    for (let k = 0; k < 4; k++) mesh(g, geo('mittFinger', () => new THREE.CapsuleGeometry(0.09, 0.32, 2, 6)), mm, -0.27 + k * 0.18, -0.42).rotation.z = (k - 1.5) * 0.12;
    const pocket = mesh(g, geo('ball8', () => new THREE.SphereGeometry(1, 8, 6)), std('#7a4218', 0.8), 0, 0, 0.12); pocket.scale.set(0.3, 0.33, 0.105);
    return { parts: [[ch.arms[0], g]] };
  },
  coil(ch) {
    const g = new THREE.Group(); g.position.set(0, -1.3, 0.12); g.rotation.y = 0.5;
    for (let k = 0; k < 3; k++) {
      const t = mesh(g, geo(`coil${k}`, () => new THREE.TorusGeometry(0.38 - k * 0.02, 0.05, 4, 16)), std('#c8a060', 0.9), k * 0.03, -k * 0.03, k * 0.05 - 0.05);
      t.rotation.z = k * 0.4;
    }
    return { parts: [[ch.arms[0], g]] };
  },
  budare(ch) {
    const g = new THREE.Group(), iron = std('#2a2a2e', 0.55, { metalness: 0.5 }); g.position.set(0, -0.95, 0.1);
    mesh(g, geo('budareHandle', () => new THREE.BoxGeometry(0.14, 0.08, 0.6)), iron, 0, 0, 0.3);
    mesh(g, geo('budareDisc', () => new THREE.CylinderGeometry(0.85, 0.85, 0.07, 18)), iron, 0, 0, 1.4);
    const top = mat('arepaTop', () => new THREE.MeshStandardMaterial({ map: arepaTex(), roughness: 0.8 }));
    const arepa = mesh(g, geo('arepa', () => new THREE.CylinderGeometry(1, 1, 0.36, 14)), [std('#efc777', 0.85), top, top], 0, 0.13, 1.4);
    arepa.scale.setScalar(0.55);
    return { parts: [[ch.arms[1], g]], upright: [g] };
  },
  drum(ch) {
    const g = new THREE.Group(); g.position.set(0.15, 0, 1.55);
    mesh(g, geo('drumBody', () => new THREE.CylinderGeometry(0.62, 0.5, 1.5, 14, 1, true)), mat('drum', () => new THREE.MeshStandardMaterial({ map: drumTex(), roughness: 0.7, side: THREE.DoubleSide })), 0, 0.75);
    mesh(g, geo('drumSkin', () => new THREE.CircleGeometry(0.62, 14).rotateX(-PI / 2)), std('#efe0c0', 0.9), 0, 1.5);
    mesh(g, geo('drumRim', () => new THREE.TorusGeometry(0.62, 0.05, 4, 16).rotateX(PI / 2)), std('#5a3216', 0.7), 0, 1.5);
    const parts = [[ch.body.parent, g]];
    for (const a of ch.arms) {
      const s = mesh(null, geo('drumStick', () => new THREE.CylinderGeometry(0.035, 0.05, 1.0, 5, 1, true).translate(0, -0.5, 0)), std('#e8c890', 0.6), 0, -0.9, 0.08);
      s.rotation.x = -1.3; parts.push([a, s]);
    }
    return { parts };
  },
  crest(ch) {
    const g = new THREE.Group(); g.position.set(0, 0.82, -0.15);
    ['#e0263a', '#ffc629', '#3d7bf2'].forEach((c, k) => {
      const f = mesh(g, geo('feather', () => new THREE.SphereGeometry(1, 8, 6).translate(0, 1, 0)), std(c));
      f.scale.set(0.09, 0.32 + (k === 1 ? 0.08 : 0), 0.16); f.rotation.set(-0.5, 0, (k - 1) * 0.45);
    });
    return { parts: [[ch.head, g]] };
  },
  tacita(ch) {
    const g = new THREE.Group(), china = std('#f6f4ee', 0.3); g.position.set(0, -0.98, 0.18);
    mesh(g, geo('tacitaBody', () => new THREE.CylinderGeometry(0.2, 0.14, 0.28, 12, 1, true)), std('#f6f4ee', 0.3, { side: THREE.DoubleSide }), 0, 0.14);
    mesh(g, geo('tacitaCoffee', () => new THREE.CircleGeometry(0.19, 12).rotateX(-PI / 2)), std('#2a160a', 0.15), 0, 0.24);
    mesh(g, geo('tacitaEar', () => new THREE.TorusGeometry(0.08, 0.025, 4, 8)), china, 0.22, 0.15);
    mesh(g, geo('saucer', () => new THREE.CylinderGeometry(0.3, 0.24, 0.04, 14)), china, 0, -0.02);
    return { parts: [[ch.arms[1], g]], upright: [g] };
  },
  sack(ch) {
    const g = new THREE.Group(); g.position.set(0.45, 2.15, -0.75);
    mesh(g, geo('ball12', () => new THREE.SphereGeometry(1, 12, 9)), std('#8a7250', 1)).scale.set(0.62, 0.78, 0.55);
    mesh(g, geo('sackTie', () => new THREE.CylinderGeometry(0.16, 0.24, 0.3, 8, 1, true)), std('#6a5436', 1), 0, 0.82);
    for (const [x, rz] of [[-0.08, 0.3], [0.1, -0.4]]) mesh(g, geo('bone', () => new THREE.CapsuleGeometry(0.06, 0.45, 2, 6)), std('#f2ecdc', 0.6), x, 1.1).rotation.z = rz;
    return { parts: [[ch.body, g]] };
  },
  trident(ch) {
    const g = new THREE.Group(), au = gold(); g.position.set(0, -0.95, 0.1);
    mesh(g, geo('tridentShaft', () => new THREE.CylinderGeometry(0.06, 0.06, 3.9, 6)), au, 0, 0.5);
    mesh(g, geo('tridentBar', () => new THREE.BoxGeometry(0.95, 0.12, 0.12)), au, 0, 2.45);
    mesh(g, geo('tridentMid', () => new THREE.ConeGeometry(0.12, 0.9, 6)), au, 0, 2.95);
    for (const s of [-1, 1]) {
      mesh(g, geo('tridentProng', () => new THREE.CylinderGeometry(0.05, 0.05, 0.45, 5, 1, true)), au, s * 0.42, 2.7);
      mesh(g, geo('tridentTip', () => new THREE.ConeGeometry(0.1, 0.45, 6)), au, s * 0.42, 3.12);
    }
    mesh(g, geo('tridentGem', () => new THREE.OctahedronGeometry(0.16)), std('#3ad8ff', 0.2, { emissive: '#1a9ad8', emissiveIntensity: 1.2 }), 0, 2.45, 0.08);
    return { parts: [[ch.arms[1], g]], upright: [g], tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0)) };
  },
  horns(ch) {
    const g = new THREE.Group(), ivory = std('#efe2c0', 0.5);
    for (const s of [-1, 1]) {
      const at = t => V3(s * (0.6 + 0.75 * t), 0.5 + 0.15 * t + 0.75 * t * t, 0.05 - 0.15 * t);
      mesh(g, geo(`horn${s}`, () => taperTube([0, 0.25, 0.5, 0.75, 1].map(at), 10, 0.23, 7, u => (0.19 * (1 - u) + 0.04) / 0.23)), ivory);
      mesh(g, geo('ball8', () => new THREE.SphereGeometry(1, 8, 6)), ivory, ...at(0).toArray()).scale.setScalar(0.23);
      mesh(g, geo('ball8', () => new THREE.SphereGeometry(1, 8, 6)), ivory, ...at(1).toArray()).scale.setScalar(0.04);
    }
    return { parts: [[ch.head, g]] };
  },
  nosering(ch) {
    const r = mesh(null, geo('nosering', () => new THREE.TorusGeometry(0.17, 0.04, 5, 14)), gold(), 0, -0.42, 1.0);
    r.rotation.x = 0.25;
    return { parts: [[ch.head, r]] };
  },
  snakes(ch) {
    const g = new THREE.Group(), list = [], scale = std('#3a9a3a', 0.5), eye = mat('snakeEye', () => new THREE.MeshBasicMaterial({ color: '#ffe14a' }));
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * TAU + 0.2, s = new THREE.Group(); s.position.set(Math.cos(a) * 0.5, 0.72, Math.sin(a) * 0.42 - 0.12);
      s.userData.base = V3(Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65);
      mesh(s, geo('snakeBody', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(0.08, 0.22, 0), V3(-0.06, 0.45, 0.04), V3(0.04, 0.66, 0.12)]), 10, 0.075, 5)), scale);
      mesh(s, geo('ball8', () => new THREE.SphereGeometry(1, 8, 6)), scale, 0.04, 0.7, 0.18).scale.set(0.12, 0.096, 0.156);
      for (const e of [-1, 1]) { const m = mesh(s, geo('snakeEyeBall', () => new THREE.SphereGeometry(0.03, 5, 3)), eye, 0.04 + e * 0.07, 0.74, 0.26); m.castShadow = false; }
      g.add(s); list.push(s);
    }
    return { parts: [[ch.head, g]], tick(time) {
      list.forEach((s, k) => { const b = s.userData.base; s.rotation.set(b.x + Math.sin(time * 2 + k) * 0.15, Math.sin(time * 1.7 + k * 2) * 0.6, b.z + Math.cos(time * 2.3 + k) * 0.15); });
    } };
  },
};

export function createPanaProps(character, names = []) {
  const built = [...new Set(names)].filter(n => BUILD[n]).map(n => BUILD[n](character));
  const parts = built.flatMap(b => b.parts), upright = built.flatMap(b => (b.upright || []).map(o => [o, b.tilt]));
  for (const [parent, o] of parts) { o.traverse(c => { c.userData.prop = true; }); parent.add(o); }
  const hammer = built.find(b => b.head);
  const q = new THREE.Quaternion(), root = new THREE.Quaternion();
  return {
    update(dt, time = 0) {
      if (upright.length) {
        // hand-held cups, the budare and the trident keep the character's upright frame whatever the arm does
        character.group.getWorldQuaternion(root);
        for (const [o, tilt] of upright) {
          o.parent.updateWorldMatrix(true, false); o.parent.getWorldQuaternion(q);
          o.quaternion.copy(q.invert().multiply(root)); if (tilt) o.quaternion.multiply(tilt);
        }
      }
      for (const b of built) b.tick?.(time);
    },
    dispose() { for (const [, o] of parts) o.removeFromParent(); parts.length = 0; upright.length = 0; built.length = 0; },
    ...(hammer && { hammerHead: hammer.head }),
  };
}
