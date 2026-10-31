import test from 'node:test';
import assert from 'node:assert/strict';
import { matchLanguage, resolveLanguage, loc, locn, locKey, language, LANGUAGES } from '/engine/i18n.js';
import { normalizeSettings, parseUrlSettings, LANGUAGE_CHOICES } from '/engine/settings.js';
import { htmlPhrases, jsPhrases, literals } from '../../scripts/i18n.js';

test('a language tag reduces to a supported code, or nothing', () => {
  assert.equal(matchLanguage('en-GB'), 'en');
  assert.equal(matchLanguage('ES_ve'), 'es');
  assert.equal(matchLanguage('pt-BR'), null);
  assert.equal(matchLanguage(undefined), null);
  assert.deepEqual(LANGUAGES.map(l => l.code), ['es', 'en']);
});

test('the address wins, then the saved choice, then the browser, then Spanish', () => {
  assert.equal(resolveLanguage({ url: 'en', saved: 'es', browser: ['es-VE'] }), 'en');
  assert.equal(resolveLanguage({ saved: 'es', browser: ['en-US'] }), 'es');
  assert.equal(resolveLanguage({ browser: ['fr-FR', 'en-US', 'es'] }), 'en');
  assert.equal(resolveLanguage({ browser: ['fr-FR'] }), 'es');
  // Suites run in an en-US browser and expect the Spanish they were written for.
  assert.equal(resolveLanguage({ browser: ['en-US'], automated: true }), 'es');
  assert.equal(resolveLanguage({ url: 'en', browser: ['en-US'], automated: true }), 'en');
});

test('Spanish is the source: loc fills placeholders and locn picks the form', () => {
  assert.equal(language, 'es');
  assert.equal(loc('Seguir jugando'), 'Seguir jugando');
  assert.equal(loc('Panas en la sala · {n} / {max}', { n: 2, max: 6 }), 'Panas en la sala · 2 / 6');
  assert.equal(loc('Hola {name}', {}), 'Hola {name}');
  assert.equal(locn(1, '{n} ficha', '{n} fichas'), '1 ficha');
  assert.equal(locn(3, '{n} ficha', '{n} fichas'), '3 fichas');
  assert.equal(locKey('Orden al azar'), 'Orden al azar');
});

test('the language setting accepts auto and the supported codes only', () => {
  assert.deepEqual(LANGUAGE_CHOICES, ['auto', 'es', 'en']);
  assert.equal(normalizeSettings({}).language, 'auto');
  assert.equal(normalizeSettings({ language: 'en' }).language, 'en');
  assert.equal(normalizeSettings({ language: 'xx' }).language, 'auto');
  assert.deepEqual(parseUrlSettings('?pana-language=en'), { language: 'en' });
});

test('phrases are read from markup, loc calls and markup built in code', () => {
  assert.deepEqual(htmlPhrases('<p title="Cerrar menú">Hola <b>pana</b></p><code>x</code><b translate="no">Toño</b><script>a()</script>'),
    ['Cerrar menú', 'Hola', 'pana']);
  const plurals = new Map();
  assert.deepEqual(jsPhrases("loc('Listo'); locn(n, '{n} ficha', '{n} fichas'); locKey(\"Al azar\"); loc('Mando', { $ctx: 'tambor' }); el.innerHTML = `<li>${x}</li><li>Al natural</li>`;", plurals),
    ['Listo', '{n} ficha', 'Al azar', 'tambor::Mando', 'Al natural']);
  assert.equal(plurals.get('{n} ficha'), '{n} fichas');
  // Examples in comments are not phrases.
  assert.deepEqual(jsPhrases("// loc('Ejemplo')\n/* loc('Otro') */"), []);
});

test('Spanish literals outside loc are found; ids, selectors and shaders are not', () => {
  const src = `
    el.textContent = '¡Ganaste la partida!';
    el.textContent = loc('Ya traducido');
    node.closest('button, a');
    const id = 'pana-row pana-choice';
    const key = \`pana:reconnect:\${code}\`;
    group.name = 'Guía en el agua';
    const shader = 'uniform float progress; varying vec2 vUv;';
    label = \`Turno de \${name}\`;`;
  const { sure } = literals(src);
  assert.deepEqual(sure.map(s => s.value), ['¡Ganaste la partida!', 'Turno de ${name}']);
  assert.equal(sure[1].hasHoles, true);
  assert.deepEqual(literals('// i18n-ignore-file: content\nconst a = "¡Hola, pana!";').sure, []);
  assert.deepEqual(literals('const a = "¡Hola, pana!"; // i18n-ignore').sure, []);
});
