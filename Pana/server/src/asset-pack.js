// Shared verified ZIP_STORED installer for image/texture and narration packs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const safeName = name => /^[a-zA-Z0-9_./-]+$/.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..');
export function unpack(data, metadata, expected) {
  if (data.length !== metadata.bytes || createHash('sha256').update(data).digest('hex') !== metadata.sha256) throw new Error('Asset pack checksum mismatch');
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= data.length && data.readUInt32LE(offset) === 0x04034b50) {
    const flags = data.readUInt16LE(offset + 6), method = data.readUInt16LE(offset + 8);
    const size = data.readUInt32LE(offset + 18), rawSize = data.readUInt32LE(offset + 22);
    const length = data.readUInt16LE(offset + 26), extra = data.readUInt16LE(offset + 28);
    const start = offset + 30 + length + extra, end = start + size;
    const name = data.subarray(offset + 30, offset + 30 + length).toString('utf8');
    if (flags !== 0 || method !== 0 || size !== rawSize || end > data.length || !safeName(name) ||
        !expected.has(name) || entries.has(name)) throw new Error('Invalid asset pack entry');
    entries.set(name, data.subarray(start, end));
    offset = end;
  }
  if (entries.size !== expected.size || entries.size !== metadata.files) throw new Error('Incomplete asset pack');
  return entries;
}

export function createPackInstaller(pack, names, root) {
  if (!/^[a-f0-9]{64}$/.test(pack.sha256) || ![...names].every(safeName)) throw new Error('Invalid asset pack manifest');
  let installing;
  async function install({ cacheRoot = root, download = () => fetch(pack.url, { signal: AbortSignal.timeout(30_000) }) } = {}) {
    const target = path.join(cacheRoot, pack.sha256);
    const complete = async () => {
      try {
        await Promise.all([...names].map(async name => {
          const stat = await fs.stat(path.join(target, name));
          if (!stat.isFile() || (pack.entries?.[name] && stat.size !== pack.entries[name].bytes)) throw new Error('Incomplete cache');
        }));
        return true;
      } catch { return false; }
    };
    if (await complete()) return target;
    const response = await download();
    if (!response.ok) throw new Error(`Asset pack download failed: ${response.status}`);
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > pack.bytes) throw new Error('Asset pack exceeds expected size');
      chunks.push(chunk);
    }
    const entries = unpack(Buffer.concat(chunks), pack, names);
    for (const [name, data] of entries) {
      const entry = pack.entries?.[name];
      if (entry && (entry.bytes !== data.length || entry.sha256 !== createHash('sha256').update(data).digest('hex'))) throw new Error('Asset entry checksum mismatch');
    }
    await fs.mkdir(cacheRoot, { recursive: true });
    const staging = await fs.mkdtemp(path.join(cacheRoot, '.pack-'));
    try {
      await Promise.all([...entries].map(async ([name, data]) => {
        const file = path.join(staging, name);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, data);
      }));
      if (!(await complete())) {
        try { await fs.rename(staging, target); }
        catch (error) {
          if (!(await complete())) {
            if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
            await fs.rm(target, { recursive: true, force: true });
            await fs.rename(staging, target);
          }
        }
      }
    } finally { await fs.rm(staging, { recursive: true, force: true }); }
    return target;
  }
  async function directory(name) {
    if (!names.has(name)) return null;
    installing ??= install().catch(error => { installing = null; throw error; });
    return installing;
  }
  return { install, directory };
}
