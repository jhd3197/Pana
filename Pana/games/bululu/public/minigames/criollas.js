import { random, inputFor } from '../online-rules.js';
import * as THREE from 'three';
import { createBolasWorld } from '/engine/worlds/bolas-world.js';
import { createCriollasMini } from './criollas-sim.js';
import { loc, locKey } from '/engine/i18n.js';

export default {
  id: 'criollas', title: locKey('¡Bolas Criollas!'), icon: 'coin', input: '2d', time: 38,
  howto: locKey('Tienes dos bolas. Arrima al mingo dorado: gana quien quede más cerca. La línea muestra dónde frenaría tu bola sin choques. Si el mingo sale, nadie gana.'),
  keys: [['← →', locKey('apuntar')], [locKey('Mantén Espacio'), locKey('fuerza')], [locKey('Suelta'), locKey('lanzar')]],
  touch: { pad: 'lr', action: locKey('Lanzar') }, frame: 'own',   // the bolas world frames its own court
  create(ctx) {
    // Isla Bululú plays its criollas on the beach court at Puerto Coco.
    const world = createBolasWorld({ aspect: ctx.aspect || innerWidth / innerHeight, individual: true, venue: 'puerto' });
    const sim = createCriollasMini(ctx.players.map(p => p.human && !ctx.auto), random);
    const local = ctx.localIndex ?? ctx.players.findIndex(p => p.human);
    // A camera-facing readout stays legible when the wide camera sees the sign
    // from the side. It belongs to this scene, with no persistent DOM overlay.
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 144;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const hud = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
    hud.renderOrder = 1000; hud.position.set(0, -1.12, -5); world.camera.add(hud); world.scene.add(world.camera);
    let lastLabel = '', lastAspect = world.camera.aspect;
    function draw(dt, winners = []) {
      if (world.camera.aspect !== lastAspect) { lastAspect = world.camera.aspect; world.fit(lastAspect); }
      const p = sim.players[Math.max(0, local)];
      const label = loc('{n} BOLAS · FUERZA {power}%', { n: p.left, power: Math.round(p.power * 100) });
      if (label !== lastLabel) {
        lastLabel = label; const c = canvas.getContext('2d'); c.clearRect(0, 0, 768, 144);
        c.fillStyle = '#0e0b24'; c.fillRect(0, 0, 768, 144);
        c.textAlign = 'center'; c.fillStyle = '#ffc629'; c.font = '38px "Luckiest Guy", sans-serif'; c.fillText(label, 384, 59);
        c.fillStyle = '#f3e9d7'; c.font = 'bold 26px Nunito, sans-serif';
        c.fillText(p.left ? loc('← → Apunta · Mantén Espacio y suelta para lanzar') : loc('¡Listo! Mira dónde quedan las bolas.'), 384, 112); texture.needsUpdate = true;
      }
      const width = Math.min(3.5, world.camera.aspect * 3.4); hud.scale.set(width, width * 144 / 768, 1); hud.visible = !sim.over();
      const shots = sim.players.map(s => s.human && s.left && !s.cooldown && sim.clock < 30 ? s : null);
      world.draw(sim.pitch, ctx.players, { dt, shots, winners, caption: loc('¡ARRIMA AL MINGO!'),
        subtitle: loc('{n} BOLAS · FUERZA {power}% · {s} s', { n: p.left, power: Math.round(p.power * 100), s: Math.max(0, Math.ceil(30 - sim.clock)) }) });
    }
    return { scene: world.scene, camera: world.camera, sim,
      update(dt, input) { sim.update(dt, sim.players.map((_, i) => inputFor(input, i))); draw(dt); },
      outro(dt, winners) { draw(dt, winners); }, scores: sim.scores, winners: sim.winners, over: sim.over,
      stats: () => ({ balls: sim.pitch.balls, left: sim.players.map(p => p.left) }),
    };
  },
};
