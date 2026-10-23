import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&manual&track=cosmos' });
  await waitFor(page, () => window.getActiveTrack && garage.car);
  const signatures = new Map();
  for (const id of process.env.PANA_REFERENCE_TRACKS?.split(',') || ['cosmos','merida','arrecife','volcan','nubes','dulce','cosmos','merida']) {
    const result = await page.evaluate(async id => {
      const THREE = await import('three');
      const { gateRuns } = await import('/g/carreritas/course-rules.js');
      toGarage(); buildTrack(id); await startRace(0); race.state = 'audit';
      const T = getActiveTrack(), roads = [], group = T.group.getObjectByName('track-environment');
      group.updateMatrixWorld(true);
      let triangles = 0, meshes = 0, geometrySum = 0;
      group.traverse(o => {
        if (o.isMesh && o.name.startsWith(id + '-road')) roads.push(o);
        if (!o.geometry) return;
        meshes++;
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
        const p = o.geometry.attributes.position;
        for (let i=0;i<p.count;i+=31) geometrySum += p.getX(i)+p.getY(i)+p.getZ(i);
      });
      const gates = gateRuns(T), ray = new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,1);
      let error = 0, samples = 0, missing = 0, wet = 0;
      for (let i=0;i<160;i++) {
        const s=T.TOTAL*i/160, p=T.pointAt(s), q=T.pointAt(s+.5), h=Math.atan2(q.x-p.x,q.y-p.y);
        if (gates.some(g => (s-g.s0+T.TOTAL)%T.TOTAL < g.len)) { wet++; continue; }
        for (const off of [-T.HW+1,0,T.HW-1]) {
          const x=p.x-Math.cos(h)*off, z=p.y+Math.sin(h)*off, y=T.groundAt(x,z,T.heightAtS(s));
          ray.ray.origin.set(x,y+.5,z);
          const hit=ray.intersectObjects(roads,false)[0];
          if (!hit) missing++; else { error=Math.max(error,Math.abs(hit.point.y-y)); samples++; }
        }
      }
      // Force the real shaders to compile, including the old references' chunks.
      renderer.render(race.scene,race.camera);
      return {id,triangles,meshes,geometrySum,error,samples,missing,wet};
    }, id);
    assert.equal(result.missing,0,`${id}: every dry lane has a visible road`);
    assert.ok(result.samples>300,`${id}: sampled the whole circuit`);
    assert.ok(result.error<.2,`${id}: physics agrees with rendered banks (${result.error})`);
    const budgets = { cosmos:[850_000,240], merida:[4_200_000,750], arrecife:[750_000,170],
      volcan:[450_000,330], nubes:[750_000,600], dulce:[1_350_000,220] };
    assert.ok(result.triangles<budgets[id][0],`${id}: bounded whole-world geometry`);
    assert.ok(result.meshes<budgets[id][1],`${id}: bounded scene submissions`);
    if (id==='merida') assert.ok(result.wet>10,'Mérida has a real boat crossing');
    const signature=[result.triangles,result.meshes,result.geometrySum];
    if (signatures.has(id)) assert.deepEqual(signature,signatures.get(id),`${id}: deterministic rebuild`);
    signatures.set(id,signature);
    console.log(JSON.stringify(result));
  }
  assert.deepEqual(page.errors,[]);
} finally { await browser.close(); }
