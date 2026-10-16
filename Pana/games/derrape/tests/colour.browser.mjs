// Render every real circuit with its live game lighting at fixed route positions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),out=`art/world-colour/${process.argv[2]||'after'}`;
await mkdir(out,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],proof=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE'))errors.push(m.text());});
  await page.goto('http://localhost:8461/g/derrape/?debug&manual');await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  for(const id of process.env.PANA_COLOUR_TRACKS?.split(',')||['estadio','desierto','llanos','chichi','selva','paramo','plaza','bululu']){
    const data=await page.evaluate(async id=>{
      toGarage();buildTrack(id);await startRace(0);
      const T=getActiveTrack(),u={estadio:.08,desierto:.13,llanos:.08,chichi:.11,selva:.05,paramo:.04,plaza:.13,bululu:.7}[id];
      const s=T.TOTAL*u,p=T.pointAt(s),next=T.pointAt(s+1),h=Math.atan2(next.x-p.x,next.y-p.y),y=T.heightAtS(s);
      race.cars.forEach(c=>c.car.root.visible=false);
      race.camera.position.set(p.x-Math.sin(h)*11,y+5,p.y-Math.cos(h)*11);race.camera.lookAt(p.x+Math.sin(h)*25,y+2,p.y+Math.cos(h)*25);
      race.sun.position.set(p.x-30,y+40,p.y+25);race.sun.target.position.set(p.x,y,p.y);race.sun.target.updateMatrixWorld();race.sky.update(4);
      T.animated.forEach(o=>o.userData.tick?.(4,0));
      document.querySelectorAll('body > :not(canvas):not(script)').forEach(el=>el.style.visibility='hidden');
      renderer.setPixelRatio(1);renderer.render(race.scene,race.camera);
      return {id,palette:T.def.palette,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    },id);
    assert.ok(data.calls>0);await page.screenshot({path:`${out}/${id}.png`});proof.push(data);console.log('rendered',id,data.calls);
  }
  assert.deepEqual(errors,[]);await writeFile(`${out}/proof.json`,JSON.stringify(proof,null,2));
}finally{await browser.close();}
