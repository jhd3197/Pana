import * as THREE from 'three';
import { createLayout, MAP } from './maracaibo-layout.js';
import { createWorld } from './maracaibo-world.js';
import { coastalTrack } from './coastal-track.js';
// A night circuit: the sky dims to a navy dome, the moon is the shadow light
// and the street lamps, towers and lit facades carry the colour.
export default coastalTrack('maracaibo', createLayout(), createWorld, {
  scale: 1,
  palette: { skySeed: 53, cloudCover: .18, daylight: .15, sunDisc: false,
    sunDirection: new THREE.Vector3(...MAP.moon.dir),
    horizon: 0x16224a, skyTop: 0x050a1e, hemiSky: 0x5a6cb0, hemiGround: 0x2a2a44, hemiInt: 1.1,
    sun: 0xa8bcff, sunInt: .75, ground: 0x2c3a2a, track: 0x4a4a50, dune: 0, fog: [380, 4200] },
  previewBounds: [[-160, 0, -420], [540, 80, 330]],
});
