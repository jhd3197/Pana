import * as THREE from 'three';
import { createLayout, MAP } from './dulce-layout.js';
import { createWorld } from './dulce-world.js';
import { referenceTrack } from './reference-world.js';

export default referenceTrack('dulce', createLayout(), createWorld, {
  scale: 1.3,
  palette: { skySeed: 61, cloudCover: 0, horizon: 16040661, skyTop: 16040661, sunDisc: false,
    sunDirection: new THREE.Vector3(...MAP.sun.dir), hemiSky: 16770281, hemiGround: 16040661,
    hemiInt: MAP.sun.hemi, sun: MAP.sun.color, sunInt: MAP.sun.intensity,
    ground: 16040661, track: 0x888888, dune: 0, fog: [600,6000] },
});
