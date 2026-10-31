import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unpack, installPack, audioDirectory, pack } from '../server/audio-pack.js';

function archive(names) {
  const data = Buffer.concat(names.map(name => {
    const header = Buffer.alloc(30), payload = Buffer.from('recording');
    header.writeUInt32LE(0x04034b50); header.writeUInt32LE(payload.length, 18);
    header.writeUInt32LE(payload.length, 22); header.writeUInt16LE(Buffer.byteLength(name), 26);
    return Buffer.concat([header, Buffer.from(name), payload]);
  }));
  return [data, { bytes: data.length, files: names.length, sha256: createHash('sha256').update(data).digest('hex') }];
}

test('the voice pack verifies its checksum before extracting expected flat files', () => {
  const [data, metadata] = archive(['1234abcd.mp3']);
  assert.equal(unpack(data, metadata, new Set(['1234abcd.mp3'])).get('1234abcd.mp3').toString(), 'recording');
  const corrupt = Buffer.from(data); corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => unpack(corrupt, metadata), /checksum/);
  assert.throws(() => unpack(data.subarray(1), metadata), /checksum/);
  assert.throws(() => unpack(data, metadata, new Set(['87654321.mp3'])), /entry/);
  assert.throws(() => unpack(data, metadata, new Set(['1234abcd.mp3', '87654321.mp3'])), /Incomplete/);
});

test('unsafe and duplicate archive names are refused even with a matching checksum', () => {
  for (const name of ['../escape.mp3', '/escape.mp3', 'sub/file.mp3']) {
    const [data, metadata] = archive([name]);
    assert.throws(() => unpack(data, metadata, new Set([name])), /entry/);
  }
  const [data, metadata] = archive(['1234abcd.mp3', '1234abcd.mp3']);
  assert.throws(() => unpack(data, metadata, new Set(['1234abcd.mp3'])), /entry/);
});

test('unknown audio names never trigger an installation', async () => {
  assert.equal(await audioDirectory('../outside.mp3'), null);
  assert.equal(await audioDirectory('00000000.mp3'), null);
});

test('an installed pack works offline; failed downloads leave no partial installation', async () => {
  const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pana-voice-test-'));
  try {
    const target = path.join(cacheRoot, pack.sha256);
    await assert.rejects(installPack({ cacheRoot, download: async () => ({ ok: false, status: 503 }) }), /503/);
    assert.deepEqual(await fs.readdir(cacheRoot), []);
    const manifest = JSON.parse(await fs.readFile(new URL('../public/audio/manifest.json', import.meta.url)));
    await fs.mkdir(target);
    await Promise.all(Object.keys(manifest.lines).map(key => fs.writeFile(path.join(target, `${key}.mp3`), 'cached')));
    assert.equal(await installPack({ cacheRoot, download: () => { throw new Error('must not download'); } }), target);
  } finally { await fs.rm(cacheRoot, { recursive: true, force: true }); }
});
