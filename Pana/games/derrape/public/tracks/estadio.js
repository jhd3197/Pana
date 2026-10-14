// El Estadio — the original stadium oval. Geometry and item placement are
// the exact values the game shipped with, expressed as fractions of the
// lap so the loader treats it like any other track.

export default {
  id: 'estadio',
  name: 'El Estadio',
  blurb: 'El óvalo de siempre: tierra, llantas y dos rampas.',
  oval: { S: 45, R: 30 },
  hw: 9,
  line: 30,
  ramps: [
    { s0: 56, len: 9, h: 1.7, hw: 4.2 },
    { s0: 224.25, len: 9, h: 2.2, hw: 4.2 },
  ],
  items: {
    boxes: [0.12483, 0.52104],
    boxLanes: [-6, -2, 2, 6],
    pads: [
      { u: 0.37178, off: -4 },
      { u: 0.56989, off: 0 },
      { u: 0.87111, off: 4 },
    ],
  },
  walls: true,
  fence: false,
  chevrons: false,
  palette: {
    horizon: 0xffd6a0,
    skyTop: 0x6fb7e8,
    hemiSky: 0xfff1d6,
    hemiGround: 0xc08a5a,
    hemiInt: 1.6,
    sun: 0xffd9a0,
    sunInt: 2.4,
    ground: 0xe8b57a,
    track: 0x9c5b33,
    dune: 1,
    fog: [80, 260],
  },
};
