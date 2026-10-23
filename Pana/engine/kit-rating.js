// Shared display bands; each game calculates its rating from its own rules.
export const NIVEL_BANDS = [
  { min: 750, letter: 'S', color: '#c45bff' },
  { min: 650, letter: 'A', color: '#ff9a1f' },
  { min: 550, letter: 'B', color: '#2bb37a' },
  { min: 450, letter: 'C', color: '#3d7bf2' },
  { min: 0, letter: 'D', color: '#8b84b0' },
];
export const bandOf = value => NIVEL_BANDS.find(band => value >= band.min) ?? NIVEL_BANDS.at(-1);
export function ratingBadge(value) {
  const score = Math.round(Number(value) || 0), band = bandOf(score);
  return `<span class="pk-kit-level" style="--nivel:${band.color}" aria-label="Nivel ${band.letter} ${score}"><b>${band.letter}</b><span>${score}</span></span>`;
}
