// Ludo on a phone: portrait and landscape touch, the local fallback, the
// Studio models and hub discovery. Split from ludo.browser.js so each suite
// fits a slow runner's per-suite limit.
import assert from 'node:assert/strict';
import { launch } from '../../../tests/browser-kit.js';
import { mkdir } from 'node:fs/promises';
const base=process.env.PANA_TEST_URL||'http://localhost:8461',code=`ludo-mobile-${Date.now()}`;
const browser=await launch(),errors=[];
await mkdir('art/ludo',{recursive:true});
async function open(name,mobile=false,roomCode=code){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(name=>{localStorage.setItem('pana:name',name);localStorage.setItem('pana:settings',JSON.stringify({quality:'baja',sound:false}));localStorage.setItem('pana:avatar',JSON.stringify({hat:'gorra',outfitColor:'#3d7bf2'}));},name);
  const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/g/ludo/?room=${roomCode}&debug`);
  await page.waitForFunction(()=>window.ludoDebug?.world&&ludoDebug.room.connected,null,{timeout:90000});
  await page.waitForFunction(()=>window.PANA_PREPARED===true,null,{timeout:90000});
  if(await page.locator('#pana-lobby-shell').isVisible())await page.waitForFunction(()=>window.PANA_PREPARED===true&&!document.querySelector('#pana-lobby-ready')?.disabled,null,{timeout:90000});
  await page.locator('#loading').waitFor({state:'hidden'});return page;
}
try{
  const m=await open('Móvil',true);await m.screenshot({path:'art/ludo/mobile-lobby.png'});
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // A finger on the table shakes the cacho; lifting it slams.
  await m.locator('#start').tap();await m.locator('#pana-starter-shake').waitFor();
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await m.screenshot({path:'art/ludo/mobile-starter.png'});
  await m.locator('#world').tap();
  await m.waitForFunction(()=>0 in ludoDebug.room.state.starter.slammed);
  await m.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.phase='playing';g.turn=0;g.die=6;g.revision++;ludoDebug.room.publish();});
  await m.locator('[data-piece="0"]').tap();assert.equal(await m.evaluate(()=>ludoDebug.room.state.players[0].pieces[0]),0);
  await m.screenshot({path:'art/ludo/mobile-playing.png'});
  await m.setViewportSize({width:844,height:390});await m.screenshot({path:'art/ludo/mobile-landscape.png'});
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await m.locator('#world').evaluate(el=>el.getBoundingClientRect().height>250));
  await m.evaluate(()=>ludoDebug.room.cut());await m.locator('#practice').waitFor({state:'visible'});await m.locator('#practice').click();
  assert.ok(await m.locator('#invite').isDisabled());await m.locator('#start').click();assert.equal(await m.evaluate(()=>ludoDebug.room.state.phase),'starter');
  // Build the six models (three boards, the cream and mango dice, the pawn) and twenty-one shared animation previews through the real catalog.
  assert.equal(await m.evaluate(async()=>{const {ASSETS}=await import('/studio/catalog.js');for(const asset of ASSETS.filter(a=>a.id.startsWith('ludo-'))){const {group}=await asset.build();if(!group.children.length)throw Error('empty model');group.userData.dispose();}return ASSETS.filter(a=>a.id.startsWith('ludo-')).length;}),27);
  const response=await m.request.get(`${base}/api/games`);const listing=await response.json();assert.ok(JSON.stringify(listing).includes('Ludo'));
  await m.goto(base);await m.getByRole('heading',{name:'Ludo',exact:true}).waitFor();
  console.log('ok: portrait and landscape touch, local fallback, Studio models and hub discovery');
  assert.deepEqual(errors,[]);
}catch(error){for(const [i,c]of browser.contexts().entries())for(const p of c.pages()){await p.screenshot({path:`art/ludo/mobile-failure-${i}.png`}).catch(()=>{});console.log(await p.evaluate(()=>window.ludoDebug?ludoDebug.room.state:location.href).catch(()=>null));}throw error;}
finally{await browser.close();}
