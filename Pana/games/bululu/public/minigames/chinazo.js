import { random, inputFor } from '../online-rules.js';
// ¡Chinazo! Duck Hunt in a Venezuelan patio: iguanas are eating the mangos
// again, and the panas have a china and a pocket of mamones. Aim with the
// reticle, pull, let go. A hit goes ¡bonk!: the iguana flips into the bushes
// with dizzy stars and runs off, offended. The golden one is worth 3; the
// guacamaya costs 2. The rules live in chinazo-sim.js.

import * as THREE from 'three';
import { Puffs, sound, makeBubble } from '/engine/fx.js';
import { M, mesh, box, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { branch, leafyCushion, paleBark } from '/engine/models/vegetation/canopy.js';
import { bush } from '/engine/models/vegetation/bush.js';
import { makeMango } from '/engine/models/props/mango.js';
import { colonialHouse } from '/engine/models/props/colonial-house.js';
import { iguana } from '/engine/models/fauna/iguana.js';
import { china } from '/engine/models/props/china.js';
import { scarletMacaw } from '/engine/models/fauna/birds/scarlet-macaw.js';
import { sunnyStage, makeActors, pick } from './stage.js';
import { chinazoSim, CHINAZO, CAMERA, seatsFor, TRUNK, BRANCHES, WALL, ROOF, BUSHES, MANGOS, RUSTLE } from './chinazo-sim.js';

const S = CHINAZO.scale;
const up = new THREE.Vector3(0, 1, 0);

// ---------- the patio ----------
function bloqueTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8f8a82'; g.fillRect(0, 0, 256, 128);
  for (let row = 0; row < 4; row++) for (let col = -1; col < 5; col++) {
    const x = col * 64 + (row % 2) * 32, shade = 168 + ((row * 7 + col * 13) % 5) * 7;
    g.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 12})`;
    g.fillRect(x + 3, row * 32 + 3, 58, 26);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mangoTree(scene, r) {
  const g = new THREE.Group();
  g.add(branch([TRUNK.x, 0, TRUNK.z], [TRUNK.x + 0.1, TRUNK.top + 0.4, TRUNK.z - 0.1], TRUNK.r * 1.35, TRUNK.r * 0.8));
  // roots flaring into the patio
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.4;
    g.add(branch([TRUNK.x, 0.5, TRUNK.z], [TRUNK.x + Math.cos(a) * 1.1, 0, TRUNK.z + Math.sin(a) * 0.9], 0.3, 0.12));
  }
  for (const br of BRANCHES) {
    g.add(branch(br.a, br.b, br.r * 1.6, br.r * 0.7));
    // a few twigs climbing into the leaves
    for (const k of [0.45, 0.8]) {
      const p = br.a.map((v, i) => v + (br.b[i] - v) * k);
      g.add(branch(p, [p[0] + (r() - 0.5), p[1] + 1.6, p[2] - 1.2], br.r * 0.6, 0.05));
    }
  }
  g.add(branch([TRUNK.x, TRUNK.top - 0.4, TRUNK.z], [TRUNK.x - 0.8, 11.5, TRUNK.z - 1.6], 0.45, 0.18));
  g.add(branch([TRUNK.x, TRUNK.top - 0.4, TRUNK.z], [TRUNK.x + 1.2, 11.8, TRUNK.z - 1.5], 0.45, 0.18));
  // the canopy sits behind the branches, so iguanas on them stay in sight
  const tints = [0x4f9b48, 0x64a847, 0x3f8a3f, 0x76ac49];
  const pads = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI, rad = 7.5 + r() * 2.2;
    pads.push([Math.cos(a) * rad, 6.6 + Math.sin(a) * 5.4 + r() * 0.8, -6.4 - r() * 1.6, 1.9 + r() * 1.1]);
  }
  for (let i = 0; i < 12; i++) pads.push([(r() - 0.5) * 11, 9 + r() * 4, -6.8 - r() * 1.2, 2.2 + r() * 1]);
  // tufts at the branch tips: where iguanas pop out
  for (const br of BRANCHES) pads.push([br.b[0] + Math.sign(br.b[0]) * 0.9, br.b[1] + 0.4, br.b[2] - 0.2, 1.25]);
  pads.forEach(([x, y, z, s], i) => {
    const pad = leafyCushion(s, 40 + i, tints[i % 4]);
    pad.position.set(x, y, z);
    pad.scale.y = 0.8;
    g.add(pad);
  });
  scene.add(bake(g));
}

// The patio house is a house-maker house (colonial-house.js) like every
// other street house, with the zinc roof the iguanas walk on. Its front eave
// sits exactly on ROOF's plane; the maker's 3.6 m minimum storey is sunk
// below the patio wall, where the camera never sees it.
function house(scene) {
  const height = 3.6, depth = 4.5, cx = (ROOF.x0 + ROOF.x1) / 2;
  const g = colonialHouse({ seed: 7, family: 'casa-baja', floors: 1, width: ROOF.x1 - ROOF.x0 - 0.4, depth, floorHeight: height,
    roof: 'zinc', palette: 'crema', wallColor: 0xf2c9a0, wallFinish: 'ladrillo-visto', planting: 'ventanas' });
  const spec = g.userData.houseSpec, top = spec.base + height;
  g.position.set(cx, ROOF.front[0] - top, ROOF.front[1] - depth / 2);
  // loose planks weighing the zinc down, lying on the roof plane
  const pitch = (ROOF.ridge[0] - ROOF.front[0]) / (ROOF.front[1] - ROOF.ridge[1]);
  for (let i = 0; i < 4; i++) {
    const z = ROOF.front[1] - 0.6 - i * 0.5, plank = box(0.9, 0.02, 0.5, M(0x9a6a44, { roughness: 1 }));
    plank.position.set(cx - 3 + i * 2.3, ROOF.front[0] + (ROOF.front[1] - z) * pitch + 0.09, z); plank.rotation.x = Math.atan(pitch);
    scene.add(plank);
  }
  scene.add(bake(g));
}

function bloqueWall(scene) {
  const tex = bloqueTexture();
  tex.repeat.set((WALL.x1 - WALL.x0) / 1.6, WALL.top / 0.8);
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const w = mesh(new THREE.BoxGeometry(WALL.x1 - WALL.x0, WALL.top, 0.3), face, (WALL.x0 + WALL.x1) / 2, WALL.top / 2, WALL.z - 0.15);
  scene.add(w);
  scene.add(box(WALL.x1 - WALL.x0 + 0.2, 0.08, 0.42, M(0x9d978e, { roughness: 1 }), (WALL.x0 + WALL.x1) / 2, WALL.top - 0.04, WALL.z - 0.15));
}

function guavaAndHammock(scene, r) {
  const g = new THREE.Group();
  const tx = -11.6, tz = -6.4;
  g.add(branch([tx, 0, tz], [tx + 0.3, 3.4, tz], 0.24, 0.13, paleBark));
  g.add(branch([tx + 0.2, 2.4, tz], [tx + 1.4, 3.8, tz + 0.3], 0.12, 0.05, paleBark));
  for (let i = 0; i < 6; i++) {
    const pad = leafyCushion(1.1 + r() * 0.4, 90 + i, i % 2 ? 0x5a9a3f : 0x6aa64a);
    pad.position.set(tx + (r() - 0.5) * 2.6, 3.9 + r() * 1.3, tz + (r() - 0.5) * 1.4);
    g.add(pad);
  }
  for (let i = 0; i < 5; i++) {
    const m = makeMango();
    m.scale.setScalar(0.22);
    m.traverse((o) => { if (o.material?.color) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(0xc8f0a0)); } });
    m.position.set(tx + (r() - 0.5) * 2.2, 3.5 + r() * 0.6, tz + 0.7);
    g.add(m);
  }
  // the hammock: a post, and a striped cloth sagging between it and the guayabo
  const px = -7.2;
  g.add(box(0.2, 2.3, 0.2, M(0x7a5232, { roughness: 1 }), px, 1.15, tz));
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    pts.push(new THREE.Vector3(tx + 0.3 + (px - tx - 0.3) * k, 2.1 - Math.sin(k * Math.PI) * 1.0, tz));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const stripes = document.createElement('canvas');
  stripes.width = 64; stripes.height = 8;
  const sg = stripes.getContext('2d');
  ['#e8433b', '#ffc629', '#2f8fd8', '#4ab05a', '#f08a2b'].forEach((c, i, all) => { sg.fillStyle = c; sg.fillRect((i * 64) / all.length, 0, 64 / all.length + 1, 8); });
  const st = new THREE.CanvasTexture(stripes);
  st.colorSpace = THREE.SRGBColorSpace;
  st.wrapS = THREE.RepeatWrapping;
  st.repeat.set(3, 1);
  // a flattened tube reads as a sagging cloth, wide and thin
  const tube = new THREE.TubeGeometry(curve, 24, 0.12, 10);
  const tp = tube.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setZ(i, tz + (tp.getZ(i) - tz) * 4.5);
  tube.computeVertexNormals();
  const cloth = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ map: st, roughness: 1, side: THREE.DoubleSide }));
  cloth.castShadow = true;
  scene.add(cloth);
  scene.add(bake(g));
}

function bushes(scene, r) {
  const g = new THREE.Group();
  for (let x = -12.5; x <= 12.5; x += 1.9) {
    const b = bush({ seed: Math.floor(x * 7 + 50), flowers: r() < 0.4 });
    b.position.set(x + (r() - 0.5) * 0.6, 0, BUSHES.z + (r() - 0.5) * 0.5);
    b.scale.setScalar(1.05 + r() * 0.3);
    b.rotation.y = r() * 6;
    g.add(b);
  }
  scene.add(bake(g));
}

// ---------- the module ----------
export default {
  id: 'chinazo',
  title: '¡Chinazo!',
  howto: 'Las iguanas se están comiendo los mangos. Apunta, estira la china y suéltala: la piedra tarda un poquito, así que apunta adelante de las que corren. Cada iguana vale 1 y la dorada vale 3. ¡Ojo con la guacamaya: te quita 2!',
  keys: [['Ratón', 'apuntar'], ['Clic', 'estirar y soltar'], ['WASD + Espacio', 'sin ratón']],
  icon: 'iguana',
  input: 'aim',
  aspect: 16 / 9,   // the sim tests hits through its own copy of this camera, the same on every screen
  time: CHINAZO.time,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: 0xc9b49a, decor: false });
    stage.sun.position.set(-8, 24, 14);
    Object.assign(stage.sun.shadow.camera, { left: -18, right: 18, top: 16, bottom: -6 });
    const r = rng(57);
    mangoTree(scene, r);
    bloqueWall(scene);
    house(scene);
    guavaAndHammock(scene, r);
    bushes(scene, r);
    const puffs = new Puffs(scene);

    const camera = new THREE.PerspectiveCamera(CAMERA.fov, (ctx.aspect || innerWidth / innerHeight), 0.1, 400);
    camera.position.set(...CAMERA.pos);
    camera.lookAt(...CAMERA.look);

    const humans = new Set(ctx.players.filter((p) => p.human && !ctx.auto).map((p) => p.i));
    const sim = chinazoSim({ humans, random, aspect: camera.aspect, count: ctx.players.length });
    const seats = seatsFor(ctx.players.length);

    // the panas in a row, backs to us, each with a china
    const actors = makeActors(scene, ctx.players);
    actors.forEach((a, i) => {
      [a.x, a.y, a.z] = seats[i];
      a.pana.group.rotation.y = Math.PI;
      a.china = china();
      a.china.scale.setScalar(4);
      a.china.rotation.x = Math.PI / 2;
      a.china.position.set(0, -1.02, 0.08);
      a.pana.armL.add(a.china);
      a.pull = 0;
      a.cheer = 0;
      // this close to the camera the usual bubbles would cover the tree
      a.talk = new THREE.Group();
      a.talk.scale.setScalar(0.5);
      scene.remove(a.bubble.sprite);
      a.talk.add(a.bubble.sprite);
      scene.add(a.talk);
    });

    // mangos on the tree: knock one and it plops down
    const mangos = MANGOS.map((pos) => {
      const m = makeMango();
      m.scale.setScalar(0.55);
      m.position.set(...pos);
      m.rotation.z = (r() - 0.5) * 0.5;
      scene.add(m);
      return { m, vy: 0, falling: false };
    });

    const stoneGeo = new THREE.IcosahedronGeometry(0.11, 0);
    const stoneMats = ctx.players.map((p) => new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.6, emissive: p.color, emissiveIntensity: 0.25 }));
    const stones = new Map();
    const lizards = new Map();   // sim iguana → { g, pose, gone }
    const birds = new Map();
    const tumbling = [];         // hit iguanas flipping into the bushes
    const fallen = [];           // mangos and feathers on their way down
    const banner = makeBubble();
    banner.sprite.position.set(0, 9.6, -2);
    banner.sprite.scale.set(6, 2.2, 1);
    scene.add(banner.sprite);
    let time = 0, outroT = 0;

    const tmp = { m: new THREE.Matrix4(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
    function orient(obj, fwd, upv) {
      tmp.z.set(...fwd).normalize();
      tmp.y.set(...upv);
      tmp.y.addScaledVector(tmp.z, -tmp.y.dot(tmp.z)).normalize();
      tmp.x.crossVectors(tmp.y, tmp.z);
      tmp.m.makeBasis(tmp.x, tmp.y, tmp.z);
      obj.quaternion.setFromRotationMatrix(tmp.m);
    }

    function lizard(ig) {
      let l = lizards.get(ig);
      if (!l) {
        const g = iguana({ seed: ig.seed, golden: ig.golden, color: pick([0x5fae3c, 0x6cb543, 0x58a046, 0x7a9f3e]) });
        g.scale.setScalar(S);
        scene.add(g);
        l = { g, pose: null };
        lizards.set(ig, l);
      }
      return l;
    }
    function dropLizard(ig) {
      const l = lizards.get(ig);
      if (!l) return;
      scene.remove(l.g);
      l.g.userData.dispose();
      lizards.delete(ig);
    }

    function handle(e) {
      const a = actors[e.seat];
      const mine = e.seat != null && humans.has(e.seat);
      if (e.type === 'shot') {
        const m = new THREE.Mesh(stoneGeo, stoneMats[e.seat]);
        m.position.set(...e.stone.from);
        scene.add(m);
        stones.set(e.stone, m);
        a.snap = 0.25;
        sound.sweep(mine ? 820 : 640, mine ? 320 : 260, 0.09, 'triangle', mine ? 0.09 : 0.03);
      } else if (e.type === 'hit') {
        const ig = e.iguana, l = lizards.get(ig);
        if (l) tumbling.push({ l, ig, t: 0, vy: 2.6, p: l.g.position.clone(), floor: l.g.position.z > BUSHES.z - 1.5 && l.g.position.z < BUSHES.z + 1 ? BUSHES.top - 0.3 : 0.02 });
        lizards.delete(ig);
        sound.bonk(mine ? 0.9 : 0.5);
        const at = new THREE.Vector3(...sim.bodyAt(ig.hit.state));
        puffs.spawn(at, { color: ig.golden ? 0xffd23f : 0xffffff, count: ig.golden ? 10 : 5, spread: 0.9, size: 0.45, rise: 1.4, life: 0.5 });
        a.cheer = 0.9;
        if (ig.golden) { a.bubble.say('¡DE ORO!', 1); sound.horn('fiesta'); }
        else if (random() < (mine ? 0.5 : 0.25)) a.bubble.say(pick(['¡Chinazo!', '¡Bonk!', '¡Toma!', '¡Fuera, iguana!']), 0.8);
        if (mine) sound.pickup();
      } else if (e.type === 'bird') {
        const b = birds.get(e.bird);
        if (b) {
          b.bubble.say(pick(['¡CUAC!', '¡Grosero!', '¡Epa!']), 1.2);
          puffs.spawn(b.g.position.clone().setY(b.g.position.y + 1.1), { color: pick([0xcd3d30, 0xe6b73d, 0x286bb3]), count: 8, spread: 1, size: 0.3, rise: -0.6, life: 1 });
        }
        sound.sweep(1900, 900, 0.16, 'sawtooth', 0.07);
        sound.sweep(2100, 1100, 0.14, 'sawtooth', 0.06);
        a.bubble.say(pick(['¡Ay, la guacamaya!', '¡Perdón!', '¡Uy!']), 1);
      } else if (e.type === 'mango') {
        const mg = mangos[e.mango.i];
        mg.falling = true;
        sound.plop();
        if (mine) a.bubble.say('¡Plop!', 0.6);
      } else if (e.type === 'miss') {
        const to = new THREE.Vector3(...e.stone.to);
        puffs.spawn(to, { color: to.y > 4.5 ? 0x5a9a3f : 0xb8a58c, count: 3, spread: 0.5, size: 0.3, rise: 0.4, life: 0.4 });
      } else if (e.type === 'spawn') {
        if (e.iguana.path.kind === 'caida') {
          // the leaves rustle where it's about to drop
          const st = e.iguana.path.at(RUSTLE);
          puffs.spawn(new THREE.Vector3(st.pos[0], st.pos[1] + 0.6, st.pos[2]), { color: 0x4f9b48, count: 7, spread: 1.4, size: 0.5, rise: 0.3, life: RUSTLE + 0.2 });
          sound.sweep(300, 500, 0.25, 'triangle', 0.02);
        }
        if (e.iguana.golden) sound.tone(1320, 0, 0.12, 'triangle', 0.06);
      } else if (e.type === 'escape') {
        dropLizard(e.iguana);
      } else if (e.type === 'birdIn') {
        const g = scarletMacaw({ seed: e.bird.id });
        g.scale.setScalar(1.25);
        scene.add(g);
        const bubble = makeBubble();
        scene.add(bubble.sprite);
        birds.set(e.bird, { g, bubble, flee: 0 });
      } else if (e.type === 'reloaded') {
        if (mine) sound.tone(700, 0, 0.05, 'square', 0.04);
      } else if (e.type === 'plaga') {
        banner.say('¡PLAGA!', 2);
        sound.horn('fiesta');
        for (const b of actors) b.bubble.say(pick(['¡Son muchas!', '¡La plaga!', '¡Ay, mis mangos!']), 1.2);
      }
    }

    function drawWorld(dt) {
      // iguanas still on their paths
      for (const ig of sim.iguanas) {
        if (!sim.live(ig)) continue;
        const st = sim.stateOf(ig);
        const l = lizard(ig);
        l.g.visible = !st.hidden;
        if (st.hidden) continue;
        if (st.pose !== l.pose) { l.g.userData.pose(st.pose); l.pose = st.pose; }
        l.g.position.set(...st.pos);
        orient(l.g, st.fwd, st.up);
        if (st.spin) l.g.rotateZ(st.spin);
        l.g.userData.tick(time + ig.seed);
        if (st.pose === 'run') l.g.userData.run(st.gait);
        if (ig.golden && random() < dt * 6) puffs.spawn(l.g.position.clone().add(new THREE.Vector3(0, 0.5, 0)), { color: 0xffe066, count: 1, spread: 1, size: 0.2, rise: 0.8, life: 0.5 });
      }
      // bonked ones: a pop, a flip with stars on the way down, then off they go
      for (let k = tumbling.length - 1; k >= 0; k--) {
        const tb = tumbling[k], g = tb.l.g;
        tb.t += dt;
        if (tb.p.y > tb.floor) {
          tb.vy -= 22 * dt;
          tb.p.y = Math.max(tb.floor, tb.p.y + tb.vy * dt);
        }
        const k1 = Math.min(1, tb.t / 1.3);
        if (tb.t < 1.3) {
          g.position.copy(tb.p);
          g.quaternion.slerp(new THREE.Quaternion(), Math.min(1, dt * 8));
          g.userData.pose('perch');
          g.userData.bonk(k1);
          g.userData.tick(time);
        } else {
          // offended, it scurries away along the ground
          if (!tb.run) { tb.run = random() < 0.5 ? -1 : 1; g.userData.bonk(1); g.userData.pose('run'); }
          g.rotation.set(0, tb.run * Math.PI / 2, 0);
          tb.p.x += tb.run * 5 * dt;
          g.position.copy(tb.p);
          g.userData.run(tb.t * 30);
          g.userData.tick(time);
          if (tb.t > 2.4) { scene.remove(g); g.userData.dispose(); tumbling.splice(k, 1); }
        }
      }
      // the guacamaya
      for (const [b, v] of birds) {
        const s = time - b.born;
        if (s > b.path.dur + 1.5) { scene.remove(v.g); scene.remove(v.bubble.sprite); birds.delete(b); continue; }
        const st = b.path.at(Math.min(s, b.path.dur + 1.5));
        if (b.hit) {
          v.flee += dt;
          v.g.position.y += (3 + v.flee * 6) * dt;
          v.g.position.x += st.fwd[0] * 9 * dt;
        } else v.g.position.set(st.pos[0], st.pos[1] - 1.1 * 1.25, st.pos[2]);
        v.g.rotation.set(0, Math.atan2(st.fwd[0], st.fwd[2]), b.hit ? -st.fwd[0] * 0.4 : 0);
        v.g.userData.tick(time * (b.hit ? 2 : 1));
        v.bubble.sprite.position.copy(v.g.position).add(new THREE.Vector3(0, 3.2, 0));
        v.bubble.update(dt);
      }
      // stones in flight, with a slight arc
      for (const [s, m] of stones) {
        if (s.done) {
          scene.remove(m);
          stones.delete(s);
          if (!s.hit) {
            const to = new THREE.Vector3(...s.to);
            fallen.push({ m, v: new THREE.Vector3(0, -1, 0), floor: 0.05, life: 1 });
            m.position.copy(to);
            scene.add(m);
          }
          continue;
        }
        const k = Math.min(1, s.t / s.dur);
        m.position.set(...s.from.map((v, i) => v + (s.to[i] - v) * k));
        m.position.y += Math.sin(k * Math.PI) * (0.9 - s.power * 0.4);
        m.rotation.x += dt * 20;
      }
      // mangos knocked down, and stray stones
      for (const mg of mangos) {
        if (!mg.falling) continue;
        mg.vy -= 18 * dt;
        mg.m.position.y += mg.vy * dt;
        mg.m.rotation.z += dt * 6;
        if (mg.m.position.y < 0.3) {
          mg.falling = false;
          mg.m.visible = false;
          puffs.spawn(mg.m.position.clone().setY(0.4), { color: 0xffae2b, count: 6, spread: 0.8, size: 0.5, rise: 1, life: 0.6 });
          sound.splat();
        }
      }
      for (let k = fallen.length - 1; k >= 0; k--) {
        const f = fallen[k];
        f.v.y -= 20 * dt;
        f.m.position.addScaledVector(f.v, dt);
        f.life -= dt;
        if (f.m.position.y < f.floor || f.life <= 0) { scene.remove(f.m); fallen.splice(k, 1); }
      }
      banner.update(dt);
      puffs.update(dt);
      stage.update(time);
    }

    function drawPanas(dt, winners) {
      for (const a of actors) {
        const sh = sim.shooters[a.i];
        const pullK = sh.pulling ? Math.min(1, sh.holdT / CHINAZO.fullPull) : 0;
        a.pull += (pullK - a.pull) * Math.min(1, dt * 18);
        a.snap = Math.max(0, (a.snap || 0) - dt);
        a.cheer = Math.max(0, a.cheer - dt);
        const win = winners?.includes(a.i);
        a.y = win ? Math.abs(Math.sin(time * 6)) * 0.6 : a.cheer > 0 ? Math.abs(Math.sin(a.cheer * 8)) * 0.18 : 0;
        a.pana.group.position.set(a.x, a.y, a.z);
        a.pana.update(dt, { open: a.cheer > 0 || win, look: 0 });
        // the left hand holds the china out at the reticle; the right one draws it back
        const yaw = -sh.aim.x * 0.45, pitch = sh.aim.y * 0.35;
        a.pana.group.rotation.y = Math.PI + yaw;
        if (winners) {
          a.pana.armL.rotation.set(win ? -2.6 : -0.6, 0, 0.3);
          a.pana.armR.rotation.set(win ? -2.6 : -0.6, 0, -0.3);
          a.china.userData.pull(0);
        } else if (sh.reload > 0) {
          // a hand in the pocket for more mamones
          a.pana.armL.rotation.set(-1.0, 0, 0.25);
          a.pana.armR.rotation.set(0.25 + Math.sin(time * 18) * 0.12, 0, -0.15);
          a.china.userData.pull(0);
        } else {
          // arms up toward the tree (and out to the side) so the china shows past the head
          a.pana.armL.rotation.set(-2.15 - pitch, 0, 0.5);
          a.pana.armR.rotation.set(-2.05 - pitch + a.pull * 0.8 - a.snap * 1.2, 0, -0.2 - a.pull * 0.25);
          a.china.userData.pull(a.pull);
        }
        a.talk.position.set(a.x, a.y + 2.5, a.z);
        a.bubble.update(dt);
      }
    }

    function update(dt, input) {
      time += dt;
      sim.cam.aspect = camera.aspect;
      const inputs = [];
      for (const i of humans) inputs[i] = inputFor(input, i);
      sim.update(dt, inputs);
      for (const e of sim.events) handle(e);
      sim.events.length = 0;
      drawWorld(dt);
      drawPanas(dt, null);
    }

    function outro(dt, winners) {
      time += dt;
      outroT += dt;
      // the iguanas still out there get away, unhurried
      for (const ig of sim.iguanas) if (sim.live(ig)) { ig.gone = time; dropLizard(ig); }
      for (const b of sim.birds) b.hit = b.hit || { seat: -1 };
      drawWorld(dt);
      drawPanas(dt, winners);
    }

    return {
      scene, camera, update, outro, actors, sim,
      scores: sim.scores, winners: sim.winners, stats: sim.stats,
      reticles: () => sim.shooters.map((sh) => ({
        x: sh.aim.x, y: sh.aim.y, color: ctx.players[sh.i].color, me: sh.i === (ctx.localIndex ?? 0),
        pull: sh.pulling ? Math.min(1, sh.holdT / CHINAZO.fullPull) : 0,
        ammo: sh.reload > 0 ? 0 : sh.ammo, max: CHINAZO.ammo,
      })),
    };
  },
};
