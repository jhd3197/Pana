import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {launch,openGame,waitFor} from '../../../tests/browser-kit.js';
const browser=await launch(), output=join(tmpdir(),'pana-reference-quality');
await mkdir(output,{recursive:true});
try {
 const page=await openGame(browser,'carreritas',{query:'debug&manual'});
 await waitFor(page,()=>window.garage?.car);
 const clock=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {referenceDetail}=await import('/g/carreritas/tracks/reference-world.js');
  const group=new THREE.Group(),sprite=new THREE.Sprite();group.add(sprite);
  const detail={value:2};let calls=0;
  const tick=referenceDetail(group,()=>{calls++;sprite.visible=true;},detail);
  const counts=[];
  for(const level of [0,1,2]){
   group.userData.setMapDetail(level);calls=0;
   for(let i=0;i<120;i++)tick(i/120,1/120);
   counts.push(calls);
  }
  return counts;
 });
 assert.ok(clock[0]<=16&&clock[1]<=31&&clock[2]===120,'only decoration updates are throttled');
 for(const id of ['cosmos','nubes','volcan','arrecife','cosmos']) {
  const proof=await page.evaluate(async id=>{
   const {setSettings}=await import('/engine/settings.js');
   toGarage();buildTrack(id);await startRace(0);race.state='audit';
   const T=getActiveTrack(),route=T.TOTAL,player=[race.player.x,race.player.y,race.player.z];
   const collect=quality=>{
    setSettings({quality});
    const result={sprites:0,particles:0,uniforms:[],roads:[]};
    race.trackGroup.traverseVisible(o=>{
     if(o.isSprite)result.sprites++;
     if(o.isPoints)result.particles+=Math.min(o.geometry.drawRange.count,o.geometry.attributes.position.count);
     if(o.name.startsWith(id+'-road'))result.roads.push(o.geometry.uuid);
     for(const m of [].concat(o.material||[]))if(m.uniforms?.uMapDetail)result.uniforms.push(m.uniforms.uMapDetail.value);
    });
    renderer.render(race.scene,race.camera);
    return result;
   };
   const high=collect('alta'),medium=collect('media'),low=collect('baja'),restored=collect('alta');collect('baja');
   return {id,high,medium,low,restored,stable:route===T.TOTAL&&JSON.stringify(player)===JSON.stringify([race.player.x,race.player.y,race.player.z])};
  },id);
  assert.ok(proof.low.uniforms.length>0,id+': effects wired');
  assert.ok(proof.low.uniforms.every(v=>v===0),id+': low shaders');
  assert.ok(proof.medium.uniforms.every(v=>v===1));
  assert.deepEqual(proof.high,proof.restored,id+': restores full effects');
  assert.deepEqual(proof.high.roads,proof.low.roads,id+': same road geometry');
  assert.ok(proof.stable,id+': no physics changes');
  if(proof.high.sprites)assert.ok(proof.low.sprites<=Math.ceil(proof.high.sprites/8));
  if(proof.high.particles)assert.ok(proof.low.particles<proof.high.particles*.2);
  await page.screenshot({path:join(output,id+'.png')});
  console.log(JSON.stringify(proof));
 }
 assert.deepEqual(page.errors,[]);
} finally {await browser.close();}
