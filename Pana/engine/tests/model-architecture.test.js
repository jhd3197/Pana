// No browser/dependencies: registry purity, import resolution and layer boundaries.
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const app = fileURLToPath(new URL('../../', import.meta.url));
const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(path.join(dir,e.name)) : path.join(dir,e.name)))).flat();
const files = (await walk(path.join(app,'engine/models'))).filter(p=>p.endsWith('.js'));
const local = url => path.join(app, url.slice(1));
const graph = new Map(), metadata = new Set();
for (const file of files) {
  const source = await readFile(file,'utf8'), url = '/' + path.relative(app,file).split(path.sep).join('/');
  const imports = [...source.matchAll(/(?:\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?|\bimport\s*\()\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const dependencies = [];
  for (const spec of imports) {
    if (spec.startsWith('three')) continue;
    const target = spec.startsWith('.') ? new URL(spec,`https://pana.invalid${url}`).pathname : spec;
    assert.ok(target.startsWith('/engine/models/') || target.startsWith('/engine/vendor/') || target==='/engine/avatar.js', `${url} imports outside the model layer: ${target}`);
    assert.ok((await stat(local(target))).isFile(),`${url}: missing ${target}`);
    if (url.includes('/core/')) assert.ok(target.startsWith('/engine/models/core/'),`Core imports a concrete model: ${url} -> ${target}`);
    dependencies.push(target);
  }
  graph.set(url,dependencies);
  if (url.endsWith('/catalog.js') || url.includes('/props/catalog/') || url.endsWith('-definitions.js')) {
    metadata.add(url);
    assert.ok(!imports.some(s=>s.startsWith('three')),`Catalog imports the renderer: ${url}`);
    assert.doesNotMatch(source,/\bnew\s|\basync\s|\bimport\s*\(/,`Catalog constructs or loads models: ${url}`);
  }
}
const visited=new Set(),active=new Set();
function visit(url) {
  assert.ok(!active.has(url),`Model dependency cycle at ${url}`);
  if (visited.has(url)) return;
  active.add(url); for(const dep of graph.get(url)||[]) visit(dep); active.delete(url); visited.add(url);
}
for(const url of graph.keys()) visit(url);
for(const url of metadata) for(const dep of graph.get(url)) assert.ok(metadata.has(dep),`Metadata imports geometry: ${url} -> ${dep}`);
const { MODEL_DEFINITIONS } = await import(pathToFileURL(path.join(app,'engine/models/catalog.js')));
assert.equal(new Set(MODEL_DEFINITIONS.map(a=>a.id)).size,MODEL_DEFINITIONS.length,'Duplicate shared model ID');
for(const model of MODEL_DEFINITIONS) {
  assert.ok(model.id && model.name && model.category && model.factory && model.usedBy.length,`Incomplete definition: ${model.id}`);
  assert.ok(graph.has(model.source),`Missing source: ${model.id}`);
  assert.ok(!model.source.endsWith('/index.js'),`Catalog must point to concrete geometry: ${model.id}`);
  assert.deepEqual(structuredClone(model),JSON.parse(JSON.stringify(model)),`Model metadata must be serializable: ${model.id}`);
}
console.log(`PASS ${files.length} model modules: no cycles, valid imports, pure catalog, ${MODEL_DEFINITIONS.length} unique model definitions`);
