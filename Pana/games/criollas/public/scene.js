import * as THREE from 'three';
import { createBolasWorld } from '/engine/bolas-world.js';
import { onSettings, pixelRatio } from '/engine/settings.js';

export function createScene(canvas) {
  const world = createBolasWorld(), renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio(1.5)); renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  let overhead = false;
  function resize() { const rect = canvas.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); world.fit(rect.width / Math.max(1, rect.height), overhead); }
  const unbind = onSettings(() => { renderer.setPixelRatio(pixelRatio(1.5)); resize(); });
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return { ...world, renderer,
    render(state, { dt, shot, active }) {
      const shots = state.players.map((_, i) => active && i === state.turn ? shot : null);
      world.draw(state.pitch, state.players, { dt, turn: state.phase === 'lobby' ? 0 : state.turn, shots,
        winners: state.phase === 'finished' ? state.players.flatMap((_, i) => i % 2 === state.result.team ? [i] : []) : [],
        caption: 'BOLAS CRIOLLAS', subtitle: state.phase === 'lobby' ? 'LA CANCHA DE LOS PANAS' : `ROJOS ${state.scores[0]} · ${state.scores[1]} VERDES` });
      renderer.render(world.scene, world.camera);
    },
    pick: (x, y) => world.point(x, y, canvas.getBoundingClientRect()),
    setView(value) { overhead = value === 'arriba'; resize(); },
    dispose() { observer.disconnect(); unbind(); world.dispose(); renderer.dispose(); },
  };
}
