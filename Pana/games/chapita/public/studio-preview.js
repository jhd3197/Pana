// Studio's chapita-jugada-<id> pages: a compact street with a pitcher (blue),
// a batter (red), a fielder, el abuelo and the señora, playing one jugada on
// a loop with a short lead-in (the pitch, the contact, the flight). It samples
// the very same jugada-motion.js the live game plays, so tuning it here
// changes the game.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar, randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { CAR_BUILDERS } from '/engine/models/vehicles/cars.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { createChapita, createPalo, createSenoraWindow, createAlcantarilla, createPeriodico } from './studio-set.js';
import { createJugadaFx } from './jugada-fx.js';
import { createJugadas, DURATION } from './jugada-motion.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WALL = -11, WALL_TOP = 3.6;
// Where the batted cap goes before each jugada, and when the jugada starts:
// after the flight (2), right at the plate (1) or straight away (0).
const LEAD = {
  window: [V(1.4, 1.9, WALL + .1), 2], dog: [V(2.4, .05, -5.5), 2], roof: [V(.4, WALL_TOP + .1, WALL + .2), 2], drain: [V(1, .05, -2.6), 2],
  pinball: [V(3.2, 2.4, -9.3), 2], grandpa: [V(4.4, 1.6, -5), 2], home: [V(0, 6, -16), 2], catch: [V(-2.2, 1.2, -5), 2],
  miss: [null, 1], helicopter: [null, 1], pitch: [null, 1], argue: [null, 1], slip: [null, 1], boomerang: [null, 1], bean: [null, 1],
  hit: [V(1, 2, -6), 1], broken: [V(.6, .05, -3), 1], swing: [null, .8], car: [null, 0], dinner: [null, 0], dance: [null, 0],
};

const pana = (look) => buildCharacter(normalizeAvatar({ ...randomAvatar(rng(look.seed)), outfit: 'franela', ...look }));

