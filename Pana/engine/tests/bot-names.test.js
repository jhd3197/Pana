import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyFriendNames, cleanFriendName, cleanJoinNames, friendNamesNow, loadFriendNames, pickFriendNames, setFriendNames, CACHE_KEY, LOCAL_KEY, MAX_FRIEND_NAMES, MAX_NAME_LENGTH } from '../bot-names.js';

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), data };
}
const realFetch = globalThis.fetch;
function page({ local, fetch, bridge, session = {} } = {}) {
  setFriendNames();
  for (const [area, store] of [['localStorage', storage(local === undefined ? {} : { [LOCAL_KEY]: local })], ['sessionStorage', storage(session)]]) {
    Object.defineProperty(globalThis, area, { value: store, configurable: true, writable: true });
  }
  globalThis.fetch = fetch || (async () => ({ ok: false, status: 404, json: async () => { throw new Error('no body'); } }));
  if (bridge) globalThis.PanaSh = bridge; else delete globalThis.PanaSh;
}
afterEach(() => {
  setFriendNames(); globalThis.fetch = realFetch; delete globalThis.PanaSh;
  delete globalThis.localStorage; delete globalThis.sessionStorage;
});
const json = (body) => async () => ({ ok: true, json: async () => body });

test('a name is cleaned: markup, control characters, length', () => {
  assert.equal(cleanFriendName('  Sofi  '), 'Sofi');
  assert.equal(cleanFriendName('<b>Mateo</b>'), 'Mateo');
  assert.equal(cleanFriendName('<img src=x onerror=alert(1)>'), '');
  assert.equal(cleanFriendName('Va\u0000le\nria‮'), 'Va le ria');
  assert.equal(Array.from(cleanFriendName('x'.repeat(200))).length, MAX_NAME_LENGTH);
  assert.equal(Array.from(cleanFriendName('😀'.repeat(40))).join(''), '😀'.repeat(MAX_NAME_LENGTH), 'never cuts a character in half');
  for (const bad of [null, undefined, 3, {}, [], { pana: 7 }]) assert.equal(cleanFriendName(bad), '');
});

test('the pana name wins, the account name is the fallback', () => {
  assert.equal(cleanFriendName({ pana: 'Coquito', name: 'Maria' }), 'Coquito');
  assert.equal(cleanFriendName({ pana: '  ', name: 'Maria' }), 'Maria');
  assert.equal(cleanFriendName({ name: 'Maria' }), 'Maria');
});

test('picking caps at three, drops repeats and panas in the room', () => {
  assert.deepEqual(pickFriendNames(['A', 'B', 'C', 'D', 'E']), ['A', 'B', 'C']);
  assert.equal(pickFriendNames(['A', 'B', 'C', 'D'], { count: 99 }).length, MAX_FRIEND_NAMES);
  assert.deepEqual(pickFriendNames(['A', 'B'], { count: 1 }), ['A']);
  assert.deepEqual(pickFriendNames(['Sofi', 'SOFI', ' sofi ', 'Mateo']), ['Sofi', 'Mateo']);
  assert.deepEqual(pickFriendNames(['Sofi', 'Mateo'], { taken: ['sofi'] }), ['Mateo']);
  assert.deepEqual(pickFriendNames(null), []);
  assert.deepEqual(pickFriendNames('Sofi'), []);
  assert.deepEqual(pickFriendNames([null, 4, {}, '<i></i>']), []);
});

test('a seed gives the same pick every time', () => {
  const list = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  assert.deepEqual(pickFriendNames(list, { seed: 9 }), pickFriendNames(list, { seed: 9 }));
  assert.equal(pickFriendNames(list, { seed: 9 }).length, 3);
});

test('a server never keeps more than three short names from a join', () => {
  const names = cleanJoinNames(Array.from({ length: 5000 }, (_, i) => `amigo-${i}-${'x'.repeat(5000)}`));
  assert.equal(names.length, MAX_FRIEND_NAMES);
  assert.ok(names.every(n => n.length <= MAX_NAME_LENGTH));
  for (const bad of [undefined, null, 'A', 7, { length: 3 }]) assert.deepEqual(cleanJoinNames(bad), []);
});

const bots = (...skills) => skills.map((skill, i) => ({ name: `Bot${i}`, skill }));
const names = (list) => list.map(b => b.name);

test('no friends: bots are untouched', () => {
  const list = bots(.1, .9);
  for (const none of [[], null, undefined, ['<b></b>']]) assert.deepEqual(names(applyFriendNames(list, none, { rankBy: b => b.skill })), ['Bot0', 'Bot1']);
});

test('only the strongest bots are renamed, the best first', () => {
  assert.deepEqual(names(applyFriendNames(bots(.1, .9, .5, .7, .3), ['A', 'B', 'C'], { rankBy: b => b.skill })), ['Bot0', 'A', 'C', 'B', 'Bot4']);
});

test('never every bot, but a lone bot still gets one', () => {
  assert.deepEqual(names(applyFriendNames(bots(.5, .6, .7), ['A', 'B', 'C'], { rankBy: b => b.skill })), ['Bot0', 'B', 'A']);
  assert.deepEqual(names(applyFriendNames(bots(.5, .6), ['A', 'B', 'C'], { rankBy: b => b.skill })), ['Bot0', 'A']);
  assert.deepEqual(names(applyFriendNames(bots(.5), ['A', 'B'])), ['A']);
});

