// Three real consecutive cups, with mirror/split play, plus cancellation and
// warmed GPU-resource accounting. These are lifetime checks, not device FPS.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],records=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.addInitScript(()=>{
    localStorage.setItem('derrape:trophies',JSON.stringify({mango:'oro'}));
    const listeners=new Map(),add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener=function(type,fn,opts){if(this===window||this===document){let targets=listeners.get(this);if(!targets)listeners.set(this,targets=new Map());let list=targets.get(type);if(!list)targets.set(type,list=new Set());list.add(fn);}return add.call(this,type,fn,opts);};
    EventTarget.prototype.removeEventListener=function(type,fn,opts){if(this===window||this===document)listeners.get(this)?.get(type)?.delete(fn);return remove.call(this,type,fn,opts);};
    window.__listenerCount=()=>[...listeners.values()].reduce((sum,m)=>sum+[...m.values()].reduce((n,set)=>n+set.size,0),0);
    const intervals=new Set(),start=window.setInterval,stop=window.clearInterval;
    window.setInterval=(fn,ms,...args)=>{const id=start(fn,ms,...args);intervals.add(id);return id;};
    window.clearInterval=id=>{intervals.delete(id);stop(id);};window.__intervalCount=()=>intervals.size;
  });
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/derrape/?debug&auto&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.car-choice img')].every(img=>img.naturalWidth>0),null,{timeout:90000});
  for(let cycle=0;cycle<3;cycle++){
    await page.evaluate(async cycle=>{toGarage();setup.mode='agua';setup.split=cycle>0;setup.mirror=cycle>0;await startRace(0);},cycle);
    for(let stage=0;stage<4;stage++){
      await page.waitForFunction(()=>race.state==='count',null,{timeout:120000});
      const result=await page.evaluate(()=>{
        for(let i=0;i<16000&&race.state!=='end';i++)updateRace(1/60,false);
        updateRace(0);renderer.render(race.scene,race.camera);
        return {track:getActiveTrack().id,state:race.state,status:race.cup.session.status,ledger:race.cup.session.ledger.filter(r=>r.stage===race.cup.session.stageIndex),mirror:race.scene.scale.x,p2:race.p2?.done,clock:race.clock};
      });
      assert.equal(result.state,'end');assert.equal(result.ledger.length,8);
      if(cycle>0){assert.equal(result.mirror,-1);assert.equal(result.p2,true);}
      records.push({cycle,stage,...result});
      if(stage<3){await page.locator('#again').click();}
    }
    // Dispose the last race world and compare the same warmed garage each time.
    // Different finish cameras upload different subsets of a retained world.
    const memory=await page.evaluate(()=>{toGarage();buildTrack('estadio');renderer.render(garage.scene,garage.camera);return {memory:{...renderer.info.memory},listeners:__listenerCount(),intervals:__intervalCount(),raceCars:race.cars.length,track:getActiveTrack().id};});
    assert.equal(memory.raceCars,0);records.push({cycle,...memory});console.log(`cup cycle ${cycle+1}: ${JSON.stringify(memory)}`);
  }
  const last=records.filter(r=>r.memory);assert.equal(last[2].listeners,last[1].listeners);
  assert.equal(last[2].intervals,last[1].intervals);
  assert.ok(last[2].memory.geometries<=last[1].memory.geometries+2);assert.ok(last[2].memory.textures<=last[1].memory.textures+2);
  const cancellation=await page.evaluate(async()=>{buildTrack('estadio');await startRace(0);toGarage();setup.mode='agua';const pending=startRace(0);toGarage();await pending;return {state:race.state,cars:race.cars.length,hidden:document.getElementById('loading').hidden||document.getElementById('loading').classList.contains('hidden')};});
  assert.equal(cancellation.state,'off');assert.equal(cancellation.cars,0);
  assert.deepEqual(errors,[]);await mkdir('art/grand-prix',{recursive:true});await writeFile('art/grand-prix/lifetime.json',JSON.stringify({records,cancellation},null,2));
}finally{await browser.close();}
