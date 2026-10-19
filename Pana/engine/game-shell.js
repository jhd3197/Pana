// The parts of every game.js that are not the game: the room code in the URL,
// loading and preparing the 3D scene (with a retry), the simulation timer, the
// render loop and teardown when the page goes away. Games made with
// `.\dev.ps1 new-game` start from this; game.js keeps only wiring.
//
//   const code = roomCode();
//   const room = new MyRoom({ code, … });
//   export const { sceneReady } = bootGame({
//     load: async () => (await import('./scene.js')).createMyScene($('world')),
//     ready: (world) => render(room.state),
//     tick: (dt) => room.tick(dt, menu.isOpen && room.members.size <= 1),
//     frame: (dt, world) => world.frame(dt),
//     dispose: () => room.dispose(),
//   });
//
// The shared lobby (engine/game-entry.js) waits for sceneReady before it says
// the game is prepared.
import { newRoomCode, roomFromUrl } from './invite.js';
import { prepareScene } from './game-load.js';
import { elapsedClock } from './live-room.js';

// The invite code from ?room=, or a new one written back into the URL so a
// reload or a copied link lands in the same room.
export function roomCode() {
  const code = roomFromUrl() || newRoomCode();
  const params = new URLSearchParams(location.search);
  if (params.get('room') !== code) { params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`); }
  return code;
}

export function bootGame({ load, ready = () => {}, tick, tickMs = 100, frame, dispose = () => {}, loadingId = 'loading' }) {
  let world = null, stopped = false;
  const clock = elapsedClock();
  const timer = tick ? setInterval(() => { if (!stopped) tick(clock(), world); }, tickMs) : null;
  let last = performance.now();
  const loop = (now) => {
    if (stopped) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (world) frame?.(dt, world);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const sceneReady = Promise.resolve().then(load).then(async (created) => {
    if (stopped) return;
    world = created;
    await prepareScene(world);
    ready(world);
    const loading = document.getElementById(loadingId); if (loading) loading.hidden = true;
  }).catch((error) => {
    console.error(error);
    const loading = document.getElementById(loadingId);
    if (loading && !loading.querySelector('[data-retry]')) {
      const button = document.createElement('button');
      button.className = 'pk-btn'; button.dataset.retry = ''; button.textContent = 'Volver a intentar';
      button.onclick = () => location.reload();
      loading.append(button);
    }
    throw error;
  });

  function stop() {
    if (stopped) return;
    stopped = true; clearInterval(timer);
    dispose(world); world?.dispose?.();
  }
  addEventListener('pagehide', stop, { once: true });
  return { sceneReady, stop, get world() { return world; } };
}
