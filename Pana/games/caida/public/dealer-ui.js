import { cardCanvas } from '/engine/models/props/spanish-cards.js';
import { fillRoster } from '/engine/results.js';

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
    $('cut-value').textContent = `${at} y ${40 - at} cartas`;
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
      $('dealer-kicker').textContent = `REPARTO ${state.round}`;
      $('dealer-title').textContent = mine ? 'Te toca repartir.' : `${dealer.name} reparte.`;
      $('dealer-description').textContent = mine ? 'Corta si quieres. Elige con cuál número tentar la suerte.' : 'El repartidor corta y elige su número. Ya vienen las cartas.';
      $('dealer-controls').disabled = !mine || !ready || !room.connected;
      $('cut-position').disabled = $('cut-deck').disabled = state.cutAt !== null;
      $('cut-deck').textContent = state.cutAt !== null ? 'Baraja cortada' : 'Cortar aquí';
      $('cut-status').textContent = state.cutAt !== null ? `Corte listo · ${state.cutAt} y ${40 - state.cutAt} cartas` : 'Baraja mezclada · corte opcional';
      $('deal-deck').classList.toggle('is-cut', state.cutAt !== null);
      if (state.cutAt !== null) { $('cut-position').value = state.cutAt; previewCut(); }
      for (const button of document.querySelectorAll('[data-deal-call]')) button.setAttribute('aria-pressed', String(state.dealCall === button.dataset.dealCall));
      $('deal-cards').disabled = !state.dealCall;
      $('deal-cards').textContent = mine ? state.dealCall ? `Repartir desde el ${state.dealCall === 'up' ? 1 : 4}` : 'Elige 1 o 4 para repartir' : `Esperando a ${dealer.name}…`;
      const previous = state.previousRound;
      $('previous-round').hidden = !previous;
      if (previous) {
        $('previous-round-title').textContent = `Reparto anterior · ${previous.scores.join(' a ')} puntos`;
        fillRoster($('previous-round-scores'), previous.scores.map((score, team) => ({
          name: previous.names[team], end: `${score} / 24`,
          detail: `${previous.result.counts[team] || 0} cartas${previous.result.bonuses.length ? ` · +${previous.result.bonuses[team]} al contar` : ''}`,
        })));
      }
      if (entered && mine && ready && room.connected && !document.querySelector('dialog[open]')) $('call-one').focus({ preventScroll: true });
    },
  };
}
