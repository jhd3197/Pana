// JSON API. Everything under /api/ lands here.

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// A directory under games/ counts as a game when it has public/index.html.
// Optional games/<id>/game.json provides display metadata (name, description,
// players, color, and tileName: a short name for the hub's small card).
// With a language other than Spanish the description comes from the game's
// public/locales/<lang>.json when it is translated there (docs/knowledge/pana-i18n.md).
export function listGames(lang = 'es') {
  const games = [];
  let entries = [];
  try {
    entries = fs.readdirSync(config.paths.games, { withFileTypes: true });
  } catch {
    return games;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(config.paths.games, entry.name);
    if (!fs.existsSync(path.join(dir, 'public', 'index.html'))) continue;
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
    } catch { /* metadata optional */ }
    let description = meta.description || '';
    if (lang !== 'es' && description) {
      try { description = JSON.parse(fs.readFileSync(path.join(dir, 'public', 'locales', `${lang}.json`), 'utf8'))[description] || description; } catch { /* untranslated: Spanish */ }
    }
    games.push({
      id: entry.name,
      name: meta.name || entry.name,
      tileName: typeof meta.tileName === 'string' && meta.tileName ? meta.tileName : null,
      description,
      players: meta.players || config.maxPlayersPerRoom,
      color: meta.color || null,
      // optional public/card.js draws live art on the hub's game tile
      card: fs.existsSync(path.join(dir, 'public', 'card.js')),
      url: `/g/${entry.name}/`,
    });
  }
  return games;
}

export async function handleApi(req, res, pathname, startedAt, colyseus) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'method not allowed' });
  }
  switch (pathname) {
    case '/api/health':
      return sendJson(res, 200, { ok: true, uptime: Math.round((Date.now() - startedAt) / 1000) });
    case '/api/games': {
      const lang = new URL(req.url, 'http://pana').searchParams.get('lang');
      return sendJson(res, 200, { games: listGames(/^[a-z]{2}$/.test(lang || '') ? lang : 'es') });
    }
    case '/api/rooms':
      return sendJson(res, 200, { rooms: await colyseus.snapshot().catch(() => []) });
    default:
      return sendJson(res, 404, { error: 'not found' });
  }
}
