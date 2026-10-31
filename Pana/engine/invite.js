// Room codes and the links panas share. One place for both, so every game
// invites the same way: a shared link carries only ?room=<code>, never the
// sender's name, debug flags or ?lead (an invitee must not become the lead).

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';   // nothing that reads two ways

export function newRoomCode() {
  return Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}

// The ?room= code in a query string, cleaned; '' when there is none.
export function roomFromUrl(search = location.search) {
  return (new URLSearchParams(search).get('room') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
}

// The link to share for a room. path: the game's page (defaults to this one).
export function inviteUrl(code, path = location.pathname, origin = location.origin) {
  const url = new URL(path, origin);
  url.searchParams.set('room', code);
  return url.href;
}

// The hub's "play" link: the invite plus the player's name.
export function playUrl(path, code, name, origin = location.origin) {
  const url = new URL(inviteUrl(code, path, origin));
  if (name) url.searchParams.set('name', name);
  return url.pathname + url.search;
}
