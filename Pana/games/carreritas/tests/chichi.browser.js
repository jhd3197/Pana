// Thermal landmark contracts, localized grip and driver-view visual proof.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const base=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/studio/chichi';
await mkdir(output,{recursive:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  await page.goto(`${base}/g/carreritas/?debug&manual&track=chichi`);await page.waitForFunction(()=>window.garage?.car);
  const driving=await page.evaluate(async()=>{
    await startRace(0);for(let i=0;i<270;i++)updateRace(1/60);race.state='go';race.count=0;
    const {roadGripAt}=await import('./offroad.js'),{placeOnTrack}=await import('./track-kit.js');
    const T=getActiveTrack(),c=race.player,original=T.def.gripAt;
    const samples=Array.from({length:1000},(_,i)=>{const p=placeOnTrack(T,i*T.TOTAL/1000);return {...p,grip:roadGripAt(T,p.x,p.z)};});
    const wet=samples.reduce((a,b)=>a.grip<b.grip?a:b);
    function simulate(dry){
      T.def.gripAt=dry?()=>1:original;
      Object.assign(c,{x:wet.x,z:wet.z,y:T.surfaceAt(wet.x,wet.z),h:wet.h,vx:Math.sin(wet.h)*25-Math.cos(wet.h)*8,vz:Math.cos(wet.h)*25+Math.sin(wet.h)*8,
        vf:25,vr:8,vy:0,onGround:true,pitch:0,roll:0,pitchV:0,rollV:0,steer:0,boost:0,spin:0,coins:0,lap:1});
      for(let i=0;i<12;i++)stepCar(c,{throttle:-1,steer:0},1/60);
      return {forward:c.vf,slide:Math.abs(c.vr),groundError:Math.abs(c.y-T.groundAt(c.x,c.z))};
    }
    let dry,moist;try{dry=simulate(true);moist=simulate(false);}finally{T.def.gripAt=original;}
    const defaults=TRACKS.filter(t=>!t.gripAt).map(def=>roadGripAt({def},wet.x,wet.z));
    const steam=[];T.animated.forEach(o=>o.userData.tick?.(19,.016));
    T.group.traverse(o=>{if(o.material?.uniforms?.rise)steam.push({time:o.material.uniforms.time.value,opacity:o.material.uniforms.opacity.value,count:o.count});});
    let riverAboveRoad=0;const river=T.group.getObjectByName('chichi-river'),p=river.geometry.attributes.position;
    for(let i=0;i<p.count;i++)if(Math.abs(T.offsetOf(p.getX(i),p.getZ(i)))<T.HW&&p.getY(i)>T.surfaceAt(p.getX(i),p.getZ(i))-.5)riverAboveRoad++;
    const sectors=T.def.sectors.map(([u,name])=>{const p=placeOnTrack(T,u*T.TOTAL);return {u,name,x:p.x,z:p.z,y:p.y};});
    return {length:T.TOTAL,wetFraction:samples.filter(p=>p.grip<.9).length/samples.length,minGrip:wet.grip,dry,moist,defaults,steam,riverAboveRoad,sectors,
      landmarks:['aguas-del-cielo','forest-waterfall','chichi-beach-village','diving-school','chichi-river-bridges','ridge-lookout'].every(n=>T.group.getObjectByName(n))};
  });
  assert.ok(driving.length>4500&&driving.landmarks,'a long connected circuit with all landmark sectors');
  assert.ok(driving.wetFraction>.08&&driving.wetFraction<.4,'wetness is localized, leaving most of the lap dry');
  assert.ok(driving.minGrip>=.5&&driving.minGrip<.65,'wet grip remains controllable');
  assert.ok(driving.moist.slide>driving.dry.slide*1.15,'wet road retains more lateral slip in the real car simulation');
  assert.ok(driving.moist.forward>driving.dry.forward+.15,'wet braking needs more distance');
  assert.ok(driving.moist.groundError<.01&&driving.dry.groundError<.01,'both handling samples stay grounded');
  assert.ok(driving.defaults.every(g=>g===1),'circuits without authored wet or mud sections retain dry handling');
  assert.equal(driving.riverAboveRoad,0,'river stays below bridge driving decks');
  assert.ok(driving.steam.length>=8&&driving.steam.every(s=>s.time===19&&s.opacity<=.35),'environment ticks every localized steam field once');
  for(const [name,point] of [['springs',[128,-454]],['switchbacks',[-295,-295]],['forest',[-230,-90]],['dive-school',[-80,285]],['river',[170,275]],['climb',[315,-110]]]){
    await page.evaluate(async([x,z])=>{
      const THREE=await import('three'),{placeOnTrack}=await import('./track-kit.js'),T=getActiveTrack(),p=placeOnTrack(T,T.paramOf(x,z)),c=race.player;
      Object.assign(c,{x:p.x,z:p.z,y:T.surfaceAt(p.x,p.z),h:p.h,vx:0,vz:0,vy:0,onGround:true,airTime:0,spin:0,lap:1,pitch:0,roll:0,pitchV:0,rollV:0});
      c.prog=(T.paramOf(p.x,p.z)-T.LINE+T.TOTAL)%T.TOTAL;race.camPos=null;race.boardT=0;
      for(let i=0;i<3;i++)updateRace(1/60);
      T.animated.forEach(o=>o.userData.tick?.(19,.016));renderer.toneMapping=THREE.NoToneMapping;renderer.render(race.scene,race.camera);
    },point);
    await page.screenshot({path:`${output}/drive-${name}.png`});
  }
  await page.evaluate(()=>{document.querySelectorAll('body > :not(canvas):not(script)').forEach(el=>{el.style.visibility='hidden';});race.camera.position.set(-25,233,-305);race.camera.lookAt(65,175,-405);renderer.render(race.scene,race.camera);});
  await page.screenshot({path:`${output}/thermal-sanctuary.png`});
  await writeFile(`${output}/driving.json`,JSON.stringify(driving,null,2));
  console.log(JSON.stringify(driving));
  await page.close();

  const preview=await browser.newPage({viewport:{width:1100,height:850}});
  preview.on('pageerror',e=>errors.push(e.message));preview.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  await preview.goto(`${base}/studio/settings.html`);
  await preview.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}</style></head><body><canvas></canvas></body></html>`);
  await preview.evaluate(async()=>{
    const THREE=await import('three'),module=await import('/studio/preview.js'),{ASSETS}=await import('/studio/catalog.js');
    const stage=module.createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1100,850,false);stage.camera.aspect=1100/850;
    window.thermalProof={THREE,module,stage,assets:ASSETS.filter(a=>a.category==='Termales')};
  });
  const models=[];
  for(let i=0;i<5;i++){
    const result=await preview.evaluate(async i=>{
      const {THREE,module,stage,assets}=thermalProof;
      if(thermalProof.runtime)module.release(thermalProof.runtime);
      const asset=assets[i],runtime=await asset.build();thermalProof.runtime=runtime;module.ownMaterials(runtime);stage.scene.add(runtime.group);
      runtime.update?.(7,0);runtime.group.updateMatrixWorld(true);
      const solid=new THREE.Box3(),steam=[],positions=[];let finite=true;
      runtime.group.traverse(o=>{
        if(o.material?.uniforms?.rise){steam.push(o.material.uniforms.time.value);return;}
        if(o.isMesh)solid.union(new THREE.Box3().setFromObject(o));
        if(o.geometry?.attributes.position)for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))finite=false;
        if(o.isInstancedMesh)positions.push(o.instanceMatrix.array.slice());
      });
      runtime.update?.(23,0);runtime.update?.(7,0);let stable=true,j=0;
      runtime.group.traverse(o=>{if(o.isInstancedMesh&&!o.material?.uniforms?.rise){if(o.instanceMatrix.array.some((v,k)=>Math.abs(v-positions[j][k])>1e-6))stable=false;j++;}});
      const {frameBounds,stats}=module.inspect(runtime);module.fitCamera(stage.camera,frameBounds,false);stage.renderer.render(stage.scene,stage.camera);
      return {id:asset.id,finite,ground:solid.min.y,steam,stable,triangles:stats.triangles};
    },i);
    assert.ok(result.finite&&result.stable,`${result.id}: finite geometry and repeatable absolute-time animation`);
    assert.ok(Math.abs(result.ground)<.08,`${result.id}: solid base rests on y=0`);
    assert.ok(result.steam.every(t=>t===7),`${result.id}: steam animates after Studio clones its material`);
    models.push(result);await preview.screenshot({path:`${output}/${result.id}.png`});
  }
  await writeFile(`${output}/models.json`,JSON.stringify(models,null,2));
  const disposal=await preview.evaluate(async()=>{
    const {module,assets}=thermalProof,runtime=await assets[0].build(),owned=new Set(),released=new Set();
    runtime.group.traverse(o=>{
      if(o.material?.isShaderMaterial)owned.add(o.material);
      if(o.name==='Water ripples and droplets')owned.add(o.children[0].material);
    });
    owned.forEach(m=>m.addEventListener('dispose',()=>released.add(m)));
    module.ownMaterials(runtime);module.release(runtime);
    return {owned:owned.size,released:released.size};
  });
  assert.ok(disposal.owned>=2&&disposal.owned===disposal.released,'source steam and ripple materials are released after preview cloning');
  assert.deepEqual(errors,[]);console.log('PASS: thermal model grounding, deterministic motion, live shader cloning, real wet grip, bridge water and six driver views.');
}finally{await browser.close();}
