// Adapted from Super Bash Folds (MIT); see ../../SOURCE.md.

import {
  DEFAULT_STAGE_ID as DEFAULT_OPEN_STAGE_ID,
  OPEN_STAGE_IDS,
  OPEN_STAGE_PACKS,
} from "./generated/openStageRegistry.js";

export const STAGE_IDS = [...OPEN_STAGE_IDS]                             ;

export const DEFAULT_STAGE_ID          = STAGE_IDS[0] ?? DEFAULT_OPEN_STAGE_ID;

const generatedStagePacks = OPEN_STAGE_PACKS                                            ;

const openStageDefinitions = generatedStagePacks.map((pack)                  => ({
  id: pack.id,
  displayName: pack.identity.displayName,
  series: pack.identity.series,
  identity: pack.identity.description,
  previewUrl: pack.runtime.previewUrl,
  thumbnailUrl: pack.runtime.thumbnailUrl,
  renderUrl: pack.runtime.arenaUrl,
  backdropUrl: pack.runtime.backdropUrl,
  ...(pack.render.kind === "3d" && pack.render.scene && pack.runtime.sceneUrl ? {
    scene: {
      url: pack.runtime.sceneUrl,
      scale: pack.render.scene.scale,
      offset: pack.render.scene.offset,
      cameraDirection: pack.render.scene.cameraDirection,
    },
  } : {}),
  art: pack.render.art,
  platforms: pack.gameplay.platforms,
  ledges: pack.gameplay.ledges,
  spawns: pack.gameplay.spawns,
  blastZone: pack.gameplay.blastZone,
  colors: pack.colors,
  license: pack.license,
}));

export const STAGE_DEFINITIONS = Object.fromEntries(
  openStageDefinitions.map((definition) => [definition.id, definition]),
)                                              ;

export const getStageDefinition = (id         )                  =>
  STAGE_DEFINITIONS[id];

export const stageSurfaceYAt = (
  platform                                                                            ,
  worldX        ,
)         => {
  const fallback = platform.y + platform.height / 2;
  const [leftY, rightY] = platform.surfaceY ?? [fallback, fallback];
  if (platform.width <= 0) return (leftY + rightY) / 2;
  const leftX = platform.x - platform.width / 2;
  const ratio = Math.max(0, Math.min(1, (worldX - leftX) / platform.width));
  return leftY + (rightY - leftY) * ratio;
};

export const stagePixelToWorld = (
  stage         ,
  point                                    ,
)                           => {
  const calibration = STAGE_DEFINITIONS[stage].art;
  return {
    x: (point.x - calibration.originPx.x) * calibration.worldUnitsPerPixel,
    y: (calibration.originPx.y - point.y) * calibration.worldUnitsPerPixel,
  };
};

export const stageWorldToPixel = (
  stage         ,
  point                                    ,
)                           => {
  const calibration = STAGE_DEFINITIONS[stage].art;
  return {
    x: point.x / calibration.worldUnitsPerPixel + calibration.originPx.x,
    y: calibration.originPx.y - point.y / calibration.worldUnitsPerPixel,
  };
};
