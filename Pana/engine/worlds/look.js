// The Pana look, from the brand boards: bright tropical colours, warm
// sunlight, soft toy-like shapes. 3D scenes take their light and accent
// colours from here so every game reads as the same sunny town. No Three.js:
// plain values, safe anywhere.
export const PALETTE = Object.freeze({
  rojo: '#ff4b4b', coral: '#ff7a6b', turquesa: '#00c2d8', azul: '#3b8bff', amarillo: '#ffc83d',
  arena: '#f4e3c5', terracota: '#d8884b', verde: '#2baa72', madera: '#8b5e3c', carbon: '#2b2b2b',
  cielo: '#5eb6ff', crema: '#fff3e0', hoja: '#7bbf4e', rosa: '#f08fa8',
});

// Papel picado and bunting, in this order.
export const BUNTING = Object.freeze([PALETTE.rojo, PALETTE.amarillo, PALETTE.azul, PALETTE.verde, PALETTE.coral, PALETTE.turquesa]);

// Late-morning sun over the plaza: golden key light, a warm bounce from the
// paving, a clear blue sky fading to cream at the horizon.
export const WARM_DAY = Object.freeze({
  background: '#f4e2bd',
  hemi: ['#fff3da', '#c08a5a', 2.1],
  sun: { color: '#ffd9a0', intensity: 3.1 },
  sky: { skyTop: '#4fa8e8', horizon: '#f8e6c2', cloudCover: .32 },
  exposure: 1.06,
});
