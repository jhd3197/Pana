import * as THREE from 'three';
import { DAYLIGHT } from './course.js';

// One bounded particle draw around the followed horse, shared race clock.
export function createRaceWeather(scene, sun) {
  const count = 240, positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xc3dfef, size: .075, transparent: true, opacity: .65 });
  const rain = new THREE.Points(geometry, material); rain.frustumCulled = false; scene.add(rain);
  return {
    update(options, time, target) {
      const wet = options.weather !== 'sun', storm = options.weather === 'storm'; rain.visible = wet;
      sun.intensity = wet ? (storm ? .7 : 1.2) : DAYLIGHT.sunInt;
      scene.fog.color.setHex(wet ? (storm ? 0x657884 : 0x8fa8b2) : DAYLIGHT.horizon);
      scene.fog.near = wet ? 65 : DAYLIGHT.fog[0]; scene.fog.far = wet ? 200 : DAYLIGHT.fog[1];
      if (!wet) return;
      for (let i = 0; i < count; i++) {
        positions[i*3] = target.x + ((i*7.31 + time*(storm?3:1))%24)-12;
        positions[i*3+1] = target.y + (20-(time*14+i*1.37)%20);
        positions[i*3+2] = target.z + ((i*11.17)%24)-12;
      }
      geometry.attributes.position.needsUpdate = true;
    },
    dispose() { rain.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
