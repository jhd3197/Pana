// Regenerates docs/knowledge/model-inventory.{md,json} from the real Studio
// registry and checks every manually reviewed source anchor. A doc generator,
// not a test suite: `npm run inventory` (or `node Pana/scripts/model-inventory.js`).
// Starts its own server on a free port; set PANA_TEST_URL to reuse a running one.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startServer} from './pana-server.js';
import {uncataloged,assemblies,dormant,replaced,priorities} from './inventory-notes.js';
const repo=path.resolve(import.meta.dirname,'../..');
process.chdir(repo);
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const server=await startServer();
const browser=await chromium.launch({headless:true});
let assets;
try{
  const page=await browser.newPage();
  await page.goto(`${server.base}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  assets=await page.evaluate(async()=>{
    const {ASSETS,sourcePath}=await import('/studio/catalog.js');
    return ASSETS.map(({id,name,category,source,factory,usedBy,previewOptions})=>({id,name,category,source:sourcePath(source),factory,usedBy,previewOptions,
      status:usedBy.every(g=>g==='Pana Studio')?'preview-only':'in-use'}));
  });
}finally{await browser.close();server.stop();}
const counts={};for(const asset of assets)counts[asset.category]=(counts[asset.category]||0)+1;
if(new Set(assets.map(a=>a.id)).size!==assets.length)throw Error('Duplicate catalog IDs');
const sources=new Map();
async function source(file){if(!sources.has(file))sources.set(file,await readFile(file,'utf8'));return sources.get(file);}
for(const record of [...uncataloged,...assemblies,...dormant]){
  const text=await source(record.source),lines=text.split(/\r?\n/);
  const line=lines.findIndex(line=>line.replace(/\s/g,'').includes(record.anchor.replace(/\s/g,'')));
  if(line<0)throw Error(`Stale inventory anchor: ${record.name} / ${record.anchor}`);
  record.line=line+1;
}
for(const asset of assets)await source(asset.source);
const previewOnly=assets.filter(a=>a.status==='preview-only');
const inventory={date:new Date().toISOString().slice(0,10),scope:'Current production 3D resource/model families; catalog variants and scene assemblies are counted separately. No primitive-mesh count or deleted-history total.',
  counts:{catalog:assets.length,categories:counts,previewOnly:previewOnly.length,uncatalogedFamilies:uncataloged.length,sceneFamilies:assemblies.length,dormantFactories:dormant.length},assets,uncataloged,assemblies,dormant,replaced,priorities};
const out='docs/knowledge/model-inventory';
await writeFile(`${out}.json`,JSON.stringify(inventory,null,2)+'\n');
const cell=value=>String(value??'').replaceAll('|',' / ').replaceAll('\n',' ');
const table=(head,rows)=>[head,head.map(()=>'---'),...rows].map(row=>`| ${row.map(cell).join(' | ')} |`).join('\n');
const codeLink=(source,line)=>`[${source.split('/').at(-1)}](../../${source}${line?`#L${line}`:''})`;
const section=(title,rows)=>`## ${title}\n\n${table(['Resource / family','Current location','Source','Finding'],rows.map(r=>[r.name,r.where,codeLink(r.source,r.line),r.note]))}\n`;
let md=`# Pana — current model inventory\n\nAudited ${inventory.date}. Generated from the real Studio registry plus a reviewed source ledger.\n\n`;
md+=`**${assets.length} Studio resources**, including **${counts.Fauna} Fauna entries**, **${counts.Vegetación} vegetation entries**, **${counts.Vehículos} vehicles** and **${counts.Mapas} maps**. **${previewOnly.length} resources are preview-only.** The separate ledger identifies **${uncataloged.length} active uncataloged model families**, **${assemblies.length} scene/effect families** and **${dormant.length} dormant factories/hooks**. These numbers must not be added into a “unique 3D models” total: maps contain models, variants share geometry, and some ledger rows group multiple related props.\n\n`;
md+='Scope: current production geometry in `engine/` and the four games, including Bululú minigames, gameplay props, embedded wardrobe options and map scenery. Individual meshes, geometry helpers, UI/SVG art, generated screenshots, dependency internals and historical deleted revisions are excluded. Catalog consumer labels identify games, not instance counts. Active uncataloged entries were traced to their placement sources; presence in source does not guarantee visibility from every camera. Legacy rows are retained explicitly instead of being presented as new content.\n\n';
md+='Canonical model sources now live in `Pana/engine/models/`, organized by domain. Shared definitions are plain metadata; Studio scene adapters stay in `web/studio/catalog/`. Old engine URLs are compatibility aliases, not additional assets. See [model library architecture](../../Pana/engine/models/README.md) for adding models and preserving ownership, animation and cache dependencies.\n\n';
md+='## Birds and fauna — resolved\n\nThe seven birds had not disappeared. They were missing from Studio and shared one primitive box-wing builder. This audit replaces that builder with three distinct shared models and registers a natural capybara, taking Fauna from six to ten entries (nine animal models plus the fish-school assembly). The old “toucan/seagull” comment described possible recolors; no dedicated current models existed for those birds.\n\n';
md+=table(['Map','Current fauna verified','Change'],[
  ['Selva','1 guacamaya + 1 chigüire','Replaced the generic bird and random dressed player-character animal.'],
  ['Los Llanos','4 corocoras + 3 chigüires; existing 3 horses, 8 chickens and 8 cows','Species-specific ibis; same canonical capybara factory as Selva. Farm animals retained.'],
  ['Desierto','2 soaring zamuros','Old unspecified brown birds now have a vulture silhouette.'],
  ['Bululú board','5 reef schools / 30 fish; beach crabs','Existing fish were already present; not copied as part of this audit.'],
  ['Bululú circuit','4 reef schools / 24 fish; beach crabs','Existing fish and coastal pack retained.'],
])+'\n\nFlight faces its travel direction, and all new animation rewinds using absolute time. Selva and Llanos share `wildCapybara`, which reuses `capybaraForm`; the natural animal is separate from the dressed Pana character. These are native Pana procedural models, with no new downloaded model or license dependency.\n\n';
md+='## What to build or update next\n\n'+table(['Action','Work','Where','Why'],priorities)+'\n\n';
md+='## Available but not placed\n\nThese already exist. Their absence from a map is a placement gap, not a missing-model request. Waterfall rocks were incorrectly labeled preview-only; they are used in Chi Chi and the catalog label is now corrected.\n\n';
md+=table(['Studio name','ID','Source'],previewOnly.map(a=>[a.name,a.id,codeLink(a.source)]))+'\n\n';
md+=section('Active models missing from individual Studio previews',uncataloged)+'\n';
md+=section('Scene assemblies, terrain, effects and embedded parts',assemblies)+'\n';
md+=section('Older code with no current enabled placement',dormant)+'\n';
md+=section('Replaced models and compatibility aliases',replaced)+'\n';
md+='## Complete Studio registry\n\nThe following list is generated, not manually copied. “In use” is the catalog’s current declared consumer status; detailed native placement proof exists for the fauna and recent packs. Color/seed variants are not separate rows unless Studio explicitly registers them. The seated driver now declares Carreritas and the forced chef preview declares Cocina; normal wardrobe options remain shared across games.\n\n';
for(const category of Object.keys(counts).sort()){
  md+=`### ${category} (${counts[category]})\n\n`;
  md+=table(['Name / ID','Status / games','Source','Constructor'],assets.filter(a=>a.category===category).map(a=>[`${a.name} · ${a.id}`,a.status==='preview-only'?'Preview only':a.usedBy.filter(g=>g!=='Pana Studio').join(', '),codeLink(a.source),a.factory]))+'\n\n';
}
md+='## Keep this inventory current\n\nRun `npm run inventory` (`node Pana/scripts/model-inventory.js`); it starts its own server. The script exports this Markdown report and `model-inventory.json`, verifies every source anchor, and reads all catalog entries. Review `Pana/scripts/inventory-notes.js` when moving/removing geometry: anchor checks catch stale locations but do not automatically discover new inline models or prove call-graph reachability.\n\n';
md+='Run `npm run test:browser -- wildlife` for geometry ownership, finite bounds, timeline rewind, flight heading, all seven birds/four capybaras, terrain/road clearance and native-map screenshots. `art/studio/wildlife/` holds the local proof. The audit does not delete dormant factories or silently replace older map assemblies.\n';
await writeFile(`${out}.md`,md);
console.log(JSON.stringify(inventory.counts,null,2));
