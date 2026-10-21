// Two real clients: both prepare the 3D rueda, the host starts, the guest's
// own judge grades a call and the host scores it, misses throw the guest
// out ("¡Sal de la rueda!") and the next pana jumps in, the guest claps from
// the crowd, and both agree on the end of the rueda.
// Run: npm run test:browser -- tambor
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), room = `tambor-${Date.now()}`;
try {
  const host = await openGame(browser, 'tambor', { name: 'Ana', room, query: 'debug' });
  const guest = await openGame(browser, 'tambor', { name: 'Bruno', room, query: 'debug' });
  await waitFor(host, () => tamborDebug.room.state.players.length === 2);
  assert.equal(await host.evaluate(() => tamborDebug.world.camera.isPerspectiveCamera), true, 'the rueda is a 3D scene');
  await host.locator('[data-room-option="songs"][data-value="1"]').click();
  await host.locator('[data-room-option="misses"][data-value="2"]').evaluate(el => el.click());
  await waitFor(guest, () => tamborDebug.room.state.options.songs === 1 && tamborDebug.room.state.options.misses === 2);
  await host.locator('#start').evaluate(el => el.click());
  await waitFor(guest, () => tamborDebug.room.state.phase === 'song');
  const roles = await guest.evaluate(() => Object.fromEntries(tamborDebug.room.state.players.filter(p => !p.bot).map(p => [p.name, p.role])));
  assert.deepEqual(roles, { Ana: 'dancer', Bruno: 'dancer' }, 'the two panas dance first, bots drum');
  assert.equal(await guest.evaluate(() => tamborDebug.room.state.players.length), 8, 'bots fill the rueda');
  const quiet = value => Promise.all([host, guest].map(p => p.evaluate(v => tamborDebug.quiet(v), value)));
  await quiet(true);

  // The host holds the song clock and this check jumps it to the moment the
  // MCP announces the next call, then waits: the call comes `lead` beats ahead
  // of its hit, so the guest's judge grades it at the exact beat however slow
  // this machine is. (Holding only once the call showed up lost that race when
  // software WebGL drew the rueda at a few frames a second: the guest's clock
  // ran past the call's window first.)
  await host.evaluate(async () => { window.callPace = (await import('/g/tambor/rules.js')).callPace; });
  const nextCall = () => host.waitForFunction(() => {
    const { room, judge } = tamborDebug, game = room.game, bruno = game.players.find(p => p.name === 'Bruno');
    if (bruno.role !== 'dancer') return 'out';
    room.held = true;
    const call = game.calls.find(c => c.to === bruno.id && !c.res);
    const announce = game.nextCall - callPace(game.sabor).lead, beat = game.beatNow();
    if (!call && game.phase === 'song' && beat < announce) game.song.startAt -= (announce - beat + .02) * judge.spb * 1000;
    return call ?? false;
  }, null, { timeout: 60_000, polling: 50 }).then(h => h.jsonValue());
  const call = await nextCall();
  assert.notEqual(call, 'out', 'the guest is still dancing');
  await waitFor(guest, ({ id }) => tamborDebug.judge.mine.has(id), call);
  const grade = await guest.evaluate(({ id }) => {
    const { judge } = tamborDebug, cs = judge.mine.get(id), { move, beat, dir, len } = cs.call, spb = judge.spb, at = beat * spb;
    const key = { cadera: 'left', vuelta: 'space', panuelo: 'space', abajo: 'down', pegate: 'up', golpe: 'space' }[move];
    if (move === 'vuelta') judge.press(dir, at - .2);
    judge.press(key, at);
    if (len) judge.update((beat + len) * spb + .01);
    return cs.grade;
  }, call);
  assert.equal(grade, 'perfect', 'the guest judged their own hit');
  await waitFor(host, ({ id }) => tamborDebug.room.game.calls.find(c => c.id === id)?.res === 'perfect', call);
  assert.equal(await host.evaluate(() => tamborDebug.room.game.players.find(p => p.name === 'Bruno').stats.perfect), 1, 'the host scored the perfect call');
  await host.evaluate(() => { tamborDebug.room.held = false; });

  // Misses until ¡Sal de la rueda, Bruno! and the next in line comes in.
  for (let next = await nextCall(); next !== 'out'; next = await nextCall()) {
    await waitFor(guest, ({ id }) => tamborDebug.judge.mine.has(id), next);
    await guest.evaluate(({ id }) => { const { judge } = tamborDebug, c = judge.mine.get(id).call; judge.update((c.beat + c.len) * judge.spb + c.w + .05); }, next);
    await waitFor(host, ({ id }) => tamborDebug.room.game.calls.find(c => c.id === id)?.res !== null, next);
    await host.evaluate(() => { tamborDebug.room.held = false; });
  }
  await host.evaluate(() => { tamborDebug.room.held = false; });
  await quiet(false);
  await waitFor(guest, () => tamborDebug.room.state.events.some(e => e.kind === 'kick' && e.text.includes('Bruno')));
  await waitFor(host, () => tamborDebug.room.state.players.find(p => p.name === 'Bruno').role === 'crowd');
  await waitFor(host, () => tamborDebug.room.state.events.some(e => e.kind === 'enter'), undefined, 30_000);
  assert.equal(await guest.locator('#crowd').isVisible(), true, 'the guest now sees the crowd buttons');

  // From the crowd: a clap on the beat counts on the host.
  await guest.evaluate(() => { const { judge, room } = tamborDebug, spb = judge.spb, t = (room.clock() - room.state.song.startAt) / 1000; judge.press('space', Math.ceil(t / spb + 1) * spb); });
  await waitFor(host, () => tamborDebug.room.state.players.find(p => p.name === 'Bruno').stats.claps >= 1);
  await guest.evaluate(() => tamborDebug.room.action('dicho', { i: 0 }));
  await waitFor(host, () => tamborDebug.room.state.players.find(p => p.name === 'Bruno').dicho?.i === 0);

  // End the song now: the host owns the clock.
  await host.evaluate(() => { tamborDebug.room.game.song.startAt -= 10 * 60 * 1000; });
  await waitFor(guest, () => tamborDebug.room.state.phase === 'finished');
  assert.equal(await guest.evaluate(() => tamborDebug.room.state.winner), await host.evaluate(() => tamborDebug.room.state.winner));
  assert.ok(await guest.evaluate(() => tamborDebug.room.state.titles.length > 0), 'the results hand out titles');
  await waitFor(guest, () => !document.getElementById('results').hidden);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS tambor: two clients share a 3D rueda, the guest\'s own judge scores on the host, misses throw them out, claps count, both agree on the end.');
} finally { await browser.close(); }
