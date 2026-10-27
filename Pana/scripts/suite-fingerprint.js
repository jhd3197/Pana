// A browser suite's fingerprint: one hash over every file it can touch. Two
// runs with the same fingerprint test the same thing, so test-browser.js skips
// a suite whose fingerprint already passed (Pana/tests/.browser-passes.json).
//
// A suite depends on:
//   - its own file and the Node modules it imports (browser-kit.js, fixtures)
//   - every game it opens (openGame(browser, 'x'), /g/x/ in its source): the
//     game's whole folder (public/, server/, game.json), since pages fetch maps,
//     audio and images by computed paths
//   - every served path it names (/engine/…, /studio/…, /character/…, the hub)
//     and, transitively, every module and asset path those name
//   - the server, the lockfile and the hub's game list (a new game.json changes
//     every page that lists games)
// Over-including only costs a cache miss; missing a dependency would hide a
// break until the nightly full run, which ignores the cache.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Served URL prefixes → folders (the server's own mapping, server/src/app.js).
function served(app, url) {
  const clean = url.split(/[?#]/)[0];
  if (clean.startsWith('/engine/')) return path.join(app, clean);
  const game = clean.match(/^\/g\/([a-z0-9-]+)\/?(.*)$/);
  if (game) return path.join(app, 'games', game[1], 'public', game[2]);
  if (/^\/studio(?:\/|\/library\/?|\/workspace\/?|\/assets\/[^/]+\/?)?$/.test(clean)) return path.join(app, 'web', 'studio.html');
  const studioPage = clean.match(/^\/studio\/(settings|guide)\/?$/);
  if (studioPage) return path.join(app, 'web', 'studio', `${studioPage[1]}.html`);
  if (/^\/personaje\/?$/.test(clean)) return path.join(app, 'web', 'personaje.html');
  if (clean.startsWith('/')) return path.join(app, 'web', clean);
  return null;
}

// String literals that look like served paths, plus imports relative to the file.
const URLS = /['"`}](\/(?:engine|g|studio|character|images)\/[^'"`$\s)]*|\/(?:personaje|studio|index)\.html|\/)(?=['"`$])/g;
const RELATIVE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|new URL\(\s*|(?:src|href)=)['"`](\.{1,2}\/[^'"`$\s]+)/g;
const OPENED = /openGame\([^,]+,\s*['"]([a-z0-9-]+)['"]/g;

const listDir = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  if (!fs.statSync(dir).isDirectory()) return [...out, dir];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'qa'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listDir(full, out); else out.push(full);
  }
  return out;
};

export function createFingerprinter(repo) {
  const app = path.join(repo, 'Pana');
  const hashes = new Map();
  const hashOf = file => {
    if (!hashes.has(file)) hashes.set(file, fs.existsSync(file) ? crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex') : 'missing');
    return hashes.get(file);
  };
  const always = [
    ...listDir(path.join(app, 'server', 'src')),
    path.join(repo, 'package-lock.json'),
    ...fs.readdirSync(path.join(app, 'games')).map(g => path.join(app, 'games', g, 'game.json')),
  ];

  // What one file points at: files and folders, read once and remembered.
  const direct = new Map();
  const outsideTests = f => !f.split(path.sep).includes('tests');
  const cards = fs.readdirSync(path.join(app, 'games')).map(g => path.join(app, 'games', g, 'public', 'card.js')).filter(f => fs.existsSync(f));
  const gameFiles = id => listDir(path.join(app, 'games', id)).filter(outsideTests);
  function depsOf(file, isSuite) {
    const key = file + (isSuite ? '#suite' : '');
    if (direct.has(key)) return direct.get(key);
    const out = [];
    if (/\.(m?js|html|css|json)$/.test(file) && fs.existsSync(file)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(URLS)) {
        const url = match[1];
        // A suite that goes to a game's page (/g/x/, /g/x/?debug) loads the whole
        // game; elsewhere a page path is a link, which loads nothing. A file in a
        // game (a song, a module Studio borrows) is that file and what it imports.
        const page = url.match(/^\/g\/([a-z0-9-]+)\/?(?:[?#].*)?$/);
        if (page) { if (isSuite) out.push(...gameFiles(page[1])); }
        // A bare '/' is the hub only when a suite asks for it ('/' is a common string in code).
        // The hub loads every game's tile art (card.js) by a computed path.
        else if (url === '/') { if (isSuite) out.push(...listDir(path.join(app, 'web')).filter(outsideTests), ...cards); }
        // A template path (`/g/bululu/minigames/${id}.js`) names its folder: all of it.
        else if (source.startsWith('${', match.index + match[0].length)) {
          const target = !/^\/(?:engine|studio|character|images|g(?:\/[a-z0-9-]+)?)\/$/.test(url) && served(app, url);
          if (target) out.push(...listDir(target).filter(outsideTests));
        }
        // A served folder named in code (a prefix such as '/engine/') says nothing about what loads.
        else if (!url.endsWith('/')) { const target = served(app, url); if (target) out.push(target); }
      }
      // Relative imports; a template import (`./tracks/${id}.js`) names its folder: all of it.
      for (const [, spec] of source.matchAll(RELATIVE)) {
        const target = path.resolve(path.dirname(file), spec);
        if (spec.endsWith('/')) out.push(...listDir(target)); else out.push(target);
      }
      for (const [, id] of source.matchAll(OPENED)) out.push(...gameFiles(id));
      if (isSuite) {
        // Games picked at run time (a loop over browser-kit's `games`, `/g/${id}/`): every game.
        if (/import\s*\{[^}]*games[^}]*\}\s*from\s*['"][^'"]*browser-kit/.test(source) || /\/g\/\$\{/.test(source) || /openGame\([^,]+,\s*[^'"\s]/.test(source))
          for (const id of fs.readdirSync(path.join(app, 'games'))) out.push(...gameFiles(id));
        // The hub: goto(base) with no path, or any suite of the hub's own pages.
        if (/\.goto\(\s*(?:base|BASE|origin)\s*[,)]/.test(source) || file.split(path.sep).join('/').includes('/Pana/web/tests/'))
          out.push(...listDir(path.join(app, 'web')).filter(outsideTests), ...cards);
      }
    }
    direct.set(key, out);
    return out;
  }

  // Every file reachable from the suite. The `always` files are hashed but not followed.
  function closure(suite, parents = null) {
    const files = new Set(always), queue = [suite];
    while (queue.length) {
      const file = queue.shift();
      if (!file || files.has(file)) continue;
      files.add(file);
      for (const dep of depsOf(file, file === suite)) {
        if (parents && !parents.has(dep)) parents.set(dep, file);
        queue.push(dep);
      }
    }
    return files;
  }
  const rel = f => path.relative(repo, f).split(path.sep).join('/');

  // The fingerprint of one suite run (a variant changes what it tests, so it joins the hash).
  function fingerprint(suiteFile, args = []) {
    const files = [...closure(path.join(repo, suiteFile))].sort();
    const h = crypto.createHash('sha1').update(JSON.stringify(args));
    for (const f of files) h.update(path.relative(repo, f).split(path.sep).join('/')).update(hashOf(f));
    return h.digest('hex').slice(0, 16);
  }
  // The repo paths a suite depends on (for --why and tests).
  fingerprint.files = suiteFile => [...closure(path.join(repo, suiteFile))].map(rel).sort();
  // How a suite reaches a file: [suite, …, file], or null when it doesn't.
  fingerprint.why = (suiteFile, target) => {
    const parents = new Map(), suite = path.join(repo, suiteFile), goal = path.join(repo, target);
    if (!closure(suite, parents).has(goal)) return null;
    const chain = [goal];
    while (parents.has(chain[0]) && chain[0] !== suite) chain.unshift(parents.get(chain[0]));
    return chain.map(rel);
  };
  return fingerprint;
}
