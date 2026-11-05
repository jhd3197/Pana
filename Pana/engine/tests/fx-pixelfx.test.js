import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { EFFECTS, createRun } from '../fx/pixelfx-bridge.js';

const vendored = new URL('../vendor/pixelfx/', import.meta.url);
const inked = (pixels) => { let n = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) n++; return n; };

test('the licence and notice stay beside the vendored code', () => {
  assert.match(readFileSync(new URL('LICENSE', vendored), 'utf8'), /MIT License[\s\S]*Hugo Duprez/);
  assert.match(readFileSync(new URL('NOTICE.md', vendored), 'utf8'), /Hugo Duprez/);
});

for (const [name, path] of Object.entries(EFFECTS)) {
  test(`${name} draws pixels and finishes on its own`, async () => {
    assert.ok(existsSync(new URL(`fx/${path}.js`, vendored)), 'vendored');
    const core = await import(new URL('core/index.js', vendored));
    const mod = await import(new URL(`fx/${path}.js`, vendored));
    const run = createRun(name, {}, core, mod);
    let peak = 0, steps = 0;
    while (!run.done && steps++ < 400) { if (run.step(1 / 30)) peak = Math.max(peak, inked(run.pixels)); }
    assert.ok(peak > 40, `peak ${peak}`);
    assert.ok(run.done, 'a one-shot ends');
  });
}
