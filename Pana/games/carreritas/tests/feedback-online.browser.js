// Two independent clients prove rain scheduling and temporary ghost pose bits
// over the real room relay. Gameplay advances manually; clocks stay real-time.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const origin=process.env.PANA_TEST_URL||'http://localhost:8461',code='feedback'+Math.random().toString(36).slice(2,8);
const errors=[];
const until=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:60000,polling:100});
async function client(lead) {
  const context=await browser.newContext({viewport:{width:1000,height:700}});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`${origin}/g/carreritas/?debug&manual&room=${code}${lead?'&lead=1':''}`);
  await until(p,()=>window.getNet?.()?.state.players.length>0);
  return p;
}
try {
  const host=await client(true),guest=await client(false);
  await until(host,()=>getNet().state.players.length===2);
  await host.evaluate(()=>getNet().start());
  for(const p of [host,guest])await until(p,()=>race.state==='count'&&getNet().now()>getNet().state.startAt);
  for(const p of [host,guest])await p.evaluate(()=>{updateRace(0);sendPoses();});
  await until(guest,()=>race.cars.find(c=>!c.bot&&c.remote)?.buf.length>0);
  const startGhost=await guest.evaluate(()=>{
    updateRace(1/60);
    const c=race.cars.find(c=>!c.bot&&c.remote);
    return {phase:c.phaseRemote,visible:c.ghostVisible};
  });
  assert.ok(startGhost.phase&&startGhost.visible,JSON.stringify(startGhost));
  const ids=await host.evaluate(()=>race.cars.map(c=>c.netId));
  const ownerId=await host.evaluate(()=>race.player.netId),victimId=await guest.evaluate(()=>race.player.netId);
  // Place the guest in first, host last and both bots between, identically.
  for(const p of [host,guest])await p.evaluate(({ownerId,victimId,ids})=>{
    const T=getActiveTrack(),ordered=[victimId,...ids.filter(id=>id!==ownerId&&id!==victimId),ownerId];
    race.items.clear();
    for(const b of [...race.items.boxes,...race.items.coins])b.down=9999;
    for(const c of race.cars) {
      const index=ordered.indexOf(c.netId),s=T.LINE+50+(3-index)*45,a=T.pointAt(s),b=T.pointAt(s+.5);
      Object.assign(c,{x:a.x,z:a.y,y:T.groundAt(a.x,a.y),h:Math.atan2(b.x-a.x,b.y-a.y),vx:0,vz:0,vf:0,
        phaseT:0,phaseRemote:false,rescueT:0,done:false,lap:1,prog:s-T.LINE,cloud:0,spin:0,dizzy:0,inventory:[null,null],selected:0});
    }
  },{ownerId,victimId,ids});
  await guest.evaluate(()=>{
    window.rainPackets=[];
    getNet().on('fx',(id,kind,d)=>{if(kind==='cloud')rainPackets.push(d);});
    // Deliberately late delivery exercises timestamp compensation as well as
    // the actual WebSocket relay. This is not a measured internet benchmark.
    const original=race.items.remoteCloud;
    race.items.remoteCloud=d=>setTimeout(()=>original(d),250);
  });
  const launch=await host.evaluate(async()=>{
    const {addItem}=await import('./item-rules.js');addItem(race.player,'aguacero',0);
    const used=race.items.use(race.player);
    return {used,wave:race.items.rainQueue.map(w=>({id:w.target.netId,delay:w.delay,time:w.time}))};
  });
  assert.ok(launch.used);
  await until(guest,()=>rainPackets.length===1&&race.items.rainQueue.length===3);
  const received=await guest.evaluate(()=>({
    wave:race.items.rainQueue.map(w=>({id:w.target.netId,delay:w.delay,time:w.time})),
    payload:JSON.stringify(rainPackets[0]).length,
    cloud:race.player.cloud,
  }));
  assert.deepEqual(received.wave.map(w=>w.id),launch.wave.map(w=>w.id));
  assert.ok(received.wave[2].delay<launch.wave[2].delay-.15,'late cloud does not restart its countdown');
  assert.ok(received.payload<=512&&received.cloud===0);
  const rain=await guest.evaluate(()=>{
    const ids=[];
    for(let i=0;i<300;i++) {
      race.items.update(1/60,race.cars,true);
      for(const c of race.cars)if(c.cloud>0&&!ids.includes(c.netId))ids.push(c.netId);
    }
    return {ids,caller:race.cars.find(c=>c.netId===rainPackets[0].id.split(':')[0])?.cloud||0};
  });
  assert.deepEqual(rain.ids,launch.wave.map(w=>w.id));
  assert.equal(rain.caller,0);

  // A long-range chancleta reaches the owner of the target and its authoritative
  // hit returns to the thrower. No local duplicate crash on the thrower's screen.
  for(const p of [host,guest])await p.evaluate(({ownerId,victimId})=>{
    const T=getActiveTrack();race.items.clear();
    for(const c of race.cars) {
      const s=T.LINE+(c.netId===ownerId?40:1040),a=T.pointAt(s),b=T.pointAt(s+.5);
      Object.assign(c,{x:a.x,z:a.y,y:T.groundAt(a.x,a.y),h:Math.atan2(b.x-a.x,b.y-a.y),vx:0,vz:0,vf:0,
        done:c.netId!==ownerId&&c.netId!==victimId,lap:1,prog:s-T.LINE,phaseT:0,phaseRemote:false,rescueT:0,cloud:0,dizzy:0,spin:0,shield:0,inventory:[null,null],selected:0});
    }
  },{ownerId,victimId});
  const thrown=await host.evaluate(async()=>{
    const {addItem}=await import('./item-rules.js');addItem(race.player,'chancleta',0);
    race.items.use(race.player);return race.items.projectiles.at(-1).id;
  });
  await until(guest,id=>race.items.projectiles.some(f=>f.id===id),thrown);
  assert.equal(await guest.evaluate(()=>{
    for(let i=0;i<600&&race.items.projectiles.length;i++)race.items.update(1/60,race.cars,true);
    return race.player.dizzy>0;
  }),true);
  await until(host,id=>race.items.projectiles.find(f=>f.id===id)?.dead,thrown);
  assert.equal(await host.evaluate(()=>race.cars.find(c=>!c.bot&&c.remote).dizzy),0);

  // Recovery is carried in the unchanged pose array, and clears remotely.
  // sendPoses() rate-limits by wall clock; manual steps can outrun that, so
  // each explicit send below clears the limiter (as the bot send does).
  await host.evaluate(()=>{rescue(race.player);race.poseAt=-Infinity;sendPoses();});
  await until(guest,()=>race.cars.find(c=>!c.bot&&c.remote).buf.at(-1)?.p[10]&1024);
  assert.equal(await guest.evaluate(()=>{updateRace(1/60);return race.cars.find(c=>!c.bot&&c.remote).ghostVisible;}),true);
  await host.evaluate(()=>{
    for(const c of race.cars)if(c!==race.player){c.done=true;c.x+=500;}
    for(let i=0;i<360;i++)updateRace(1/60,false);
    race.poseAt=-Infinity;sendPoses();
  });
  await until(guest,()=>!(race.cars.find(c=>!c.bot&&c.remote).buf.at(-1)?.p[10]&1024));
  await guest.evaluate(()=>{for(let i=0;i<200;i++)updateRace(1/60,false);});
  // Receiving the newest pose is not the same as displaying it: the remote
  // interpolation buffer intentionally trails the sender's wall-clock stamp.
  await until(guest,()=>{
    updateRace(1/60,false);
    const c=race.cars.find(c=>!c.bot&&c.remote);
    return !c.phaseRemote && c.rescueT<=0 && !c.ghostVisible;
  });
  await host.evaluate(()=>{
    for(const c of race.cars)if(c.bot)c.phaseT=3;
    race.poseAt=-Infinity;sendPoses();
  });
  await until(guest,()=>{
    updateRace(1/60,false);
    return race.cars.filter(c=>c.bot).every(c=>c.phaseRemote);
  });
  await host.context().close();
  await until(guest,()=>getNet().isHost&&race.cars.filter(c=>c.bot).every(c=>!c.remote));
  const takeover=await guest.evaluate(()=>{
    const bots=race.cars.filter(c=>c.bot),transferred=bots.every(c=>!c.phaseRemote&&c.phaseT>0);
    for(let i=0;i<240;i++)updateRace(1/60,false);
    return {transferred,expired:bots.every(c=>c.phaseT===0&&!c.phaseRemote)};
  });
  assert.deepEqual(takeover,{transferred:true,expired:true});
  assert.deepEqual(errors,[]);
  console.log('Two clients: start ghost, delayed staggered rain, bounded payload, long-range chancleta hit, rescue expiry and protected-bot host handoff passed.');
} finally {await browser.close();}
