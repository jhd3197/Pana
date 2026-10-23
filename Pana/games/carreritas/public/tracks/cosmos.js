import * as THREE from 'three';
import { createLayout, MAP } from './cosmos-layout.js';
import { createWorld } from './cosmos-world.js';
import { referenceTrack } from './reference-world.js';

export default referenceTrack('cosmos', createLayout(), createWorld, {
  scale: 1.3,
  palette: { skySeed: 61, cloudCover: 0, horizon: 527400, skyTop: 527400, sunDisc: false,
    sunDirection: new THREE.Vector3(...MAP.sun.dir), hemiSky: 10137855, hemiGround: 527400,
    hemiInt: MAP.sun.hemi, sun: MAP.sun.color, sunInt: MAP.sun.intensity,
    ground: 527400, track: 0x888888, dune: 0, fog: [1800,12000] },
});
