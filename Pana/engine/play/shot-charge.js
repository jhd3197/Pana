// Hold to charge a shot (Billar, Bolas Criollas): one second up, one second
// down; holding never locks in maximum power.
export function shotPower(elapsedMs) {
  const phase = Math.max(0, elapsedMs) % 2000 / 1000;
  return .05 + .95 * (phase <= 1 ? phase : 2 - phase);
}

// Paints a kit charge meter (kit.css "Charge meter"): the role="meter" track,
// its .pk-charge-fill and .pk-charge-marker, and an optional percentage label.
export function paintCharge(meter, power, label) {
  const percent = Math.round(power * 100);
  meter.setAttribute('aria-valuenow', percent);
  meter.querySelector('.pk-charge-fill').style.clipPath = `inset(${(1 - power) * 100}% 0 0)`;
  meter.querySelector('.pk-charge-marker').style.bottom = `${power * 100}%`;
  if (label) label.textContent = `${percent}%`;
}
