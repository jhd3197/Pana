// Clearance and motion proof for the harbor-to-coast audit.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const result=await page.evaluate(async()=>{
    const THREE=await import('three'),{makeTrack}=await import('/g/carreritas/track-runtime.js');
    const {default:def}=await import('/g/carreritas/tracks/puerto.js'),{placeProps}=await import('/g/carreritas/breakables.js');
    const T=makeTrack(def),group=T.build();group.updateMatrixWorld(true);
    const harbor=group.getObjectByName('puerto-harbor'),town=group.getObjectByName('puerto-colonial-town'),tunnel=group.getObjectByName('puerto-harbor-tunnel');
    const lampViolations=town.userData.lamps.filter(p=>Math.abs(T.offsetOf(p.x,p.z,p.y))<T.HW+2.5);
    const buriedSigns=[];group.traverse(o=>{if(o.name==='bend-chevron-board'&&o.userData.s>=T.tunnel.s0-15&&o.userData.s<=T.tunnel.s1+15)buriedSigns.push(o.userData.s);});
    const hiddenSigns=[],ray=new THREE.Raycaster();
    for(const sign of tunnel.userData.wallSigns){
      const p=T.pointAt(sign.s-6),start=new THREE.Vector3(p.x,T.heightAtS(sign.s-6)+3.1,p.y);
      const target=new THREE.Vector3(sign.x,sign.y,sign.z),delta=target.sub(start),length=delta.length();
      ray.set(start,delta.normalize());ray.far=length-.2;
      if(ray.intersectObject(tunnel,true).length)hiddenSigns.push(sign.s);
    }
    const props=placeProps(T),strayProps=props.filter(p=>{const s=T.paramOf(p.x,p.z,p.y);return !def.breakableAt(s,T)||Math.abs(p.y-T.groundAt(p.x,p.z,p.y))>.05;});
    const load=group.getObjectByName('puerto-working-cargo'),boats=[];group.traverse(o=>{if(o.name==='puerto-moored-boat')boats.push(o);});
    const states=[];
    for(const t of [0,5,10,20,30]){T.animated.forEach(o=>o.userData.tick?.(t,0));states.push({load:load.position.y,boat:boats[0].position.y});}
    // Dense full-width probe of the requested stretch, including the lamp caps.
    const lights=[];town.traverse(o=>{if(o.isInstancedMesh&&o.name.includes('puerto-street-lamps'))lights.push(o);});
    group.updateMatrixWorld(true);const lampHits=[];
    for(let s=T.TOTAL*.065;s<T.TOTAL*.26;s+=2)for(const off of [-10.8,-8,-4,0,4,8,10.8]){
      const p=T.pointAt(s),q=T.pointAt(s+.1),h=Math.atan2(q.x-p.x,q.y-p.y),y=T.heightAtS(s);
      ray.set(new THREE.Vector3(p.x-Math.cos(h)*off,y+8,p.y+Math.sin(h)*off),new THREE.Vector3(0,-1,0));ray.far=7.8;
      if(ray.intersectObjects(lights,false).length)lampHits.push({s,off});
    }
    const floodlights=harbor.userData.floodlights,floodlightViolations=floodlights.filter(p=>Math.abs(T.offsetOf(p.x,p.z))<T.HW+p.radius+4);
    return {floodlights,floodlightViolations,lampMeshes:lights.length,lampCount:town.userData.lamps.length,lampViolations,lampHits,buriedSigns,hiddenSigns,signCount:tunnel.userData.wallSigns.length,propCount:props.length,strayProps,states,loadClearance:Math.abs(T.offsetOf(load.position.x,load.position.z)),boatCount:boats.length};
  });
  await mkdir('art/map-audit',{recursive:true});
  await writeFile('art/map-audit/puerto-clearance.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  assert.equal(result.floodlights.length,4);assert.deepEqual(result.floodlightViolations,[],'harbor floodlight heads and poles stay outside the road');
  assert.ok(result.lampCount>10&&result.lampMeshes>0);assert.deepEqual(result.lampViolations,[]);assert.deepEqual(result.lampHits,[],'no lamps enter the full-width crane-to-coast corridor');
  assert.equal(result.signCount,9);assert.deepEqual(result.buriedSigns,[]);assert.deepEqual(result.hiddenSigns,[],'wall signs are visible from the driving lane');
  assert.ok(result.propCount>0);assert.deepEqual(result.strayProps,[],'loose props stay in authored town zones on their supporting deck');
  assert.ok(result.loadClearance>30&&result.boatCount===4);
  assert.ok(Math.max(...result.states.map(s=>s.load))-Math.min(...result.states.map(s=>s.load))>5);
  assert.ok(Math.max(...result.states.map(s=>s.boat))-Math.min(...result.states.map(s=>s.boat))>.1);
}finally{await browser.close();}
