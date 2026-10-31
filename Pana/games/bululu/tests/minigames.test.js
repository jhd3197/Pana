import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MINIGAMES } from '../public/minigames/index.js';

const dir = path.resolve(import.meta.dirname, '..', 'public', 'minigames');
// A title is a Spanish source, plain or marked with locKey().
const quoted = (source, key) => source.match(new RegExp(`\\b${key}: (?:locKey\\()?'([^']+)'`))?.[1];

test('the lazy minigame list matches every minigame module', () => {
  for (const { id, title } of MINIGAMES) {
    const source = fs.readFileSync(path.join(dir, `${id}.js`), 'utf8');
    assert.equal(quoted(source, 'id'), id, `${id}.js id`);
    assert.equal(quoted(source, 'title'), title, `${id}.js title`);
  }
  const modules = fs.readdirSync(dir).filter(f => /^export default \{/m.test(fs.readFileSync(path.join(dir, f), 'utf8')) && /\bcreate\b/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.deepEqual(modules.map(f => f.replace('.js', '')).sort(), MINIGAMES.map(m => m.id).sort());
});
