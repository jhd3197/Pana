// CHANGELOG.md at release time (run by .github/workflows/release.yml on every merge to main).
//
//   node Pana/scripts/changelog.js next              the version to release, from the last v* tag
//   node Pana/scripts/changelog.js stamp 0.2.0       "## Unreleased" becomes "## 0.2.0 - <date>"
//   node Pana/scripts/changelog.js notes 0.2.0       that version's section: the release notes
//
// next: the first release is package.json's version; after that a patch, a minor when a commit
// since the last tag starts with "feat:", a major when one says "BREAKING CHANGE".
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(import.meta.dirname, '..', '..');
const CHANGELOG = path.join(repo, 'CHANGELOG.md');
const EMPTY = 'Maintenance release: no changes you will notice.';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function section(text, version) {
  const match = text.match(new RegExp(`^## ${escape(version)} - [^\\n]+\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return match ? match[1].trim() : null;
}

export function stamp(text, version, date) {
  if (section(text, version) !== null) return text;        // a rerun stamps nothing new
  const head = text.match(/^## Unreleased[ \t]*\r?\n/m);
  if (!head) throw new Error('CHANGELOG.md has no "## Unreleased" section');
  const rest = text.slice(head.index + head[0].length);
  const next = rest.search(/^## /m);
  const end = next < 0 ? rest.length : next;
  const body = rest.slice(0, end).trim();
  return `${text.slice(0, head.index)}## Unreleased\n\n## ${version} - ${date}\n\n${body || EMPTY}\n\n${rest.slice(end)}`;
}

export function bump(last, messages, base) {
  if (!last) return base;
  const [major, minor, patch] = last.replace(/^v/, '').split('.').map(Number);
  if (messages.some(m => /BREAKING CHANGE/.test(m))) return `${major + 1}.0.0`;
  if (messages.some(m => /^feat(\(.+\))?!?:/m.test(m))) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function git(...args) {
  try { return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, version] = process.argv.slice(2);
  const text = fs.existsSync(CHANGELOG) ? fs.readFileSync(CHANGELOG, 'utf8') : '';
  if (command === 'next') {
    const last = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*');
    const messages = git('log', '--format=%B%x00', last ? `${last}..HEAD` : 'HEAD').split('\0');
    const base = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version;
    console.log(bump(last, messages, base));
  } else if (command === 'stamp' && version) {
    fs.writeFileSync(CHANGELOG, stamp(text, version, new Date().toISOString().slice(0, 10)));
  } else if (command === 'notes' && version) {
    const notes = section(text, version);
    if (notes === null) { console.error(`No "## ${version}" section in CHANGELOG.md`); process.exit(1); }
    console.log(notes);
  } else {
    console.error('usage: changelog.js next | stamp <version> | notes <version>');
    process.exit(2);
  }
}
