// The world behind and below the playing field, a Llanos late afternoon: a
// warm sky with the sun low over the savanna, drifting clouds, three ranges of
// hills fading into the haze (real perspective parallax), a rippling river
// with foam where the bank meets it, morichales on the far bank, reeds and
// rocks by the water, corocoras crossing the sky, and the player's own pana
// cheering from a dock on the west bank. Groves, reeds, rocks, clouds and
// birds are instanced, so all of it is a handful of draws.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { reeds } from '/engine/models/vegetation/reeds.js';
import { mossRock } from '/engine/models/vegetation/moss-rock.js';
import { scarletIbis } from '/engine/models/fauna/birds/scarlet-ibis.js';
import { birdFlock } from '/engine/models/animation/bird-flock.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { fbm2, rng } from '/engine/random.js';

// The sky by how high you look: a warm cream horizon, gold, then soft teal and blue.
const SKY = [[0, '#ffd6a0'], [.03, '#fde0b4'], [.075, '#dce6cc'], [.13, '#a7d2da'], [.21, '#76b1dc'], [.4, '#4683c8']];
const HAZE = '#f2dcb4';
const RIVER = '#4a8c94', RIVER_DEEP = '#24525e', SAVANNA = '#869c4a', SAVANNA_FAR = '#d6c9a0';
// The sun hangs low in the west of the sky; its light comes from the front left.
const SUN_AT = { dx: -38, y: 24, z: -205 };
const FRONT_Z = .55;   // the earth slab's front face (scene.js)

// A long ridge silhouette standing at depth z: noise along its top.
function ridge(width, base, height, z, color, seed) {
  const shape = new THREE.Shape(), x0 = -width / 2;
  shape.moveTo(x0, base - 2);
  for (let i = 0; i <= 90; i++) { const x = x0 + width * i / 90; shape.lineTo(x, base + height * (.3 + .7 * fbm2(i * .085, seed, { octaves: 3 }))); }
  shape.lineTo(-x0, base - 2); shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color }));
  mesh.position.z = z; return mesh;
}

// One puffy low-poly cloud (merged blobs), shared by every cloud instance.
function cloudGeometry() {
  const r = rng(41), parts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1), s = 2.2 + r() * 2.4;
    g.scale(s * 1.3, s * .8, s); g.translate((i - 3) * 2.6 + r() * 1.5, r() * 1.6 + (i % 3 === 1 ? 1.4 : 0), r() * 2);
    parts.push(g);
  }
  const merged = mergeGeometries(parts); parts.forEach(g => g.dispose()); merged.computeVertexNormals(); return merged;
}

// The river: a standard material with moving ripple bands and a glint path
// under the sun, all in the shader (no textures, no extra passes).
function riverMaterial(uniforms) {
  const material = new THREE.MeshStandardMaterial({ color: RIVER, roughness: .3, metalness: .1, transparent: true, opacity: .92 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRiver;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRiver = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRiver;\nuniform float uTime;\nuniform float uSunX;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity ); // i18n-ignore: GLSL, not player text
        {
          vec2 p = vRiver.xz;
          float near = clamp(1.0 + p.y / 60.0, 0.0, 1.0);
          float a = sin(p.x * 0.45 + uTime * 1.2 + sin(p.y * 0.8 + uTime * 0.7) * 1.6) * sin(p.y * 1.7 - uTime * 0.9 + p.x * 0.12);
          float b = sin(p.x * 1.3 - uTime * 1.7 + p.y * 0.6) * sin(p.y * 2.3 + uTime * 1.3);
          float ripple = smoothstep(0.55, 1.0, a) * 0.6 + smoothstep(0.75, 1.0, b) * 0.45;
          float path = exp(-pow((p.x - uSunX) / (18.0 + 40.0 * (1.0 - near)), 2.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.36, 0.4), (1.0 - near) * 0.25);
          float front = 1.0 - 0.6 * smoothstep(-6.0, 12.0, p.y);
          diffuseColor.rgb += ripple * (0.06 + 0.45 * path) * vec3(1.0, 0.88, 0.66) * (0.5 + 0.5 * near) * front;
          diffuseColor.rgb += path * vec3(0.22, 0.15, 0.06) * (1.0 - near * 0.5);
        }`);
  };
  material.customProgramCacheKey = () => 'capis-river';
  return material;
}

// The savanna: patches of darker and drier grass and scattered bushes, all in
// the shader from the world position, fading into the haze.
function savannaMaterial() {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPlain;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlain = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vPlain;
      float sHash(vec2 p) { return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453); }
      float sNoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(sHash(i), sHash(i + vec2(1, 0)), u.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p = vPlain * vec2(1.0, 2.2);
        float grassPatch = sNoise(p * 0.05) * 0.6 + sNoise(p * 0.13) * 0.4;
        diffuseColor.rgb *= mix(vec3(0.78, 0.86, 0.72), vec3(1.12, 1.05, 0.86), smoothstep(0.3, 0.75, grassPatch));
        float bush = smoothstep(0.78, 0.86, sNoise(p * 0.45 + 7.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.68, 0.5), bush * 0.8);
      }`);
  };
  material.customProgramCacheKey = () => 'capis-savanna';
  return material;
}

