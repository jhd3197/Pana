import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPackInstaller } from './asset-pack.js';
import { serveStatic } from './static.js';

export const assetPacks = JSON.parse(fs.readFileSync(new URL('./asset-packs.json', import.meta.url), 'utf8'));
const root = path.resolve(process.env.PANA_ASSET_CACHE || path.join(process.env.DATA_ROOT || os.tmpdir(), 'pana-asset-packs'));
const routes = new Map();
for (const [id, pack] of Object.entries(assetPacks)) {
  const installer = createPackInstaller(pack, new Set(Object.keys(pack.entries)), root);
  for (const [name, entry] of Object.entries(pack.entries)) {
    if (routes.has(entry.url)) throw new Error(`Duplicate packed asset: ${entry.url}`);
    routes.set(entry.url, { id, name, installer });
  }
}

// Exact URL allowlist: scripts, icons, API and room routes remain static.
export function servePackedAsset(res, pathname) {
  const asset = routes.get(pathname);
  if (!asset) return false;
  asset.installer.directory(asset.name).then(directory => serveStatic(res, directory, asset.name)).catch(error => {
    console.warn(`Asset pack ${asset.id}:`, error.message);
    if (!res.headersSent) res.writeHead(503, { 'Cache-Control': 'no-store', 'Retry-After': '30' }).end('asset unavailable');
    else res.destroy();
  });
  return true;
}
