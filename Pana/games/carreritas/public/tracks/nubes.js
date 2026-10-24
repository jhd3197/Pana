import * as THREE from 'three';
import { createLayout, MAP } from './nubes-layout.js';
import { createWorld } from './nubes-world.js';
import { referenceTrack } from './reference-world.js';

export default referenceTrack('nubes', createLayout(), createWorld, {
  scale: 1.3,
  palette: { skySeed: 61, cloudCover: 0, horizon: 15378571, skyTop: 15378571, sunDisc: false,
    sunDirection: new THREE.Vector3(...MAP.sun.dir), hemiSky: 16769744, hemiGround: 15378571,
    hemiInt: MAP.sun.hemi, sun: MAP.sun.color, sunInt: MAP.sun.intensity,
    ground: 15378571, track: 0x888888, dune: 0, fog: [600,6000] },
});
