import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const config = {
  host: process.env.PANA_HOST || '0.0.0.0',
  port: Number(process.env.PANA_PORT) || 8461,
  maxPlayersPerRoom: 8,
  roomCodeMaxLength: 24,
  playerNameMaxLength: 16,
  paths: {
    root: rootDir,
    web: path.join(rootDir, 'web'),
    games: path.join(rootDir, 'games'),
    engine: path.join(rootDir, 'engine'),
  },
};
