import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), pages = [];
try {
  const room = `aragua-${Date.now().toString(36)}`;
  for (let i=0;i<2;i++) {
    const page=await openGame(browser,'carreritas',{room,name:`Aragua ${i+1}`,query:`debug&auto&manual${i===0?'&lead=1':''}`});
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
  for (const id of ['cata','choroni','chuao']) {
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
        const T=getActiveTrack(), c=race.player;
        let forestTriangles=0;
        T.group.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('coastal-'))forestTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*o.count;});
        return {id:T.id,trees:T.group.getObjectByName('track-environment').userData.libraryTrees,
          forestTriangles,
          zones:T.group.getObjectByName('track-environment').userData.forestZones,
          players:getNet().state.players.length,finite:[c.x,c.y,c.z].every(Number.isFinite)};
      });
      assert.equal(result.id,id);assert.equal(result.players,2);assert.ok(result.finite);
      assert.ok(result.trees>3000,`${id}: dense native vegetation`);
      assert.equal(Object.values(result.zones).reduce((sum,n)=>sum+n,0),result.trees,'detail zoning preserves every tree placement');
      assert.ok(Object.values(result.zones).every(n=>n>0),`${id}: near, middle and distant forest`);
      assert.ok(result.zones.far>result.trees*.4,`${id}: distant hills use uncapped route distance`);
      const baseline={cata:{trees:5767,near:561,triangles:5598811},choroni:{trees:5325,near:388,triangles:4841319},chuao:{trees:8922,near:698,triangles:9543933}}[id];
      assert.equal(result.trees,baseline.trees,`${id}: preserve planting density`);
      assert.equal(result.zones.near,baseline.near,`${id}: preserve the detailed roadside band`);
      assert.ok(result.forestTriangles<baseline.triangles*.8,`${id}: at least 20% less total forest geometry`);
      if(id==='chuao') {
        const descent=await page.evaluate(()=>{
          const T=getActiveTrack(),top=T.paramOf(-70,-270),bottom=T.paramOf(-175,60);
          const samples=[];
          for(let s=top;s<bottom;s+=4) samples.push(T.heightAtS(s));
          return {length:bottom-top,drop:T.heightAtS(top)-T.heightAtS(bottom),
            steepestRise:Math.max(...samples.slice(1).map((h,i)=>h-samples[i]))};
        });
        assert.ok(descent.length>250&&descent.drop>20,'Chuao follows the quebrada downhill');
        assert.ok(descent.steepestRise<.25,'the river descent has no uphill steps');
      }
    }
    console.log(`${id}: two clients selected, loaded and drove the same circuit`);
    await Promise.all(pages.map(p=>p.evaluate(()=>getNet().retire())));
    await Promise.all(pages.map(p=>waitFor(p,()=>getNet().state.phase==='results')));
  }
  for(const page of pages)assert.deepEqual(page.errors,[]);
} finally { await browser.close(); }
