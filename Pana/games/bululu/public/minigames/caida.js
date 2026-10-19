import { random, inputFor } from '../online-rules.js';
// ¡Caída! Four panas around the card table. Cards flip from the deck one at a
// time; when one matches the rank of the card before it, the first to slam
// takes both. Slamming on no match costs a point and a moment of shame.

import * as THREE from 'three';
import { Puffs, sound } from '/engine/fx.js';
import { createGameTable } from '/engine/models/props/game-table.js';
import { createSpanishCard, SUIT_COLORS } from '/engine/models/props/spanish-cards.js';
import { sunnyStage, makeActors, animateActor, rand, pick } from './stage.js';

const TIME = 30;
const TABLE = 0.8;                 // the domino table, scaled down for standing panas
const TOP = 1.454 * TABLE + 0.004; // felt height
const CARD = 2.3;                  // card scale on the felt
const BEFORE = new THREE.Vector3(-0.95, TOP, 0.2), NOW = new THREE.Vector3(0.95, TOP, 0.2);
const DECK = new THREE.Vector3(0, TOP, -1.75);
const FLIP = 0.26;                 // seconds a card takes from the deck to the felt
const LOCK = 0.8;                  // lockout after a wrong slam
const MATCH_ODDS = 0.3;            // how often the deck is nudged into a caída


