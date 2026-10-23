// The race's sky, sun, fog and weather: built once, repainted for each map.
// Angled rain with puddle ripples and lightning on wet maps, snow on Páramo.
import * as THREE from 'three';
import { createSky } from '/engine/worlds/sky.js';
import { rng } from '/engine/random.js';

// A fixed seed and absolute race time keep flakes stable across pauses/replays.
// cameraPosition is supplied for each draw, including the second split view.
export function createSnow(count = 1400) {
  const random = rng(517), seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = random();
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0], 3));
  geometry.setAttribute('flakeSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geometry.setIndex([0,1,2,0,2,3]); geometry.instanceCount = count;
  const material = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, snowTime: { value: 0 } },
    transparent: true, depthWrite: false, fog: true,
    vertexShader: /* glsl */`
      attribute vec4 flakeSeed;
      uniform float snowTime;
      varying vec2 flakeUv;
      varying float flakeAlpha;
      #include <fog_pars_vertex>
      void main() {
        vec3 volume = vec3(46.0, 22.0, 46.0);
        float t = snowTime, phase = flakeSeed.w * 6.283185;
        vec3 p = flakeSeed.xyz * volume;
        p += vec3(0.65 * t, -(1.2 + flakeSeed.w * 1.1) * t, 0.25 * t);
        p += vec3(sin(t * 0.65 + phase), sin(t * 0.4 + phase) * 0.25, cos(t * 0.55 + phase)) * 0.75;
        vec3 center = cameraPosition + vec3(0.0, 3.0, 0.0);
        p = mod(p - center + volume * 0.5, volume) - volume * 0.5 + center;
        vec3 edge = abs((p - center) / (volume * 0.5));
        flakeAlpha = (1.0 - smoothstep(0.7, 1.0, max(edge.x, max(edge.y, edge.z))))
          * smoothstep(0.8, 2.2, distance(p, cameraPosition));
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        mvPosition.xy += position.xy * (0.10 + flakeSeed.w * 0.14);
        gl_Position = projectionMatrix * mvPosition;
        flakeUv = position.xy * 2.0;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      varying vec2 flakeUv;
      varying float flakeAlpha;
      #include <fog_pars_fragment>
      void main() {
        float a = (1.0 - smoothstep(0.25, 1.0, dot(flakeUv, flakeUv))) * flakeAlpha * 0.85;
        if (a < 0.015) discard;
        gl_FragColor = vec4(vec3(0.88, 0.94, 1.0), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const snow = new THREE.Mesh(geometry, material);
  snow.name = 'paramo-snow'; snow.frustumCulled = false; snow.visible = false;
  return snow;
}

// track(): the active track runtime (or null); racing(): a race is on screen.
export function createRaceWorld({ scene, cameras, puffs, shockwaves, sound, track, groundAt, racing }) {
  // Weather: angled rain + puddle ripples + lightning on Selva, snow/hail on Páramo.
  const RAIN_DROPS = 1400;
  const rain = (() => {
    const pos = new Float32Array(RAIN_DROPS * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xb8d4ec, transparent: true, opacity: 0.55 });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.visible = false;
    lines.name = 'rain';
    scene.add(lines);
    const snow = createSnow(RAIN_DROPS); scene.add(snow);
    const seed = Array.from({ length: RAIN_DROPS }, () => [Math.random() * 60 - 30, Math.random() * 30, Math.random() * 60 - 30]);
    let rippleT = 0;
    let nextLightning = 6 + Math.random() * 8;
    let flashVal = 0;
    return {
      lines,
      mat,
      snow,
      update(cx, cy, cz, t, dt = 0.016) {
        const T = track();
        if (T?.id === 'paramo') {
          snow.material.uniforms.snowTime.value = t;
          if (T.group?.userData.snowAmount) T.group.userData.snowAmount.value = 0.28 + 0.44 * (1 - Math.exp(-Math.max(0, t) / 45));
          if (!lines.visible) return;
        }
        const storm = (T?.def.rain || 0) >= 0.85;
        const fallSpeed = 36, windX = -0.35, windZ = 0.18, lenY = 1.45;
        for (let i = 0; i < Math.min(RAIN_DROPS, geo.drawRange.count / 2); i++) {
          const [x0, y0, z0] = seed[i];
          const cycle = ((y0 - t * fallSpeed) % 30 + 30) % 30;
          const y = cy - 8 + cycle;
          const x = cx + x0 - (30 - cycle) * 0.12;
          const z = cz + z0;
          pos.set([x, y, z, x + windX, y + lenY, z + windZ], i * 6);
        }
        geo.attributes.position.needsUpdate = true;

        rippleT -= dt;
        if (rippleT <= 0) {
          rippleT = (storm ? 0.09 : 0.16) * RAIN_DROPS / Math.min(RAIN_DROPS, geo.drawRange.count / 2);
          const rx = cx + (Math.random() - 0.5) * 28;
          const rz = cz + (Math.random() - 0.5) * 28;
          const gy = groundAt(rx, rz);
          shockwaves.ring(new THREE.Vector3(rx, gy, rz), {
            color: 0xd8ecff, maxRadius: 0.9 + Math.random() * 0.6, duration: 0.42, opacity: 0.45,
          });
          puffs.spawn(new THREE.Vector3(rx, gy + 0.08, rz), {
            color: 0xd8ecff, count: 1, size: 0.2, rise: 1.1, life: 0.22, spread: 0.35,
          });
        }

        if (storm) {
          nextLightning -= dt;
          if (nextLightning <= 0) {
            nextLightning = 9 + Math.random() * 11;
            flashVal = 0.95;
            setTimeout(() => { if (racing()) sound.thunder(0.95); }, 260 + Math.random() * 320);
          }
        }
        if (flashVal > 0) {
          flashVal = Math.max(0, flashVal - dt * 3.8);
          sky.setFlash(flashVal);
        }
      },
    };
  })();
  scene.background = new THREE.Color(0xffd6a0);
  scene.fog = new THREE.Fog(0xffd6a0, 80, 260);
  const sky = createSky(); scene.add(sky.mesh);
  const hemi = new THREE.HemisphereLight(0xfff1d6, 0xc08a5a, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-30, 40, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // Sky, fog and lights follow the track's palette.
  function applyPalette(pal) {
    const T = track();
    if (T?.def.rain) {
      const grey = new THREE.Color(0x8a96a3);
      const mix = (c, k) => new THREE.Color(c).lerp(grey, k).getHex();
      pal = { ...pal, horizon: mix(pal.horizon, 0.55), skyTop: mix(pal.skyTop ?? pal.horizon, 0.6), hemiSky: mix(pal.hemiSky, 0.4),
        sunInt: (pal.sunInt ?? 2.4) * 0.5, hemiInt: (pal.hemiInt ?? 1.6) * 0.85, cloudCover: 0.95,
        fog: [Math.min(pal.fog?.[0] ?? 80, 60), Math.min(pal.fog?.[1] ?? 260, 380)] };
    }
    const hasRainbow = T?.id === 'salto' || T?.id === 'selva' || T?.id === 'bululu';
    pal = { ...pal, rainbow: hasRainbow ? (T?.id === 'salto' ? 0.85 : 0.48) : 0 };
    rain.lines.visible = !!T?.def.rain && T.id !== 'paramo';
    rain.snow.visible = T?.id === 'paramo';
    rain.snow.material.uniforms.snowTime.value = 0;
    if (T?.group?.userData.snowAmount) T.group.userData.snowAmount.value = 0.28;
    rain.mat.opacity = 0.58;
    scene.background.set(pal.horizon);
    scene.fog.color.set(pal.horizon);
    scene.fog.near = pal.fog?.[0] ?? 80;
    scene.fog.far = pal.fog?.[1] ?? 260;
    // Never clip what the fog still shows: big maps fog out past 1800 m.
    for (const cam of cameras) if (cam.far !== Math.max(1800, scene.fog.far)) { cam.far = Math.max(1800, scene.fog.far); cam.updateProjectionMatrix(); }
    hemi.color.set(pal.hemiSky);
    hemi.groundColor.set(pal.hemiGround);
    hemi.intensity = pal.hemiInt ?? 1.6;
    sun.color.set(pal.sun);
    sun.intensity = pal.sunInt ?? 2.4;
    sky.setPalette(pal); sky.update(0);
  }

  return { rain, sky, hemi, sun, applyPalette };
}
