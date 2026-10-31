// Where `npm run perf -- carreritas` measures: an autopilot race on each map,
// from the start grid on (scripts/perf.js).
export default {
  query: 'debug&auto',
  views: ['llanos', 'delta', 'galipan'],
  async enter(page, id) {
    await page.waitForFunction(() => window.garage?.car, null, { timeout: 180_000 });
    await page.evaluate(async id => { toGarage(); setup.mode = 'race'; buildTrack(id); await startRace(0); }, id);
    await page.waitForFunction(() => race.state === 'go', null, { timeout: 180_000 });
  },
};
