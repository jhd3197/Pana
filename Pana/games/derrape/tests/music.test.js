import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STYLES, SONGS, TRACK_STYLE, GARAGE_SONG, RESULTS_SONG, songFor, finishSting, noteFor } from '../public/music.js';
import { rateFor } from '../../../engine/music.js';
import { TRACK_IDS } from '../public/online-rules.js';

const root = path.resolve(import.meta.dirname, '../../..');
const briefs = JSON.parse(fs.readFileSync(path.join(root, 'scripts/music/songs.json'), 'utf8')).songs;
const briefIds = new Set(briefs.map(s => s.id));

test('every track has a groove and every groove is complete', () => {
  for (const id of TRACK_IDS) assert.ok(STYLES[TRACK_STYLE[id]], id);
  for (const style of Object.values(STYLES)) {
    assert.ok(style.bpm > 60 && style.bpm < 200 && [3, 4].includes(style.beats));
    assert.equal(style.scale.length, 7);
  }
});

test('every track, mode and jingle has a song brief', () => {
  for (const id of TRACK_IDS) assert.ok(briefIds.has(songFor(id, 'race')), id);
  for (const id of [songFor('estadio', 'battle'), GARAGE_SONG, RESULTS_SONG, finishSting(true), finishSting(false)]) assert.ok(briefIds.has(id), id);
});

test('recorded songs exist on disk and loop inside their length', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    const brief = briefs.find(s => s.id === id);
    assert.ok(brief, id);
    assert.ok(fs.existsSync(path.join(root, brief.out)), brief.out);
    assert.equal(brief.loop === false, !song.loop, id);
    if (song.loop) assert.ok(song.loop[0] > 0 && song.loop[1] - song.loop[0] > 20, id);
  }
});

test('tempo bends a recording gently', () => {
  assert.equal(rateFor(1), 1);
  assert.ok(rateFor(1.14) > 1.05 && rateFor(1.14) < 1.08);
  assert.ok(rateFor(0.6) > 0.7);
});

test('scale steps climb octaves', () => {
  const s = STYLES.joropo;
  assert.equal(noteFor(s, 1, 0), s.key);
  assert.equal(noteFor(s, 1, 7), s.key + 12);
  assert.equal(noteFor(s, 5, 0), s.key + 7);
});
