// HTTP routing: /api/* -> JSON API, /g/<game>/* -> game statics,
// /engine/* -> shared game code, /* -> hub (web/).

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { handleApi } from './api.js';
import { serveStatic } from './static.js';
import { isColyseusPath } from './colyseus.js';

function gamePublicDir(game) {
  if (!/^[a-z0-9-]+$/.test(game)) return null;
  const dir = path.join(config.paths.games, game, 'public');
  return fs.existsSync(path.join(dir, 'index.html')) ? dir : null;
}

export function createRequestHandler(startedAt, colyseus) {
  return (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (isColyseusPath(pathname) && colyseus.handle) return colyseus.handle(req, res);

    if (pathname.startsWith('/api/')) {
      return handleApi(req, res, pathname, startedAt, colyseus);
    }

    if (pathname.startsWith('/g/')) {
      const parts = pathname.slice(3).split('/').filter(Boolean);
      const game = parts.shift();
      const baseDir = game && gamePublicDir(game);
      if (!baseDir) {
        res.writeHead(404).end('unknown game');
        return;
      }
      if (game === 'qqsmp' && parts[0] === 'audio' && parts.at(-1)?.endsWith('.mp3')) {
        // Lazy and game-specific: no voice download is needed to start Pana.
        import('../../games/qqsmp/server/audio-pack.js').then(async ({ audioDirectory }) => {
          const name = parts.length === 2 ? parts[1] : '';
          const directory = await audioDirectory(name);
          if (!directory) return res.writeHead(404).end('not found');
          serveStatic(res, directory, name);
        }).catch(error => {
          console.warn('QQSMP voice pack:', error.message);
          if (!res.headersSent) res.writeHead(503, { 'Cache-Control': 'no-store', 'Retry-After': '30' }).end('voice unavailable');
          else res.destroy();
        });
        return;
      }
      return serveStatic(res, baseDir, parts.join('/') || 'index.html');
    }

    // Shared code (characters, avatars) imported by the hub and the games
    if (pathname.startsWith('/engine/')) {
      // Suites and fixtures stay on disk; only runtime code is served.
      if (/^\/engine\/tests(\/|$)/.test(pathname)) return res.writeHead(404).end('not found');
      return serveStatic(res, config.paths.engine, pathname.slice('/engine/'.length));
    }

    // Studio has addressable pages; only known UI routes receive its shell.
    if (/^\/studio(?:\/|\/library\/?|\/workspace\/?|\/assets\/[^/]+\/?)?$/.test(pathname)) {
      return serveStatic(res, config.paths.web, 'studio.html');
    }
    if (/^\/studio\/(settings|guide)\/?$/.test(pathname)) {
      return serveStatic(res, config.paths.web, `studio/${pathname.split('/')[2]}.html`);
    }

    // Mi pana, the character editor, at a plain address (the .html one still works).
    if (/^\/personaje\/?$/.test(pathname)) return serveStatic(res, config.paths.web, 'personaje.html');

    // Hub frontend
    return serveStatic(res, config.paths.web, pathname.slice(1) || 'index.html');
  };
}
