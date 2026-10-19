import { random, inputFor } from '../online-rules.js';
// ¡Remolino! A whirlpool grows in the middle of a laguna. Paddle in rhythm to
// stay out of its eye and use Space to shove a neighbour toward it. The last
// curiara outside the eye wins. Canoes point away from the eye on their own.

import * as THREE from 'three';
import { sound, Puffs } from '/engine/fx.js';
import { waterPool } from '/engine/models/effects/water-surface.js';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { reeds } from '/engine/models/vegetation/reeds.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { sunnyStage, pick, rand } from './stage.js';
import { canoeActors, drawCanoe } from './river-stage.js';
import { remolinoSim, REMOLINO } from './river-sims.js';

// The eye: spiral arms of foam around a dark centre, scaled with the sim.
function whirlpool() {
  const geo = new THREE.CircleGeometry(1, 64); geo.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, eye: { value: .3 } },
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float time; uniform float eye; varying vec2 vP;
      void main(){ float r=length(vP),a=atan(vP.y,vP.x);
        float arms=pow(max(0.,sin(a*3.+r*12.-time*4.)),4.)*(1.-smoothstep(.8,1.,r));
        float hole=1.-smoothstep(eye*.8,eye,r);
        vec3 col=mix(vec3(.93,.97,.95),vec3(.03,.05,.05),hole);
        float alpha=max(arms*.75*smoothstep(eye*.9,eye*1.3,r),hole*.92);
        if(alpha<.01)discard; gl_FragColor=vec4(col,alpha); }` });
  const mesh = new THREE.Mesh(geo, material); mesh.renderOrder = 2; return mesh;
}

export default {
  id: 'remolino',
  title: '¡Remolino!',
  howto: 'Un remolino crece en la laguna y te jala. Rema alternando A y D para alejarte del centro y empuja a los demás con Espacio. ¡Gana el último que quede fuera!',
  keys: [['A D / ← →', 'remar alternando'], ['Espacio', '¡salpicón! empuja al de al lado']],
  touch: { action: 'Salpicón' },
  icon: 'whirl',
  time: REMOLINO.time,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene, { ground: null, grass: true, decor: false, horizon: 0xd5e6d6 });
    const puffs = new Puffs(scene);
    const pool = waterPool(REMOLINO.lagoon + 3.5, REMOLINO.lagoon + 3.5, { color: 0x3d6e5c, depth: 4 }); pool.position.y = .05; scene.add(pool);
    const swirl = whirlpool(); swirl.position.y = .09; scene.add(swirl);
    const palms = [], rushes = [];
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + rand(-.05, .05); palms.push({ x: Math.cos(a) * rand(20, 30), y: 0, z: Math.sin(a) * rand(20, 30), rot: rand(0, 6), scale: rand(.8, 1.2) }); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; rushes.push({ x: Math.cos(a) * (REMOLINO.lagoon + rand(2.5, 4)), y: 0, z: Math.sin(a) * (REMOLINO.lagoon + rand(2.5, 4)), rot: rand(0, 6), scale: rand(.7, 1.1) }); }
    instancePlacements(scene, moriche({ seed: 31, h: 11 }), palms, { name: 'Morichal de la laguna', castShadow: false });
    instancePlacements(scene, reeds({ seed: 32 }), rushes, { name: 'Juncos de la laguna', castShadow: false });
    const camera = new THREE.PerspectiveCamera(50, (ctx.aspect || innerWidth / innerHeight), .1, 400);
    camera.position.set(0, 23, 19); camera.lookAt(0, 0, 1.5);
    const humans = new Set(ctx.players.filter(p => p.human && !ctx.auto).map(p => p.i));
    const sim = remolinoSim({ humans, random, count: ctx.players.length });
    const actors = canoeActors(scene, ctx.players);
    const seen = actors.map(() => ({ shoves: 0, shoved: 0, out: null, strokes: 0 }));
    let time = 0;

    function draw(dt) {
      swirl.scale.setScalar(Math.max(sim.eye() * 1.9, 4)); swirl.material.uniforms.eye.value = sim.eye() / Math.max(sim.eye() * 1.9, 4); swirl.material.uniforms.time.value = time;
      for (const a of actors) {
        const c = sim.canoes[a.i];
        let r = c.r, y = 0, capsized = 0;
        // Taken by the eye: spin down and under.
        if (c.out != null) { const k = Math.min(1, (time - c.out) / 1.5); r = c.r * (1 - k); y = -k * 2.4; capsized = 1.2; }
        const x = Math.cos(c.a) * r, z = Math.sin(c.a) * r;
        drawCanoe(a, dt, time, { x, y, z, h: Math.atan2(x, z) + (c.out != null ? time * 6 : 0), paddle: c.paddle, capsized, splashAt: c.shoveAt ?? -9, splashSide: 1 });
        a.canoe.group.visible = y > -2.3;
      }
      stage.update(time); pool.userData.tick?.(time); puffs.update(dt);
    }
    function update(dt, input) {
      time += dt;
      const inputs = []; for (const i of humans) inputs[i] = inputFor(input, i);
      sim.update(dt, inputs);
      for (const a of actors) {
        const c = sim.canoes[a.i], was = seen[a.i], me = humans.has(a.i), at = new THREE.Vector3(Math.cos(c.a) * c.r, .4, Math.sin(c.a) * c.r);
        if (c.shoves > was.shoves) { c.shoveAt = time; a.bubble.say(pick(['¡Salpicón!', '¡Pa\' dentro!', '¡Toma!']), .7); puffs.spawn(at, { color: 0xffffff, count: 8, spread: 1.4, size: .7 }); if (me) sound.splat(); }
        if (c.shoved > was.shoved) { a.bubble.say(pick(['¡Epa!', '¡Oye!']), .6); if (me) sound.boing(); }
        if (c.out != null && was.out == null) { a.bubble.say(pick(['¡Ayyyy!', '¡Me jala!', '¡Glu glu!']), 1.1); puffs.spawn(at, { color: 0xffffff, count: 12, spread: 1.8, size: .9 }); sound.sweep(500, 90, .5, 'sine', .1); }
        if (me && c.paddle.count > was.strokes && c.paddle.quality === 'remazo') { sound.tone(1180, 0, .045, 'triangle', .07); sound.tone(590, .01, .07, 'sine', .08); }
        Object.assign(was, { shoves: c.shoves, shoved: c.shoved, out: c.out, strokes: c.paddle.count });
      }
      draw(dt);
    }
    function outro(dt, winners) {
      time += dt;
      for (const a of actors) a.cheer = winners.includes(a.i) ? 1 : 0;
      draw(dt);
    }
    // Your shove and who is still afloat, for the runner's hint line.
    const me = actors[ctx.localIndex ?? ctx.players.findIndex(p => p.human && !ctx.auto)];
    function hint() {
      if (!me) return null;
      const c = sim.canoes[me.i], left = `Quedan ${sim.canoes.filter(o => o.out == null).length}`;
      if (c.out != null) return { text: `Te tragó el remolino · ${left}`, tone: 'bad' };
      if (c.cd > 0) return { text: `Rema A D alternando para alejarte · salpicón en ${Math.ceil(c.cd)} s · ${left}`, tone: '' };
      const [x, z] = [Math.cos(c.a) * c.r, Math.sin(c.a) * c.r];
      const near = sim.canoes.some(o => o !== c && o.out == null && Math.hypot(Math.cos(o.a) * o.r - x, Math.sin(o.a) * o.r - z) < REMOLINO.reach + 2 * REMOLINO.radius);
      return near ? { text: `¡Salpicón listo! Espacio empuja al de al lado · ${left}`, tone: 'go' } : { text: `Salpicón listo: acércate a otra curiara · ${left}`, tone: 'ok' };
    }
    return { scene, camera, update, outro, actors, hint, over: sim.over, scores: sim.scores, winners: sim.winners, sim,
      stats: () => ({ out: sim.canoes.map(c => c.out == null ? null : +c.out.toFixed(1)), shoves: sim.canoes.map(c => c.shoves) }) };
  },
};
