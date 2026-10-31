import { loc } from '../../../engine/i18n.js';
// Absent or empty in the public build; the pana.sh overlay fills it.
const { PREMIUM_CUPS = [] } = await import('./premium-tracks.js').catch(() => ({}));
export const CURRENT_CUP_EDITION = 3;
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
      stage('llanos', 2, 160),
      stage('delta', 3, 165),
      stage('galipan', 2, 155),
    ],
  },
  // Extra cups from premium-tracks.js (empty in the public build).
  ...PREMIUM_CUPS.map(cup => ({
    ...cup, edition: CURRENT_CUP_EDITION, available: true,
    stages: cup.stages.map(item => stage(item.track, item.laps, item.estimatedSeconds)),
  })),
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
