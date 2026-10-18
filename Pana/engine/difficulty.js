// One difficulty knob for aiming games (Billar, Bolas Criollas). It sets how
// much of the shot the guide predicts and how well the bots play. No Three.js
// and no DOM at import time, so pure rules.js files can read it.
//
//   guide.reach   fraction of the aim line drawn (1 = all the way to contact)
//   guide.ghost   draw the ghost ball / landing ring at the end of the line
//   guide.after   fraction of the predicted paths after contact (0 = none)
//   guide.bounces cushion rebounds previewed when nothing is hit
//   aimError      a bot's typical aiming error, in radians
export const DIFFICULTIES = Object.freeze([
  { id: 'facil', label: 'Fácil', note: 'Guía completa, con choques y rebotes. Los bots rivales juegan relajados.',
    guide: { reach: 1, ghost: true, after: 1, bounces: 2 }, aimError: .05 },
  { id: 'normal', label: 'Normal', note: 'La guía marca el contacto y un poco del recorrido.',
    guide: { reach: 1, ghost: true, after: .35, bounces: 1 }, aimError: .02 },
  { id: 'dificil', label: 'Difícil', note: 'Una guía corta, sin recorrido. Los bots afinan.',
    guide: { reach: .4, ghost: false, after: 0, bounces: 0 }, aimError: .009 },
  { id: 'experto', label: 'Experto', note: 'Solo la dirección del tiro. Los bots casi no fallan.',
    guide: { reach: .14, ghost: false, after: 0, bounces: 0 }, aimError: .003 },
]);
export const DEFAULT_DIFFICULTY = 'normal';
export const validDifficulty = id => DIFFICULTIES.some(d => d.id === id);
export const difficultyInfo = id => DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1];

// Lobby control: a labelled segmented choice. The host picks; guests see it.
export function createDifficultyPicker(parent, onChange, { label = 'Dificultad' } = {}) {
  const field = document.createElement('div'); field.className = 'pk-field pk-difficulty';
  const title = document.createElement('span'); title.className = 'pk-eyebrow'; title.id = 'difficulty-label'; title.textContent = label;
  const group = document.createElement('div'); group.className = 'pk-seg'; group.id = 'difficulty-options';
  group.setAttribute('role', 'group'); group.setAttribute('aria-labelledby', title.id);
  const note = document.createElement('small'); note.className = 'pk-copy'; note.id = 'difficulty-note';
  const buttons = DIFFICULTIES.map(d => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.difficulty = d.id; button.textContent = d.label;
    button.onclick = () => onChange(d.id); group.append(button); return button;
  });
  field.append(title, group, note); parent.append(field);
  return {
    update(id, enabled) {
      const info = difficultyInfo(id);
      for (const b of buttons) { b.setAttribute('aria-pressed', String(b.dataset.difficulty === info.id)); b.disabled = !enabled; }
      note.textContent = info.note;
    },
  };
}
