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

// The hold-to-throw flow both games share. ready(): it is my turn to shoot;
// revision(): the table's revision, so a shot charged before the table moved
// on is dropped; change(power | null): repaint (null when the charge ends);
// shoot(power, extra): release with a valid charge. begin(source, extra)
// starts a charge from 'pointer', ' ' or 'Enter'; extra rides along to shoot.
export function createShotCharge({ ready, revision, change = () => {}, shoot, min = .05 }) {
  let charge = null;
  const api = {
    get active() { return !!charge; },
    get source() { return charge?.source ?? null; },
    get started() { return charge?.started ?? null; },
    get power() { return charge?.power ?? null; },
    valid: () => !!charge && ready() && charge.revision === revision(),
    update(now = performance.now()) {
      if (!charge) return null;
      charge.power = Math.max(min, shotPower(now - charge.started)); change(charge.power); return charge.power;
    },
    begin(source, extra = {}) {
      if (charge || !ready()) return false;
      charge = { source, extra, started: performance.now(), revision: revision(), power: min };
      api.update(); return true;
    },
    cancel() { if (!charge) return; charge = null; change(null); },
    release(source) {
      if (charge?.source !== source) return;
      api.update();
      const valid = api.valid(), { power, extra } = charge;
      charge = null; change(null);
      if (valid) shoot(power, extra);
    },
  };
  return api;
}
