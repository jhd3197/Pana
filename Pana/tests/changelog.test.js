import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { section, stamp, bump } from '../scripts/changelog.js';

const sample = `# Changelog

Intro.

## Unreleased

### Added

- **Something new.**

## Before the changelog

Old games.
`;

test('stamp moves the Unreleased notes under the version, above the history', () => {
  const out = stamp(sample, '0.2.0', '2026-10-16');
  assert.match(out, /## Unreleased\n\n## 0\.2\.0 - 2026-10-16\n\n### Added\n\n- \*\*Something new\.\*\*\n\n## Before the changelog/);
  assert.equal(section(out, '0.2.0'), '### Added\n\n- **Something new.**');
});

test('stamping twice changes nothing; an empty release says so', () => {
  const once = stamp(sample, '0.2.0', '2026-10-16');
  assert.equal(stamp(once, '0.2.0', '2026-10-17'), once);
  assert.equal(section(stamp(once, '0.2.1', '2026-10-17'), '0.2.1'), 'Maintenance release: no changes you will notice.');
});

test('a changelog without Unreleased is an error', () => {
  assert.throws(() => stamp('# Changelog\n', '1.0.0', 'x'), /Unreleased/);
});

test('the first release is package.json; then patch, Release: minor (or feat:) minor, BREAKING CHANGE major', () => {
  assert.equal(bump('', ['anything'], '0.1.0'), '0.1.0');
  assert.equal(bump('v0.1.0', ['Fix a thing'], '0.1.0'), '0.1.1');
  assert.equal(bump('v0.1.3', ['feat: rooms'], '0.1.0'), '0.2.0');
  assert.equal(bump('v0.1.3', ['Add rooms\n\nWhy rooms.\n\nRelease: minor'], '0.1.0'), '0.2.0');
  assert.equal(bump('v0.1.3', ['Add rooms\n\nA minor detail.'], '0.1.0'), '0.1.4');
  assert.equal(bump('v0.4.2', ['Rework\n\nBREAKING CHANGE: new protocol'], '0.1.0'), '1.0.0');
});

test('the real CHANGELOG.md has an Unreleased section to stamp', () => {
  const text = fs.readFileSync(path.resolve(import.meta.dirname, '../../CHANGELOG.md'), 'utf8');
  assert.doesNotThrow(() => stamp(text, '99.0.0', '2099-01-01'));
});

test('lint finds conflict markers, a missing Unreleased and plain entries', async () => {
  const { lint } = await import('../scripts/changelog.js');
  assert.deepEqual(lint(sample), []);
  const marked = sample.replace('### Added', '<<<<<<< HEAD\n### Added\n=======\n>>>>>>> origin/main');
  assert.equal(lint(marked).filter(p => p.includes('conflict marker')).length, 3);
  assert.ok(lint('# Changelog\n\n## 0.1.0 - x\n').some(p => p.includes('Unreleased')));
  assert.ok(lint(sample.replace('- **Something new.**', '- Something new.')).some(p => p.includes('bold')));
});

test('merge keeps what main has not stamped and drops what it has', async () => {
  const { merge, lint, entries } = await import('../scripts/changelog.js');
  const dev = '# Changelog\n\n## Unreleased\n\n- **New on dev.**\n  More.\n- **Shipped already.**\n\n## 0.1.0 - 2026-10-16\n\n- **Old.**\n';
  const main = '# Changelog\n\n## Unreleased\n\n## 0.2.0 - 2026-10-20\n\n- **Shipped already.**\n\n## 0.1.0 - 2026-10-16\n\n- **Old.**\n';
  const out = merge(dev, main);
  assert.deepEqual(lint(out), []);
  const unreleased = out.slice(out.indexOf('## Unreleased'), out.indexOf('## 0.2.0'));
  assert.deepEqual(entries(unreleased), ['- **New on dev.**\n  More.']);
  assert.match(out, /## 0\.2\.0 - 2026-10-20\n\n- \*\*Shipped already\.\*\*/);
  assert.equal(merge(main, main), main.replace('## Unreleased\n\n', '## Unreleased\n\n'), 'nothing new: main unchanged');
});
