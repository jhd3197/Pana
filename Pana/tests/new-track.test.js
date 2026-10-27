import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PATHS, REPO, applyPlan, describe, numberWord, parseArgs, planTrack, wordNumber } from '../scripts/new-track.js';

// A temp copy of just the files new-track reads, so the real tree is untouched.
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pana-new-track-'));
  for (const [key, rel] of Object.entries(PATHS)) {
    if (key === 'tracks') continue;
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
  }
  return root;
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('number words round-trip for the README count', () => {
  for (const n of [1, 9, 19, 20, 22, 23, 40, 99]) assert.equal(wordNumber(numberWord(n)), n);
  assert.equal(numberWord(23), 'twenty-three');
  assert.equal(wordNumber('many'), -1);
});

test('arguments parse into options and reject unknown flags', () => {
  assert.deepEqual(parseArgs(['morrocoy', '--name', 'Morrocoy', '--style', 'gaita', '--dry-run']),
    { id: 'morrocoy', name: 'Morrocoy', blurb: null, style: 'gaita', song: null, dryRun: true });
  assert.throws(() => parseArgs(['x', '--color', 'red']), /unknown option/);
  assert.throws(() => parseArgs(['x', '--name']), /needs a value/);
});

test('a new track is registered at every point and gets loadable stubs', () => {
  const root = sandbox();
  try {
    const before = read(root, PATHS.readme).match(/Toy-car racing on ([a-z-]+) circuits/)[1];
    const standaloneBefore = read(root, PATHS.cups).match(/STANDALONE_TRACKS = \[([^\]]*)\]/)[1];
    const changes = planTrack(root, { id: 'morrocoy', name: "Cayo d'Agua", blurb: 'Cayos y manglares.', style: 'calipso' });
    assert.match(describe(changes), /\+ new Pana\/games\/carreritas\/public\/tracks\/morrocoy-world\.js/);
    applyPlan(root, changes);

    assert.match(read(root, PATHS.definitions), /\{id:'morrocoy', name:'Cayo d\\'Agua', blurb:'Cayos y manglares\.'\},\r?\n\];/);
    assert.equal(read(root, PATHS.cups).match(/STANDALONE_TRACKS = \[([^\]]*)\]/)[1], standaloneBefore.trim() ? `${standaloneBefore}, 'morrocoy'` : `'morrocoy'`);
    assert.match(read(root, PATHS.maps), /assert\.deepEqual\(ids, \[[^\]]*, 'morrocoy'\]\)/);
    const music = read(root, PATHS.music);
    assert.match(music, /TRACK_STYLE = \{ morrocoy: 'calipso', /);
    assert.match(music, /,morrocoy:'bululu'\}\)\[trackId\]/);
    const after = read(root, PATHS.readme).match(/Toy-car racing on ([a-z-]+) circuits/)[1];
    assert.equal(wordNumber(after), wordNumber(before) + 1);

    // Each stub is valid module syntax and wires the trio together.
    for (const f of ['morrocoy.js', 'morrocoy-layout.js', 'morrocoy-world.js']) {
      const source = read(root, `${PATHS.tracks}/${f}`), probe = path.join(root, `${f}.mjs`);
      fs.writeFileSync(probe, source);
      const check = spawnSync(process.execPath, ['--check', probe], { encoding: 'utf8' });
      assert.equal(check.status, 0, `${f}: ${check.stderr}`);
    }
    assert.match(read(root, `${PATHS.tracks}/morrocoy.js`), /coastalTrack\('morrocoy', createLayout\(\)/);

    // Running it again refuses instead of registering twice.
    assert.throws(() => planTrack(root, { id: 'morrocoy', name: 'Otra vez' }), /already/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('bad ids, styles, songs and existing tracks are refused', () => {
  const root = sandbox();
  try {
    assert.throws(() => planTrack(root, { id: 'gran-sabana', name: 'X' }), /short lowercase word/);
    assert.throws(() => planTrack(root, { id: 'nuevo' }), /--name/);
    assert.throws(() => planTrack(root, { id: 'nuevo', name: 'X', style: 'reggaeton' }), /--style/);
    assert.throws(() => planTrack(root, { id: 'nuevo', name: 'X', song: 'nada' }), /no recorded song/);
    assert.throws(() => planTrack(root, { id: 'sabana', name: 'X' }), /already/);
    assert.throws(() => planTrack(root, { id: 'salto', name: 'X' }), /water-track-definitions/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
