import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createGame } from '../scripts/new-game.js';

test('a name with an apostrophe and a quoted description scaffold valid code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pana-scaffold-'));
  try {
    for (const kind of ['table', 'live']) {
      const id = `palante${kind}`;
      createGame([id, '--kind', kind, '--name', "Pa'lante", '--description', 'El "mejor" <juego>'], { root, docs: root });
      const pub = path.join(root, 'games', id, 'public');
      execFileSync(process.execPath, ['--check', path.join(pub, 'game.js')]);
      assert.match(fs.readFileSync(path.join(pub, 'index.html'), 'utf8'), /content="El &quot;mejor&quot; &lt;juego&gt;"/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
