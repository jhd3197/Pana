// Exercise every migrated URL and decode every image, without local originals.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { launch, base } from '../../tests/browser-kit.js';
import { assetPacks } from '../../server/src/packed-assets.js';

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.route('**/asset-pack-proof', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Asset pack proof</title>' }));
  await page.goto(`${base}/asset-pack-proof`);
  let count = 0;
  for (const pack of Object.values(assetPacks)) {
    for (const entry of Object.values(pack.entries)) {
      const response = await page.request.get(`${base}${entry.url}`);
      assert.equal(response.status(), 200, entry.url);
      const data = await response.body();
      assert.equal(data.length, entry.bytes, entry.url);
      assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256, entry.url);
      if (/\.(png|jpe?g|webp|avif|gif)$/i.test(entry.url)) {
        assert.match(response.headers()['content-type'], /^image\//);
        const dimensions = await page.evaluate(async url => {
          const image = new Image(); image.src = url; await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        }, entry.url);
        assert.ok(dimensions.every(size => size > 0), entry.url);
      }
      if (/\.(mp3|ogg|wav)$/i.test(entry.url)) {
        assert.match(response.headers()['content-type'], /^audio\//);
        const duration = await page.evaluate(async url => {
          const context = new AudioContext();
          try { const data = await (await fetch(url)).arrayBuffer(); return (await context.decodeAudioData(data)).duration; }
          finally { await context.close(); }
        }, entry.url);
        assert.ok(duration > 0, entry.url);
      }
      const cached = await page.request.get(`${base}${entry.url}`, { headers: { 'If-None-Match': response.headers().etag } });
      assert.equal(cached.status(), 304, 'normal HTTP caching survives packing');
      count++;
    }
  }
  for (const url of ['/engine/icons.js', '/api/games', '/g/qqsmp/game.js']) assert.equal((await page.request.get(`${base}${url}`)).status(), 200);
  assert.equal((await page.request.get(`${base}/images/not-packed.jpg`)).status(), 404);
  console.log(`PASS asset packs: ${count} original URLs match their hashes, decode and return 304.`);
} finally { await browser.close(); }
