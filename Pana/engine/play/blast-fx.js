// What an explosion, a rocket's exhaust and a rifle's tracer look like: a white
// flash, an orange fireball, a shock ring on the ground, smoke and embers from
// the shared puffs, a smoke trail behind anything flying, and a bright line that
// fades. Visual only: where and when comes from the game's own state.
//
//   const fx = createBlastFx(scene, puffs);              // puffs: engine/fx.js Puffs
//   fx.boom({ x, z, size: 1.2, color });                 // once per new explosion
//   fx.trail(ball.id, mesh.position, dt);                // every frame a rocket flies
//   fx.tracer(from, to, '#fff6d8');                      // a shot's line
//   fx.update(dt);                                       // every frame
import * as THREE from 'three';
import { glowTexture } from '../models/props/glow-paintball.js';

export function createBlastFx(scene, puffs) {
  const glow = glowTexture(), live = [], trails = new Map();
  const ball = new THREE.IcosahedronGeometry(1, 1), ring = new THREE.RingGeometry(.8, 1, 32).rotateX(-Math.PI / 2);
  const line = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
  const additive = (color, map) => new THREE.MeshBasicMaterial({ color, map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  // An effect grows from `from` to `to` scale and fades from `alpha` to 0 over `life` seconds.
  function add(object, { life, from, to, alpha = 1, ease = 2 }) { scene.add(object); live.push({ object, life, age: 0, from, to, alpha, ease }); }

  return {
    // ground: the height of the shock ring (a side-view game passes the impact's own height);
    // front: the ring stands up facing +z instead of lying flat, for a side view.
    boom({ x, z, y = 1, size = 1, color = '#ff9a3d', ground = .08, front = false }) {
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#fff3c8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      flash.position.set(x, y + .2, z); add(flash, { life: .22, from: 2 * size, to: 7.5 * size });
      const fire = new THREE.Mesh(ball, additive('#ff8a2a')); fire.position.set(x, y, z); add(fire, { life: .5, from: .35 * size, to: 2.3 * size, alpha: .9 });
      const core = new THREE.Mesh(ball, additive('#fff0a0')); core.position.set(x, y, z); add(core, { life: .25, from: .3 * size, to: 1.3 * size });
      const shock = new THREE.Mesh(ring, additive('#fff6e0')); shock.position.set(x, ground, z); if (front) shock.rotation.x = Math.PI / 2; add(shock, { life: .45, from: .5, to: 5.5 * size, alpha: .7, ease: 1 });
      const at = { x, y, z };
      puffs.spawn(at, { color: '#5b5752', count: Math.round(12 * size), spread: 1.6 * size, size: 1.2 * size, rise: 1.8, life: 1.7 });
      puffs.spawn(at, { color, count: Math.round(10 * size), spread: 1.2 * size, size: .7, rise: 2.6, life: .9 });
      puffs.spawn(at, { color: '#ffb347', count: 8, spread: .6, size: .25, rise: 4, life: .5 });
    },
    // Smoke left behind a flying object: a puff every 30 ms, a spark now and then.
    trail(id, at, dt) {
      const t = (trails.get(id) || 0) + dt; trails.set(id, t % .03);
      if (t < .03) return;
      puffs.spawn(at, { color: '#d9d4cc', count: 1, spread: .08, size: .35, rise: .25, life: .9 });
      if (Math.random() < .35) puffs.spawn(at, { color: '#ffb347', count: 1, spread: .05, size: .14, rise: .1, life: .2 });
    },
    // The ids still flying; others drop their trail clock.
    keep(ids) { for (const id of trails.keys()) if (!ids.has(id)) trails.delete(id); },
    tracer(from, to, color = '#fff6d8', width = .02) {
      const length = from.distanceTo(to); if (length < .1) return;
      const mesh = new THREE.Mesh(line, additive(color));
      mesh.position.copy(from).lerp(to, .5); mesh.lookAt(to); mesh.scale.set(width, width, length);
      scene.add(mesh); live.push({ object: mesh, life: .28, age: 0, line: true, alpha: .95 });
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i]; e.age += dt; const k = Math.min(1, e.age / e.life);
        if (k >= 1) { e.object.removeFromParent(); e.object.material.dispose(); live.splice(i, 1); continue; }
        if (!e.line) e.object.scale.setScalar(e.from + (e.to - e.from) * (1 - (1 - k) ** e.ease));
        else e.object.scale.x = e.object.scale.y = e.object.scale.x * (1 - dt * 2);
        e.object.material.opacity = e.alpha * (1 - k) ** 1.5;
      }
    },
    get active() { return live.length; },
    dispose() { live.forEach(e => { e.object.removeFromParent(); e.object.material.dispose(); }); live.length = 0; trails.clear(); ball.dispose(); ring.dispose(); line.dispose(); glow.dispose(); },
  };
}
