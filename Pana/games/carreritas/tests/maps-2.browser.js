// The second half of maps.browser.js: the later circuits and the return trips.
// One suite for every map ran past the browser runner's 10-minute slot.
process.env.PANA_MAP_TEST_PART = '2';
await import('./maps.browser.js');
