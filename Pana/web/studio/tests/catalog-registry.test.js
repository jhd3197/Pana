// Studio catalog registration integrity, in Node and in seconds: every entry's
// source file exists and exports its factory, ids are unique, packs and
// categories are known. The browser suites (vegetation, wildlife,
// water-world-assets, model-library) then build what this registers; they
// should never be the first to notice a typo in a catalog row.
// Run with `npm test -- catalog-registry` (needs Pana/scripts/register-paths.js).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ASSETS, CATEGORIES, sourcePath } from '/studio/catalog.js';
import { MODEL_DEFINITIONS } from '/engine/models/catalog.js';
import { object } from '/studio/catalog/objects.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const onDisk = url => path.join(repo, sourcePath(url));
const sources = new Map();
const read = file => {
  if (!sources.has(file)) sources.set(file, fs.readFileSync(file, 'utf8'));
  return sources.get(file);
};
const escape = name => name.replace(/[$]/g, '\\$');

// Lexical export check: model modules import 'three' (not installed for Node),
// so they cannot be loaded here. Follows `export * from` and named re-exports.
function exportsName(file, name, seen = new Set()) {
  if (seen.has(file) || !fs.existsSync(file)) return false;
  seen.add(file);
  const source = read(file), id = escape(name);
  if (new RegExp(`export\\s+(?:async\\s+)?(?:function\\s*\\*?|const|let|var|class)\\s+${id}(?![\\w$])`).test(source)) return true;
  for (const [, list] of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    if (list.split(',').some(part => part.trim().split(/\s+as\s+/).pop().trim() === name)) return true;
  }
  for (const [, spec] of source.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    if (spec.startsWith('.') && exportsName(path.resolve(path.dirname(file), spec), name, seen)) return true;
  }
  return false;
}

test('ids are unique across the whole Studio catalog', () => {
  const seen = new Map();
  for (const asset of ASSETS) {
    assert.ok(typeof asset.id === 'string' && asset.id, `Entry without an id: ${asset.name}`);
    assert.ok(!seen.has(asset.id), `Duplicate Studio id "${asset.id}" (${seen.get(asset.id)} and ${asset.source})`);
    seen.set(asset.id, asset.source);
  }
});

test('every shared model definition reaches Studio', () => {
  const ids = new Set(ASSETS.map(a => a.id));
  for (const model of MODEL_DEFINITIONS) assert.ok(ids.has(model.id), `${model.id} is defined but not in Studio`);
});

test('every entry is complete and in a known category', () => {
  const categories = new Set(CATEGORIES);
  for (const asset of ASSETS) {
    assert.ok(asset.name && asset.source && asset.factory, `Incomplete entry: ${asset.id}`);
    assert.ok(Array.isArray(asset.usedBy) && asset.usedBy.length, `${asset.id}: usedBy must list games or 'Pana Studio'`);
    assert.ok(categories.has(asset.category), `${asset.id}: unknown category "${asset.category}" (add it to CATEGORIES)`);
    assert.equal(typeof asset.build, 'function', `${asset.id}: no build()`);
  }
});

test('every source and declared dependency exists', () => {
  for (const asset of ASSETS) {
    assert.ok(fs.existsSync(onDisk(asset.source)), `${asset.id}: missing source ${asset.source}`);
    for (const dep of asset.dependencies || []) assert.ok(fs.existsSync(onDisk(dep)), `${asset.id}: missing dependency ${dep}`);
  }
});

// Entries built by the generic object() adapter import `source` and call
// `factory` at build time; a wrong name there only failed in a browser suite.
// Scene adapters (cars, wheels, tracks) have their own build() and use
// `factory` as a label, so only their source is checked above.
const generic = object({}).build.toString();
const adapted = ASSETS.filter(a => a.build.toString() === generic);

test('every generic model factory is exported by its source', () => {
  assert.ok(adapted.length >= MODEL_DEFINITIONS.length, 'object() adapter not detected');
  const missing = [];
  for (const asset of adapted) {
    const name = asset.factory;
    if (!exportsName(onDisk(asset.source), name)) missing.push(`${asset.id}: ${asset.source} does not export ${name}`);
  }
  assert.deepEqual(missing, []);
});
