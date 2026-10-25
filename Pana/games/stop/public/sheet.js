// Your own page of the libreta: one box per category, written in pencil.
// The answers live only here until pencils-down; game.js sends them with
// ¡STOP! or when the host asks for the sheets. Enter jumps to the next box.
import { categoryLabel, categoryShort, letterOf } from '/engine/play/saber-match.js';
import { MAX_ANSWER, tooShort } from './rules.js';

export function createSheet(root, { onProgress, onStop }) {
  const rows = root.querySelector('#sheet-rows'), stopButton = root.querySelector('#stop');
  let key = '', letter = '', inputs = [], reported = -1, editable = false;

  const filled = () => inputs.filter(input => input.value.trim()).length;
  const values = () => inputs.map(input => input.value.trim().slice(0, MAX_ANSWER));
  // ¡STOP! waits for real answers: a lone letter only fills the box.
  const full = () => inputs.length > 0 && inputs.every(input => !tooShort(input.value));

  function mark(input) {
    const text = input.value.trim();
    input.closest('li').classList.toggle('is-off', !!text && (letterOf(text) !== letter || tooShort(text)));
    input.closest('li').classList.toggle('is-filled', !!text);
  }
  function changed() {
    const n = filled();
    if (n !== reported) { reported = n; onProgress(n); }
    stopButton.disabled = !editable || !full();
  }

  // A fresh page for each round; the same round keeps what you wrote.
  function build(state, roundKey) {
    key = roundKey; letter = state.letter; reported = -1;
    inputs = state.categories.map((cat, i) => {
      const li = document.createElement('li'); li.className = 'sheet-row';
      const margin = Object.assign(document.createElement('span'), { className: 'row-letter', textContent: letter });
      margin.setAttribute('aria-hidden', 'true');
      const label = Object.assign(document.createElement('label'), { className: 'row-cat', htmlFor: `box-${i}` });
      label.append(Object.assign(document.createElement('span'), { className: 'row-cat-long', textContent: categoryLabel(cat) }),
        Object.assign(document.createElement('span'), { className: 'row-cat-short', textContent: categoryShort(cat) }));
      // Chrome ignores autocomplete="off" on boxes labelled Nombre, País or
      // Ciudad and covers the sheet with saved addresses; a token it doesn't
      // know turns that off.
      const input = Object.assign(document.createElement('input'), { id: `box-${i}`, name: `stop-${i}`, type: 'text', maxLength: MAX_ANSWER, autocomplete: 'stop-answer', spellcheck: false, placeholder: `${letter}…` });
      for (const [k, v] of [['data-form-type', 'other'], ['data-lpignore', 'true'], ['data-1p-ignore', '']]) input.setAttribute(k, v);
      input.setAttribute('autocapitalize', 'words'); input.setAttribute('autocorrect', 'off');
      input.setAttribute('enterkeyhint', i === state.categories.length - 1 ? 'done' : 'next');
      input.dataset.box = String(i);
      input.addEventListener('input', () => { mark(input); changed(); });
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const next = inputs[i + 1];
        if (next) next.focus(); else if (!stopButton.disabled) stopButton.focus();
      });
      const body = document.createElement('div'); body.className = 'row-body'; body.append(label, input);
      li.append(margin, body); return input;
    });
    rows.replaceChildren(...inputs.map(input => input.closest('li')));
    root.querySelectorAll('[data-sheet-letter]').forEach(el => { el.textContent = letter; });
  }

  stopButton.addEventListener('click', () => { if (editable && full()) onStop(values()); });

  return {
    // editable: the pencil is still in your hand (write, or basta if you didn't stop).
    sync(state, { roundKey, canWrite, focus }) {
      if (roundKey !== key || state.letter !== letter) { build(state, roundKey); if (focus) inputs[0]?.focus({ preventScroll: true }); }
      editable = canWrite;
      for (const input of inputs) { input.readOnly = !canWrite; input.closest('li').classList.toggle('is-down', !canWrite); }
      root.classList.toggle('is-down', !canWrite);
      changed();
    },
    values, filled, full,
    get key() { return key; },
    blur() { if (inputs.includes(document.activeElement)) document.activeElement.blur(); },
  };
}
