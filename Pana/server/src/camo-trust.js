// Which Pepazo camos a connection owns, as the pana.sh gateway vouches for it.
//
// The gateway's socket proxy adds two upstream headers (and strips any a client
// sent): `x-pana-camos`, the owned ids comma-separated, and `x-pana-camos-sig`,
// the lowercase hex HMAC-SHA256 of that exact header value with the shared secret
// PANA_GATEWAY_SECRET. Only a valid signature makes the ids count; without the
// secret, a signature, or with a wrong one, a connection owns nothing beyond the
// solid camos every kit may wear (the game adds those: armory-data.js ownsCamo).
//
// PANA_UNLOCK_ALL_CAMOS=1 treats every camo as owned: for local screenshots and
// tests only, never on a public server.
import crypto from 'node:crypto';
import { PAINT_CAMO_IDS } from '../../engine/play/paint-arsenal.js';

const KNOWN = new Set(PAINT_CAMO_IDS);
// A header value longer than every id together is not one the gateway made.
const MAX_HEADER = 1024;

// headers: a Headers object (Colyseus' auth context) or a plain Node headers map.
const read = (headers, name) => {
  if (!headers) return '';
  const value = typeof headers.get === 'function' ? headers.get(name) : headers[name];
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
};

export const signCamos = (value, secret) => crypto.createHmac('sha256', secret).update(value, 'utf8').digest('hex');

// Compares two hex digests without leaking where they differ.
function sameDigest(a, b) {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

// The verified owned camo ids as a Set (empty when nothing is vouched for).
// Unknown ids in a signed list are dropped, so a newer gateway never breaks a room.
export function parseOwned(headers, env = process.env) {
  if (env.PANA_UNLOCK_ALL_CAMOS === '1') return new Set(KNOWN);
  const secret = env.PANA_GATEWAY_SECRET || '';
  const value = read(headers, 'x-pana-camos'), sig = read(headers, 'x-pana-camos-sig').trim().toLowerCase();
  if (!secret || !value || !sig || value.length > MAX_HEADER) return new Set();
  if (!sameDigest(signCamos(value, secret), sig)) return new Set();
  return new Set(value.split(',').map(id => id.trim()).filter(id => KNOWN.has(id)));
}
