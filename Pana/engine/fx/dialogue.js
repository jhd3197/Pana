// Lines that feel spoken: a typewriter that holds at commas and periods, a blip per
// letter pitched per speaker, <wave> and <shake> tags, and how a speaker should bob,
// squash and look while talking. The whole line is in the DOM from the first frame
// (letters only hidden), so nothing reflows, and textContent and screen readers get it all.
//
//   const line = typewrite(el, '¡Hola, <wave>pana</wave>!', { onLetter: (ch) => blip(ch) });
//   line.seconds;   line.skip();   line.stop();
//   const { y, sx, sy, tilt } = speakerPose(time, line.talking ? 1 : 0);
import { calm, useCss } from './feel.js';
useCss(new URL('dialogue.css', import.meta.url));

const LETTER = .024, HOLD_COMMA = .16, HOLD_STOP = .34;
const COMMA = /[,;:]/, STOP = /[.!?…]/, TAG = /<(\/?)(wave|shake)>/g, SOUNDED = /[\p{L}\p{N}]/u;

// '¡Hola <wave>pana</wave>!' -> [{ text: '¡Hola ', fx: '' }, { text: 'pana', fx: 'wave' }, { text: '!', fx: '' }]
export function parseRich(source) {
  const runs = [], text = String(source ?? '');
  let at = 0, fx = '';
  const push = (part) => { if (part) runs.push({ text: part, fx }); };
  for (const m of text.matchAll(TAG)) {
    push(text.slice(at, m.index));
    at = m.index + m[0].length;
    fx = m[1] ? '' : m[2];
  }
  push(text.slice(at));
  return runs;
}
export const plainText = (source) => parseRich(source).map((r) => r.text).join('');

// How long to wait after showing each letter. A hold belongs to the mark, not to the end.
export function letterDelays(text, { letter = LETTER, comma = HOLD_COMMA, stop = HOLD_STOP } = {}) {
  const chars = [...text];
  return chars.map((ch, i) => {
    if (i === chars.length - 1) return 0;
    if (STOP.test(ch) && !STOP.test(chars[i + 1])) return stop;
    return COMMA.test(ch) ? comma : letter;
  });
}
export const typingSeconds = (source, options) => letterDelays(plainText(source), options).reduce((a, b) => a + b, 0);

// A speaker's voice: the same for the same seat, the letter nudging it so it isn't a drone.
export function blipPitch(ch, voice = 0) {
  const base = 240 + ((voice * 2654435761 >>> 0) % 7) * 46;
  return base * (1 + ((ch.codePointAt(0) || 0) % 5) * .045);
}
export const isSounded = (ch) => SOUNDED.test(ch);

// What a line's mood is, from how it's written: a face and a colour to go with it.
export function moodOf(source) {
  const text = plainText(source);
  if (/\.\.\.|…$|ni modo|lástima|perd/i.test(text)) return 'low';
  if (text.includes('!')) return 'high';
  if (text.includes('?')) return 'curious';
  return 'calm';
}
export const MOOD_FACE = { high: 'laugh', low: 'natural', curious: 'talk', calm: 'smile' };

// Marks up a line that has no tags of its own: a short shout shakes, the words asked for wave.
export function autoRich(text, { wave = [], shout = 26 } = {}) {
  const source = String(text ?? '');
  if (!source || TAG.test(source)) { TAG.lastIndex = 0; return source; }
  TAG.lastIndex = 0;
  if (source.length <= shout && /^¡.*!$/.test(source)) return `<shake>${source}</shake>`;
  return wave.reduce((line, word) => line.replace(new RegExp(`(${word})`, 'i'), '<wave>$1</wave>'), source);
}

// A speaker's body while talking; `amount` 0..1 eases it in and out. Volume stays about even.
export function speakerPose(time, amount = 1) {
  const a = Math.max(0, Math.min(1, amount)), beat = Math.sin(time * 11), squash = beat * .035 * a;
  return { y: Math.abs(beat) * .05 * a, sx: 1 - squash, sy: 1 + squash, tilt: Math.sin(time * 5.5) * .035 * a };
}

function build(el, runs) {
  el.textContent = '';
  const letters = [];
  let index = 0;
  for (const { text, fx } of runs) {
    for (const piece of text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) { const gap = document.createTextNode(piece); el.append(gap); continue; }
      // A word stays whole: letters are inline blocks, so it could otherwise break anywhere.
      const word = document.createElement('span');
      word.className = 'pk-tw-word';
      for (const ch of piece) {
        const letter = document.createElement('i');
        letter.className = fx ? `pk-tw pk-tw--${fx}` : 'pk-tw';
        letter.textContent = ch; letter.style.setProperty('--i', String(index++));
        word.append(letter); letters.push(letter);
      }
      el.append(word);
    }
  }
  return letters;
}

export function typewrite(el, source, { onLetter = null, onDone = null, ...timing } = {}) {
  const runs = parseRich(source), delays = letterDelays(runs.map((r) => r.text).join('').replace(/\s+/g, ''), timing);
  const letters = build(el, runs);
  let index = 0, timer = 0, finished = false;
  const finish = () => {
    if (finished) return;
    finished = true; clearTimeout(timer);
    for (const letter of letters) letter.style.visibility = '';
    onDone?.();
  };
  const handle = {
    get talking() { return !finished; },
    seconds: delays.reduce((a, b) => a + b, 0),
    skip: finish,
    stop() { finished = true; clearTimeout(timer); },
  };
  if (calm() || !letters.length) { finish(); handle.seconds = 0; return handle; }
  for (const letter of letters) letter.style.visibility = 'hidden';
  // Paced by the clock, not by timers firing on time: a slow frame reveals what's due at
  // once, so a weak machine reads the line at the same speed, with one blip per step.
  const start = performance.now();
  let due = 0;
  const step = () => {
    if (finished) return;
    const elapsed = (performance.now() - start) / 1000;
    let spoke = false;
    while (index < letters.length && due <= elapsed) {
      const letter = letters[index], ch = letter.textContent;
      letter.style.visibility = '';
      if (!spoke && index % 2 === 0 && isSounded(ch)) { onLetter?.(ch, index); spoke = true; }
      due += delays[index++];
    }
    if (index >= letters.length) { finish(); return; }
    timer = setTimeout(step, Math.max(0, due - elapsed) * 1000);
  };
  step();
  return handle;
}
