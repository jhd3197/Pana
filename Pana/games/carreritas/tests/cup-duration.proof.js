import { resultClick } from './menu-helpers.js';
// Deliberately unaccelerated, ~30 minutes. Run explicitly, outside the normal
// ten-minute suite timeout. This measures real-time play plus loading/results;
// low-frequency render samples are NOT a reference-device FPS benchmark.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {CUPS} from '../public/cup-definitions.js';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),proof=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.addInitScript(()=>{
    let previous=performance.now(),budget=0,lastDraw=0;
    setInterval(()=>{
      const now=performance.now(),elapsed=(now-previous)/1000;previous=now;
      if(!window.race||!['count','go'].includes(race.state)){budget=0;return;}
      budget+=elapsed;
      // Consume only elapsed wall time. Catch-up never invents future time.
      for(let i=0;i<120&&budget>=1/60&&['count','go'].includes(race.state);i++,budget-=1/60)updateRace(1/60,false);
      if(now-lastDraw>1000){updateRace(0);renderer.render(race.scene,race.camera);lastDraw=now;}
    },16);
  });
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&auto&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  for(const cup of CUPS.filter(c=>!process.env.PANA_DURATION_CUPS||process.env.PANA_DURATION_CUPS.split(',').includes(c.id))){
    const start=Date.now(),stages=[];
    await page.evaluate(id=>{toGarage();setup.mode=id;setup.difficulty='normal';setup.split=false;setup.mirror=false;startRace(0);},cup.id);
    for(let stage=0;stage<4;stage++){
      const loadingAt=Date.now();await page.waitForFunction(s=>race.cup?.session.stageIndex===s&&['count','go'].includes(race.state),stage,{timeout:180000});
      const loadingSeconds=(Date.now()-loadingAt)/1000;
      await page.waitForFunction(()=>race.state==='end',null,{timeout:360000,polling:200});
      const result=await page.evaluate(()=>({track:getActiveTrack().id,clock:race.clock,lap:race.player.lap,done:race.player.done}));
      assert.ok(result.done);stages.push({...result,loadingSeconds});console.log(`${cup.id} ${stage+1}/4: ${result.clock.toFixed(1)} real-time race seconds`);
      if(stage<3){await page.waitForTimeout(12000);await resultClick(page, '#again');}
    }
    const wallSeconds=(Date.now()-start)/1000;assert.ok(wallSeconds>=stages.reduce((sum,s)=>sum+s.clock,0)-1,'unaccelerated wall clock');
    proof.push({cup:cup.id,wallSeconds,stages,profile:'Normal; generated steering; 1280x800 headless Chromium; 1 Hz render samples. Timing proof, not device FPS.'});
    await mkdir('art/grand-prix',{recursive:true});await writeFile('art/grand-prix/unaccelerated-cups.json',JSON.stringify(proof,null,2));
    await writeFile(`art/grand-prix/duration-${cup.id}.json`,JSON.stringify(proof.at(-1),null,2));
    console.log(`${cup.id}: ${(wallSeconds/60).toFixed(2)} minutes including loading, countdowns and 12-second intermissions`);
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
