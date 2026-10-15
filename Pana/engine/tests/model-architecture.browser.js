// Real ESM export identity and selective thumbnail invalidation across the library.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const engine=new URL('../',import.meta.url),aliases=[];
for(const dir of ['', 'soft-character/']) for(const name of await readdir(new URL(dir,engine))) {
  if(!name.endsWith('.js'))continue;
  const source=await readFile(new URL(dir+name,engine),'utf8');
  if(!source.startsWith('// Compatibility URL.'))continue;
  for(const match of source.matchAll(/export\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
    aliases.push({old:`/engine/${dir}${name}`,target:match[2],names:match[1].split(',').map(s=>s.trim())});
  }
}
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const result=await page.evaluate(async aliases=>{
    const {ASSETS}=await import('/studio/catalog.js'),{MODEL_DEFINITIONS}=await import('/engine/models/catalog.js');
    const check=(value,message)=>{if(!value)throw Error(message);};
    check(new Set(ASSETS.map(a=>a.id)).size===ASSETS.length,'Duplicate Studio IDs');
    for(const definition of MODEL_DEFINITIONS) {
      check(typeof (await import(definition.source))[definition.factory]==='function',`Missing factory: ${definition.id}`);
      check(ASSETS.some(a=>a.id===definition.id),`Missing preview: ${definition.id}`);
    }
    let symbols=0;
    for(const alias of aliases){
      const old=await import(alias.old),canonical=await import(alias.target);
      for(const name of alias.names){check(old[name]!==undefined&&old[name]===canonical[name],`Broken alias ${alias.old}#${name}`);symbols++;}
    }
    window.catalog=ASSETS;window.fingerprints=(await import('/studio/fingerprints.js')).fingerprints;
    window.before=await fingerprints(catalog);
    return {models:MODEL_DEFINITIONS.length,assets:ASSETS.length,symbols};
  },aliases);
  async function changedBy(source) {
    const pattern=`**${source}`;
    await page.route(pattern,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\n// Simulated geometry edit\n'});});
    try{return await page.evaluate(async()=>{const after=await fingerprints(catalog);return catalog.filter(a=>after.get(a.id)!==before.get(a.id)).map(a=>a.id);});}
    finally{await page.unroute(pattern);}
  }
  const bird=await changedBy('/engine/models/fauna/birds/scarlet-macaw.js');
  assert.ok(bird.includes('scarlet-macaw')&&bird.includes('track-selva'),'Bird and consuming map must invalidate');
  for(const id of ['scarlet-ibis','soaring-vulture','hato-cow','llanero-horse','reef-fish','corn'])assert.ok(!bird.includes(id),`Bird invalidated unrelated ${id}`);
  const horse=await changedBy('/engine/models/fauna/farm/llanero-horse.js');
  assert.ok(horse.includes('llanero-horse')&&horse.includes('track-llanos'));
  for(const id of ['hato-cow','yard-chicken','wild-capybara','corn'])assert.ok(!horse.includes(id),`Horse invalidated unrelated ${id}`);
  const plant=await changedBy('/engine/models/vegetation/palm.js');
  assert.ok(plant.includes('palm')&&plant.includes('isla'));
  for(const id of ['bush','mangoTree','hato-cow','corn'])assert.ok(!plant.includes(id),`Palm invalidated unrelated ${id}`);
  assert.deepEqual(errors,[]);console.log('PASS exports, aliases and isolated cache invalidation',result);
} finally {await browser.close();}
