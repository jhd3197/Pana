// npm start; node Pana/engine/tests/farm-animals.browser.js
// Optional PANA_PLAYWRIGHT_PATH / PANA_BROWSER_PATH / PANA_TEST_URL.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const output='art/studio/fauna';await mkdir(output,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1400,height:920}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;font:18px system-ui;color:#303934}header{padding:20px 35px;height:60px;box-sizing:border-box}canvas{display:block}</style></head><body><header>PANA · Fauna del hato</header><canvas></canvas></body></html>`);
  const result=await page.evaluate(async()=>{
    const THREE=await import('three'),{ASSETS}=await import('/studio/catalog.js');
    const {createPreview,inspect,fitCamera,ownMaterials,release}=await import('/studio/preview.js');
    const factories={...await import('/engine/models/fauna/farm/llanero-horse.js'),...await import('/engine/models/fauna/farm/yard-chicken.js'),...await import('/engine/models/fauna/farm/hato-cow.js')},check=(ok,message)=>{if(!ok)throw Error(message);};
    const hash=group=>{
      let h=2166136261;group.updateMatrixWorld(true);
      const mix=v=>{check(Number.isFinite(v),'Non-finite value');h=Math.imul(h^Math.round(v*100000),16777619);};
      group.traverse(o=>{for(const v of o.matrixWorld.elements)mix(v);if(o.geometry)for(const attr of Object.values(o.geometry.attributes))for(const v of attr.array)mix(v);});return h>>>0;
    };
    const stage=createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1400,860,false);stage.camera.aspect=1400/860;
    const records=[],models=[];
    for(const id of ['llanero-horse','yard-chicken','hato-cow']) {
      const asset=ASSETS.find(a=>a.id===id),start=performance.now(),model=await asset.build();
      for(const options of [{seed:NaN},{seed:1.2},{coat:'unknown'},{coat:'constructor'}]) {
        let rejected=false;try{factories[asset.factory](options);}catch(error){rejected=error instanceof RangeError;}
        check(rejected,'Invalid seed/coat accepted');
      }
      const buildMs=Math.round(performance.now()-start),twin=await asset.build(),owned=new Set();
      model.group.traverse(o=>o.geometry&&owned.add(o.geometry));
      twin.group.traverse(o=>check(!owned.has(o.geometry),'Shared geometry'));
      check(hash(model.group)===hash(twin.group),'Non-deterministic construction');release(twin);
      const variation=factories[asset.factory]({seed:33});check(hash(model.group)!==hash(variation),'Seed has no effect');release({group:variation});
      ownMaterials(model);model.update(0,0);const rest=hash(model.group);
      model.update(3,3);check(hash(model.group)!==rest,'Idle does not animate');model.update(0,0);check(hash(model.group)===rest,'Scrubbing accumulates state');
      const skin=model.group.getObjectByName('AnimalSkin'),feet=[];
      for(let i=0;i<skin.geometry.attributes.position.count;i++)if(skin.geometry.attributes.position.getY(i)<.035){const v=new THREE.Vector3();skin.getVertexPosition(i,v);feet.push([i,v]);}
      check(feet.length>20,'Missing grounded feet');
      let minY=Infinity,maxFootDrift=0,feedTime=0,headY=Infinity;
      for(let t=0;t<=60;t+=2) {
        model.update(t,2);hash(model.group);
        for(const [i,restFoot]of feet){const v=new THREE.Vector3();skin.getVertexPosition(i,v);maxFootDrift=Math.max(maxFootDrift,v.distanceTo(restFoot));}
        const bounds=new THREE.Box3().setFromObject(model.group);minY=Math.min(minY,bounds.min.y);
        const headPosition=new THREE.Vector3();model.group.getObjectByName('AnimalHead').getWorldPosition(headPosition);
        if(headPosition.y<headY){headY=headPosition.y;feedTime=t;}
      }
      check(minY>=-.025,`${id}: geometry dips underground (${minY})`);check(maxFootDrift<.0001,'Planted feet slide');
      model.update(0,0);const info=inspect(model);
      check(info.stats.triangles<35000,`${id}: triangle budget exceeded`);check(info.stats.meshes<=18,'Draw budget exceeded');
      // Own shader material cloning must preserve skinning and skeleton cleanup.
      stage.scene.add(model.group);fitCamera(stage.camera,info.frameBounds);stage.renderer.render(stage.scene,stage.camera);
      check(skin.skeleton.boneTexture,'Skinning was not rendered');
      stage.scene.remove(model.group);
      records.push({id,buildMs,...info.stats,minY,maxFootDrift,feedTime,headY});models.push(model);
    }
    // A full native Llanos build proves registration, placement, terrain and ticks.
    const {TRACKS,makeTrack,loadTrack}=await import('/g/carreritas/tracks.js');await loadTrack('llanos');
    const T=makeTrack(TRACKS.find(t=>t.id==='llanos')),map=T.build();
    const environment=map.getObjectByName('track-environment'),fauna=map.getObjectByName('llanos-farm-animals');
    check(fauna?.children.length===19,'Expected three horses, eight chickens and eight cows');
    check(environment.userData.assetCounts['llanero-horse']===3,'Horse count');
    check(environment.userData.assetCounts['yard-chicken']===8,'Chicken count');
    const {clear}=await import('/g/carreritas/tracks/world-kit.js');
    const placements=fauna.children.map(o=>{
      check(clear(T,o.position.x,o.position.z,o.userData.footprintRadius),'Animal enters race corridor');
      check(Math.abs(o.position.y-T.terrainAt(o.position.x,o.position.z)-.02)<.001,'Animal floats above terrain');
      return{species:o.userData.species,position:o.position.toArray()};
    });
    const before=hash(fauna);T.animated.forEach(o=>o.userData.tick?.(4));check(hash(fauna)!==before,'Environment does not animate animals');
    window.farmProof={THREE,stage,models,records,map,T,release,inspect,fitCamera};
    window.farmShow=(index,view='perspective',t=0)=>{
      stage.scene.remove(map);models.forEach(m=>stage.scene.remove(m.group));
      const model=models[index];model.update(t,0);stage.scene.add(model.group);
      fitCamera(stage.camera,inspect(model).frameBounds,false,view);stage.renderer.render(stage.scene,stage.camera);
    };
    return{records,placements};
  });
  for(const [i,id]of ['horse','chicken','cow'].entries())for(const view of ['perspective','side','front']) {
    await page.evaluate(([i,view])=>farmShow(i,view),[i,view]);await page.screenshot({path:`${output}/${id}-${view}.png`});
  }
  for(const [i,id]of ['horse','chicken','cow'].entries()) {
    await page.evaluate(i=>farmShow(i,'side',farmProof.records[i].feedTime),i);await page.screenshot({path:`${output}/${id}-feeding.png`});
  }
  // Show the actual ranch layout from a ground-level camera, with native assets.
  await page.evaluate(()=>{
    const {stage,models,map,THREE,T}=farmProof;models.forEach(m=>stage.scene.remove(m.group));stage.scene.add(map);
    T.animated.forEach(o=>o.userData.tick?.(0));
    stage.camera.position.set(-216,10,136);stage.camera.lookAt(new THREE.Vector3(-233,4,109));stage.camera.far=400;stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);
  });
  await page.screenshot({path:`${output}/llanos-ranch.png`});
  const cleanup=await page.evaluate(()=>{
    const {models,release,stage,map}=farmProof;let disposed=0;
    for(const model of models){const skin=model.group.getObjectByName('AnimalSkin');skin.skeleton.boneTexture.addEventListener('dispose',()=>disposed++);release(model);model.group.userData.dispose();}
    release({group:map});stage.dispose();return disposed;
  });
  assert.equal(cleanup,3,'Each owned skeleton texture disposed once');assert.deepEqual(errors,[]);
  await writeFile(`${output}/metrics.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
