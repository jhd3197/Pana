// Synthetic classifications exercise presentation only. Full-race proof lives
// in cup-local, cup-online, cup-maps and the seeded balance suites.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  await page.evaluate(async()=>{
    setup.mode='agua';await startRace(0);
    const rules=await import('./cup-rules.js'),entrants=race.cup.session.entrants.map((e,i)=>({...e,name:i<2?'Pana con nombre largo compartido':e.name}));
    race.cars.forEach(c=>c.name=entrants.find(e=>e.id===c.entrantId).name);
    const session=rules.createCupSession({cupId:'agua',sessionId:'presentation-only',seed:1,entrants});
    for(let stage=0;stage<4;stage++){
      rules.beginStage(session);rules.markRacing(session);
      const results=entrants.map((e,i)=>({id:e.id,classification:i===5?'dnf':i===6?'dns':i===7?'retired':'finished',started:i!==6,time:60+(i<2?(stage%2?1-i:i):i),progress:500-i}));
      rules.finalizeStage(session,{results});if(stage<3)rules.advanceStage(session);
    }
    race.cup.session=session;race.state='end';race.resultKey='';
    // A reconnect may render an entrant before its car exists; own its fallback portrait.
    const champion=rules.standings(session)[0].id,index=race.cars.findIndex(c=>c.entrantId===champion);
    disposeRacer(race.cars[index]);race.cars.splice(index,1);
    renderResults(race.cars,race.player);renderCup();document.getElementById('result').classList.remove('hidden');
    document.getElementById('result-title').textContent='¡Copa terminada!';
    document.getElementById('count').textContent='';
  });
  const text=await page.locator('#result-board').innerText();assert.match(text,/Sin terminar/);assert.match(text,/No salió/);assert.match(text,/Retirado/);
  assert.equal(await page.locator('#cup-board li').count(),8);
  assert.deepEqual((await page.locator('#podium .name').allTextContents()).slice(0,2),['Pana con nombre largo compartido','Pana con nombre largo compartido']);
  await page.waitForFunction(()=>[...document.querySelectorAll('#podium img')].every(img=>img.naturalWidth>0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const layout=await page.evaluate(()=>({podium:document.getElementById('podium').getBoundingClientRect().bottom,table:document.querySelector('.res-side').getBoundingClientRect().top}));
  assert.ok(layout.podium<=layout.table,'portrait podium must end before the standings begin');
  await mkdir('art/grand-prix/presentation',{recursive:true});
  await page.screenshot({path:'art/grand-prix/presentation/results-390.png',fullPage:true});
  await page.locator('#again').scrollIntoViewIfNeeded();await page.locator('#again').focus();assert.equal(await page.locator('#again').evaluate(e=>e===document.activeElement),true);
  await page.screenshot({path:'art/grand-prix/presentation/actions-390.png'});
  await page.setViewportSize({width:1280,height:800});await page.locator('#result').evaluate(e=>e.scrollTop=0);
  assert.ok(await page.locator('#podium').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),'desktop podium is visible before scrolling the long standings');
  await page.screenshot({path:'art/grand-prix/presentation/tied-podium-desktop.png'});
  const resources=await page.evaluate(()=>{const samples=[];for(let i=0;i<4;i++){race.resultKey='';renderResults(race.cars,race.player);samples.push({...renderer.info.memory});}return samples;});
  assert.deepEqual(resources.at(-1),resources[1],'fallback portrait has no resource growth');
  assert.deepEqual(errors,[]);console.log('Long duplicate names, all classifications, tied final podium, 390px results, keyboard focus, reduced motion and absent-car portrait lifetime passed');
}finally{await browser.close();}
