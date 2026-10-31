import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'qqsmp', { query: 'debug' });
  await page.locator('.pk-cover').waitFor({ state: 'detached' });
  await page.evaluate(() => { qqsmpDebug.room.step = () => false; });
  await page.locator('#start').evaluate(el => el.click());
  await waitFor(page, () => qqsmpDebug.room.state.phase === 'question');
  const proof = await page.evaluate(async () => {
    const { VARIANTS, SPECIALS } = await import('/g/qqsmp/animation-catalog.js');
    const world = qqsmpDebug.world, animations = world.animations, state = qqsmpDebug.room.state;
    const before = JSON.stringify(state), plates = world.podiums.map(s => s.plate), checked = [];
    const originalMaterials = [];
    world.podiums.forEach(s => s.character.group.traverse(o => { if (o.material) originalMaterials.push([o, o.material]); }));
    const takes = [...Object.entries(VARIANTS).flatMap(([action, variants]) => variants.map(([variant]) => [action, variant])), ...SPECIALS.map(action => [action, 'classic'])];
    for (const [action, variant] of takes) {
      for (const progress of [.05, .3, .55, .68, .85, 1]) {
        animations.reset();animations.preview(action, variant, 0, progress);animations.frame(0);
        world.scene.traverse(o => {
          if (![...o.position, ...o.scale, ...o.quaternion].every(Number.isFinite)) throw new Error(`${action}:${variant}: nonfinite ${o.name}`);
        });
      }
      checked.push(`${action}:${variant}`);
    }
    animations.preview('wrong', 'stone', 0, .8);animations.frame(0);
    animations.clearPreview();animations.reset();
    const restored = world.podiums.every(s => s.character.group.scale.distanceTo({ x: 1, y: 1, z: 1 }) < .001);
    const materialsRestored = originalMaterials.every(([mesh, material]) => mesh.material === material);
    const sparse = structuredClone(state);sparse.options.mode = 'panas';
    sparse.players.forEach(p => { p.id = p.seat === 4 ? 'only-friend' : null; });
    world.update(sparse);
    for (const action of SPECIALS) { animations.reset();animations.preview(action, 'classic', 4, .85);animations.frame(0); }
    const emptyHidden = world.podiums.every((s, seat) => s.character.group.visible === (seat === 4));
    world.update(state);animations.reset();
    return { checked, restored, materialsRestored, emptyHidden, sameState: before === JSON.stringify(state), samePlates: JSON.stringify(plates) === JSON.stringify(world.podiums.map(s => s.plate)) };
  });
  assert.equal(proof.checked.length, 37);
  assert.ok(proof.restored && proof.materialsRestored && proof.emptyHidden && proof.sameState && proof.samePlates, JSON.stringify(proof));
  // A reduced-motion preference leaves the real avatars in their normal pose.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => { qqsmpDebug.world.frame(0);return qqsmpDebug.world.animations.root.visible; }), false);
  assert.equal(await page.evaluate(() => {
    const a = qqsmpDebug.world.animations;a.dispose();a.dispose();a.frame(0);
    return a.root.parent === null && a.current === null;
  }), true, 'teardown detaches props and remains safe on repeat');
  assert.deepEqual(page.errors, []);
  console.log('PASS all 37 animation takes: finite transforms, real avatars, no score/plate mutations, cleanup and reduced motion.');
} finally { await browser.close(); }
