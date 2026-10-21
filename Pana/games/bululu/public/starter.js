// ¿Quién empieza? on the island: a row of cachos in front of the start tile,
// one per pana, and the whole turn order out of the dice. The rules object
// (engine/play/quien-empieza-rules.js) travels in the host's published state
// and its checkpoint, so guests draw it and a new host keeps stepping it.
import * as THREE from 'three';
import { createStarter, starterInput, stepStarter, starterDone, starterResult } from '/engine/play/quien-empieza-rules.js';
import { createStarterStage } from '/engine/play/quien-empieza.js';

const STEP = 0.1, SPACING = 1.9, SCALE = 1.4;

export function createBululuStarter({ scene, camera, canvas, board, players, onInput }) {
  const tile = board.spot(0, 0, 1);
  const stage = createStarterStage({ root: scene, camera, canvas, scale: SCALE, onInput,
    spot: (seat) => {
      // A row across the front of the start tile, toward the camera.
      const x = tile.x + (seat - (players.length - 1) / 2) * SPACING, z = tile.z + 3.4;
      const token = players[seat].token.rest, out = [token.x - x, token.z - z], size = Math.hypot(...out) || 1;
      return { position: [x, Math.max(board.groundAt(x, z), tile.y - 0.2) + 0.02, z], out: [out[0] / size, out[1] / size] };
    } });
  let state = null;
  return {
    get state() { return state; },
    centre: () => new THREE.Vector3(tile.x, tile.y, tile.z + 3),
    // Host or solo: run the cachos to the end; resolves with the turn order.
    // bots() lists the seats nobody is playing right now; changed() publishes.
    async run({ resume, option, last, bots, wait, changed, ownSeat }) {
      state = resume || createStarter({ seats: players.map((p) => p.i), need: 'order', seed: Math.floor(Math.random() * 2 ** 31), option, last });
      changed(state);
      while (!starterDone(state)) {
        stage.update(state, { ownSeat: ownSeat(), names: players.map((p) => p.name) });
        await wait(STEP);
        // The last change goes out with the new turn order, never before it.
        if (stepStarter(state, STEP, { bots: bots() }) && !starterDone(state)) changed(state);
      }
      const { order } = starterResult(state);
      state = null; stage.update(null); changed(null);
      return order;
    },
    // Host or solo: a pana's shake or slam.
    input(seat, cacho, power) {
      if (!state || !starterInput(state, seat, cacho, power)) return false;
      stage.update(state); return true;
    },
    // Guests: draw the host's cachos.
    show(next, ownSeat) { stage.update(next, { ownSeat, names: players.map((p) => p.name) }); },
    frame: (dt) => stage.frame(dt),
    stage,
  };
}
