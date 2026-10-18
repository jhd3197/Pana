// Real track constructors, geometry and chase-camera proof for plan 56.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const origin=process.env.PANA_TEST_URL||'http://localhost:8461';
const ids=(process.env.PANA_WATER_TRACKS||'salto,delta,cuevas,salinas').split(',');
try{
  await page.goto(`${origin}/g/derrape/?debug&auto&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  for(const id of ids){
    const out=`art/water-worlds/${id}`;await mkdir(out,{recursive:true});
    const result=await page.evaluate(async id=>{
      toGarage();setup.mode='race';setup.laps=2;buildTrack(id);await startRace(0);
      const T=getActiveTrack(),THREE=await import('three');
      const result={id,length:T.TOTAL,minRadius:Infinity,maxGrade:0,projection:0,protrusion:0,clearance:[],cameras:[],triangles:0,route:Array.from({length:600},(_,i)=>T.pointAt(i*T.TOTAL/600).toArray())};
      for(let s=0;s<T.TOTAL;s+=1){
        const a=T.pointAt(s-1),b=T.pointAt(s),c=T.pointAt(s+1),h=Math.atan2(c.x-a.x,c.y-a.y);
        const turn=Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x);
        result.minRadius=Math.min(result.minRadius,1/Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn))));
        result.maxGrade=Math.max(result.maxGrade,Math.abs(T.heightAtS(s+.5)-T.heightAtS(s-.5)));
        for(const off of [-T.HW+1,0,T.HW-1]){
          const x=b.x-Math.cos(h)*off,z=b.y+Math.sin(h)*off,q=T.paramOf(x,z),d=Math.abs(s-q);
          result.projection=Math.max(result.projection,Math.min(d,T.TOTAL-d));
          result.protrusion=Math.max(result.protrusion,T.terrainAt(x,z)-T.surfaceAt(x,z));
        }
      }
      T.group.updateMatrixWorld(true);
      const decor=[];
      for(const name of ['track-environment','track-scenery'])T.group.getObjectByName(name)?.traverse(o=>{if(o.isMesh)decor.push(o);});
      for(const m of decor)result.triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);
      const ray=new THREE.Raycaster();
      for(let i=0;i<120;i++){
        const s=T.TOTAL*i/120,a=T.pointAt(s),b=T.pointAt(s+.5),h=Math.atan2(b.x-a.x,b.y-a.y),y=T.heightAtS(s);
        for(const off of [-T.HW+1,0,T.HW-1]){
          const x=a.x-Math.cos(h)*off,z=a.y+Math.sin(h)*off;
          ray.set(new THREE.Vector3(x,y+3.2,z),new THREE.Vector3(0,-1,0));ray.near=0;ray.far=2.9;
          const hit=ray.intersectObjects(decor,false)[0];if(hit)result.clearance.push({u:s/T.TOTAL,off,name:hit.object.name,y:hit.point.y-y});
        }
        for(const back of [-1,1]){
          const target=new THREE.Vector3(a.x,y+1.4,a.y),camera=new THREE.Vector3(a.x-Math.sin(h)*11*back,y+5,a.y-Math.cos(h)*11*back);
          ray.set(target,camera.clone().sub(target).normalize());ray.far=target.distanceTo(camera);
          const hit=ray.intersectObjects(decor,false)[0];if(hit)result.cameras.push({u:s/T.TOTAL,back,name:hit.object.name});
        }
      }
      return result;
    },id);
    await writeFile(`${out}/geometry.json`,JSON.stringify(result,null,2));
    const xs=result.route.map(p=>p[0]),ys=result.route.map(p=>p[1]),xmin=Math.min(...xs)-40,ymin=Math.min(...ys)-40,w=Math.max(...xs)-xmin+40,h=Math.max(...ys)-ymin+40;
    await writeFile(`${out}/route.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${xmin} ${ymin} ${w} ${h}"><rect x="${xmin}" y="${ymin}" width="${w}" height="${h}" fill="#eeeee5"/><polyline points="${[...result.route,result.route[0]].map(p=>p.join(',')).join(' ')}" fill="none" stroke="#2b564d" stroke-width="12"/><text x="${xmin+15}" y="${ymin+25}" font-family="sans-serif" font-size="18">${id} · ${(result.length/1000).toFixed(2)} km</text></svg>`);
    console.log(JSON.stringify({...result,route:undefined}));
    assert.ok(result.length>=1500&&result.length<=3300,`${id}: length ${result.length}`);
    assert.ok(result.minRadius>15,`${id}: minimum radius ${result.minRadius}`);
    assert.ok(result.maxGrade<.25,`${id}: grade ${result.maxGrade}`);
    assert.ok(result.projection<.25,`${id}: road lane projection ambiguity`);
    assert.ok(result.protrusion<.1,`${id}: terrain below road`);
    assert.deepEqual(result.clearance,[],`${id}: car lanes clear`);
    assert.deepEqual(result.cameras,[],`${id}: forward/look-back chase segment clear`);
    assert.ok(result.triangles<1800000,`${id}: environment triangle budget`);
    const views=[];
    for(const u of [0,.18,.4,.5,.55,.6,.62,.68,.79]){
      const view=await page.evaluate(u=>{
        const T=getActiveTrack(),p=T.pointAt(T.TOTAL*u),q=T.pointAt(T.TOTAL*u+1),c=race.player;
        c.x=p.x;c.z=p.y;c.y=T.groundAt(c.x,c.z);c.h=Math.atan2(q.x-p.x,q.y-p.y);race.camPos=null;
        updateRace(0);document.getElementById('count').textContent='';renderer.render(race.scene,race.camera);
        const frame={u,camera:race.camera.position.toArray(),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory}};
        race.cars.forEach(c=>c.car.root.visible=false);renderer.render(race.scene,race.camera);frame.environmentDraws=renderer.info.render.calls;
        race.cars.forEach(c=>c.car.root.visible=true);renderer.render(race.scene,race.camera);return frame;
      },u);
      await page.screenshot({path:`${out}/driver-${Math.round(u*100)}.png`});
      views.push(view);
      assert.ok(view.environmentDraws<=850,`${id}: environment draw budget ${view.environmentDraws}`);
    }
    await page.setViewportSize({width:844,height:390});
    await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));updateRace(0);document.getElementById('count').textContent='';renderer.render(race.scene,race.camera);});
    await page.screenshot({path:`${out}/mobile-landscape.png`});
    await page.setViewportSize({width:1280,height:800});
    const overview=await page.evaluate(async()=>{
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));document.getElementById('count').textContent='';
      const THREE=await import('three'),T=getActiveTrack(),bounds=new THREE.Box3(new THREE.Vector3(...T.def.previewBounds[0]),new THREE.Vector3(...T.def.previewBounds[1])),center=bounds.getCenter(new THREE.Vector3());
      const camera=new THREE.PerspectiveCamera(48,1280/800,1,5000);camera.position.copy(center).add(new THREE.Vector3(350,750,650));camera.lookAt(center);
      const fog=race.scene.fog;race.scene.fog=null;race.sky.mesh.visible=false;renderer.render(race.scene,camera);
      const png=renderer.domElement.toDataURL('image/png');race.scene.fog=fog;race.sky.mesh.visible=true;return png;
    });
    await writeFile(`${out}/overview.png`,Buffer.from(overview.split(',')[1],'base64'));
    await writeFile(`${out}/render-views.json`,JSON.stringify({viewport:[1280,800],profile:'Headless Chromium; software WebGL, not physical-device FPS',views},null,2));
    if(!process.env.PANA_GEOMETRY_ONLY){
      await page.evaluate(async()=>{
        await startRace(0);
        for(let i=4;i<8;i++)race.cars.push(makeRacer(i,false,`Rival ${i+1}`,'calle'));
        race.cars.forEach((c,i)=>placeRacer(c,i%2?-3.5:3.5,Math.floor(i/2)));
      });
      let run;
      for(let chunk=0;chunk<18;chunk++){
        run=await page.evaluate(()=>{
          for(let i=0;i<1800&&!race.cars.every(c=>c.done);i++)updateRace(1/60);
          return {seconds:race.clock,cars:race.cars.map(c=>({name:c.name,lap:c.lap,done:c.done,time:c.time,x:c.x,z:c.z}))};
        });
        if(run.cars.every(c=>c.done))break;
      }
      await writeFile(`${out}/eight-car-race.json`,JSON.stringify(run,null,2));
      assert.ok(run.cars.every(c=>c.done&&c.lap===3),`${id}: eight cars complete two actual laps: ${JSON.stringify(run)}`);
      console.log(`${id}: eight cars completed in ${run.seconds.toFixed(1)} simulated seconds`);
    }
    assert.deepEqual(errors,[]);
  }
}finally{await browser.close();}
