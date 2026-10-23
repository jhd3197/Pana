import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/i.test(m.text()))errors.push(m.text());});
 await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&manual&track=puerto`);
 await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
 const proof=await page.evaluate(async()=>{
  await startRace(0);const T=getActiveTrack(),items=race.items,p=items.pads[4],c=race.player;
  const material=p.m.material,shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <emissivemap_fragment>'};material.onBeforeCompile(shader);
  items.update(.2,[],true);const before=shader.uniforms.padClock.value;items.update(.2,[],true);
  const animated=shader.uniforms.padClock.value>before;
  Object.assign(c,{x:p.x,z:p.z,y:T.groundAt(p.x,p.z,p.y),onGround:true,boost:0,phaseT:0,rescueT:0,ghost:false});
  items.update(1/60,[c],true);const boosted=c.boost,activated=p.flash>.9;
  renderer.render(race.scene,race.camera);
  const width=material.map.image.width,height=material.map.image.height,extraMeshes=!!p.art;
  let disposed=0;material.map.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
  items.dispose();return {animated,boosted,activated,disposed,width,height,extraMeshes,removed:p.m.parent===null};
 });
 assert.ok(proof.animated,'shared shader clock advances');assert.ok(proof.boosted>=1.2&&proof.activated,'real activation drives boost and flash');
 assert.equal(proof.width,128);assert.equal(proof.height,256);assert.equal(proof.extraMeshes,false);
 assert.equal(proof.disposed,2);assert.ok(proof.removed);
 assert.deepEqual(errors,[],'pad material compiles and renders');
 console.log(JSON.stringify(proof));
}finally{await browser.close();}
