// Deterministic real-physics balance sweep. Render each map once, then reuse its
// immutable geometry across seeds. Each seed's ledger/grid carries across all
// four actual stages; no analytic lap times or fabricated checkpoint finishes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {CUPS} from '../public/cup-definitions.js';
import {createCupSession,beginStage,markRacing,markStarted,acceptFinish,finalizeStage,advanceStage,standings} from '../public/cup-rules.js';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:800,height:600}});
const seeds=Number(process.env.PANA_BALANCE_SEEDS||1),proof=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&auto&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  const entrants=Array.from({length:8},(_,i)=>({id:`driver-${i}`,name:`Rival ${i+1}`,kind:i?'bot':'human',loadout:{car:i,wheel:'calle'},skillSeed:`skill-${i}`}));
  for(const cup of CUPS.filter(c=>!process.env.PANA_BALANCE_CUPS||process.env.PANA_BALANCE_CUPS.split(',').includes(c.id))){
    const sessions=[];
    for(const difficulty of ['facil','normal','dificil'])for(let seed=1;seed<=seeds;seed++)sessions.push(createCupSession({cupId:cup.id,sessionId:`balance-${cup.id}-${difficulty}-${seed}`,seed,difficulty,entrants}));
    for(const [stage,preset]of cup.stages.entries()){
      await page.evaluate(async preset=>{
        toGarage();setup.mode='race';setup.laps=preset.laps;buildTrack(preset.track);await startRace(0);
        race.cars.forEach(disposeRacer);race.cars=[];
        for(let i=0;i<8;i++)race.cars.push(makeRacer(i,false,`Rival ${i+1}`,'calle'));
        race.player=race.cars[0];race.p2=null;
        window.__baseline=race.cars.map(c=>Object.fromEntries(Object.entries(c).filter(([,v])=>v===null||typeof v!=='object')));
      },preset);
      for(const session of sessions){
        beginStage(session);markRacing(session);for(const e of entrants)markStarted(session,e.id);
        const result=await page.evaluate(async ({session,preset})=>{
          const {difficultyById}=await import('./modes.js'),{seededUnit}=await import('./cup-rules.js');
          let seed=Number(session.seed)+session.stageIndex*13007;const oldRandom=Math.random;
          Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
          try{
            race.diff=difficultyById(session.difficulty);race.items.clear();race.clock=0;race.count=0;race.state='go';race.ended=false;race.cup=null;race.laps=preset.laps;
            const rescues=Array.from({length:8},()=>[]),prior=Array(8).fill(0);
            race.cars.forEach((c,i)=>{
              for(const k of Object.keys(c))if(!(k in __baseline[i])&&(c[k]===null||typeof c[k]!=='object'))delete c[k];
              Object.assign(c,__baseline[i]);c.inventory=[null,null];c.safe=null;c.skill=race.diff.skill[0]+seededUnit(`${session.seed}:${i}`)*(race.diff.skill[1]-race.diff.skill[0]);
              const slot=session.grids[session.stageIndex].indexOf(`driver-${i}`);placeRacer(c,slot%2?-3.5:3.5,Math.floor(slot/2));
            });
            for(let step=0;step<preset.capSeconds*60&&!race.cars.every(c=>c.done);step++){
              updateRace(1/60,false);
              race.cars.forEach((c,i)=>{if(c.rescueT>prior[i]+.1)rescues[i].push({x:c.x,z:c.z,time:race.clock});prior[i]=c.rescueT;});
            }
            return {time:race.clock,results:race.cars.map((c,i)=>({id:`driver-${i}`,done:c.done,time:c.time,lap:c.lap,progress:c.prog,rescues:rescues[i]}))};
          }finally{Math.random=oldRandom;}
        },{session,preset});
        for(const r of result.results)if(r.done)assert.ok(acceptFinish(session,{id:r.id,time:r.time}));
        assert.ok(finalizeStage(session,{results:result.results.map(r=>({id:r.id,classification:r.done?'finished':'dnf',started:true,time:r.time,progress:r.lap*100000+r.progress}))}));
        proof.push({cup:cup.id,seed:session.seed,difficulty:session.difficulty,stage,track:preset.track,...result});
        assert.ok(result.results.every(r=>r.done),`route failure ${cup.id}/${preset.track}/${session.difficulty}/${session.seed}: ${JSON.stringify(result)}`);
        if(stage<3)advanceStage(session);
      }
      console.log(`${cup.id}/${preset.track}: ${sessions.length} eight-car seeded races completed`);
    }
    assert.ok(sessions.every(s=>s.status==='complete'&&s.ledger.length===32));
    await mkdir('art/grand-prix',{recursive:true});
    await writeFile(`art/grand-prix/balance-${cup.id}.json`,JSON.stringify({seeds,proof:proof.filter(p=>p.cup===cup.id),championships:sessions.map(s=>({seed:s.seed,difficulty:s.difficulty,standings:standings(s)}))},null,2));
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
