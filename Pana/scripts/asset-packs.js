// Verify published packs; --restore also fills missing local originals for editing.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { assetPacks } from '../server/src/packed-assets.js';
import { createPackInstaller } from '../server/src/asset-pack.js';

const args = process.argv.slice(2), restore = args.includes('--restore');
const ids = args.filter(arg => arg !== '--restore');
if (ids.some(id => !assetPacks[id])) throw new Error('Usage: node Pana/scripts/asset-packs.js [--restore] [pack-id ...]');
const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(process.env.PANA_ASSET_CACHE || path.join(process.env.DATA_ROOT || os.tmpdir(), 'pana-asset-packs'));
for (const id of ids.length ? ids : Object.keys(assetPacks)) {
  const pack = assetPacks[id], installer = createPackInstaller(pack, new Set(Object.keys(pack.entries)), root);
  const directory = await installer.install();
  for (const [name, entry] of Object.entries(pack.entries)) {
    const data = await fs.readFile(path.join(directory, name));
    if (data.length !== entry.bytes || createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error(`Damaged cached asset: ${name}`);
    if (restore) {
      const target = path.join(app, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      try { await fs.writeFile(target, data, { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }
  console.log(`${id}: verified ${pack.files} assets${restore ? '; missing originals restored' : ''}`);
}
