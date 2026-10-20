// Real shared factories, placement, flight direction and timeline regression.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),output='art/studio/wildlife';
await mkdir(output,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;font:18px system-ui;color:#334642}canvas{display:block}.label{position:absolute;top:600px;width:350px;text-align:center}</style><canvas></canvas><div id="labels"></div>');
  const metrics=await page.evaluate(async()=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg);};
    const THREE=await import('three'),preview=await import('/studio/preview.js'),{ASSETS}=await import('/studio/catalog.js');
    // The four map animals the tracks place; the rest of the wildlife pack (river, coast, iguanas)
    // gets the same factory checks below, its timeline checked only when it animates. No origin or mesh
    // cap there: a tonina swims, a perched iguana's tail hangs, and 20 meshes is the flocks' budget.
    const MAP_WILDLIFE=['scarlet-macaw','scarlet-ibis','soaring-vulture','wild-capybara'];
    const pack=ASSETS.filter(a=>a.pack==='wildlife'),assets=MAP_WILDLIFE.map(id=>pack.find(a=>a.id===id)),models=[],metrics=[];
    check(assets.every(Boolean),'Map wildlife missing from the wildlife pack');
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
      check(hash(model.group)===hash(twin.group),`${asset.id} nondeterministic`);
      preview.ownMaterials(twin);preview.release(twin);preview.ownMaterials(model);
      const zero=hash(model.group);model.update(5.1,0);check(hash(model.group)!==zero,'No motion');
      model.update(0,0);check(hash(model.group)===zero,'Failed rewind');
      const info=preview.inspect(model);check(info.stats.triangles<40000&&info.stats.meshes<20,'Budget exceeded');
      check(info.bounds.min.y>=-.025,'Below origin');models.push(model);metrics.push({id:asset.id,...info.stats});
    }
    for(const asset of pack.filter(a=>!MAP_WILDLIFE.includes(a.id))){
      const model=await asset.build(),twin=await asset.build(),geometry=new Set();
      model.group.traverse(o=>o.geometry&&geometry.add(o.geometry));
      twin.group.traverse(o=>check(!geometry.has(o.geometry),`${asset.id} shared geometry`));
      check(hash(model.group)===hash(twin.group),`${asset.id} nondeterministic`);
      preview.ownMaterials(twin);preview.release(twin);preview.ownMaterials(model);
      if(model.update){model.update(0,0);const zero=hash(model.group);model.update(5.1,0);check(hash(model.group)!==zero,`${asset.id} no motion`);model.update(0,0);check(hash(model.group)===zero,`${asset.id} failed rewind`);}
      const info=preview.inspect(model);check(info.stats.triangles<40000,`${asset.id} budget exceeded`);
      preview.release(model);
    }
    const { orbitBird } = await import('/engine/models/animation/orbit-bird.js');
    const { scarletMacaw } = await import('/engine/models/fauna/birds/scarlet-macaw.js');
    for(const speed of [.4,-.4]){
      const b=orbitBird(scarletMacaw(),{cx:0,cz:0,cy:20,r:20,speed,phase:.6});
      b.userData.tick(3);const p=b.position.clone();b.userData.tick(3.001);
      const tangent=b.position.clone().sub(p).setY(0).normalize();
      const front=new THREE.Vector3(0,0,1).applyQuaternion(b.quaternion).setY(0).normalize();
      check(front.dot(tangent)>.999,'Bird flies sideways/backwards');
      const temp={group:b};preview.ownMaterials(temp);preview.release(temp);
    }
    const stage=preview.createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1400,1000,false);stage.renderer.setScissorTest(true);
    models.forEach((model,i)=>{
      const x=i%2*700,y=500-Math.floor(i/2)*500;
      stage.scene.add(model.group);stage.camera.aspect=700/500;const frame=preview.fitCamera(stage.camera,preview.inspect(model).bounds);
      stage.camera.position.copy(frame.center).add(new THREE.Vector3(-.65,.55,1).normalize().multiplyScalar(frame.distance*1.12));stage.camera.lookAt(frame.center);
      stage.renderer.setViewport(x,y,700,500);stage.renderer.setScissor(x,y,700,500);stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(model.group);
      const label=document.createElement('div');label.className='label';label.style.cssText=`left:${x}px;top:${1000-y-38}px;width:700px`;label.textContent=assets[i].name;document.getElementById('labels').append(label);
    });
    window.proof={THREE,preview,ASSETS,stage,models,check,hash};return metrics;
  });
  assert.equal(metrics.length,4);await page.screenshot({path:`${output}/collection.png`});console.log(metrics);
  await page.setViewportSize({width:1400,height:900});
  const placements=[];
  for(const [id,birds,capys]of [['selva',1,1],['llanos',4,3],['desierto',2,0]]){
    const result=await page.evaluate(async({id,birds,capys})=>{
      const {THREE,preview,ASSETS,stage,check,hash}=proof;
      const model=await ASSETS.find(a=>a.id===`track-${id}`).build();preview.ownMaterials(model);model.update(0,0);
      const animals=[];model.group.traverse(o=>{if(o.userData.flight||o.userData.species==='capybara')animals.push(o);});
      check(animals.filter(o=>o.userData.flight).length===birds,`${id} bird count`);
      check(animals.filter(o=>o.userData.species==='capybara').length===capys,`${id} capybara count`);
      const initial=animals.map(hash);model.update(13,0);check(animals.every((o,i)=>hash(o)!==initial[i]),`${id} animation not wired`);
      model.update(0,0);check(animals.every((o,i)=>hash(o)===initial[i]),`${id} rewind`);
      const details=[];
      for(const animal of animals){
        const flight=animal.userData.flight;
        if(flight){
          for(let i=0;i<120;i++){
            animal.userData.tick(i/120*Math.PI*2/flight.speed);
            const p=animal.position;check(p.y-model.groundAt(p.x,p.z)>6,`${id} bird hits terrain`);
          }
          animal.userData.tick(0);
        }else{
          const p=animal.position;check(Math.abs(model.route.offsetOf(p.x,p.z))>model.route.HW+3,`${id} capybara in road`);
          check(Math.abs(p.y-model.groundAt(p.x,p.z))<.05,`${id} capybara floating`);
        }
        details.push({id:animal.userData.assetId,position:animal.position.toArray()});
      }
      document.getElementById('labels').hidden=true;stage.renderer.setScissorTest(false);stage.renderer.setSize(1400,900,false);stage.renderer.setViewport(0,0,1400,900);stage.camera.aspect=1400/900;stage.camera.far=5000;
      stage.scene.add(model.group);stage.scene.background=new THREE.Color(model.route.def.palette.horizon);
      const bird=animals.find(o=>o.userData.flight),p=bird.position;
      stage.camera.position.set(p.x+8,p.y+4,p.z+10);stage.camera.lookAt(p.x,p.y+1,p.z);stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);
      proof.model=model;return{id,details};
    },{id,birds,capys});
    placements.push(result);await page.screenshot({path:`${output}/${id}-birds.png`});console.log(result);
    await page.evaluate(async()=>{
      const {preview,model,stage}=proof,{tourPose}=await import('/studio/track-tour.js');
      const bird=model.group.getObjectByProperty('name',model.route.def.id==='selva'?'Guacamaya roja':model.route.def.id==='llanos'?'Corocora roja':'Zamuro planeador');
      const distance=(model.route.paramOf(bird.position.x,bird.position.z)-model.route.LINE-60+model.route.TOTAL)%model.route.TOTAL;
      const pose=tourPose(model.route,distance);stage.camera.position.copy(pose.position);stage.camera.lookAt(pose.target);stage.camera.fov=64;stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);
    });
    await page.screenshot({path:`${output}/${id}-road.png`});
    await page.evaluate(()=>{proof.preview.release(proof.model);proof.stage.camera.fov=34;});
  }
  await page.evaluate(()=>proof.models.forEach(m=>proof.preview.release(m)));
  assert.deepEqual(errors,[]);await writeFile(`${output}/proof.json`,JSON.stringify({metrics,placements},null,2));console.log('PASS wildlife, timeline, flight and native map coverage');
}finally{await browser.close();}
