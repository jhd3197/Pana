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

test('the first release is package.json; then patch, feat: minor, BREAKING CHANGE major', () => {
  assert.equal(bump('', ['anything'], '0.1.0'), '0.1.0');
  assert.equal(bump('v0.1.0', ['Fix a thing'], '0.1.0'), '0.1.1');
  assert.equal(bump('v0.1.3', ['feat: rooms'], '0.1.0'), '0.2.0');
  assert.equal(bump('v0.4.2', ['Rework\n\nBREAKING CHANGE: new protocol'], '0.1.0'), '1.0.0');
});

test('the real CHANGELOG.md has an Unreleased section to stamp', () => {
  const text = fs.readFileSync(path.resolve(import.meta.dirname, '../../CHANGELOG.md'), 'utf8');
  assert.doesNotThrow(() => stamp(text, '99.0.0', '2099-01-01'));
});
