// A throwaway Pana server for scripts: a free loopback port, PANA_DEBUG_ROOMS
// on, output to a log file, killed with the script. Pass a base URL to reuse
// a running server instead (it must answer /api/health).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = probe.address(); probe.close(() => resolve(port));
  });
});

export async function healthy(base) {
  try { return (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

// Resolves { base, log, stop }. stop() is also registered for process exit.
export async function startServer(reuse = process.env.PANA_TEST_URL) {
  if (reuse) {
    if (!(await healthy(reuse))) throw new Error(`${reuse} does not answer /api/health`);
    return { base: reuse, log: null, stop() {} };
  }
  const port = await freePort(), base = `http://localhost:${port}`;
  const log = path.join(os.tmpdir(), `pana-script-server-${port}.log`), out = fs.openSync(log, 'w');
  const server = spawn(process.execPath, ['server/src/index.js'], { cwd: app,
    env: { ...process.env, PANA_PORT: String(port), PANA_HOST: '127.0.0.1', PANA_DEBUG_ROOMS: '1' }, stdio: ['ignore', out, out] });
  const stop = () => killTree(server);
  process.on('exit', stop);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stop(); process.exit(130); });
  for (let i = 0; i < 75 && server.exitCode === null && !(await healthy(base)); i++) await new Promise(r => setTimeout(r, 200));
  if (!(await healthy(base))) { stop(); throw new Error(`Pana did not start on ${base}:\n${fs.readFileSync(log, 'utf8').trim()}`); }
  return { base, log, stop };
}
