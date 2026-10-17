// Every new circuit receives real keyboard, held touch and controller input.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[],proof=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.addInitScript(()=>{
    localStorage.setItem('pana:settings',JSON.stringify({quality:'baja',sound:false}));
    window.padThrottle=0;
    navigator.getGamepads=()=>[{id:'proof',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({value:i===7?padThrottle:0,pressed:i===7&&!!padThrottle}))}];
  });
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/derrape/?debug&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  for(const id of ['salinas','delta','cuevas','salto']){
    await page.evaluate(async id=>{toGarage();setup.mode='race';setup.split=false;buildTrack(id);await startRace(0);race.state='go';race.count=0;},id);
    await page.bringToFront();await page.keyboard.down('w');
    const keyboard=await page.evaluate(()=>{const c=race.player,x=c.x,z=c.z;for(let i=0;i<90;i++)updateRace(1/60);return {distance:Math.hypot(c.x-x,c.z-z),speed:c.vf};});
    await page.keyboard.up('w');assert.ok(keyboard.distance>5&&keyboard.speed>5,`${id}: keyboard accelerates`);
    const controller=await page.evaluate(()=>{const c=race.player;c.vx=c.vz=c.vf=0;padThrottle=1;for(let i=0;i<60;i++){pollPads();updateRace(1/60);}padThrottle=0;pollPads();return c.vf;});
    assert.ok(controller>5,`${id}: controller accelerates`);
    await page.evaluate(()=>{race.player.vx=race.player.vz=race.player.vf=0;});
    const button=await page.locator('[data-drive="w"]').boundingBox(),cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:button.x+button.width/2,y:button.y+button.height/2}]});
    const touch=await page.evaluate(()=>{for(let i=0;i<60;i++)updateRace(1/60);return race.player.vf;});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();assert.ok(touch>5,`${id}: held touch accelerates`);
    const recovery=await page.evaluate(async()=>{
      const c=race.player,T=getActiveTrack(),{addItem}=await import('./item-rules.js');
      c.inventory=[null,null];c.selected=0;addItem(c,'mango',0);race.items.use(c,1);const thrown=race.items.projectiles.length;
      c.x+=150;c.y-=10;const started=rescue(c);for(let i=0;i<240;i++)updateRace(1/60);
      updateRace(0);renderer.render(race.scene,race.camera);
      return {thrown,started,ground:Math.abs(c.y-T.groundAt(c.x,c.z)),offset:Math.abs(T.offsetOf(c.x,c.z)),rescueT:c.rescueT,halfWidth:T.HW};
    });
    assert.ok(recovery.thrown>0&&recovery.started);assert.equal(recovery.rescueT,0);assert.ok(recovery.ground<.2&&recovery.offset<recovery.halfWidth);
    await mkdir(`art/water-worlds/${id}`,{recursive:true});await page.screenshot({path:`art/water-worlds/${id}/touch-recovery.png`});
    proof.push({id,keyboard,controller,touch,recovery});console.log(`${id}: keyboard, controller, held touch, mango and safe rescue passed`);
  }
  assert.deepEqual(errors,[]);await writeFile('art/grand-prix/water-controls.json',JSON.stringify(proof,null,2));
}finally{await browser.close();}