// The sky's colour from the elevation of the view ray, with a warm bloom towards the sun.
function skyMaterial(sunX) {
  const stops = SKY.map(([at, hex]) => ({ at, color: new THREE.Color(hex) }));
  const glsl = stops.slice(1).map((s, i) => `c = mix(c, vec3(${s.color.r.toFixed(4)}, ${s.color.g.toFixed(4)}, ${s.color.b.toFixed(4)}), smoothstep(${stops[i].at.toFixed(3)}, ${s.at.toFixed(3)}, e));`).join(' ');
  const first = stops[0].color;
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(sunX, SUN_AT.y, SUN_AT.z) } },
    vertexShader: 'varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vWorld;
    void main() {
      vec3 d = normalize(vWorld - cameraPosition);
      float e = d.y;
      vec3 c = vec3(${first.r.toFixed(4)}, ${first.g.toFixed(4)}, ${first.b.toFixed(4)});
      ${glsl}
      float sun = max(0.0, dot(d, normalize(uSun - cameraPosition)));
      c += vec3(1.0, 0.62, 0.3) * (pow(sun, 24.0) * 0.35 + pow(sun, 6.0) * 0.12);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    depthWrite: false, fog: false,
  });
}

export function createBackdrop(scene, map) {
  const group = new THREE.Group(), mid = map.width / 2, sunX = mid + SUN_AT.dx; scene.add(group);
  const random = rng(map.seed + 5), glow = glowTexture(), uniforms = { uTime: { value: 0 }, uSunX: { value: sunX } };
  scene.background = new THREE.Color(SKY[0][1]);
  scene.fog = new THREE.Fog(HAZE, 80, 270);
  // Sky: graded by the height of the view direction (not the world height), so
  // the play view and the whole map both get the warm horizon and the blue above.
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1000, 400), skyMaterial(sunX));
  skyMesh.position.set(mid, 60, -240); group.add(skyMesh);
  // The sun: a glow and its bright disc, both on one sprite each.
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffc27a', blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: .7 }));
  sunGlow.scale.setScalar(95); sunGlow.position.set(sunX, SUN_AT.y, SUN_AT.z + 2); group.add(sunGlow);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: '#fff1cf', fog: false }));
  sunDisc.position.set(sunX, SUN_AT.y, SUN_AT.z); group.add(sunDisc);
  // Clouds drifting slowly east, lit warm from below.
  const clouds = new THREE.InstancedMesh(cloudGeometry(), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffe6cf', emissiveIntensity: .62, flatShading: true, fog: false }), 9);
  const cloudAt = Array.from({ length: 9 }, (_, i) => ({ x: mid - 200 + i * 48 + random() * 20, y: 38 + random() * 34, z: -170 - random() * 25, s: .9 + random() * .9, speed: .5 + random() * .6 }));
  const dummy = new THREE.Object3D();
  function placeClouds(time) {
    for (let i = 0; i < cloudAt.length; i++) {
      const c = cloudAt[i], x = ((c.x + time * c.speed - mid + 220) % 440 + 440) % 440 + mid - 220;
      dummy.position.set(x, c.y, c.z); dummy.scale.set(c.s * 1.4, c.s, c.s); dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix);
    }
  }
  placeClouds(0); clouds.frustumCulled = false; group.add(clouds);
  // The river: a wide sheet at the water line, and its deep face in front.
  const river = new THREE.Mesh(new THREE.PlaneGeometry(700, 160), riverMaterial(uniforms));
  river.rotation.x = -Math.PI / 2; river.position.set(mid, map.water, -50); group.add(river);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(700, 30), new THREE.MeshBasicMaterial({ color: RIVER_DEEP, transparent: true, opacity: .6, depthWrite: false }));
  deep.position.set(mid, map.water - 15, 3.2); group.add(deep);
  // Savanna beyond the river, then three ranges of hills, paler with distance.
  // The savanna fades from grass near the river to the haze at the horizon (vertex colours, one draw).
  const flat = new THREE.PlaneGeometry(700, 140, 1, 8), near = new THREE.Color(SAVANNA), far = new THREE.Color(SAVANNA_FAR), tones = [];
  for (let i = 0; i < flat.attributes.position.count; i++) { const k = THREE.MathUtils.smoothstep(flat.attributes.position.getY(i), -70, 70); const c = near.clone().lerp(far, k * k); tones.push(c.r, c.g, c.b); }
  flat.setAttribute('color', new THREE.Float32BufferAttribute(tones, 3));
  const savanna = new THREE.Mesh(flat, savannaMaterial());
  savanna.rotation.x = -Math.PI / 2; savanna.position.set(mid, map.water + 1.2, -100); group.add(savanna);
  for (const [width, height, z, color, seed] of [[460, 7, -112, '#879f55', 3], [560, 16, -165, '#8fa58f', 9], [700, 26, -225, '#a9b9bb', 15]]) {
    const r = ridge(width, map.water, height, z, color, seed); r.position.x = mid; group.add(r);
  }
  // Morichales: groves of moriche palms on the far bank and out on the savanna,
  // one instanced prototype; two nearer palms keep their own sway.
  const grove = [];
  for (const [cx, cz, n, spread] of [[-22, -48, 3, 7], [14, -62, 4, 9], [62, -58, 4, 9], [100, -50, 3, 7], [40, -96, 4, 16]]) {
    for (let i = 0; i < n; i++) grove.push({ x: cx + (random() - .5) * spread * 2, y: map.water + 1.2, z: cz + (random() - .5) * spread, rot: random() * 6.3, scale: .8 + random() * .45 });
  }
  instancePlacements(group, moriche({ seed: 5, h: 12, detail: 'low', fruit: false }), grove, { name: 'moriche-grove', cellSize: Infinity, castShadow: false });
  // Far ones in less detail and without fruit; the sandbar palm, near the play, in full.
  const palms = [[-12, -30, 12, 3, 'lite'], [92, -30, 11, 11, 'lite'], [77.2, -4.2, 5, 21, 'game']].map(([x, z, h, seed, detail]) => { const palm = moriche({ seed, h, detail, fruit: detail === 'game' }); palm.position.set(x, map.water + .6, z); group.add(palm); return palm; });
  // Reeds and rocks at the water's edge, behind the slab and past both banks.
  const reedAt = [];
  for (let i = 0; i < 14; i++) {
    const west = i % 2 === 0, x = west ? -4 + random() * 9 : map.width - 6 + random() * 12;
    reedAt.push({ x, y: map.water - .25, z: -3.2 - random() * 8, rot: random() * 6.3, scale: .8 + random() * .7 });
  }
  reedAt.push({ x: 75.4, y: map.water + .6, z: -3.4, rot: 1, scale: .8 }, { x: 78.6, y: map.water - .1, z: -3.2, rot: 2, scale: .9 });
  for (let i = 0; i < 4; i++) reedAt.push({ x: 4 + random() * 72, y: map.water - .3, z: -9 - random() * 6, rot: random() * 6.3, scale: .7 + random() * .5 });
  instancePlacements(group, reeds({ seed: 4, detail: 'low' }), reedAt, { name: 'shore-reeds', cellSize: Infinity, castShadow: false });
  const rockAt = [[-1.5, 1.5, 1.2], [-6, -4, 1.8], [map.width + 1.6, 1.2, 1.4], [map.width + 4, -3, 2.2], [map.width - 7.5, -3.8, 1.3], [2.5, -4.5, 1]]
    .map(([x, z, s]) => ({ x, y: map.water - .45 * s, z, rot: random() * 6.3, scale: s }));
  instancePlacements(group, mossRock({ seed: 9, size: 1, color: '#b49a78' }), rockAt, { name: 'shore-rocks', cellSize: Infinity, castShadow: false });
  // Corocoras crossing the sky in two loose flocks.
  const birds = birdFlock(scarletIbis({ seed: 3, detail: 'low' }), { routes: [{ cx: mid - 20, cz: -60, cy: 30, r: 46, speed: .1 }, { cx: mid + 35, cz: -95, cy: 40, r: 60, speed: -.075, phase: 2 }], size: 4, seed: 6, scale: 1.5 });
  group.add(birds);
  // Foam where the bank meets the water, along the slab's front: one
  // instanced soft strip per stretch of shore, re-laid after a blast.
  const foamMaterial = new THREE.MeshBasicMaterial({ map: glow, color: '#f4fbff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 });
  const foam = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), foamMaterial, 24);
  foam.count = 0; foam.frustumCulled = false; group.add(foam);
  function shore(mask) {
    const r = Math.floor((map.water + .05) / mask.cell), runs = [];
    let start = -1;
    for (let c = 0; c <= mask.cols; c++) {
      const solid = c < mask.cols && mask.solid[r * mask.cols + c];
      if (solid && start < 0) start = c;
      if (!solid && start >= 0) { runs.push([start * mask.cell, c * mask.cell]); start = -1; }
    }
    let n = 0;
    for (const [a, b] of runs) {
      // The front line of the run, and a short tongue round each end where the bank goes back into the slab.
      for (const [x, z, sx, sz] of [[(a + b) / 2, FRONT_Z + .25, b - a + 1.2, .9], [a, (FRONT_Z - 2.6) / 2, 1.3, 3.6], [b, (FRONT_Z - 2.6) / 2, 1.3, 3.6]]) {
        if (n >= foam.instanceMatrix.count) break;
        dummy.position.set(x, map.water + .03, z); dummy.scale.set(sx, 1, sz); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); foam.setMatrixAt(n++, dummy.matrix);
      }
    }
    foam.count = n; foam.instanceMatrix.needsUpdate = true;
  }
  // The player's pana on a dock by the west bank.
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, .3, 2.4), new THREE.MeshLambertMaterial({ color: '#8a5a34' }));
  dock.position.set(-3.5, map.water + .4, -2.5); group.add(dock);
  for (const [dx, dz] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 3), dock.material); post.position.set(-3.5 + dx, map.water - 1, -2.5 + dz); group.add(post);
  }
  const pana = buildCharacter(loadAvatar());
  pana.group.position.set(-3.5, map.water + .55, -2.5); pana.group.rotation.y = .5; pana.group.scale.setScalar(1.5); group.add(pana.group);
  let mood = 'idle', time = 0;
  return {
    pana, shore,
    // 'cheer' (a good shot), 'ouch' (our capi was hit), 'win', 'lose'.
    react(kind) {
      if (kind === 'cheer') pana.bounce(1.2);
      else if (kind === 'ouch') pana.stagger(.8, 0);
      else mood = kind;
    },
    update(dt) {
      time += dt; uniforms.uTime.value = time;
      if (mood === 'win' && Math.sin(time * 5) > .95) pana.bounce(.8);
      pana.update(dt, { dizzy: mood === 'lose' });
      for (const palm of palms) palm.userData.tick?.(time);
      birds.userData.tick(time);
      placeClouds(time); clouds.instanceMatrix.needsUpdate = true;
      foamMaterial.opacity = .42 + Math.sin(time * 1.7) * .14;
    },
    dispose() {
      pana.dispose(); birds.userData.dispose?.(); glow.dispose();
      group.traverse(o => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m?.dispose?.()); });
      group.removeFromParent();
    },
  };
}
