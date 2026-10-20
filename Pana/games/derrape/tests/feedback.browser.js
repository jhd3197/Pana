// Real simulation regressions for the friends' playtest, independent of rendering rate.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const output=resolve(process.env.PANA_TEST_ARTIFACTS||'art/derrape-feedback');
await mkdir(output,{recursive:true});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL/.test(m.text()))errors.push(m.text());});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/derrape/?debug&manual&track=estadio`);
  await page.waitForFunction(()=>window.garage?.car);
  await page.evaluate(()=>startRace(0,'calle'));
  const result=await page.evaluate(async()=>{
    const {addItem}=await import('./item-rules.js');
    const {composeTune,wheelById}=await import('./wheel-definitions.js');
    const {CAR_DEFINITIONS}=await import('./car-definitions.js');
    const {setSettings}=await import('/engine/settings.js');
    const T=getActiveTrack(), [owner,victim,third,fourth]=race.cars, out={};
    const place=(c,s,speed=0)=>{
      const p=T.pointAt(s),q=T.pointAt(s+0.5),h=Math.atan2(q.x-p.x,q.y-p.y);
      Object.assign(c,{x:p.x,z:p.y,y:T.groundAt(p.x,p.y),h,vx:Math.sin(h)*speed,vz:Math.cos(h)*speed,vf:speed,vr:0,
        vy:0,onGround:true,pitch:0,roll:0,pitchV:0,rollV:0,lap:1,prog:s-T.LINE,done:false,
        spin:0,dizzy:0,cloud:0,phaseT:0,phaseRemote:false,ghost:false,rescueT:0,boost:0,shield:0,inventory:[null,null],selected:0,impacts:[]});
    };
    const reset=()=>{
      race.state='go';race.count=0;race.items.clear();
      for(const b of [...race.items.boxes,...race.items.coins])b.down=9999;
      [owner,victim,third,fourth].forEach((c,i)=>place(c,T.LINE+35+i*40));
    };
    reset();
    addItem(owner,'aguacero',0);race.items.use(owner);
    const arrivals=[];
    for(let i=0;i<360;i++) {
      race.items.update(1/60,race.cars,true);
      for(const c of [victim,third,fourth])if(c.cloud>0&&!arrivals.some(a=>a.id===c.def.id))arrivals.push({id:c.def.id,time:(i+1)/60,duration:c.cloud});
    }
    out.rain={arrivals,expected:[victim,third,fourth].map(c=>c.def.id),caller:owner.cloud};

    reset();third.done=fourth.done=true;
    addItem(owner,'chancleta',0);
    const initial=T.LINE+35+T.TOTAL-150;
    place(victim,initial,62);victim.lap=2;
    race.items.use(owner);
    let flight=0;
    while(race.items.projectiles.length&&flight<30) {
      flight+=1/60;place(victim,initial+flight*62,62);victim.lap=2;
      race.items.update(1/60,[owner,victim],true);
      if(victim.dizzy>0)break;
    }
    out.chancleta={hit:victim.dizzy>0,flight,gap:T.TOTAL-150};

    reset();third.done=fourth.done=true;
    place(owner,T.LINE+T.TOTAL*.5);place(victim,T.LINE+40);
    addItem(victim,'chancleta',0);race.items.use(victim);
    const warningDistance=Math.hypot(owner.x-victim.x,owner.z-victim.z);
    updateRace(1/60);
    out.earlyWarning=warningDistance>60&&!document.getElementById('incoming').hidden&&document.getElementById('incoming-text').textContent.includes('chancleta');

    reset();third.done=fourth.done=true;
    // A close interceptor must not steal the leader's hit.
    place(victim,T.LINE+45);place(third,T.LINE+44);third.done=false;third.prog=1;
    addItem(owner,'chancleta',0);race.items.use(owner);
    for(let i=0;i<180&&race.items.projectiles.length;i++)race.items.update(1/60,race.cars,true);
    out.lock={victim:victim.dizzy,interceptor:third.dizzy};

    reset();third.done=fourth.done=true;
    Object.assign(owner,{x:0,y:0,z:0,vx:50,vz:0,vy:0});Object.assign(victim,{x:3,y:0,z:0,vx:-50,vz:0,vy:0});
    collidePair(owner,victim);
    out.contact={ownerY:owner.vy,victimY:victim.vy,ground:owner.onGround&&victim.onGround};
    reset();crash(owner,16,1);crash(owner,16,1);
    const rollAfterTwo=owner.rollV;crash(owner,16,1);
    out.pileup=owner.phaseT>0&&owner.rollV===rollAfterTwo;
    reset();race.state='count';race.count=1.01;updateRace(.02);
    out.launch=race.cars.every(c=>c.phaseT>2.9&&c.ghostVisible);
    owner.x=victim.x;owner.z=victim.z;owner.y=victim.y;
    const x=owner.x;collidePair(owner,victim);out.noContact=owner.x===x;
    for(const c of race.cars)if(c!==owner)c.done=true;
    rescue(owner);
    for(let i=0;i<125;i++)updateRace(1/60);
    out.rescue={phase:owner.phaseT,visible:owner.ghostVisible,ground:owner.onGround};
    renderer.render(race.scene,race.camera);

    // Real unpinned cornering with the same steering input and duration.
    function drift(car,wheel) {
      place(owner,1254,32);
      owner.tune=composeTune(CAR_DEFINITIONS.find(c=>c.id===car).tune,wheelById(wheel).profile);
      owner.drift=-1;owner.driftHeld=true;owner.driftT=0;owner.driftLane=0;owner.driftExitT=0;
      for(let i=0;i<90;i++) {
        stepCar(owner,{throttle:1,steer:-1,drift:true},1/60);
      }
      const charge=owner.driftT;stepCar(owner,{throttle:1,steer:0,drift:false},1/60);
      return {charge,boost:owner.boost};
    }
    out.skills={rumbera:drift('rumbera','palo'),bala:drift('bala','slick')};
    const wear=race.trackGroup.getObjectByName('road-wear'),flags=race.trackGroup.getObjectByName('sector-pennants');
    setSettings({quality:'baja'});
    out.low={shadows:renderer.shadowMap.enabled,wear:wear.visible,flags:flags.visible,rain:race.rain.lines.geometry.drawRange.count};
    const physics=JSON.stringify(owner.tune);setSettings({quality:'alta'});
    out.high={shadows:renderer.shadowMap.enabled,wear:wear.visible,flags:flags.visible,rain:race.rain.lines.geometry.drawRange.count,unchanged:physics===JSON.stringify(owner.tune)};
    // Repeated ghost transitions must recover opaque paint, including after a rescue.
    const paint=[...owner.car.ghostMaterials].find(m=>m.userData.baseOpacity===1&&!m.userData.baseTransparent);
    for(let i=0;i<2;i++) {
      owner.phaseT=1;updateRace(1/60,false);
      owner.phaseT=0;updateRace(1/60,false);
    }
    out.opacity=paint.opacity;out.transparent=paint.transparent;
    renderer.render(race.scene,race.camera);
    return out;
  });
  assert.deepEqual(result.rain.arrivals.map(a=>a.id),result.rain.expected);
  assert.equal(result.rain.caller,0);
  for(let i=1;i<3;i++) {
    assert.ok(result.rain.arrivals[i].time-result.rain.arrivals[i-1].time>1.7);
    assert.ok(result.rain.arrivals[i].duration>result.rain.arrivals[i-1].duration);
  }
  assert.ok(result.chancleta.hit&&result.chancleta.flight<10,JSON.stringify(result.chancleta));
  assert.ok(result.earlyWarning,'the leader sees the warning before the faster chancleta is close');
  assert.ok(result.lock.victim>0&&result.lock.interceptor===0,JSON.stringify(result.lock));
  assert.deepEqual(result.contact,{ownerY:0,victimY:0,ground:true});
  assert.ok(result.pileup,'two immediate weapons protect against a third hit');
  assert.ok(result.launch&&result.noContact);
  assert.ok(result.rescue.phase>2&&result.rescue.visible&&result.rescue.ground,JSON.stringify(result.rescue));
  assert.ok(result.skills.rumbera.boost>result.skills.bala.boost*2,JSON.stringify(result.skills));
  assert.deepEqual(result.low,{shadows:false,wear:false,flags:false,rain:560});
  assert.deepEqual(result.high,{shadows:true,wear:true,flags:true,rain:2800,unchanged:true});
  assert.equal(result.opacity,1);assert.equal(result.transparent,false);
  await page.screenshot({path:resolve(output,'feedback-race.png')});
  // Real permanent rain, not a mocked surface: slicks must give up speed.
  // Páramo is the map with all-lap rain (Selva's rain now stays in its cave).
  const wet=await page.evaluate(async()=>{
    const {composeTune,wheelById}=await import('./wheel-definitions.js');
    toGarage();buildTrack('paramo');if(!getActiveTrack().def.rain)throw new Error('paramo lost its rain');await startRace(3,'slick');race.state='go';
    const T=getActiveTrack(),c=race.player,s=T.LINE+45,p=T.pointAt(s),q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y);
    const run=id=>{
      c.tune=composeTune(c.def.tune,wheelById(id).profile);
      Object.assign(c,{vx:Math.sin(h)*40,vz:Math.cos(h)*40,vf:40,steer:0,spin:0,boost:0,cloud:0,coins:0,skill:1,band:1,drift:0,driftHeld:false});
      for(let i=0;i<180;i++){
        Object.assign(c,{x:p.x,z:p.y,y:T.groundAt(p.x,p.y),h,onGround:true,pitch:0,roll:0,vy:0});
        stepCar(c,{throttle:1,steer:0},1/60);
      }
      return c.vf;
    };
    return {slick:run('slick'),lluvia:run('lluvia')};
  });
  assert.ok(wet.lluvia>wet.slick*1.1,JSON.stringify(wet));
  result.wet=wet;
  await writeFile(resolve(output,'feedback.json'),JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(result));
} finally {await browser.close();}
