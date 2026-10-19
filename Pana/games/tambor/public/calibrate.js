// The one-time "toca cuando suene el golpe" screen: eight sticks at 100 bpm,
// the pana taps along, and the median delay becomes their latency. The judge
// subtracts it from every hit, so speakers, Bluetooth and slow hands all play
// on time. Saved per browser.
const KEY = 'pana.tambor.latency', CLICKS = 8, SPB = .6;
const clampMs = (v) => Math.max(-200, Math.min(400, Math.round(v)));

export function loadLatency() {
  try { return clampMs(Number(localStorage.getItem(KEY)) || 0); } catch { return 0; }
}
function saveLatency(ms) { try { localStorage.setItem(KEY, String(ms)); } catch { /* private mode: keep it for this visit */ } }

export function createCalibration($, { sound, voices, onDone }) {
  let clicks = [], taps = [], timer = 0, latency = loadLatency();
  const dots = $('calibration-dots');
  dots.replaceChildren(...Array.from({ length: CLICKS }, () => document.createElement('i')));

  function open() {
    sound.unlock();
    $('calibration').hidden = false; $('calibration-result').textContent = '';
    const ctx = sound.ctx, first = ctx.currentTime + 1;
    clicks = Array.from({ length: CLICKS }, (_, i) => first + i * SPB); taps = [];
    const out = sound.out();
    clicks.forEach((at, i) => voices.stick(at, i % 4 ? .9 : 1.3, out));
    [...dots.children].forEach(d => { d.className = ''; });
    clearInterval(timer);
    timer = setInterval(() => {
      const now = ctx.currentTime;
      clicks.forEach((at, i) => { if (now >= at) dots.children[i].classList.add('on'); });
      if (now > clicks.at(-1) + .6) finish();
    }, 30);
  }

  function tap() {
    if ($('calibration').hidden || !clicks.length) return;
    const now = sound.ctx.currentTime, i = clicks.findIndex(at => Math.abs(now - at) < SPB / 2);
    if (i >= 0) { taps.push(now - clicks[i]); dots.children[i].classList.add('hit'); }
  }

  function finish() {
    clearInterval(timer);
    if (taps.length < 4) { $('calibration-result').textContent = 'Muy pocos golpes. Prueba otra vez.'; clicks = []; return; }
    const sorted = [...taps].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
    latency = clampMs(median * 1000); saveLatency(latency); clicks = [];
    $('calibration-result').textContent = `Listo: tu golpe llega ${Math.abs(latency)} ms ${latency >= 0 ? 'tarde' : 'antes'}. La rueda lo tomará en cuenta.`;
    onDone(latency);
  }

  function close() { clearInterval(timer); clicks = []; $('calibration').hidden = true; }
  $('calibration-tap').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
  $('calibration-close').onclick = close;
  return { open, tap, close, get isOpen() { return !$('calibration').hidden; }, get latency() { return latency; } };
}
