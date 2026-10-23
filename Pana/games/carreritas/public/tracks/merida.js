import * as THREE from 'three';
import { createLayout, MAP } from './merida-layout.js';
import { createWorld } from './merida-world.js';
import { referenceTrack } from './reference-world.js';

export default referenceTrack('merida', createLayout(), createWorld, {
  scale: 1.3,
  palette: { skySeed: 61, cloudCover: 0, horizon: 11916768, skyTop: 11916768, sunDisc: false,
    sunDirection: new THREE.Vector3(...MAP.sun.dir), hemiSky: 15660287, hemiGround: 11916768,
    hemiInt: MAP.sun.hemi, sun: MAP.sun.color, sunInt: MAP.sun.intensity,
    ground: 11916768, track: 0x888888, dune: 0, fog: [600,6000] },
});
