import { loc } from '../../../engine/i18n.js';
export const CURRENT_CUP_EDITION = 2;
export const GP_STAGE_CAP_SECONDS = 240;
// New standalone circuits do not silently change a saved cup edition's route.
export const STANDALONE_TRACKS = [];

const stage = (track, laps = 2, estimatedSeconds = 150) => ({
  track, laps, capSeconds: GP_STAGE_CAP_SECONDS, estimatedSeconds,
});

export const CUP_DEFINITIONS = [
  {
    id: 'pana', name: loc('Copa Pana'), edition: CURRENT_CUP_EDITION, available: true,
    stages: [
      stage('estadio', 2, 155),
      stage('plaza', 2, 175),
      stage('llanos', 2, 160),
      stage('bululu', 2, 145),
    ],
  },
  {
    id: 'aventura', name: loc('Copa Aventura'), edition: CURRENT_CUP_EDITION, available: true,
    stages: [
      stage('desierto', 2, 145),
      stage('chichi', 1, 175),
      stage('selva', 2, 185),
      stage('paramo', 2, 155),
    ],
  },
  {
    id: 'agua', name: loc('Copa del Agua'), edition: CURRENT_CUP_EDITION, available: true,
    stages: [
      stage('salinas', 2, 205),
      stage('delta', 3, 165),
      stage('cuevas', 2, 125),
      stage('salto', 2, 180),
    ],
  },
  {
    id: 'costa', name: loc('Copa Costa'), edition: CURRENT_CUP_EDITION, available: true,
    stages: [
      stage('cata', 2, 180),
      stage('choroni', 2, 130),
      stage('chuao', 3, 120),
      stage('margarita', 2, 160),
    ],
  },
  {
    id: 'cumbre', name: loc('Copa Cumbre'), edition: CURRENT_CUP_EDITION, available: true,
    stages: [
      stage('tovar', 2, 135),
      stage('galipan', 2, 155),
      stage('merida', 2, 185),
      stage('volcan', 1, 135),
    ],
  },
  {
    id: 'relampago', name: loc('Copa Relámpago'), edition: CURRENT_CUP_EDITION, available: true,
    stages: [
      stage('puerto', 1, 185),
      stage('maracaibo', 2, 120),
      stage('sabana', 2, 110),
      stage('sarisarinama', 2, 160),
    ],
  },
  {
    id: 'fantasia', name: loc('Copa Fantasía'), edition: CURRENT_CUP_EDITION, available: true,
    stages: [
      stage('arrecife', 2, 165),
      stage('dulce', 2, 145),
      stage('nubes', 2, 185),
      stage('cosmos', 1, 125),
    ],
  },
];

export const LEGACY_CUP_ALIASES = Object.freeze({ mango: 'pana', arepa: 'aventura' });
export const CUPS = CUP_DEFINITIONS.filter(cup => cup.available);

export function canonicalCupId(id) {
  return LEGACY_CUP_ALIASES[id] ?? id;
}

export function cupById(id, { includeUnavailable = false } = {}) {
  const canonical = canonicalCupId(id);
  const source = includeUnavailable ? CUP_DEFINITIONS : CUPS;
  return source.find(cup => cup.id === canonical) ?? source[0] ?? null;
}

export const cupTracks = (cup) => cup?.stages.map(item => item.track) ?? [];

export function cupDuration(cup) {
  const seconds = cup?.stages.reduce((sum, item) => sum + item.estimatedSeconds, 0) ?? 0;
  return { seconds: seconds + 3 * 12, minutes: Math.round((seconds + 36) / 60) };
}

export function validateCups(trackIds, { includeUnavailable = false } = {}) {
  const known = new Set(trackIds);
  const errors = [];
  const covered = [];
  for (const cup of includeUnavailable ? CUP_DEFINITIONS : CUPS) {
    if (cup.stages.length !== 4) errors.push(`${cup.id}: expected four stages`);
    const ids = cup.stages.map(item => item.track);
    if (new Set(ids).size !== ids.length) errors.push(`${cup.id}: duplicate stage`);
    for (const item of cup.stages) {
      if (!known.has(item.track)) errors.push(`${cup.id}: unknown track ${item.track}`);
      if (!Number.isInteger(item.laps) || item.laps < 1 || item.laps > 5) errors.push(`${cup.id}/${item.track}: invalid laps`);
      if (!(item.capSeconds > 0)) errors.push(`${cup.id}/${item.track}: invalid cap`);
    }
    covered.push(...ids);
  }
  if (new Set(covered).size !== covered.length) errors.push('a track appears in two available cups');
  for (const id of STANDALONE_TRACKS) {
    if (!known.has(id)) errors.push(`unknown standalone track ${id}`);
    if (covered.includes(id)) errors.push(`${id}: both a cup and standalone track`);
  }
  for (const id of known) if (!covered.includes(id) && !STANDALONE_TRACKS.includes(id)) errors.push(`${id}: no cup or standalone registration`); // i18n-ignore: developer error
  return { errors, covered, standalone: [...STANDALONE_TRACKS] };
}
