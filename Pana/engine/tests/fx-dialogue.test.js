import test from 'node:test';
import assert from 'node:assert/strict';
import { autoRich, blipPitch, isSounded, letterDelays, moodOf, parseRich, plainText, speakerPose, typingSeconds } from '../fx/dialogue.js';

test('tags split a line into runs and never show in the text', () => {
  assert.deepEqual(parseRich('¡Hola <wave>pana</wave>!'), [{ text: '¡Hola ', fx: '' }, { text: 'pana', fx: 'wave' }, { text: '!', fx: '' }]);
  assert.equal(plainText('<shake>¡Ya!</shake> <wave>sí</wave>'), '¡Ya! sí');
  assert.equal(plainText('a <b>c</b>'), 'a <b>c</b>', 'unknown tags are left alone');
});

test('the typewriter holds at commas and longer at periods, never at the very end', () => {
  const delays = letterDelays('Hola, sí. Ya.');
  const at = (ch) => delays['Hola, sí. Ya.'.indexOf(ch)];
  assert.ok(at(',') > at('H'), 'a comma waits');
  assert.ok(at('.') > at(','), 'a period waits longer');
  assert.equal(delays.at(-1), 0);
});

test('a run of marks holds once, on its last one', () => {
  const delays = letterDelays('¿Qué?! Sí');
  assert.ok(delays[4] < delays[5], 'the ? does not hold before the !');
});

test('a tagged line takes as long as the same words without tags', () => {
  assert.equal(typingSeconds('Hola <wave>pana</wave>.'), typingSeconds('Hola pana.'));
});

test('each speaker has a voice, and letters nudge it', () => {
  assert.notEqual(blipPitch('a', 0), blipPitch('a', 1));
  assert.notEqual(blipPitch('a', 2), blipPitch('b', 2));
  assert.equal(blipPitch('a', 2), blipPitch('a', 2));
  assert.deepEqual(['a', 'ñ', '7', ' ', '.'].map(isSounded), [true, true, true, false, false]);
});

test('mood reads from how the line is written', () => {
  assert.equal(moodOf('¡Correcto!'), 'high');
  assert.equal(moodOf('¿Esa es su respuesta final?'), 'curious');
  assert.equal(moodOf('Ni modo…'), 'low');
  assert.equal(moodOf('Marcaste la B.'), 'calm');
});

test('auto markup shakes short shouts and waves the asked-for words only', () => {
  assert.equal(autoRich('¡Esa es!'), '<shake>¡Esa es!</shake>');
  assert.equal(autoRich('El Mango de oro está en juego.', { wave: ['Mango de oro'] }), 'El <wave>Mango de oro</wave> está en juego.');
  assert.equal(autoRich('Nada especial.'), 'Nada especial.');
  assert.equal(autoRich('<wave>ya</wave> marcado'), '<wave>ya</wave> marcado', 'a tagged line is left as written');
  assert.equal(autoRich('<wave>ya</wave> marcado'), '<wave>ya</wave> marcado', 'and the check holds no state between calls');
});

test('a silent speaker sits still and a talking one stays near its volume', () => {
  assert.deepEqual(speakerPose(1.3, 0), { y: 0, sx: 1, sy: 1, tilt: 0 });
  const pose = speakerPose(.4, 1);
  assert.ok(Math.abs(pose.sx * pose.sy - 1) < .01);
});
