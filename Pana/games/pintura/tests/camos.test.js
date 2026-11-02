import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CAMOS, camoById, isStart, unlockedSet, camoState, progressText, swatch } from '../public/camos.js';
import { cleanKit, MARKERS, START_CAMOS, FALLBACK_CAMO, CAMO_IDS, ownsCamo } from '../public/armory-data.js';
import { Arena } from '../public/rules.js';
import { PAINT_CAMOS, PAINT_SOLIDS } from '../../../engine/models/props/paint-arsenal.js';

// The gateway contract (pana.sh gateway/camos.json holds the same table).
const CONTRACT = {
  start: { 'liso-mango': '#f28b42', 'liso-caribe': '#29c5cd', 'liso-uva': '#8d85df', 'liso-crema': '#f8e9c9', 'liso-carbon': '#2f3d3c', 'liso-coral': '#ff4b4b' },
  kills: { selva: ['carbine', 15], medanos: ['marksman', 10], bolivar: ['sniper', 10], caracas: ['smg', 25], jaguar: ['blunderbuss', 15] },
  mangos: { caribe: 240, tricolor: 300, llanero: 360, rumba: 420, pepazo: 480 },
};

test('the catalog is the contract: ids, unlock rules and prices', () => {
  const by = type => CAMOS.filter(c => c.unlock.type === type);
  assert.deepEqual(Object.fromEntries(by('start').map(c => [c.id, c.colors[0]])), CONTRACT.start);
  assert.deepEqual(Object.fromEntries(by('kills').map(c => [c.id, [c.unlock.weapon, c.unlock.count]])), CONTRACT.kills);
  assert.deepEqual(Object.fromEntries(by('mangos').map(c => [c.id, c.unlock.price])), CONTRACT.mangos);
  assert.equal(CAMOS.length, 16);
});

test('camo ids are unique, every paint-kit pattern has an unlock rule, start camos are solid', () => {
  const ids = CAMOS.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...CAMO_IDS].sort(), 'cleanKit allowlists exactly the catalog');
  for (const id of Object.keys(PAINT_CAMOS)) {
    const c = camoById(id);
    assert.ok(c && ['kills', 'mangos'].includes(c.unlock.type), `${id} has an unlock rule`);
    assert.deepEqual(c.colors, PAINT_CAMOS[id].colors); assert.equal(c.pattern, PAINT_CAMOS[id].pattern); assert.equal(c.scale, PAINT_CAMOS[id].scale);
  }
  for (const c of CAMOS.filter(c => c.unlock.type === 'start')) {
    assert.equal(c.pattern, 'solid'); assert.equal(c.colors.length, 1); assert.equal(PAINT_SOLIDS[c.id], c.colors[0]);
    assert.ok(isStart(c.id));
  }
  assert.deepEqual(START_CAMOS, Object.keys(CONTRACT.start)); assert.equal(FALLBACK_CAMO, 'liso-mango');
  assert.notEqual(camoById('caribe').pattern, 'solid', "'caribe' is the pattern, not 'liso-caribe'");
});

test('kills camos name real markers and mango camos cost something', () => {
  for (const c of CAMOS) {
    if (c.unlock.type === 'kills') { assert.ok(MARKERS.some(m => m.id === c.unlock.weapon), c.id); assert.ok(c.unlock.count > 0); }
    if (c.unlock.type === 'mangos') assert.ok(c.unlock.price > 0, c.id);
    assert.ok(swatch(c.id), `${c.id} has a swatch`);
  }
});

test('unlockedSet always holds the start camos and only known ids', () => {
  assert.deepEqual([...unlockedSet()], START_CAMOS);
  const set = unlockedSet({ owned: ['selva', 'nope', 'liso-uva'] });
  assert.ok(set.has('selva') && set.has('liso-coral') && !set.has('nope'));
});

