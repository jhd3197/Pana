// A shot follows the look through a real room: what one client aims is what the other
// client sees fly and land, up, down and level; Ver la cancha still shoots level.
// PANA_AIM_SHOTS=<folder> also saves the marks on a wall and the ground from first person.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const room = `aim-${Date.now()}`, browser = await launch(), folder = process.env.PANA_AIM_SHOTS;
const playing = () => { const s = pinturaDebug.room.state; return s.phase === 'playing' && !s.loading && !(s.countdown > 0); };
const setLook = (page, pitch) => page.evaluate(p => pinturaDebug.world.look(0, p - pinturaDebug.world.pitch), pitch);
// Holds the trigger until the watcher's snapshot says the owner's newest shot left at `pitch`
// (the look takes a moment to reach the room). Its ball or, when cover took it in the tick it
// left, its mark says the line it really flew.
async function firedShot(shooter, watcher, owner, pitch) {
  await shooter.keyboard.down('Enter');
  const shot = await (await waitFor(watcher, ({ owner, pitch, seen }) => {
    const s = pinturaDebug.room.state, me = s.players.find(p => p.id === owner);
    if (!(me.fired > seen.fired) || Math.abs(me.shotPitch - pitch) > 1e-6) return null;
    const ball = s.balls.filter(b => b.owner === owner).at(-1), mark = s.splats.filter(m => !m.blast && m.hy != null).at(-1);
    if (ball && !(mark?.id > ball.id)) { const flat = Math.hypot(ball.vx, ball.vz); return { ball: true, slope: ball.vy / flat, height: ball.y - ball.vy / flat * Math.hypot(ball.x - ball.x0, ball.z - ball.z0) }; }
    return mark ? { ball: false, hy: mark.hy, flown: Math.hypot(mark.x - me.x, mark.z - me.z) } : null;
  }, { owner, pitch, seen: await watcher.evaluate(owner => ({ fired: pinturaDebug.room.state.players.find(p => p.id === owner).fired }), owner) })).jsonValue();
  await shooter.keyboard.up('Enter');
  return shot;
}
// True when the shot is on the line that leaves `from` metres up at `pitch`.
const onLine = (shot, from, pitch) => shot.ball ? Math.abs(shot.slope - Math.tan(pitch)) < .01 && Math.abs(shot.height - from) < .01 : Math.abs(shot.hy - (from + Math.tan(pitch) * shot.flown)) < .1;
try {
  const a = await openGame(browser, 'pintura', { name: 'Juan', room, query: 'debug' });
  const b = await openGame(browser, 'pintura', { name: 'María', room, query: 'debug' });
  await waitFor(a, () => pinturaDebug.room.connected && pinturaDebug.room.state.players.length === 2);
  await a.evaluate(() => pinturaDebug.room.configure({ bots: 0 }));
  await waitFor(b, () => pinturaDebug.room.state.options.bots === 0);
  await a.locator('#start').click();
  await waitFor(a, playing, null, 120_000); await waitFor(b, playing, null, 120_000);
  const me = await a.evaluate(() => pinturaDebug.room.id), rival = await b.evaluate(() => pinturaDebug.room.id);

  for (const pitch of [.4, -.3, 0]) {
    await setLook(a, pitch); const shot = await firedShot(a, b, me, pitch);
    assert.ok(onLine(shot, 1.55, pitch), `pitch ${pitch}: ${JSON.stringify(shot)}`);
  }
  console.log('ok  the other client sees a shot climb, drop and fly level with the look');

  await b.locator('#menu').click(); await b.locator('#pana-tab-settings').click();
  await b.locator('.pana-settings-nav button', { hasText: 'Pepazo' }).click();
  await b.locator('#pana-opt-view').getByRole('radio', { name: 'Ver la cancha', exact: true }).click(); await b.keyboard.press('Escape');
  await waitFor(b, () => !document.body.classList.contains('first-person'));
  await b.evaluate(() => document.activeElement?.blur());
  const court = await firedShot(b, a, rival, 0);
  assert.ok(onLine(court, 1.1, 0), `Ver la cancha: ${JSON.stringify(court)}`);
  console.log('ok  Ver la cancha still shoots level at shot height');
  assert.deepEqual([...a.errors, ...b.errors], []);

  // First person, alone, in front of the tallest cover: where the paint lands on screen.
  const solo = await openGame(browser, 'pintura', { name: 'Juan', query: 'debug' });
  await waitFor(solo, () => window.pinturaDebug?.world && pinturaDebug.room.connected && window.PANA_PREPARED);
  await solo.locator('#practice').click();
  await waitFor(solo, () => pinturaDebug.room.local && pinturaDebug.room.state.phase === 'playing' && !pinturaDebug.room.state.loading && !(pinturaDebug.room.state.countdown > 0), null, 120_000);
  const wall = await solo.evaluate(async () => {
    const { coverFor, blocked, RADIUS } = await import('/g/pintura/rules.js'), { room, world } = pinturaDebug, s = room.state;
    const clear = (o, x) => { for (let d = 0; d <= 5; d += .5) if (blocked(x - d, o.z, RADIUS, s.mapId, s.variant || 0)) return false; return true; };
    const o = coverFor(s.mapId, s.variant || 0).filter(o => o.shots !== false && o.h > 2.4).sort((p, q) => q.h - p.h).find(o => clear(o, o.x - o.w / 2 - 1));
    room.game.players.forEach(p => { if (p.bot) p.shield = 99; });
    const pana = room.game.players.find(p => p.id === room.id); Object.assign(pana, { x: o.x - o.w / 2 - 5, z: o.z, shield: 0 });
    world.look(-Math.PI / 2 - world.yaw, -world.pitch);
    return { h: o.h, face: o.x - o.w / 2 };
  });
  const mark = async (pitch, name) => {
    const seen = await solo.evaluate(() => Math.max(0, ...pinturaDebug.room.state.splats.map(s => s.id)));
    await setLook(solo, pitch); await solo.keyboard.down('Enter');
    const s = await (await waitFor(solo, seen => pinturaDebug.room.state.splats.find(s => s.id > seen && !s.blast) || null, seen)).jsonValue();
    await solo.keyboard.up('Enter');
    await solo.evaluate(() => new Promise(r => { let n = 12; const f = () => --n <= 0 ? r() : requestAnimationFrame(f); f(); }));
    if (folder) await solo.screenshot({ path: path.join(folder, name) });
    return s;
  };
  const flat = await mark(0, 'aim-level.png'), high = await mark(Math.atan2(wall.h - .3 - 1.55, 5), 'aim-up.png'), low = await mark(-.45, 'aim-down.png');
  assert.ok(Math.abs(flat.hy - 1.55) < .1, `level mark at ${flat.hy}`);
  assert.ok(high.hy > flat.hy + .5, `up mark at ${high.hy}, level at ${flat.hy}`);
  assert.ok(low.hy < .01 && low.x < wall.face, `down mark at ${low.x}, ${low.hy}`);
  assert.deepEqual(solo.errors, []);
  console.log('ok  the mark lands at the height the shot was aimed');
} finally { await browser.close(); }
