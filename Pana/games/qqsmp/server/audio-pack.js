// Recordings are a pinned release asset. Only this game's audio route installs
// them; an unavailable pack must never prevent the hub or a game from starting.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

export const pack = JSON.parse(await fs.readFile(new URL('../public/audio/pack.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await fs.readFile(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
const names = new Set(Object.keys(manifest.lines).map(key => `${key}.mp3`));
const root = path.resolve(process.env.PANA_VOICE_CACHE || path.join(process.env.DATA_ROOT || os.tmpdir(), 'pana-voice-packs'));
let installing;

// The producer uses ZIP_STORED, flat filenames, no encryption/data descriptors.
// Verify the entire pinned archive before interpreting or writing any entries.
export function unpack(data, metadata = pack, expected = names) {
  if (data.length !== metadata.bytes || createHash('sha256').update(data).digest('hex') !== metadata.sha256) throw new Error('Voice pack checksum mismatch');
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= data.length && data.readUInt32LE(offset) === 0x04034b50) {
    const flags = data.readUInt16LE(offset + 6), method = data.readUInt16LE(offset + 8);
    const size = data.readUInt32LE(offset + 18), rawSize = data.readUInt32LE(offset + 22);
    const length = data.readUInt16LE(offset + 26), extra = data.readUInt16LE(offset + 28);
    const start = offset + 30 + length + extra, end = start + size;
    const name = data.subarray(offset + 30, offset + 30 + length).toString('utf8');
    if (flags !== 0 || method !== 0 || size !== rawSize || end > data.length ||
        !/^[a-f0-9]{8}\.mp3$/.test(name) || !expected.has(name) || entries.has(name)) throw new Error('Invalid voice pack entry');
    entries.set(name, data.subarray(start, end));
    offset = end;
  }
  if (entries.size !== expected.size || entries.size !== metadata.files) throw new Error('Incomplete voice pack');
  return entries;
}

export async function installPack({ cacheRoot = root, download = () => fetch(pack.url, { signal: AbortSignal.timeout(20_000) }) } = {}) {
  const target = path.join(cacheRoot, pack.sha256);
  const complete = async () => {
    try { await Promise.all([...names].map(name => fs.access(path.join(target, name)))); return true; }
    catch { return false; }
  };
  if (await complete()) return target;
  const response = await download();
  if (!response.ok) throw new Error(`Voice pack download failed: ${response.status}`);
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > pack.bytes) throw new Error('Voice pack exceeds expected size');
    chunks.push(chunk);
  }
  const entries = unpack(Buffer.concat(chunks));
  await fs.mkdir(cacheRoot, { recursive: true });
  const staging = await fs.mkdtemp(path.join(cacheRoot, '.qqsmp-'));
  try {
    await Promise.all([...entries].map(([name, data]) => fs.writeFile(path.join(staging, name), data)));
    try { await fs.rename(staging, target); }
    catch (error) { if (!(await complete())) throw error; }
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
  return target;
}

export async function audioDirectory(name) {
  if (!names.has(name)) return null;
  installing ??= installPack().catch(error => { installing = null; throw error; });
  return installing;
}
