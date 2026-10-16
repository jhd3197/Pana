// World construction, performance and visual proof for the Venezuela circuits.
// Run with npm start; PANA_PLAYWRIGHT_PATH can point to an external Playwright.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const base=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/studio/venezuela';
await mkdir(output,{recursive:true});
const results=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas></canvas></body></html>`);
  await page.evaluate(async()=>{
    const THREE=await import('three'),tracks=await import('/g/derrape/tracks.js'),preview=await import('/studio/preview.js');
    const stage=preview.createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1500,1050,false);stage.camera.aspect=1500/1050;
    window.proof={THREE,tracks,preview,stage};
  });
  const registry=await page.evaluate(()=>({ids:proof.tracks.TRACKS.map(t=>t.id),legacy:proof.tracks.getTrack('playa').id}));
  assert.equal(registry.legacy,'bululu');assert.ok(!registry.ids.includes('playa'));assert.ok(registry.ids.includes('chichi'));
  for(const id of process.env.PANA_MAP_TEST_TRACKS?.split(',')||['estadio','paramo','bululu','chichi','plaza','desierto','llanos']){
    const metrics=await page.evaluate(id=>{
      const {THREE,tracks,preview,stage}=proof;if(proof.model){preview.release(proof.model);stage.renderer.renderLists.dispose();}
      const begin=performance.now(),T=tracks.makeTrack(tracks.getTrack(id)),group=T.build();
      const bounds=new THREE.Box3(new THREE.Vector3(...T.def.previewBounds[0]),new THREE.Vector3(...T.def.previewBounds[1]));
      const model={group,bounds};preview.ownMaterials(model);stage.scene.add(group);T.animated.forEach(o=>o.userData.tick?.(12,.016));
      Object.assign(proof,{T,model,bounds});
      const data=preview.inspect(model);preview.fitCamera(stage.camera,bounds,true);stage.renderer.render(stage.scene,stage.camera);
      let min=Infinity,max=-Infinity,grade=0,radius=Infinity;
      for(let s=0;s<T.TOTAL;s++){
        const a=T.pointAt(s-1),b=T.pointAt(s),c=T.pointAt(s+1),turn=Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x);
        radius=Math.min(radius,1/Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn))));
        min=Math.min(min,T.heightAtS(s));max=Math.max(max,T.heightAtS(s));grade=Math.max(grade,Math.abs(T.heightAtS(s+.5)-T.heightAtS(s-.5)));
      }
      const route=Array.from({length:Math.ceil(T.TOTAL/4)},(_,i)=>T.pointAt(i*T.TOTAL/Math.ceil(T.TOTAL/4)));
      const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);let crossings=0;
      for(let i=0;i<route.length;i++)for(let j=i+2;j<route.length;j++){
        if(i===0&&j===route.length-1)continue;
        const a=route[i],b=route[(i+1)%route.length],c=route[j],d=route[(j+1)%route.length];
        if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)crossings++;
      }
      const names=[];group.traverse(o=>{if(o.name&&!names.includes(o.name))names.push(o.name);});
      return {id,length:T.TOTAL,elevation:max-min,grade,radius,crossings,buildMs:performance.now()-begin,...data.stats,drawCalls:stage.renderer.info.render.calls,assetCounts:group.getObjectByName('track-environment')?.userData.assetCounts,names};
    },id);
    results.push(metrics);console.log(JSON.stringify(metrics));
    await page.screenshot({path:`${output}/${id}-overview.png`});
    await page.evaluate(()=>{const {stage,bounds,preview}=proof;preview.fitCamera(stage.camera,bounds,true,'top');stage.renderer.render(stage.scene,stage.camera);});
    await page.screenshot({path:`${output}/${id}-top.png`});
    const detail={desierto:[[-290,38,255],[-192,9,171]],llanos:[[-310,27,178],[-232,5,110]],estadio:[[-200,48,215],[-15,8,85]],paramo:[[50,167,-180],[-35,130,-275]],bululu:[[-440,145,250],[-120,0,45]],chichi:[[-50,270,-265],[65,175,-408]],plaza:[[650,110,560],[410,12,330]]}[id];
    await page.evaluate(([position,target])=>{const {stage}=proof;stage.camera.position.set(...position);stage.camera.lookAt(...target);stage.camera.near=.1;stage.camera.updateProjectionMatrix();stage.renderer.render(stage.scene,stage.camera);},detail);
    await page.screenshot({path:`${output}/${id}-detail.png`});
  }
  await writeFile(`${output}/metrics.json`,JSON.stringify(results,null,2));
  const budget={desierto:1600000,llanos:2500000,estadio:1000000,paramo:2000000,bululu:2200000,chichi:4500000,plaza:3000000};
  for(const m of results){
    assert.ok(m.triangles<budget[m.id],`${m.id}: actual rendered triangle budget (${m.triangles})`);
    assert.ok(m.drawCalls<1000,`${m.id}: draw-call budget`);
    assert.ok(m.radius>15,`${m.id}: safe inside corner radius`);assert.ok(m.grade<.4,`${m.id}: drivable gradient`);
    assert.equal(m.crossings,0,`${m.id}: racing line has no self-intersections`);
    if(['paramo','chichi'].includes(m.id))assert.ok(m.elevation>75,`${m.id}: sustained mountain descent/ascent`);
    const features={desierto:['pana-gas-yard','wind-carved-dunes','canyon-gateway-1','canyon-gateway-2','canyon-buttresses','desert-oasis','oasis-well-stop'],llanos:['hacienda-pana-yard','eastern-cattle-hato','llanos-cano','llanos-connected-wetlands','estero-road-bridges','llanos-roadside-arepera'],paramo:['summit-terminal','glacial-lake'],bululu:['roques-village','coastal-water'],chichi:['diving-school','chichi-river','coastal-lookout'],plaza:['plaza-waterfront','maracaibo-bridge','canal-water']}[m.id]||[];
    if(['desierto','llanos'].includes(m.id)){assert.ok(m.length>1800,`${m.id}: expanded journey`);assert.equal(Object.keys(m.assetCounts).length,10,`${m.id}: all ten pack models placed`);assert.ok(Object.values(m.assetCounts).every(n=>n>0),`${m.id}: nonempty placements`);}
    for(const name of features)assert.ok(m.names.includes(name),`${m.id}: ${name} exists`);
  }
  assert.deepEqual(errors,[]);console.log('PASS: registry migration, landmarks, elevation, rendering budgets and visual captures.');
  await page.close();
  const game=await browser.newPage({viewport:{width:1440,height:900}});game.on('pageerror',e=>errors.push(e.message));
  await game.goto(`${base}/g/derrape/?debug&manual&track=estadio`);await game.waitForFunction(()=>window.garage?.car);
  for(const {id} of results){
    await game.evaluate(async id=>{toGarage();buildTrack(id);await startRace(0);for(let i=0;i<270;i++)updateRace(1/60);},id);
    const views={desierto:[.025,.22,.43,.59,.75,.9],llanos:[.025,.18,.35,.53,.66,.83],estadio:[.06,.34,.65],paramo:[.1,.5,.72],bululu:[.1,.45,.86],chichi:[.12,.48,.75],plaza:[.08,.36,.7]}[id];
    for(const [i,u] of views.entries()){
      const name=['early','middle','late'][i]||`sector-${i+1}`;
      const metrics=await game.evaluate(async u=>{
        const THREE=await import('three');race.state='go';race.count=0;
        const T=getActiveTrack(),s=u*T.TOTAL,p=T.pointAt(s),q=T.pointAt(s+.5),c=race.player;
        // Teleport a settled car; discard any launch from starting-grid contact.
        Object.assign(c,{x:p.x,z:p.y,y:T.surfaceAt(p.x,p.y),h:Math.atan2(q.x-p.x,q.y-p.y),vx:0,vz:0,vy:0,onGround:true,airTime:0,spin:0,lap:1});
        c.prog=(s-T.LINE+T.TOTAL)%T.TOTAL;race.camPos=null;race.boardT=0;
        for(let i=0;i<3;i++)updateRace(1/60);
        renderer.toneMapping=THREE.NoToneMapping;renderer.render(race.scene,race.camera);
        return {grounded:Math.abs(c.y-T.groundAt(c.x,c.z))<.01,cameraFinite:race.camera.position.toArray().every(Number.isFinite)};
      },u);
      assert.ok(metrics.grounded&&metrics.cameraFinite,`${id}/${name}: grounded driver and finite chase camera`);
      await game.screenshot({path:`${output}/${id}-race-${name}.png`});
    }
  }
  assert.deepEqual(errors,[]);console.log('PASS: actual chase-camera views and repeated map switching.');
}finally{await browser.close();}
