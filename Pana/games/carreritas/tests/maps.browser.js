// Run against npm start with Playwright installed in the test environment.
// Optional PANA_PLAYWRIGHT_PATH and PANA_BROWSER_PATH use an external runtime.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.goto(`${origin}/g/carreritas/?debug&auto&track=estadio`);
  await page.waitForFunction(() => window.getActiveTrack && garage.car);
  const ids = await page.evaluate(() => TRACKS.map(t => t.id));
  assert.deepEqual(ids, ['estadio', 'llanos', 'delta', 'galipan']);
  const accessoryError = await page.evaluate(async () => {
    const THREE = await import('three');
    const { detachable } = await import('/engine/models/vehicles/car-kit.js');
    const accessory = new THREE.Group();
    const part = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.9,0.3));
    part.position.set(0.2,0.1,0); accessory.add(part);
    accessory.position.set(0.35,1.37,-2.27); accessory.rotation.y=0.2;
    const before = new THREE.Box3().setFromObject(accessory);
    detachable({chassis:new THREE.Group(),detachables:[]},accessory);
    const after = new THREE.Box3().setFromObject(accessory);
    return before.min.distanceTo(after.min)+before.max.distanceTo(after.max);
  });
  assert.ok(accessoryError < 1e-6, 'pre-positioned car accessories stay in place');
  const requested = process.env.PANA_MAP_TEST_TRACKS?.split(',');
  if (requested) requested.forEach(id => assert.ok(ids.includes(id), `known requested track: ${id}`));
  // Four bounded suites cover all circuits and the return trips. Keep each
  // below the runner's slot as the registry grows; the assertions stay shared.
  const all = [...ids, 'delta', 'estadio'], size = Math.ceil(all.length / 4);
  const index = Number(process.env.PANA_MAP_TEST_PART || 1) - 1;
  const part = all.slice(index * size, (index + 1) * size);
  for (const id of requested || part) {
    const result = await page.evaluate(async id => {
      const THREE = await import('three');
      toGarage(); buildTrack(id); setup.laps=3; await startRace(0);
      const T = getActiveTrack();
      let roundtrip = 0, minRadius = Infinity, maxGrade = 0, protrusion = 0, finite = true, riverClear = true;
      let leftTurns = 0, rightTurns = 0;
      for (let s = 0; s < T.TOTAL; s++) {
        const a = T.pointAt(s - 1), b = T.pointAt(s), c = T.pointAt(s + 1);
        const q = T.paramOf(b.x, b.y,T.heightAtS(s)), delta = Math.abs(s - q);
        roundtrip = Math.max(roundtrip, Math.min(delta, T.TOTAL - delta));
        const turn = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
        minRadius = Math.min(minRadius, 1 / Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))));
        const signedTurn = Math.atan2(Math.sin(turn),Math.cos(turn));
        if(signedTurn>0.01) leftTurns++;
        if(signedTurn<-0.01) rightTurns++;
        maxGrade = Math.max(maxGrade, Math.abs(T.heightAtS(s + 0.5) - T.heightAtS(s - 0.5)));
        if (T.def.elevation || T.def.layered) {
          const h = Math.atan2(c.x - b.x, c.y - b.y);
          for (const off of [-T.HW + 1, 0, T.HW - 1]) {
            const x = b.x - Math.cos(h) * off, z = b.y + Math.sin(h) * off;
            protrusion = Math.max(protrusion, T.terrainAt(x, z) - T.surfaceAt(x, z,T.heightAtS(s)));
          }
        }
      }
      // The distance raster must find the same road as the exhaustive scan.
      // Equidistant branches may differ, so compare distances, not progress.
      let rasterGap = 0;
      for (let s = 0; s < T.TOTAL; s += 2) {
        const a = T.pointAt(s), b = T.pointAt(s + 0.5), h = Math.atan2(b.x - a.x, b.y - a.y);
        for (const off of [-T.HW - 6, -T.HW, 0, T.HW, T.HW + 6]) {
          const x = a.x - Math.cos(h) * off, z = a.y + Math.sin(h) * off, y = T.heightAtS(s);
          rasterGap = Math.max(rasterGap, T.nearest(x, z, y).d - T.nearestScan(x, z, y).d);
        }
      }
      T.group.updateMatrixWorld(true);
      const stripe=T.group.getObjectByName('finish-stripe');
      const start=T.pointAt(T.LINE), ahead=T.pointAt(T.LINE+0.5);
      const tangent=new THREE.Vector2(ahead.x-start.x,ahead.y-start.y).normalize();
      let along=0,across=0;
      const sp=stripe.geometry.attributes.position;
      for(let i=0;i<sp.count;i++) {
        const x=sp.getX(i)-start.x,z=sp.getZ(i)-start.y;
        along=Math.max(along,Math.abs(x*tangent.x+z*tangent.y));
        across=Math.max(across,Math.abs(-x*tangent.y+z*tangent.x));
      }
      const finishAligned=along<1.6 && Math.abs(across-T.HW)<0.15 && stripe.geometry.attributes.normal.getY(0)>0.9;
      const decor=[];
      // The ocean shader discards land-covered fragments via its depth map.
      // A CPU ray still hits that invisible global plane over a dry tunnel.
      for(const name of ['track-environment','track-scenery']) T.group.getObjectByName(name)?.traverse(o=>{if(o.isMesh&&o.name!=='coastal-water')decor.push(o);});
      const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,2.9);
      const obstacles=[];
      for(let i=0;i<160;i++) {
        const s=T.TOTAL*i/160,a=T.pointAt(s),b=T.pointAt(s+0.5),h=Math.atan2(b.x-a.x,b.y-a.y);
        for(const off of [-6,0,6]) {
          const x=a.x-Math.cos(h)*off,z=a.y+Math.sin(h)*off,y=T.groundAt(x,z,T.heightAtS(s));
          ray.ray.origin.set(x,y+3.2,z);
          const hit=ray.intersectObjects(decor,false)[0];
          if(hit) obstacles.push({s,off,height:hit.point.y-y});
        }
      }
      T.group.traverse(o => {
        if (o.geometry?.attributes.position) for (const v of o.geometry.attributes.position.array) if (!Number.isFinite(v)) finite = false;
        if (o.name === 'island-river' || o.name === 'llanos-cano') {
          const pos = o.geometry.attributes.position, p = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            if(o.geometry.attributes.waterDepth?.getX(i)<=.015)continue;
            p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            if (Math.abs(T.offsetOf(p.x, p.z)) < T.HW && p.y > T.surfaceAt(p.x, p.z) - 0.1) riverClear = false;
          }
        }
      });
      const startHeights = race.cars.every(c => Math.abs(c.y - T.groundAt(c.x, c.z,c.y)) < 0.001);
      // Exercise every row explicitly, including the elevated island boxes.
      // Racing alone is nondeterministic: opponents can collect a whole row.
      const c = race.player;
      const grid = { x: c.x, y: c.y, z: c.z };
      const itemRows = race.items.boxes.every(b => {
        race.items.clear(); c.inventory = [null, null]; c.selected = 0;
        Object.assign(c, { x: b.x, y: T.groundAt(b.x, b.z,b.y), z: b.z });
        race.items.update(1 / 60, [c], true);
        // The pickup anchor stays on the road; the visual now bobs by up to 6 cm.
        const grounded = Math.abs(b.y - T.groundAt(b.x, b.z,b.y)) < 0.001;
        return c.inventory.some(Boolean) && grounded && Math.abs(b.m.position.y - (b.y + 0.86)) <= 0.061;
      });
      Object.assign(c, grid); c.inventory = [null, null]; race.items.clear();
      let pickups = 0, maxGroundError = 0;
      const maxFrames=Math.max(24000,Math.ceil(T.TOTAL*3/20*60));
      for (let i = 0; i < maxFrames && race.state !== 'end'; i++) {
        updateRace(1 / 60);
        const c = race.player;
        if (c.inventory.some(Boolean)) pickups++;
        if (c.onGround) maxGroundError = Math.max(maxGroundError, Math.abs(c.y - T.groundAt(c.x, c.z,c.y)));
      }
      return { id, length: T.TOTAL, roundtrip, minRadius, maxGrade, protrusion, finite, startHeights,
        pickups, itemRows, riverClear, maxGroundError, rasterGap, finishAligned, leftTurns, rightTurns, obstacles,
        state: race.state, lap: race.player.lap, seconds: race.clock };
    }, id);
    assert.equal(result.finite, true, `${id}: finite scenery geometry`);
    assert.equal(result.startHeights, true, `${id}: grounded starting grid`);
    assert.ok(result.length > (id==='bululu'?2000:1000), `${id}: a full-length circuit`);
    assert.ok(result.leftTurns>5 && result.rightTurns>5, `${id}: bends in both directions`);
    assert.ok(result.finishAligned, `${id}: finish stripe spans across the road`);
    assert.deepEqual(result.obstacles, [], `${id}: scenery stays outside driving lanes`);
    assert.ok(result.roundtrip < 0.01, `${id}: continuous route projection`);
    assert.ok(result.rasterGap < 0.05, `${id}: raster lookup matches the scan (${result.rasterGap})`);
    assert.ok(result.minRadius > 15, `${id}: safe corner radius ${result.minRadius}`);
    assert.ok(result.maxGrade < 0.4, `${id}: drivable grade`);
    assert.ok(result.protrusion < 0.1, `${id}: no terrain through the road`);
    assert.ok(result.riverClear, `${id}: river flows below the driving corridor`);
    assert.equal(result.state, 'end', `${id}: AI finishes the race`);
    assert.equal(result.lap, 4, `${id}: completes three full laps after the start line`);
    assert.ok(result.itemRows, `${id}: all item rows work at their ground height`);
    if (id === 'bululu' || id === 'plaza') assert.ok(result.maxGroundError < 0.2, `${id}: cars follow the slopes`);
    assert.deepEqual(errors, [], `${id}: browser errors`);
    console.log(JSON.stringify(result));
  }
  const minimap = await page.evaluate(() => {
    const map = document.querySelector('#mm').getBoundingClientRect();
    const panel = document.querySelector('.minimap').getBoundingClientRect();
    return map.x >= panel.x && map.right <= panel.right && map.y >= panel.y && map.bottom <= panel.bottom;
  });
  assert.equal(minimap, true, 'minimap stays inside its map panel');
  console.log(requested ? `Requested maps passed: ${requested.join(', ')}` : 'All registered maps and repeated switches passed.');
} finally {
  await browser.close();
}
