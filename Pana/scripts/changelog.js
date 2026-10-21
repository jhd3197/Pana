// CHANGELOG.md at release time (run by .github/workflows/release.yml on every merge to main).
//
//   node Pana/scripts/changelog.js next              the version to release, from the last v* tag
//   node Pana/scripts/changelog.js stamp 0.2.0       "## Unreleased" becomes "## 0.2.0 - <date>"
//   node Pana/scripts/changelog.js notes 0.2.0       that version's section: the release notes
//   node Pana/scripts/changelog.js lint              conflict markers, "## Unreleased", bold-led entries
//   node Pana/scripts/changelog.js sync-main         merge origin/main into dev, resolving the changelog
//
// sync-main exists because every release conflicts: release.yml stamps Unreleased on main
// while dev keeps adding to it. The resolution is mechanical (main's file, with dev's
// Unreleased minus the entries main already stamped), so the merge does it; any other
// conflicting file stops the merge for a human.
//
// next: the first release is package.json's version; after that a patch, a minor when a commit
// since the last tag has a "Release: minor" trailer line (older history: a "feat:" subject),
// a major when one says "BREAKING CHANGE". Subjects carry no prefixes (AGENTS.md, "Commits").
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
  if (messages.some(m => /^Release:\s*minor\s*$/im.test(m) || /^feat(\(.+\))?!?:/m.test(m))) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// The "- " entries of a block of changelog text, each with its continuation lines.
export function entries(block) {
  return block.split(/\r?\n(?=- )/).map(e => e.split(/\r?\n(?=#)/)[0].trim()).filter(e => e.startsWith('- '));
}

function unreleased(text) {
  const head = text.match(/^## Unreleased[ \t]*\r?\n/m);
  if (!head) return null;
  const start = head.index + head[0].length, rest = text.slice(start), next = rest.search(/^## /m);
  const end = start + (next < 0 ? rest.length : next);
  return { start, end, body: text.slice(start, end) };
}

// Problems that must never reach a release: conflict markers, a missing Unreleased,
// an Unreleased entry that does not open with a bold sentence (AGENTS.md).
export function lint(text) {
  const problems = [];
  text.split(/\r?\n/).forEach((line, i) => { if (/^(<{7}|={7}|>{7})( |$)/.test(line)) problems.push(`line ${i + 1}: merge conflict marker`); });
  const u = unreleased(text);
  if (!u) problems.push('no "## Unreleased" section');
  else for (const e of entries(u.body)) if (!e.startsWith('- **')) problems.push(`Unreleased entry does not start with a bold sentence: ${e.slice(0, 60)}`);
  return problems;
}

// dev's file merged with main's: main's text (its stamped sections win) with an
// Unreleased holding the entries main has not stamped yet, main's first, then dev's.
export function merge(ours, theirs) {
  const mine = unreleased(ours), main = unreleased(theirs);
  if (!mine || !main) throw new Error('both sides need a "## Unreleased" section');
  const norm = (e) => e.replace(/\s+/g, ' ');
  const stamped = new Set(entries(theirs.slice(main.end)).map(norm));
  const seen = new Set();
  const keep = [...entries(main.body), ...entries(mine.body)].filter(e => {
    const k = norm(e);
    if (stamped.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const after = theirs.slice(main.end).replace(/^\s*/, '');
  return `${theirs.slice(0, main.start)}\n${keep.length ? `${keep.join('\n')}\n\n` : ''}${after}`;
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
  } else if (command === 'lint') {
    const problems = lint(text);
    for (const p of problems) console.error(`CHANGELOG.md ${p}`);
    process.exit(problems.length ? 1 : 0);
  } else if (command === 'sync-main') {
    const run = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    run('fetch', 'origin', 'main');
    try {
      run('merge', '--no-edit', 'origin/main');
      console.log('Merged origin/main cleanly.');
      process.exit(0);
    } catch { /* conflicts: resolve the changelog below */ }
    const conflicted = run('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
    const others = conflicted.filter(f => f !== 'CHANGELOG.md');
    if (others.length) { console.error(`Conflicts besides CHANGELOG.md; resolve by hand: ${others.join(', ')}`); process.exit(1); }
    fs.writeFileSync(CHANGELOG, merge(run('show', ':2:CHANGELOG.md'), run('show', ':3:CHANGELOG.md')));
    const problems = lint(fs.readFileSync(CHANGELOG, 'utf8'));
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    run('add', 'CHANGELOG.md');
    run('commit', '--no-edit');
    console.log("Merged origin/main; CHANGELOG.md resolved (dev's Unreleased minus what main stamped).");
  } else {
    console.error('usage: changelog.js next | stamp <version> | notes <version> | lint | sync-main');
    process.exit(2);
  }
}
