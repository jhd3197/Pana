// Contact, pause, lifecycle and bounded GPU cost, followed by real horse captures.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true}),out='art/galope/water-fx';await mkdir(out,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE'))errors.push(m.text());});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}canvas{display:block}</style><canvas></canvas>');
  const checks=await page.evaluate(async()=>{
    const THREE=await import('three'),{createHorseWaterFX,WATER_FX_BUDGET}=await import('/g/galope/water-fx.js');
    const check=(v,m)=>{if(!v)throw Error(m);},fx=createHorseWaterFX({waterY:.68,depthAt:(x,z)=>x<50?.5:0});
    const people=Array.from({length:8},(_,i)=>({id:String(i),speed:7,jumpY:0}));
    const riders=new Map(people.map((p,i)=>{const group=new THREE.Group();group.position.set(i*2,0,0);return [p.id,{group,stridePhase:0}];}));
    const focus=new THREE.Vector3();let t=0,maxSurface=0,maxSpray=0;
    function step(dt=1/60){t+=dt;for(const r of riders.values()){r.group.position.z+=dt*7;r.stridePhase+=dt*8.5;}fx.update(t,people,riders,focus);maxSurface=Math.max(maxSurface,fx.stats.surface);maxSpray=Math.max(maxSpray,fx.stats.spray);}
    for(let i=0;i<12;i++)step();
    const anchor=Array.from(fx.group.children[0].instanceMatrix.array).slice(12,15);step();
    check(anchor.every((v,i)=>v===fx.group.children[0].instanceMatrix.array[12+i]),'Ripples follow the moving horse instead of staying on the water');
    for(let i=13;i<150;i++)step();
    check(fx.stats.surface>16&&fx.stats.spray>16,'Eight moving horses must disturb the water');
    const capture=()=>fx.group.children.map(o=>[o.count,...o.instanceMatrix.array,...o.geometry.attributes.effect.array]);
    const before=JSON.stringify(capture());fx.update(t,people,riders,focus);check(JSON.stringify(capture())===before,'Pause changed effect geometry');
    const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,100);
    scene.add(fx.group);camera.position.set(8,8,25);camera.lookAt(8,0,15);renderer.setSize(300,300);renderer.render(scene,camera);
    const draws=renderer.info.render.calls,triangles=renderer.info.render.triangles;
    check(draws===2&&triangles<=640,'Effect exceeded two draws / 640 triangles');
    check(maxSurface<=WATER_FX_BUDGET.surface&&maxSpray<=WATER_FX_BUDGET.spray,'Unbounded pool');
    // Hold airborne over water long enough for existing particles to drain.
    people.forEach(p=>p.jumpY=1.2);for(let i=0;i<110;i++)step();check(!fx.stats.surface&&!fx.stats.spray,'Airborne horses emit water effects');
    people.forEach(p=>p.jumpY=0);step();step();check(fx.stats.surface>0&&fx.stats.spray>0,'Landing failed to splash');
    people.forEach(p=>p.speed=0);for(let i=0;i<110;i++){t+=1/60;fx.update(t,people,riders,focus);}check(!fx.stats.surface&&!fx.stats.spray,'Stopped horses keep emitting');
    // Teleport to dry land, then move there. A speed value alone must not emit.
    people.forEach(p=>p.speed=7);riders.forEach(r=>r.group.position.x=60);focus.x=60;for(let i=0;i<120;i++)step();check(!fx.stats.surface&&!fx.stats.spray,'Dry ground receives water effects');
    fx.update(t+1,[],new Map(),focus);check(fx.stats.riders===0,'Disconnected riders retained');
    fx.reset();check(!fx.stats.surface&&!fx.stats.spray,'Reset retained particles');
    let released=0;for(const o of fx.group.children)for(const resource of [o.geometry,o.material])resource.addEventListener('dispose',()=>released++);
    fx.group.children[0].material.uniforms.bed.value.addEventListener('dispose',()=>released++);fx.dispose();fx.dispose();check(released===5&&!fx.group.parent,'Resources not released exactly once');renderer.dispose();
    document.querySelector('canvas').replaceWith(document.createElement('canvas'));
    window.waterModules={THREE,createHorseWaterFX};return {draws,triangles,maxSurface,maxSpray,pause:true,airborne:true,landing:true,dry:true,stopped:true,disposal:true};
  });
  await page.evaluate(async()=>{
    const {THREE,createHorseWaterFX}=waterModules,{createRaceScene}=await import('/g/galope/scene.js'),course=await import('/g/galope/course.js'),{createRider}=await import('/engine/models/fauna/farm/llanero-rider.js'),{loadAvatar}=await import('/engine/avatar.js');
    const w=createRaceScene(document.querySelector('canvas'));w.renderer.setSize(1440,900,false);w.camera.aspect=1.6;w.camera.updateProjectionMatrix();
    const rider=createRider(loadAvatar(),'palomino',7);w.scene.add(rider.group);const riders=new Map([['horse',rider]]);
    const p={id:'horse',x:57,z:42,h:1.05,speed:6,jumpY:0},fx=createHorseWaterFX({waterY:course.WATER_Y,depthAt:course.waterDepth});w.scene.add(fx.group);
    for(let i=0;i<=105;i++){
      const t=i/60;p.x=53+Math.sin(p.h)*p.speed*t;p.z=39+Math.cos(p.h)*p.speed*t;
      rider.group.position.set(p.x,course.groundAt(p.x,p.z),p.z);rider.group.rotation.y=p.h;rider.update(1/60,p);fx.update(t,[p],riders,rider.group.position);
    }
    w.sun.position.set(p.x-45,70,p.z+35);w.sun.target.position.copy(rider.group.position);w.sun.target.updateMatrixWorld();w.course.update(1.75);w.sky.update(1.75);
    window.waterProof={w,rider,p,fx,course};
  });
  for(const view of ['chase','side','mobile']){
    const size=view==='mobile'?[390,844]:[1440,900];await page.setViewportSize({width:size[0],height:size[1]});
    const stats=await page.evaluate(({view,size})=>{
      const {w,rider,p,fx}=waterProof,q=rider.group.position;w.renderer.setSize(...size,false);w.camera.aspect=size[0]/size[1];w.camera.updateProjectionMatrix();
      if(view==='side'){w.camera.position.set(q.x-5,q.y+3.4,q.z-5);w.camera.lookAt(q.x,q.y+.7,q.z);}
      else{w.camera.position.set(q.x-Math.sin(p.h)*7.7,q.y+3.6,q.z-Math.cos(p.h)*7.7);w.camera.lookAt(q.x+Math.sin(p.h)*2,q.y+.8,q.z+Math.cos(p.h)*2);}
      w.renderer.render(w.scene,w.camera);return fx.stats;
    },{view,size});assert.ok(stats.surface>0&&stats.spray>0);await page.screenshot({path:`${out}/${view}.png`});
  }
  assert.deepEqual(errors,[]);await writeFile(`${out}/proof.json`,JSON.stringify(checks,null,2));console.log('PASS water contact, pause, airborne/landing, stopped/dry, bounded eight-rider GPU budget, disposal and mobile',checks);
}finally{await browser.close();}
