import * as THREE from 'three';
import { createLayout, MAP } from './arrecife-layout.js';
import { createWorld } from './arrecife-world.js';
import { referenceTrack } from './reference-world.js';

export default referenceTrack('arrecife', createLayout(), createWorld, {
  scale: 1.3,
  palette: { skySeed: 61, cloudCover: 0, horizon: 551812, skyTop: 551812, sunDisc: false,
    sunDirection: new THREE.Vector3(...MAP.sun.dir), hemiSky: 9166064, hemiGround: 551812,
    hemiInt: MAP.sun.hemi, sun: MAP.sun.color, sunInt: MAP.sun.intensity,
    ground: 551812, track: 0x888888, dune: 0, fog: [90,1000] },
});
