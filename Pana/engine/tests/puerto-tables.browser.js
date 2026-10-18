// Two real clients, host authority, late arrivals, migration and live table views.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.PANA_TEST_URL||'http://localhost:8461',out='art/studio/puerto/tables';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']}),errors=[];
const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:90000});
async function open(game,code,mobile=false){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:850},isMobile:mobile,hasTouch:mobile});
  await ctx.addInitScript(()=>{localStorage.setItem('pana:name','Pana del puerto');localStorage.setItem('pana:settings',JSON.stringify({sound:false,quality:'baja'}));});
  const p=await ctx.newPage();p.on('pageerror',e=>{errors.push(`${game}: ${e.message}`);console.error(`${game}: ${e.stack}`);});await p.goto(`${base}/g/${game}/?debug&room=${code}`);
  await wait(p,key=>window[key]?.room.connected&&window[key].world,`${game}Debug`);await wait(p,()=>window.PANA_LOBBY_LOADING===false);return p;
}
async function mapped(p,key,id){await wait(p,({key,id})=>window[key].room.state.mapId===id&&window[key].world.scene.userData.mapId===id,{key,id});}
async function attempt(p,key,id){await p.evaluate(({key,id})=>{const r=window[key].room;if(key==='poquerDebug')r.link.send('map',{mapId:id,revision:r.state.revision});else r.action(key==='caidaDebug'?'configure':'map',{mapId:id,options:{mapId:id}});},{key,id});}
async function close(p,key){await p.evaluate(key=>window[key].room.dispose(),key);await p.context().close();}
try{
  for(const game of ['caida','domino','poquer']){
    const key=`${game}Debug`,code=`pt-${game.slice(0,2)}-${Date.now().toString(36)}`,a=await open(game,code),b=await open(game,code);
    await wait(a,key=>window[key].room.isHost,key);assert.equal(await b.locator('#map-choice').isDisabled(),true);
    await a.locator('#pana-room-more').click();
    for(const id of ['guipuzcoana','san-carlos','guipuzcoana','san-carlos']){
      await a.selectOption('#map-choice',id);await mapped(a,key,id);await mapped(b,key,id);
      assert.equal(await b.locator('#map-choice').inputValue(),id);
    }
    await attempt(b,key,'guipuzcoana');await attempt(a,key,'invalid');await a.waitForTimeout(300);await mapped(a,key,'san-carlos');
    // Migrating in the lobby must preserve the setting and enable the next host.
    await close(a,key);await wait(b,key=>window[key].room.isHost,key);await mapped(b,key,'san-carlos');
    await b.locator('#pana-room-more').click();
    await b.selectOption('#map-choice','guipuzcoana');await mapped(b,key,'guipuzcoana');
    await b.locator('#pana-room-done').click();
    await b.locator('#start').click();await wait(b,key=>window[key].room.state.phase!=='lobby',key);
    await attempt(b,key,'san-carlos');await b.waitForTimeout(300);await mapped(b,key,'guipuzcoana');
    const late=await open(game,code);await mapped(late,key,'guipuzcoana');
    await b.screenshot({path:`${out}/${game}-guipuzcoana-playing.png`});
    assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await close(late,key);await close(b,key);
    const phone=await open(game,`${code}-p`,true);
    await phone.locator('#pana-room-more').click();
    await phone.selectOption('#map-choice','san-carlos');await mapped(phone,key,'san-carlos');
    await phone.locator('#map-choice').scrollIntoViewIfNeeded();assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await phone.screenshot({path:`${out}/${game}-phone-picker.png`});
    // Local fallback keeps the last agreed world, as does an ordinary start.
    await phone.locator('#pana-room-done').click();
    await phone.evaluate(key=>window[key].room.practice(),key);await mapped(phone,key,'san-carlos');
    if(game!=='poquer')await phone.locator('#start').click();
    await wait(phone,key=>window[key].room.state.phase!=='lobby',key);
    await phone.screenshot({path:`${out}/${game}-san-carlos-phone.png`});await close(phone,key);
    console.log(`${game}: two-client maps, guest/invalid/mid-game rejection, host change, late arrival, practice and phone passed`);
  }
  // Exercise the actual Studio factories and retain a second instance on dispose.
  const p=await browser.newPage();await p.goto(`${base}/studio/settings.html`);
  await p.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const metrics=await p.evaluate(async()=>{
    const THREE=await import('three'),{MAPS}=await import('/studio/catalog/maps.js');const records=[];
    for(const id of ['guipuzcoana','san-carlos'])for(let cycle=0;cycle<2;cycle++){
      const factory=MAPS.find(m=>m.id===`table-${id}`),a=await factory.build(),b=await factory.build();a.group.updateMatrixWorld(true);b.group.updateMatrixWorld(true);
      let finite=true,triangles=0;const ga=new Set(),gb=new Set(),meshes=[];
      a.group.traverse(o=>{if(o.isMesh){ga.add(o.geometry);meshes.push(o);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const v of o.geometry.attributes.position.array)finite&&=Number.isFinite(v);}});
      b.group.traverse(o=>{if(o.geometry)gb.add(o.geometry);});
      const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,3),blocked=[];
      for(let x=-8;x<=8;x+=2)for(let z=-8;z<=8;z+=2){ray.ray.origin.set(x,3.3,z);if(ray.intersectObjects(meshes,false).length)blocked.push([x,z]);}
      a.update(10);a.dispose();b.update(20);records.push({id,cycle,finite,triangles,blocked,shared:[...ga].some(g=>gb.has(g))});b.dispose();
    }return records;
  });
  for(const m of metrics){assert.ok(m.finite);assert.ok(m.triangles<450000);assert.deepEqual(m.blocked,[]);assert.equal(m.shared,false);}
  await writeFile(`${out}/metrics.json`,JSON.stringify(metrics,null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();}
