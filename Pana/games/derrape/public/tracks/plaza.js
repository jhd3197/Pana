// A street race through a complete town, from the historic plaza to the hill.
import { ROUTE, townHeight } from './plaza-layout.js';
import { createTown, raceEdges } from './plaza-town.js';

export default {
  id: 'plaza', name: 'Plaza Pana',
  blurb: 'Calles de pueblo, patios y mercado. Sube al barrio del mirador y vuelve a la plaza.',
  points: ROUTE, rounded: true, hw: 9, lineU: 0.075,
  elevation: townHeight,
  previewBounds: [[-355, 0, -355], [465, 80, 330]],
  sectors: [[0, 'Casco histórico'], [0.18, 'Mercado de los panas'], [0.35, 'Barrio del sol'],
    [0.52, 'Subida del mirador'], [0.72, 'La alameda']],
  items: { boxes: [0.12, 0.31, 0.52, 0.73, 0.91], boxLanes: [-6, -2, 2, 6],
    pads: [{ u: 0.23, off: -4 }, { u: 0.46, off: 4 }, { u: 0.68, off: 0 }, { u: 0.87, off: -4 }] },
  walls: false,
  palette: { horizon: 0xbfd5c5, skyTop: 0x8bcde9, hemiSky: 0xe6f6ff, hemiGround: 0xb29772, hemiInt: 1.8,
    sun: 0xffe1ab, sunInt: 3, ground: 0x9fb37c, track: 0x8b958c, dune: 0, fog: [170, 720] },
  environment: createTown,
  scenery: raceEdges,
};
