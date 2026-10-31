// The lobby's libreta pieces and the end-of-game recap: the pack picker
// (‹ name ›, like Carreritas' map), the Categorías dialog (what the pack
// deals and the host's own categories) and "Lo mejor de la noche". Text
// only: names, answers and own categories never become HTML.
import { ICONS } from '/engine/icons.js';
import { PACKS, CUSTOM_MAX, CUSTOM_LENGTH, packOf, kindOf, labelText, arrange } from './categories.js';
import { CLASICAS, CRIOLLAS, VARIADAS } from './rules.js';
import { loc, locn } from '/engine/i18n.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

// The pack's own list as this table's options would deal it.
export function packList(options) {
  const pack = packOf(options.set);
  return { pack, own: arrange(pack.deal || [...CLASICAS, ...CRIOLLAS, ...VARIADAS], options) };
}

export function summaryText(state) {
  const o = state.options, pack = packOf(o.set), own = state.custom?.length || 0;
  const head = o.mode === 'rapido' ? loc('Stop rápido · {pack} · 3 categorías · 30 s', { pack: loc(pack.name) })
    : loc('{pack} · {count} categorías · {seconds} s', { pack: loc(pack.name), count: o.count, seconds: o.seconds });
  const rounds = locn(o.rounds, '{n} ronda', '{n} rondas');
  return own ? loc('{head} · {own} · {rounds}', { head, own: locn(own, '{n} tuya', '{n} tuyas'), rounds }) : loc('{head} · {rounds}', { head, rounds });
}

export function createPackPicker(root, { change }) {
  const name = root.querySelector('#pack-name'), note = root.querySelector('#pack-note');
  const arrows = [...root.querySelectorAll('[data-pack-step]')];
  arrows.forEach(button => { button.innerHTML = Number(button.dataset.packStep) < 0 ? ICONS.chevronLeft : ICONS.chevronRight; });
  let current = PACKS[0].id, enabled = false;
  for (const button of arrows) button.addEventListener('click', () => {
    if (!enabled) return;
    const i = PACKS.findIndex(p => p.id === current), next = PACKS[(i + Number(button.dataset.packStep) + PACKS.length) % PACKS.length];
    change(next.id);
  });
  return {
    update(options, mayEdit) {
      const pack = packOf(options.set); current = pack.id; enabled = mayEdit;
      if (name.textContent !== loc(pack.name)) name.textContent = loc(pack.name);
      if (note.textContent !== loc(pack.note)) note.textContent = loc(pack.note);
      root.dataset.pack = pack.id;
      arrows.forEach(button => { button.disabled = !mayEdit; });
    },
  };
}

export function createCategoriesDialog(dialog, { save }) {
  const $ = (sel) => dialog.querySelector(sel);
  const inputs = Array.from({ length: CUSTOM_MAX }, (_, i) => {
    const input = Object.assign(document.createElement('input'), { type: 'text', maxLength: CUSTOM_LENGTH, autocomplete: 'stop-answer', spellcheck: false, placeholder: [loc('Profe del liceo'), loc('Algo de Maracaibo'), loc('Excusa para no ir a la playa')][i] });
    input.className = 'libreta-input'; input.dataset.own = String(i); input.setAttribute('aria-label', loc('Tu categoría {n}', { n: i + 1 })); input.translate = false;
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); inputs[i + 1]?.focus(); } });
    return input;
  });
  $('#libreta-inputs').replaceChildren(...inputs);
  $('#libreta-close').innerHTML = ICONS.close;
  let editable = false, last = '';
  function commit() { if (editable) save(inputs.map(input => input.value)); }
  function close() { if (editable) commit(); dialog.close(); }
  $('#libreta-close').addEventListener('click', close);
  $('#libreta-done').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  // Keys typed here belong to the dialog, never to the game behind it.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  return {
    open() { dialog.showModal(); (editable ? inputs[0] : $('#libreta-done')).focus(); },
    get isOpen() { return dialog.open; },
    update(state, mayEdit) {
      editable = mayEdit;
      const { pack, own } = packList(state.options), custom = state.custom || [];
      const key = JSON.stringify([state.options, custom, mayEdit]);
      for (const [i, input] of inputs.entries()) { input.readOnly = !mayEdit; if (document.activeElement !== input) input.value = custom[i] || ''; }
      if (key === last) return; last = key;
      $('#libreta-title').textContent = loc(pack.name);
      $('#libreta-notice').textContent = mayEdit ? loc('Tus panas ven los cambios al momento.') : loc('El anfitrión elige las categorías.');
      const n = state.options.mode === 'rapido' ? 3 : state.options.count;
      const more = own.length + custom.length < n;
      const deal = custom.length ? (more ? loc('Se juegan {n} casillas: primero las tuyas, después de esta lista y unas clásicas.', { n }) : loc('Se juegan {n} casillas: primero las tuyas, después de esta lista.', { n }))
        : more ? loc('Se juegan {n} casillas de esta lista y unas clásicas.', { n }) : loc('Se juegan {n} casillas de esta lista.', { n });
      $('#libreta-pack-note').textContent = `${loc(pack.note)} ${deal}`;
      $('#libreta-list').replaceChildren(...own.map(id => {
        const li = el('li', `libreta-chip is-${kindOf(id)}`, labelText(id)); li.translate = false;
        if (kindOf(id) === 'libre') li.append(el('small', '', loc('se vota')));
        return li;
      }));
      $('#libreta-own-note').textContent = mayEdit ? loc('Se reparten primero y siempre se votan. Los bots las dejan en blanco.') : custom.length ? loc('Las puso el anfitrión. Siempre se votan.') : loc('El anfitrión no puso categorías propias.');
    },
  };
}

// Lo mejor de la noche: each round's letter, top scorer, best-voted answer
// and the closest vote.
export function renderRecap(list, state) {
  const name = (seat) => state.players[seat]?.name || loc('Alguien');
  list.translate = false;
  list.replaceChildren(...(state.history || []).map(h => {
    const li = el('li', 'recap-round');
    li.append(el('b', 'recap-letter', h.letter || '?'));
    const body = el('div', 'recap-body');
    body.append(el('span', 'recap-top', loc('Ronda {round}: {name} sacó {points}', { round: h.round, name: name(h.top.seat), points: h.top.points })));
    if (h.best) body.append(el('span', 'recap-best', loc('«{word}» de {name} en {category} · +Creatividad', { word: h.best.word, name: name(h.best.seat), category: labelText(h.best.category) })));
    if (h.debate && h.debate.word !== h.best?.word) body.append(el('span', 'recap-debate', loc('La más peleada: «{word}» en {category}, {yes} a {no}', { word: h.debate.word, category: labelText(h.debate.category), yes: h.debate.yes, no: h.debate.no })));
    li.append(body);
    return li;
  }));
  list.closest('.recap-box').hidden = !list.children.length;
}
