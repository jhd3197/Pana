import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

// Colonia Tovar, Galipán and Maracaibo: two real clients pick each circuit,
// load it, drive away from the grid and see the same native forest.
const browser = await launch(), pages = [];
try {
  const room = `tgm-${Date.now().toString(36)}`;
  for (let i=0;i<2;i++) {
    const page=await openGame(browser,'carreritas',{room,name:`Monte ${i+1}`,query:`debug&auto&manual${i===0?'&lead=1':''}`});
    pages.push(page);
    await waitFor(page,()=>window.getNet?.()?.id&&window.garage?.car);
    await page.evaluate(()=>{
      setInterval(()=>{
        if (!window.race || !window.updateRace) return;
        if (race.state==='count') updateRace(0);
        for(let j=0;j<4&&race.state==='go';j++) updateRace(1/60,false);
        window.sendPoses?.();
      },25);
    });
  }
  const host=pages[0];
  await waitFor(host,()=>getNet().state.players.length===2);
  for (const id of ['tovar','galipan','maracaibo']) {
    await host.evaluate(()=>getNet().lobby());
    await Promise.all(pages.map(p=>waitFor(p,()=>getNet().state.phase==='lobby')));
    await host.evaluate(id=>{getNet().mode('race');getNet().track(id);getNet().bots(false);},id);
    await Promise.all(pages.map(p=>waitFor(p,id=>getNet().state.track===id,id)));
    await host.evaluate(()=>getNet().start());
    await Promise.all(pages.map(p=>waitFor(p,id=>getActiveTrack()?.id===id&&race.state==='go',id,180000)));
    const starts=await Promise.all(pages.map(p=>p.evaluate(()=>({x:race.player.x,z:race.player.z}))));
    await Promise.all(pages.map((p,i)=>waitFor(p,start=>Math.hypot(race.player.x-start.x,race.player.z-start.z)>45,starts[i],120000)));
    for (const page of pages) {
      const result=await page.evaluate(()=>{
        const T=getActiveTrack(), c=race.player, env=T.group.getObjectByName('track-environment');
        return {id:T.id,trees:env.userData.libraryTrees,zones:env.userData.forestZones,
          daylight:T.def.palette.daylight??1,players:getNet().state.players.length,
          finite:[c.x,c.y,c.z].every(Number.isFinite),onRoad:Math.abs(T.offsetOf(c.x,c.z))<T.HW+2};
      });
      assert.equal(result.id,id);assert.equal(result.players,2);assert.ok(result.finite);
      assert.ok(result.onRoad,`${id}: the autopilot stays on the road`);
      assert.ok(result.trees>(id==='maracaibo'?150:500),`${id}: library trees replace the reference's own`);
      assert.equal(Object.values(result.zones).reduce((sum,n)=>sum+n,0),result.trees,'detail zoning preserves every tree placement');
      if(id!=='tovar') assert.ok(result.daylight<.5,`${id}: races at night`);
    }
    console.log(`${id}: two clients selected, loaded and drove the same circuit`);
    await Promise.all(pages.map(p=>p.evaluate(()=>getNet().retire())));
    await Promise.all(pages.map(p=>waitFor(p,()=>getNet().state.phase==='results')));
  }
  for(const page of pages)assert.deepEqual(page.errors,[]);
} finally { await browser.close(); }
