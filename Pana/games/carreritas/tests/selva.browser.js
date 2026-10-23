// Tunnel geometry and actual chase-camera proof. Run against the local server.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const base=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/studio/selva';
await mkdir(output,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas></canvas></body></html>`);
  const metrics=await page.evaluate(async()=>{
    const THREE=await import('three'),{makeTrack,getTrack,loadTrack}=await import('/g/carreritas/tracks.js');await loadTrack('selva');
    const {createPreview,inspect,fitCamera,ownMaterials}=await import('/studio/preview.js');
    const {placeOnTrack}=await import('/g/carreritas/track-kit.js');
    const {JUNGLE_ADDITIONS}=await import('/g/carreritas/tracks/selva-flora.js');
    const {riverDistance}=await import('/g/carreritas/tracks/selva-layout.js');
    const T=makeTrack(getTrack('selva')),group=T.build(),model={group};ownMaterials(model);group.updateMatrixWorld(true);
    const jungle=group.getObjectByName('track-environment').userData.jungle,tunnel=group.getObjectByName('selva-temple-tunnel');
    const ray=new THREE.Raycaster(),obstacles=[group.getObjectByName('track-environment'),group.getObjectByName('track-scenery')];
    const collisions=[],cameraClips=[];let finite=true,minCeiling=Infinity,maxGrade=0,intrusion=0;
    for(let s=0;s<T.TOTAL;s+=4) {
      maxGrade=Math.max(maxGrade,Math.abs(T.heightAtS(s+0.5)-T.heightAtS(s-0.5)));
      for(const off of [-7,0,7]) {
        const p=placeOnTrack(T,s,off);ray.set(new THREE.Vector3(p.x,p.y+3.2,p.z),new THREE.Vector3(0,-1,0));ray.far=2.85;
        const hit=ray.intersectObjects(obstacles,true)[0];if(hit)collisions.push({s,off,name:hit.object.name,y:hit.point.y-p.y});
        ray.far=200;ray.ray.origin.y=200;const ground=ray.intersectObject(group.getObjectByName('selva-terrain'))[0];
        if(ground)intrusion=Math.max(intrusion,ground.point.y-p.y-0.12);
      }
    }
    for(let s=jungle.tunnel.fromS-20;s<jungle.tunnel.toS+20;s+=2)for(const off of [-7,0,7]) {
      const p=placeOnTrack(T,s,off),origin=new THREE.Vector3(p.x,p.y+1.4,p.z);
      const camera=new THREE.Vector3(p.x-Math.sin(p.h)*11,p.y+5,p.z-Math.cos(p.h)*11),direction=camera.clone().sub(origin);
      ray.set(origin,direction.clone().normalize());ray.far=direction.length();
      if(ray.intersectObjects(obstacles,true).length)cameraClips.push({s,off});
      if(s>jungle.tunnel.fromS+2&&s<jungle.tunnel.toS-2) {
        ray.set(new THREE.Vector3(p.x,p.y+0.3,p.z),new THREE.Vector3(0,1,0));ray.far=50;
        const ceiling=ray.intersectObject(tunnel,true)[0];minCeiling=Math.min(minCeiling,ceiling?ceiling.point.y-p.y:0);
      }
    }
    const counts=Object.fromEntries([...new Set(jungle.plants.map(p=>p.kind))].map(kind=>[kind,jungle.plants.filter(p=>p.kind===kind).length]));
    const missingSpecies=JUNGLE_ADDITIONS.filter(kind=>!counts[kind]);
    const plantClearance=jungle.plants.filter(p=>p.zone!=='roof'&&Math.abs(T.offsetOf(p.x,p.z))<T.HW+p.radius+1.5);
    const waterErrors=jungle.plants.filter(p=>p.kind==='waterLily'&&(Math.abs(p.y-0.3)>0.001||riverDistance(p.x,p.z)+p.radius>9));
    const revealedOpponents=[],hiddenViews=[],revealedPortal=[];
    for(const observer of [0.5966,0.5976,0.6097])for(const target of [0.7703,0.7773,0.7912])for(const off of [-6,0,6]) {
      const p=placeOnTrack(T,observer*T.TOTAL),q=placeOnTrack(T,target*T.TOTAL,off);
      const eye=new THREE.Vector3(p.x-Math.sin(p.h)*11,p.y+5,p.z-Math.cos(p.h)*11),car=new THREE.Vector3(q.x,q.y+2.8,q.z),direction=car.clone().sub(eye);
      ray.set(eye,direction.clone().normalize());ray.far=direction.length();
      const hidden=ray.intersectObjects([group.getObjectByName('selva-terrain'),tunnel],true).length>0;
      (hidden?hiddenViews:revealedOpponents).push({observer,target,off});
    }
    for(const observer of [0.5966,0.5976,0.6097]) {
      const p=placeOnTrack(T,observer*T.TOTAL),q=placeOnTrack(T,jungle.tunnel.toS);
      const eye=new THREE.Vector3(p.x-Math.sin(p.h)*11,p.y+5,p.z-Math.cos(p.h)*11),top=new THREE.Vector3(q.x,q.y+27,q.z),direction=top.clone().sub(eye);
      ray.set(eye,direction.clone().normalize());ray.far=direction.length();
      if(!ray.intersectObject(group.getObjectByName('selva-terrain')).length)revealedPortal.push(observer);
    }
    let plantGroundError=0;
    for(const p of jungle.plants.filter(p=>['fern','monstera','reeds','bamboo'].includes(p.kind)&&p.zone!=='roof').filter((p,i)=>i%5===0)) {
      ray.set(new THREE.Vector3(p.x,200,p.z),new THREE.Vector3(0,-1,0));ray.far=300;
      const hit=ray.intersectObject(group.getObjectByName('selva-terrain'))[0];
      plantGroundError=Math.max(plantGroundError,hit?Math.abs(hit.point.y-p.y-0.12):Infinity);
    }
    for(let s=0;s<T.TOTAL;s+=8)for(const off of [-7,0,7]) {
      const p=placeOnTrack(T,s,off),origin=new THREE.Vector3(p.x,p.y+1.4,p.z);
      const direction=new THREE.Vector3(-Math.sin(p.h)*11,3.6,-Math.cos(p.h)*11);
      ray.set(origin,direction.clone().normalize());ray.far=direction.length();
      if(ray.intersectObjects([group.getObjectByName('selva-forest'),group.getObjectByName('selva-terrain')],true).length)cameraClips.push({s,off,section:'forest'});
    }
    group.traverse(o=>{for(const a of Object.values(o.geometry?.attributes||{}))for(const v of a.array)if(!Number.isFinite(v))finite=false;});
    const stage=createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1500,1000,false);stage.camera.aspect=1.5;
    stage.scene.add(group);const bounds=new THREE.Box3(new THREE.Vector3(...T.def.previewBounds[0]),new THREE.Vector3(...T.def.previewBounds[1]));
    fitCamera(stage.camera,bounds,true);stage.renderer.render(stage.scene,stage.camera);
    window.selvaProof={stage,T,bounds,fitCamera,THREE,placeOnTrack};
    return {length:T.TOTAL,tunnel:jungle.tunnel,plants:jungle.plants.length,counts,missingSpecies,plantClearance,waterErrors,plantGroundError,revealedOpponents,revealedPortal,hiddenViews:hiddenViews.length,ceibas:jungle.plants.filter(p=>p.kind==='ceiba').length,
      forestBeyondRoad:jungle.plants.filter(p=>Math.abs(T.offsetOf(p.x,p.z))>55).length,minCeiling,maxGrade,intrusion,collisions,cameraClips,finite,
      ...inspect(model).stats,drawCalls:stage.renderer.info.render.calls};
  });
  console.log(JSON.stringify(metrics,null,2));await writeFile(`${output}/metrics.json`,JSON.stringify(metrics,null,2));
  await page.screenshot({path:`${output}/overview.png`});
  await page.evaluate(()=>{const {stage,bounds,fitCamera}=selvaProof;fitCamera(stage.camera,bounds,true,'top');stage.renderer.render(stage.scene,stage.camera);});
  await page.screenshot({path:`${output}/top.png`});
  for(const [name,u,back,lift] of [['entrance',0.7425,90,33],['interior',0.7518,0,5],['exit',0.7703,-65,27]]) {
    await page.evaluate(({u,back,lift})=>{
      const {stage,T,placeOnTrack}=selvaProof,p=placeOnTrack(T,u*T.TOTAL),ahead=placeOnTrack(T,u*T.TOTAL+20);
      stage.camera.position.set(p.x-Math.sin(p.h)*back,p.y+lift,p.z-Math.cos(p.h)*back);
      stage.camera.lookAt(back<0?p.x:ahead.x,p.y+(back?10:4),back<0?p.z:ahead.z);stage.camera.near=0.1;stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);
    },{u,back,lift});await page.screenshot({path:`${output}/${name}.png`});
  }
  for(const [name,u,side] of [['river-garden',0.9768,-1],['bamboo-grove',0.9258,-1],['flower-clearing',0.6845,1],['jaguar-cave',0.094,1],['plateau',0.24,-1]]) {
    await page.evaluate(({u,side})=>{
      const {stage,T,placeOnTrack}=selvaProof,p=placeOnTrack(T,u*T.TOTAL,side*18),camera=placeOnTrack(T,u*T.TOTAL-20,side*5);
      stage.camera.position.set(camera.x,T.terrainAt(camera.x,camera.z)+10,camera.z);
      stage.camera.lookAt(p.x,T.terrainAt(p.x,p.z)+3,p.z);stage.camera.near=0.1;stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);
    },{u,side});await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.close();
  const game=await browser.newPage({viewport:{width:1440,height:900}});game.on('pageerror',e=>errors.push(e.message));
  await game.goto(`${base}/g/carreritas/?debug&manual&track=selva`);await game.waitForFunction(()=>window.garage?.car);
  for(const [name,u] of [['approach',0.7332],['tunnel',0.756],['exit',0.7727],['river',0.9745],['forest',0.5976],['bamboo',0.9304],['flowers',0.6892],['cave-portal',0.012],['cave-hall',0.094],['plateau',0.22],['ledge',0.4],['ford',0.528]]) {
    await game.evaluate(async u=>{
      const THREE=await import('three');if(race.state!=='go'){await startRace(0);race.state='go';race.count=0;}
      const T=getActiveTrack(),s=u*T.TOTAL,p=T.pointAt(s),ahead=T.pointAt(s+0.5),c=race.player;
      Object.assign(c,{x:p.x,z:p.y,y:T.surfaceAt(p.x,p.y),h:Math.atan2(ahead.x-p.x,ahead.y-p.y),vx:0,vz:0,lap:1});
      c.prog=(s-T.LINE+T.TOTAL)%T.TOTAL;race.camPos=null;for(let i=0;i<3;i++)updateRace(1/60);
      renderer.toneMapping=THREE.NoToneMapping;renderer.render(race.scene,race.camera);
    },u);await game.screenshot({path:`${output}/race-${name}.png`});
  }
  assert.ok(metrics.finite);assert.ok(metrics.tunnel.length>60);assert.ok(metrics.minCeiling>11);
  assert.deepEqual(metrics.collisions,[],'all racing lanes remain clear');assert.deepEqual(metrics.cameraClips,[],'chase camera clears entrance, passage and exit');
  assert.ok(metrics.intrusion<0.025,'terrain stays below the racing ribbon');assert.ok(metrics.maxGrade<0.3);
  assert.ok(metrics.ceibas>200);assert.ok(metrics.forestBeyondRoad>120);// The 2.5 km loop (jaguar cave, plateau, ledge) carries about twice the
  // original valley's planting; the whole-map overview budget scales with it.
  assert.ok(metrics.triangles<6000000);assert.ok(metrics.drawCalls<1200);
  assert.deepEqual(metrics.missingSpecies,[],'all twelve shared additions are actually planted');
  assert.deepEqual(metrics.plantClearance,[],'plant footprints reserve the full road width');
  assert.deepEqual(metrics.waterErrors,[],'lily pads sit on the river surface within its banks');
  assert.ok(metrics.plantGroundError<0.001,'understory roots follow the actual terrain triangles');
  assert.deepEqual(metrics.revealedOpponents,[],'interior ridge hides tunnel-exit cars from the early loop');
  assert.deepEqual(metrics.revealedPortal,[],'interior ridge hides the far portal cornice from the early loop');
  assert.deepEqual(errors,[]);console.log('PASS: jungle density, lane/head/camera clearance, terrain, geometry budgets and actual race camera views');
}finally{await browser.close();}
