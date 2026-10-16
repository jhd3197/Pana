// Derrape's ways to play, as plain data and math: cups, difficulty, the
// catch-up that keeps races close, laps, and the balloon battle.
// game.js runs them; tests/modes.test.js checks them. No Three.js, no DOM.

export const CUPS = [
  { id: 'mango', name: 'Copa Mango', tracks: ['estadio', 'desierto', 'llanos', 'chichi'] },
  { id: 'arepa', name: 'Copa Arepa', tracks: ['selva', 'paramo', 'plaza', 'bululu'] },
];
export const cupById = (id) => CUPS.find(cup => cup.id === id) ?? CUPS[0];

// Points by finishing place (1st first). Eight racers at most.
export const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

// Adds one race's finishing order (names) to a { name: points } table.
export function awardPoints(table, order) {
  order.forEach((name, i) => { table[name] = (table[name] || 0) + (POINTS[i] ?? 0); });
  return table;
}

// Cup table, best first; ties go to whoever did better in the last race.
export function cupStandings(table, lastOrder = []) {
  return Object.entries(table).sort((a, b) => b[1] - a[1] || lastOrder.indexOf(a[0]) - lastOrder.indexOf(b[0]))
    .map(([name, points]) => ({ name, points }));
}

// Trophy for a final cup place: gold, silver, bronze or nothing.
export const trophyFor = (place) => ['oro', 'plata', 'bronce'][place] ?? null;
export const TROPHY_RANK = { oro: 3, plata: 2, bronce: 1 };

// Difficulty sets the rivals' pace, how hard they catch up, how often they
// fire items and whether they drift.
export const DIFFICULTY = {
  facil: { name: 'Fácil', skill: [0.8, 0.88], catchUp: 0.5, ease: 1.6, itemDelay: 1.8, drift: false },
  normal: { name: 'Normal', skill: [0.88, 0.97], catchUp: 1, ease: 1, itemDelay: 1, drift: true },
  dificil: { name: 'Difícil', skill: [0.96, 1.02], catchUp: 1.4, ease: 0.6, itemDelay: 0.6, drift: true },
};
export const difficultyById = (id) => DIFFICULTY[id] ?? DIFFICULTY.normal;

// Top-speed factor for a rival `gap` metres ahead of the player (negative =
// behind). Far behind: a little faster. Far ahead: a little slower.
export function rubberBand(gap, difficulty = DIFFICULTY.normal) {
  if (gap < -40) return 1 + Math.min(0.12, (-gap - 40) / 500) * difficulty.catchUp;
  if (gap > 60) return 1 - Math.min(0.08, (gap - 60) / 700) * difficulty.ease;
  return 1;
}

export const LAP_CHOICES = [1, 2, 3, 4, 5];
export const cleanLaps = (n) => LAP_CHOICES.includes(n) ? n : 3;

// Balloon battle: three balloons each, last car with any left wins; at the
// time limit the most balloons wins.
export const BALLOONS = 3;
export const BATTLE_TIME = 150;

// Battle order: most balloons first, then whoever lasted longer.
export function battleOrder(cars) {
  return [...cars].sort((a, b) => b.balloons - a.balloons || (b.outAt ?? Infinity) - (a.outAt ?? Infinity));
}

// The battle is over when one car (or none) still has balloons, or time's up.
export const battleOver = (cars, clock) => cars.filter(c => c.balloons > 0).length <= 1 || clock >= BATTLE_TIME;
