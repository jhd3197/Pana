// Seeded vegetation geometry, ownership and Studio render proof.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const base=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/studio/vegetation';
await mkdir(output,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1500,height:1030},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;color:#303934;font:16px system-ui}header{height:70px;box-sizing:border-box;padding:24px 35px;font-weight:600}canvas{display:block;width:1500px;height:960px}.label{position:absolute;width:500px;text-align:center;pointer-events:none}.label span{display:block;font:12px monospace;color:#69766e;margin-top:5px}</style></head><body><header>PANA · Vegetación nueva</header><canvas></canvas><div id="labels"></div></body></html>`);
  const metrics=await page.evaluate(async()=>{
    const THREE=await import('three'),flora=await import('/engine/flora.js'),{ASSETS}=await import('/studio/catalog.js');
    const {createPreview,inspect,fitCamera,ownMaterials}=await import('/studio/preview.js');
    const ids=['araguaney','bamboo','fern','monstera','heliconia','cactus','mangrove','papaya','agave','waterLily','hibiscus','reeds'],vegetation=ASSETS.filter(a=>a.category==='Vegetación');
    const hash=root=>{
      let hash=2166136261;root.updateMatrixWorld(true);
      root.traverse(o=>{if(!o.geometry)return;
        for(const attr of Object.values(o.geometry.attributes))for(const v of attr.array){if(!Number.isFinite(v))throw Error('Non-finite geometry');hash=Math.imul(hash^Math.round(v*10000),16777619);}
      });return hash>>>0;
    };
    const models=[],details=[];
    for(const id of ids) {
      const asset=ASSETS.find(a=>a.id===id),model=await asset.build(),same=flora[id]({seed:7}),other=flora[id]({seed:31});
      if(hash(model.group)!==hash(same)||hash(same)===hash(other))throw Error(`${id}: seed determinism/variation`);
      const owned=new Set();model.group.traverse(o=>{if(o.geometry)owned.add(o.geometry);});
      same.traverse(o=>{if(owned.has(o.geometry))throw Error(`${id}: shared disposable geometry`);o.geometry?.dispose();});other.traverse(o=>o.geometry?.dispose());
      for(const seed of [0,1,81]){const variant=flora[id]({seed});hash(variant);variant.traverse(o=>o.geometry?.dispose());}
      const bounds=new THREE.Box3().setFromObject(model.group,true),batched=flora.bake(model.group),after=new THREE.Box3().setFromObject(batched,true);
      if(bounds.min.distanceTo(after.min)+bounds.max.distanceTo(after.max)>0.001)throw Error(`${id}: batching changed bounds`);
      batched.traverse(o=>o.geometry?.dispose());ownMaterials(model);models.push(model);
      details.push({id,name:asset.name,...inspect(model).stats,minY:bounds.min.y});
    }
    const stage=createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1500,960,false);stage.renderer.setScissorTest(true);
    const renderSheet=start=>{models.slice(start,start+6).forEach((model,i)=>{
      stage.scene.add(model.group);stage.camera.aspect=500/435;fitCamera(stage.camera,inspect(model).bounds);
      stage.renderer.setViewport(i%3*500,Math.floor(i/3)?35:515,500,435);stage.renderer.setScissor(i%3*500,Math.floor(i/3)?35:515,500,435);
      stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(model.group);
    });
    document.querySelector('#labels').innerHTML=details.slice(start,start+6).map((m,i)=>`<div class="label" style="left:${i%3*500}px;top:${Math.floor(i/3)*480+505}px">${m.name}<span>${m.triangles.toLocaleString('es')} tri · ${m.meshes} mallas</span></div>`).join('');
    };
    renderSheet(0);window.vegetationProof={models,stage,inspect,fitCamera,THREE,renderSheet};return {vegetation:vegetation.map(a=>a.id),details};
  });
  await page.screenshot({path:`${output}/new-plants.png`});
  await page.evaluate(()=>vegetationProof.renderSheet(6));
  await page.screenshot({path:`${output}/six-more-plants.png`});
  for(let i=0;i<metrics.details.length;i++) {
    await page.setViewportSize({width:900,height:800});
    await page.evaluate(i=>{
      const {models,stage,inspect,fitCamera}=vegetationProof;document.querySelector('header').hidden=true;document.querySelector('#labels').hidden=true;
      Object.assign(document.querySelector('canvas').style,{width:'900px',height:'800px'});stage.renderer.setScissorTest(false);stage.renderer.setSize(900,800,false);stage.renderer.setViewport(0,0,900,800);
      models.forEach(m=>stage.scene.remove(m.group));const model=models[i];stage.scene.add(model.group);stage.camera.aspect=900/800;
      fitCamera(stage.camera,inspect(model).bounds);stage.renderer.render(stage.scene,stage.camera);
    },i);await page.screenshot({path:`${output}/${metrics.details[i].id}.png`});
    await page.evaluate(i=>{const {models,stage,inspect,fitCamera}=vegetationProof;fitCamera(stage.camera,inspect(models[i]).bounds,false,'side');stage.renderer.render(stage.scene,stage.camera);},i);
    await page.screenshot({path:`${output}/${metrics.details[i].id}-side.png`});
  }
  assert.equal(metrics.vegetation.length,20);assert.equal(new Set(metrics.vegetation).size,20);
  for(const m of metrics.details) {
    assert.ok(m.triangles<12000,`${m.id} triangle budget`);assert.ok(m.meshes<=6,`${m.id} draw-call budget`);
    assert.ok(m.minY>=-0.08,`${m.id} grounded origin`);assert.ok(m.dimensions.every(d=>d>0.1&&d<12));
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/metrics.json`,JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
  console.log('PASS: twenty catalog plants; deterministic/varied seeds, geometry ownership, ground origins, batching and twelve render proofs');
}finally{await browser.close();}
