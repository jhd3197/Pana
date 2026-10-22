// Explicit timing proof: current car physics, normal AI steering, street tires.
// Simulated race seconds, not wall-clock time or measured human-player averages.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 const p=await browser.newPage();
 await p.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&auto&manual&track=puerto`);
 await p.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
 const result=await p.evaluate(async()=>{
  await startRace(0);race.state='go';race.count=0;race.mode='race';race.netRace=false;
  const {CAR_DEFINITIONS}=await import('./car-definitions.js'),{difficultyById}=await import('./modes.js');race.diff=difficultyById('normal');
  race.cars.forEach(disposeRacer);race.cars=[];const T=getActiveTrack(),runs=[];
  for(const drifting of [true,false])for(let i=0;i<CAR_DEFINITIONS.length;i++){
    race.diff={...difficultyById('normal'),drift:drifting};
    const c=makeRacer(i,true,CAR_DEFINITIONS[i].name,'calle');race.player=c;race.cars=[c];placeRacer(c,0,0);c.lane=0;c.skill=1;race.clock=0;race.items.clear();let recoveries=0,wasRecovering=false,maxOffset=0;
    for(let frame=0;frame<36000&&c.lap<2;frame++){
      if(c.rescueT>0)stepRescue(c,1/60);else stepCar(c,aiInput(c),1/60);
      race.items.update(1/60,[c],true);c.inventory=[null,null];race.clock+=1/60;
      if(c.rescueT>0&&!wasRecovering)recoveries++;wasRecovering=c.rescueT>0;
      maxOffset=Math.max(maxOffset,Math.abs(T.offsetOf(c.x,c.z,c.y)));
    }
    runs.push({drifting,id:c.def.id,name:c.def.name,seconds:race.clock,finished:c.lap>=2,recoveries,maxOffset});disposeRacer(c);
  }
  race.state='end';race.cars=[];
  return {length:T.TOTAL,profile:'Normal AI steering, with and without drift; full player power; calle tires; standing start; course pads and coins; no opponents or attack items. Simulated seconds, not human averages.',runs};
 });
 result.profiles=[true,false].map(drifting=>{const runs=result.runs.filter(r=>r.drifting===drifting);return{drifting,mean:runs.reduce((n,r)=>n+r.seconds,0)/runs.length,range:[Math.min(...runs.map(r=>r.seconds)),Math.max(...runs.map(r=>r.seconds))]};});
 result.mean=result.runs.reduce((n,r)=>n+r.seconds,0)/result.runs.length;
 result.range=[Math.min(...result.runs.map(r=>r.seconds)),Math.max(...result.runs.map(r=>r.seconds))];
 await mkdir('art/studio/puerto',{recursive:true});await writeFile('art/studio/puerto/duration.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 assert.ok(result.runs.every(r=>r.finished),'every current car completes the circuit');
}finally{await browser.close();}
