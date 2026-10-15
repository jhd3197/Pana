// Native model and placement proof: npm start; PANA_PLAYWRIGHT_PATH optional.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),output='art/studio/coastal';
await mkdir(output,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;font:15px system-ui;color:#334642}canvas{display:block}.label{position:absolute;width:300px;text-align:center;pointer-events:none}</style><canvas></canvas><div id="labels"></div>');
  const metrics=await page.evaluate(async()=>{
    const THREE=await import('three'),preview=await import('/studio/preview.js'),{ASSETS}=await import('/studio/catalog.js');
    const assets=ASSETS.filter(a=>a.pack==='coastal'),models=[],metrics=[];
    const check=(ok,msg)=>{if(!ok)throw Error(msg);};
    const hash=root=>{
      root.updateMatrixWorld(true);let h=2166136261;
      root.traverse(o=>{
        for(const v of o.matrixWorld.elements){check(Number.isFinite(v),'Nonfinite transform');h=Math.imul(h^Math.round(v*1e5),16777619);}
        if(o.geometry)for(const attr of Object.values(o.geometry.attributes))for(const v of attr.array){check(Number.isFinite(v),'Nonfinite geometry');h=Math.imul(h^Math.round(v*1e5),16777619);}
      });return h;
    };
    for(const asset of assets){
      const model=await asset.build(),twin=await asset.build(),geometry=new Set();
      model.group.traverse(o=>o.geometry&&geometry.add(o.geometry));
      twin.group.traverse(o=>check(!geometry.has(o.geometry),'Shared geometry'));
      check(hash(model.group)===hash(twin.group),`${asset.id} geometry differs`);
      preview.ownMaterials(twin);preview.release(twin);
      preview.ownMaterials(model);model.update?.(0,0);const zero=hash(model.group);
      if(model.update){model.update(4.7,0);check(hash(model.group)!==zero,`${asset.id} not animated`);model.update(0,0);check(hash(model.group)===zero,`${asset.id} does not rewind`);}
      const info=preview.inspect(model);
      check(info.bounds.min.y>=-.025,`${asset.id} below ground ${info.bounds.min.y}`);
      check(info.stats.triangles<16000&&info.stats.meshes<20,`${asset.id} budget`);
      if(asset.id==='fishing-boat'){
        const ray=new THREE.Raycaster(new THREE.Vector3(0,.12,.35),new THREE.Vector3(0,-1,0),0,.08);
        check(ray.intersectObject(model.group,true).length>0,'Boat keel is open underneath');
      }
      models.push(model);metrics.push({id:asset.id,...info.stats,minY:info.bounds.min.y});
    }
    const stage=preview.createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1500,1000,false);stage.renderer.setScissorTest(true);
    models.forEach((model,i)=>{
      const x=i%5*300,y=1000-(Math.floor(i/5)+1)*500;
      stage.scene.add(model.group);stage.camera.aspect=.6;const frame=preview.fitCamera(stage.camera,preview.inspect(model).bounds);stage.camera.position.sub(frame.center).multiplyScalar(1.5).add(frame.center);
      stage.renderer.setViewport(x,y,300,500);stage.renderer.setScissor(x,y,300,500);stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(model.group);
      const label=document.createElement('div');label.className='label';label.style.left=`${x}px`;label.style.top=`${1000-y-33}px`;label.textContent=assets[i].name;document.getElementById('labels').append(label);
    });
    window.proof={THREE,preview,ASSETS,stage,models,check,hash};return metrics;
  });
  assert.equal(metrics.length,10);await page.screenshot({path:`${output}/collection.png`});
  await page.setViewportSize({width:1000,height:800});
  for(let i=0;i<metrics.length;i++){
    await page.evaluate(i=>{
      const {stage,models,preview}=proof;document.getElementById('labels').hidden=true;
      stage.renderer.setScissorTest(false);stage.renderer.setSize(1000,800,false);stage.renderer.setViewport(0,0,1000,800);stage.camera.aspect=1.25;
      stage.scene.add(models[i].group);preview.fitCamera(stage.camera,preview.inspect(models[i]).bounds);stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(models[i].group);
    },i);
    await page.screenshot({path:`${output}/${metrics[i].id}.png`});
  }
  const placements=[];
  for(const id of ['track-bululu','isla']){
    const record=await page.evaluate(async id=>{
      const {THREE,preview,ASSETS,stage,check}=proof;
      let model,board;
      if(id==='isla'){
        const {createBoard}=await import('/g/bululu/board.js'),group=new THREE.Scene();board=createBoard(group);
        const lights=[];group.traverse(o=>{if(o.isLight)lights.push(o);});lights.forEach(o=>o.removeFromParent());
        model={group,groundAt:board.groundAt,update:(t,dt)=>board.update(t,dt)};
      }else model=await ASSETS.find(a=>a.id===id).build();
      preview.ownMaterials(model);proof.model=model;
      model.update?.(0,0);stage.scene.add(model.group);
      const coast=model.group.getObjectByName(id==='isla'?'island-coastal-props':'roques-coastal-props');check(!!coast,'Missing coastal group');
      const details=coast.children.filter(o=>o.userData.assetId).map(o=>({id:o.userData.assetId,position:o.position.toArray(),radius:o.userData.footprintRadius}));
      const expected=ASSETS.filter(a=>a.pack==='coastal'&&(id!=='isla'||a.usedBy.includes('Bululú')));
      for(const asset of expected)check(details.some(d=>d.id===asset.id),`${id} missing ${asset.id}`);
      coast.updateMatrixWorld(true);
      for(const crab of coast.children.filter(o=>o.userData.species==='crab'))crab.children[0].traverse(o=>{
        if(!o.geometry)return;const p=o.geometry.attributes.position;
        for(let i=0;i<p.count;i++)if(p.getY(i)<.06){
          const foot=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
          check(Math.abs(foot.y-model.groundAt(foot.x,foot.z))<.16,`${id} crab feet do not follow beach slope`);
        }
      });
      for(const d of details){
        const [x,,z]=d.position;
        if(model.route)check(Math.abs(model.route.offsetOf(x,z))>model.route.HW+d.radius+5,`${d.id} blocks road`);
        if(d.id==='fishing-boat')for(const dx of [-4,0,4])for(const dz of [-4,0,4])check(model.groundAt(x+dx,z+dz)<d.position[1]-.3,`${id} boat enters shore`);
      }
      if(board)for(const d of details)check(board.pathDist(d.position[0],d.position[2])>d.radius+4,`${d.id} blocks board tiles`);
      const pose=()=>coast.children.filter(o=>o.userData.tick).flatMap(o=>{o.updateMatrixWorld(true);return o.children.flatMap(c=>c.matrixWorld.elements);});
      const start=pose();model.update?.(31,0);check(JSON.stringify(pose())!==JSON.stringify(start),'Map animation does not tick');model.update?.(0,0);check(JSON.stringify(pose())===JSON.stringify(start),'Map animation fails rewind');
      stage.camera.far=5000;stage.camera.aspect=1.25;
      if(model.route){stage.scene.background=new THREE.Color(model.route.def?.palette?.horizon||0xc1e6ea);stage.camera.position.set(300,38,170);stage.camera.lookAt(270,4,65);}
      else{stage.camera.position.set(165,21,60);stage.camera.lookAt(138,0,24);}
      stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);return{id,details};
    },id);
    placements.push(record);await page.screenshot({path:`${output}/${id}-coast.png`});
    if(id==='track-bululu'){
      await page.evaluate(async()=>{
        const {stage,model}=proof,{tourPose}=await import('/studio/track-tour.js');
        const distance=(model.route.paramOf(285,145)-100-model.route.LINE+model.route.TOTAL)%model.route.TOTAL;
        const pose=tourPose(model.route,distance);stage.camera.position.copy(pose.position);stage.camera.lookAt(pose.target);stage.camera.fov=64;stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);
      });
      await page.screenshot({path:`${output}/track-bululu-road.png`});
    }
    await page.evaluate(()=>{proof.preview.release(proof.model);proof.stage.camera.fov=34;});
    console.log(`${id}: ${record.details.length} coastal placements`);
  }
  await page.evaluate(()=>{
    const {models,preview,check}=proof;
    for(const model of models){let disposed=0,textures=0,expected=0;model.group.traverse(o=>{o.geometry?.addEventListener('dispose',()=>disposed++);if(o.material?.map){expected++;o.material.map.addEventListener('dispose',()=>textures++);}});preview.release(model);check(disposed>0,'Geometry not released');check(textures===expected,'Texture not released');}
  });
  assert.deepEqual(errors,[]);await writeFile(`${output}/proof.json`,JSON.stringify({metrics,placements},null,2));console.log('PASS coastal models, ownership, animation, map placement and road clearance');
}finally{await browser.close();}