export function createChapitaJugadaPreview({ jugada = 'hit' } = {}) {
  const root = new THREE.Group(); root.name = `Jugada · ${jugada}`;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 22), new THREE.MeshStandardMaterial({ color: '#8f9192', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -4; ground.receiveShadow = true; root.add(ground);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(14, .5, 1.2), new THREE.MeshStandardMaterial({ color: '#d8cfbf', roughness: 1 }));
  curb.position.set(0, .25, WALL + .6); root.add(curb);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, WALL_TOP, .4), new THREE.MeshStandardMaterial({ color: '#f2a65a', roughness: .9 }));
  wall.position.set(0, WALL_TOP / 2, WALL - .2); root.add(wall);
  if (['window', 'dinner'].includes(jugada)) { const win = createSenoraWindow(); win.position.set(1.4, 1.9 - 1.95, WALL + .02); root.add(win); }
  if (jugada === 'drain') { const drain = createAlcantarilla(); drain.position.set(3, .005, -2.6); root.add(drain); }
  // Only what this jugada uses: every page is a full scene, and Studio opens many.
  const needs = (...ids) => ids.includes(jugada);
  const parked = needs('pinball') ? CAR_BUILDERS.familiar(randomAvatar(rng(9))) : null;
  if (parked) { parked.driver?.group && (parked.driver.group.visible = false); parked.root.position.set(-3.6, 0, -9.3); parked.root.rotation.y = Math.PI / 2; parked.root.scale.setScalar(.8); root.add(parked.root); }
  const passing = needs('car') ? CAR_BUILDERS.chamo(randomAvatar(rng(8))) : null;
  if (passing) { passing.root.visible = false; root.add(passing.root); }

  const pitcher = pana({ seed: 3, outfitColor: '#2f7fe0' }), batter = pana({ seed: 7, outfitColor: '#e8453c' });
  const fielder = needs('catch', 'dog', 'roof', 'car', 'dance') ? pana({ seed: 11, outfitColor: '#2f7fe0' }) : null;
  const abuelo = needs('grandpa') ? buildCharacter(normalizeAvatar({ ...randomAvatar(rng(5)), hat: 'llanero', fur: '#d4914f', outfit: 'franela', outfitColor: '#f3e9d7' }), { seated: true }) : null;
  const senora = needs('window', 'dinner') ? buildCharacter(normalizeAvatar({ fur: '#e0a463', hat: 'lana', hatColor: '#ff6fae', outfit: 'hawaiana', outfitColor: '#ff6fae', face: 'wow', glasses: 'redondos' })) : null;
  const cast = [pitcher, batter, fielder, abuelo, senora].filter(Boolean); cast.forEach(c => root.add(c.group));
  if (abuelo) { const paper = createPeriodico(); paper.scale.setScalar(1.7); paper.position.set(0, 2.1, 1.2); abuelo.body.add(paper); }
  const HOME = { pitcher: [V(0, 0, -6.5), 0], batter: [V(-.8, 0, .15), Math.PI / 2], fielder: [V(-2.2, 0, -6.2), .4], abuelo: [V(4.6, .5, -5.4), -Math.PI / 2], senora: [V(1.4, .25, WALL + .4), 0] };
  const palo = createPalo({ kind: 'escoba' }); palo.scale.setScalar(1.35); palo.position.set(0, -.7, .05); batter.armR.add(palo);
  const cap = createChapita({ brand: 'kolita' }); cap.scale.setScalar(1.8); root.add(cap);

  const fxMain = createJugadaFx(root), fxContact = createJugadaFx(root);
  const main = createJugadas(root, { fx: fxMain }), contact = createJugadas(root, { fx: fxContact });
  const [land, startAt] = LEAD[jugada] || [null, 1], length = (DURATION[jugada] === Infinity ? 5.4 : DURATION[jugada] || 2) + startAt + .6;
  let last = Infinity;

  function pose(t) {
    for (const [name, ch] of [['pitcher', pitcher], ['batter', batter], ['fielder', fielder], ['abuelo', abuelo], ['senora', senora]]) {
      if (!ch) continue; const [at, yaw] = HOME[name]; ch.group.position.copy(at); ch.group.rotation.set(0, yaw, 0); ch.update(1 / 60, {});
    }
    if (senora) senora.group.visible = t >= startAt;
    abuelo?.arms.forEach((arm, i) => arm.rotation.set(-1.3, 0, i ? -.28 : .28));
    fielder?.arms.forEach((arm, i) => arm.rotation.set(-.15, 0, i ? -.35 : .35));
    // The batter's stance and swing; the pitcher's wind-up and throw.
    const s = Math.min(1, Math.max(0, (t - .8) / .3)), w = Math.min(1, t / .5);
    batter.armR.rotation.set(-1.9 + s * 1.2, 0, -.6 + s * .9); batter.armL.rotation.set(-1.7 + s * 1.1, 0, .9 - s * .5);
    batter.group.rotation.y = Math.PI / 2 + (s > 0 ? Math.sin(Math.min(1, s * 1.6) * Math.PI / 2) * 1.9 - .2 : -.2);
    palo.rotation.set(Math.PI / 2 - .2 + s * 1.3, 0, 0);
    pitcher.armR.rotation.set(-2.6 * (1 - w) - .4 * w, 0, -.3); pitcher.armL.rotation.set(-.8, 0, .4);
    root.updateMatrixWorld(true);
  }
  function capAt(t) {
    const hand = pitcher.armR.localToWorld(V(0, -.86, 0)), plate = V(0, 1, -.4);
    if (t < .5) return hand;
    if (t < 1 || !land) return hand.lerp(plate, Math.min(1.2, (t - .5) / .5));
    const q = Math.min(1, (t - 1) / Math.max(.01, startAt - 1)), p = plate.clone().lerp(land, q); p.y += Math.sin(q * Math.PI) * 2.2; return p;
  }
  const ctx = () => ({
    pitcher, batter, fielder, victim: jugada === 'bean' ? batter : null, abuelo, palo, paloKind: 'escoba', hbp: jugada === 'bean',
    crew: (jugada === 'dance' ? [[batter, 0], [fielder, 0], [pitcher, 0]] : [[batter, -1], [pitcher, 1], [fielder, -1]]).filter(([ch]) => ch),
    contact: V(-.8, 1, -.45), land: land?.clone() || V(0, 1, -.4).add(V(0, 0, 2)), big: jugada === 'home', diveSide: 1,
    batterHome: HOME.batter[0].clone(), pitcherHome: HOME.pitcher[0].clone(), homes: new Map([[pitcher, HOME.pitcher[0]], [batter, HOME.batter[0]], ...(fielder ? [[fielder, HOME.fielder[0]]] : [])]),
    window: V(1.4, 1.9, WALL + .1), wall: WALL, wallTop: WALL_TOP, drain: V(3, .05, -2.6), door: V(-5, 0, 2),
    bounceWall: V(-1.2, 2.2, WALL + .2), carTop: V(-3.6, 1.4, -9.3), curb: 3,
    passing: passing?.root || null, carFrom: V(1.2, 0, -16), carTo: V(1.2, 0, 8),
    capNow: () => cap.position.clone(), sound: false,
  });

  root.userData.tick = (time) => {
    const t = time % length;
    if (t < last) { main.stop(); contact.stop(); }
    last = t;
    pose(t);
    let point = capAt(t);
    if (['hit', 'broken', 'swing'].includes(jugada) || land && startAt > 1) {
      const name = ['hit', 'broken', 'swing'].includes(jugada) ? jugada : 'hit', at = jugada === 'swing' ? .8 : 1;
      if (t >= at) { if (!contact.active && t < at + .2) contact.start(name, ctx()); const out = contact.sample(t - at); if (out.cap) point = out.cap; if (out.done) contact.stop(); }
    }
    if (!['hit', 'broken', 'swing'].includes(jugada) && t >= startAt) {
      if (!main.active && t < startAt + .2) main.start(jugada, ctx());
      if (main.active) { const out = main.sample(t - startAt); if (out.cap) point = out.cap; if (out.hideCap) point = null; }
    }
    cap.visible = !!point; if (point) { cap.position.copy(point); cap.rotation.y = time * 18; }
  };
  root.userData.tick(0);
  root.userData.previewBounds = [[-6, 0, -12], [6, 4.5, 3]];
  root.userData.dispose = () => {
    main.dispose(); contact.dispose(); fxMain.dispose(); fxContact.dispose();
    cast.forEach(c => c.dispose()); passing?.root.userData.dispose?.(); parked?.root.userData.dispose?.();
    disposeModel(root);
  };
  return root;
}
