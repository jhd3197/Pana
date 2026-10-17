// Explicit hardware benchmark, kept outside functional suite timeouts.
// Mobile viewport here is desktop GPU emulation, never a mobile-device claim.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist']}),proof=[],errors=[];
try{
  for(const profile of [{name:'desktop',width:1280,height:800,quality:'alta'},{name:'mobile-viewport-on-desktop-GPU',width:844,height:390,quality:'baja'}]){
    const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(quality=>localStorage.setItem('pana:settings',JSON.stringify({quality,sound:false})),profile.quality);
    await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/derrape/?debug&auto&manual`);
    await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
    const device=await page.evaluate(()=>{const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {gpu:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),cores:navigator.hardwareConcurrency,userAgent:navigator.userAgent};});
    assert.ok(!/SwiftShader|llvmpipe|software/i.test(device.gpu),'hardware renderer required');
    for(const id of ['salinas','delta','cuevas','salto']){
      const loading=await page.evaluate(async id=>{toGarage();setup.mode='race';const start=performance.now();buildTrack(id);await startRace(0);for(let i=4;i<8;i++)race.cars.push(makeRacer(i,false,`Rival ${i+1}`));race.cars.forEach((c,i)=>placeRacer(c,i%2?-3.5:3.5,Math.floor(i/2)));race.state='go';race.count=0;updateRace(0);renderer.render(race.scene,race.camera);return performance.now()-start;},id);
      const views=[];
      for(const u of [0,.4,.62])views.push(await page.evaluate(async u=>{
        const T=getActiveTrack(),p=T.pointAt(T.TOTAL*u),q=T.pointAt(T.TOTAL*u+1),c=race.player;
        Object.assign(c,{x:p.x,z:p.y,y:T.groundAt(p.x,p.y),h:Math.atan2(q.x-p.x,q.y-p.y),vx:0,vz:0,vf:0});race.camPos=null;
        const frames=[],work=[];let last=0,draws=0,triangles=0;
        for(let i=0;i<150;i++){
          const now=await new Promise(requestAnimationFrame),start=performance.now();
          updateRace(1/60);renderer.render(race.scene,race.camera);
          if(i>29){frames.push(now-last);work.push(performance.now()-start);}last=now;
          draws=Math.max(draws,renderer.info.render.calls);triangles=Math.max(triangles,renderer.info.render.triangles);
        }
        const qtile=(a,q)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*q)];
        return {u,p50FrameMs:qtile(frames,.5),p95FrameMs:qtile(frames,.95),p50WorkMs:qtile(work,.5),p95WorkMs:qtile(work,.95),draws,triangles,resources:{...renderer.info.memory}};
      },u));
      assert.ok(views.every(v=>v.draws<=3200),'eight-car draw budget');
      proof.push({id,profile,device,firstPlayableMs:loading,views});console.log(JSON.stringify(proof.at(-1)));
      await mkdir('art/grand-prix',{recursive:true});await writeFile('art/grand-prix/hardware-rendering.json',JSON.stringify({revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),physicalMobile:false,proof},null,2));
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
