// Worktrees and branches that are done: a branch already merged into dev, or a
// detached worktree whose commit dev already contains. Lists them; --apply
// removes them.
//
//   npm run tidy               what would go
//   npm run tidy -- --apply    remove it
//   .\dev.ps1 tidy [-Apply]    the same
//
// A worktree's node_modules is usually a junction to the main checkout's: it
// is unlinked first, so removing the worktree can never reach the real one. A
// worktree with uncommitted changes, local plans or art is never removed. Branches not merged,
// main and dev are never touched.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = path.resolve(import.meta.dirname, '..', '..');
const apply = process.argv.includes('--apply');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

const merged = new Set(git('branch', '--merged', 'dev', '--format=%(refname:short)').split('\n').filter(Boolean));
const keep = new Set(['main', 'dev']);

// git worktree list --porcelain: blocks of "worktree <path>", "HEAD <sha>", "branch refs/heads/x" | "detached".
const worktrees = git('worktree', 'list', '--porcelain').split(/\n\n+/).map(block => {
  const line = (k) => block.split('\n').find(l => l.startsWith(`${k} `))?.slice(k.length + 1);
  return { dir: line('worktree'), head: line('HEAD'), branch: line('branch')?.replace('refs/heads/', '') ?? null };
}).filter(w => w.dir && !same(w.dir, repo));

const plan = [];
for (const w of worktrees) {
  const done = w.branch ? merged.has(w.branch) && !keep.has(w.branch) : tryGit('merge-base', '--is-ancestor', w.head, 'dev') !== null;
  if (!done) { console.log(`keep      ${w.dir}  (${w.branch ?? 'detached'}: not in dev)`); continue; }
  // Local plans and art are ignored, so a plain status never shows them.
  const status = fs.existsSync(w.dir) ? tryGit('-C', w.dir, 'status', '--porcelain', '--ignored') : '';
  const lines = status?.split('\n').filter(Boolean) ?? [];
  const dirty = status === null ? 'status failed'
    : lines.some(l => !l.startsWith('!! ')) ? 'uncommitted changes'
    : lines.some(l => /^!! (docs\/plans|art)\//.test(l)) ? 'local plans or art' : '';
  if (dirty) { console.log(`keep      ${w.dir}  (${w.branch ?? 'detached'}: ${dirty})`); continue; }
  plan.push(w);
  console.log(`${apply ? 'remove' : 'would go'}  ${w.dir}  (${w.branch ?? 'detached'}: already in dev)`);
}
const looseBranches = [...merged].filter(b => !keep.has(b) && !worktrees.some(w => w.branch === b));
for (const b of looseBranches) console.log(`${apply ? 'delete' : 'would go'}  branch ${b}  (merged into dev)`);

if (!apply) {
  if (plan.length || looseBranches.length) console.log('\nRun with --apply (or .\\dev.ps1 tidy -Apply) to remove them.');
  else console.log('Nothing to tidy.');
  process.exit(0);
}

for (const w of plan) {
  const modules = path.join(w.dir, 'node_modules');
  let link = false;
  try { link = fs.lstatSync(modules).isSymbolicLink() || fs.readlinkSync(modules) !== null; } catch { /* none, or a real folder */ }
  if (link) { try { fs.unlinkSync(modules); } catch { try { fs.rmdirSync(modules); } catch { /* handled below */ } } }
  if (link && fs.existsSync(modules)) { console.log(`skipped   ${w.dir}: could not unlink its node_modules junction`); continue; }
  if (!link && fs.existsSync(modules)) console.log(`note      ${w.dir} has its own node_modules; removing it with the worktree`);
  tryGit('worktree', 'remove', '--force', w.dir);
  if (w.branch) tryGit('branch', '-d', w.branch);
}
for (const b of looseBranches) tryGit('branch', '-d', b);
git('worktree', 'prune');
console.log('Done.');
