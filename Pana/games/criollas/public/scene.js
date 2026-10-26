import * as THREE from 'three';
import { createBolasWorld } from '/engine/worlds/bolas-world.js';
import { previewThrow } from '/engine/play/bolas-criollas.js';
import { difficultyInfo } from '/engine/play/difficulty.js';
import { bindRenderer, pixelRatio, rendererOptions } from '/engine/settings.js';
import { createStarterStage } from '/engine/play/quien-empieza.js';
import { TEAM_NAMES } from './rules.js';
import { loc } from '/engine/i18n.js';
import { createAimMarker } from './aim-marker.js';

// 'calce' stands behind the thrower looking down the court; 'arriba' looks
// straight down; 'cancha' is the wide side view.
export const VIEWS = [['calce', loc('Detrás del lanzador')], ['arriba', loc('Desde arriba')], ['cancha', loc('Vista de la cancha')]];
const teamNames = () => TEAM_NAMES.map(name => loc(name));

export function createScene(canvas) {
  const world = createBolasWorld(), renderer = new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true }));
  renderer.setPixelRatio(pixelRatio(1.5)); renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  let view = 'calce', size = { w: 1, h: 1 }, previewKey = '', preview = null;
  const aimMarker = createAimMarker(world.scene);
  function resize() {
    const rect = canvas.getBoundingClientRect(); size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
    renderer.setSize(size.w, size.h, false);
  }
  const unbind = bindRenderer(renderer, 1.5, { fit: 'canvas' });
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  // ¿Quién empieza?: a coin flipped between the two benches decides who throws the mingo.
  const opening = createStarterStage({ root: world.scene, camera: world.camera, canvas, scale: 1.1, names: teamNames(),
    spot: team => ({ position: [team ? 3.2 : -3.2, 0, 5.5], out: [team ? 1 : -1, 0] }) });
  let openingRevision = -1;
  return { ...world, renderer,
    render(state, { dt, shot, active }) {
      if (state.mapId && world.venue !== state.mapId) world.setVenue(state.mapId);
      const guide = difficultyInfo(state.difficulty).guide, own = active && state.phase === 'aiming';
      // Fácil plays the throw out on a copy of the pitch; only when the aim changes.
      if (own && guide.after >= 1) {
        const key = `${state.revision}:${shot.angle.toFixed(4)}:${shot.power.toFixed(3)}:${shot.mode}:${shot.loft}`;
        if (key !== previewKey) { previewKey = key; preview = previewThrow(state.pitch, state.turn, shot); }
      } else { previewKey = ''; preview = null; }
      const shots = state.players.map((_, i) => own && i === state.turn ? shot : null);
      world.draw(state.pitch, state.players, { dt, turn: state.phase === 'lobby' ? 0 : state.turn, shots, guide: { ...guide, ghost: false }, preview,
        winners: state.phase === 'finished' ? state.players.flatMap((_, i) => i % 2 === state.result.team ? [i] : []) : [],
        caption: 'BOLAS CRIOLLAS', subtitle: state.phase === 'lobby' ? 'LA CANCHA DE LOS PANAS' : `ROJOS ${state.scores[0]} · ${state.scores[1]} VERDES` });
      aimMarker.update(shot, guide, preview, own);
      // The shared court retains its simpler guides for Bululú.
      for (const child of world.scene.children) if (child.name === 'Aim guide') child.visible = false;
      // While a ball rolls, the thrower's camera leans toward it.
      const rolling = state.phase === 'rolling' ? state.pitch.balls.at(-1) : null;
      const lobby = state.phase === 'lobby', mode = lobby ? 'cancha' : view;
      world.view(mode, { aspect: size.w / size.h, dt, focus: rolling && !rolling.out ? rolling : null,
        lift: lobby || mode === 'arriba' ? 0 : Math.min(70, size.h * .09), width: size.w, height: size.h });
      if (state.revision !== openingRevision) { openingRevision = state.revision; opening.update(state.phase === 'opening' ? state.opening : null, { names: teamNames() }); }
      opening.frame(dt);
      renderer.render(world.scene, world.camera);
    },
    pick: (x, y) => world.point(x, y, canvas.getBoundingClientRect()),
    setView(value) { view = value; }, get view() { return view; }, get venue() { return world.venue; },
    get guides() { return { preview: !!preview, target: aimMarker.status }; }, opening,
    dispose() { observer.disconnect(); unbind(); opening.dispose(); world.dispose(); renderer.dispose(); },
  };
}
