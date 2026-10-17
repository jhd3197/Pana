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
    const {createSky}=await import('/engine/sky.js'),{inspect}=await import('/studio/preview.js');
    const T=makeTrack(def),scene=new THREE.Scene(),group=T.build(),pal=def.palette;
    const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1500,1000);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
    scene.fog=new THREE.Fog(pal.horizon,1300,2600);
    scene.add(group,new THREE.HemisphereLight(pal.hemiSky,pal.hemiGround,pal.hemiInt));
    const sun=new THREE.DirectionalLight(pal.sun,pal.sunInt);sun.position.set(-260,450,330);scene.add(sun);
    const sky=createSky(pal);sky.update(25);scene.add(sky.mesh);T.animated.forEach(o=>o.userData.tick?.(25,0));
    const camera=new THREE.PerspectiveCamera(42,1.5,.2,10000);
    camera.position.set(700,630,850);camera.lookAt(-30,30,-5);renderer.render(scene,camera);
    Object.assign(window,{proof:{THREE,T,scene,renderer,camera}});
    const metrics=inspect({group}).stats,route=[];let radius=Infinity,grade=0,min=Infinity,max=-Infinity,projection=0;
    for(let s=0;s<T.TOTAL;s++) {
      const a=T.pointAt(s-1),b=T.pointAt(s),c=T.pointAt(s+1),turn=Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x);
      radius=Math.min(radius,1/Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn))));grade=Math.max(grade,Math.abs(T.heightAtS(s+.5)-T.heightAtS(s-.5)));
      min=Math.min(min,T.heightAtS(s));max=Math.max(max,T.heightAtS(s));const d=Math.abs(T.paramOf(b.x,b.y)-s);projection=Math.max(projection,Math.min(d,T.TOTAL-d));
      if(s%4===0)route.push(b);
    }
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);let crossings=0;
    for(let i=0;i<route.length;i++)for(let j=i+2;j<route.length;j++) {
      if(i===0&&j===route.length-1)continue;const a=route[i],b=route[(i+1)%route.length],c=route[j],d=route[(j+1)%route.length];
      if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)crossings++;
    }
    scene.updateMatrixWorld(true);const decor=[];for(const name of ['track-environment','track-scenery'])group.getObjectByName(name).traverse(o=>{if(o.isMesh)decor.push(o);});
    const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,3),blocked=[];
    for(let s=0;s<T.TOTAL;s+=5)for(const off of [-8,-4,0,4,8]) {
      const a=T.pointAt(s),b=T.pointAt(s+.5),h=Math.atan2(b.x-a.x,b.y-a.y),x=a.x-Math.cos(h)*off,z=a.y+Math.sin(h)*off,y=T.surfaceAt(x,z);
      ray.ray.origin.set(x,y+3.3,z);const hit=ray.intersectObjects(decor,false)[0];if(hit)blocked.push({s,off,y:hit.point.y-y,name:hit.object.name});
    }
    const harbor=group.getObjectByName('puerto-harbor'),town=group.getObjectByName('puerto-colonial-town');
    const foundations=town.userData.houses.map(h=>({x:h.x,z:h.z,lift:h.y-T.terrainAt(h.x,h.z),embedded:h.base<=T.terrainAt(h.x,h.z)}));
    const ship=group.getObjectByName('puerto-cargo-ship'),shipWaterline=ship.position.y+ship.scale.y*ship.userData.waterline;
    return {...metrics,length:T.TOTAL,radius,grade,elevation:max-min,projection,crossings,blocked,drawCalls:renderer.info.render.calls,containers:harbor.userData.containerCount,houses:town.userData.houses.length,foundations,shipWaterline};
  });
  console.log(JSON.stringify(result));await writeFile(`${out}/metrics.json`,JSON.stringify(result,null,2));
  await page.screenshot({path:`${out}/overview.png`});
  for(const [name,position,target]of[
    ['terminal',[-500,175,475],[-260,12,180]],
    ['town',[370,170,155],[80,12,-110]],
    ['fort',[-145,154,-170],[-50,77,-282]],
    ['top',[0,1400,1],[0,0,0]],
  ]) {
    await page.evaluate(([p,t])=>{const {camera,renderer,scene}=proof;camera.position.set(...p);camera.lookAt(...t);renderer.render(scene,camera);},[position,target]);
    await page.screenshot({path:`${out}/${name}.png`});
  }
  // Menu artwork is captured from the shipped map, never from the reference photo.
  if(process.env.PANA_CAPTURE_PUERTO_ART==='1') {
    const data=await page.evaluate(()=>{const {camera,renderer,scene}=proof;renderer.setSize(1200,750);camera.aspect=1.6;camera.updateProjectionMatrix();camera.position.set(730,670,970);camera.lookAt(-30,30,-5);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/webp',.9).split(',')[1];});
    await writeFile('Pana/games/derrape/public/images/menu/puerto.webp',Buffer.from(data,'base64'));
    const thumb=await page.evaluate(()=>{const {camera,renderer,scene}=proof;renderer.setSize(480,300);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/webp',.85).split(',')[1];});
    await writeFile('Pana/games/derrape/public/images/menu/puerto-thumb.webp',Buffer.from(thumb,'base64'));
  }
  assert.ok(result.length>1800&&result.length<3200,'full circuit');assert.ok(result.radius>15,`radius ${result.radius}`);
  assert.ok(result.grade<.4,`grade ${result.grade}`);assert.ok(result.elevation>50,'real climb to the fort');
  assert.ok(result.projection<.01);assert.equal(result.crossings,0);assert.deepEqual(result.blocked,[],'all five lanes stay clear');
  assert.ok(result.containers>=50&&result.houses>=25,'substantial port and town');
  assert.ok(result.triangles<3200000&&result.drawCalls<900,'map rendering budget');
  assert.ok(result.foundations.every(h=>h.embedded&&h.lift<2),'houses sit on low grounded terraces');
  assert.ok(Math.abs(result.shipWaterline)<.001,'scaled ship meets sea level');
  // Use the real driver, vehicle, lighting and follow camera for the street-level proof.
  await page.goto(`${origin}/g/derrape/?debug&manual&track=puerto`);
  await page.waitForFunction(()=>window.getActiveTrack&&garage.car,null,{timeout:60000});
  await page.evaluate(async()=>{await startRace(0);for(let i=0;i<270;i++)updateRace(1/60);});
  const raceViews=[];
  for(const [name,u]of[['terminal',.13],['waterfront',.35],['climb',.48],['fort',.58],['town',.83]]) {
    const view=await page.evaluate(async u=>{
      const THREE=await import('three'),T=getActiveTrack(),s=u*T.TOTAL,p=T.pointAt(s),q=T.pointAt(s+.5),c=race.player;
      race.state='go';race.count=0;
      Object.assign(c,{x:p.x,z:p.y,y:T.surfaceAt(p.x,p.y),h:Math.atan2(q.x-p.x,q.y-p.y),vx:0,vz:0,vy:0,onGround:true,airTime:0,spin:0,lap:1,phaseT:0,ghost:false,rescueT:0});
      c.prog=(s-T.LINE+T.TOTAL)%T.TOTAL;race.camPos=null;race.boardT=0;
      for(let i=0;i<3;i++)updateRace(1/60);
      renderer.toneMapping=THREE.NoToneMapping;renderer.render(race.scene,race.camera);
      const target=new THREE.Vector3(c.x,c.y+1.5,c.z),segment=race.camera.position.clone().sub(target),distance=segment.length();
      const ray=new THREE.Raycaster(target,segment.normalize(),0,distance),decor=[];
      race.trackGroup.updateMatrixWorld(true);
      for(const name of ['track-environment','track-scenery'])race.trackGroup.getObjectByName(name).traverse(o=>{if(o.isMesh)decor.push(o);});
      return {grounded:Math.abs(c.y-T.groundAt(c.x,c.z))<.01,cameraFinite:race.camera.position.toArray().every(Number.isFinite),cameraHits:ray.intersectObjects(decor,false).length};
    },u);
    assert.ok(view.grounded&&view.cameraFinite,`${name}: grounded driver and finite camera`);
    assert.equal(view.cameraHits,0,`${name}: unobstructed chase camera`);
    raceViews.push({name,...view});await page.screenshot({path:`${out}/race-${name}.png`});
  }
  await writeFile(`${out}/race-views.json`,JSON.stringify(raceViews,null,2));
  assert.deepEqual(errors,[]);
  console.log('Puerto geometry, clearance, grounding, budgets and five real chase-camera views passed.');
}finally{await browser.close();}
