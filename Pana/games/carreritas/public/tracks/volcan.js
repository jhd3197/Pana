import * as THREE from 'three';
import { createLayout, MAP } from './volcan-layout.js';
import { createWorld } from './volcan-world.js';
import { referenceTrack } from './reference-world.js';

export default referenceTrack('volcan', createLayout(), createWorld, {
  scale: 1.9,
  palette: { skySeed: 61, cloudCover: 0, horizon: 3744817, skyTop: 3744817, sunDisc: false,
    sunDirection: new THREE.Vector3(...MAP.sun.dir), hemiSky: 14334415, hemiGround: 3744817,
    hemiInt: .9, sun: MAP.sun.color, sunInt: MAP.sun.intensity,
    ground: 3744817, track: 0x888888, dune: 0, fog: [600,6000] },
});
