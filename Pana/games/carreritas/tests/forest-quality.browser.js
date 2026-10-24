import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const output = path.join(tmpdir(), 'pana-forest-quality');
await mkdir(output, { recursive: true });
const browser = await launch(), proof = [];
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&manual' });
  await waitFor(page, () => window.garage?.car);
  for (const id of ['chuao', 'cata', 'choroni', 'selva', 'paramo', 'galipan', 'merida', 'sabana']) {
    const result = await page.evaluate(async id => {
      const { setSettings } = await import('/engine/settings.js');
      toGarage(); buildTrack(id); await startRace(0);
      const collect = () => {
        let triangles = 0, draws = 0, unshaded = 0;
        const positions = new Set(), geometries = new Set();
        race.trackGroup.traverse(o => {
          if (!o.isInstancedMesh || !/^(coastal-|mountain-canopy-)/.test(o.name)) return;
          draws++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * o.count;
          geometries.add(o.geometry.uuid);
          if (o.geometry.attributes.natureSurface && !o.material.userData.natureDetail) unshaded++;
          const m = o.instanceMatrix.array;
          for (let i = 0; i < o.count; i++) positions.add(`${o.name}:${Array.from(m.slice(i * 16, i * 16 + 16)).join(',')}`);
        });
        return { triangles, draws, unshaded, positions: [...positions].sort(), geometries: [...geometries].sort() };
      };
      setSettings({ quality: 'alta' }); const high = collect();
      const route = getActiveTrack().TOTAL, player = [race.player.x, race.player.y, race.player.z];
      setSettings({ quality: 'media' }); const medium = collect();
      setSettings({ quality: 'baja' }); const low = collect();
      setSettings({ quality: 'alta' }); const restored = collect();
      setSettings({ quality: 'baja' }); const cached = collect();
      renderer.render(race.scene, race.camera);
      const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { id, high, medium, low,
        samePositions: JSON.stringify(high.positions) === JSON.stringify(low.positions) && JSON.stringify(high.positions) === JSON.stringify(medium.positions),
        restored: JSON.stringify(restored) === JSON.stringify(high), cached: JSON.stringify(cached) === JSON.stringify(low),
        physicsUnchanged: route === getActiveTrack().TOTAL && JSON.stringify(player) === JSON.stringify([race.player.x, race.player.y, race.player.z]),
        gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) };
    }, id);
    assert.ok(result.samePositions, `${id}: every tree retains its transform`);
    assert.ok(result.restored && result.cached, `${id}: switching quality restores and reuses tiers`);
    assert.ok(result.physicsUnchanged, `${id}: rendering settings leave physics alone`);
    assert.equal(result.low.unshaded + result.medium.unshaded, 0);
    const ratio = { chuao: .3, cata: .4, choroni: .4 }[id] ?? 1;
    assert.ok(result.low.triangles <= result.high.triangles * ratio, `${id}: forest geometry budget: ${result.low.triangles}/${result.high.triangles}`);
    assert.ok(result.low.draws <= result.high.draws, `${id}: lower submission cost`);
    assert.ok(result.medium.triangles <= result.high.triangles);
    for (const tier of ['high', 'medium', 'low']) {
      result[tier].trees = result[tier].positions.length;
      delete result[tier].positions; delete result[tier].geometries;
    }
    proof.push(result); console.log(JSON.stringify(result));
    if (id === 'chuao') for (const u of [.12, .5, .72]) {
      await page.evaluate(u => {
        const T = getActiveTrack(), p = T.pointAt(T.TOTAL * u), q = T.pointAt(T.TOTAL * u + 1);
        Object.assign(race.player, { x: p.x, z: p.y, y: T.groundAt(p.x, p.y), h: Math.atan2(q.x - p.x, q.y - p.y) });
        race.camPos = null; presentRace(1 / 60);
      }, u);
      for (const quality of ['alta', 'baja']) {
        await page.evaluate(async quality => {
          const { setSettings } = await import('/engine/settings.js'); setSettings({ quality });
          renderer.render(race.scene, race.camera);
        }, quality);
        await page.screenshot({ path: path.join(output, `chuao-${u}-${quality}.png`) });
      }
    }
  }
  const disposal = await page.evaluate(async () => {
    const { setSettings } = await import('/engine/settings.js');
    const geometry = new Set(), disposed = new Set(), instances = new Set(), released = new Set();
    for (const quality of ['alta', 'media', 'baja']) {
      setSettings({ quality });
      race.trackGroup.traverse(o => {
        if (o.isInstancedMesh && /^(coastal-|mountain-canopy-)/.test(o.name) && !instances.has(o)) {
          instances.add(o); o.addEventListener('dispose', () => released.add(o));
        }
        if (o.isInstancedMesh && /^(coastal-|mountain-canopy-)/.test(o.name) && !geometry.has(o.geometry)) {
          geometry.add(o.geometry); o.geometry.addEventListener('dispose', () => disposed.add(o.geometry));
        }
      });
    }
    toGarage(); buildTrack('estadio'); await startRace(0);
    return { allocated: geometry.size, disposed: disposed.size, instances: instances.size, released: released.size };
  });
  assert.ok(disposal.allocated > 0);
  assert.equal(disposal.disposed, disposal.allocated, 'map replacement releases inactive tiers as well as the active one');
  assert.equal(disposal.released, disposal.instances, 'instance matrix GPU buffers are also released');
  assert.deepEqual(page.errors, []);
  await writeFile(path.join(output, 'proof.json'), JSON.stringify({ proof, disposal }, null, 2));
  console.log(`PASS forest quality; driver views and measurements: ${output}`);
} finally { await browser.close(); }
