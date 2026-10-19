// Actual geometry, route safety, budgets and reproducible visual proof.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true});
const origin=process.env.PANA_TEST_URL||'http://localhost:8461',out='art/studio/puerto';
await mkdir(out,{recursive:true});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/studio/settings.html`);
  await page.setContent('<style>body{margin:0}canvas{display:block}</style><canvas></canvas><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const result=await page.evaluate(async()=>{
    const THREE=await import('three'),{makeTrack}=await import('/g/derrape/track-runtime.js'),{default:def}=await import('/g/derrape/tracks/puerto.js');
    const {createSky}=await import('/engine/worlds/sky.js'),{inspect}=await import('/studio/preview.js');
    const T=makeTrack(def),scene=new THREE.Scene(),group=T.build(),pal=def.palette;
    const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1500,1000);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
    // The overview camera is far outside the driving fog range.
    scene.fog=new THREE.Fog(pal.horizon,3500,6000);
    scene.add(group,new THREE.HemisphereLight(pal.hemiSky,pal.hemiGround,pal.hemiInt));
    const sun=new THREE.DirectionalLight(pal.sun,pal.sunInt);sun.position.set(-260,450,330);scene.add(sun);
    const sky=createSky(pal);sky.update(25);scene.add(sky.mesh);T.animated.forEach(o=>o.userData.tick?.(25,0));
    const camera=new THREE.PerspectiveCamera(42,1.5,.2,10000);
    camera.position.set(1100,1100,1350);camera.lookAt(-30,70,-280);renderer.render(scene,camera);
    Object.assign(window,{proof:{THREE,T,scene,renderer,camera}});
    const metrics=inspect({group}).stats,route=[];let radius=Infinity,grade=0,min=Infinity,max=-Infinity,projection=0,protrusion=0;
    for(let s=0;s<T.TOTAL;s++) {
      const a=T.pointAt(s-1),b=T.pointAt(s),c=T.pointAt(s+1),turn=Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x);
      radius=Math.min(radius,1/Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn))));grade=Math.max(grade,Math.abs(T.heightAtS(s+.5)-T.heightAtS(s-.5)));
      min=Math.min(min,T.heightAtS(s));max=Math.max(max,T.heightAtS(s));const d=Math.abs(T.paramOf(b.x,b.y,T.heightAtS(s))-s);projection=Math.max(projection,Math.min(d,T.TOTAL-d));
      const h=Math.atan2(c.x-b.x,c.y-b.y);
      for(const off of [-T.HW+1,0,T.HW-1]){const x=b.x-Math.cos(h)*off,z=b.y+Math.sin(h)*off;protrusion=Math.max(protrusion,T.terrainAt(x,z)-T.surfaceAt(x,z,T.heightAtS(s)));}
      if(s%4===0)route.push({x:b.x,y:b.y,height:T.heightAtS(s)});
    }
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);let crossings=0,crossingClearance=Infinity;
    for(let i=0;i<route.length;i++)for(let j=i+2;j<route.length;j++) {
      if(i===0&&j===route.length-1)continue;const a=route[i],b=route[(i+1)%route.length],c=route[j],d=route[(j+1)%route.length];
      if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0){crossings++;crossingClearance=Math.min(crossingClearance,Math.abs(a.height-c.height));}
    }
    scene.updateMatrixWorld(true);const decor=[];for(const name of ['track-environment','track-scenery'])group.getObjectByName(name).traverse(o=>{if(o.isMesh&&o.name!=='world-terrain'&&o.name!=='coastal-water'&&!o.name.includes('horizon')){o.geometry.computeBoundingBox();decor.push(o);}});
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,3),blocked=[];
    for(let s=0;s<T.TOTAL;s+=5)for(const off of [-8,-4,0,4,8]) {
      if(T.gapAt(s))continue;
      const a=T.pointAt(s),b=T.pointAt(s+.5),h=Math.atan2(b.x-a.x,b.y-a.y),x=a.x-Math.cos(h)*off,z=a.y+Math.sin(h)*off,y=T.groundAt(x,z,T.heightAtS(s));
      ray.ray.origin.set(x,y+3.3,z);const hit=ray.intersectObjects(decor,false)[0];if(T.terrainAt(x,z)>y+.3)blocked.push({s,off,y:T.terrainAt(x,z)-y,name:'terrain'});if(hit)blocked.push({s,off,y:hit.point.y-y,name:hit.object.name});
    }
    const harbor=group.getObjectByName('puerto-harbor'),town=group.getObjectByName('puerto-colonial-town'),tunnel=group.getObjectByName('puerto-harbor-tunnel');
    const {TOWN_STREETS}=await import('/g/derrape/tracks/puerto-layout.js'),{pathDistance}=await import('/g/derrape/tracks/world-kit.js');
    const streets=TOWN_STREETS.map(pathDistance),orientations=[...new Set(town.userData.houses.map(h=>h.rot))];
    const frontages=town.userData.houses.map(h=>Math.min(...streets.map(d=>d(h.x+Math.sin(h.rot)*20,h.z+Math.cos(h.rot)*20))));
    let streetGrade={value:0};
    for(const path of TOWN_STREETS)for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
      for(let d=1;d<length-1;d+=2){
        const x=a[0]+dx*d,z=a[1]+dz*d;if(Math.abs(T.offsetOf(x,z))<T.HW+10)continue;
        const grade=Math.abs(T.terrainAt(x+dx,z+dz)-T.terrainAt(x-dx,z-dz))/2;
        if(grade>streetGrade.value)streetGrade={value:grade,x,z};
      }
    }
    const foundations=town.userData.houses.map(h=>({x:h.x,z:h.z,lift:h.y-T.terrainAt(h.x,h.z),embedded:h.base<=T.terrainAt(h.x,h.z)}));
    const ship=group.getObjectByName('puerto-cargo-ship'),shipWaterline=ship.position.y+ship.scale.y*ship.userData.waterline;
    const passage=harbor.userData.siloPassage,roofRay=new THREE.Raycaster(new THREE.Vector3(passage.x,T.heightAtS(T.paramOf(passage.x,passage.z,-14)),passage.z),new THREE.Vector3(0,1,0));
    const roof=roofRay.intersectObject(tunnel,true)[0];
    const siloClearance=roof?roof.point.y-roofRay.ray.origin.y:0,roofGaps=[];
    for(let s=T.tunnel.s0+6;s<T.tunnel.s1-6;s+=5)for(const off of [-8,0,8]){
      const p=T.pointAt(s),q=T.pointAt(s+.1),h=Math.atan2(q.x-p.x,q.y-p.y),y=T.heightAtS(s);
      roofRay.ray.origin.set(p.x-Math.cos(h)*off,y+.1,p.y+Math.sin(h)*off);
      const hit=roofRay.intersectObject(tunnel,true)[0];
      if(!hit||hit.point.y-y<11.8||hit.point.y-y>13.2)roofGaps.push({s,off,height:hit?hit.point.y-y:null});
    }
    return {...metrics,length:T.TOTAL,radius,grade,elevation:max-min,projection,protrusion,crossings,crossingClearance,blocked,drawCalls:renderer.info.render.calls,containers:harbor.userData.containerCount,containerWalls:harbor.userData.stacks.filter(s=>s.wall&&s.height>=4).length,siloClearance,roofGaps,tunnelLength:tunnel.userData.length,tunnelWindows:tunnel.userData.windows,houses:town.userData.houses.length,orientations,frontages,streetGrade,streetMinZ:Math.min(...TOWN_STREETS.flat().map(p=>p[1])),foundations,shipWaterline};
  });
  console.log(JSON.stringify(result));await writeFile(`${out}/metrics.json`,JSON.stringify(result,null,2));
  await page.screenshot({path:`${out}/overview.png`});
  for(const [name,position,target]of[
    ['terminal',[-700,225,520],[-340,12,220]],
    ['town',[370,170,155],[80,12,-110]],
    ['hillside',[400,270,-80],[-25,75,-340]],
    ['silos',[-660,100,225],[-560,27,105]],
    ['fort',[-440,425,-440],[-50,160,-800]],
    ['jump',[-560,300,-1130],[-330,175,-1030]],
    ['top',[0,1900,-300],[0,0,-300]],
  ]) {
    await page.evaluate(([p,t])=>{const {camera,renderer,scene}=proof;camera.position.set(...p);camera.lookAt(...t);renderer.render(scene,camera);},[position,target]);
    await page.screenshot({path:`${out}/${name}.png`});
  }
  assert.ok(result.length>5300&&result.length<6800,'expanded harbor and mountain circuit');assert.ok(result.radius>15,`radius ${result.radius}`);
  assert.ok(result.grade<.4,`grade ${result.grade}`);assert.ok(result.elevation>170,'real climb to the fort');
  assert.ok(result.protrusion<.1,'no terrain enters the full road width, including both curbs');
  assert.ok(result.projection<.01);assert.equal(result.crossings,1);assert.ok(result.crossingClearance>25,'gate underpass clears the upper battlements');assert.deepEqual(result.blocked,[],'all five lanes stay clear');
  assert.ok(result.containers>=450&&result.houses>=65,'cargo blocks and occupied urban blocks');
  assert.equal(result.orientations.length,4,'houses face all four sides of the blocks');
  assert.ok(result.frontages.every(d=>d<9),'every house entrance reaches a street');
  assert.ok(result.streetMinZ>=-385,'town streets stay below the fort embankment');
  assert.ok(result.streetGrade.value<.65,`town streets avoid steep cliffs: ${JSON.stringify(result.streetGrade)}`);
  assert.ok(result.containerWalls>=10&&result.siloClearance>11&&result.siloClearance<14,'full-height tunnel beneath the original silo bank');
  assert.ok(result.tunnelLength>300&&result.tunnelWindows>50,'substantial submerged tunnel with sea windows');
  assert.deepEqual(result.roofGaps,[],'continuous tunnel roof across bends and slopes');
  // +200 k for the festive roadside (library trees, props, flocks).
  assert.ok(result.triangles<3400000&&result.drawCalls<900,'map rendering budget');
  assert.ok(result.foundations.every(h=>h.embedded&&h.lift<4),'houses sit on grounded terraces below one storey');
  assert.ok(Math.abs(result.shipWaterline)<.001,'scaled ship meets sea level');
  // Use the real driver, vehicle, lighting and follow camera for the street-level proof.
  await page.goto(`${origin}/g/derrape/?debug&manual&track=puerto`);
  await page.waitForFunction(()=>window.getActiveTrack&&garage.car,null,{timeout:60000});
  await page.evaluate(async()=>{await startRace(0);for(let i=0;i<270;i++)updateRace(1/60);});
  const raceViews=[];
  for(const [name,u]of[['silos',[-560,80,-12]],['underwater',[-665,230,-14]],['terminal',[-430,320,4.2]],['waterfront',[115,0,4.2]],['climb',[350,-275,44]],['gate',[-50,-565,142.2]],['spiral',[-60,-868,166]],['fort',[110,-800,190.2]],['exit','jump'],['town',[-330,-225,44]]]) {
    const view=await page.evaluate(async u=>{
      const THREE=await import('three'),T=getActiveTrack(),s=u==='jump'?T.ramps[0].s0-8:T.paramOf(...u),p=T.pointAt(s),q=T.pointAt(s+.5),c=race.player;
      race.state='go';race.count=0;
      Object.assign(c,{x:p.x,z:p.y,y:T.heightAtS(s),h:Math.atan2(q.x-p.x,q.y-p.y),vx:0,vz:0,vy:0,onGround:true,airTime:0,spin:0,lap:1,phaseT:0,ghost:false,rescueT:0});
      c.prog=(s-T.LINE+T.TOTAL)%T.TOTAL;race.camPos=null;race.boardT=0;
      for(let i=0;i<3;i++)updateRace(1/60);
      renderer.toneMapping=THREE.NoToneMapping;renderer.render(race.scene,race.camera);
      const target=new THREE.Vector3(c.x,c.y+1.5,c.z),segment=race.camera.position.clone().sub(target),distance=segment.length();
      const ray=new THREE.Raycaster(target,segment.normalize(),0,distance),decor=[];
      race.trackGroup.updateMatrixWorld(true);
      for(const name of ['track-environment','track-scenery'])race.trackGroup.getObjectByName(name).traverse(o=>{if(o.isMesh&&o.name!=='world-terrain'&&o.name!=='coastal-water'&&!o.name.includes('horizon')){o.geometry.computeBoundingBox();decor.push(o);}});
      return {grounded:Math.abs(c.y-T.groundAt(c.x,c.z,c.y))<.01,cameraFinite:race.camera.position.toArray().every(Number.isFinite),cameraHeight:race.camera.position.y-c.y,cameraHits:ray.intersectObjects(decor,false).length};
    },u);
    assert.ok(view.grounded&&view.cameraFinite,`${name}: grounded driver and finite camera`);
    assert.equal(view.cameraHits,0,`${name}: unobstructed chase camera`);
    assert.ok(view.cameraHeight>4.5&&view.cameraHeight<5.5,`${name}: chase camera follows the current deck, including below sea level`);
    raceViews.push({name,...view});await page.screenshot({path:`${out}/race-${name}.png`});
  }
  await writeFile(`${out}/race-views.json`,JSON.stringify(raceViews,null,2));
  assert.deepEqual(errors,[]);
  console.log('Puerto geometry, street access, clearance, grounding, budgets and ten real chase-camera views passed.');
}finally{await browser.close();}
