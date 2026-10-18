// One second up, one second down; holding never locks in maximum power.
export function shotPower(elapsedMs) {
  const phase = Math.max(0, elapsedMs) % 2000 / 1000;
  return .05 + .95 * (phase <= 1 ? phase : 2 - phase);
}
