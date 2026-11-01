// Which detail a model shows at a camera distance, with hysteresis so a model
// near the line never flickers between the two. Pure: no Three.js, so games,
// tests and server code can share it.
//   far = chooseFar(far, distance, { far: 55, near: 47 })
// `far` is where the low-detail model takes over, `near` (smaller) where the
// full model comes back; between the two the current choice stays.
export function chooseFar(wasFar, distance, { far, near = far * .85 }) {
  if (!(distance >= 0)) return !!wasFar;
  return wasFar ? distance > near : distance > far;
}
