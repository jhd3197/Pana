// The last quarter and repeated builds; assertions live in maps.browser.js.
process.env.PANA_MAP_TEST_PART = '4';
await import('./maps.browser.js');
