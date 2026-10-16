export const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
export function domino(tile, { back = false, button = false } = {}) {
  const element = document.createElement(button ? 'button' : 'div');
  element.className = `domino${back ? ' back' : ''}`;
  if (button) { element.type = 'button'; element.dataset.tile = tile?.id; }
  if (back) { element.setAttribute('aria-hidden', 'true'); return element; }
  element.setAttribute('aria-label', `${tile.a} con ${tile.b}`);
  for (const value of [tile.a, tile.b]) {
    const face = document.createElement('span'); face.className = 'pip-face'; face.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement('i'); pip.className = `pip${PIPS[value].includes(i) ? '' : ' hidden-pip'}`; face.append(pip);
    }
    element.append(face);
  }
  const rivet = document.createElement('i'); rivet.className = 'rivet'; element.append(rivet);
  return element;
}

// Each turn is an actual vertical domino, touching the last half of each row.
// This keeps all 28 pieces connected without wrapping or overlapping.
export function chainLayout(count, perRow = 7) {
  const positions = []; let index = 0, row = 0;
  while (index < count) {
    const direction = row % 2 ? -1 : 1;
    for (let col = 0; col < perRow && index < count; col++, index++)
      positions.push({ x: (direction === 1 ? col : perRow - 1 - col) * 76, y: row * 114, angle: direction === 1 ? 0 : 180 });
    if (index < count) {
      positions.push({ x: direction === 1 ? (perRow - 1) * 76 + 19 : -19, y: row * 114 + 57, angle: 90 });
      index++;
    }
    row++;
  }
  return positions;
}
