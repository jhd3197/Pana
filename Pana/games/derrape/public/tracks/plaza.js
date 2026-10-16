import { TRACK_DEFINITIONS } from '../track-definitions.js';
// A street race through a complete town, from the historic plaza to the hill.
import { ROUTE, townHeight } from './plaza-layout.js';
import { createTown, raceEdges } from './plaza-town.js';

export default {
  ...TRACK_DEFINITIONS.find(track => track.id === 'plaza'),
  points: ROUTE, rounded: true, hw: 9, lineU: 0.075,
  elevation: townHeight,
  previewBounds: [[-355, 0, -355], [720, 80, 490]],
  sectors: [[0, 'Casco histórico'], [0.2, 'Camino del lago'], [0.35, 'Puente de los panas'],
    [0.51, 'Casas Botes'], [0.7, 'Subida del mirador'], [0.88, 'La alameda']],
  items: { boxes: [0.12, 0.31, 0.52, 0.73, 0.91], boxLanes: [-6, -2, 2, 6],
    pads: [{ u: 0.23, off: -4 }, { u: 0.46, off: 4 }, { u: 0.68, off: 0 }, { u: 0.87, off: -4 }] },
  walls: false,
  palette: { horizon: 0xb6e2f1, skyTop: 0x278dd0, skySeed: 7, cloudCover: .32, hemiSky: 0xe4f3ff, hemiGround: 0x9c9269, hemiInt: 1.6,
    sun: 0xfff0d2, sunInt: 2.6, ground: 0x80ae57, track: 0x8b958c, dune: 0, fog: [170, 720] },
  environment: createTown,
  scenery: raceEdges,
};
