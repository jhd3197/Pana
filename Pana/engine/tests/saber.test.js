// El Saber (engine/saber.js) and its lookup API (engine/saber-match.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SABER, SABER_CATEGORIES, CRUDE_WORDS } from '../saber.js';
import { normalize, letterOf, soundKey, distance, findEntry, isCrude, wordsFor, categoryLabel } from '../saber-match.js';

const SOFT = 'ABCDEFGHIJLMNOPRSTV'.split('');

test('every entry is complete and lives in a known category', () => {
  const seen = new Set();
  for (const e of SABER) {
    assert.ok(SABER_CATEGORIES[e.category], `${e.word}: unknown category ${e.category}`);
    assert.equal(typeof e.word, 'string'); assert.ok(e.word.length > 0 && e.word.length <= 80, e.word);
    assert.ok(Array.isArray(e.variants)); assert.equal(typeof e.explain, 'string'); assert.equal(typeof e.source, 'string');
    assert.equal(typeof e.crude, 'boolean'); assert.equal(typeof e.doubtful, 'boolean');
    assert.ok(!/[;=#@?]/.test(e.word + e.variants.join('')), `${e.word}: a parsing mark leaked into the word`);
    const id = `${e.category}:${normalize(e.word)}`;
    assert.ok(!seen.has(id), `duplicate ${id}`); seen.add(id);
  }
});

test('the knowledge base is big enough to play: hundreds of words, most letters per category', () => {
  assert.ok(SABER.length >= 1200, `${SABER.length} entries`);
  for (const cat of Object.keys(SABER_CATEGORIES)) {
    const n = SABER.filter(e => e.category === cat).length;
    assert.ok(n >= 24, `${cat}: ${n}`);
    const covered = SOFT.filter(l => wordsFor(cat, l).length).length;
    assert.ok(covered >= (cat === 'estado' ? 12 : 16), `${cat} covers ${covered} common letters`);
  }
  for (const cat of ['nombre', 'apellido', 'pais', 'ciudad', 'animal', 'color', 'cosa', 'marca', 'musica']) {
    assert.deepEqual(SOFT.filter(l => !wordsFor(cat, l).length), [], `${cat} has a word for every common letter`);
  }
  assert.equal(SABER.filter(e => e.category === 'estado').length, 24, 'the 23 states and the Distrito Capital');
});

test('the reel entries are in, with their source', () => {
  const hormiga = findEntry('color', 'Hormiga');
  assert.equal(hormiga.entry.source, 'C4B9Vk6L9kK'); assert.ok(hormiga.entry.doubtful);
  assert.match(hormiga.entry.explain, /color de hormiga/);
  assert.equal(findEntry('color', 'color de hormiga').entry.word, 'Hormiga');
  assert.equal(findEntry('color', 'Oreo').entry.joke, 'oreo');
  assert.ok(findEntry('animal', 'Nemo').entry.doubtful);
  assert.ok(findEntry('dicho', 'Caracas es Caracas y lo demás es monte y culebra'));
  const lejos = findEntry('lugar', "El coño 'e la madre");
  assert.ok(lejos.entry.crude && lejos.entry.doubtful);
});

test('normalize and letters: accents go, ñ stays', () => {
  assert.equal(normalize('  ¡Ávila,   Mérida! '), 'avila merida');
  assert.equal(normalize("Culo 'e puya"), 'culo e puya');
  assert.equal(letterOf('Ávila'), 'A'); assert.equal(letterOf('Ñame'), 'Ñ'); assert.equal(letterOf('  '), '');
});

test('sound keys forgive the usual spelling mix-ups', () => {
  for (const [a, b] of [['Barinas', 'Varinas'], ['Hormiga', 'Ormiga'], ['Cereza', 'Zeresa'], ['Llama', 'Yama'], ['Quíbor', 'Kíbor'], ['Paraguay', 'Paraguai'], ['Guanábana', 'Guanabanna'], ['Nueva York', 'Nuevayork']]) {
    assert.equal(soundKey(a), soundKey(b), `${a} = ${b}`);
  }
  assert.notEqual(soundKey('Chivo'), soundKey('Civo'));
});

test('distance counts typos and swaps, and stops early', () => {
  assert.equal(distance('gato', 'gato'), 0);
  assert.equal(distance('gato', 'pato'), 1);
  assert.equal(distance('gato', 'agto'), 1, 'a swap is one typo');
  assert.equal(distance('gato', 'perro', 1), 2, 'past the limit');
});

test('findEntry matches exact, by sound, with a typo and by the start of a long dicho', () => {
  assert.equal(findEntry('ciudad', 'caracas').how, 'exact');
  assert.equal(findEntry('ciudad', 'Varinas').how, 'sound');
  assert.equal(findEntry('ciudad', 'Varinas').form, 'Barinas');
  assert.equal(findEntry('animal', 'Chiguire').entry.word, 'Chigüire');
  assert.equal(findEntry('pais', 'Venezuala').how, 'typo');
  assert.equal(findEntry('dicho', 'camaron que se duerme').how, 'phrase');
  assert.equal(findEntry('animal', 'Gatopardo'), null);
  assert.equal(findEntry('animal', 'Oso').how, 'exact');
  assert.equal(findEntry('animal', 'Osa'), null, 'short words need the exact spelling');
  assert.equal(findEntry('estado', 'Vargas').entry.word, 'La Guaira', 'old names are variants');
  assert.equal(findEntry('pelotero', 'Miggy').entry.word, 'Cabrera', 'nicknames are variants');
  const table = [{ category: 'animal', word: 'Gatopardo' }];
  assert.equal(findEntry('animal', 'Gatopardo', { extra: table }).entry.source, 'mesa');
  assert.equal(findEntry('animal', 'Gato', { extra: table, base: false }), null, 'base: false searches the table only');
});

test('crude words are caught, with or without accents, and only them', () => {
  for (const word of ['Pajúo', 'pajuo', 'coño', 'Perro marico', "El coño 'e la madre"]) assert.ok(isCrude(word), word);
  for (const word of ['Cono', 'Marcas', 'Caracas', 'Pana', 'Gafo', 'Sapo', 'Pavoso']) assert.ok(!isCrude(word), word);
  assert.ok(CRUDE_WORDS.length > 10);
});

test('wordsFor gives bots clean, sure words that start with the letter', () => {
  const words = wordsFor('pelotero', 'C');
  assert.ok(words.length > 3);
  for (const { entry, form } of words) { assert.equal(letterOf(form), 'C'); assert.ok(!entry.crude && !entry.doubtful); }
  assert.ok(wordsFor('pelotero', 'M').some(w => w.form === 'Miguel Cabrera'), 'a first name counts as well');
  assert.ok(wordsFor('palabra', 'P').every(w => !w.entry.crude));
  assert.ok(wordsFor('palabra', 'P', { crude: true }).some(w => w.entry.crude));
  assert.ok(wordsFor('animal', 'N', { doubtful: true }).some(w => w.form === 'Nemo'));
  assert.equal(categoryLabel('carinoso'), 'Insulto cariñoso');
});

test('slang carries its explanation for the review', () => {
  assert.match(findEntry('palabra', 'Pichirre').entry.explain, /tacaño/);
  assert.match(findEntry('carinoso', 'Pavoso').entry.explain, /mala suerte/);
});
