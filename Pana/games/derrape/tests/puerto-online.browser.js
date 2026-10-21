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
  for(const page of [host,guest])assert.equal(await page.evaluate(()=>getNet().state.laps),1,'one adventure lap agreed by both clients');
  await menuStep(host,'car');await host.locator('#play').click();
  for(const page of [host,guest])await page.waitForFunction(()=>race.state==='go'&&getActiveTrack().id==='puerto',null,{timeout:120000});
  const hostId=await host.evaluate(()=>getNet().id);
  await guest.waitForFunction(id=>race.cars.find(c=>c.netId===id&&c.remote)?.buf?.length>=2,hostId,{timeout:30000});
  const before=await guest.evaluate(id=>{const c=race.cars.find(c=>c.netId===id);return{x:c.x,z:c.z};},hostId);
  await guest.waitForFunction(({id,before})=>{const c=race.cars.find(c=>c.netId===id);return Math.hypot(c.x-before.x,c.z-before.z)>12;},{id:hostId,before},{timeout:30000});
  for(const page of [host,guest]) {
    const state=await page.evaluate(()=>({id:getActiveTrack().id,length:getActiveTrack().TOTAL,y:race.player.y,ground:getActiveTrack().groundAt(race.player.x,race.player.z,race.player.y),remote:race.cars.filter(c=>c.remote&&!c.bot).length}));
    assert.equal(state.id,'puerto');assert.ok(state.length>5300);assert.equal(state.remote,1);assert.ok(Math.abs(state.y-state.ground)<1);
  }
  // Both clients drive across the same XZ junction on different decks. Remote
  // interpolation must retain their vertical separation and route progress.
  const guestId=await guest.evaluate(()=>getNet().id);
  for(const [page,height]of[[host,142.2],[guest,190.2]])await page.evaluate(async height=>{
    const T=getActiveTrack(),{placeOnTrack}=await import('/g/derrape/track-kit.js'),s=T.paramOf(-50,-640,height)-35,p=placeOnTrack(T,s,0),c=race.player;
    Object.assign(c,{x:p.x,z:p.z,y:p.y,h:p.h,vx:Math.sin(p.h)*24,vz:Math.cos(p.h)*24,vy:0,onGround:true,boost:0,spin:0,phaseT:0,rescueT:0,lap:1,prog:(s-T.LINE+T.TOTAL)%T.TOTAL});
  },height);
  for(const [page,id,height]of[[host,guestId,190.2],[guest,hostId,142.2]]){
    await page.waitForFunction(({id,height})=>{const c=race.cars.find(c=>c.netId===id);return c?.remote&&Math.abs(c.y-height)<.6;},{id,height},{timeout:30000});
    const before=await page.evaluate(id=>{const c=race.cars.find(c=>c.netId===id);return{x:c.x,z:c.z};},id);
    await page.waitForFunction(({id,height,before})=>{const c=race.cars.find(c=>c.netId===id);return Math.abs(c.y-height)<.6&&Math.hypot(c.x-before.x,c.z-before.z)>8;},{id,height,before},{timeout:15000});
  }
  assert.deepEqual(errors,[]);console.log('Puerto: two clients select, load and drive, including live remote poses on both castle levels.');
}finally{await browser.close();}
