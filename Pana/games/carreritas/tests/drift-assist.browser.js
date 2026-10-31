// Novice fixed inputs through real corners. No position pinning during a run.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const origin=process.env.PANA_TEST_URL||'http://localhost:8461',output='art/carreritas-drift';
await mkdir(output,{recursive:true});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${origin}/g/carreritas/?debug&manual&track=estadio`);
  await page.waitForFunction(()=>window.garage?.car);
  const proof=await page.evaluate(async()=>{
    const {CAR_DEFINITIONS}=await import('./car-definitions.js');
    const {composeTune,WHEEL_DEFINITIONS}=await import('./wheel-definitions.js');
    const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),runs=[];
    let T,c,heading;
    function reset(bend,car,wheel) {
      placeRacer(c,0,0);c.def=CAR_DEFINITIONS[car];c.tune=composeTune(c.def.tune,WHEEL_DEFINITIONS[wheel].profile);
      const p=T.pointAt(bend.s),h=heading(bend.s);
      Object.assign(c,{x:p.x,z:p.y,y:T.groundAt(p.x,p.y),h,vx:Math.sin(h)*32,vz:Math.cos(h)*32,vf:32,vr:0,vy:0,
        onGround:true,pitch:0,roll:0,pitchV:0,rollV:0,steer:0,boost:0,spin:0,stall:0,drift:0,driftT:0,driftHeld:false,tireHeat:0,burnLock:false,
        driftExitT:0,phaseT:0,phaseRemote:false,impacts:[],coins:0,skill:1,band:1,cloud:0,safeT:1,hopping:false});
    }
    function drive(bend,counter=false) {
      let walls=0,maxOff=0,charge=0,boost=0,assist=0;
      const x=c.x,z=c.z;
      for(let i=0;i<120;i++) {
        race.clock+=1/60;
        const steer=i>=90?0:counter&&i>=60?-bend.dir:bend.dir;
        stepCar(c,{throttle:1,steer,drift:i<90},1/60);
        const off=Math.abs(T.offsetOf(c.x,c.z));maxOff=Math.max(maxOff,off);
        if(off>=T.HW-1.61)walls++;
        charge=Math.max(charge,c.driftT);boost=Math.max(boost,c.boost);assist=Math.max(assist,c.driftAssist);
      }
      return {track:T.id,s:bend.s,turn:bend.turn,car:c.def.id,wheel:c.wheel,walls,maxOff,charge,boost,assist,
        speed:c.vf,distance:Math.hypot(c.x-x,c.z-z),x:c.x,z:c.z,h:c.h,limit:T.HW-1.6};
    }
    const counter=[];
    for(const track of ['estadio','galipan']) {
      toGarage();buildTrack(track);await startRace(0,'calle');race.state='go';
      T=getActiveTrack();c=race.player;
      heading=s=>{const p=T.pointAt(s),q=T.pointAt(s+.5);return Math.atan2(q.x-p.x,q.y-p.y);};
      const bends=[];
      for(const dir of [-1,1])for(const target of track==='estadio'?[.5,1.1]:[.5]) {
        let best;
        for(let s=30;s<T.TOTAL-70;s+=2) {
          const turn=wrap(heading(s+55)-heading(s));
          if(Math.sign(turn)!==dir)continue;
          const score=Math.abs(Math.abs(turn)-target)+Math.abs(wrap(heading(s+27)-heading(s))-turn/2);
          if(!best||score<best.score)best={s,dir,turn,score};
        }
        bends.push(best);
      }
      for(const bend of bends)for(let car=0;car<8;car++)for(let wheel=0;wheel<5;wheel++) {
        reset(bend,car,wheel);c.wheel=WHEEL_DEFINITIONS[wheel].id;
        runs.push(drive(bend));
      }
      for(const bend of bends.slice(0,1)) {
        reset(bend,6,3);const held=drive(bend);
        reset(bend,6,3);const corrected=drive(bend,true);
        counter.push({track,delta:Math.hypot(held.x-corrected.x,held.z-corrected.z),walls:corrected.walls});
      }
    }
    // The old 300 ms landing window is gone: turn after holding the button.
    const bend={s:T.LINE+40,dir:1};reset(bend,0,0);c.driftHeld=true;
    stepCar(c,{throttle:1,steer:1,drift:true},1/60);
    const lateEntry=c.drift===1;
    reset(bend,0,0);c.drift=1;c.driftHeld=true;c.onGround=false;c.y+=4;c.vy=3;
    stepCar(c,{throttle:1,steer:1,drift:true},1/60);
    const airborne=c.driftAssist===0;
    reset(bend,0,0);c.drift=1;c.driftHeld=true;c.h+=Math.PI;c.vx=Math.sin(c.h)*32;c.vz=Math.cos(c.h)*32;
    stepCar(c,{throttle:1,steer:1,drift:true},1/60);
    const backward=c.driftAssist===0;
    reset(bend,0,0);c.drift=1;c.driftHeld=true;c.driftT=1;c.vr=8;
    stepCar(c,{throttle:1,steer:0,drift:false},1/60);
    const exit=c.drift===0&&c.driftExitT>0&&c.boost>0;
    return {runs,counter,lateEntry,airborne,backward,exit};
  });
  await writeFile(`${output}/corners.json`,JSON.stringify(proof,null,2));
  assert.equal(proof.runs.length,240);
  for(const r of proof.runs) {
    assert.equal(r.walls,0,`clear walls: ${JSON.stringify(r)}`);
    assert.ok(r.distance>30&&r.speed>15,`keep driving: ${JSON.stringify(r)}`);
    assert.ok(r.boost>0,`corner earns a turbo: ${JSON.stringify(r)}`);
  }
  assert.ok(proof.counter.every(c=>c.delta>.5&&c.walls===0),JSON.stringify(proof.counter));
  assert.ok(proof.lateEntry&&proof.airborne&&proof.backward&&proof.exit,JSON.stringify({...proof,runs:undefined}));

  // Keyboard and touch use the same assisted physics. Inspect the real HUD.
  async function prepare(p) {
    await p.evaluate(async()=>{
      toGarage();buildTrack('estadio');await startRace(6,'palo');race.state='go';race.count=0;
      document.getElementById('count').textContent='';
      const T=getActiveTrack(),c=race.player,s=1254,a=T.pointAt(s),b=T.pointAt(s+.5),h=Math.atan2(b.x-a.x,b.y-a.y);
      for(const o of race.cars)if(o!==c){o.done=true;o.x+=500;}
      for(const b of [...race.items.boxes,...race.items.coins])b.down=9999;
      Object.assign(c,{x:a.x,z:a.y,y:T.groundAt(a.x,a.y),h,onGround:true,vx:Math.sin(h)*32,vz:Math.cos(h)*32,vf:32,
        vy:0,pitch:0,roll:0,steer:0,boost:0,spin:0,stall:0,drift:0,driftT:0,driftHeld:false,tireHeat:0,burnLock:false,driftExitT:0,phaseT:0});
      race.camPos=null;
    });
  }
  const paint=async p=>p.evaluate(()=>{
    for(let i=0;i<78;i++)updateRace(1/60);
    renderer.render(race.scene,race.camera);
    const hint=document.getElementById('drift-hint'),box=hint.getBoundingClientRect();
    return {drift:race.player.drift,text:hint.textContent,visible:!hint.hidden,inBounds:box.x>=0&&box.right<=innerWidth&&box.y>=0&&box.bottom<=innerHeight};
  });
  await prepare(page);
  for(const key of ['w','Shift','d'])await page.keyboard.down(key);
  const keyboard=await paint(page);
  assert.ok(keyboard.drift&&keyboard.visible&&keyboard.inBounds&&keyboard.text==='Suelta: turbo',JSON.stringify(keyboard));
  await page.screenshot({path:`${output}/keyboard-drift.png`});
  for(const key of ['w','Shift','d'])await page.keyboard.up(key);
  const release=await page.evaluate(()=>{updateRace(1/60);return race.player.boost>0&&!race.player.drift&&document.getElementById('drift-hint').hidden;});
  assert.ok(release,'release the physical Shift key to collect the boost');
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await mobile.goto(`${origin}/g/carreritas/?debug&manual&track=estadio`);
  await mobile.waitForFunction(()=>window.garage?.car);
  await mobile.evaluate(async()=>{const {setSettings}=await import('/engine/settings.js');setSettings({orientation:'vertical'});});
  await prepare(mobile);
  for(const [i,key] of ['w','shift','d'].entries())await mobile.locator(`[data-drive="${key}"]`).dispatchEvent('pointerdown',{pointerId:i+1,pointerType:'touch',bubbles:true});
  const touch=await paint(mobile);
  assert.ok(touch.drift&&touch.visible&&touch.inBounds&&touch.text==='Suelta: turbo',JSON.stringify(touch));
  assert.equal(await mobile.locator('.touch-drift').textContent(),'¡Suelta!');
  assert.ok(await mobile.evaluate(()=>{
    const speed=document.getElementById('speedo').getBoundingClientRect(),item=document.querySelector('.item').getBoundingClientRect();
    return speed.left>item.right+4;
  }),'three-digit speed and drift hint stay clear of the inventory');
  await mobile.screenshot({path:`${output}/touch-drift.png`});
  await mobile.setViewportSize({width:320,height:740});
  assert.ok(await mobile.evaluate(()=>{
    const speed=document.getElementById('speedo').getBoundingClientRect(),item=document.querySelector('.item').getBoundingClientRect();
    return speed.left>item.right+4;
  }),'the narrow phone layout also keeps the hint clear of inventory');
  for(const [i,key] of ['w','shift','d'].entries())await mobile.locator(`[data-drive="${key}"]`).dispatchEvent('pointerup',{pointerId:i+1,pointerType:'touch',bubbles:true});
  assert.ok(await mobile.evaluate(()=>{updateRace(1/60);return !race.player.drift&&race.player.boost>0;}));
  await mobile.setViewportSize({width:844,height:390});
  await mobile.evaluate(async()=>{const {setSettings}=await import('/engine/settings.js');setSettings({orientation:'horizontal'});});
  await prepare(mobile);
  for(const [i,key] of ['w','shift','d'].entries())await mobile.locator(`[data-drive="${key}"]`).dispatchEvent('pointerdown',{pointerId:i+1,pointerType:'touch',bubbles:true});
  await paint(mobile);
  assert.equal(await mobile.locator('#speedo').isVisible(),false);
  assert.equal(await mobile.locator('.touch-drift').textContent(),'¡Suelta!');
  assert.ok(await mobile.locator('.touch-drift').isVisible(),'landscape still shows the release cue on its button');
  const landscapeClear=()=>mobile.evaluate(()=>{
    const item=document.querySelector('.item').getBoundingClientRect(),pedals=document.querySelector('.touch-pedals').getBoundingClientRect();
    const coins=document.querySelector('.coins').getBoundingClientRect(),map=document.querySelector('.minimap').getBoundingClientRect();
    return item.bottom+4<pedals.top&&coins.right+4<map.left;
  });
  assert.ok(await landscapeClear(),'landscape inventory and coins stay clear of the pedals and map');
  await mobile.screenshot({path:`${output}/touch-landscape.png`});
  for(const [width,height] of [[667,375],[568,320]]) {
    await mobile.setViewportSize({width,height});
    assert.ok(await landscapeClear(),`landscape controls stay separate at ${width}×${height}`);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({corners:proof.runs.length,wallRuns:proof.runs.filter(r=>r.walls).length,counter:proof.counter,keyboard,touch}));
}finally{await browser.close();}
