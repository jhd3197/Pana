// Shared host-controlled seating for partnership and individual table games.
export function createTableSeating(container, onSwap) {
  container.classList.add('pk-seating');
  const heading = document.createElement('strong'), help = document.createElement('p'), rows = document.createElement('div');
  heading.textContent = 'Organizar mesa'; help.className = 'pk-copy'; rows.className = 'pk-seating-rows';
  container.append(heading, help, rows);
  let signature = '';
  return { update(players, { teams = false, enabled = false, ownId = null } = {}) {
    const next = JSON.stringify([players.map(p => [p.id, p.name, p.bot]), teams, enabled, ownId]);
    if (next === signature) return;
    signature = next;
    help.textContent = teams ? 'Los de cada pareja se sientan enfrente. ' : 'Cada pana juega por su cuenta. ';
    help.textContent += enabled ? 'Elige a alguien para intercambiar sus puestos.' : 'El anfitrión organiza los puestos.';
    const focus = rows.contains(document.activeElement) ? document.activeElement.dataset.seat : null;
    rows.replaceChildren();
    const order = teams ? [0, 2, 1, 3] : players.map((_, i) => i);
    for (const seat of order) {
      const label = document.createElement('label'), title = document.createElement('span'), select = document.createElement('select');
      title.textContent = teams ? `Pareja ${seat % 2 === 0 ? 'A' : 'B'} · puesto ${seat + 1}` : `Puesto ${seat + 1}`;
      select.dataset.seat = seat; select.disabled = !enabled || players.length < 2;
      for (const [index, player] of players.entries()) {
        const option = document.createElement('option'); option.value = index;
        option.textContent = `${player.name}${ownId !== null && player.id === ownId ? ' · tú' : player.id === null || player.bot ? ' · bot' : ''}`;
        select.append(option);
      }
      select.value = seat;
      select.onchange = () => { const to = Number(select.value); select.value = seat; onSwap(seat, to); };
      label.append(title, select); rows.append(label);
    }
    if (focus !== null) rows.querySelector(`[data-seat="${focus}"]`)?.focus({ preventScroll: true });
  } };
}
