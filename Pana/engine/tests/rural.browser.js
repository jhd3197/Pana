// Native-model proof for Llanos 041–050 and Desierto 061–070.
// node Pana/engine/tests/rural.browser.js [llanos|desierto]
// PANA_PLAYWRIGHT_PATH, PANA_BROWSER_PATH and PANA_TEST_URL are optional.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const sets = { llanos: { category: 'Llanos', ids: [], title: 'Llanos · 041–050' }, desierto: { category: 'Desierto', ids: [], title: 'Desierto · 061–070' } };
const key = process.argv[2] || 'llanos', set = sets[key], output = `art/studio/${key}`;
assert.ok(set, 'Expected llanos or desierto');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1030 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.PANA_TEST_URL || 'http://localhost:8461'}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;color:#303934;font:16px system-ui}header{height:70px;box-sizing:border-box;padding:24px 35px;font-weight:600}canvas{display:block;width:1500px;height:960px}.label{position:absolute;width:300px;text-align:center;pointer-events:none}.label span{display:block;font:12px monospace;color:#69766e;margin-top:5px}</style></head><body><header>PANA · ${set.title}</header><canvas></canvas><div id="labels"></div></body></html>`);
  const metrics = await page.evaluate(async set => {
    const THREE = await import('three'), { ASSETS } = await import('/studio/catalog.js');
    const { createPreview, inspect, fitCamera, ownMaterials, release } = await import('/studio/preview.js');
    const hash = root => {
      let h = 2166136261; root.updateMatrixWorld(true);
      root.traverse(o => {
        if (!o.geometry) return;
        for (const attr of Object.values(o.geometry.attributes)) for (const v of attr.array) {
          if (!Number.isFinite(v)) throw Error('Non-finite geometry'); h = Math.imul(h ^ Math.round(v * 10000), 16777619);
        }
        if(o.material?.uniforms?.time)h=Math.imul(h ^ Math.round(o.material.uniforms.time.value*10000),16777619);
        for (const v of o.matrixWorld.elements) {
          if (!Number.isFinite(v)) throw Error('Non-finite transform'); h = Math.imul(h ^ Math.round(v * 10000), 16777619);
        }
      }); return h >>> 0;
    };
    const dispose = group => { const callbacks=[],geometries=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.userData.dispose)callbacks.push(o.userData.dispose);});callbacks.forEach(fn=>fn());geometries.forEach(geo=>geo.dispose()); };
    const assets = ASSETS.filter(a => a.category === set.category || set.ids.includes(a.id)).sort((a,b) => a.tags[0].localeCompare(b.tags[0]));
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
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const invalid=(factory,options)=>{let rejected=false;try{factory(options);}catch(e){rejected=e instanceof RangeError;}check(rejected,'Invalid dimension accepted');};
    if(set.category==='Llanos') {
      const { corralGate, ranchFence, horseStable, waterWindmill, mudPuddle } = await import('/engine/models/props/ranch.js');
      for(const span of [3,6,20]) {
        const gate=corralGate({span,open:1});
        check(!ray(gate,[0,1,3],[0,0,-1],6).length,'Open gate blocks passage');
        gate.userData.setOpen(0);check(ray(gate,[span*.22,1.05,3],[0,0,-1],6).length,'Closed gate missing rails');
        invalid(corralGate,{open:1.5});dispose(gate);
      }
      for(const span of [2,8,30]){const f=ranchFence({span});const b=new THREE.Box3().setFromObject(f);check(Math.abs(b.max.x-b.min.x-span-.19)<.01,'Fence span incorrect');dispose(f);}
      for(const span of [0,NaN,Infinity,31])invalid(ranchFence,{span});
      const stable=horseStable();check(!ray(stable,[0,1,4],[0,0,-1],4).length,'Stable middle stall blocked');dispose(stable);
      const wind=waterWindmill();wind.userData.tick(1);check(wind.getObjectByName('PumpRod').position.y>0,'Pump failed');dispose(wind);
      for(const height of [0,NaN,17])invalid(waterWindmill,{height});
      const puddle=mudPuddle();const model={group:puddle};ownMaterials(model);puddle.userData.tick(12);let material;
      puddle.traverse(o=>{if(o.userData.waterSurface){material=o.material;check(o.material.uniforms.time.value===12,'Puddle animates stale material');}});
      let disposed=false;material.addEventListener('dispose',()=>disposed=true);release(model);check(disposed,'Puddle shader was not disposed');
      for(const rx of [0,NaN,13])invalid(mudPuddle,{rx});
    } else {
      const { desertRockArch, desertWell, roadsideTirePile, sandDune, canyonSpire, giantCactus } = await import('/engine/models/props/desert.js');
      for(const span of [4,8,21]){const a=desertRockArch({span,height:10});for(const x of [-span*.4,0,span*.4])check(!ray(a,[x,2,8],[0,0,-1],16).length,'Arch passage blocked');check(ray(a,[0,16,0],[0,-1,0],10).length,'Arch missing roof');dispose(a);}
      const well=desertWell();const hits=ray(well,[.65,1.8,.5],[0,-1,0],2);check(hits.length&&hits[0].point.y<.1,'Well mouth is capped');check(ray(well,[1.2,2,0],[0,-1,0],2).length,'Well rim missing');dispose(well);
      const tires=roadsideTirePile();check(!ray(tires,[0,2,0],[0,-1,0],3).length,'Tire stack is not hollow');dispose(tires);
      for(const seed of [1,88]){const dune=sandDune({seed});dune.traverse(o=>{const p=o.geometry?.attributes.position;if(!p)return;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>6.999||Math.abs(p.getZ(i))>4.999)check(Math.abs(p.getY(i))<.0001,'Dune edge does not meet ground');});dispose(dune);}
      for(const build of [sandDune,canyonSpire,giantCactus]){const a=build({seed:1}),b=build({seed:5});check(hash(a)!==hash(b),'Seed has no effect');dispose(a);dispose(b);}
      for(const height of [0,NaN,Infinity]){invalid(sandDune,{height});invalid(canyonSpire,{height});invalid(giantCactus,{height});}
      for(const span of [0,NaN,29])invalid(desertRockArch,{span});
    }
    const stage = createPreview(document.querySelector('canvas'), true); stage.renderer.setSize(1500,960,false); stage.renderer.setScissorTest(true);
    models.forEach((model,i)=>{
      const x=i%5*300,y=960-(Math.floor(i/5)+1)*480;
      stage.scene.add(model.group);stage.camera.aspect=300/480;const frame=fitCamera(stage.camera,inspect(model).bounds);stage.camera.position.sub(frame.center).multiplyScalar(1.2).add(frame.center);
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
      const {center}=fitCamera(stage.camera,b);stage.camera.position.sub(center).multiplyScalar(1.2).add(center);stage.camera.position.x=2*center.x-stage.camera.position.x;stage.camera.position.z=2*center.z-stage.camera.position.z;stage.camera.lookAt(center);
      stage.renderer.setViewport(x,y,300,480);stage.renderer.setScissor(x,y,300,480);stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(model.group);
    });
  });
  await page.screenshot({path:`${output}/backs.png`});
  assert.equal(metrics.length,10);
  for(const m of metrics){assert.ok(m.triangles<60000,`${m.id} triangles ${m.triangles}`);assert.ok(m.meshes<=32,`${m.id} draw calls ${m.meshes}`);assert.ok(m.minY>-.05,`${m.id} ground ${m.minY}`);assert.ok(m.dimensions.every(v=>v>.01&&v<30),`${m.id} bounds ${m.dimensions}`);}
  await page.setViewportSize({width:900,height:760});
  for(let i=0;i<metrics.length;i++){
    await page.evaluate(i=>{
      const {stage,models,inspect,fitCamera}=proof;
      document.querySelector('header').hidden=true;document.getElementById('labels').hidden=true;
      const canvas=document.querySelector('canvas');canvas.style.width='900px';canvas.style.height='760px';
      stage.renderer.setScissorTest(false);stage.renderer.setSize(900,760,false);stage.renderer.setViewport(0,0,900,760);
      models.forEach(m=>stage.scene.remove(m.group));stage.scene.add(models[i].group);stage.camera.aspect=900/760;const frame=fitCamera(stage.camera,inspect(models[i]).bounds);stage.camera.position.sub(frame.center).multiplyScalar(1.12).add(frame.center);stage.renderer.render(stage.scene,stage.camera);
    },i);
    await page.screenshot({path:`${output}/${metrics[i].id}.png`});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify(metrics.map(({id,triangles,meshes,dimensions})=>({id,triangles,meshes,dimensions:dimensions.map(v=>+v.toFixed(2))})),null,1));
  console.log(`PASS: ${set.title}: ownership, determinism, grounding, animation, usable geometry and rendering`);
} finally {await browser.close();}
