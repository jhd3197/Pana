// Real model previews, native placements, road clearance and race-camera proof.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const origin=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/derrape-scenery';
const ids=[
  'plaza-bandstand','salt-harvester','boat-repair-yard','tire-workshop','flamingo',
  'ice-cream-cart','fish-auction-canopy','salt-boardwalk','ceramic-fountain','cafe-terrace',
  'laundry-courtyard','navigation-beacon','cargo-handcart','fruit-delivery-truck',
  'water-pump-station','street-mural',
];
const tracks=['plaza','salinas','estadio','bululu','delta','llanos'];
await mkdir(output,{recursive:true});
const errors=[],proof={models:[],maps:[]};
try {
  const page=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${origin}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}canvas{display:block}</style><canvas></canvas>');
  await page.evaluate(async()=>{
    const THREE=await import('three'),preview=await import('/studio/preview.js'),{ASSETS}=await import('/studio/catalog.js');
    const stage=preview.createPreview(document.querySelector('canvas'),true);
    stage.renderer.setSize(1200,850,false);stage.camera.aspect=1200/850;
    window.proofScene={THREE,preview,ASSETS,stage,model:null};
  });
  for(const id of ids) {
    const result=await page.evaluate(async id=>{
      const s=proofScene;if(s.model){s.model.group.removeFromParent();s.preview.release(s.model);}
      const asset=s.ASSETS.find(a=>a.id===id);if(!asset)throw Error(`Missing catalog entry ${id}`);
      s.model=await asset.build();s.preview.ownMaterials(s.model);s.stage.scene.add(s.model.group);
      const b=new s.THREE.Box3().setFromObject(s.model.group),stats=s.preview.inspect(s.model).stats;
      let finite=true;s.model.group.traverse(o=>{for(const a of Object.values(o.geometry?.attributes||{}))for(const n of a.array)if(!Number.isFinite(n))finite=false;});
      s.preview.fitCamera(s.stage.camera,b,false);s.stage.renderer.render(s.stage.scene,s.stage.camera);
      return {id,name:asset.name,usedBy:asset.usedBy,finite,min:b.min.toArray(),max:b.max.toArray(),...stats,draws:s.stage.renderer.info.render.calls};
    },id);
    assert.ok(result.finite&&result.triangles>200&&result.triangles<20000,JSON.stringify(result));
    assert.ok(result.min[1]>=-.02&&result.max[1]>.5,`${id}: grounded model ${JSON.stringify(result.min)}..${JSON.stringify(result.max)}`);
    assert.ok(result.usedBy.includes('Derrape'));
    proof.models.push(result);await page.screenshot({path:`${output}/model-${id}.png`});
  }
  for(const track of tracks) {
    const result=await page.evaluate(async({track,ids})=>{
      const s=proofScene;if(s.model){s.model.group.removeFromParent();s.preview.release(s.model);}
      const {makeTrack,getTrack,loadTrack}=await import('/g/derrape/tracks.js');await loadTrack(track);const {applyRaceQuality}=await import('/g/derrape/quality.js');
      const T=makeTrack(getTrack(track)),group=T.build(),roots=[];s.model={group};s.T=T;
      s.preview.ownMaterials(s.model);s.stage.scene.add(group);group.updateMatrixWorld(true);
      group.traverse(o=>{if(ids.includes(o.userData.assetId))roots.push(o);});s.roots=roots;
      const meshes=[],placements=[],collisions=[];roots.forEach(o=>o.traverse(m=>{if(m.isMesh)meshes.push(m);}));
      const ray=new s.THREE.Raycaster(new s.THREE.Vector3(),new s.THREE.Vector3(0,-1,0),0,150);
      for(let d=0;d<T.TOTAL;d+=4) {
        const a=T.pointAt(d),b=T.pointAt(d+.5),h=Math.atan2(b.x-a.x,b.y-a.y);
        for(const off of [-T.HW+1.6,0,T.HW-1.6]) {
          const x=a.x-Math.cos(h)*off,z=a.y+Math.sin(h)*off,y=T.surfaceAt(x,z);
          ray.ray.origin.set(x,y+100,z);
          const hit=ray.intersectObjects(meshes,false)[0];if(hit&&hit.point.y>y+.2)collisions.push({d,off,y:hit.point.y});
        }
      }
      const supportMeshes=[];group.traverse(o=>{if(o.isMesh&&!meshes.includes(o))supportMeshes.push(o);});
      for(const root of roots) {
        const pos=root.getWorldPosition(new s.THREE.Vector3()),bounds=new s.THREE.Box3().setFromObject(root);
        const birds=root.userData.placements;
        let supportGap=0;
        if(!birds) {
          ray.ray.origin.set(pos.x,pos.y+.1,pos.z);
          const hit=ray.intersectObjects(supportMeshes,false)[0];supportGap=hit?pos.y-hit.point.y:Infinity;
        }
        placements.push({id:root.userData.assetId,x:pos.x,y:pos.y,z:pos.z,min:bounds.min.toArray(),max:bounds.max.toArray(),supportGap,
          birds:birds?.map(p=>({x:p.x,z:p.z,groundGap:p.y-T.terrainAt(p.x,p.z),depth:.9-p.y,road:Math.abs(T.offsetOf(p.x,p.z))}))});
      }
      applyRaceQuality(s.stage.renderer,{trackGroup:group},'baja');
      const low=roots.map(o=>({id:o.userData.assetId,visible:o.visible}));
      applyRaceQuality(s.stage.renderer,{trackGroup:group},'alta');
      s.preview.fitCamera(s.stage.camera,new s.THREE.Box3(new s.THREE.Vector3(...T.def.previewBounds[0]),new s.THREE.Vector3(...T.def.previewBounds[1])),true);
      s.stage.renderer.render(s.stage.scene,s.stage.camera);
      return {track,placements,collisions,low,draws:s.stage.renderer.info.render.calls};
    },{track,ids});
    assert.deepEqual(result.collisions,[],`${track}: new scenery stays outside every driving lane`);
    assert.ok(result.placements.length>0,`${track}: actual placements`);
    for(const p of result.placements) {
      assert.ok(p.supportGap>=-.01&&p.supportGap<.31,`${track}/${p.id}: support gap ${p.supportGap}`);
      if(p.birds) {
        assert.ok(p.birds.length>=12,'a visible colony, not just a catalog bird');
        assert.ok(p.birds.every(b=>Math.abs(b.groundGap)<.001&&b.depth>=.08&&b.depth<=.5&&b.road>16),JSON.stringify(p.birds));
      }
    }
    assert.ok(result.low.every(p=>p.visible===(p.id!=='flamingo')),'Baja hides optional bird colonies and preserves the landmarks');
    proof.maps.push(result);await page.screenshot({path:`${output}/map-${track}.png`});
    for(const [index,p]of result.placements.entries()) {
      if(result.placements.findIndex(q=>q.id===p.id)!==index)continue;
      await page.evaluate(index=>{
        const s=proofScene,root=s.roots[index],b=new s.THREE.Box3().setFromObject(root);
        if(root.userData.placements){const birds=root.userData.placements,p=[...birds].sort((a,b)=>birds.filter(q=>Math.hypot(q.x-b.x,q.z-b.z)<20).length-birds.filter(q=>Math.hypot(q.x-a.x,q.z-a.z)<20).length)[0];b.set(new s.THREE.Vector3(p.x-18,p.y,p.z-18),new s.THREE.Vector3(p.x+18,p.y+5,p.z+18));}
        const center=b.getCenter(new s.THREE.Vector3()),size=b.getSize(new s.THREE.Vector3()),d=Math.max(size.x,size.z)*2.2;
        const eye=new s.THREE.Vector3(d*.65,d*.35,d).applyAxisAngle(new s.THREE.Vector3(0,1,0),root.rotation.y);
        s.stage.camera.position.copy(center).add(eye);s.stage.camera.lookAt(center);s.stage.camera.near=.1;s.stage.camera.updateProjectionMatrix();s.stage.renderer.render(s.stage.scene,s.stage.camera);
      },index);
      await page.screenshot({path:`${output}/world-${track}-${p.id}.png`});
    }
  }
  assert.deepEqual([...new Set(proof.maps.flatMap(m=>m.placements.map(p=>p.id)))].sort(),[...ids].sort());
  await page.close();
  const game=await browser.newPage({viewport:{width:1440,height:900}});game.on('pageerror',e=>errors.push(String(e)));
  await game.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);await game.waitForFunction(()=>window.garage?.car);
  for(const track of tracks) {
    const placed=proof.maps.find(m=>m.track===track).placements;
    await game.evaluate(async track=>{toGarage();buildTrack(track);await startRace(0);race.state='go';race.count=0;document.getElementById('count').textContent='';for(const c of race.cars)if(c!==race.player){c.done=true;c.x+=900;}},track);
    for(const p of placed.filter((p,i,a)=>a.findIndex(q=>q.id===p.id)===i)) {
      const view=await game.evaluate(async p=>{
        const {Vector3,Raycaster}=await import('three'),T=getActiveTrack(),c=race.player;
        const birds=p.birds,bird=birds&&[...birds].sort((a,b)=>birds.filter(q=>Math.hypot(q.x-b.x,q.z-b.z)<20).length-birds.filter(q=>Math.hypot(q.x-a.x,q.z-a.z)<20).length)[0];
        const target=new Vector3(bird?.x??p.x,bird?2.6:(p.min[1]+p.max[1])*.5,bird?.z??p.z),near=T.paramOf(target.x,target.z);
        const setCar=d=>{const a=T.pointAt(d),b=T.pointAt(d+.5);Object.assign(c,{x:a.x,z:a.y,y:T.groundAt(a.x,a.y),h:Math.atan2(b.x-a.x,b.y-a.y),vx:0,vz:0,vf:0,vy:0,onGround:true,boost:0,spin:0});race.camPos=null;for(let i=0;i<3;i++)updateRace(1/60);race.camera.updateMatrixWorld();};
        const ray=new Raycaster(),meshes=[];race.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});let best=null;
        for(let offset=-500;offset<=180;offset+=10){
          const d=near+offset;setCar(d);const projected=target.clone().project(race.camera),distance=target.distanceTo(race.camera.position);
          if(Math.abs(projected.x)>.68||projected.y<-.45||projected.y>.65||projected.z>=1||projected.z<=-1)continue;
          ray.set(race.camera.position,target.clone().sub(race.camera.position).normalize());ray.far=Math.max(0,distance-(bird?3:Math.max(p.max[0]-p.min[0],p.max[2]-p.min[2])));
          if(ray.intersectObjects(meshes,false).some(h=>h.object.visible&&h.distance<ray.far))continue;
          const score=distance*(1+Math.abs(projected.x)*.35);if(!best||score<best.score)best={d,score,distance,projected:projected.toArray()};
        }
        if(best)setCar(best.d);renderer.render(race.scene,race.camera);return best;
      },p);
      assert.ok(view,`${track}/${p.id}: visible from the ordinary race camera`);p.raceView=view;
      await game.screenshot({path:`${output}/race-${track}-${p.id}.png`});
    }
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/proof.json`,JSON.stringify(proof,null,2));
  console.log(JSON.stringify({models:proof.models.map(({id,triangles,draws})=>({id,triangles,draws})),maps:proof.maps.map(({track,placements,draws})=>({track,placements:placements.map(p=>p.id),draws}))}));
}finally{await browser.close();}
