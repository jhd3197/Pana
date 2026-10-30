// Real elapsed loading deadline, DNS recovery, spectators and withdrawal.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),origin=process.env.PANA_TEST_URL||'http://localhost:8461',errors=[];
async function client(code,index){
  const context=await browser.newContext({viewport:{width:960,height:640}});
  await context.addInitScript(i=>{
    localStorage.setItem('pana:name',`Pana ${i}`);localStorage.setItem('pana:settings',JSON.stringify({quality:'baja'}));
    setInterval(()=>{if(!window.race||window.__freeze)return;if(race.state==='count')updateRace(0);for(let j=0;j<10&&['go','end'].includes(race.state);j++)updateRace(1/60,false);window.sendPoses?.();},25);
  },index);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${origin}/g/carreritas/?debug&auto&manual&room=${code}${index===0?'&lead=1':''}`);
  await page.waitForFunction(()=>window.getNet?.()?.id&&window.garage?.car,null,{timeout:60000});return page;
}
const wait=(page,fn,arg,timeout=120000)=>page.waitForFunction(fn,arg,{timeout});
try{
  const capacityCode='cap'+Math.random().toString(36).slice(2,8),seats=[];
  const cap=JSON.parse(await readFile(new URL('../game.json',import.meta.url))).players;
  for(let i=0;i<=cap;i++){
    const context=await browser.newContext(),page=await context.newPage();
    await page.goto(`${origin}/studio/settings.html`);
    const result=await page.evaluate(async ({code,index})=>{
      try{const {joinRoom}=await import('/engine/net.js');window.__seat=await joinRoom('carreritas',{code,name:`Seat ${index}`,protocol:2});return {joined:true};}
      catch(error){return {joined:false,full:!!error.full,message:error.message,code:error.code};}
    },{code:capacityCode,index:i});
    if(i<cap)assert.equal(result.joined,true,JSON.stringify(result));else {assert.equal(result.joined,false);assert.equal(result.full,true,JSON.stringify(result));}
    seats.push(context);
  }
  for(const context of seats)await context.close();
  console.log(`${cap}-member room capacity rejects the next independent session`);
  if(process.env.PANA_CAPACITY_ONLY){await browser.close();process.exit(0);}
  const code='fault'+Math.random().toString(36).slice(2,8),host=await client(code,0),guest=await client(code,1);
  await wait(host,()=>getNet().state.players.length===2);
  const guestId=await guest.evaluate(()=>getNet().id);
  await guest.evaluate(()=>{window.__loaded=getNet().loaded.bind(getNet());getNet().loaded=()=>{};});
  await host.evaluate(()=>{getNet().mode('pana');getNet().bots(false);getNet().start();});
  await wait(host,()=>getNet().state.phase==='loading');
  const locked=await host.evaluate(()=>getNet().cup.entrants.map(e=>e.id));
  const spectator=await client(code,2),spectatorId=await spectator.evaluate(()=>getNet().id);
  assert.ok(!locked.includes(spectatorId));
  // This intentionally waits out the actual 60 s budget; no test-only server clock.
  await wait(host,()=>getNet().cup?.finalized[0],null,150000);
  const first=await host.evaluate(()=>getNet().cup.ledger);
  assert.equal(first.find(r=>r.id===guestId).classification,'dns');assert.equal(first.find(r=>r.id===guestId).points,0);
  await guest.evaluate(()=>{getNet().loaded=window.__loaded;window.__freeze=true;});
  await host.reload();await wait(host,()=>window.getNet?.()?.cup?.finalized[0]&&window.garage?.car);
  const control=await guest.evaluate(()=>getNet().isHost)?guest:host;
  if(await control.evaluate(()=>getNet().cup.stageIndex===0)){await control.waitForTimeout(5200);await control.evaluate(()=>getNet().next());}
  await guest.evaluate(()=>window.__freeze=false);
  await wait(guest,()=>getNet().cup?.stageIndex===1&&race.state==='go');
  assert.equal(await guest.evaluate(()=>race.player.entrantId),guestId);
  await wait(guest,()=>getNet().cup?.finalized[1]);
  const second=await guest.evaluate(()=>getNet().cup.ledger.filter(r=>r.stage===1));
  assert.ok(second.every(r=>r.classification==='finished'));
  console.log('Real loading timeout: DNS, same entrant recovered on stage two; late join remained spectator; results reload preserved ledger');
  for(let stage=2;stage<4;stage++){
    await control.waitForTimeout(5200);await control.evaluate(()=>getNet().next());
    await wait(guest,s=>getNet().cup?.stageIndex===s&&['count','go','end'].includes(race.state),stage);
    if(stage===2)await guest.evaluate(()=>getNet().retire());
    await wait(host,s=>getNet().cup?.finalized[s],stage);
  }
  const ledger=await host.evaluate(()=>getNet().cup.ledger),session=await host.evaluate(()=>getNet().cup.sessionId);
  assert.equal(ledger.find(r=>r.stage===2&&r.id===guestId).classification,'retired');
  assert.equal(ledger.find(r=>r.stage===3&&r.id===guestId).classification,'dns');
  await control.evaluate(()=>{getNet().lobby();getNet().mode('agua');getNet().start();});
  await wait(spectator,old=>getNet().cup?.sessionId!==old&&getNet().cup?.cupId==='agua',session);
  const fresh=await spectator.evaluate(()=>({cup:getNet().cup,poses:getNet().poseMemo.size}));
  assert.equal(fresh.cup.ledger.length,0);assert.ok(fresh.cup.entrants.some(e=>e.id===spectatorId));
  assert.deepEqual(errors,[]);await mkdir('art/grand-prix',{recursive:true});await writeFile('art/grand-prix/failure-ledger.json',JSON.stringify({first,second,ledger,fresh:fresh.cup},null,2));
}finally{await browser.close();}
