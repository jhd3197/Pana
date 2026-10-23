// Native-model proof for Pueblo 011–020 and Páramo 051–060.
// node Pana/engine/tests/settlements.browser.js [pueblo|paramo]
// PANA_PLAYWRIGHT_PATH, PANA_BROWSER_PATH and PANA_TEST_URL are optional.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const sets = { pueblo: { category: 'Pueblo', ids: [], title: 'Pueblo · 011–020' }, paramo: { category: 'Páramo', ids: ['frailejon', 'mountainPine'], title: 'Páramo · 051–060' } };
const key = process.argv[2] || 'pueblo', set = sets[key], output = `art/studio/${key}`;
assert.ok(set, 'Expected pueblo or paramo');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1030 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.PANA_TEST_URL || 'http://localhost:8461'}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;color:#303934;font:16px system-ui}header{height:70px;box-sizing:border-box;padding:24px 35px;font-weight:600}canvas{display:block;width:1500px;height:960px}.label{position:absolute;width:300px;text-align:center;pointer-events:none}.label span{display:block;font:12px monospace;color:#69766e;margin-top:5px}</style></head><body><header>PANA · ${set.title}</header><canvas></canvas><div id="labels"></div></body></html>`);
  const metrics = await page.evaluate(async set => {
    const THREE = await import('three'), { ASSETS } = await import('/studio/catalog.js');
    const { createPreview, inspect, fitCamera, ownMaterials } = await import('/studio/preview.js');
    const hash = root => {
      let h = 2166136261; root.updateMatrixWorld(true);
      root.traverse(o => {
        if (!o.geometry) return;
        for (const attr of Object.values(o.geometry.attributes)) for (const v of attr.array) {
          if (!Number.isFinite(v)) throw Error('Non-finite geometry'); h = Math.imul(h ^ Math.round(v * 10000), 16777619);
        }
        for (const v of o.matrixWorld.elements) {
          if (!Number.isFinite(v)) throw Error('Non-finite transform'); h = Math.imul(h ^ Math.round(v * 10000), 16777619);
        }
      }); return h >>> 0;
    };
    const dispose = group => group.traverse(o => { o.geometry?.dispose(); o.userData.dispose?.(); });
    // Category Pueblo also contains newer circuit-life models, and the mountain pack
    // gained unnumbered cave and ledge pieces. This proof owns the original numbered
    // packs (tags[0] is the catalogue number), not every future asset sharing a pack.
    const numbered = a => /^\d{3}$/.test(a.tags?.[0] ?? '');
    const assets = ASSETS.filter(a => (a.pack === (set.category === 'Pueblo' ? 'pueblo' : 'mountain') && numbered(a)) || set.ids.includes(a.id)).sort((a,b) => a.tags[0].localeCompare(b.tags[0]));
    const models = [], details = [];
    for (const asset of assets) {
      const model = await asset.build(), twin = await asset.build(), owned = new Set();
      model.group.traverse(o => o.geometry && owned.add(o.geometry));
      twin.group.traverse(o => { if (owned.has(o.geometry)) throw Error(`${asset.id} shares geometry`); });
      if (hash(model.group) !== hash(twin.group)) throw Error(`${asset.id} is not deterministic`);
      dispose(twin.group);
      if (model.update) {
        model.update(0, 0); const still = hash(model.group);
        model.update(1.3, 1.3); if (hash(model.group) === still) throw Error(`${asset.id} animation does not move`);
        model.update(0, 0); if (hash(model.group) !== still) throw Error(`${asset.id} animation accumulates`);
      }
      ownMaterials(model); const info = inspect(model);
      details.push({ id: asset.id, name: asset.name, ...info.stats, minY: info.bounds.min.y, animated: !!model.update }); models.push(model);
    }
    const ray = (group, origin, dir, far) => {
      group.updateMatrixWorld(true);
      return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...dir), 0, far).intersectObject(group, true);
    };
    if (set.category === 'Páramo') {
      const { mountainSuspensionBridge, mountainGuardrail, rockyCliff, mountainTent, cableCarStation } = await import('/engine/models/props/mountain.js');
      const station=cableCarStation(),cabin=station.getObjectByName('Gondola');
      for(const t of [0,4,12]){station.userData.tick(t);station.updateMatrixWorld(true);const anchor=cabin.getWorldPosition(new THREE.Vector3());if(Math.abs(anchor.y-4.5)>.001||Math.abs(anchor.z-.7)>.001)throw Error('Gondola detached from cable');}
      dispose(station);
      for (const build of [mountainSuspensionBridge, mountainGuardrail]) {
        let previous = 0;
        for (const span of [6, 16, 28]) {
          const group = build({ span }); hash(group); const b = new THREE.Box3().setFromObject(group);
          if (b.max.x - b.min.x <= previous || b.min.y < -0.05) throw Error('Span or grounding regression'); previous = b.max.x - b.min.x;
          if (build === mountainSuspensionBridge) {
            if (ray(group, [-span / 2 - 2, 1.8, 0], [1,0,0], span + 4).length) throw Error('Bridge walkway blocked');
            const n = Math.ceil(span / 0.3);
            for (let i = 0; i < n; i++) if (!ray(group, [-span/2+(i+.5)*span/n, 1.5, 0], [0,-1,0], 1).length) throw Error('Bridge missing deck plank');
            for (const side of [-1,1]) for (let i=0;i<4;i++) for (const z of [-.85,.85]) {
              if (!ray(group,[side*(span/2+3.44-i*.37),1.5,z],[0,-1,0],1.5).length) throw Error('Bridge stair too narrow');
            }
          }
          dispose(group);
        }
        for (const span of [0, -1, NaN, Infinity, 45]) {
          let rejected = false; try { build({ span }); } catch (e) { rejected = e instanceof RangeError; }
          if (!rejected) throw Error('Invalid span accepted');
        }
      }
      const cliff = rockyCliff();
      for (const side of [-1,1]) if (!ray(cliff,[side*5,2.5,0],[-side,0,0],2).length) throw Error('Cliff end faces point inward');
      if (!ray(cliff,[0,6,0],[0,-1,0],2).length) throw Error('Cliff has no solid top');
      const edge = (group,x) => {
        const result = new Set(); group.updateMatrixWorld(true);
        group.traverse(o=>{ if(!o.geometry?.attributes.color)return; const p=o.geometry.attributes.position;
          for(let i=0;i<p.count;i++) if(Math.abs(p.getX(i)-x)<.001)result.add(`${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`);
        }); return [...result].sort().join(';');
      };
      const next = rockyCliff({seed:87}); if(edge(cliff,4)!==edge(next,-4))throw Error('Cliff module seams do not join'); dispose(cliff); dispose(next);
      for(const options of [{width:0},{height:NaN},{depth:Infinity}]){let rejected=false;try{rockyCliff(options);}catch(e){rejected=e instanceof RangeError;}if(!rejected)throw Error('Invalid cliff dimension accepted');}
      const tent = mountainTent(); if(ray(tent,[.35,.65,3],[0,0,-1],1.4).length)throw Error('Tent entrance blocked'); dispose(tent);
      const { frailejon } = await import('/engine/models/vegetation/frailejon.js');
      const { mountainPine } = await import('/engine/models/vegetation/mountain-pine.js');
      for(const build of [frailejon,mountainPine]){const a=build({seed:3}),b=build({seed:8});if(hash(a)===hash(b))throw Error('Plant seed has no effect');dispose(a);dispose(b);}
      for(const [build,heights]of [[frailejon,[.8,3.5]],[mountainPine,[3,14]]]){
        for(const h of heights){const group=build({h});hash(group);if(new THREE.Box3().setFromObject(group).min.y<-.05)throw Error('Plant height lost ground origin');dispose(group);}
        for(const h of [0,NaN,Infinity]){let rejected=false;try{build({h});}catch(e){rejected=e instanceof RangeError;}if(!rejected)throw Error('Invalid plant height accepted');}
      }
    } else {
      const { basketballHoop, plazaClockTower } = await import('/engine/models/props/pueblo.js');
      const hoop=basketballHoop(); if(ray(hoop,[0,3.4,1.08],[0,-1,0],1.1).length)throw Error('Basketball rim/net is blocked'); dispose(hoop);
      const clock=plazaClockTower();clock.userData.tick(43200);const noon=hash(clock);clock.userData.tick(0);if(hash(clock)!==noon)throw Error('Clock does not repeat after 12 hours');dispose(clock);
    }
    const stage = createPreview(document.querySelector('canvas'), true); stage.renderer.setSize(1500,960,false); stage.renderer.setScissorTest(true);
    models.forEach((model,i)=>{
      const x=i%5*300,y=960-(Math.floor(i/5)+1)*480;
      stage.scene.add(model.group);stage.camera.aspect=300/480;fitCamera(stage.camera,inspect(model).bounds);
      stage.renderer.setViewport(x,y,300,480);stage.renderer.setScissor(x,y,300,480);stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(model.group);
      const label=document.createElement('div');label.className='label';label.style.left=`${x}px`;label.style.top=`${70+960-y-40}px`;
      label.innerHTML=`${details[i].name}<span>${assets[i].tags[0]} · ${details[i].triangles.toLocaleString('es')} tri · ${details[i].meshes} mallas</span>`;document.getElementById('labels').append(label);
    });
    window.proof={stage,models,inspect,fitCamera};return details;
  },set);
  await page.screenshot({path:`${output}/models.png`});await writeFile(`${output}/metrics.json`,JSON.stringify(metrics,null,2));
  await page.evaluate(()=>{
    const {stage,models,inspect,fitCamera}=proof;
    models.forEach((model,i)=>{
      const x=i%5*300,y=960-(Math.floor(i/5)+1)*480,b=inspect(model).bounds;
      stage.scene.add(model.group);stage.camera.aspect=300/480;
      const {center}=fitCamera(stage.camera,b);stage.camera.position.x=2*center.x-stage.camera.position.x;stage.camera.position.z=2*center.z-stage.camera.position.z;stage.camera.lookAt(center);
      stage.renderer.setViewport(x,y,300,480);stage.renderer.setScissor(x,y,300,480);stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(model.group);
    });
  });
  await page.screenshot({path:`${output}/backs.png`});
  assert.equal(metrics.length,10);
  for(const m of metrics){assert.ok(m.triangles<90000,`${m.id} triangles ${m.triangles}`);assert.ok(m.meshes<=32,`${m.id} draw calls ${m.meshes}`);assert.ok(m.minY>-.05,`${m.id} ground ${m.minY}`);assert.ok(m.dimensions.every(v=>v>.15&&v<30),`${m.id} bounds ${m.dimensions}`);}
  await page.setViewportSize({width:900,height:760});
  for(let i=0;i<metrics.length;i++){
    await page.evaluate(i=>{
      const {stage,models,inspect,fitCamera}=proof;
      document.querySelector('header').hidden=true;document.getElementById('labels').hidden=true;
      const canvas=document.querySelector('canvas');canvas.style.width='900px';canvas.style.height='760px';
      stage.renderer.setScissorTest(false);stage.renderer.setSize(900,760,false);stage.renderer.setViewport(0,0,900,760);
      models.forEach(m=>stage.scene.remove(m.group));stage.scene.add(models[i].group);stage.camera.aspect=900/760;fitCamera(stage.camera,inspect(models[i]).bounds);stage.renderer.render(stage.scene,stage.camera);
    },i);
    await page.screenshot({path:`${output}/${metrics[i].id}.png`});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify(metrics.map(({id,triangles,meshes,dimensions})=>({id,triangles,meshes,dimensions:dimensions.map(v=>+v.toFixed(2))})),null,1));
  console.log(`PASS: ${set.title}: ownership, determinism, grounding, animation, usable geometry and rendering`);
} finally {await browser.close();}
