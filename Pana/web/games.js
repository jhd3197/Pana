// What the hub shows for a game, from its /api/games entry (game.json).
// Pure, so tests/conventions.test.js can check it against every game.json.
import { playUrl } from '/engine/invite.js';

// A game with players: 1 has no rooms: no "Crear sala", no ?room= in its links.
export const isOnline = (game) => game.players > 1;

export const meta = (game) => isOnline(game) ? `hasta ${game.players} panas` : 'tú vs la máquina';

// The link that starts a game: a fresh room for online games, the plain page otherwise.
export const gameUrl = (game, room, name) => isOnline(game) ? playUrl(game.url, room, name) : game.url;
