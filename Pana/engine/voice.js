// Cartoon character voices: a short squeak, "hup", "oof", "awww" or "yahoo"
// for a character's own reactions, synthesised on the shared WebAudio context
// like the rest of engine/sfx.js (no files). Each character keeps one voice
// for the whole match: its pitch and wobble come from its id, so Toño always
// squeaks a bit higher than Gordo, on every screen.
//
//   import { sound } from '/engine/fx.js';
//   import { pitch } from '/engine/sfx.js';
//   import { createVoices } from '/engine/voice.js';
//   const voices = createVoices({ sound, pitch });
//   voices.say(capi.id, 'hurt', { volume: .8 });   // false when muted, locked or rate-limited
//
// Only for a character's reactions: never music, UI, shots or explosions, and
// never a cue the player needs (a countdown, a turn chime). Lines ride below
// those in the voice budget (priority 1), so a busy moment drops a squeak first.
// Pure apart from `say`: Node tests check the recipes and the gate.

// The lines a character can say. Each is a list of tone glides at pitch 1;
// a voice scales every frequency by its own pitch.
const LINES = {
  hurt: [{ dur: .07, f0: 1300, f1: 1900, vol: .07 }, { dur: .11, f0: 1700, f1: 1100, vol: .06, delay: .07 }],        // "eep!"
  oof: [{ dur: .1, f0: 520, f1: 380, vol: .08 }, { dur: .18, f0: 420, f1: 210, vol: .07, delay: .08 }],              // a big hit
  jump: [{ dur: .08, f0: 520, f1: 760, vol: .045 }],                                                                // "hup"
  ko: [{ dur: .2, f0: 880, f1: 700, vol: .07 }, { dur: .22, f0: 760, f1: 560, vol: .065, delay: .18 }, { dur: .32, f0: 620, f1: 300, vol: .06, delay: .38 }], // "awww"
  win: [{ dur: .1, f0: 560, f1: 900, vol: .06 }, { dur: .2, f0: 760, f1: 1400, vol: .065, delay: .12 }],            // "yahoo!"
  taunt: [{ dur: .07, f0: 760, f1: 640, vol: .05 }, { dur: .07, f0: 760, f1: 640, vol: .05, delay: .11 }, { dur: .12, f0: 820, f1: 560, vol: .05, delay: .22 }], // "nyeh-nyeh"
  dizzy: [{ dur: .22, f0: 600, f1: 900, vol: .05 }, { dur: .3, f0: 900, f1: 480, vol: .05, delay: .2 }],            // "woooo"
  rise: [{ dur: .09, f0: 420, f1: 620, vol: .05 }, { dur: .12, f0: 620, f1: 820, vol: .05, delay: .1 }],            // "hup-hup"
};
export const VOICE_LINES = Object.freeze(Object.keys(LINES));

// FNV-1a: the same id gives the same voice on every client.
function hash(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

// A character's voice: `pitch` (.78..1.32, every frequency times this),
// `pace` (.9..1.12, longer or shorter syllables) and the oscillator's `type`.
export function voiceOf(id) {
  const h = hash(id);
  return { pitch: .78 + (h % 1000) / 1000 * .54, pace: .9 + ((h >>> 10) % 100) / 100 * .22, type: (h >>> 17) & 1 ? 'triangle' : 'sine' };
}

// The tone glides of `line` in `voice`, at `volume`: what `say` plays.
export function voiceLine(line, voice, volume = 1) {
  const parts = LINES[line]; if (!parts) return [];
  return parts.map(p => ({ dur: p.dur * voice.pace, f0: p.f0 * voice.pitch, f1: p.f1 * voice.pitch, vol: p.vol * volume, delay: (p.delay || 0) * voice.pace, type: voice.type, attack: .008, priority: 1 }));
}

// Keeps voices from piling up: one character speaks at most every `gap`
// seconds, and at most `overlap` lines start within any `window` seconds.
export function createVoiceGate({ gap = .35, overlap = 2, window = .3 } = {}) {
  const last = new Map(); let recent = [];
  return {
    allow(id, now) {
      if (now - (last.get(id) ?? -Infinity) < gap) return false;
      recent = recent.filter(t => now - t < window);
      if (recent.length >= overlap) return false;
      last.set(id, now); recent.push(now); return true;
    },
    reset() { last.clear(); recent = []; },
  };
}

// `sound`: engine/fx.js's (ctx, muted, the master volume); `pitch`: engine/sfx.js's tone glide.
export function createVoices({ sound, pitch }, options = {}) {
  const gate = createVoiceGate(options), voices = new Map();
  const voice = id => { let v = voices.get(id); if (!v) voices.set(id, v = voiceOf(id)); return v; };
  return {
    voiceOf: voice,
    // Says `line` as character `id`; `delay` seconds from now. Nothing before the
    // player's first tap unlocks audio, nothing while muted.
    say(id, line, { volume = 1, delay = 0 } = {}) {
      if (!sound.ctx || sound.muted || !LINES[line] || volume <= .02 || id == null) return false;
      if (!gate.allow(id, sound.ctx.currentTime + delay)) return false;
      for (const p of voiceLine(line, voice(id), Math.min(1.2, volume))) pitch({ ...p, delay: p.delay + delay });
      return true;
    },
    reset: () => gate.reset(),
  };
}