test('camoState: owned, locked by kills with progress, buyable, short of mangos, offline', () => {
  const data = { owned: ['selva'], progress: { marksman: { hits: 7, need: 10, camo: 'medanos' } }, prices: { caribe: 240 }, balance: 250, online: true };
  assert.equal(camoState('liso-uva', data).state, 'owned');
  assert.equal(camoState('selva', data).state, 'owned');
  assert.deepEqual(camoState('medanos', data), { state: 'locked', text: '7/10 pintadas con El Zamuro' });
  assert.equal(camoState('bolivar', data).text, '0/10 pintadas con La Lejana');
  assert.deepEqual(camoState('caribe', data), { state: 'buyable', price: 240, text: '240 mangos' });
  const short = camoState('pepazo', data);
  assert.equal(short.state, 'cantAfford'); assert.match(short.text, /480 mangos · te faltan 230/);
  // Without pana.sh only the start camos are anyone's.
  assert.equal(camoState('liso-coral', { online: false }).state, 'owned');
  assert.deepEqual(camoState('caribe', { online: false }), { state: 'locked', text: 'Disponible en pana.sh' });
  assert.match(camoState('selva', { online: false, signedOut: true }).text, /cuenta de pana\.sh/);
  assert.equal(progressText('selva', { carbine: { hits: 99 } }), '15/15 pintadas con La Parrandera', 'progress text never passes the threshold');
});

test('cleanKit keeps an allowlisted camo id or null, nothing else', () => {
  assert.equal(cleanKit().camo, null);
  assert.equal(cleanKit({ camo: 'selva' }).camo, 'selva');
  assert.equal(cleanKit({ camo: 'liso-carbon' }).camo, 'liso-carbon');
  for (const bad of ['#ff0000', 'personalizado', { colors: ['#000'] }, 7, '', 'SELVA']) assert.equal(cleanKit({ camo: bad }).camo, null, String(bad));
});

test('selectKit wears owned camos and swaps an unowned one for the first solid', () => {
  const arena = new Arena(); arena.add(1, { name: 'Ana' }); arena.add(2, { name: 'Beto' });
  assert.ok(arena.selectKit(1, { weapon: 'carbine', camo: 'liso-uva' })); assert.equal(arena.players[0].kit.camo, 'liso-uva');
  assert.equal(arena.camoRefusal(1, { camo: 'selva' }), 'selva');
  assert.ok(arena.selectKit(1, { weapon: 'carbine', camo: 'selva' }));
  assert.equal(arena.players[0].kit.camo, FALLBACK_CAMO); assert.equal(arena.players[0].kit.weapon, 'carbine', 'the rest of the kit still applies');
  arena.setCamos(2, ['selva']);
  assert.equal(arena.camoRefusal(2, { camo: 'selva' }), '');
  assert.ok(arena.selectKit(2, { camo: 'selva' })); assert.equal(arena.players[1].kit.camo, 'selva');
  // What someone owns is never broadcast.
  assert.ok(!JSON.stringify(arena.view()).includes('camoOwners'));
  assert.ok(ownsCamo(null) && ownsCamo('liso-crema') && !ownsCamo('rumba', []) && ownsCamo('rumba', new Set(['rumba'])));
  // A mid-round weapon change keeps the vetted camo.
  arena.start(); arena.go(); arena.step(.05, new Map([[2, { weapon: 'smg' }]]));
  assert.equal(arena.players[1].kit.camo, 'selva');
});

test('no free colour picker anywhere in Pepazo', () => {
  const dir = path.resolve(import.meta.dirname, '..', 'public');
  for (const file of fs.readdirSync(dir).filter(f => /\.(html|js)$/.test(f))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotMatch(text, /type\s*=\s*["']?color/i, `${file} has a colour input`);
    assert.doesNotMatch(text, /\.type\s*=\s*["']color["']/i, `${file} builds a colour input`);
    assert.doesNotMatch(text, /Personalizado/, `${file} offers a custom colour`);
  }
});
