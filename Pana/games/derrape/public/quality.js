// Rendering only: no quality option changes racers, surfaces or network cadence.
export const RACE_QUALITY = {
  alta: { detail: 2, shadows: true, shadowSize: 2048, rain: 1400 },
  media: { detail: 1, shadows: true, shadowSize: 1024, rain: 700 },
  baja: { detail: 0, shadows: false, shadowSize: 512, rain: 280 },
};

export function applyRaceQuality(renderer, race, quality) {
  const q = RACE_QUALITY[quality] || RACE_QUALITY.alta;
  renderer.shadowMap.enabled = q.shadows;
  const shadow = race.sun?.shadow;
  if (shadow && shadow.mapSize.x !== q.shadowSize) {
    shadow.map?.dispose(); shadow.map = null;
    shadow.mapSize.set(q.shadowSize,q.shadowSize);
    shadow.needsUpdate = true;
  }
  race.rain?.lines.geometry.setDrawRange(0,q.rain*2);
  race.trackGroup?.traverse(o => {
    if (o.userData.detailLevel != null) o.visible = o.userData.detailLevel <= q.detail;
    if (o.material?.userData?.roadDetail) o.material.userData.roadDetail.value = q.detail / 2;
  });
}
