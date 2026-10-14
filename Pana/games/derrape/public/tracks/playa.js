// Playa Pana — a tropical beach island at dusk. The one track with `island`:
// the ground plane is the sea and the whole loop runs on a sand ellipse.
// Kiosks with warm lit windows, a pier into the lagoon, volleyball on the
// sand and a lighthouse sweeping its beam from the rocky point.

import * as THREE from 'three';
import { M, mesh, box, canvasMat } from '../car-kit.js';

// ---------- beach-only props ----------
// Red/white striped lighthouse with a rotating light beam.
function lighthouse() {
  const g = new THREE.Group();
  const white = M(0xf6f1e4, { roughness: 0.8 });
  const red = M(0xe63946, { roughness: 0.7 });
  const h = 9, bands = 5;
  for (let i = 0; i < bands; i++) {
    const bh = h / bands;
    g.add(mesh(new THREE.CylinderGeometry(1.55 - (i + 1) * 0.16, 1.55 - i * 0.16, bh, 12),
      i % 2 ? red : white, 0, bh * (i + 0.5), 0));
  }
  g.add(box(2, 0.25, 2, M(0x3a3a44, { roughness: 0.8 }), 0, h + 0.12, 0));      // gallery
  g.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.3, 10),
    M(0xffe066, { emissive: 0xffe066, emissiveIntensity: 1.6 }), 0, h + 0.9, 0)); // lamp room
  g.add(mesh(new THREE.ConeGeometry(1.05, 0.9, 10), red, 0, h + 1.95, 0));        // cap
  // sweeping beam: a cone pivoting around the lamp, apex at the light
  const pivot = new THREE.Group();
  pivot.position.y = h + 0.9;
  const beamGeo = new THREE.ConeGeometry(2.4, 16, 10, 1, true);
  beamGeo.translate(0, -8, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0xffe066, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  }));
  beam.rotation.z = Math.PI / 2;   // point the cone along +x
  pivot.add(beam);
  g.add(pivot);
  g.userData.tick = (t) => { pivot.rotation.y = t * 0.7; };
  return g;
}

// Beach umbrella: wooden pole, striped cone canopy (stripes wrap into wedges).
function umbrella({ color = '#e8452c', tilt = 0.1 } = {}) {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.5, 7), M(0xd8c49a, { roughness: 0.9 }), 0, 1.25, 0);
  pole.rotation.z = tilt * 0.4;
  g.add(pole);
  const canopyMat = canvasMat(200, 40, (ctx) => {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#fdf6e3' : color;
      ctx.fillRect(i * 20, 0, 20, 40);
    }
  });
  const canopy = mesh(new THREE.ConeGeometry(1.7, 0.85, 10), canopyMat, Math.sin(tilt * 0.4) * 2.4, 2.55, 0);
  canopy.rotation.z = tilt;
  g.add(canopy);
  return g;
}

// Volleyball net + beach ball.
function volleyballNet() {
  const g = new THREE.Group();
  const post = M(0x8a5a33, { roughness: 0.9 });
  for (const s of [1, -1]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 7), post, s * 3, 1.3, 0));
  const netMat = canvasMat(256, 96, (ctx) => {
    ctx.fillStyle = 'rgba(246,241,228,0.22)';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#f6f1e4';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 96); ctx.stroke(); }
    for (let y = 0; y <= 96; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    ctx.fillStyle = '#e8452c';
    ctx.fillRect(0, 0, 256, 8);   // top tape
  });
  netMat.side = THREE.DoubleSide;
  g.add(mesh(new THREE.PlaneGeometry(6, 1.8), netMat, 0, 1.6, 0));
  return g;
}

function beachBall() {
  const ballMat = canvasMat(128, 64, (ctx) => {
    const cols = ['#f6f1e4', '#e8452c', '#f6f1e4', '#2a9d8f', '#f6f1e4', '#e9c46a'];
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect((i * 128) / 6, 0, 128 / 6 + 1, 64); });
  });
  return mesh(new THREE.SphereGeometry(0.38, 12, 8), ballMat, 0, 0.38, 0);
}

