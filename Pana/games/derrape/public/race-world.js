// The race's sky, sun, fog and weather: built once, repainted for each map.
// Angled rain with puddle ripples and lightning on wet maps, snow on Páramo.
import * as THREE from 'three';
import { createSky } from '/engine/worlds/sky.js';

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
    const seed = Array.from({ length: RAIN_DROPS }, () => [Math.random() * 60 - 30, Math.random() * 30, Math.random() * 60 - 30]);
    let rippleT = 0;
    let nextLightning = 6 + Math.random() * 8;
    let flashVal = 0;
    return {
      lines,
      mat,
      update(cx, cy, cz, t, dt = 0.016) {
        const T = track(), snow = T?.id === 'paramo';
        const storm = (T?.def.rain || 0) >= 0.85;
        const fallSpeed = snow ? 16 : 36;
        const windX = snow ? Math.sin(t * 1.4) * 0.45 : -0.35;
        const windZ = snow ? Math.cos(t * 1.1) * 0.35 : 0.18;
        const lenY = snow ? 0.55 : 1.45;
        for (let i = 0; i < Math.min(RAIN_DROPS, geo.drawRange.count / 2); i++) {
          const [x0, y0, z0] = seed[i];
          const cycle = ((y0 - t * fallSpeed) % 30 + 30) % 30;
          const y = cy - 8 + cycle;
          const x = cx + x0 + (30 - cycle) * (snow ? 0.08 * Math.sin(t + i) : -0.12);
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
          if (snow) {
            puffs.spawn(new THREE.Vector3(rx, gy + 0.12, rz), {
              color: 0xf2f7ff, count: 2, size: 0.22, rise: 1.8, life: 0.28, spread: 0.6,
            });
          } else {
            shockwaves.ring(new THREE.Vector3(rx, gy, rz), {
              color: 0xd8ecff, maxRadius: 0.9 + Math.random() * 0.6, duration: 0.42, opacity: 0.45,
            });
            puffs.spawn(new THREE.Vector3(rx, gy + 0.08, rz), {
              color: 0xd8ecff, count: 1, size: 0.2, rise: 1.1, life: 0.22, spread: 0.35,
            });
          }
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
    rain.lines.visible = !!T?.def.rain;
    rain.mat.color.setHex(T?.id === 'paramo' ? 0xf2f7ff : 0xb8d4ec);
    rain.mat.opacity = T?.id === 'paramo' ? 0.78 : 0.58;
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
