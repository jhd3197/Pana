import { cardCanvas } from '/engine/models/props/spanish-cards.js';
import { fillRoster } from '/engine/results.js';
import { loc } from '/engine/i18n.js';

// Only the dealer sends actions; all clients see the same committed cut and call.
export function createDealerUI(room, unlock) {
  const $ = id => document.getElementById(id);
  let activeKey = '';
  for (const canvas of document.querySelectorAll('.deal-deck canvas')) {
    canvas.width = 320; canvas.height = 480;
    canvas.getContext('2d').drawImage(cardCanvas(), 0, 0);
  }
  function previewCut() {
    const at = Number($('cut-position').value);
    $('cut-value').textContent = loc('{a} y {b} cartas', { a: at, b: 40 - at });
    $('cut-top').style.transform = `translate(${16 + at}px, -8px) rotate(8deg)`;
  }
  function act(action, values) {
    // A peer waits for the host snapshot before sending another revision-bound action.
    if (!room.connected || room.seat !== room.state.dealer || room.state.phase !== 'dealing') return;
    unlock(); $('dealer-controls').disabled = true; room.action(action, values);
  }
  $('cut-position').oninput = previewCut;
  $('cut-deck').onclick = () => act('cut', { at: Number($('cut-position').value) });
  for (const button of document.querySelectorAll('[data-deal-call]')) button.onclick = () => act('call', { call: button.dataset.dealCall });
  $('deal-cards').onclick = () => act('deal');
  return {
    update(state, ready) {
      const preparing = state.phase === 'dealing', mine = room.seat === state.dealer;
      $('dealer-panel').hidden = !preparing;
      document.body.classList.toggle('in-dealing', preparing);
      if (!preparing) { activeKey = ''; return; }
      const key = `${state.round}:${state.dealer}:${mine}:${ready && room.connected}`;
      const entered = activeKey !== key; activeKey = key;
      if (entered) { $('cut-position').value = state.cutAt ?? 20; previewCut(); }
      const dealer = state.players[state.dealer];
      $('dealer-kicker').textContent = loc('REPARTO {n}', { n: state.round });
      $('dealer-title').textContent = mine ? loc('Te toca repartir.') : loc('{name} reparte.', { name: dealer.name });
      $('dealer-description').textContent = mine ? loc('Corta si quieres. Elige con cuál número tentar la suerte.') : loc('El repartidor corta y elige su número. Ya vienen las cartas.');
      $('dealer-controls').disabled = !mine || !ready || !room.connected;
      $('cut-position').disabled = $('cut-deck').disabled = state.cutAt !== null;
      $('cut-deck').textContent = state.cutAt !== null ? loc('Baraja cortada') : loc('Cortar aquí');
      $('cut-status').textContent = state.cutAt !== null ? loc('Corte listo · {a} y {b} cartas', { a: state.cutAt, b: 40 - state.cutAt }) : loc('Baraja mezclada · corte opcional');
      $('deal-deck').classList.toggle('is-cut', state.cutAt !== null);
      if (state.cutAt !== null) { $('cut-position').value = state.cutAt; previewCut(); }
      for (const button of document.querySelectorAll('[data-deal-call]')) button.setAttribute('aria-pressed', String(state.dealCall === button.dataset.dealCall));
      $('deal-cards').disabled = !state.dealCall;
      $('deal-cards').textContent = mine ? state.dealCall ? loc('Repartir desde el {n}', { n: state.dealCall === 'up' ? 1 : 4 }) : loc('Elige 1 o 4 para repartir') : loc('Esperando a {name}…', { name: dealer.name });
      const previous = state.previousRound;
      $('previous-round').hidden = !previous;
      if (previous) {
        $('previous-round-title').textContent = loc('Reparto anterior · {scores} puntos', { scores: previous.scores.reduce((a, b) => loc('{a} a {b}', { a, b })) });
        fillRoster($('previous-round-scores'), previous.scores.map((score, team) => ({
          name: previous.names[team], end: `${score} / 24`,
          detail: previous.result.bonuses.length ? loc('{n} cartas · +{bonus} al contar', { n: previous.result.counts[team] || 0, bonus: previous.result.bonuses[team] }) : loc('{n} cartas', { n: previous.result.counts[team] || 0 }),
        })));
      }
      if (entered && mine && ready && room.connected && !document.querySelector('dialog[open]')) $('call-one').focus({ preventScroll: true });
    },
  };
}
