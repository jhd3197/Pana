import * as THREE from 'three';
import { rng } from '/engine/props.js';

export const SKY_MODES = ['day', 'night', 'cycle'];
const TAU = Math.PI * 2;
const CYCLE_SECONDS = 600;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

// Shared by the sun's halo and stars: a soft edge, without extra render passes.
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.42, 'rgba(255,255,255,0.22)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createAtmosphere(scene, water, initialMode = 'day') {
  let mode = SKY_MODES.includes(initialMode) ? initialMode : 'day';
  let phase = mode === 'night' ? 0.75 : 0.25;
  let daylight = mode === 'night' ? 0 : 1;
  const horizon = new THREE.Color(), zenith = new THREE.Color();
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, 300, 1100);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1050, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { horizon: { value: horizon }, zenith: { value: zenith } },
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 horizon; uniform vec3 zenith; varying vec3 vDirection;
      void main() {
        float height = max(normalize(vDirection).y, 0.0);
        gl_FragColor = vec4(mix(horizon, zenith, pow(height, 0.55)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.name = 'Island sky';
  sky.renderOrder = -10;
  scene.add(sky);

  const glow = glowTexture();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(19, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffedb1, fog: false }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd48a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(150, 150, 1);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(17, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe1efff, fog: false }));
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xadcfff, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonHalo.scale.set(95, 95, 1);
  scene.add(sun, halo, moon, moonHalo);

  const random = rng(124), positions = [];
  for (let i = 0; i < 650; i++) {
    const a = random() * TAU, y = 0.12 + random() * 0.86, r = Math.sqrt(1 - y * y);
    positions.push(Math.cos(a) * r * 950, y * 950, Math.sin(a) * r * 950);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe6f1ff, size: 4, map: glow, transparent: true, depthWrite: false, fog: false }));
  stars.name = 'Night stars';
  scene.add(stars);

  const ambient = new THREE.HemisphereLight(0xcbeaff, 0x7b8050, 2);
  const key = new THREE.DirectionalLight(0xffe9bc, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 280 });
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.06;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xffdfb4, 0.45);
  fill.position.set(40, 45, 90);
  scene.add(ambient, key, key.target, fill);
  const focus = new THREE.Vector3();
  const direction = new THREE.Vector3();

  const palette = {
    horizon: [new THREE.Color(0x25395e), new THREE.Color(0xc5e6ed)],
    zenith: [new THREE.Color(0x080f2b), new THREE.Color(0x428ecb)],
    water: [new THREE.Color(0x123456), new THREE.Color(0x279fba)],
    skyLight: [new THREE.Color(0x879fdf), new THREE.Color(0xcbeaff)],
    groundLight: [new THREE.Color(0x263447), new THREE.Color(0x838854)],
    key: [new THREE.Color(0xa9c5ff), new THREE.Color(0xffe9bc)],
  };
  const sunset = new THREE.Color(0xf5ae88);
  const mix = (target, name) => target.copy(palette[name][0]).lerp(palette[name][1], daylight);

  const api = {
    get mode() { return mode; },
    get daylight() { return daylight; },
    get phase() { return phase; },
    setMode(next) { if (SKY_MODES.includes(next)) mode = next; },
    follow(target) { focus.copy(target); },
    update(dt) {
      if (mode === 'cycle') phase = (phase + dt / CYCLE_SECONDS) % 1;
      else {
        const target = mode === 'night' ? 0.75 : 0.25;
        const delta = ((target - phase + 1.5) % 1) - 0.5;
        phase = (phase + delta * (1 - Math.exp(-dt * 1.6)) + 1) % 1;
      }
      const elevation = Math.sin(phase * TAU);
      daylight = smooth(-0.18, 0.3, elevation);
      const dusk = (1 - smooth(0.05, 0.5, Math.abs(elevation))) * 0.7;
      mix(horizon, 'horizon').lerp(sunset, dusk);
      mix(zenith, 'zenith');
      scene.fog.color.copy(horizon);
      mix(water.color, 'water');
      mix(ambient.color, 'skyLight');
      mix(ambient.groundColor, 'groundLight');
      ambient.intensity = 0.85 + daylight * 1.15;
      mix(key.color, 'key').lerp(sunset, dusk * daylight);
      key.intensity = 0.85 + daylight * 1.55;
      fill.intensity = 0.16 + daylight * 0.29;
      // Both bodies cross the horizon, while the shadow camera follows play.
      const angle = phase * TAU;
      sun.position.set(Math.cos(angle) * 700 - 200, elevation * 570, -650);
      moon.position.set(-Math.cos(angle) * 650 + 220, -elevation * 570, -650);
      halo.position.copy(sun.position);
      moonHalo.position.copy(moon.position);
      sun.visible = halo.visible = elevation > -0.08;
      moon.visible = moonHalo.visible = elevation < 0.08;
      halo.material.opacity = daylight * 0.65;
      stars.material.opacity = Math.pow(1 - daylight, 2) * 0.85;
      stars.visible = daylight < 0.99;
      // Keep directional shading consistent with the visible sun or moon.
      direction.copy(moon.position).lerp(sun.position, daylight).normalize().multiplyScalar(110);
      direction.y = Math.max(25, direction.y);
      key.position.copy(focus).add(direction);
      key.target.position.copy(focus);
    },
  };
  api.update(0);
  return api;
}
