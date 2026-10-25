import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createPackInstaller, unpack } from '../src/asset-pack.js';
import { assetPacks, servePackedAsset } from '../src/packed-assets.js';

const digest = data => createHash('sha256').update(data).digest('hex');
function fixture(name = 'games/demo/public/images/picture.webp') {
  const body = Buffer.from('image bytes'), header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(body.length, 22); header.writeUInt16LE(name.length, 26);
  const data = Buffer.concat([header, Buffer.from(name), body]);
  const pack = { bytes: data.length, files: 1, sha256: digest(data), entries: { [name]: { bytes: body.length, sha256: digest(body) } } };
  return { name, body, data, pack, names: new Set([name]) };
}

test('nested assets extract only after archive and file verification; caches work offline and repair truncation', async () => {
  const f = fixture(), root = await fs.mkdtemp(path.join(os.tmpdir(), 'pana-assets-test-'));
  const installer = createPackInstaller(f.pack, f.names, root);
  let downloads = 0;
  const download = async () => { downloads++; return new Response(f.data); };
  try {
    const dir = await installer.install({ download });
    assert.deepEqual(await fs.readFile(path.join(dir, f.name)), f.body);
    await installer.install({ download: () => { throw new Error('offline'); } });
    assert.equal(downloads, 1);
    await fs.writeFile(path.join(dir, f.name), 'bad');
    await installer.install({ download });
    assert.equal(downloads, 2);
    assert.deepEqual(await fs.readFile(path.join(dir, f.name)), f.body);
    assert.equal(await installer.directory('../outside'), null);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('damaged, oversized and unavailable packs publish no cache', async () => {
  const f = fixture(), root = await fs.mkdtemp(path.join(os.tmpdir(), 'pana-assets-test-'));
  try {
    const installer = createPackInstaller(f.pack, f.names, root);
    await assert.rejects(installer.install({ download: async () => new Response('error', { status: 503 }) }), /503/);
    await assert.rejects(installer.install({ download: async () => new Response(Buffer.alloc(f.data.length + 1)) }), /size/);
    await assert.rejects(installer.install({ download: async () => new Response(Buffer.alloc(f.data.length)) }), /checksum/);
    const bad = structuredClone(f.pack); bad.entries[f.name].sha256 = '0'.repeat(64);
    await assert.rejects(createPackInstaller(bad, f.names, root).install({ download: async () => new Response(f.data) }), /entry checksum/);
    assert.deepEqual(await fs.readdir(root), []);
    for (const name of ['../escape', '/absolute', 'C:/drive', 'a/../escape', 'a\\escape']) {
      const unsafe = fixture(name);
      assert.throws(() => unpack(unsafe.data, unsafe.pack, unsafe.names), /entry/);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('concurrent requests share a download and failed downloads can be retried', async () => {
  const f = fixture(), root = await fs.mkdtemp(path.join(os.tmpdir(), 'pana-assets-test-'));
  let calls = 0;
  const server = http.createServer((req, res) => { calls++; res.writeHead(calls === 1 ? 503 : 200).end(f.data); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  f.pack.url = `http://127.0.0.1:${server.address().port}/pack.zip`;
  try {
    const installer = createPackInstaller(f.pack, f.names, root);
    await assert.rejects(installer.directory(f.name), /503/);
    const dirs = await Promise.all(Array.from({ length: 8 }, () => installer.directory(f.name)));
    assert.equal(calls, 2); assert.equal(new Set(dirs).size, 1);
  } finally { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); }
});

test('the catalog preserves exact URLs, separates game packs, and excludes small icons', () => {
  const urls = new Set();
  for (const [id, pack] of Object.entries(assetPacks)) {
    assert.match(pack.url, /^https:\/\/github.com\/jhd3197\/Pana\/releases\/download\/asset-packs\//);
    assert.equal(pack.files, Object.keys(pack.entries).length);
    assert.match(pack.sha256, /^[a-f0-9]{64}$/);
    for (const [name, entry] of Object.entries(pack.entries)) {
      assert.ok(entry.bytes > 0 && (/\.(mp3|ogg|wav)$/i.test(name) || entry.bytes >= 100 * 1024)); assert.ok(!/\.svg$|\/icons\//.test(name));
      assert.ok(!urls.has(entry.url)); urls.add(entry.url);
      assert.match(entry.sha256, /^[a-f0-9]{64}$/);
      if (name.startsWith('games/')) assert.ok(name.startsWith(`games/${id}/public/`));
      const expected = name.startsWith('web/') ? '/' + name.slice(4) : name.startsWith('engine/') ? '/' + name : name.replace(/^games\/([^/]+)\/public\//, '/g/$1/');
      assert.equal(entry.url, expected);
    }
  }
  for (const url of ['/engine/icons.js', '/api/games', '/g/qqsmp/game.js', '/images/not-packed.jpg']) assert.equal(servePackedAsset({}, url), false);
});
