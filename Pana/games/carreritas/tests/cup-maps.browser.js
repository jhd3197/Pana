// Independent human-client sessions drive each championship through its real
// physics/checkpoints. Set PANA_GP_CLIENTS=8 for the full human room proof.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {CUPS} from '../public/cup-definitions.js';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true});
const origin=process.env.PANA_TEST_URL||'http://localhost:8461',count=Number(process.env.PANA_GP_CLIENTS||2);
const cups=process.env.PANA_GP_CUPS?.split(',')||['pana'];
const pages=[],errors=[],records=[];
try{
  const code='water'+Math.random().toString(36).slice(2,8);
  for(let i=0;i<count;i++){
    const context=await browser.newContext({viewport:{width:960,height:640}});
    await context.addInitScript(i=>{
      localStorage.setItem('pana:name',`Piloto ${i+1}`);localStorage.setItem('pana:settings',JSON.stringify({quality:'baja'}));
      setInterval(()=>{
        if(!window.race||!window.updateRace)return;
        if(race.state==='count')updateRace(0);
        for(let j=0;j<10&&['go','end'].includes(race.state);j++)updateRace(1/60,false);
        window.sendPoses?.();
      },25);
    },i);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`${origin}/g/carreritas/?debug&auto&manual&room=${code}${i===0?'&lead=1':''}`);
    await page.waitForFunction(()=>window.getNet?.()?.id&&window.garage?.car,null,{timeout:60000});pages.push(page);
    await page.evaluate(i=>getNet().pick(i%8,'calle',{paint:i%2?'caribe':'pasion',horn:'fiesta',flame:'hielo'}),i);
  }
  const host=pages[0];await host.waitForFunction(n=>getNet().state.players.length===n,count);
  for(const cupId of cups){
    const cup=CUPS.find(c=>c.id===cupId),started=Date.now();
    await host.evaluate(id=>{getNet().lobby();getNet().mode(id);getNet().bots(false);},cupId);
    await host.waitForFunction(id=>getNet().state.phase==='lobby'&&getNet().state.mode===id,cupId);
    await host.evaluate(()=>getNet().start());
    let roster;
    for(let stage=0;stage<4;stage++){
      await Promise.all(pages.map(p=>p.waitForFunction(s=>getNet().cup?.stageIndex===s&&['count','go','end'].includes(race.state),stage,{timeout:180000})));
      const snapshot=await host.evaluate(()=>({entrants:getNet().cup.entrants,track:getActiveTrack().id,laps:race.laps}));
      assert.equal(snapshot.entrants.length,count);assert.ok(snapshot.entrants.every(e=>e.kind==='human'));
      roster??=snapshot.entrants;assert.deepEqual(snapshot.entrants,roster);
      assert.equal(snapshot.track,cup.stages[stage].track);assert.equal(snapshot.laps,cup.stages[stage].laps);
      await Promise.all(pages.map(p=>p.waitForFunction(s=>getNet().cup?.ledger.filter(r=>r.stage===s).length===getNet().cup.entrants.length,stage,{timeout:180000})));
      const ledgers=await Promise.all(pages.map(p=>p.evaluate(s=>getNet().cup.ledger.filter(r=>r.stage===s),stage)));
      for(const ledger of ledgers)assert.deepEqual(ledger,ledgers[0]);
      assert.ok(ledgers[0].every(r=>r.classification==='finished'),`${cupId}/${stage}: humans finish by actual driving ${JSON.stringify(ledgers[0])}`);
      records.push({cup:cupId,stage,track:snapshot.track,laps:snapshot.laps,results:ledgers[0]});
      console.log(`${count} clients: ${cupId} ${stage+1}/4 ${snapshot.track}, identical finished results`);
      if(stage<3){await host.waitForTimeout(5200);await host.evaluate(()=>getNet().next());}
    }
    const finals=await Promise.all(pages.map(p=>p.evaluate(()=>({status:getNet().cup.status,ledger:getNet().cup.ledger,session:getNet().cup.sessionId}))));
    for(const final of finals){assert.equal(final.status,'complete');assert.deepEqual(final,finals[0]);}
    console.log(`${cupId}: ${((Date.now()-started)/1000).toFixed(1)} wall seconds (accelerated simulation)`);
  }
  assert.deepEqual(errors,[]);
  await mkdir('art/grand-prix',{recursive:true});await writeFile(`art/grand-prix/${count}-human-cups.json`,JSON.stringify(records,null,2));
}finally{await browser.close();}
