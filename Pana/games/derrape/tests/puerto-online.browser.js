// Real room selection, synchronized loading and moving cars on the new map.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {menuStep} from './menu-helpers.js';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),base=process.env.PANA_TEST_URL||'http://localhost:8461',errors=[];
try {
  const host=await browser.newPage({viewport:{width:1200,height:800}}),guest=await browser.newPage({viewport:{width:1000,height:700}});
  for(const [i,page]of[host,guest].entries()) {page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(n=>localStorage.setItem('pana:name',n),i?'Pana invitado':'Pana del puerto');}
  await host.goto(`${base}/g/derrape/?debug&auto`);await host.waitForFunction(()=>window.getNet&&garage.car);
  await host.locator('#go-online').click();await host.waitForFunction(()=>getNet()?.isHost);
  const code=await host.evaluate(()=>getNet().code);
  await guest.goto(`${base}/g/derrape/?debug&auto&room=${code}`);
  for(const page of [host,guest])await page.waitForFunction(()=>window.getNet?.()?.state.players.length===2,null,{timeout:60000});
  await menuStep(host,'track');await host.locator('[data-circuit="puerto"]').click();
  await guest.waitForFunction(()=>getNet().state.track==='puerto'&&document.getElementById('track-name').textContent==='Puerto');
  assert.equal(await host.evaluate(()=>getNet().state.track),'puerto');
  await menuStep(host,'ready');await host.locator('#play').click();
  for(const page of [host,guest])await page.waitForFunction(()=>race.state==='go'&&getActiveTrack().id==='puerto',null,{timeout:120000});
  const hostId=await host.evaluate(()=>getNet().id);
  await guest.waitForFunction(id=>race.cars.find(c=>c.netId===id&&c.remote)?.buf?.length>=2,hostId,{timeout:30000});
  const before=await guest.evaluate(id=>{const c=race.cars.find(c=>c.netId===id);return{x:c.x,z:c.z};},hostId);
  await guest.waitForFunction(({id,before})=>{const c=race.cars.find(c=>c.netId===id);return Math.hypot(c.x-before.x,c.z-before.z)>12;},{id:hostId,before},{timeout:30000});
  for(const page of [host,guest]) {
    const state=await page.evaluate(()=>({id:getActiveTrack().id,length:getActiveTrack().TOTAL,y:race.player.y,ground:getActiveTrack().groundAt(race.player.x,race.player.z),remote:race.cars.filter(c=>c.remote&&!c.bot).length}));
    assert.equal(state.id,'puerto');assert.ok(state.length>2400);assert.equal(state.remote,1);assert.ok(Math.abs(state.y-state.ground)<1);
  }
  assert.deepEqual(errors,[]);console.log('Puerto: two clients select, load and drive the same map with live remote poses.');
}finally{await browser.close();}
