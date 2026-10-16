// Real town geometry, elevation and overview proof. Optional package/browser args.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{}) });
const base=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/studio/plaza';
await mkdir(output,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas></canvas></body></html>`);
  const metrics=await page.evaluate(async()=>{
    const THREE=await import('three'),{makeTrack,getTrack}=await import('/g/derrape/tracks.js');
    const {createPreview,inspect,fitCamera,ownMaterials}=await import('/studio/preview.js');
    const T=makeTrack(getTrack('plaza')),group=T.build(),model={group};ownMaterials(model);
    const town=group.getObjectByName('track-environment').userData.town;
    const {streetDistance}=await import('/g/derrape/tracks/plaza-layout.js');
    const blockedStreets=town.buildings.filter(b=>streetDistance(b.x,b.z)<9.6+Math.hypot(b.width,b.depth)/2);
    let maxGrade=0,minHeight=Infinity,maxHeight=0,minRadius=Infinity,projectionError=0;
    for(let s=0;s<T.TOTAL;s+=1) {
      const a=T.pointAt(s-1),p=T.pointAt(s),b=T.pointAt(s+1),d=Math.abs(T.paramOf(p.x,p.y)-s);
      projectionError=Math.max(projectionError,Math.min(d,T.TOTAL-d));
      const turn=Math.atan2(b.y-p.y,b.x-p.x)-Math.atan2(p.y-a.y,p.x-a.x);
      minRadius=Math.min(minRadius,1/Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn))));
      maxGrade=Math.max(maxGrade,Math.abs(T.heightAtS(s+0.5)-T.heightAtS(s-0.5)));
      minHeight=Math.min(minHeight,T.heightAtS(s));maxHeight=Math.max(maxHeight,T.heightAtS(s));
    }
    const farHomes=town.buildings.filter(p=>Math.abs(T.offsetOf(p.x,p.z))>80).length;
    const floating=town.buildings.filter(b=>{
      for(const a of [-b.width/2,0,b.width/2])for(const c of [-b.depth/2,0,b.depth/2]) {
        const x=b.x+Math.cos(b.turn)*a+Math.sin(b.turn)*c,z=b.z-Math.sin(b.turn)*a+Math.cos(b.turn)*c,y=T.terrainAt(x,z);
        if(b.base>y+0.05||b.y<y-0.05)return true;
      }return false;
    });
    const terrain=group.getObjectByName('plaza-terrain'),ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
    group.updateMatrixWorld(true);let intrusion=0;
    for(let s=0;s<T.TOTAL;s+=5) {
      const a=T.pointAt(s),b=T.pointAt(s+0.5),angle=Math.atan2(b.x-a.x,b.y-a.y);
      for(const off of [-7,0,7]) {
        const x=a.x-Math.cos(angle)*off,z=a.y+Math.sin(angle)*off;
        ray.ray.origin.set(x,200,z);const hit=ray.intersectObject(terrain)[0];
        if(hit)intrusion=Math.max(intrusion,hit.point.y-(T.surfaceAt(x,z)+0.12));
      }
    }
    const streetMeshes=[];group.traverse(o=>{if(o.isMesh&&o.material.color?.getHex()===0x8b958c)streetMeshes.push(o);});
    let streetIntrusion=0;
    for(const x of town.avenues)for(let z=-330;z<310;z+=40) {
      ray.ray.origin.set(x,200,z);const land=ray.intersectObject(terrain)[0],road=ray.intersectObjects(streetMeshes,false)[0];
      if(land&&road)streetIntrusion=Math.max(streetIntrusion,land.point.y-road.point.y);
    }
    let finite=true;group.traverse(o=>{for(const a of Object.values(o.geometry?.attributes||{}))for(const v of a.array)if(!Number.isFinite(v))finite=false;});
    const stage=createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1500,1050,false);stage.camera.aspect=1500/1050;
    stage.scene.add(group);const bounds=new THREE.Box3(new THREE.Vector3(...T.def.previewBounds[0]),new THREE.Vector3(...T.def.previewBounds[1]));
    fitCamera(stage.camera,bounds,true);stage.renderer.render(stage.scene,stage.camera);
    window.townProof={stage,T,bounds,fitCamera,THREE};
    return {length:T.TOTAL,maxGrade,minHeight,maxHeight,minRadius,projectionError,homes:town.buildings.length,farHomes,
      blocks:town.blocks.length,streets:town.avenues.length+town.streets.length,floating,blockedStreets,streetIntrusion,intrusion,finite,...inspect(model).stats,drawCalls:stage.renderer.info.render.calls};
  });
  console.log(JSON.stringify(metrics,null,2));await writeFile(`${output}/metrics.json`,JSON.stringify(metrics,null,2));
  await page.screenshot({path:`${output}/overview.png`});
  await page.evaluate(()=>{const {stage,bounds,fitCamera}=townProof;fitCamera(stage.camera,bounds,true,'top');stage.renderer.render(stage.scene,stage.camera);});
  await page.screenshot({path:`${output}/top.png`});
  for(const [name,position,target] of [['hill',[340,85,60],[220,19,-150]],['plaza',[-110,85,160],[15,0,-5]],['street',[-65,6,60],[90,3,60]]]) {
    await page.evaluate(({position,target})=>{const {stage}=townProof;stage.camera.position.set(...position);stage.camera.lookAt(...target);stage.camera.near=0.1;stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);},{position,target});
    await page.screenshot({path:`${output}/${name}.png`});
  }
  assert.equal(metrics.finite,true);assert.ok(metrics.homes>180);assert.ok(metrics.farHomes>80);
  assert.equal(metrics.blocks,30);assert.equal(metrics.streets,13);assert.deepEqual(metrics.floating,[]);
  assert.deepEqual(metrics.blockedStreets,[]);assert.ok(metrics.streetIntrusion<0.025,'terrain stays below side streets');
  assert.ok(metrics.maxHeight-metrics.minHeight>20);assert.ok(metrics.maxGrade<0.35);
  assert.ok(metrics.minRadius>15);assert.ok(metrics.projectionError<0.01);assert.ok(metrics.intrusion<0.025,'visible terrain stays below road');
  // The older 2.2 M / 900 limits predated Pueblo/coastal placements. HEAD before
  // the living-world pass measured 5,278,588 triangles / 1,383 overview draws.
  // The surroundings pass adds 51 homes, 26 gardens and 187 trees, using light
  // canopy prototypes. Allow that authored expansion while staying below the
  // pre-batching town's 5.28 M triangles / 1,383 overview draws.
  assert.ok(metrics.triangles<4600000);assert.ok(metrics.drawCalls<1300);assert.deepEqual(errors,[]);
  console.log('PASS: town layout, hill, foundations, drivable geometry, real terrain clearance and render budgets');
  await page.close();
  const game=await browser.newPage({viewport:{width:1440,height:900}});
  game.on('pageerror',e=>errors.push(e.message));
  
  await game.goto(`${base}/g/derrape/?debug&manual&track=plaza`);
  await game.waitForFunction(()=>window.garage?.car);
  for(const [name,u] of [['historic',0.11],['uphill',0.59],['downhill',0.73]]) {
    const grounded=await game.evaluate(async u=>{
      const THREE=await import('three');await startRace(0);race.state='go';race.count=0;
      const T=getActiveTrack(),s=u*T.TOTAL,p=T.pointAt(s),ahead=T.pointAt(s+0.5),c=race.player;
      Object.assign(c,{x:p.x,z:p.y,y:T.surfaceAt(p.x,p.y),h:Math.atan2(ahead.x-p.x,ahead.y-p.y),vx:0,vz:0,lap:1});
      c.prog=(s-T.LINE+T.TOTAL)%T.TOTAL;race.camPos=null;
      for(let i=0;i<3;i++)updateRace(1/60);
      renderer.toneMapping=THREE.NoToneMapping;renderer.render(race.scene,race.camera);
      return Math.abs(c.y-T.groundAt(c.x,c.z))<0.01;
    },u);
    assert.ok(grounded,`${name}: driver stays on the road`);
    await game.screenshot({path:`${output}/race-${name}.png`});
  }
  assert.deepEqual(errors,[]);console.log('PASS: actual race camera renders historic, uphill and downhill sections');
} finally {await browser.close();}
