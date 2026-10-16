// River effects: two pooled draws for the whole field (surface rings and
// airborne spray) plus three static, animated sheets (the chorro's streaks,
// the raudales' whitewater and the remolino's spiral). Same budget idea as
// Galope's pool: fixed sizes, no per-canoe materials, events stay in world space.
import * as THREE from 'three';

export const FX_BUDGET = Object.freeze({ rings: 160, spray: 320, boats: 8, distance: 55 });
const TAU = Math.PI * 2;

const poolVertex = `
  attribute vec3 effect; attribute vec3 velocity;
  varying vec2 vUv; varying vec3 vEffect;
  #include <fog_pars_vertex>
  void main(){
    vUv=uv*2.-1.;vEffect=effect;
    #ifdef SPRAY
      vec4 mvPosition=viewMatrix*modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      vec2 axis=normalize((viewMatrix*vec4(velocity,0.)).xy+vec2(.00001,0.));
      mvPosition.xy+=vec2(axis.y,-axis.x)*position.x*length(instanceMatrix[0].xyz)+axis*position.y*length(instanceMatrix[1].xyz);
    #else
      vec4 mvPosition=viewMatrix*modelMatrix*instanceMatrix*vec4(position.x,0.,position.y,1.);
    #endif
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }`;
const poolFragment = `
  uniform vec3 crest; uniform vec3 trough;
  varying vec2 vUv; varying vec3 vEffect;
  #include <fog_pars_fragment>
  void main(){
    float alpha; vec3 color=crest;
    #ifdef SPRAY
      float shape=length(vec2(vUv.x/(.62-.24*vUv.y),vUv.y));
      alpha=(1.-smoothstep(.55,1.,shape))*vEffect.x;
      color=mix(trough,crest,smoothstep(-.7,.6,vUv.y)*.6+.4);
    #else
      float a=atan(vUv.y,vUv.x),r=length(vUv),edge=.76+.02*sin(a*5.+vEffect.z*6.);
      float foam=1.-smoothstep(.025,.05,abs(r-edge));
      float inner=(1.-smoothstep(.01,.03,abs(r-edge*.7)))*.2;
      float arc=vEffect.y>.5?1.-smoothstep(.05,.6,vUv.y):1.;
      alpha=(foam*(.65+.35*sin(a*7.+vEffect.z*4.))+inner)*arc*vEffect.x;
    #endif
    if(alpha<.01)discard;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
// Sheets: uv.x across (−1…1), uv.y along the flow in metres.
const sheetVertex = `
  attribute vec2 flow; varying vec2 vFlow; varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main(){ vFlow=flow; vec4 world=modelMatrix*vec4(position,1.); vWorld=world.xyz; vec4 mvPosition=viewMatrix*world; gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }`;
const sheetFragment = `
  uniform float time; uniform vec3 color; uniform float strength;
  varying vec2 vFlow; varying vec3 vWorld;
  #include <fog_pars_fragment>
  float n(vec2 p){return sin(p.x+sin(p.y*1.3))*sin(p.y*.9+cos(p.x*.7));}
  void main(){
    float alpha;
    #if KIND == 0
      // Chorro: long bright streaks racing downstream.
      float across=1.-smoothstep(.35,1.,abs(vFlow.x));
      float streak=pow(max(0.,sin(vFlow.x*9.+n(vFlow*vec2(3.,.2))*2.)),6.)*pow(max(0.,sin((vFlow.y-time*3.4)*.9+vFlow.x*3.)),2.);
      alpha=across*(streak*.55+.12)*strength;
    #elif KIND == 1
      // Whitewater: churning foam strongest on the face, fading below it.
      float fade=1.-smoothstep(.5,3.2,vFlow.y);
      float churn=n(vec2(vFlow.x*7.,vFlow.y*2.6-time*5.))+.6*n(vec2(vFlow.x*13.1+time,vFlow.y*5.3-time*3.))+.35;
      alpha=fade*smoothstep(.15,.85,churn)*strength*(1.-smoothstep(.75,1.,abs(vFlow.x)));
    #else
      // Remolino: spiral arms that turn, a dark eye in the middle.
      float r=length(vFlow),a=atan(vFlow.y,vFlow.x);
      float arms=pow(max(0.,sin(a*3.+r*9.-time*3.)),5.);
      alpha=arms*smoothstep(.12,.35,r)*(1.-smoothstep(.75,1.,r))*strength;
      if(r<.22){gl_FragColor=vec4(color*.08,(1.-r/.22)*.8);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
        return;}
    #endif
    if(alpha<.01)discard;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

function sheet(geo, kind, color, strength) {
  const material = new THREE.ShaderMaterial({ vertexShader: sheetVertex, fragmentShader: sheetFragment, defines: { KIND: kind }, transparent: true, depthWrite: false, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), time: { value: 0 }, color: { value: new THREE.Color(color) }, strength: { value: strength } } });
  const mesh = new THREE.Mesh(geo, material); mesh.renderOrder = 2; return mesh;
}
// A strip that follows the river: `offset(s)` is its centre, `half` its half width.
function strip(river, from, to, offset, half, lift = .035, step = 1) {
  const ps = [], flow = [], ix = [], cols = 6; let rows = 0;
  for (let s = from; s <= to + 1e-6; s += step, rows++) for (let j = 0; j <= cols; j++) {
    const u = j / cols * 2 - 1, off = offset(s) + u * half, p = river.at(s, off);
    ps.push(p.x, river.levelAt(s, off) + lift, p.z); flow.push(u, s - from);
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) { const n = i * (cols + 1) + j; ix.push(n, n + cols + 1, n + 1, n + 1, n + cols + 1, n + cols + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); geo.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2)); geo.setIndex(ix);
  return geo;
}

