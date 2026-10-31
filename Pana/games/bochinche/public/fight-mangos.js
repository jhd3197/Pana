// Mangos a fight pays: by place, per KO and per award. Pure, so tests can
// check the amounts; the results screen pays them into the shared wallet.
import { locKey } from '../../../engine/i18n.js';

export const PLACE_MANGOS = [15, 10, 6, 4, 2, 1];
export const KO_MANGOS = 3, AWARD_MANGOS = 5;

// lines: [labelKey, vars, mangos, pluralKey?] for the breakdown under the stats table.
export function fightMangos({ rank, kos = 0, awards = [] }) {
  const lines = [[locKey('{n}º puesto'), { n: rank }, PLACE_MANGOS[rank - 1] ?? 0]];
  if (kos > 0) lines.push([locKey('{n} KO'), { n: kos }, kos * KO_MANGOS, locKey('{n} KOs')]);
  for (const title of awards) lines.push([title, {}, AWARD_MANGOS]);
  return { total: lines.reduce((sum, [, , n]) => sum + n, 0), lines };
}
