// The modules a page downloads before it runs: every static import reachable
// from an entry module, resolved the way the server maps /engine/* and /g/*.
// Dynamic import() is not followed; that is what loads later.
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const STATIC = /(?:^|[\n;])\s*(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;

// The file a served specifier names, or null for a bare one (three and its
// addons come from the CDN).
export function resolve(from, spec) {
  if (spec.startsWith('/engine/')) return path.join(app, spec);
  if (spec.startsWith('/g/')) { const [, , game, ...rest] = spec.split('/'); return path.join(app, 'games', game, 'public', ...rest); }
  if (spec.startsWith('/')) return path.join(app, 'web', spec);   // the hub, /studio/…
  if (spec.startsWith('.')) return path.resolve(path.dirname(from), spec);
  return null;
}

// Every import specifier in a module with a literal path: static imports,
// re-exports and import('…') with a plain string.
export function specifiers(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return [...code.matchAll(STATIC)].map(m => m[1] || m[2])
    .concat([...code.matchAll(/\bimport\(\s*(['"])([^'"`$]+)\1\s*\)/g)].map(m => m[2]));
}

// { files: Set<absolute path>, bytes, depth } for one entry file. `read` and
// `exists` default to the working tree; npm run budget passes git readers to
// measure another commit.
export function staticImports(entry, { read = (f) => fs.readFileSync(f, 'utf8'), exists = fs.existsSync } = {}) {
  const files = new Set(), depth = new Map();
  let bytes = 0;
  const visit = (file, d) => {
    if (depth.has(file) && depth.get(file) <= d) return;
    depth.set(file, d);
    const source = read(file);
    if (!files.has(file)) { files.add(file); bytes += source.length; }
    for (const m of source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').matchAll(STATIC)) {
      const target = resolve(file, m[1] || m[2]);
      if (target && exists(target)) visit(target, d + 1);
    }
  };
  visit(path.resolve(entry), 0);
  return { files, bytes, depth: Math.max(...depth.values()) };
}