// ---------- the track ----------
export default {
  id: 'playa',
  name: 'Playa Pana',
  blurb: 'Cocadas, palmeras y el faro encendido al caer el sol.',
  island: { rx: 100, rz: 82, color: 0xe8cf9a },
  points: [
    [-68, 20], [-40, 48], [-2, 55], [38, 50], [64, 30], [70, -8],
    [50, -40], [12, -52], [-32, -48], [-62, -22],
  ],
  hw: 9,
  lineU: 0.06,
  ramps: [
    { u: 0.38, len: 9, h: 1.8, hw: 4.2 },
    { u: 0.8, len: 9, h: 2.0, hw: 4.2 },
  ],
  items: {
    boxes: [0.16, 0.58],
    boxLanes: [-6, -2, 2, 6],
    pads: [
      { u: 0.34, off: 0 },
      { u: 0.66, off: -4 },
      { u: 0.76, off: 4 },
    ],
  },
  walls: true,
  fence: {},
  palette: {
    horizon: 0x3a2a55,
    skyTop: 0x171233,
    hemiSky: 0x8a7ab8,
    hemiGround: 0x2a4a5a,
    hemiInt: 1.1,
    sun: 0xff9a5a,
    sunInt: 1.5,
    ground: 0x166e85,   // deep teal sea
    track: 0xd9b878,    // packed sand
    dune: 0.25,
    fog: [60, 230],
  },

  scenery(group, kit, T) {
    const { at } = kit;
    // sand test: keep hand-placed props on the island ellipse
    const onSand = (x, z) => (x / 96) ** 2 + (z / 80) ** 2 < 0.85;

    // entrance: name sign + flag by the start line
    at(group, kit.mapSign(['Playa', 'Pana']), kit.placeOnTrack(T, T.LINE - 12, T.HW + 7), Math.PI * 0.5);
    at(group, kit.flagPole({ h: 10 }), kit.placeOnTrack(T, T.LINE - 20, T.HW + 6));

    // lighthouse on a rocky islet at the island's eastern point
    const faro = { x: 84, z: -38 };
    at(group, kit.rock(3, 0x6a6a7a, 51), { x: 83, z: -37 });
    at(group, kit.rock(2.3, 0x5c5c68, 52), { x: 87.5, z: -40.5 });
    at(group, kit.rock(1.8, 0x787884, 53), { x: 80.5, z: -35 });
    at(group, lighthouse(), { x: faro.x, z: faro.z, y: 1.6 }, -0.6);

    // inner lagoon with the wooden pier and an anchored sailboat
    const lagoon = { x: -15, z: -2 };
    at(group, kit.waterPond(18, 12, { color: 0x2a9db8 }), lagoon);
    at(group, kit.dock({ len: 12, w: 3 }), { x: 4, z: -2 });
    at(group, kit.sailboat(), { x: -16, z: 3, y: 0.05 }, 0.6);
    at(group, kit.rock(1.6, 0x6a6a7a, 61), { x: -30, z: -8 });
    at(group, kit.rock(1.2, 0x787884, 62), { x: -2, z: 7 });

    // beach kiosks with warm lit windows for the dusk party
    const kiosk = (opts, p, rot) => {
      const s = kit.arepaStand(opts);
      s.add(box(0.9, 0.6, 0.06, M(0xffe0a8, { emissive: 0xff9a5a, emissiveIntensity: 1.5 }), 0.9, 1.6, -0.82));
      s.add(mesh(new THREE.SphereGeometry(0.14, 8, 6),
        M(0xffe066, { emissive: 0xffc94d, emissiveIntensity: 1.8 }), -1.2, 2.3, 0.8));
      at(group, s, p, rot);
    };
    kiosk({ color: '#2a9d8f', label: 'CACAO' }, { x: -65, z: 53 }, 2.4);
    kiosk({ color: '#e9c46a', label: 'PIÑA COLADA' }, { x: 40, z: -18 }, 1.25);
    kiosk({ color: '#e76f51', label: 'COCADA' }, { x: 34, z: 26 }, -2.7);

    // umbrellas on the south shore + two by the lagoon, volleyball court
    at(group, umbrella({ color: '#e8452c', tilt: 0.14 }), { x: 16, z: 68 }, 0.7);
    at(group, umbrella({ color: '#2a9d8f' }), { x: -22, z: 68 }, 2.9);
    at(group, umbrella({ color: '#e9c46a', tilt: -0.12 }), { x: -36, z: 65 }, 1.8);
    at(group, umbrella({ color: '#e8452c', tilt: 0.08 }), { x: 24, z: 8 }, 4.4);
    at(group, umbrella({ color: '#f4a259' }), { x: 38, z: 21 }, 5.6);
    at(group, volleyballNet(), { x: 28, z: 14 }, 0.4);
    at(group, beachBall(), { x: 31, z: 17 });

    // lifeguard tower watching the lagoon
    at(group, kit.watchtower({ h: 5, roof: 'zinc' }), { x: -32, z: 8 }, 2.1);

    // waterfall tumbling from a shore rock into the sea (northeast edge)
    at(group, kit.rock(3.2, 0x6a6a7a, 71), { x: 77, z: 43 });
    at(group, kit.rock(2.4, 0x5c5c68, 72), { x: 81, z: 47, y: 0.4 });
    at(group, kit.waterfall(2.6, 4.2), { x: 80.5, z: 47.5 }, Math.atan2(80.5, 47.5));

    // rocky islets out in the sea near the shore
    for (const [i, r] of [[78, 54, 2.2], [-84, 50, 2.6], [84, -46, 2], [-86, -44, 2.4]].entries()) {
      at(group, kit.rock(r[2], 0x5c5c68, 80 + i), { x: r[0], z: r[1] }, i * 1.3);
    }
    at(group, kit.palm({ h: 5, seed: 90 }), { x: 78, z: 54, y: 0.5 }, 1.1);   // one stubborn palm

    // shore rocks sitting on the sand
    at(group, kit.rock(2, 0x6a6a7a, 85), { x: 74, z: -52 });
    at(group, kit.rock(1.5, 0x787884, 86), { x: -76, z: -30 });

    // palms everywhere on the sand, clear of the road and the lagoon
    const avoid = [
      { x: lagoon.x, z: lagoon.z, r: 24 },
      { x: 28, z: 14, r: 12 }, { x: 34, z: 26, r: 9 }, { x: 40, z: -18, r: 8 },
      { x: -32, z: 8, r: 8 }, { x: faro.x, z: faro.z, r: 10 },
      { x: 16, z: 68, r: 5 }, { x: -22, z: 68, r: 5 }, { x: -36, z: 65, r: 5 },
      { x: 24, z: 8, r: 5 }, { x: 38, z: 21, r: 6 },
    ];
    const palmSpots = [];
    for (const p of kit.scatter(T, { seed: 21, count: 40, min: T.HW + 4, max: T.HW + 22, avoid })) {
      if (palmSpots.length >= 12) break;
      if (!onSand(p.x, p.z)) continue;
      if (palmSpots.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 7)) continue;   // no stacked palms
      palmSpots.push(p);
    }
    for (const [i, p] of palmSpots.entries()) {
      at(group, kit.palm({ h: 6 + (i % 4), seed: 50 + i }), p, p.rot);
    }
    at(group, kit.palm({ h: 8, seed: 95 }), { x: 58, z: 60 }, 0.5);
    at(group, kit.palm({ h: 7, seed: 96 }), { x: -48, z: 60 }, 2.2);
    at(group, kit.palm({ h: 6, seed: 97 }), { x: -70, z: 40 }, 4.0);

    // gaviotas circling over the lagoon and the point
    for (const c of [
      { cx: lagoon.x, cz: lagoon.z, cy: 17, r: 26, speed: 0.3, phase: 0 },
      { cx: 60, cz: -40, cy: 14, r: 18, speed: 0.42, phase: 2 },
    ].entries()) {
      const gull = kit.buildBird({ body: '#f6f6f6', wing: '#c9c9c9', beak: '#f4a259', tail: '#c9c9c9', size: 1.1 });
      gull.flyCircle(group, c);
    }
  },
};
