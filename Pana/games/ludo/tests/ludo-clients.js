// Shared setup for the two-client Ludo desktop suites (ludo, turns, handoff),
// split so each fits a slow runner's per-suite limit.
import { launch } from '../../../tests/browser-kit.js';
import { mkdir } from 'node:fs/promises';

export async function ludoClients(prefix){
  const base=process.env.PANA_TEST_URL||'http://localhost:8461',code=`${prefix}-${Date.now()}`;
  const browser=await launch(),errors=[];
  await mkdir('art/ludo',{recursive:true});
  async function open(name,mobile=false,roomCode=code){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
    await context.addInitScript(name=>{localStorage.setItem('pana:name',name);localStorage.setItem('pana:settings',JSON.stringify({quality:'baja',sound:false}));localStorage.setItem('pana:avatar',JSON.stringify({hat:'gorra',outfitColor:'#3d7bf2'}));},name);
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/g/ludo/?room=${roomCode}&debug`);
    await page.waitForFunction(()=>window.ludoDebug?.world&&ludoDebug.room.connected,null,{timeout:90000});
    // A pana joining mid-game never sees the lobby, so wait for preparation, then for Ready only in the lobby.
    await page.waitForFunction(()=>window.PANA_PREPARED===true,null,{timeout:90000});
    if(await page.locator('#pana-lobby-shell').isVisible())await page.waitForFunction(()=>window.PANA_PREPARED===true&&!document.querySelector('#pana-lobby-ready')?.disabled,null,{timeout:90000});
    await page.locator('#loading').waitFor({state:'hidden'});return page;
  }
  async function sync(a,b){
    const revision=await a.evaluate(()=>ludoDebug.room.state.revision);
    await b.waitForFunction(rev=>ludoDebug.room.state.revision>=rev,revision);
  }
  // Juan hosts seat 0 and Ana takes seat 1; the other seats are bots.
  async function pair(){
    const a=await open('Juan'),b=await open('Ana');
    await a.waitForFunction(()=>ludoDebug.room.members.size===2);await b.waitForFunction(()=>ludoDebug.room.seat===1);
    return [a,b];
  }
  // The opener has its own suite (ludo.browser.js), so these start straight
  // into play: the host starts, or with the cacho opener (which a rematch
  // needs) the host skips the shake.
  async function startPlaying(a,b,starter='anfitrion'){
    if(starter!=='cacho'){
      await a.evaluate(starter=>ludoDebug.room.action('options',{options:{...ludoDebug.room.state.options,starter}}),starter);
      await b.waitForFunction(starter=>ludoDebug.room.state.options.starter===starter,starter);
    }
    await a.locator('#start').click();
    if(starter==='cacho'){await a.waitForFunction(()=>ludoDebug.room.state.phase==='starter');await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.phase='playing';g.turn=0;g.die=0;g.revision++;ludoDebug.room.publish();});}
    for(const page of [a,b])await page.waitForFunction(()=>ludoDebug.room.state.phase==='playing');
  }
  async function fail(error,tag='failure'){
    for(const [i,c]of browser.contexts().entries())for(const p of c.pages()){await p.screenshot({path:`art/ludo/${tag}-${i}.png`}).catch(()=>{});console.log(await p.evaluate(()=>window.ludoDebug?ludoDebug.room.state:location.href).catch(()=>null));}
    throw error;
  }
  return {base,code,browser,errors,open,sync,pair,startPlaying,fail};
}
