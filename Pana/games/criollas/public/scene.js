import * as THREE from 'three';
import { createBolasWorld } from '/engine/worlds/bolas-world.js';
import { previewThrow } from '/engine/play/bolas-criollas.js';
import { difficultyInfo } from '/engine/play/difficulty.js';
import { bindRenderer, pixelRatio } from '/engine/settings.js';

// 'calce' stands behind the thrower looking down the court; 'arriba' looks
// straight down; 'cancha' is the wide side view.
export const VIEWS = [['calce', 'Detrás del lanzador'], ['arriba', 'Desde arriba'], ['cancha', 'Vista de la cancha']];

export function createScene(canvas) {
  const world = createBolasWorld(), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio(1.5)); renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  let view = 'calce', size = { w: 1, h: 1 }, previewKey = '', preview = null;
  function resize() {
    const rect = canvas.getBoundingClientRect(); size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
    renderer.setSize(size.w, size.h, false);
  }
  const unbind = bindRenderer(renderer, 1.5, { fit: 'canvas' });
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return { ...world, renderer,
    render(state, { dt, shot, active }) {
      if (state.mapId && world.venue !== state.mapId) world.setVenue(state.mapId);
      const guide = difficultyInfo(state.difficulty).guide, own = active && state.phase === 'aiming';
      // Fácil plays the throw out on a copy of the pitch; only when the aim changes.
      if (own && guide.after >= 1) {
        const key = `${state.revision}:${shot.angle.toFixed(4)}:${shot.power.toFixed(3)}:${shot.mode}`;
        if (key !== previewKey) { previewKey = key; preview = previewThrow(state.pitch, state.turn, shot); }
      } else { previewKey = ''; preview = null; }
      const shots = state.players.map((_, i) => own && i === state.turn ? shot : null);
      world.draw(state.pitch, state.players, { dt, turn: state.phase === 'lobby' ? 0 : state.turn, shots, guide, preview,
        winners: state.phase === 'finished' ? state.players.flatMap((_, i) => i % 2 === state.result.team ? [i] : []) : [],
        caption: 'BOLAS CRIOLLAS', subtitle: state.phase === 'lobby' ? 'LA CANCHA DE LOS PANAS' : `ROJOS ${state.scores[0]} · ${state.scores[1]} VERDES` });
      // While a ball rolls, the thrower's camera leans toward it.
      const rolling = state.phase === 'rolling' ? state.pitch.balls.at(-1) : null;
      const lobby = state.phase === 'lobby', mode = lobby ? 'cancha' : view;
      world.view(mode, { aspect: size.w / size.h, dt, focus: rolling && !rolling.out ? rolling : null,
        lift: lobby || mode === 'arriba' ? 0 : Math.min(70, size.h * .09), width: size.w, height: size.h });
      renderer.render(world.scene, world.camera);
    },
    pick: (x, y) => world.point(x, y, canvas.getBoundingClientRect()),
    setView(value) { view = value; }, get view() { return view; }, get venue() { return world.venue; },
    get guides() { return { preview: !!preview }; },
    dispose() { observer.disconnect(); unbind(); world.dispose(); renderer.dispose(); },
  };
}