test('no rank: seat order; a friend who is in the room is skipped', () => {
  assert.deepEqual(names(applyFriendNames(bots(0, 0, 0, 0), ['A', 'B'])), ['A', 'B', 'Bot2', 'Bot3']);
  assert.deepEqual(names(applyFriendNames(bots(0, 0, 0, 0), ['Ana', 'B'], { taken: ['ANA'] })), ['B', 'Bot1', 'Bot2', 'Bot3']);
});

test('applying twice gives the same names: a rematch keeps each seat', () => {
  const list = bots(.1, .9, .5, .7);
  const once = names(applyFriendNames(list, ['A', 'B', 'C'], { rankBy: b => b.skill }));
  assert.deepEqual(names(applyFriendNames(list, ['A', 'B', 'C'], { rankBy: b => b.skill })), once);
});

test('the gateway endpoint: only friends, the pana field first', async () => {
  let asked = null;
  page({ fetch: async (url) => { asked = url; return json({ me: { name: 'Yo' }, friends: [{ code: 'x', name: 'Maria', pana: 'Coquito', online: true }], incoming: [{ name: 'Extraño' }], outgoing: [{ name: 'Otro' }] })(); } });
  assert.deepEqual(await loadFriendNames(), ['Coquito']);
  assert.equal(asked, '/auth/friends');
  assert.deepEqual(friendNamesNow(), ['Coquito']);
});

test('window.PanaSh.friends is used when the gateway offers it', async () => {
  let fetched = false;
  page({ bridge: { friends: async () => [{ pana: 'Luz' }] }, fetch: async () => { fetched = true; return json({ friends: [] })(); } });
  assert.deepEqual(await loadFriendNames(), ['Luz']);
  assert.equal(fetched, false);
});

test('a broken bridge falls back to the endpoint', async () => {
  page({ bridge: { friends: async () => { throw new Error('nope'); } }, fetch: json({ friends: [{ name: 'Beto' }] }) });
  assert.deepEqual(await loadFriendNames(), ['Beto']);
});

test('every failure means no friends', async () => {
  const failures = {
    '404': async () => ({ ok: false, status: 404, json: async () => ({}) }),
    '401': async () => ({ ok: false, status: 401, json: async () => ({ friends: [{ name: 'X' }] }) }),
    offline: async () => { throw new TypeError('Failed to fetch'); },
    'bad JSON': async () => ({ ok: true, json: async () => { throw new SyntaxError('<html>'); } }),
    'wrong shape': json({ friends: 'many' }),
    'no friends key': json({ incoming: [{ name: 'X' }] }),
  };
  for (const [label, fetch] of Object.entries(failures)) {
    page({ fetch });
    assert.deepEqual(await loadFriendNames(), [], label);
  }
});

test('localStorage works without the gateway, and bad JSON there is ignored', async () => {
  page({ local: JSON.stringify(['Valentina', { name: 'Mateo' }, 'Sofi', 'Quinto']) });
  assert.deepEqual(friendNamesNow(), ['Valentina', 'Mateo', 'Sofi'], 'already there before any load');
  assert.deepEqual(await loadFriendNames(), ['Valentina', 'Mateo', 'Sofi']);
  page({ local: '{not json' });
  assert.deepEqual(await loadFriendNames(), []);
  page({ local: '"Sofi"' });
  assert.deepEqual(await loadFriendNames(), []);
});

test('a slow gateway never holds up the start, and still fills the cache', async () => {
  let answer;
  page({ fetch: () => new Promise((resolve) => { answer = resolve; }) });
  const started = Date.now();
  assert.deepEqual(await loadFriendNames({ timeout: 30 }), []);
  assert.ok(Date.now() - started < 500);
  answer({ ok: true, json: async () => ({ friends: [{ name: 'Tarde' }] }) });
  assert.deepEqual(await loadFriendNames({ timeout: 200 }), ['Tarde']);
  assert.deepEqual(friendNamesNow(), ['Tarde']);
  assert.ok(sessionStorage.getItem(CACHE_KEY).includes('Tarde'));
});

test('the page asks once, and a fresh session cache saves the request', async () => {
  let calls = 0;
  const fetch = async () => { calls++; return json({ friends: [{ name: 'Una' }] })(); };
  page({ fetch });
  await loadFriendNames(); await loadFriendNames();
  assert.equal(calls, 1, 'once per page');
  page({ fetch, session: { [CACHE_KEY]: JSON.stringify({ at: Date.now(), names: ['Guardada'] }) } });
  assert.deepEqual(await loadFriendNames(), ['Guardada']);
  assert.equal(calls, 1, 'the session cache answered');
  page({ fetch, session: { [CACHE_KEY]: JSON.stringify({ at: 0, names: ['Vieja'] }) } });
  assert.deepEqual(await loadFriendNames(), ['Una'], 'an old cache is read again');
  assert.equal(calls, 2);
});

test('with nothing in the browser at all the module still works', async () => {
  setFriendNames(); delete globalThis.PanaSh; delete globalThis.localStorage; delete globalThis.sessionStorage;
  globalThis.fetch = undefined;
  assert.deepEqual(friendNamesNow(), []);
  assert.deepEqual(await loadFriendNames(), []);
});
