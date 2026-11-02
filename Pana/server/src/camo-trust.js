// Which Pepazo camos a connection owns, as the pana.sh gateway vouches for it.
//
// The gateway's socket proxy adds two upstream headers (and strips any a client
// sent): `x-pana-camos`, the owned ids comma-separated, and `x-pana-camos-sig`,
// the lowercase hex HMAC-SHA256 of that exact header value with the shared secret
// PANA_GATEWAY_SECRET. Only a valid signature makes the ids count; without the
// secret, a signature, or with a wrong one, a connection owns nothing beyond the
// solid camos every kit may wear (the game adds those: armory-data.js ownsCamo).
//
// Mid-session refresh (a camo bought or unlocked after the socket opened): the
// gateway also signs an opaque account handle at connect, `x-pana-sub` with
// `x-pana-sub-sig` = HMAC(secret, "pana-sub:v1|" + sub). The room hands the client a
// one-use nonce; the client asks pana.sh (window.PanaSh.camosSigned(nonce)) for
// { ids, nonce, exp, sig } where sig = HMAC(secret, refreshMessage(sub, nonce, exp, ids)),
// and forwards it. verifyRefresh only accepts it for the same account, the nonce
// this connection was given, and an expiry no more than two minutes ahead, so a
// signed answer can neither be replayed nor handed to another player.
//
// PANA_UNLOCK_ALL_CAMOS=1 treats every camo as owned: for local screenshots and
// tests only, never on a public server.
import crypto from 'node:crypto';
import { PAINT_CAMO_IDS } from '../../engine/models/props/paint-arsenal.js';

const KNOWN = new Set(PAINT_CAMO_IDS);
// A header value longer than every id together is not one the gateway made.
const MAX_HEADER = 1024;
// The connect header is ids and commas only, so a refresh message (with '|') never parses as one.
const ID_LIST = /^[a-z0-9,\s-]*$/;
// How far ahead a refresh's expiry may be, and how long a nonce stays valid (ms).
export const REFRESH_WINDOW = 120000;

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
  if (!secret || !value || !sig || value.length > MAX_HEADER || !ID_LIST.test(value)) return new Set();
  if (!sameDigest(signCamos(value, secret), sig)) return new Set();
  return idSet(value);
}

const idSet = value => new Set(value.split(',').map(id => id.trim()).filter(id => KNOWN.has(id)));

// The signed account handle of this connection ('' when none or not vouched for).
export function parseSub(headers, env = process.env) {
  const secret = env.PANA_GATEWAY_SECRET || '';
  const sub = read(headers, 'x-pana-sub').trim(), sig = read(headers, 'x-pana-sub-sig').trim().toLowerCase();
  if (!secret || !/^[A-Za-z0-9_-]{8,128}$/.test(sub) || !sameDigest(signCamos(`pana-sub:v1|${sub}`, secret), sig)) return '';
  return sub;
}

// The exact string pana.sh signs for a refresh (ids: the comma-separated owned ids).
export const refreshMessage = (sub, nonce, exp, ids) => `pepazo-camos-refresh:v1|${sub}|${nonce}|${exp}|${ids}`;

// A one-use challenge for a connection's next refresh.
export const newNonce = () => crypto.randomBytes(16).toString('hex');

// The owned ids a refresh vouches for, or null when it does not hold.
// data: what the client forwarded ({ ids, nonce, exp, sig }); expect: { sub, nonce, issuedAt }.
export function verifyRefresh(data, { sub = '', nonce = '', issuedAt = 0 } = {}, now = Date.now(), env = process.env) {
  if (env.PANA_UNLOCK_ALL_CAMOS === '1') return new Set(KNOWN);
  const secret = env.PANA_GATEWAY_SECRET || '';
  if (!secret || !sub || !nonce || !data || typeof data !== 'object') return null;
  const { ids, exp, sig } = data;
  if (typeof ids !== 'string' || ids.length > MAX_HEADER || !ID_LIST.test(ids)) return null;
  if (data.nonce !== nonce || now - issuedAt > REFRESH_WINDOW) return null;
  if (!Number.isSafeInteger(exp) || exp < now || exp > now + REFRESH_WINDOW) return null;
  if (typeof sig !== 'string' || !sameDigest(signCamos(refreshMessage(sub, nonce, exp, ids), secret), sig.trim().toLowerCase())) return null;
  return idSet(ids);
}
