// HTTP routing: /api/* -> JSON API, /g/<game>/* -> game statics,
// /engine/* -> shared game code, /* -> hub (web/).

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { handleApi } from './api.js';
import { serveStatic } from './static.js';

function gamePublicDir(game) {
  if (!/^[a-z0-9-]+$/.test(game)) return null;
  const dir = path.join(config.paths.games, game, 'public');
  return fs.existsSync(path.join(dir, 'index.html')) ? dir : null;
}

export function createRequestHandler(rooms, startedAt) {
  return (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      return handleApi(req, res, pathname, rooms, startedAt);
    }

    if (pathname.startsWith('/g/')) {
      const parts = pathname.slice(3).split('/').filter(Boolean);
      const game = parts.shift();
      const baseDir = game && gamePublicDir(game);
      if (!baseDir) {
        res.writeHead(404).end('unknown game');
        return;
      }
      return serveStatic(res, baseDir, parts.join('/') || 'index.html');
    }

    // Shared code (characters, avatars) imported by the hub and the games
    if (pathname.startsWith('/engine/')) {
      return serveStatic(res, config.paths.engine, pathname.slice('/engine/'.length));
    }

    // Hub frontend
    return serveStatic(res, config.paths.web, pathname.slice(1) || 'index.html');
  };
}
