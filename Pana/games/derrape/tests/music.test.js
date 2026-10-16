import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, TRACK_STYLE, noteFor } from '../public/music.js';
import { TRACK_IDS } from '../public/online-rules.js';

test('every track has a groove and every groove is complete', () => {
  for (const id of TRACK_IDS) assert.ok(STYLES[TRACK_STYLE[id]], id);
  for (const style of Object.values(STYLES)) {
    assert.ok(style.bpm > 60 && style.bpm < 200 && [3, 4].includes(style.beats));
    assert.equal(style.scale.length, 7);
  }
});

test('scale steps climb octaves', () => {
  const s = STYLES.joropo;
  assert.equal(noteFor(s, 1, 0), s.key);
  assert.equal(noteFor(s, 1, 7), s.key + 12);
  assert.equal(noteFor(s, 5, 0), s.key + 7);
});
