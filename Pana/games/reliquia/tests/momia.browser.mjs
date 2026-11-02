// The gaunt mummy (mummy({ gaunt: true }), engine/models/props/gaunt-mummy.js)
// built in a real page: taller and thinner than the classic one, arms down to
// the knees, a low draw count, finite through every kind of motion, and the
// classic mummy every other game uses exactly as it was. Leaves a lineup
// (classic, gaunt idle, chasing, winding) in Pana/games/reliquia/qa.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, base, qaDir } from '../../../tests/browser-kit.js';

const output = qaDir(import.meta.url);
// The classic mummy as it shipped before the gaunt one existed.
const CLASSIC = { draws: 14, shape: 3632567215 };
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><style>body{margin:0;background:#18202a}canvas{display:block;width:1200px;height:700px}</style></head><body><canvas></canvas></body></html>`);
  const info = await page.evaluate(async () => {
    const THREE = await import('three');
    const { mummy } = await import('/engine/models/props/reliquia.js');
    const box = m => { m.updateMatrixWorld(true); return new THREE.Box3().setFromObject(m); };
    const draws = m => { let n = 0; m.traverse(o => { if (o.isMesh && o.visible) n++; }); return n; };
    const shape = m => {
      let hash = 2166136261; m.updateMatrixWorld(true);
      m.traverse(o => { if (!o.isMesh) return; for (const v of [...o.geometry.attributes.position.array, ...o.matrixWorld.elements]) { hash ^= Math.round(v * 10000); hash = Math.imul(hash, 16777619); } });
      return hash >>> 0;
    };
    const classic = mummy(), gaunt = mummy({ gaunt: true, seed: 4 }), guardian = mummy({ guardian: true, gaunt: true });
    const finite = m => { let ok = true; m.traverse(o => { for (const v of o.matrixWorld.elements) ok &&= Number.isFinite(v); }); return ok; };
    const opts = { frozen: false, look: .4, lit: 'dark', scares: 'normal' };
    let allFinite = true;
    for (const [moving, winding, frozen] of [[false, false, false], [true, false, false], [false, true, false], [true, false, true]]) {
      opts.frozen = frozen;
      for (let t = 0; t < 5; t += 1 / 30) { gaunt.userData.animate(t + 100, moving, winding, opts); gaunt.updateMatrixWorld(true); allFinite &&= finite(gaunt); }
    }
    // Rest pose for the measurements.
    const rest = mummy({ gaunt: true, seed: 4 }), b = box(rest), c = box(classic);
    // Fingertips against knees, in world space.
    let hand = Infinity, knee = 0; rest.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    rest.traverse(o => { if (o.isMesh && o.parent?.parent && o.material.vertexColors) { const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (Math.abs(p.x) > .17 && p.y < hand && p.y > .2 && Math.abs(p.x) < .35) hand = p.y; } } });
    // Lineup screenshot.
    const canvas = document.querySelector('canvas'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(1200, 700, false); renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x18202a);
    scene.add(new THREE.HemisphereLight(0x74849e, 0x0c0c10, 1.8)); const key = new THREE.SpotLight(0xe4ebf4, 60, 20, .7, .5, 1.15); key.position.set(0, 3, 6); scene.add(key);
    const chase = mummy({ gaunt: true, seed: 7 }), wind = mummy({ gaunt: true, seed: 9 });
    for (let t = 0; t < 2.3; t += 1 / 30) chase.userData.animate(t, true, false, { look: 0, lit: 'beam' });
    for (let t = 0; t < .6; t += 1 / 30) wind.userData.animate(t, false, true, { look: 0, lit: 'beam' });
    [classic, rest, chase, wind].forEach((m, i) => { m.position.x = -3.3 + i * 2.2; m.rotation.y = i === 2 ? .9 : .3; scene.add(m); });
    const camera = new THREE.PerspectiveCamera(40, 1200 / 700, .1, 50); camera.position.set(0, 1.6, 8.5); camera.lookAt(0, 1.15, 0);
    renderer.render(scene, camera);
    return { gauntH: b.max.y - b.min.y, gauntW: b.max.x - b.min.x, classicH: c.max.y - c.min.y, classicW: c.max.x - c.min.x, floor: b.min.y,
      draws: draws(gaunt), classicDraws: draws(classic), shape: shape(mummy()), guardian: guardian.name, allFinite, hand,
      seeded: shape(mummy({ gaunt: true, seed: 1 })) === shape(mummy({ gaunt: true, seed: 1 })) && shape(mummy({ gaunt: true, seed: 1 })) !== shape(mummy({ gaunt: true, seed: 2 })) };
  });
  console.log(JSON.stringify(info));
  assert.ok(info.gauntH > 2.5 && info.gauntH < 3, `gaunt height ${info.gauntH}`);
  assert.ok(info.gauntH > info.classicH + .1, 'taller than the classic mummy');
  assert.ok(info.gauntW < info.classicW, 'thinner than the classic mummy');
  assert.ok(Math.abs(info.floor) < .08, `stands on the floor (${info.floor})`);
  assert.ok(info.hand < .8, `fingertips near the knees (${info.hand})`);
  assert.ok(info.draws <= 20, `draws ${info.draws}`);
  assert.ok(info.allFinite, 'finite through idle, chase, wind and freeze');
  assert.ok(info.seeded, 'one shape per seed');
  assert.equal(info.guardian, 'Guardián del sol', 'the guardian stays stone and gold');
  // The classic mummy (Embuste, Bululú, Studio) is unchanged.
  assert.equal(info.classicDraws, CLASSIC.draws);
  assert.equal(info.shape, CLASSIC.shape);
  await page.screenshot({ path: path.join(output, 'momia-lineup.png') });
  assert.deepEqual(errors, []);
  console.log('ok  gaunt mummy: tall, thin, low draws, finite motion; classic unchanged');
} finally { await browser.close(); }
