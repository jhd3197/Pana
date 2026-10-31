// Rendering only: no quality option changes racers, surfaces or network cadence.
export const RACE_QUALITY = {
  alta: { detail: 2, rain: 1400 },
  media: { detail: 1, rain: 700 },
  baja: { detail: 0, rain: 280 },
};
// Sun shadow edge per shadow setting. Races drop the sun's shadow from Bajas
// down: across a whole circuit a 512² map shows little and still costs a pass.
export const RACE_SHADOWS = { alta: 2048, media: 1024, baja: 0, off: 0 };

// `settings` is the shared settings ({ detail, shadows }) or one tier for both.
export function applyRaceQuality(renderer, race, settings) {
  const { detail = 'alta', shadows = detail } = typeof settings === 'string' ? { detail: settings } : settings || {};
  const q = RACE_QUALITY[detail] || RACE_QUALITY.alta, size = RACE_SHADOWS[shadows] ?? 2048;
  renderer.shadowMap.enabled = size > 0;
  const shadow = race.sun?.shadow;
  if (shadow && size && shadow.mapSize.x !== size) {
    shadow.map?.dispose(); shadow.map = null;
    shadow.mapSize.set(size, size);
    shadow.needsUpdate = true;
  }
  race.rain?.lines.geometry.setDrawRange(0,q.rain*2);
  if (race.rain?.snow) race.rain.snow.geometry.instanceCount = q.rain;
  race.trackGroup?.traverse(o => {
    o.userData.setForestDetail?.(q.detail);
    o.userData.setMapDetail?.(q.detail);
    if (o.userData.detailLevel != null) o.visible = o.userData.detailLevel <= q.detail;
    if (o.userData.grassField) o.count = q.detail === 2 ? o.userData.grassField.full : q.detail === 1 ? o.userData.grassField.medium : 0;
    if (o.userData.petalField) o.geometry.instanceCount = q.detail === 2 ? o.userData.petalField.full : q.detail === 1 ? o.userData.petalField.medium : 0;
    for (const material of [].concat(o.material || [])) {
      if (material.userData.roadDetail) material.userData.roadDetail.value = q.detail / 2;
      if (material.userData.natureDetail) material.userData.natureDetail.value = q.detail;
    }
  });
}
