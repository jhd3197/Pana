// The local player's drift, heard: a continuous tyre screech that swells with
// the slide and climbs in pitch with speed and charge, a chime as each charge
// level lands (blue, orange, purple), warning ticks in the overheat window
// and a hiss when the tyres burn. On a river run the screech gives way to a
// water rush and the outboard's buzz. The tyre loop is the engine's shared vehicle audio
// (engine/vehicle-audio.js); the car's motor is the shared sound.startEngine putt-putt (engine/fx.js). Synthesised on the shared WebAudio
// context (engine/fx.js sound): no files. game.js calls update once per drawn
// frame; `active` false (paused, finished, garage) fades everything out.
import { DRIFT_LEVELS, OVERHEAT_WARN } from './drive-rules.js';
import { createTyres, vehicleSfx } from '/engine/vehicle-audio.js';


const LEVEL_NOTES = [[], [660, 880], [660, 880, 1100], [660, 880, 1100, 1320]];

function noiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function createDriftAudio(sound) {
  let rig = null, lastLevel = 0, lastBoat = false, tickT = 0, wasBurning = false, chargedLevel = 0;

  // Built on first use, once the audio context exists (a user gesture).
  function build() {
    const ctx = sound.ctx, out = sound.out(), noise = noiseBuffer(ctx);
    const loop = (filterType, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(out); src.start();
      return { f, g };
    };
    const tyres = createTyres(sound);
    const rush = loop('lowpass', 900, 0.7);
    // The outboard: a buzzy low saw, only on the water.
    const motor = ctx.createOscillator(), mf = ctx.createBiquadFilter(), mg = ctx.createGain();
    motor.type = 'sawtooth'; motor.frequency.value = 70; mf.type = 'lowpass'; mf.frequency.value = 600; mg.gain.value = 0;
    motor.connect(mf).connect(mg).connect(out); motor.start();
    return { tyres, rush, motor, mg };
  }

  const set = (param, value, tau = 0.06) => param.setTargetAtTime(value, sound.ctx.currentTime, tau);

  return {
    update(c, dt, active = true) {
      if (!sound.ctx) return;
      rig ??= build();
      const on = active && !sound.muted && c;
      const speed = on ? Math.abs(c.vf || 0) : 0;
      const drifting = on && c.drift && c.onGround && !c.boat;
      const level = drifting ? c.driftLvl || 0 : 0;
      // Tyres: loud with the slide, pitch with speed and charge, a crunch off the tarmac.
      const loose = on && c.onGround && (c.surface === 'dirt' || c.surface === 'grass' || c.offRoad) ? 'dirt' : 'road';
      rig.tyres.update({ slip: drifting ? 1 : 0, speed, charge: level, surface: loose });
      // Water: a rush that grows with speed and the outboard's buzz.
      const boat = on && c.boat;
      set(rig.rush.g.gain, boat ? 0.03 + Math.min(0.06, speed * 0.0018) : 0, 0.12);
      set(rig.rush.f.frequency, 500 + speed * 25);
      set(rig.mg.gain, boat ? 0.028 : 0, 0.1);
      set(rig.motor.frequency, 55 + speed * 2.6 + (c?.boost > 0 ? 40 : 0), 0.08);
      if (!on) { lastLevel = 0; lastBoat = false; return; }
      // A clean release of a charged drift: a low thump under the turbo whoosh.
      if (!drifting && chargedLevel && (c.boost || 0) > 0.3 && !c.burnT) sound.sweep(150, 42, 0.28, 'sine', 0.18 + chargedLevel * 0.04);
      chargedLevel = drifting ? level : 0;
      // A chime as each charge level lands.
      if (level > lastLevel) LEVEL_NOTES[level].forEach((f, i) => sound.tone(f * (level === 3 ? 1.25 : 1), i * 0.045, 0.09, 'triangle', 0.05 + level * 0.012));
      lastLevel = level;
      // Overheat window: ticks that speed up towards the burn.
      const purple = DRIFT_LEVELS[2], into = (c.driftT || 0) - purple - OVERHEAT_WARN;
      if (drifting && level === 3 && into >= 0) {
        tickT -= dt;
        if (tickT <= 0) { tickT = Math.max(0.06, 0.18 - into * 0.2); sound.tone(1900, 0, 0.035, 'square', 0.045); }
      }
      // The burn: a hiss and a low crunch, once.
      const burning = (c.burnT || 0) > 0;
      if (burning && !wasBurning) { vehicleSfx.skid(1.6); sound.sweep(260, 60, 0.4, 'sawtooth', 0.08); }
      wasBurning = burning;
      // Hitting the water: a deep splash under the visual crown.
      if (boat && !lastBoat) { sound.sweep(180, 50, 0.5, 'sine', 0.22); sound.sweep(900, 200, 0.35, 'triangle', 0.05); }
      lastBoat = boat;
    },
  };
}