const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const SUITS = ['oros', 'copas', 'espadas', 'bastos'];
const fullDeck = () => SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${suit}-${rank}`, suit, rank })));

// how long an AI pana takes to see a caída; quicker as the game heats up
const aiReaction = (progress) => rand(0.3, 0.62) - progress * 0.08;

// Painted on the felt in front of a card spot: its name and, big, the rank of
// the card lying there, so a caída reads at a glance.
function spotPlate(caption) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const c = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  let shown;
  const show = (card) => {
    if (shown === (card?.id ?? null)) return;
    shown = card?.id ?? null;
    c.clearRect(0, 0, 256, 128);
    c.textAlign = 'center';
    c.fillStyle = 'rgba(240, 232, 200, 0.8)';
    c.font = '30px "Luckiest Guy", sans-serif';
    c.fillText(caption, 128, 30);
    if (card) {
      c.fillStyle = '#fbf2df';
      c.beginPath(); c.roundRect(88, 38, 80, 86, 14); c.fill();
      c.fillStyle = SUIT_COLORS[card.suit];
      c.font = '72px "Luckiest Guy", sans-serif';
      c.fillText(String(card.rank), 128, 112);
    }
    tex.needsUpdate = true;
  };
  show(null);
  return { mesh, show };
}

export default {
  id: 'caida',
  title: '¡Caída!',
  howto: 'Cuando la carta nueva tenga el mismo número que la de antes, ¡dale primero! Si le das sin caída, pierdes un punto.',
  keys: [['Espacio', '¡dale!']],
  touch: { pad: 'none', action: '¡Dale!' },
  icon: 'card',
  time: TIME,

  create(ctx) {
    const scene = new THREE.Scene();
    const stage = sunnyStage(scene);
    const puffs = new Puffs(scene);

    const table = createGameTable({ feltColor: '#245e50', caption: 'CAÍDA · ENTRE PANAS' });
    table.scale.setScalar(TABLE);
    scene.add(table);
    const plates = [['ANTES', BEFORE], ['AHORA', NOW]].map(([text, at]) => {
      const p = spotPlate(text);
      p.mesh.position.set(at.x, TOP + 0.002, 1.95);
      scene.add(p.mesh);
      return p;
    });
    // the deck: a face-down stack
    const deckCard = createSpanishCard();
    deckCard.userData.faceUp(false);
    deckCard.scale.set(CARD * 0.6, CARD * 2.5, CARD * 0.6);
    deckCard.position.copy(DECK);
    scene.add(deckCard);

    const camera = new THREE.PerspectiveCamera(45, (ctx.aspect || innerWidth / innerHeight), 0.1, 400);
    camera.position.set(0, 7.6, 6.4);
    camera.lookAt(0, 1, -1);

    const actors = makeActors(scene, ctx.players, ctx);
    const spots = actors.map((_, i) => { const a = Math.PI + i * Math.PI / (actors.length - 1); return [Math.cos(a) * 3.8, Math.sin(a) * 3.8]; });
    actors.forEach((a, i) => {
      [a.x, a.z] = spots[i];
      a.home = new THREE.Vector2(a.x, a.z);
      a.face = Math.atan2(-a.x, -a.z);
      a.pana.group.rotation.order = 'YXZ';
      a.slap = 0;
      a.lock = 0;
      a.plan = null;   // AI: { at, serial }
    });
    const human = (a) => a.player.human && !ctx.auto;

    // cards: one model per card id, created on first use
    const models = new Map();
    const model = (card) => {
      if (!models.has(card.id)) {
        const m = createSpanishCard(card);
        m.scale.setScalar(CARD);
        models.set(card.id, m);
      }
      const m = models.get(card.id);
      m.userData.highlight(false);
      m.scale.setScalar(CARD);
      scene.add(m);
      return m;
    };

    let deck = [];
    let before = null, now = null;   // { card, m, from, to, t, dur, flip }
    const flying = [];               // cards swept to a winner
    let serial = 0;                  // bumps whenever the cards on the felt change
    let nextIn = 0.8, clock = 0, lastWin = -1;

    function draw() {
      if (!deck.length) {
        const onFelt = new Set([before, now].filter(Boolean).map((c) => c.card.id));
        deck = fullDeck().filter((c) => !onFelt.has(c.id));
        // A random sort comparator can consume a different stream in another
        // browser. Fisher-Yates gives every client the same deck and RNG state.
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
      }
      // nudge a caída in now and then; a plain shuffle makes them too rare
      if (now && random() < MATCH_ODDS) {
        const k = deck.findIndex((c) => c.rank === now.card.rank);
        if (k >= 0) deck.push(deck.splice(k, 1)[0]);
      }
      return deck.pop();
    }

    const isMatch = () => !!(before && now && now.t >= FLIP * 0.6 && now.card.rank === before.card.rank);

    function deal() {
      if (before) scene.remove(before.m);
      before = now;
      if (before) Object.assign(before, { from: before.m.position.clone(), to: BEFORE.clone(), t: 0, dur: 0.2, flip: false });
      const card = draw();
      const m = model(card);
      m.position.copy(DECK);
      now = { card, m, from: DECK.clone(), to: NOW.clone(), t: 0, dur: FLIP, flip: true };
      now.to.y += 0.01;
      m.rotation.y = rand(-0.06, 0.06);
      serial++;
      sound.tick();
      const progress = clock / TIME;
      const match = before && card.rank === before.card.rank;
      // AI panas decide when (and whether) they'll slam this card
      for (const a of actors) {
        if (human(a)) continue;
        a.plan = null;
        if (match) a.plan = { at: clock + FLIP * 0.6 + aiReaction(progress), serial };
        else if (before && random() < 0.02) a.plan = { at: clock + FLIP + rand(0.25, 0.5), serial };
      }
      const interval = 1.15 - 0.45 * progress;
      nextIn = match ? Math.max(interval, 1.05) : interval;
    }

    function slam(a) {
      if (a.lock > 0 || a.slap > 0) return;
      a.slap = 0.001;
      if (isMatch()) {
        a.score += 1;
        lastWin = clock;
        a.bubble.say(pick(['¡CAÍDA!', '¡Mía!', '¡Epa!']), 0.9);
        sound.bonk(0.6);
        if (human(a)) sound.pickup();
        const to = new THREE.Vector3(a.x, TOP + 1.2, a.z);
        for (const c of [before, now]) {
          c.m.userData.highlight(true);
          flying.push({ m: c.m, from: c.m.position.clone(), to, t: 0 });
        }
        puffs.spawn(NOW.clone().setY(TOP + 0.3), { color: new THREE.Color(a.player.color).getHex(), count: 6, spread: 1, size: 0.5, rise: 1.5, life: 0.6 });
        before = now = null;
        serial++;
        nextIn = 0.75;
      } else if (clock - lastWin < 0.4) {
        a.bubble.say('¡Tarde!', 0.7);   // beaten to it: no penalty
      } else {
        a.score -= 1;
        a.lock = LOCK;
        a.bubble.say(pick(['−1 ¡No era!', '−1 ¡Upa!', '−1 ¡Ay, no!']), 0.9);
        sound.boing();
        puffs.spawn(NOW.clone().setY(TOP + 0.3), { color: 0xd04a3a, count: 4, spread: 0.7, size: 0.4, rise: 1, life: 0.5 });
      }
    }

    function moveCard(c, dt) {
      c.t += dt;
      const k = Math.min(1, c.t / c.dur), e = k * k * (3 - 2 * k);
      c.m.position.lerpVectors(c.from, c.to, e);
      if (c.flip) {
        c.m.position.y += Math.sin(Math.PI * k) * 0.9;
        // a fake flip: squash across, swap faces at the halfway point
        c.m.scale.x = CARD * Math.max(0.04, Math.abs(Math.cos(Math.PI * k)));
        c.m.userData.faceUp(k > 0.5);
        if (k >= 1) c.m.scale.x = CARD;
      }
    }

    function pose(a, dt, { win = false, lose = false } = {}) {
      // slap: wind up, smack down onto the pile, come back
      let reach = 0, lift = 0;
      if (a.slap > 0) {
        a.slap += dt;
        const p = a.slap / 0.5;
        lift = p < 0.35 ? p / 0.35 : 0;
        reach = p < 0.35 ? 0 : p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.4);
        if (p >= 1) a.slap = 0;
      }
      a.x = a.home.x + Math.sin(a.face) * 0.5 * reach;   // lean toward the table
      a.z = a.home.y + Math.cos(a.face) * 0.5 * reach;
      animateActor(a, dt, { moving: 0, open: win || a.lock > 0 || reach > 0, dizzy: a.lock > 0, armsUp: win ? 1.8 : lose ? 0.2 : 0.6 });
      a.pana.group.rotation.y = a.face;
      a.pana.group.rotation.x = reach * 0.35;
      if (a.slap > 0) a.pana.armR.rotation.x = -0.6 - lift * 2.2 - reach * 0.9;
      // the back panas talk out to the side, clear of the score cards
      if (a.home.y < 0) a.bubble.sprite.position.set(a.x + Math.sign(a.x) * 1.9, a.y + 2.3, a.z);
    }

    let skyTime = 0;
    function update(dt, input) {
      skyTime += dt; stage.update(skyTime);
      clock += dt;
      nextIn -= dt;
      if (nextIn <= 0) deal();
      for (const c of [before, now]) if (c) moveCard(c, dt);
      plates[0].show(before?.card);
      plates[1].show(now && now.t >= FLIP * 0.6 ? now.card : null);

      // Everyone who slams in the same step slams at the same moment (online,
      // a step is 50 ms). On a caída one of them, drawn from the game's random
      // stream, takes the cards and the rest were just late: seat order must
      // never decide who was first.
      const slams = [];
      for (const a of actors) {
        a.lock = Math.max(0, a.lock - dt);
        if (human(a)) {
          if (inputFor(input, a.i).jump) slams.push(a);
        } else if (a.plan && clock >= a.plan.at) {
          if (a.plan.serial === serial) slams.push(a);
          a.plan = null;
        }
      }
      const ready = slams.filter((a) => a.lock <= 0 && a.slap <= 0);
      if (ready.length > 1 && isMatch()) slam(ready[Math.floor(random() * ready.length)]);
      for (const a of slams) slam(a);
      for (const a of actors) pose(a, dt);
      updateFlying(dt);
      puffs.update(dt);
    }

    function updateFlying(dt) {
      for (const f of flying) {
        f.t += dt;
        const k = Math.min(1, f.t / 0.35);
        f.m.position.lerpVectors(f.from, f.to, k);
        f.m.position.y += Math.sin(Math.PI * k) * 0.6;
        f.m.scale.setScalar(CARD * (1 - k * 0.7));
        if (k >= 1) { scene.remove(f.m); f.done = true; }
      }
      for (let i = flying.length - 1; i >= 0; i--) if (flying[i].done) flying.splice(i, 1);
    }

    function outro(dt, winners) {
      clock += dt;
      for (const a of actors) {
        const win = winners.includes(a.i);
        a.y = win ? Math.abs(Math.sin(clock * 6)) * 0.8 : 0;
        pose(a, dt, { win, lose: !win });
      }
      for (const c of [before, now]) if (c) moveCard(c, dt);
      updateFlying(dt);
      puffs.update(dt);
    }

    return { scene, camera, update, outro, scores: () => actors.map((a) => a.score), actors };
  },
};
