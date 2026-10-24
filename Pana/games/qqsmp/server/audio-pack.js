import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createPackInstaller, unpack as unpackArchive } from '../../../server/src/asset-pack.js';

export const pack = JSON.parse(await fs.readFile(new URL('../public/audio/pack.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await fs.readFile(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
const names = new Set(Object.keys(manifest.lines).map(key => `${key}.mp3`));
const root = path.resolve(process.env.PANA_VOICE_CACHE || path.join(process.env.DATA_ROOT || os.tmpdir(), 'pana-voice-packs'));
const installer = createPackInstaller(pack, names, root);
export const unpack = (data, metadata = pack, expected = names) => {
  if (![...expected].every(name => /^[a-f0-9]{8}\.mp3$/.test(name))) throw new Error('Invalid voice pack entry');
  return unpackArchive(data, metadata, expected);
};
export const installPack = installer.install;
export const audioDirectory = installer.directory;
