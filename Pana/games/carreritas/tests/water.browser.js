// Water rendering, shared shoreline/physics, deterministic previews and ownership.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const base=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/studio/water';
await mkdir(output,{recursive:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  await page.goto(`${base}/g/carreritas/?debug&manual&track=bululu`);await page.waitForFunction(()=>window.garage?.car);
  const tide=await page.evaluate(async()=>{
    buildTrack('bululu');await startRace(0);for(let i=0;i<270;i++)updateRace(1/60);race.state='go';race.count=0;
    const {roadWaterAt,roadGripAt}=await import('./offroad.js'),{placeOnTrack}=await import('./track-kit.js');
    const {tideFront,tideZone}=await import('./tracks/bululu-tide.js');
    const T=getActiveTrack(),wash=T.group.getObjectByName('tidal-wash'),c=race.player;
    const samples=[];let minimumDry=18,centerWet=0,lowWet=0;
    T.animated.forEach(o=>o.userData.tick(0,0));const initial=Array.from(wash.geometry.attributes.position.array);
    T.animated.forEach(o=>o.userData.tick(14,0));T.animated.forEach(o=>o.userData.tick(0,0));
    const replay=initial.every((v,i)=>v===wash.geometry.attributes.position.array[i]);
    for(let t=0;t<=56;t+=.5)for(let u=.665;u<=.805;u+=.002){
      const s=u*T.TOTAL,p=placeOnTrack(T,s),front=tideFront(s,t,tideZone(p.x,p.z));minimumDry=Math.min(minimumDry,front*2);
      for(const off of [-3.8,0,3.8]){const q=placeOnTrack(T,s,off);centerWet=Math.max(centerWet,roadWaterAt(T,q.x,q.z,t));}
      if(t===0)for(const off of [-8,-6,6,8]){const q=placeOnTrack(T,s,off);lowWet=Math.max(lowWet,roadWaterAt(T,q.x,q.z,t));}
    }
    // Measure the actual animated inner vertex, not a second rendering formula.
    for(const time of [0,7,14,21,28]){
      T.animated.forEach(o=>o.userData.tick(time,0));const pos=wash.geometry.attributes.position;
      const i=40*(wash.userData.columns+1),x=pos.getX(i),z=pos.getZ(i),s=T.paramOf(x,z),off=T.offsetOf(x,z);
      const dry=placeOnTrack(T,s,Math.sign(off)*(Math.abs(off)-.5)),wet=placeOnTrack(T,s,Math.sign(off)*(Math.abs(off)+1.5));
      samples.push({time,front:Math.abs(off),dry:roadWaterAt(T,dry.x,dry.z,time),wet:roadWaterAt(T,wet.x,wet.z,time),uniform:wash.material.uniforms.time.value});
    }
    function run(time,offset){
      race.clock=time;const p=placeOnTrack(T,.72*T.TOTAL,offset);
      Object.assign(c,{x:p.x,z:p.z,y:T.surfaceAt(p.x,p.z),h:p.h,vx:Math.sin(p.h)*30-Math.cos(p.h)*4,vz:Math.cos(p.h)*30+Math.sin(p.h)*4,
        vf:30,vr:4,vy:0,onGround:true,pitch:0,roll:0,pitchV:0,rollV:0,steer:0,boost:0,spin:0,coins:0,lap:1});
      const water=roadWaterAt(T,p.x,p.z,time),grip=roadGripAt(T,p.x,p.z,time);
      for(let i=0;i<12;i++)stepCar(c,{throttle:1,steer:0},1/60);
      return {water,grip,speed:c.vf,slide:Math.abs(c.vr),groundError:Math.abs(c.y-T.groundAt(c.x,c.z))};
    }
    const low=run(0,6.7),high=run(14,6.7),center=run(14,0),dryCenter=run(0,0);
    const unchanged=TRACKS.filter(d=>d.id!=='bululu').every(def=>roadWaterAt({def},12,-250,14)===0);
    return {minimumDry,centerWet,lowWet,samples,low,high,center,dryCenter,unchanged,replay};
  });
  assert.ok(tide.minimumDry>=9.4&&tide.minimumDry<=10,'high tide preserves a substantial dry center');
  assert.equal(tide.centerWet,0);assert.equal(tide.lowWet,0);assert.ok(tide.unchanged&&tide.replay);
  for(const s of tide.samples){assert.equal(s.uniform,s.time);assert.ok(s.dry<.02&&s.wet>.9,`visual shore matches handling at ${s.time}s`);}
  assert.ok(tide.low.grip===1&&tide.high.grip<.7&&tide.high.speed<tide.low.speed-2,'real car slows and loses grip in the flooded lane');
  assert.ok(tide.high.slide>tide.low.slide*1.1,'flooding retains more sideways slip');
  assert.ok(tide.high.groundError<.01&&tide.center.speed===tide.dryCenter.speed,'dry route stays drivable with unchanged handling');
  for(const [name,time] of [['low',0],['high',14]]){
    await page.evaluate(async time=>{
      const THREE=await import('three');document.querySelectorAll('body > :not(canvas):not(script)').forEach(el=>{el.style.visibility='hidden';});
      getActiveTrack().animated.forEach(o=>o.userData.tick(time,0));renderer.toneMapping=THREE.NoToneMapping;
      race.camera.position.set(-80,90,-365);race.camera.lookAt(15,0,-245);renderer.render(race.scene,race.camera);
    },time);
    await page.screenshot({path:`${output}/bululu-tide-${name}.png`});
    await page.evaluate(async time=>{
      const {placeOnTrack}=await import('./track-kit.js'),T=getActiveTrack(),p=placeOnTrack(T,.705*T.TOTAL),q=placeOnTrack(T,.735*T.TOTAL);
      race.camera.position.set(p.x,p.y+4,p.z);race.camera.lookAt(q.x,q.y+1,q.z);T.animated.forEach(o=>o.userData.tick(time,0));renderer.render(race.scene,race.camera);
    },time);
    await page.screenshot({path:`${output}/bululu-driver-${name}.png`});
  }
  console.log(JSON.stringify(tide));
  const worlds=[];
  for(const [id,position,target] of [
    ['llanos',[210,65,230],[95,0,95]],['selva',[-90,48,-120],[-45,4,-173]],
    ['chichi',[140,43,350],[165,19,275]],['paramo',[90,110,-60],[35,72,-125]],
    ['plaza',[505,35,385],[440,0,322]],['desierto',[-110,80,-110],[-177,22,-190]],
  ]){
    const result=await page.evaluate(async([id,position,target])=>{
      toGarage();buildTrack(id);await startRace(0);const T=getActiveTrack(),water=[];
      T.animated.forEach(o=>o.userData.tick(23,.016));
      T.group.traverse(o=>{if(o.userData.waterSurface)water.push({name:o.name,time:o.material.uniforms.time.value});});
      if(id==='llanos'){
        const river=T.group.getObjectByName('llanos-cano'),geo=river.geometry,pos=geo.attributes.position,depth=geo.attributes.waterDepth;
        let error=0,crossings=0,wasWet=false;
        for(let i=0;i<pos.count;i++)error=Math.max(error,Math.abs(depth.getX(i)-(pos.getY(i)-T.terrainAt(pos.getX(i),pos.getZ(i)))));
        for(let s=0;s<T.TOTAL;s+=2){const p=T.pointAt(s),wet=T.terrainAt(p.x,p.y)<.65;if(wet&&!wasWet)crossings++;wasWet=wet;}
        if(error>1e-4||crossings!==2)throw Error(`Llanos wetland depth error ${error}, bridge crossings ${crossings}`);
      }
      race.camera.position.set(...position);race.camera.lookAt(...target);renderer.render(race.scene,race.camera);
      return {id,water,calls:renderer.info.render.calls};
    },[id,position,target]);
    assert.ok(result.water.length&&result.water.every(w=>w.time===23),`${id}: every water surface is animated`);
    worlds.push(result);await page.screenshot({path:`${output}/${id}-water.png`});
  }
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}</style></head><body><canvas></canvas></body></html>`);
  const ownership=await page.evaluate(async()=>{
    const THREE=await import('three'),{waterSurface,waterDepthMap,riverSurface,waterPool}=await import('/engine/models/effects/water-surface.js');
    const {createPreview,ownMaterials,release}=await import('/studio/preview.js'),stage=createPreview(document.querySelector('canvas'),true);
    stage.renderer.setSize(1440,960,false);stage.camera.aspect=1.5;stage.camera.updateProjectionMatrix();
    const group=new THREE.Group(),geo=new THREE.PlaneGeometry(100,100,24,24);geo.rotateX(-Math.PI/2);
    const ocean=waterSurface(geo,{depthMap:waterDepthMap((x,z)=>-8+x*.17,{size:100,resolution:64}),size:100});group.add(ocean);
    const owned=[];for(const resource of [ocean.material,ocean.material.uniforms.depthMap.value])resource.addEventListener('dispose',()=>owned.push(resource.uuid));
    const runtime={group};ownMaterials(runtime);
    const live=ocean.material.uniforms.depthMap.value;live.addEventListener('dispose',()=>owned.push(live.uuid));
    const river=riverSurface([[-45,0],[-20,-10],[0,8],[25,0],[45,10]],10,()=>.4);
    const pool=waterPool(17,11);pool.position.set(5,.3,-28);group.add(river,pool);
    stage.scene.add(group);stage.camera.position.set(45,54,65);stage.camera.lookAt(0,0,0);
    const hashes=[],gl=stage.renderer.getContext(),pixels=new Uint8Array(128*128*4);
    for(const t of [19,3,19]){
      group.traverse(o=>o.userData.tick?.(t));stage.renderer.render(stage.scene,stage.camera);
      gl.readPixels(650,400,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let hash=2166136261;for(const byte of pixels)hash=Math.imul(hash^byte,16777619);hashes.push(hash>>>0);
    }
    const result={time:ocean.material.uniforms.time.value,calls:stage.renderer.info.render.calls,hashes};
    window.waterProof={stage,runtime,release,owned,result};return result;
  });
  assert.equal(ownership.time,19);assert.equal(ownership.calls,3);
  assert.notEqual(ownership.hashes[0],ownership.hashes[1],'water pixels actually move');
  assert.equal(ownership.hashes[0],ownership.hashes[2],'scrubbing to the same time restores identical pixels');
  await page.screenshot({path:`${output}/water-materials.png`});
  const disposal=await page.evaluate(()=>{waterProof.release(waterProof.runtime);waterProof.stage.dispose();return waterProof.owned.length;});
  assert.equal(disposal,3,'owned source material, source depth map and cloned depth map are released');
  assert.deepEqual(errors,[],'no shader compilation or runtime errors');
  await writeFile(`${output}/metrics.json`,JSON.stringify({tide,worlds,ownership,disposal},null,2));
  console.log('PASS: tide geometry, safe dry center, real car drag/grip, preview clocks, shaders and disposal.');
}finally{await browser.close();}
