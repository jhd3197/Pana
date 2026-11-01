// Pepazo's collision debug mode (?debugCollision=1 or F9; Shift+F9 or the
// button saves the JSON report). game.js imports this only when it is asked for.
import { createCollisionDebug } from '/engine/play/collision-debug.js';
import { paintArenaInfo } from '/engine/worlds/arena-layouts.js';
import { loc } from '/engine/i18n.js';
import { collidersFor, COLLISION_ALLOW, SHOT_FLIGHT } from './colliders.js';

export function attachCollisionDebug(world, current) {
  const debug = createCollisionDebug(world.scene), button = document.createElement('button');
  button.type = 'button'; button.className = 'pk-btn'; button.textContent = loc('Descargar colisiones'); button.hidden = true;
  Object.assign(button.style, { position: 'fixed', left: '12px', bottom: '12px', zIndex: 50 });
  button.addEventListener('click', () => debug.download()); document.body.append(button);
  // Stands map `map`, variant `variant` and measures it (the headless report calls this per court).
  async function audit(map, variant = 0) {
    // Every frame draw() stands the room's court again, which can win while a shared
    // court's module is still loading: retry until the asked one stands (then it is cached).
    for (let i = 0; i < 5; i++) { await world.setMap(map, variant); if ((world.mapGroup().userData.mapId ?? 'plaza') === map) break; }
    if ((world.mapGroup().userData.mapId ?? 'plaza') !== map) throw new Error(`collision debug: ${map} did not load`);
    return { ...debug.audit({ root: world.mapGroup(), colliders: collidersFor(map, variant), map, variant, shotHeight: SHOT_FLIGHT, allow: COLLISION_ALLOW }), mapName: paintArenaInfo(map).name, allow: COLLISION_ALLOW };
  }
  window.PANA_COLLISION = { audit, debug, root: () => world.mapGroup() };
  return {
    async toggle(on = !debug.overlay.visible) {
      if (on) { const { mapId, variant } = current(); await audit(mapId, variant || 0); }
      debug.show(on); button.hidden = !on; return on;
    },
    async download() { if (!debug.report) { const { mapId, variant } = current(); await audit(mapId, variant || 0); } debug.download(); },
  };
}
