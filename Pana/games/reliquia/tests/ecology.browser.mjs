// The food chain between two real clients: the guest reads the host's numbers,
// its thicket is drawn, it hides (the guest's own `covered`), a wipe reaches its
// screen, and a new host carries on the same chain.
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
const fail = message => { throw new Error(message); };
try {
  const room = `reliquia-eco-${Date.now().toString(36)}`;
  const host = await openGame(browser, 'reliquia', { name: 'Ana', room, query: 'debug' }), guest = await openGame(browser, 'reliquia', { name: 'Beto', room, query: 'debug' });
  for (const page of [host, guest]) page.setDefaultTimeout(90_000);
  await waitFor(host, () => window.reliquia?.room.connected && window.reliquia.room.members.size === 2);
  await waitFor(guest, () => window.reliquia?.room.connected);
  await host.locator('#start').click();
  await waitFor(guest, () => window.reliquia.state.phase === 'playing' && !!window.reliquia.state.eco);

  // Down the shaft, the guest onto the first thicket. The host moves it: this is a test.
  const site = await host.evaluate(() => {
    const r = window.reliquia, L = r.room.game.layout, sites = L.run.ecoSites, s = sites.findIndex(q => q.kind === 'mushroom'), room = window.reliquia.room;
    room.game.eco.food[s] = 1; for (const q of L.run.rooms) room.game.woke[q.id] = 1;
    const [a, b] = room.game.players, spot = sites[s], roost = sites.find(q => q.kind === 'roost');
    Object.assign(b, { x: spot.x, z: spot.z, y: 0 }); Object.assign(a, { x: roost.x, z: roost.z, y: 0 }); room.publish();
    return { x: spot.x, z: spot.z, i: s };
  });
  await waitFor(guest, () => window.reliquia.me?.covered > 0);
  await waitFor(guest, () => document.body.classList.contains('in-cover'));

  // The scenery loads a moment later, and is on the guest's own screen.
  await waitFor(guest, () => window.reliquia.view.scene.getObjectByName('mushroomThicket') != null);

  // The same numbers on both screens, over the deltas.
  await waitFor(host, () => window.reliquia.room.game.eco.t > 3);
  const same = await Promise.all([host, guest].map(page => page.evaluate(() => window.reliquia.state.eco.t)));
  await waitFor(guest, t => window.reliquia.state.eco.t >= t, same[0]);

  // A wipe reaches the guest: the number and the word.
  await host.evaluate(() => window.reliquia.wipe('bat'));
  await waitFor(guest, () => window.reliquia.state.eco.counts.bat === 0);
  await waitFor(guest, () => window.reliquia.state.events.some(e => e.kind === 'eco' && e.eco === 'gone'));
  // And the guest can read it in the Tab layer.
  await guest.evaluate(() => window.reliquia.showInfo(true));
  await waitFor(guest, () => document.getElementById('life-bat')?.textContent === '0' && !document.getElementById('life').hidden);
  await guest.evaluate(() => window.reliquia.showInfo(false));

  // A new host keeps the same chain.
  const before = await guest.evaluate(() => window.reliquia.state.eco.t);
  await host.close();
  await waitFor(guest, () => window.reliquia.room.isHost);
  await waitFor(guest, t => window.reliquia.room.game.eco.t > t + 1, before);
  const counts = await guest.evaluate(() => window.reliquia.room.game.eco.counts.bat);
  if (counts !== 0) fail(`a new host brought the bats back: ${counts}`);
  console.log('ok: fosa food chain between two clients');
} finally { await browser.close(); }
