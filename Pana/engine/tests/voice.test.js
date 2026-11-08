import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceOf, voiceLine, createVoiceGate, createVoices, VOICE_LINES } from '../voice.js';

test('each character keeps one voice, and characters sound different', () => {
  assert.deepEqual(voiceOf('0-1'), voiceOf('0-1'), 'the same id, the same voice');
  const ids = ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', 'abc', 'Lula'];
  const pitches = ids.map(id => voiceOf(id).pitch);
  for (const p of pitches) assert.ok(p >= .78 && p <= 1.32, `pitch ${p} in range`);
  assert.ok(new Set(pitches.map(p => p.toFixed(2))).size >= 6, 'most of a match sound apart');
});

test('a line is scaled by the voice: higher pitch, higher tones', () => {
  for (const line of VOICE_LINES) assert.ok(voiceLine(line, voiceOf('x')).length > 0, line);
  const low = voiceLine('hurt', { pitch: .8, pace: 1, type: 'sine' }), high = voiceLine('hurt', { pitch: 1.3, pace: 1, type: 'sine' });
  assert.ok(high[0].f0 > low[0].f0 && high[1].f1 > low[1].f1);
  assert.ok(low.every(p => p.priority === 1), 'below critical cues in the voice budget');
  assert.deepEqual(voiceLine('nope', voiceOf('x')), []);
});

test('the gate keeps one character from chattering and many from piling up', () => {
  const g = createVoiceGate({ gap: .35, overlap: 2, window: .3 });
  assert.equal(g.allow('a', 0), true);
  assert.equal(g.allow('a', .1), false, 'too soon for the same one');
  assert.equal(g.allow('b', .1), true);
  assert.equal(g.allow('c', .15), false, 'two already speaking');
  assert.equal(g.allow('c', .5), true, 'room again');
  assert.equal(g.allow('a', .6), true);
});

// A stand-in for engine/fx.js's sound and engine/sfx.js's pitch.
const fake = () => { const played = []; return { played, sound: { ctx: { currentTime: 10 }, muted: false }, pitch: p => played.push(p) }; };

test('say plays the character\'s own pitched line, and nothing when locked or muted', () => {
  const f = fake(), voices = createVoices(f);
  assert.equal(voices.say('0-1', 'jump'), true);
  assert.equal(f.played.length, 1);
  assert.ok(Math.abs(f.played[0].f0 - 520 * voiceOf('0-1').pitch) < 1e-9, 'its own pitch');
  f.sound.muted = true; f.sound.ctx.currentTime = 20;
  assert.equal(voices.say('0-1', 'hurt'), false, 'muted');
  f.sound.muted = false; const ctx = f.sound.ctx; f.sound.ctx = null;
  assert.equal(voices.say('0-1', 'hurt'), false, 'audio not unlocked yet');
  f.sound.ctx = ctx;
  assert.equal(voices.say('0-1', 'win', { volume: .5, delay: .4 }), true);
  assert.ok(f.played.at(-1).delay >= .4 && f.played.at(-1).vol < .06, 'delayed and quieter');
  assert.equal(voices.say('0-2', 'unknown'), false);
});