export function createRiverFX(river) {
  const group = new THREE.Group(); group.name = 'Curiara · agua viva';
  const sheets = [];
  // The chorro, everywhere it carries a boost.
  const L = river.LENGTH;
  {
    const segments = []; let start = null;
    for (let s = 0; s <= L; s += 2) { const on = river.def.chorroBoost(s) > .5 && !river.drops.some(d => Math.abs(s - d.s) < d.span + 6); if (on && start == null) start = s; if ((!on || s + 2 > L) && start != null) { segments.push([start, s]); start = null; } }
    for (const [a, b] of segments) { const m = sheet(strip(river, a, b, s => river.def.chorro(s), 1.7, .04), 0, 0xe8f6ee, .55); m.name = 'Chorro'; group.add(m); sheets.push(m); }
  }
  // Whitewater over each raudal step, lane by lane.
  for (const d of river.drops) for (const lane of d.lanes) for (const [ds, h] of lane.steps) {
    const mid = (lane.from + lane.to) / 2, half = (lane.to - lane.from) / 2;
    const m = sheet(strip(river, d.s + ds - .6, d.s + ds + 3.4, () => mid, half, .05, .25), 1, 0xf6f8f2, Math.min(1, .45 + h * .45)); m.name = 'Espuma del raudal'; group.add(m); sheets.push(m);
  }
  // The remolino's spiral.
  if (river.whirl) {
    const w = river.whirl, geo = new THREE.CircleGeometry(w.r * 1.15, 48); geo.rotateX(-Math.PI / 2);
    const flow = [], p = geo.attributes.position; for (let i = 0; i < p.count; i++) flow.push(p.getX(i) / (w.r * 1.15) * w.spin, p.getZ(i) / (w.r * 1.15));
    geo.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
    const m = sheet(geo, 2, 0xeef5ea, .75); m.position.set(w.x, river.levelAt(w.s, w.offset) + .045, w.z); m.name = 'Remolino'; group.add(m); sheets.push(m);
  }

  // Pools.
  const matrix = new THREE.Object3D(), history = new Map();
  let serial = 0, lastTime = -1, raudalClock = 0, disposed = false;
  function batch(capacity, spray) {
    const geometry = new THREE.PlaneGeometry(2, 2), effect = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3), velocity = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    effect.setUsage(THREE.DynamicDrawUsage); velocity.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('effect', effect); geometry.setAttribute('velocity', velocity);
    const material = new THREE.ShaderMaterial({ vertexShader: poolVertex, fragmentShader: poolFragment, defines: spray ? { SPRAY: 1 } : {}, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), crest: { value: new THREE.Color(0xf2fbf6) }, trough: { value: new THREE.Color(0x8fb8a8) } } });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = spray ? 4 : 3; mesh.name = spray ? 'Gotas' : 'Ondas'; group.add(mesh);
    return { mesh, effect, velocity, cursor: 0, pool: Array.from({ length: capacity }, () => ({ birth: -100, life: 0 })) };
  }
  const rings = batch(FX_BUDGET.rings, false), spray = batch(FX_BUDGET.spray, true);
  const random = () => { const n = Math.sin(++serial * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const ring = (t, x, y, z, h, power, wake = false) => Object.assign(rings.pool[rings.cursor++ % rings.pool.length], { birth: t, life: (wake ? 1.3 : 1.1) + random() * .2, x, y, z, h, power, wake });
  function burst(t, x, y, z, { n = 6, up = 1.6, out = 1, vx = 0, vz = 0, size = .03, life = .5 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = random() * TAU, o = out * (.4 + random() * .8);
      Object.assign(spray.pool[spray.cursor++ % spray.pool.length], { birth: t, life: life * (.7 + random() * .6), x, y, z, vx: Math.cos(a) * o + vx, vz: Math.sin(a) * o + vz, vy: up * (.6 + random() * .7), size: size * (.7 + random() * .7) });
    }
  }
  function update(t, boats, canoes, focus, raceTime) {
    if (disposed) return;
    for (const m of sheets) m.material.uniforms.time.value = t;
    if (t === lastTime) return;
    if (t < lastTime) reset();
    const dt = lastTime < 0 ? 0 : t - lastTime; lastTime = t;
    const seen = new Set(); let count = 0;
    for (const b of boats) {
      const c = canoes.get(b.id); if (!c) continue;
      const q = c.group.position, h = c.group.rotation.y, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h), y = b.y ?? q.y;
      if (Math.hypot(q.x - focus.x, q.z - focus.z) > FX_BUDGET.distance || count++ >= FX_BUDGET.boats) continue;
      seen.add(b.id);
      let prev = history.get(b.id);
      const now = { x: q.x, z: q.z, strokes: b.paddle?.count || 0, drops: b.drops || 0, caps: b.capsizes || 0, splashes: b.splashes || 0, bitten: b.bitten || 0 };
      if (!prev) { history.set(b.id, { ...now, distance: 0 }); continue; }
      const moved = Math.hypot(q.x - prev.x, q.z - prev.z);
      if (moved > 8) { Object.assign(prev, now); continue; }
      // A splash where the blade bites, on the stroking side.
      if (now.strokes > prev.strokes && !(b.capsized > 0)) {
        const side = b.paddle.side || 1, seat = b.crew.length === 2 ? .9 : -1.55, power = b.paddle.quality === 'remazo' ? 1.3 : b.paddle.quality === 'chapoteo' ? 1.6 : 1;
        const bx = q.x + rx * side * 1 + fx * (seat + .7), bz = q.z + rz * side * 1 + fz * (seat + .7);
        ring(t, bx, y + .03, bz, h, .7 * power); burst(t, bx, y + .05, bz, { n: b.paddle.quality === 'chapoteo' ? 9 : 5, up: 1.4 * power, out: .8, vx: -fx * .8, vz: -fz * .8 });
      }
      if (now.drops > prev.drops) { ring(t, q.x, y + .03, q.z, h, 2.4); burst(t, q.x, y + .1, q.z, { n: 28, up: 3.6, out: 2.4, size: .05, life: .8 }); }
      if (now.caps > prev.caps) { ring(t, q.x, y + .03, q.z, h, 2.8); burst(t, q.x, y + .2, q.z, { n: 34, up: 3.2, out: 2.2, size: .055, life: .9 }); }
      if (now.bitten > prev.bitten) burst(t, q.x, y + .1, q.z, { n: 18, up: 2.6, out: 1.4, size: .045 });
      if (now.splashes > prev.splashes) {
        // ¡Salpicón!: a fan of water thrown sideways.
        const side = b.splashSide || 1, sx = q.x + rx * side * .9, sz = q.z + rz * side * .9;
        burst(t, sx, y + .3, sz, { n: 36, up: 2.2, out: .8, vx: rx * side * 4.2 + fx * .5, vz: rz * side * 4.2 + fz * .5, size: .05, life: .75 });
        ring(t, sx, y + .03, sz, h, 1.2);
      }
      // Bow wave and wake rings with distance travelled.
      prev.distance += moved;
      const speed = Math.hypot(b.gx || 0, b.gz || 0);
      if (speed > 1.5 && prev.distance > .8 && !(b.capsized > 0) && !(b.air > 0)) {
        ring(t, q.x + fx * 2.6, y + .03, q.z + fz * 2.6, h, .5 + Math.min(.6, Math.abs(b.v || 0) * .1), true);
        ring(t, q.x - fx * 2.4, y + .03, q.z - fz * 2.4, h, .45, true);
        prev.distance %= .8;
      }
      Object.assign(prev, now);
    }
    for (const id of history.keys()) if (!seen.has(id)) history.delete(id);
    // The raudales throw spray all the time, nearest first.
    raudalClock += dt;
    if (raudalClock > .05) {
      raudalClock = 0;
      for (const d of river.drops) {
        const p = river.at(d.s); if (Math.hypot(p.x - focus.x, p.z - focus.z) > 70) continue;
        for (const lane of d.lanes) for (const [ds, h] of lane.steps) {
          if (random() > .35 + h * .4) continue;
          const off = lane.from + random() * (lane.to - lane.from), at = river.at(d.s + ds + .5, off), y = river.levelAt(d.s + ds + .6, off);
          burst(t, at.x, y + .05, at.z, { n: 1 + Math.round(h * 2), up: 1.2 + h * 1.6, out: .6, vx: Math.sin(at.h) * 1.5, vz: Math.cos(at.h) * 1.5, size: .05 + h * .03, life: .7 });
        }
      }
      // Toninas break the surface and dive again.
      for (const pod of river.toninasAt(raceTime)) {
        if (Math.abs(pod.age - .1) < .05 || Math.abs(pod.age - 1.1) < .05) {
          const a = river.at(pod.s + (pod.age > .5 ? 7 : -1), pod.offset);
          if (Math.hypot(a.x - focus.x, a.z - focus.z) < 70) { ring(t, a.x, river.levelAt(pod.s) + .03, a.z, a.h, 1.4); burst(t, a.x, river.levelAt(pod.s) + .1, a.z, { n: 10, up: 2, out: 1 }); }
        }
      }
    }
    for (const b of [rings, spray]) {
      let n = 0;
      for (const p of b.pool) {
        const age = t - p.birth, u = age / p.life; if (age < 0 || u >= 1 || p.life === 0) continue;
        if (b === rings) {
          const radius = (p.wake ? .5 : .2) + age * (p.wake ? 1 : .9) * p.power;
          matrix.position.set(p.x, p.y, p.z); matrix.rotation.set(0, p.h, 0); matrix.scale.set(radius, 1, radius * (p.wake ? 1.6 : .9));
          b.effect.setXYZ(n, (p.wake ? .26 : .5) * (1 - u) ** 1.4 * Math.min(1, age * 30), p.wake ? 1 : 0, u);
        } else {
          const y = age * p.vy - 4.4 * age * age; if (y < -.05) continue;
          matrix.position.set(p.x + p.vx * age, p.y + y, p.z + p.vz * age); matrix.rotation.set(0, 0, 0); matrix.scale.set(p.size, p.size * (1.8 + Math.abs(p.vy - 8.8 * age) * .4), 1);
          b.effect.setXYZ(n, .85 * (1 - u * u), 0, u); b.velocity.setXYZ(n, p.vx, p.vy - 8.8 * age, p.vz);
        }
        matrix.updateMatrix(); b.mesh.setMatrixAt(n++, matrix.matrix);
      }
      b.mesh.count = n; b.mesh.visible = n > 0; b.mesh.instanceMatrix.needsUpdate = true; b.effect.needsUpdate = true; if (b === spray) b.velocity.needsUpdate = true;
    }
  }
  function reset() { history.clear(); lastTime = -1; serial = 0; for (const b of [rings, spray]) { b.pool.forEach(p => p.life = 0); b.cursor = 0; b.mesh.count = 0; } }
  return { group, update, reset,
    get stats() { return { rings: rings.mesh.count, spray: spray.mesh.count, boats: history.size, sheets: sheets.length }; },
    dispose() { if (disposed) return; disposed = true; history.clear(); for (const b of [rings, spray]) { b.mesh.dispose(); b.mesh.geometry.dispose(); b.mesh.material.dispose(); } for (const m of sheets) { m.geometry.dispose(); m.material.dispose(); } group.removeFromParent(); } };
}
