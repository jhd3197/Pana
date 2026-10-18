import { createSky } from '/engine/sky.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from './cars.js';
import { WHEEL_DEFINITIONS, wheelById, composeTune } from './wheel-definitions.js';
import { garageCards, wheelCards } from './garage-cards.js';
import { createTaller } from './taller.js';
import { partsProfile, renderConfig } from './parts.js';
import { studioEnvironment, studioRims, showroomPaint } from './garage-stage.js';
import { garageBloom } from './garage-bloom.js';
import { owns } from './shop.js';
import { paintNext } from './loading.js';
import { createMenuFlow } from './menu-flow.js';
import { setMenuImage, trackArt } from './menu-art.js';
import { sound, Puffs, Debris, Shockwaves, makeBubble, setSpeedLines, flyToCounter } from '/engine/fx.js';
import { createItems, ITEMS, SPIN } from './items.js';
import { activeItem, canBlock, coinMultiplier, COIN_SPEED, MAX_COINS, AIMED, isJuiced } from './item-rules.js';
import { ITEM_ICONS } from './item-art.js';
import { TRACKS, getTrack, makeTrack } from './tracks.js';
import { roughnessAt,roadGripAt,roadWaterAt } from './offroad.js';
import { START_GHOST_TIME, RESCUE_GHOST_TIME, isGhost, recordImpact, stepProtection } from './recovery-rules.js';
import { loadAvatar, loadName, randomAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { fillRoster } from '/engine/results.js';
import { ICONS as SVG } from '/engine/icons.js';
import { holdButton } from '/engine/touch.js';
import { pixelRatio, bindRenderer, getSettings, onSettings } from '/engine/settings.js';
import { applyRaceQuality } from './quality.js';
import { shout } from '/engine/kit.js';
import { LAPS, lapsForTrack, RIVALS, AI_WHEELS, POSE_HZ, FLAG, DRIFT_SHIFT, FINISH_GRACE_MS, GP_GRID, GP_INTERMISSION_MS, GP_MIN_READ_MS, packPose, gridSlot, cleanCosmetics } from './online-rules.js';
import { clockText, wrapAngle, raceOrder, aiPedals, resolveContact } from './rules.js';
import { CUPS, cupById, cupTracks, difficultyById, rubberBand, cleanLaps, BALLOONS, BATTLE_TIME, battleOrder, battleOver } from './modes.js';
import { abandonCup, advanceStage, beginStage, createCupSession, cupTrophy, finalizeStage, markRacing, markStarted, retryStage, seededOrder, seededUnit, standings as championshipStandings } from './cup-rules.js';
import { advanceLap, isOpenEdge, offCourse, stuckStep, ALL_SECTORS, RESCUE_TIME, OUT_TIME, STUCK_TIME, OPEN_MARGIN } from './course-rules.js';
import { createHazards } from './hazards.js';
import { createMusic, TRACK_STYLE, GARAGE_SONG, RESULTS_SONG, songFor, finishSting } from './music.js';
import { racerPortrait } from './racer-portrait.js';
import { batchRacer } from './racer-render.js';
import { createWaterAmbience } from './water-ambience.js';
import { padInput, pressed, keyInput, SPLIT_KEYS, wrongWayStep, WRONG_WAY_TIME, lapSplit } from './controls.js';
import { PAINTS, FLAMES, earnings, mirrorUnlocked, repaintHex } from './shop.js';
import { createProfileStore, recordCupTrophy, trophyCredits } from './cup-profile.js';
import { rewardCupCompletion, rewardCupStage } from './cup-rewards.js';
import { CLASSIFICATION_TEXT, approximateCupText, cupStandingsView, nextStageText, rankChangeText, tiebreakText } from './cup-ui.js';
import { soaringVulture } from '/engine/models/fauna/birds/soaring-vulture.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { DRIFT_MIN_SPEED, DRIFT_BOOST, HOP_SPEED, DRIFT_EXIT_TIME, DRAFT_TIME, DRAFT_BOOST, driftLevel, driftSteer, assistDrift, driftCharge, startBoost, trickBoost, inSlipstream, loseCoins } from './drive-rules.js';

const $ = (id) => document.getElementById(id);
const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const G = 30;   // cartoon gravity: snappy jumps
// test switches: ?auto lets the AI drive your car, ?speed=4 fast-forwards
const QS = new URLSearchParams(location.search);
const AUTO = QS.has('auto');
const SPEED = Number(QS.get('speed')) || 1;
const DEBUG = QS.has('debug');

// You drive as the pana you made in the hub; the rivals are random ones.
const ME = { name: loadName(), avatar: loadAvatar() };
// ?room=<code> races online with panas (online.js); without it the race is local.
// ?lead=1 marks the party's Pana Mayor, who hosts the room.
const ROOM = roomFromUrl();
const onlineModulePromise = ROOM ? import('./online.js') : null;
let net = null;
let menuFlow = null;

const LINES = {
  crash: ['¡AY!', '¡UEPA!', '¡Ñooo!', '¡Mi carro!', '¡Epa, chamo!', '¡Qué molleja!'],
  air: ['¡Wiii!', '¡Ayayay!', '¡Me fui!'],
  wall: ['¡Ups!', '¡Pum!', '¡Mi pintura!'],
  trick: ['¡Truco!', '¡Qué vacilón!', '¡Mírame!'],
  rocket: ['¡Arranque cohete!', '¡Fiuuu!', '¡Me fui!'],
  pop: ['¡Mi globo!', '¡Pop!', '¡Nooo, mi globo!'],
  rescue: ['¡Zamuro, ayúdame!', '¡Al rescate!', '¡Sácame de aquí!'],
  out: ['¡Me quedé sin globos!', '¡Me reventaron!'],
  stall: ['¡Se me ahogó!', '¡Ay no, el motor!'],
  honk: { meep: '¡MEEP MEEP!', cucaracha: '♪ Cucaracha ♪', grave: '¡PAAAAN!', fiesta: '♪ ¡Rumba! ♪' },
};

class Spring {
  constructor() { this.x = 0; this.v = 0; }
  step(target, k, c, dt) {
    this.v += (k * (target - this.x) - c * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(pixelRatio(2));
bindRenderer(renderer, 2);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
document.body.prepend(renderer.domElement);

// ======================================================================
// Garage
// ======================================================================
const garage = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200),
  index: 0,
  wheel: 'calle',
  spin: true,
  hop: new Spring(),
  honkT: 0,
  t: 0,
  focus: false,
  glide: 0,
  cars: new Map(),
};
{
  const s = garage.scene;
  s.background = new THREE.Color(0x1b1430);
  s.fog = new THREE.Fog(0x1b1430, 20, 45);
  // studio room reflections plus violet and cyan rims (garage-stage.js)
  s.environment = studioEnvironment(renderer);
  studioRims(s);
  s.add(new THREE.HemisphereLight(0xfff4e6, 0x4b3669, 0.9));
  const fill = new THREE.DirectionalLight(0xfff1e0, 1.1);   // soft front fill so faces stay bright
  fill.position.set(4, 3, 10);
  s.add(fill);
  const key = new THREE.SpotLight(0xfff0d8, 220, 45, Math.PI / 5, 0.5, 1.6);
  key.position.set(6, 13, 8);
  key.castShadow = true;
  // The small turntable needs a quarter of the previous shadow texels.
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  s.add(key);
  const rim = new THREE.DirectionalLight(0x9fb7ff, 1.6);
  rim.position.set(-8, 5, -10);
  s.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: 0x191326, roughness: 0.95, flatShading: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  s.add(floor);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.8, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x302340, roughness: 0.85, flatShading: true }));
  table.position.y = 0.2;
  table.receiveShadow = true;
  s.add(table);
  garage.ring = new THREE.Mesh(new THREE.TorusGeometry(3.58, 0.06, 6, 48), new THREE.MeshBasicMaterial({ color: 0xe63946, toneMapped: false }));
  garage.ring.rotation.x = Math.PI / 2;
  garage.ring.position.y = 0.4;
  s.add(garage.ring);
  garage.turn = new THREE.Group();
  garage.turn.position.y = 0.4;
  s.add(garage.turn);
  garage.bubble = makeBubble();
  s.add(garage.bubble.sprite);

  garage.camera.position.set(8, 4.5, 9.5);
  garage.controls = new OrbitControls(garage.camera, renderer.domElement);
  garage.controls.target.set(0, 1.5, 0);
  garage.controls.enableDamping = true;
  garage.controls.enablePan = false;
  garage.controls.minDistance = 5;
  garage.controls.maxDistance = 18;
  garage.controls.maxPolarAngle = Math.PI * 0.49;
}

function garageCar(index) {
  // Cache key includes the cauchos, paint and taller parts (worn or tried).
  const { paint, cfg, wheel } = taller.look(CARS[index]);
  const key = `${index}:${wheel}:${paint}:${JSON.stringify(cfg)}`;
  if (!garage.cars.has(key)) {
    if (garage.cars.size >= 20) garage.cars.delete(garage.cars.keys().next().value);
    const car = showroomPaint(CARS[index].build(ME.avatar, wheelById(wheel).wheel ?? undefined, cfg));
    garage.cars.set(key, repaintCar(car, CARS[index].color, paint));
  }
  return garage.cars.get(key);
}

function showCar(i) {
  garage.index = (i + CARS.length) % CARS.length;
  const def = CARS[garage.index];
  garage.turn.clear();
  // Bounded garage models; thumbnails borrow these same instances.
  // Race models stay independent because their parts can break off.
  garage.car = garageCar(garage.index);
  garage.turn.add(garage.car.root);
  window.PANA_PREPARED = true; // the shared readiness signal (tests/browser-kit.js)
  garage.ring.material.color.set(def.color);

  document.documentElement.style.setProperty('--car', def.color);
  $('car-num').textContent = def.num;
  $('car-of').textContent = `Carro ${garage.index + 1} de ${CARS.length}`;
  $('car-name').textContent = def.name;
  $('car-blurb').textContent = def.blurb;
  // Stats bars reflect the car + cauchos + taller parts, from the composed tune.
  taller.renderStats();
  $('driver-name').textContent = ME.name;
  $('dots').innerHTML = CARS.map((_, j) => `<span class="${j === garage.index ? 'on' : ''}"></span>`).join('');
  for (const [j, button] of [...$('car-lineup').children].entries()) button.setAttribute('aria-pressed', String(j === garage.index));
  net?.pick(garage.index, garage.wheel, raceStyle(garage.index));
  menuFlow?.refresh();
}

// Step 2: pick the cauchos. Rebuilds the turntable car and the stats bars,
// and persists the choice for the next visit.
function showWheel(id) {
  const def = wheelById(id);
  garage.wheel = def.id;
  try { localStorage.setItem('derrape:wheels', def.id); } catch { /* private mode */ }
  if (wallet.wheel !== def.id) { wallet.wheel = def.id; saveWallet(); }
  $('wheel-name').textContent = def.name;
  $('wheel-blurb').textContent = def.blurb;
  for (const [j, button] of [...$('wheel-lineup').children].entries()) {
    button.setAttribute('aria-pressed', String(WHEEL_DEFINITIONS[j].id === def.id));
  }
  showCar(garage.index);
}

function garageHonk(tryHorn) {
  sound.unlock();
  const def = CARS[garage.index], picked = typeof tryHorn === 'string' ? tryHorn : wallet.horn;
  const horn = picked !== 'propio' ? picked : def.horn;
  garage.honkT = sound.horn(horn);
  garage.bubble.say(LINES.honk[horn], garage.honkT + 0.2);
  garage.hop.v += 6;
}

function updateGarage(dt) {
  garage.t += dt;
  if (garage.frame) garage.turn.rotation.y += (0 - wrapAngle(garage.turn.rotation.y)) * Math.min(1, dt * 3);
  else if (garage.spin) garage.turn.rotation.y += dt * 0.35;
  const car = garage.car;
  const hop = garage.hop.step(0, 180, 9, dt);
  car.chassis.position.y = hop * 0.12 + Math.sin(garage.t * 2) * 0.02;
  car.chassis.rotation.x = -hop * 0.03;
  const d = car.driver;
  // in close-up the driver turns to look at you through the open window
  const look = garage.focus ? 0 : Math.sin(garage.t * 0.9);
  const turnTo = garage.focus ? 1.1 : look * 0.6;
  d.neck.rotation.y += (turnTo - d.neck.rotation.y) * Math.min(1, dt * 4);
  d.neck.rotation.z = Math.sin(garage.t * 1.7) * 0.08;
  garage.honkT = Math.max(0, garage.honkT - dt);
  d.update(dt, { open: garage.honkT > 0, look: -look });
  for (const p of car.danglers) p.rotation.z = Math.sin(garage.t * 2.4) * 0.25;
  if (car.flag) car.flag.rotation.x = Math.sin(garage.t * 3) * 0.15;
  garage.bubble.sprite.position.set(0, 4.8, 0);
  garage.bubble.update(dt);
  updateGarageCamera(dt);
  garage.controls.update();
}

// "Ver piloto": glide up to the driver's open window, then orbit around them.
const GARAGE_TARGET = new THREE.Vector3(0, 1.5, 0);
const GARAGE_CAM = new THREE.Vector3(8, 4.5, 9.5);
function updateGarageCamera(dt) {
  if (garage.glide <= 0) return;
  garage.glide = Math.max(0, garage.glide - dt);
  const k = Math.min(1, dt * 5);
  if (garage.focus) {
    const head = garage.car.driver.head.getWorldPosition(new THREE.Vector3());
    const out = new THREE.Vector3(2.5, -0.12, 0.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), garage.turn.rotation.y);
    garage.controls.target.lerp(head, k);
    garage.camera.position.lerp(head.clone().add(out), k);
  } else {
    garage.controls.target.lerp(garage.frame?.[1] ?? GARAGE_TARGET, k);
    garage.camera.position.lerp(garage.frame?.[0] ?? GARAGE_CAM, k);
  }
}

// Each taller tab frames the part it sells, with the turntable stopped.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const TAB_FRAMES = {
  ruedas: [V3(7.6, 2.4, 6.8), V3(0.6, 1.0, 0.8)],
  motor: [V3(5.2, 5.4, 9.0), V3(0, 1.5, 1.2)],
  aleron: [V3(-6, 5, -8.8), V3(0, 2.0, -1.2)],
  extras: [V3(4.2, 4.4, 10), V3(0, 1.8, 0.4)],
  pintura: [V3(11, 3.8, 3.4), V3(0, 1.6, 0)],
};
function frameTab(tab) {
  if (garage.focus) setFocus(false);
  garage.frame = TAB_FRAMES[tab] ?? null;
  garage.glide = 1.4;
}

function setFocus(on) {
  garage.focus = on;
  garage.glide = 1.2;
  $('cam').classList.toggle('on', on);
  $('cam').textContent = on ? 'Ver carro' : 'Ver piloto';
  garage.controls.minDistance = on ? 1.4 : 5;
  if (on) {
    garage.spin = false;
    $('spin').classList.remove('on');
  }
}

$('prev').onclick = () => showCar(garage.index - 1);
$('next').onclick = () => showCar(garage.index + 1);
$('t-prev').onclick = () => switchTrack(trackIndex - 1);
$('t-next').onclick = () => switchTrack(trackIndex + 1);
$('spin').onclick = (e) => {
  garage.spin = !garage.spin;
  e.target.classList.toggle('on', garage.spin);
};
$('honk').onclick = garageHonk;
$('cam').onclick = () => setFocus(!garage.focus);
$('play').onclick = () => {
  sound.unlock();
  if (net) {
    if (['loading', 'count', 'race'].includes(net.state.phase)) {
      const myRacer = net.state.racers?.find(r => r.id === net.id);
      if (myRacer && !myRacer.retired && !myRacer.dns) {
        selectTrack(net.state.track, net.state.laps);
        startRace(garage.index, garage.wheel, net.state.racers);
      }
      return;
    }
    if (net.isHost) net.start();
    return;
  }
  if (!joining) startRace(garage.index, garage.wheel);
};
$('go-online').onclick = () => { sound.unlock(); goOnline(newRoomCode(), true); };
$('lobby-invite').onclick = () => menu.share();
$('lobby-bots').onchange = (e) => net?.bots(e.target.checked);
$('lobby-solo').onclick = () => { location.href = location.pathname; };

// ======================================================================
// Track: data-driven. Definitions live in tracks.js + tracks/*.js; the
// active track runtime is T. These wrappers keep the rest of the game
// untouched when the track changes.
// ======================================================================
let T = null;

const pointAt = (s) => T.pointAt(s);
const paramOf = (x, z, y) => T.paramOf(x, z, y);
const offsetOf = (x, z, y) => T.offsetOf(x, z, y);
const groundAt = (x, z, y) => T.groundAt(x, z, y);

const race = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1800),
  camera2: new THREE.PerspectiveCamera(60, innerWidth / 2 / innerHeight, 0.1, 1800),
  codes: {},
  cars: [],
  state: 'off',
  keys: {},
  shake: 0,
};
race.puffs = new Puffs(race.scene);
race.shockwaves = new Shockwaves(race.scene);
const music = createMusic(sound);
// Garage music starts with the first tap (browsers keep audio locked until then).
function garageMusic() {
  if (mode === 'garage' && sound.ctx && music.song !== GARAGE_SONG) music.play(GARAGE_SONG, { fallback: 'calipso' });
}
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => setTimeout(garageMusic), true);
const waterAmbience = createWaterAmbience(sound);

// Weather: angled rain + puddle ripples + lightning on Selva, snow/hail on Páramo.
const RAIN_DROPS = 1400;
race.rain = (() => {
  const pos = new Float32Array(RAIN_DROPS * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xb8d4ec, transparent: true, opacity: 0.55 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  lines.name = 'rain';
  race.scene.add(lines);
  const seed = Array.from({ length: RAIN_DROPS }, () => [Math.random() * 60 - 30, Math.random() * 30, Math.random() * 60 - 30]);
  let rippleT = 0;
  let nextLightning = 6 + Math.random() * 8;
  let flashVal = 0;
  return {
    lines,
    mat,
    update(cx, cy, cz, t, dt = 0.016) {
      const snow = T?.id === 'paramo';
      const storm = (T?.def.rain || 0) >= 0.85;
      const fallSpeed = snow ? 16 : 36;
      const windX = snow ? Math.sin(t * 1.4) * 0.45 : -0.35;
      const windZ = snow ? Math.cos(t * 1.1) * 0.35 : 0.18;
      const lenY = snow ? 0.55 : 1.45;
      for (let i = 0; i < Math.min(RAIN_DROPS, geo.drawRange.count / 2); i++) {
        const [x0, y0, z0] = seed[i];
        const cycle = ((y0 - t * fallSpeed) % 30 + 30) % 30;
        const y = cy - 8 + cycle;
        const x = cx + x0 + (30 - cycle) * (snow ? 0.08 * Math.sin(t + i) : -0.12);
        const z = cz + z0;
        pos.set([x, y, z, x + windX, y + lenY, z + windZ], i * 6);
      }
      geo.attributes.position.needsUpdate = true;

      rippleT -= dt;
      if (rippleT <= 0) {
        rippleT = (storm ? 0.09 : 0.16) * RAIN_DROPS / Math.min(RAIN_DROPS, geo.drawRange.count / 2);
        const rx = cx + (Math.random() - 0.5) * 28;
        const rz = cz + (Math.random() - 0.5) * 28;
        const gy = groundAt(rx, rz);
        if (snow) {
          race.puffs.spawn(new THREE.Vector3(rx, gy + 0.12, rz), {
            color: 0xf2f7ff, count: 2, size: 0.22, rise: 1.8, life: 0.28, spread: 0.6,
          });
        } else {
          race.shockwaves.ring(new THREE.Vector3(rx, gy, rz), {
            color: 0xd8ecff, maxRadius: 0.9 + Math.random() * 0.6, duration: 0.42, opacity: 0.45,
          });
          race.puffs.spawn(new THREE.Vector3(rx, gy + 0.08, rz), {
            color: 0xd8ecff, count: 1, size: 0.2, rise: 1.1, life: 0.22, spread: 0.35,
          });
        }
      }

      if (storm) {
        nextLightning -= dt;
        if (nextLightning <= 0) {
          nextLightning = 9 + Math.random() * 11;
          flashVal = 0.95;
          setTimeout(() => { if (mode === 'race') sound.thunder(0.95); }, 260 + Math.random() * 320);
        }
      }
      if (flashVal > 0) {
        flashVal = Math.max(0, flashVal - dt * 3.8);
        race.sky.setFlash(flashVal);
      }
    },
  };
})();
race.debris = new Debris(race.scene);
{
  const s = race.scene;
  s.background = new THREE.Color(0xffd6a0);
  s.fog = new THREE.Fog(0xffd6a0, 80, 260);
  race.sky = createSky();s.add(race.sky.mesh);
  race.hemi = new THREE.HemisphereLight(0xfff1d6, 0xc08a5a, 1.6);
  s.add(race.hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-30, 40, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  s.add(sun, sun.target);
  race.sun = sun;
}

// Sky, fog and lights follow the track's palette.
function applyPalette(pal) {
  if (T?.def.rain) {
    const grey = new THREE.Color(0x8a96a3);
    const mix = (c, k) => new THREE.Color(c).lerp(grey, k).getHex();
    pal = { ...pal, horizon: mix(pal.horizon, 0.55), skyTop: mix(pal.skyTop ?? pal.horizon, 0.6), hemiSky: mix(pal.hemiSky, 0.4),
      sunInt: (pal.sunInt ?? 2.4) * 0.5, hemiInt: (pal.hemiInt ?? 1.6) * 0.85, cloudCover: 0.95,
      fog: [Math.min(pal.fog?.[0] ?? 80, 60), Math.min(pal.fog?.[1] ?? 260, 380)] };
  }
  const hasRainbow = T?.id === 'salto' || T?.id === 'selva' || T?.id === 'bululu';
  pal = { ...pal, rainbow: hasRainbow ? (T?.id === 'salto' ? 0.85 : 0.48) : 0 };
  race.rain.lines.visible = !!T?.def.rain;
  race.rain.mat.color.setHex(T?.id === 'paramo' ? 0xf2f7ff : 0xb8d4ec);
  race.rain.mat.opacity = T?.id === 'paramo' ? 0.78 : 0.58;
  race.scene.background.set(pal.horizon);
  race.scene.fog.color.set(pal.horizon);
  race.scene.fog.near = pal.fog?.[0] ?? 80;
  race.scene.fog.far = pal.fog?.[1] ?? 260;
  // Never clip what the fog still shows: big maps fog out past 1800 m.
  for (const cam of [race.camera, race.camera2]) if (cam.far !== Math.max(1800, race.scene.fog.far)) { cam.far = Math.max(1800, race.scene.fog.far); cam.updateProjectionMatrix(); }
  race.hemi.color.set(pal.hemiSky);
  race.hemi.groundColor.set(pal.hemiGround);
  race.hemi.intensity = pal.hemiInt ?? 1.6;
  race.sun.color.set(pal.sun);
  race.sun.intensity = pal.sunInt ?? 2.4;
  race.sky.setPalette(pal);race.sky.update(0);
}

// ---------- race setup: mode, difficulty, laps, mirror (local races) ----------
let profileStorage = null;
try { profileStorage = localStorage; } catch { /* private mode */ }
const profileStore = createProfileStore(profileStorage);
const profile = profileStore.load();
const setup = profile.setup;
const isCupMode = (mode) => CUPS.some(c => c.id === mode);

// ---------- the taller: wallet, paints, horns, turbo flames ----------
let wallet = profile.wallet;
function saveWallet() {
  profileStore.save(profile);
  $('wallet-coins').textContent = wallet.coins;
  $('shop-coins').textContent = wallet.coins;
}
const raceStyle = index => cleanCosmetics({paint:wallet.paint[CARS[index].id],horn:wallet.horn,flame:wallet.flame,parts:wallet.parts[CARS[index].id]});
const hornFor = c => c.cosmetics.horn !== 'propio' ? c.cosmetics.horn : c.def.horn;
const flameFor = c => FLAMES.find(f => f.id === c.cosmetics.flame)?.colors ?? FLAMES[0].colors;

// Shifts every body panel in the car's paint family to a new paint (the
// driver keeps their own colours). Materials are shared, so swap in copies.
const paintCache = new Map();
function repaintCar(car, from, to) {
  if (!to) return car;
  const skip = new Set();
  car.driver?.group?.traverse(o => skip.add(o));
  car.root.traverse(o => {
    if (!o.material || skip.has(o)) return;
    const swap = (m) => {
      if (!m.color) return m;
      const hex = repaintHex('#' + m.color.getHexString(), from, to);
      if (!hex) return m;
      const key = m.uuid + hex;
      if (!paintCache.has(key)) { const n = m.clone(); n.color.set(hex); paintCache.set(key, n); }
      return paintCache.get(key);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return car;
}

// The taller UI (taller.js): tabs of parts, hover stat previews and
// try-before-buy on the turntable car. Closing it takes off what was only tried.
const taller = createTaller({
  $, wallet, sound, cars: CARS, getIndex: () => garage.index, selectCar: i => showCar(i),
  getWheel: () => garage.wheel, setWheel: id => showWheel(id), onTab: frameTab,
  trophies: () => loadTrophies(), save: saveWallet, refreshCar: () => showCar(garage.index), onHorn: garageHonk,
});
// The cauchos strip: owned wheels go on at once, others open the taller to try.
function pickWheel(id) {
  if (owns(wallet, 'wheel', id)) return showWheel(id);
  if ($('shop').hidden) $('open-shop').click();
  taller.open('wheel');
  taller.tryItem('wheel', id);
}
$('open-shop').onclick = () => {
  sound.unlock(); taller.open(); $('shop').hidden = false;
  document.body.classList.add('shop-open'); resize(); $('shop-close').focus();
};
$('shop-close').onclick = () => { $('shop').hidden = true; $('open-shop').focus(); };
new MutationObserver(() => {
  if (!$('shop').hidden) return;
  taller.close(); document.body.classList.remove('shop-open'); garage.frame = null; garage.glide = 1.2; resize();
}).observe($('shop'), { attributes: true, attributeFilter: ['hidden'] });

function saveSetup() {
  profileStore.save(profile);
}

function loadTrophies() {
  return trophyCredits(profile);
}

function renderSetup() {
  const press = (root, attr, value) => {
    for (const b of $(root).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value)));
  };
  const activeMode = net ? (net.state?.mode || 'race') : setup.mode;
  const activeDiff = net ? (net.state?.difficulty || 'normal') : setup.difficulty;
  const hostCanConfig = !net || (net.isHost && ['lobby', 'results', 'complete'].includes(net.state?.phase));
  press('mode-pick', 'mode', activeMode);
  press('difficulty-pick', 'difficulty', activeDiff);
  press('laps-pick', 'laps', setup.laps);
  const lapsRow = $('laps-pick').closest('.setup-row');
  if (lapsRow) lapsRow.hidden = !!net;
  const mirrorOpen = mirrorUnlocked(loadTrophies());
  if (!mirrorOpen) setup.mirror = false;
  $('mirror').disabled = !mirrorOpen;
  $('mirror').title = mirrorOpen ? '' : 'Gana un trofeo en una copa para desbloquear el modo espejo';
  $('mirror').setAttribute('aria-checked', String(setup.mirror));
  $('split').setAttribute('aria-checked', String(setup.split));
  const battle = activeMode === 'battle', cup = isCupMode(activeMode) ? cupById(activeMode) : null;
  if (!net) {
    $('launch-note').innerHTML = `<span class="pk-dot"></span>${cup ? (setup.split ? 'Dos panas contra 6 rivales' : 'Tú contra 7 rivales') : setup.split ? 'Dos panas contra 2 rivales' : 'Tú contra 3 rivales'}`;
  }
  for (const b of $('laps-pick').querySelectorAll('button')) b.disabled = battle || !!cup;
  for (const b of $('difficulty-pick').querySelectorAll('button')) b.disabled = !hostCanConfig;
  const trophies = profile.trophies, legacy = profile.legacyTrophies;
  for (const b of $('mode-pick').querySelectorAll('button')) {
    b.hidden = !!net && b.dataset.mode === 'battle';
    b.disabled = !hostCanConfig;
    const won = trophies[b.dataset.mode], earlier = legacy[b.dataset.mode];
    const shown = won ?? earlier?.trophy;
    b.title = shown ? `Trofeo de ${shown}${!won && earlier ? ' · Edición anterior' : ''}` : '';
    b.querySelector('.mode-trophy')?.remove();
    b.querySelector('.mode-legacy')?.remove();
    if (shown) {
      const dot = document.createElement('span');
      dot.className = 'mode-trophy';
      dot.style.setProperty('--trophy', `var(--trophy-${shown})`);
      dot.setAttribute('aria-label', `trofeo de ${shown}${!won && earlier ? ', edición anterior' : ''}`);
      b.append(dot);
    }
    if (!won && earlier) {
      const label = document.createElement('small');
      label.className = 'mode-legacy';
      label.textContent = 'Edición anterior';
      b.append(label);
    }
  }
  const stagesEl = $('cup-stages');
  stagesEl.hidden = !cup;
  if (cup) {
    stagesEl.replaceChildren(...cup.stages.map((stage, idx) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cup-stage';
      btn.dataset.stage = String(idx);
      btn.dataset.track = stage.track;
      const trackDef = getTrack(stage.track);
      btn.setAttribute('aria-pressed', String(TRACKS[trackIndex]?.id === stage.track));
      btn.innerHTML = `<span>${idx + 1}. ${esc(trackDef.name)}</span><small>${stage.laps} ${stage.laps === 1 ? 'vuelta' : 'vueltas'}</small>`;
      const art = new Image(); art.alt = ''; art.loading = 'lazy'; art.decoding = 'async';
      setMenuImage(art, trackArt(stage.track, true)); btn.prepend(art);
      btn.onclick = () => {
        selectTrack(stage.track, stage.laps);
        for (const item of stagesEl.querySelectorAll('.cup-stage')) {
          item.setAttribute('aria-pressed', String(item === btn));
        }
      };
      li.append(btn);
      return li;
    }));
  } else {
    stagesEl.replaceChildren();
  }
  if (!mirrorOpen && !cup && activeMode !== 'battle') $('setup-note').textContent = 'Gana un trofeo en una copa para desbloquear el modo espejo.';
  else $('setup-note').textContent = cup
    ? `${cup.name}: ${cupTracks(cup).map(id => getTrack(id).name).join(' → ')}. ${approximateCupText(cup)}`
    : battle ? 'Globos: tres globos por carro. Cada golpe revienta uno. Gana el último con globos.' : '';
  if (!net) {
    $('t-prev').disabled = $('t-next').disabled = !!cup;
    if (cup) {
      selectTrack(cup.stages[0].track, cup.stages[0].laps);
      const firstBtn = stagesEl.querySelector('.cup-stage');
      if (firstBtn) firstBtn.setAttribute('aria-pressed', 'true');
    } else selectTrack(TRACKS[trackIndex].id);
  }
  menuFlow?.refresh();
}

for (const b of document.querySelectorAll('#mode-pick button')) b.onclick = () => {
  if (net) {
    if (net.isHost) net.mode(b.dataset.mode);
    return;
  }
  setup.mode = b.dataset.mode; race.cup = null; saveSetup(); renderSetup();
};
for (const b of document.querySelectorAll('#difficulty-pick button')) b.onclick = () => {
  if (net) {
    if (net.isHost) net.difficulty(b.dataset.difficulty);
    return;
  }
  setup.difficulty = b.dataset.difficulty; saveSetup(); renderSetup();
};
for (const b of document.querySelectorAll('#laps-pick button')) b.onclick = () => { setup.laps = cleanLaps(Number(b.dataset.laps)); saveSetup(); renderSetup(); selectTrack(TRACKS[trackIndex].id); };
$('mirror').onclick = () => { setup.mirror = !setup.mirror; saveSetup(); renderSetup(); };
$('split').onclick = () => { setup.split = !setup.split; saveSetup(); renderSetup(); };

// Browsing needs only route metadata. Keep the last built map for replay;
// construct a different environment only after the player presses Play.
let trackIndex = 0, selectedTrackId = null;
const trackRoutes = new Map();
function selectTrack(id, lapsOverride = null) {
  const def = getTrack(id);
  if(!net&&lapsOverride==null&&selectedTrackId!==def.id&&(def.defaultLaps||selectedTrackId==='puerto')){
    setup.laps=lapsForTrack(def.id);
    for(const button of $('laps-pick').querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.laps)===setup.laps));
  }
  selectedTrackId=def.id;
  trackIndex = TRACKS.indexOf(def);
  try { localStorage.setItem('derrape:track', def.id); } catch { /* private mode */ }
  if (!trackRoutes.has(def.id)) trackRoutes.set(def.id, makeTrack(def));
  const route = trackRoutes.get(def.id);
  $('track-name').textContent = def.name;
  const laps = lapsOverride ?? (net ? net.state?.laps || LAPS : setup.mode === 'battle' ? 0 : setup.laps);
  // Puerto's eight-car timing proof averages 170 s; this broader pace band
  // leaves room for ordinary mistakes and item exchanges. Other maps use the
  // same planning estimate until their own driving profiles are recorded.
  const estimate=laps?[36,27].map(speed=>{
    const seconds=Math.round(route.TOTAL*laps/speed/15)*15;
    return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }):[];
  $('track-blurb').textContent = `${laps ? `${estimate[0]}–${estimate[1]} min aprox. · ${laps} ${laps === 1 ? 'vuelta' : 'vueltas'}` : 'batalla de globos'}. ${def.blurb}`
    + (def.rain ? ' Está lloviendo: los cauchos de lluvia agarran mejor.' : '');
  const activeMode = net ? (net.state?.mode || 'race') : setup.mode;
  const cup = isCupMode(activeMode) ? cupById(activeMode) : null;
  const cupStageIdx = cup ? cup.stages.findIndex(s => s.track === def.id) : -1;
  $('track-of').textContent = cupStageIdx >= 0 ? `Carrera ${cupStageIdx + 1}/4` : `Pista ${trackIndex + 1}/${TRACKS.length}`;
  drawTrackPreview(route);
  menuFlow?.refresh();
  return route;
}

function beginTrack(id) {
  let route = selectTrack(id);
  if (race.trackReady && T === route) return false;
  // A cancelled environment may have installed ground/collision closures.
  // Retry with a fresh runtime instead of retaining those partial callbacks.
  if (T === route) route = makeTrack(route.def);
  if (race.trackGroup) {
    race.items?.dispose();
    race.hazards?.dispose();
    race.hazards = null;
    race.scene.remove(race.trackGroup);
    // Character disposal detaches children. Collect first so cleanup cannot
    // mutate Three's active traversal when switching away from Los Llanos.
    const disposers=[],geometries=new Set();
    race.trackGroup.traverse(o=>{if(o.userData.dispose)disposers.push(o.userData.dispose);if(o.geometry)geometries.add(o.geometry);});
    disposers.forEach(dispose=>dispose());geometries.forEach(geometry=>geometry.dispose());
    // Built runtimes retain environment animation/terrain closures. Evict the
    // old runtime too, so metadata caching cannot retain eight whole worlds.
    trackRoutes.delete(T.id);
    T.group = null;
  }
  race.items = null;
  race.trackGroup = null;
  race.trackReady = false;
  T = route;
  trackRoutes.set(route.id, route);
  return true;
}

function finishTrack() {
  race.trackGroup = T.group;
  race.scene.add(race.trackGroup);
  applyPalette(T.def.palette);
  race.items = createItems({
    scene: race.trackGroup, puffs: race.puffs, sound, G, track: T,
    crash: (c, power, side) => crash(c, power, side),
    explode: (pos) => {
      race.shockwaves.explode(pos, { radius: 4.8, scorch: true });
      if (race.player) {
        const d = Math.hypot(race.player.x - pos.x, race.player.z - pos.z);
        if (d < 45) race.shake = Math.min(1.2, race.shake + (1 - d / 45) * 0.85);
      }
    },
    coinPicked: (c, worldPos, streak) => {
      race.shockwaves.sparkle(worldPos, { color: 0xffe066 });
      if (c.isPlayer) flyToCounter(worldPos, race.camera, $('coin-count'), { streak });
    },
    say: (c, lines, time) => say(c, lines, time),
    standings: () => standings(),
    cars: () => race.cars,
    byId: (id) => racerById(id),
    battle: () => race.mode === 'battle',
    now: () => race.netRace ? net.now() : race.clock * 1000,
    itemDelay: () => race.diff?.itemDelay ?? 1,
    slipped: (c) => { popBalloon(c); recordImpact(c, race.clock, true); },
    emit: (kind, c, data) => { if (race.netRace && !c.remote) net.fx(c.netId, kind, data); },
  });
  race.hazards = createHazards(T, race.trackGroup);
  applyRaceQuality(renderer, race, getSettings().quality);
  $('mm-track').textContent = T.name;
  $('mm-sub').textContent = `${(T.TOTAL / 1000).toFixed(2)} km por vuelta`;
  buildMinimap();
  race.trackReady = true;
}

function buildTrack(id) {
  if (!beginTrack(id)) return;
  race.trackGroup = T.build();
  finishTrack();
}

function switchTrack(i) {
  sound.unlock();
  if (net && !net.isHost) return;
  const def = selectTrack(TRACKS[(i + TRACKS.length) % TRACKS.length].id).def;
  net?.track(def.id);
}

// ---------- race HUD: standings board + minimap ----------
function renderBoard(order, player) {
  $('board').innerHTML = order.map((c, i) =>
    `<li class="pk-row${c === player ? ' me is-me' : ''}"><span class="pk-row-n">${i + 1}</span><span class="chip" style="--c:${c.def.color}"></span>${esc(c.name)}</li>`
  ).join('');
}

// Sample a route's centerline and fit it into a canvas with a margin.
function fitRoute(route, canvas, margin) {
  const N = 160;
  const raw = [];
  for (let i = 0; i < N; i++) raw.push(route.pointAt((i / N) * route.TOTAL));
  const minX = Math.min(...raw.map(p=>p.x)), maxX = Math.max(...raw.map(p=>p.x));
  const minZ = Math.min(...raw.map(p=>p.y)), maxZ = Math.max(...raw.map(p=>p.y));
  const scale = Math.min((canvas.width-margin*2)/(maxX-minX), (canvas.height-margin*2)/(maxZ-minZ));
  return raw.map(p=>[canvas.width/2+(p.x-(minX+maxX)/2)*scale,canvas.height/2+(p.y-(minZ+maxZ)/2)*scale]);
}
function strokeRoute(ctx, pts, width) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.strokeStyle = '#0e0b24';
  ctx.lineWidth = width * 2;
  ctx.stroke();
  ctx.strokeStyle = '#f3e9d7';
  ctx.lineWidth = width;
  ctx.stroke();
}

// Garage preview of the selected circuit, with its start line.
function drawTrackPreview(route) {
  const canvas = $('track-map'), ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  try {
    const pts = fitRoute(route, canvas, 28);
    strokeRoute(ctx, pts, 7);
    const [x, y] = pts[Math.floor((route.LINE ?? 0) / route.TOTAL * pts.length) % pts.length];
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc629'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#0e0b24'; ctx.stroke();
  } catch { /* metadata without a centerline: keep the striped placeholder */ }
}

const mm = $('mm');
const mmCtx = mm.getContext('2d');
let mmPts = [];
function buildMinimap() {
  mmPts = fitRoute(T, mm, 16);
}

function drawMinimap() {
  mmCtx.setTransform(1, 0, 0, 1, 0, 0);
  mmCtx.clearRect(0, 0, mm.width, mm.height);
  if (race.mirror) mmCtx.setTransform(-1, 0, 0, 1, mm.width, 0);
  strokeRoute(mmCtx, mmPts, 4);
  for (const c of race.cars) {
    const i = Math.floor((paramOf(c.x, c.z, c.y) / T.TOTAL) * mmPts.length) % mmPts.length;
    const [x, y] = mmPts[i];
    mmCtx.beginPath();
    mmCtx.arc(x, y, c.isPlayer ? 5.5 : 4, 0, Math.PI * 2);
    mmCtx.fillStyle = c.def.color;
    mmCtx.fill();
    if (c.isPlayer) {
      mmCtx.lineWidth = 2;
      mmCtx.strokeStyle = '#fff';
      mmCtx.stroke();
    }
  }
}

// ======================================================================
// Racers
// ======================================================================
const RACERS = 4;
const GP_RACERS = 8;
const LOCAL_PLAYER = 'local-player';
const LOCAL_GUEST = 'local-guest';

function createLocalCup(cupId, playerIndex, wheelId, split, difficulty) {
  const seed = `${Date.now()}:${Math.random()}`;
  const sessionId = globalThis.crypto?.randomUUID?.() ?? seed;
  const guestCar = (playerIndex + 1) % CARS.length;
  const usedCars = new Set(split ? [playerIndex, guestCar] : [playerIndex]);
  const cars = seededOrder(CARS.map((_, index) => index).filter(index => !usedCars.has(index)), `${seed}:cars`);
  const names = seededOrder(RIVALS, `${seed}:names`);
  const entrants = [{
    id: LOCAL_PLAYER, name: ME.name, kind: 'human', owner: 'local', avatar: ME.avatar,
    loadout: { car: playerIndex, wheel: wheelId, ...raceStyle(playerIndex) }, skillSeed: `${sessionId}:player`,
  }];
  if (split) entrants.push({
    id: LOCAL_GUEST, name: 'Jugador 2', kind: 'human', owner: 'local', avatar: randomAvatar(),
    loadout: { car: guestCar, wheel: 'calle' }, skillSeed: `${sessionId}:guest`,
  });
  for (let i = 0; entrants.length < GP_RACERS; i++) {
    const car = cars[i];
    entrants.push({
      id: `local-bot-${i + 1}`, name: names[i], kind: 'bot', owner: 'local', avatar: randomAvatar(),
      loadout: { car, wheel: AI_WHEELS[CARS[car].id] || 'calle' }, skillSeed: `${sessionId}:bot-${i + 1}`,
    });
  }
  return createCupSession({ cupId, sessionId, seed, difficulty, bots: true, entrants });
}

const cupSkill = (entrant, difficulty) => difficulty.skill[0]
  + seededUnit(entrant.skillSeed) * (difficulty.skill[1] - difficulty.skill[0]);

function makeRacer(index, isPlayer, name, wheelId = 'calle', avatar = null, cosmetics = null) {
  if (typeof avatar === 'string') { try { avatar = JSON.parse(avatar); } catch { avatar = null; } }
  const def = CARS[index];
  const wheel = wheelById(wheelId);
  const who = { name: name ?? (isPlayer ? ME.name : 'Pana'), avatar: avatar || (isPlayer ? ME.avatar : randomAvatar()) };
  cosmetics=cleanCosmetics(cosmetics ?? (isPlayer ? raceStyle(index) : null));
  const car = def.build(who.avatar, wheel.wheel ?? undefined, renderConfig(cosmetics.parts));
  repaintCar(car, def.color, PAINTS.find(p=>p.id===cosmetics.paint)?.color ?? null);
  batchRacer(car,PAINTS.find(p=>p.id===cosmetics.paint)?.color ?? def.color);
  // Retain ownership even after a bumper detaches and expires from the scene.
  car.geometries = new Set();
  car.ownedMaterials = new Set();
  car.root.traverse(o => {
    if (o.geometry) car.geometries.add(o.geometry);
    for(const material of [].concat(o.material||[]))if(material.userData.ownedMap)car.ownedMaterials.add(material);
  });
  race.scene.add(car.root);
  const bubble = makeBubble();
  race.scene.add(bubble.sprite);
  return {
    def, car, bubble, isPlayer, cosmetics, name: who.name,
    wheel: wheel.id, tune: composeTune(def.tune, wheel.profile, partsProfile(cosmetics.parts)),   // stepCar drives with the composed tune
    skill: isPlayer ? 1 : rand(...(race.diff ?? difficultyById('normal')).skill),   // rivals top out a bit below their car's max
    x: 0, z: 0, y: 0, h: Math.PI / 2, vx: 0, vz: 0, vy: 0, vf: 0, vr: 0, steer: 0, latAcc: 0, longAcc: 0,
    onGround: true, pitch: 0, roll: 0, pitchV: 0, rollV: 0,
    heave: new Spring(), sp: new Spring(), sr: new Spring(), headLag: new Spring(),
    lap: 0, prog: 0, done: false, time: 0,
    dizzy: 0, scream: 0, honkT: 0, lost: 0, puffT: 0, aiHonk: rand(3, 8), airTime: 0,
    inventory: [null, null], selected: 0, useT: 0, boost: 0, spin: 0,
    coins: 0, coinsCollected: 0, coinFlash: 0, itemMessage: '', itemMessageT: 0,
    // driving skills (drive-rules.js): drift dir ±1 and its charge, hop, trick, draft, stall
    drift: 0, driftT: 0, driftHeld: false, driftYaw: 0, driftExitT: 0, driftAssist: 0, driftLane: 0, hopping: false,
    trick: false, trickT: 0, draft: 0, stall: 0, aiDrift: false,
    shield: 0, cloud: 0, band: 1, balloons: 0, popT: 0, avatar: who.avatar,
    // course: checkpoint sectors, last safe road spot, rescue by the zamuro
    sectors: ALL_SECTORS, safe: null, safeT: 0, outT: 0, stuckT: 0, rescueT: 0, rescued: false, awayT: 0,
  };
}

// Battle balloons ride on sticks above the trunk, in the car's colour.
const balloonGeo = new THREE.SphereGeometry(0.55, 10, 8);
const stringGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.6, 4);
const stringMat = new THREE.MeshBasicMaterial({ color: 0xf3e9d7 });
function addBalloons(c) {
  c.balloons = BALLOONS;
  c.balloonMeshes = [];
  const mat = new THREE.MeshStandardMaterial({ color: c.def.color, roughness: 0.35, emissive: c.def.color, emissiveIntensity: 0.15 });
  for (let i = 0; i < BALLOONS; i++) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(balloonGeo, mat);
    ball.scale.set(1, 1.2, 1);
    ball.position.y = 1.6;
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.y = 0.8;
    g.add(ball, string);
    g.position.set((i - 1) * 0.75, 2.1, -1.5);
    g.rotation.z = (i - 1) * -0.25;
    c.car.root.add(g);
    c.balloonMeshes.push(g);
  }
}

// A hard hit in battle pops one balloon; the last one knocks the car out.
function popBalloon(c) {
  if (race.mode !== 'battle' || c.remote || c.balloons <= 0 || c.popT > 0 || race.state !== 'go') return;
  c.balloons--;
  c.popT = 1.4;   // a short grace so one crash cannot pop two
  const mesh = c.balloonMeshes?.pop();
  if (mesh) {
    race.puffs.spawn(mesh.getWorldPosition(new THREE.Vector3()).setY(c.y + 3.6), { color: c.def.color, count: 8, spread: 1.6, size: 0.45, rise: 2, life: 0.5 });
    mesh.removeFromParent();
  }
  sound.tone(1400, 0, 0.05, 'square', 0.12);
  sound.sweep(900, 200, 0.18, 'triangle', 0.1);
  if (c.balloons > 0) { say(c, LINES.pop, 1); return; }
  c.done = true;
  c.outAt = race.clock;
  c.time = race.clock;
  say(c, LINES.out, 1.4);
  // Knocked out: the car fades to a ghost (materials are shared, so clone them).
  const fade = (m) => { if (m.transparent) return m; const f = m.clone(); f.transparent = true; f.opacity = 0.5; return f; };
  c.car.root.traverse(o => { if (o.material) o.material = Array.isArray(o.material) ? o.material.map(fade) : fade(o.material); });
  if (c.isPlayer || c.human) maybeFinish();
}

function placeRacer(c, lane, row) {
  const s = T.LINE - 9 - row * 8;
  const p = pointAt(s), p2 = pointAt(s + 0.5);
  const tx = p2.x - p.x, tz = p2.y - p.y, l = Math.hypot(tx, tz) || 1;
  // grid slot offset across the track, heading along it
  Object.assign(c, {
    lane, x: p.x - tz / l * lane, z: p.y + tx / l * lane, y: 0, h: Math.atan2(tx, tz),
    vx: 0, vz: 0, vy: 0, vf: 0, lap: 0, done: false, time: 0,
    drift: 0, driftT: 0, driftHeld: false, driftExitT: 0, driftAssist: 0, hopping: false, trick: false, draft: 0, stall: 0, shield: 0, cloud: 0,
    sectors: ALL_SECTORS, outT: 0, stuckT: 0, rescueT: 0, phaseT: 0, phaseRemote: false, impacts: [],
  });
  c.y = groundAt(c.x, c.z, T.heightAtS(s));
  c.prog = progressOf(c);
  c.safe = { s, off: lane, back: false };
}

// Battle starts: a racer at arc length s, optionally facing backwards.
function placeAlong(c, s, backwards) {
  const p = pointAt(s), p2 = pointAt(s + 0.5);
  const tx = p2.x - p.x, tz = p2.y - p.y;
  Object.assign(c, { x: p.x, z: p.y, h: Math.atan2(tx, tz) + (backwards ? Math.PI : 0), reverse: backwards && !c.isPlayer });
  c.y = groundAt(c.x, c.z, T.heightAtS(s));
  c.prog = progressOf(c);
  c.safe = { s, off: 0, back: backwards };
}

function progressOf(c) {
  return (paramOf(c.x, c.z, c.y) - T.LINE + T.TOTAL) % T.TOTAL;
}

function disposeRacer(c) {
  c.car.batchedMaterials.forEach(material=>material.dispose());
  c.car.ownedMaterials.forEach(material=>{material.map.dispose();material.dispose();});
  const ownedMaterials = new Set(c.car.ghostMaterials || []);
  c.car.root.traverse(o => {
    for (const material of [].concat(o.material || [])) if (material.userData?.ghostClone) ownedMaterials.add(material);
  });
  ownedMaterials.forEach(material => material.dispose());
  race.scene.remove(c.car.root);
  c.car.driver.dispose();
  race.scene.remove(c.bubble.sprite);
  c.car.geometries.forEach(g => g.dispose());
  c.bubble.sprite.material.map.dispose();
  c.bubble.sprite.material.dispose();
}

function clearRace() {
  resetInput();
  for (const v of vultures.values()) v.removeFromParent();
  vultures.clear();
  race.cars.forEach(disposeRacer);
  race.cars = [];
  race.puffs.clear();
  race.debris.clear();
  race.shockwaves.clear();
  setSpeedLines(0);
  race.items?.clear();
  race.player = null;
}

// Loading-screen tips: real rules only.
const TIPS = [
  [SVG.mango, 'Lleva un mango equipado: bloquea el mango que te lancen.'],
  [SVG.coin, 'Cada moneda te da un poquito más de velocidad, hasta 10.'],
  [SVG.crate, 'Rompe cajas de madera para conseguir objetos. Guardas hasta 2.'],
  [SVG.juice, 'El jugo de mango te da un turbo: tómatelo en una recta.'],
  [SVG.back, 'Lanza hacia atrás con X para frenar al que te persigue.'],
  [ITEM_ICONS.drift, 'Mantén Shift y gira: la ayuda suaviza el derrape. Suelta Shift para salir con turbo.'],
  [ITEM_ICONS.drift, 'En una rampa, pulsa Shift en el aire para hacer un truco y caer con turbo.'],
  [ITEM_ICONS.cohete, 'El cohete persigue al carro que va justo delante de ti.'],
  [ITEM_ICONS.chancleta, 'La chancleta vuela por encima de la pista y cae sobre el líder.'],
  [ITEM_ICONS.totuma, 'La totuma protectora aguanta un golpe de lo que sea.'],
  [ITEM_ICONS.aguacero, 'El aguacero avanza hacia el líder cada 1,8 segundos. Cuanto más adelante, más dura.'],
  [ITEM_ICONS.trampa, 'Ojo con las cajas con banda roja: son trampas y explotan.'],
  [SVG.coin, 'Con 10 monedas tu próximo objeto sale potenciado.'],
  [SVG.back, '¿Atascado o te caíste? Pulsa R y el zamuro te devuelve a la pista.'],
  [ITEM_ICONS.aguacero, 'En Pana Selva y Pana Páramo llueve: con cauchos de lluvia no resbalas.'],
  [SVG.crate, 'Busca los puentes de tablas: son atajos, pero sin turbo frenan y sin baranda te puedes caer.'],
  [SVG.coin, 'Pégate detrás de otro carro en la recta: el rebufo te lanza hacia adelante.'],
  [SVG.coin, 'Si te pegan pierdes monedas. Cuídalas: cada una es velocidad.'],
];
let loadGeneration = 0;
// roster (online only): [{ id, kind, owner, name, avatar, car, wheel, slot }]
// from the room. Without one the race is the local player plus three bots.
async function startRace(playerIndex, wheelId = garage.wheel, roster = null) {
  if (mode === 'loading' && (!roster || net?.state.raceId === race.loadingRaceId)) return;
  const generation = ++loadGeneration;
  race.loadingRaceId = roster ? net.state.raceId : 0;
  if (roster) {
    if (net.cup) {
      race.mode = 'cup';
      race.cup = { definition: cupById(net.cup.cupId), session: net.cup, mirror: false };
      race.diff = difficultyById(net.cup.difficulty || net.state.difficulty || 'normal');
      race.laps = net.state.laps || race.cup.definition.stages[net.cup.stageIndex].laps;
    } else {
      race.mode = 'race';
      race.cup = null;
      race.diff = difficultyById(net.state.difficulty || 'normal');
      race.laps = net.state.laps || LAPS;
    }
    race.mirror = false;
    race.split = false;
  } else {
    race.mode = setup.mode === 'battle' ? 'battle' : isCupMode(setup.mode) ? 'cup' : 'race';
    if (race.mode === 'cup') {
      let session = race.cup?.session;
      if (!session || session.cupId !== setup.mode || ['complete', 'abandoned'].includes(session.status)) {
        session = createLocalCup(setup.mode, playerIndex, wheelId, setup.split, setup.difficulty);
        race.cup = { definition: cupById(setup.mode), session, mirror: setup.mirror };
      }
      if (session.status === 'ready') beginStage(session);
      else if (['loading', 'racing'].includes(session.status)) retryStage(session);
      else return;
      const stage = race.cup.definition.stages[session.stageIndex];
      race.diff = difficultyById(session.difficulty);
      race.laps = stage.laps;
      race.mirror = race.cup.mirror;
      race.split = session.entrants.some(entrant => entrant.id === LOCAL_GUEST);
      selectTrack(stage.track);
    } else {
      race.cup = null;
      race.diff = difficultyById(setup.difficulty);
      race.laps = race.mode === 'battle' ? 1 : setup.laps;
      race.mirror = setup.mirror;
      race.split = setup.split;
    }
  }
  mode = 'loading';
  race.state = 'loading';
  garage.controls.enabled = false;
  $('loading').classList.remove('hidden');
  $('loading').setAttribute('aria-busy', 'true');
  $('garage').inert = $('race').inert = true;
  $('loading-back').focus();
  const def = TRACKS[trackIndex], tip = pick(TIPS);
  $('loading-title').textContent = def.name;
  setMenuImage($('loading-art'), trackArt(def.id));
  $('loading-meta').textContent = race.cup ? `${race.cup.definition.name} · Carrera ${race.cup.session.stageIndex + 1} de 4 · ${race.laps} ${race.laps === 1 ? 'vuelta' : 'vueltas'}`
    : race.mode === 'battle' ? `Derrape · Batalla de globos · ${def.name}` : `Derrape · Pista ${trackIndex + 1} de ${TRACKS.length} · ${race.laps} ${race.laps === 1 ? 'vuelta' : 'vueltas'}`;
  $('loading-blurb').textContent = def.blurb;
  music.preload(songFor(def.id, race.mode));
  $('loading-tip-icon').innerHTML = tip[0];
  $('loading-tip').textContent = tip[1];
  $('play').disabled = true;
  sound.stopEngine();
  music.stop();
  waterAmbience.stop();
  const step = async (label, progress) => {
    $('loading-status').textContent = label;
    $('loading-progress').value = progress;
    $('loading-pct').textContent = `${Math.round(progress * 100)}%`;
    await paintNext();
    return generation === loadGeneration;
  };
  try {
    if (!await step('Preparando la pista…', 0.05)) return;
    clearRace();
    if (beginTrack(TRACKS[trackIndex].id)) {
      let progress = 0.12;
      for (const label of T.buildSteps()) {
        race.trackGroup = T.group;
        if (!await step(label, progress)) return;
        progress += 0.1;
      }
      finishTrack();
    }
    if (!await step('Preparando los carros…', 0.5)) return;
    if (roster) {
      const activeRoster = roster.filter(r => (!r.retired && !r.dns) || r.id === net.id);
      for (const [i, r] of activeRoster.entries()) {
        if (!await step(`Preparando los panas… ${i + 1}/${activeRoster.length}`, 0.5 + (i + 1) / activeRoster.length * 0.3)) return;
        const mine = r.id === net.id;
        const c = makeRacer(r.car, mine, r.name, r.wheel, r.avatar, r.cosmetics);
        c.entrantId = r.id;
        c.resuming = r.owner === net.id && net.state.startAt > 0;
        if (r.kind === 'bot' && r.skillSeed) c.skill = cupSkill({ skillSeed: r.skillSeed }, race.diff);
        Object.assign(c, { netId: r.id, bot: r.kind === 'bot', remote: r.owner !== net.id, buf: [], gap: 1000 / POSE_HZ, delay: 120, dns: !!r.dns, retired: !!r.retired });
        const { lane, row } = gridSlot(r.slot);
        placeRacer(c, lane, row);
        if (r.dns || r.retired) {
          c.done = true;
          setGhost(c, true);
          c.car.root.visible = false;
        }
        race.cars.push(c);
      }
      // A reload mid-race puts this car back where the room last saw it.
      for (const c of race.cars) if (!c.remote) resumePose(c, net.lastPose(c.netId));
    } else if (race.cup) {
      const session = race.cup.session, grid = session.grids[session.stageIndex];
      for (const [i, id] of grid.entries()) {
        if (!await step(`Preparando los panas… ${i + 1}/${grid.length}`, 0.5 + (i + 1) / grid.length * 0.3)) return;
        const entrant = session.entrants.find(item => item.id === id);
        const mine = id === LOCAL_PLAYER, guest = id === LOCAL_GUEST;
        const c = makeRacer(entrant.loadout.car, mine, entrant.name, entrant.loadout.wheel, entrant.avatar, entrant.loadout);
        c.entrantId = id;
        c.entrant = entrant;
        if (guest) { c.human = 2; c.skill = 1; }
        else if (!mine) c.skill = cupSkill(entrant, race.diff);
        const { lane, row } = gridSlot(i);
        placeRacer(c, lane, row);
        race.cars.push(c);
      }
    } else {
      const others = CARS.map((_, i) => i).filter((i) => i !== playerIndex).sort(() => Math.random() - 0.5);
      const names = RIVALS.slice(0, 6).sort(() => Math.random() - 0.5);
      const rivals = others.slice(0, RACERS - 1).map((car, i) => ({ car, name: names[i], wheel: AI_WHEELS[CARS[car].id] }));
      race.cars = [makeRacer(playerIndex, true, undefined, wheelId)];
      if (race.split) {
        const p2 = makeRacer((playerIndex + 1) % CARS.length, false, 'Jugador 2', 'calle');
        p2.human = 2;
        p2.skill = 1;
        race.cars.push(p2);
      }
      for (let i = race.cars.length; i < RACERS; i++) {
        if (!await step(`Preparando los panas… ${i}/${RACERS}`, 0.5 + i * 0.08)) return;
        const r = rivals[i - (race.split ? 2 : 1)] ?? rivals[i - 1];
        race.cars.push(makeRacer(r.car, false, r.name, r.wheel, r.avatar));
      }
      if (race.mode === 'battle') {
        race.cars.forEach((c, i) => {
          placeRacer(c, 0, 0);
          placeAlong(c, T.LINE + i * T.TOTAL / RACERS, i % 2 === 1);
          addBalloons(c);
        });
      } else {
        race.cars.forEach((c, i) => placeRacer(c, i % 2 ? -3.5 : 3.5, Math.floor((RACERS - 1 - i) / 2)));
      }
    }
    race.player = race.cars.find(c => c.isPlayer) ?? race.cars[0] ?? null;
    race.p2 = race.cars.find(c => c.human === 2) ?? null;
    race.splits = []; race.lapSeen = 1; race.bestLap = null;
    $('best-pill').hidden = true;
    $('stage-pill').hidden = !race.cup;
    if (race.cup) $('stage-readout').textContent = `${race.cup.session.stageIndex + 1}/4`;
    $('race').classList.toggle('split', !!race.p2);
    $('p2-hud').hidden = !race.p2;
    resize();
    race.playerIndex = playerIndex;
    race.playerWheel = wheelId;
    race.clock = 0;
    race.intermission = null;
    race.firstHumanFinish = null;
    race.stageCap = race.cup ? race.cup.definition.stages[race.cup.session.stageIndex].capSeconds : null;
    race.count = 3.999;
    race.boardT = 0;
    race.poseAt = 0;
    race.camPos = null;
    race.camPos2 = null;
    race.netRace = roster ? net.state.raceId : 0;
    race.scene.scale.x = race.mirror ? -1 : 1;
    race.ended = false;
    race.paid = false;
    race.earned = 0;
    if (!await step('Todo listo. ¡A correr!', 0.9)) return;
    renderer.toneMapping = THREE.NoToneMapping;
    updateRace(0);
    await renderer.compileAsync(race.scene, race.camera);
    if (generation !== loadGeneration) return;
    // Upload geometry and draw once behind the loading panel. The countdown
    // starts only after this first frame, never while compilation is running.
    renderer.render(race.scene, race.camera);
    if (roster) {
      // Everyone counts down together once every pana has loaded.
      net.loaded();
      if (!await step('Esperando a los panas…', 1)) return;
      if (!await net.until(s => s.raceId !== race.netRace || s.startAt > 0 || s.phase === 'lobby', (s) => {
        const racing = s.players.filter(p => p.racing), ready = racing.filter(p => p.loaded).length;
        $('loading-status').textContent = `Esperando a los panas… ${ready}/${racing.length} listos`;
      }) || generation !== loadGeneration) return;
      if (net.state.raceId !== race.netRace || net.state.phase === 'lobby') return;
      syncRacers(net.state);
    } else if (!await step('¡Listo!', 1)) return;
    if (race.cup && !roster) markRacing(race.cup.session);
    race.loadingRaceId = 0;
    race.state = 'count';
    music.play(songFor(T.id, race.mode), { fallback: TRACK_STYLE[T.id] });
    $('count').textContent = '3';
    $('garage').classList.add('hidden');
    $('race').classList.remove('hidden');
    $('result').classList.add('hidden');
    garage.controls.enabled = false;
    sound.startEngine();
    acc = 0;
    clock.getDelta();
    mode = 'race';
    $('garage').inert = $('race').inert = false;
    $('loading').classList.add('hidden');
    renderer.domElement.tabIndex = -1;
    renderer.domElement.focus({ preventScroll: true });
    if (roster && ['results', 'complete'].includes(net.state.phase)) finish();
  } catch (error) {
    console.error('Derrape loading failed', error);
    if (generation === loadGeneration) {
      if (!race.trackReady && T?.group) race.trackGroup = T.group;
      $('loading-status').textContent = 'No pudimos preparar la carrera. Vuelve al garaje e inténtalo otra vez.';
      race.state = 'off';
      race.loadingRaceId = 0;
      mode = 'garage';
    }
  } finally {
    if (generation === loadGeneration) {
      $('play').disabled = false;
      $('loading').setAttribute('aria-busy', 'false');
    }
  }
}

function toGarage() {
  if (net && (race.netRace || race.loadingRaceId) && ['loading', 'count', 'race'].includes(net.state.phase)) net.retire();
  race.netRace = 0;
  race.loadingRaceId = 0;
  ++loadGeneration;
  $('loading').classList.add('hidden');
  $('loading').setAttribute('aria-busy', 'false');
  $('garage').inert = $('race').inert = false;
  $('play').disabled = false;
  race.state = 'off';
  clearRace();
  sound.stopEngine();
  music.stop();
  waterAmbience.stop();
  $('race').classList.add('hidden');
  $('garage').classList.remove('hidden');
  garage.controls.enabled = true;
  mode = 'garage';
  garageMusic();
  if (net) renderLobby(net.state);
  else {
    if (race.cup) abandonCup(race.cup.session);
    race.cup = null;
    renderSetup();
  }
  saveWallet();
  race.scene.scale.x = 1;
  race.p2 = null;
  $('race').classList.remove('split');
  $('p2-hud').hidden = $('wrong-way').hidden = $('incoming').hidden = true;
  resize();
  menuFlow?.show('ready', false);
  $('play').focus({ preventScroll: true });
}

// Esc pauses the race (or opens the settings in the garage). Paused races
// keep their clock, items and AI frozen until the menu closes.
let paused = false;
const menu = createGameMenu({
  title: 'Derrape', heading: 'Pausa', sound, orientation: 'horizontal',
  note: () => mode === 'race' ? (race.state === 'end' ? 'La carrera terminó.' : race.netRace ? 'Carrera online: no se detiene.' : 'La carrera está en pausa.') : 'Estás en el garaje.',
  controls: [['W / ↑', 'Acelerar'], ['S / ↓', 'Frenar'], ['A D / ← →', 'Girar'], ['Shift / K', 'Saltar y derrapar · truco en el aire'], ['Espacio / E', 'Lanzar objeto adelante'],
    ['X', 'Lanzar objeto atrás'], ['1 2', 'Elegir objeto'], ['Q', 'Cambiar objeto'], ['R', 'Pedir rescate al zamuro'], ['C', 'Mirar atrás'], ['Mando', 'RT gas · LT freno · RB derrape · LB/X objeto · Y rescate'], ['H', 'Claxon'], ['M', 'Sonido'], ['Esc', 'Pausa']],
  tips: ['Mantén Shift y gira para derrapar. La ayuda corrige si te acercas al borde; gira al otro lado para abrir la curva.',
    'Suelta Shift al salir de la curva: el carro se estabiliza y las chispas dan turbo. No hace falta esperar a las moradas.',
    'Acelera justo al final del "1" para un arranque cohete. Si aceleras en el "3" se te ahoga el motor.',
    'Rompe cajas de madera para conseguir objetos. Cada moneda da un poquito más de velocidad.',
    'Sales y vuelves del rescate como fantasma durante 3 segundos. Los roces entre carros ya no te lanzan al aire.',
    'Cada carro tiene su talento: lee su ficha y combina cauchos con derrapes, rebufo o piruetas.',
    'Calidad Rápida reduce sombras, lluvia y detalles para equipos lentos. No cambia la física ni reduce el retraso de internet.'],
  actions: [
    { id: 'restart', label: 'Reiniciar carrera', kind: 'secondary', visible: () => mode === 'race' && !race.netRace && (!race.cup || ['loading', 'racing'].includes(race.cup.session.status)), run: () => startRace(race.playerIndex, race.playerWheel) },
    { id: 'to-garage', label: 'Volver al garaje', kind: 'secondary', visible: () => mode === 'race', run: () => toGarage() },
  ],
  invite: () => inviteLink(),
  canOpen: () => mode !== 'loading',
  onOpen() {
    resetInput();
    if (mode !== 'race' || race.netRace) return;
    paused = true;
    music.pause();
    waterAmbience.stop();
    if (sound.engine) sound.engine.g.gain.setTargetAtTime(0, sound.ctx.currentTime, 0.05);
  },
  onClose() { if (paused) music.resume(); paused = false; acc = 0; clock.getDelta(); },
});
$('race').querySelector('.hud-corner').append(menu.createButton({ id: 'pause', label: 'Pausa', className: 'pause-button pk-btn pk-btn--sm' }));
$('garage').querySelector('.tools').prepend(menu.createButton({ id: 'settings', label: 'Ajustes', className: 'toggle pk-btn pk-btn--sm' }));
for (const kbd of document.querySelectorAll('#pause kbd, #settings kbd')) kbd.classList.add('pk-kbd');

$('again').onclick = () => {
  if (!race.netRace) {
    if (race.cup?.session.status === 'intermission') advanceStage(race.cup.session);
    else if (race.cup?.session.status === 'complete') race.cup = null;
    return startRace(race.playerIndex, race.playerWheel);
  }
  if (net.isHost) {
    if (net.cup?.status === 'intermission') net.next();
    else net.start();
  }
};
$('back').onclick = () => {
  if (race.netRace && net.isHost && ['results', 'complete'].includes(net.state.phase)) net.lobby();
  else toGarage();
};
$('loading-back').onclick = toGarage;
function itemAction(direction) {
  if (mode === 'race' && race.state === 'go') race.items.use(race.player, direction);
}
function selectSlot(slot) {
  if (mode === 'race' && race.state === 'go') race.items.select(race.player, slot);
}
$('throw-front').onclick = () => itemAction(1);
$('throw-back').onclick = () => itemAction(-1);
$('swap-item').onclick = () => selectSlot();
for (let i = 0; i < 2; i++) $('item-slot-' + i).onclick = () => selectSlot(i);

// Multi-touch keeps steering and throttle independent (engine/touch.js). Lost focus
// releases input, including a thumb dragged off a control or a cancelled touch.
const touchHeld = new Set();
const driveButtons = [...document.querySelectorAll('[data-drive]')].map(button => holdButton(button, {
  down: () => { sound.unlock(); touchHeld.add(button.dataset.drive); },
  up: () => touchHeld.delete(button.dataset.drive),
}));
function resetInput() { race.keys = {}; race.codes = {}; for (const b of driveButtons) b.release(); touchHeld.clear(); }
addEventListener('blur', resetInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const k = e.key.toLowerCase();
  race.keys[k] = true;
  race.codes[e.code] = true;
  if (race.p2 && mode === 'race' && race.state === 'go' && !e.repeat) {
    // The second pana's buttons (split screen).
    if (e.code === 'Enter') { e.preventDefault(); race.items.use(race.p2, 1); }
    if (e.code === 'Period') race.items.use(race.p2, -1);
    if (e.code === 'Comma') race.items.select(race.p2);
    if (e.code === 'Backspace') { e.preventDefault(); rescue(race.p2); }
  }
  if (k === 'escape' && mode === 'loading') toGarage();
  if (k === 'h' && !e.repeat) {
    if (mode === 'race' && race.player) honk(race.player);
    else if (mode === 'garage') garageHonk();
  }
  if (k === 'm' && !e.repeat) toggleMute();
  if (k === 'r' && !e.repeat && mode === 'race' && race.state === 'go' && race.player) rescue(race.player);
  if ((k === ' ' || k === 'e') && mode === 'race' && race.state === 'go' && race.player) {
    e.preventDefault();
    if (!e.repeat) itemAction(race.keys.s || race.keys.arrowdown ? -1 : 1);
  }
  if (mode === 'race' && ['x', 'q', '1', '2'].includes(k)) {
    e.preventDefault();
    if (!e.repeat) {
      if (k === 'x') itemAction(-1);
      else selectSlot(k === 'q' ? undefined : Number(k) - 1);
    }
  }
  if (e.key.startsWith('Arrow') && mode === 'race') e.preventDefault();
});
addEventListener('keyup', (e) => { race.keys[e.key.toLowerCase()] = false; race.codes[e.code] = false; });

// Driver n's controls: keyboard (both key sets alone, its own set in split
// screen), touch for driver 1, and game controller n.
function playerInput(n = 1) {
  let input;
  if (race.p2) input = keyInput(race.codes, SPLIT_KEYS[n]);
  else {
    const k = { ...race.keys };
    for (const key of touchHeld) k[key] = true;
    input = {
      throttle: (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0),
      steer: (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0),
      drift: !!(k.shift || k.k), look: !!k.c,
    };
  }
  const pad = race.pads?.[n - 1];
  if (pad) {
    input.throttle = input.throttle || pad.throttle;
    input.steer = input.steer || pad.steer;
    input.drift = input.drift || pad.drift;
    input.look = input.look || pad.look;
  }
  if (race.mirror) input.steer = -input.steer;   // the world is drawn flipped: left on screen is world right
  return input;
}

// Game controllers: poll each frame, fire item / rescue / pause on presses.
let padsBefore = [null, null];
function pollPads() {
  const list = navigator.getGamepads?.() || [];
  race.pads = [padInput(list[0]), padInput(list[1])];
  race.pads.forEach((pad, i) => {
    const hit = pressed(pad, padsBefore[i]);
    const who = i === 0 ? race.player : race.p2;
    if (pad && hit.pause) menu.toggle();
    if (mode === 'race' && race.state === 'go' && who) {
      if (hit.item) race.items.use(who, 1);
      if (hit.itemBack) race.items.use(who, -1);
      if (hit.swap) race.items.select(who);
      if (hit.rescue) rescue(who);
    }
  });
  padsBefore = race.pads;
}

function aiInput(c) {
  // aim ahead along the track, holding this car's own lane so the pack
  // doesn't pile into the middle (it still bumps when lanes cross)
  const way = c.reverse ? -1 : 1;
  const s = paramOf(c.x, c.z, c.y) + way * (14 + Math.max(0, c.vf) * 0.25);
  const target = pointAt(s);
  const next = pointAt(s + way);
  const tx = next.x - target.x, tz = next.y - target.y, tl = Math.hypot(tx, tz) || 1;
  target.x += -tz / tl * c.lane * 0.8;
  target.y += tx / tl * c.lane * 0.8;
  const diff = wrapAngle(Math.atan2(target.x - c.x, target.y - c.z) - c.h);
  const ref = race.netRace
    ? (standings().find(r => !r.bot && !r.ghost && !r.dns && !r.retired) || race.player || race.cars[0])
    : (race.player || race.cars[0]);
  const gap = ref ? (c.lap * T.TOTAL + c.prog) - (ref.lap * T.TOTAL + ref.prog) : 0;
  // Catch-up: rivals far behind find a little extra, far ahead ease off.
  c.band = race.mode === 'battle' ? 1 : rubberBand(gap, race.diff);
  // Rivals drift through long bends and let go once the nose lines up.
  if (!c.aiDrift && Math.abs(diff) > 0.3 && c.vf > 20 && c.onGround) c.aiDrift = true;
  else if (c.aiDrift && (Math.abs(diff) < 0.08 || (c.drift && Math.sign(diff) !== c.drift) || c.driftT > 2.8)) c.aiDrift = false;
  return { ...aiPedals(diff, race.mode === 'battle' ? 0 : gap), drift: c.aiDrift && race.diff?.drift !== false };
}

function say(c, lines, time) {
  const text = typeof lines === 'string' ? lines : pick(lines);
  c.bubble.say(text, time);
  if (race.netRace && !c.remote) net.fx(c.netId, 'say', { text, time });
}

function honk(c) {
  if (c.honkT > 0) return;
  const horn = hornFor(c);
  c.honkT = sound.horn(horn);
  c.bubble.say(LINES.honk[horn], c.honkT + 0.2);
  c.heave.v += 5;   // the whole car jumps when it honks
  if (race.netRace && !c.remote) net.fx(c.netId, 'honk', {});
}

function popPart(c, power) {
  const parts = c.car.detachables;
  if (!parts.length) return;
  const obj = parts.splice(Math.floor(Math.random() * parts.length), 1)[0];
  race.puffs.spawn(obj.getWorldPosition(new THREE.Vector3()), { color: 0x9a9aa2, count: 5, size: 0.8 });
  race.debris.launch(obj, new THREE.Vector3(c.vx * 0.5 + rand(-4, 4), 6 + power * 0.3 + rand(0, 4), c.vz * 0.5 + rand(-4, 4)));
  c.lost++;
}

// A hit knocks coins off the car: they burst out as golden puffs.
function spillCoins(c, n) {
  const lost = loseCoins(c, n);
  if (lost) race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1.6, c.z), { color: 0xffc629, count: lost * 4, spread: 2.4, size: 0.5, rise: 3, life: 0.7 });
  return lost;
}

function crash(c, power, side) {
  if (isGhost(c)) return;
  if (power >= 12) popBalloon(c);
  c.vy = Math.max(c.vy, power * 0.38 / c.tune.mass);
  c.onGround = false;
  c.airTime = 0;
  c.rollV += side * power * 0.35 / c.tune.mass;
  c.pitchV += rand(-1, 1) * power * 0.12;
  c.dizzy = 1.4;
  c.scream = 1.2;
  c.drift = 0; c.driftT = 0; c.driftExitT = 0;
  spillCoins(c, power >= 14 ? 2 : 1);
  say(c, LINES.crash);
  popPart(c, power);
  if (power > 14) popPart(c, power);
  race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1, c.z), { color: 0xc8c8d0, count: 8, spread: 2 });
  if (c.isPlayer) race.shake = Math.min(1, race.shake + power * 0.05);
  recordImpact(c, race.clock, true);
}

function stepCar(c, input, dt) {
  const t = c.tune;   // car tune composed with the racer's cauchos (makeRacer)
  const boosting = c.boost > 0;
  // Under an aguacero cloud the car is slower and slides, less so on rain cauchos.
  const rained = c.cloud > 0 ? (t.wetFloor >= 0.5 ? 0.93 : 0.74) : 1;
  const wetGrip = (c.onGround ? roadGripAt(T,c.x,c.z,race.clock) : 1) * (1-(T.def.rain||0)*.4);
  const wet = 1 - wetGrip;
  const top = t.top * c.skill * (c.band || 1) * coinMultiplier(c) * rained * (1 - wet * t.wetDrag);
  const terrain=T.def.offroad;
  // Wheel off-road resistance scales every roughness penalty below (accel,
  // speed cap, drag); slicks go negative and make rough ground worse.
  const rough=(c.onGround?roughnessAt(T,c.x,c.z):0)*(1-t.offroadResist);
  const water=c.onGround?roadWaterAt(T,c.x,c.z,race.clock):0;
  // Rain cauchos keep a grip floor where the road reports wet.
  // Rain (and an aguacero cloud) cut grip; rain cauchos keep a floor.
  const grip=Math.max(wetGrip*(c.cloud>0?.55:1),t.wetFloor);
  const waterDrag = 1 - t.wetFloor * 0.65;
  const acceleration=t.accel*(1-rough*(1-(terrain?.accel??1)))*(1-water*.28*waterDrag);
  const previous={x:c.x,z:c.z};
  if (c.spin > 0) input = { throttle: 0, steer: 0 };   // skidding on a peel: no control
  if (c.stall > 0) { c.stall -= dt; input = { ...input, throttle: 0 }; }   // flooded engine after a jumped start
  // A short entry hop; keep holding and turn whenever ready after landing.
  // In the air after a ramp the same button is still a trick.
  const held = !!input.drift;
  c.driftExitT = Math.max(0, (c.driftExitT || 0) - dt);
  c.driftAssist = 0;
  if (held && !c.driftHeld && c.spin <= 0) {
    if (c.onGround && c.vf > 4) {
      c.vy = HOP_SPEED; c.onGround = false; c.airTime = 0; c.hopping = true;
    } else if (!c.onGround && !c.hopping && !c.trick && c.airTime > 0.06) {
      c.trick = true; c.trickT = 0;
      if (c.isPlayer) sound.tone(660, 0, 0.09, 'triangle', 0.1);
    }
  }
  c.driftHeld = held;
  if (!c.drift && held && c.onGround && Math.abs(input.steer) > 0.2 && c.vf > DRIFT_MIN_SPEED && c.spin <= 0 && c.stall <= 0) {
    c.drift = Math.sign(input.steer); c.driftT = 0;
    c.driftExitT = 0;
    c.driftLane = Math.max(-T.HW * 0.3, Math.min(T.HW * 0.3, offsetOf(c.x, c.z, c.y)));
    if (c.isPlayer) sound.skid(0.8);
  }
  if (c.drift && (!held || c.vf < DRIFT_MIN_SPEED * 0.75 || c.spin > 0)) {
    // Letting go pays the charged turbo; a spin-out or stall loses it.
    const level = driftLevel(c.driftT);
    if (!held && level && c.spin <= 0) {
      c.boost = Math.max(c.boost, DRIFT_BOOST[level] * t.driftBoost);
      if (c.isPlayer) sound.turbo();
    }
    if (!held && c.spin <= 0) c.driftExitT = DRIFT_EXIT_TIME;
    c.drift = 0; c.driftT = 0;
  }
  let fx = Math.sin(c.h), fz = Math.cos(c.h);
  let rx = -Math.cos(c.h), rz = Math.sin(c.h);
  let vf = c.vx * fx + c.vz * fz;
  let vr = c.vx * rx + c.vz * rz;
  const prevVf = vf;

  if (c.onGround) {
    if (boosting) vf += acceleration * 2.5 * dt;
    else if (input.throttle > 0) vf += acceleration * input.throttle * dt;
    else if (input.throttle < 0) {
      if (c.isPlayer && vf > 12 && (!c.skidT || race.clock - c.skidT > 0.38)) {
        c.skidT = race.clock;
        sound.skid(0.6);
      }
      vf -= (vf > 0 ? t.accel * 2.2 * (.75+.25*grip) : acceleration * 0.6) * dt;
    }
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
    // a turbo lifts the cap; when it ends the extra speed bleeds off instead of snapping
    // Shortcut planks are bumpy: without a turbo they cost speed.
    const onPlank = T.shortcuts.length > 0 && !boosting && T.plankAt(c.x, c.z) != null;
    const surfaceTop=top*(1-rough*(1-(terrain?.speed??1)))*(onPlank ? 0.72 : 1);
    // Rough ground bleeds speed progressively; turbo still helps but cannot
    // cancel the terrain penalty and turn the grass into the fastest route.
    const cap = rough>0||onPlank?Math.max(surfaceTop*(boosting?1.5:1),prevVf-48*dt):boosting?top*1.5:Math.max(top,prevVf-20*dt);
    vf = Math.max(-surfaceTop * 0.4, Math.min(cap, vf));
    vf*=Math.exp(-rough*(terrain?.drag??0)*dt);
    vf*=Math.exp(-water*.7*waterDrag*dt); // rain tires displace shallow water better
    // A drift loosens the rear: less lateral grip, so the car slides outward.
    vr *= Math.exp(-t.grip * grip * (c.drift ? 0.62 : c.driftExitT > 0 ? 1.8 : 1) * dt);
    const turnScale = t.turn * Math.max(-1, Math.min(1, vf / 10)) * (1 - Math.abs(vf) / top * 0.3);
    let steerIn = c.drift ? driftSteer(c.drift, input.steer) : input.steer;
    let cornering = false;
    if ((c.drift || c.driftExitT > 0) && vf > DRIFT_MIN_SPEED * 0.75 && race.mode !== 'battle'
      && Math.abs(offsetOf(c.x, c.z, c.y)) < T.HW && T.plankAt(c.x, c.z) == null) {
      const s = paramOf(c.x, c.z, c.y), here = pointAt(s), ahead = pointAt(s + 1);
      const roadHeading = Math.atan2(ahead.x - here.x, ahead.y - here.y);
      // Wrong-way driving, shortcuts, real jumps and off-road terrain stay manual.
      if (Math.cos(c.h - roadHeading) > 0.35) {
        const look = 12 + vf * 0.45, aim = pointAt(s + look), next = pointAt(s + look + 1);
        const angle = Math.atan2(next.x - aim.x, next.y - aim.y);
        // Steering chooses a tighter/wider line even during a strong correction.
        const lane = Math.max(-T.HW * 0.42, Math.min(T.HW * 0.42, (c.driftLane || 0) - input.steer * T.HW * 0.22));
        cornering = c.drift * wrapAngle(angle - roadHeading) > 0.035;
        const aimError = wrapAngle(Math.atan2(aim.x - Math.cos(angle) * lane - c.x, aim.y + Math.sin(angle) * lane - c.z) - c.h);
        const projectedHeading = c.h + steerIn * turnScale * 0.3;
        const projectedOffset = offsetOf(c.x + Math.sin(projectedHeading) * vf * 0.55, c.z + Math.cos(projectedHeading) * vf * 0.55,c.y);
        const assist = assistDrift(steerIn, aimError, projectedOffset, T.HW, turnScale);
        steerIn = assist.steer; c.driftAssist = assist.amount;
      }
    }
    c.steer += (steerIn - c.steer) * Math.min(1, dt * (c.driftExitT > 0 ? 18 : c.driftAssist > 0.3 ? 12 : 8));
    const turn = c.steer * turnScale;
    if (c.drift) {
      // Charge real cornering, not a held button on an assisted straight.
      if (cornering || turn * c.drift > 0.18) c.driftT += dt * driftCharge(c.drift, input.steer) * t.driftCharge;
      c.driftLvl = driftLevel(c.driftT);
    }
    c.h += turn * dt;
    c.latAcc = turn * vf;
  } else {
    c.steer += (input.steer - c.steer) * Math.min(1, dt * 3);
    c.h += c.steer * 0.6 * dt;             // a little air control
    c.latAcc = 0;
  }
  c.longAcc = (vf - prevVf) / dt;
  fx = Math.sin(c.h); fz = Math.cos(c.h);
  rx = -Math.cos(c.h); rz = Math.sin(c.h);
  c.vx = fx * vf + rx * vr;
  c.vz = fz * vf + rz * vr;
  c.vf = vf;
  c.vr = vr;
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  T.constrainMotion?.(c,previous);
  c.vf=c.vx*fx+c.vz*fz;c.vr=c.vx*rx+c.vz*rz;

  // ---- vertical: ramps, jumps, tumbles ----
  const g = groundAt(c.x, c.z, c.y);
  if (c.onGround) {
    const previousGround=terrain&&Math.abs(offsetOf(previous.x,previous.z))>T.HW?groundAt(previous.x,previous.z):T.surfaceAt(previous.x,previous.z,c.y);
    const followingTerrain = Math.abs(c.y-previousGround)<0.15;
    if (g >= c.y - 0.08 || (followingTerrain && Math.abs(g - c.y) < 1.2)) {
      c.vy = (g - c.y) / dt;
      c.y = g;
      const ahead = groundAt(c.x + fx, c.z + fz,c.y), behind = groundAt(c.x - fx, c.z - fz,c.y);
      c.pitch += (-Math.atan2(ahead - behind, 2) - c.pitch) * Math.min(1, dt * 12);
      c.roll += (0 - c.roll) * Math.min(1, dt * 10);
    } else {
      c.onGround = false;   // drove off the ramp lip: fly!
      c.airTime = 0;
    }
  }
  if (!c.onGround) {
    c.airTime += dt;
    c.vy -= G * dt;
    c.y += c.vy * dt;
    c.pitch += c.pitchV * dt + 0.25 * dt;   // nose slowly drops
    c.roll += c.rollV * dt;
    if (c.airTime > 0.45 && c.scream <= 0 && c.y > 1.2) {
      c.scream = 0.8;
      say(c, LINES.air, 0.9);
    }
    if (c.y <= g) {
      c.y = g;
      const impact = -c.vy;
      const upright = Math.abs(wrapAngle(c.roll)) < 0.7 && Math.abs(wrapAngle(c.pitch)) < 0.7;
      if (upright) {
        c.onGround = true;
        c.vy = 0;
        c.roll = wrapAngle(c.roll);
        c.pitch = wrapAngle(c.pitch);
        c.rollV = c.pitchV = 0;
        c.heave.v -= impact * 0.5;
        if (c.hopping) c.hopping = false;
        if (c.trick) {
          const bonus = trickBoost(c.airTime, true) * (t.trickBoost ?? 1);
          if (bonus) {
            c.boost = Math.max(c.boost, bonus);
            say(c, LINES.trick, 0.9);
            if (c.isPlayer) sound.turbo();
          }
          c.trick = false;
        }
        if (impact > 9) {
          sound.boing();
          race.puffs.spawn(new THREE.Vector3(c.x, 0.2, c.z), { color: 0xe0b07a, count: 6, spread: 2.5, rise: 0.8 });
          if (c.isPlayer) race.shake = Math.min(1, race.shake + 0.25);
        }
      } else {
        // cartoon bounce that sets the car back on its wheels
        c.trick = false; c.hopping = false; c.drift = 0; c.driftT = 0;
        sound.bonk(1.2);
        race.puffs.spawn(new THREE.Vector3(c.x, g + 0.3, c.z), { color: 0xe0b07a, count: 7, spread: 2.5, rise: 0.8 });
        c.vy = 7.5;
        const flight = 2 * c.vy / G;
        c.rollV = (Math.round(c.roll / (Math.PI * 2)) * Math.PI * 2 - c.roll) / flight;
        c.pitchV = (Math.round(c.pitch / (Math.PI * 2)) * Math.PI * 2 - c.pitch) / flight;
        c.vx *= 0.6;
        c.vz *= 0.6;
        c.scream = 0.8;
      }
    }
  }

  // ---- tire walls ----
  // Works on any track shape: the wall normal is the gradient of offsetOf.
  // Shortcut planks and open edges have no wall: drive off them and you fall.
  const off = offsetOf(c.x, c.z, c.y);
  const limit = T.HW - 1.6;
  const plank = T.shortcuts.length > 0 && T.plankAt(c.x, c.z) != null;
  const edgeOpen = T.drops.length > 0 && isOpenEdge(T.drops, paramOf(c.x, c.z, c.y) / T.TOTAL, Math.sign(off));
  const far = Math.abs(off) > T.HW + OPEN_MARGIN;
  if (!terrain && Math.abs(off) > limit && !plank && !edgeOpen && !far) {
    const e = 0.6;
    let nx = offsetOf(c.x + e, c.z,c.y) - offsetOf(c.x - e, c.z,c.y);
    let nz = offsetOf(c.x, c.z + e,c.y) - offsetOf(c.x, c.z - e,c.y);
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl; nz /= nl;   // points to the outside
    const side = Math.sign(off);
    c.x -= nx * (Math.abs(off) - limit) * side;
    c.z -= nz * (Math.abs(off) - limit) * side;
    const vn = (c.vx * nx + c.vz * nz) * side;   // speed into the wall
    if (vn > 0) {
      c.vx -= 1.4 * vn * nx * side;
      c.vz -= 1.4 * vn * nz * side;
      if (vn > 9 && !isGhost(c)) {
        c.drift = 0; c.driftT = 0;   // a hard wall hit throws the drift away
        sound.bonk(vn / 10);
        say(c, LINES.wall, 0.8);
        c.vy = Math.max(c.vy, 4);
        c.onGround = false;
        c.airTime = 0;
        c.rollV += (Math.random() < 0.5 ? -1 : 1) * vn * 0.12;
        if (Math.random() < 0.4) popPart(c, vn);
        if (c.isPlayer) race.shake = Math.min(1, race.shake + 0.2);
        recordImpact(c, race.clock);
      }
    }
  }

  // laps: crossing the line counts only after the lap's checkpoints
  const prog = progressOf(c);
  advanceLap(c, c.prog, prog, T.TOTAL);
  c.prog = prog;

  // Off the course (past an open edge, off a plank) the zamuro comes soon.
  c.outT = !terrain && offCourse(Math.abs(off), T.HW, edgeOpen, plank) ? c.outT + dt : 0;
  // Humans only count as stuck while pressing the gas; bots always try.
  const trying = !c.done && c.spin <= 0 && c.stall <= 0 && ((c.isPlayer && !AUTO) || c.human ? input.throttle !== 0 : true);
  c.stuckT = stuckStep(c.stuckT, c.vf, trying && race.state === 'go', dt);
  // Remember the last safe stretch of road to come back to.
  c.safeT -= dt;
  if (c.safeT <= 0 && c.onGround && !plank && Math.abs(off) < T.HW - 2 && c.spin <= 0
    && Math.abs(wrapAngle(c.roll)) < 0.3 && Math.abs(wrapAngle(c.pitch)) < 0.4) {
    const s = paramOf(c.x, c.z, c.y), ahead = pointAt(s + 1), here = pointAt(s);
    const back = Math.cos(c.h - Math.atan2(ahead.x - here.x, ahead.y - here.y)) < 0;
    c.safe = { s, off: Math.max(-3, Math.min(3, off)), back };
    c.safeT = 0.3;
  }

  // timers
  c.dizzy = Math.max(0, c.dizzy - dt);
  c.scream = Math.max(0, c.scream - dt);
  c.honkT = Math.max(0, c.honkT - dt);

  // Tire spray, dust and damage smoke share the bounded particle pool.
  c.puffT -= dt;
  if (c.puffT <= 0) {
    const kicking = c.onGround && ((input.throttle > 0 && Math.abs(vf) < top * 0.55) || Math.abs(c.vr) > 4);
    if (water>.15&&c.onGround&&Math.abs(vf)>7) {
      for(const side of [-1,1])race.puffs.spawn(new THREE.Vector3(c.x-fx*1.5+rx*side,c.y+.2,c.z-fz*1.5+rz*side),
        {color:0xc1e9e3,count:1,size:.45,rise:1.2,life:.35,spread:.8});
      race.shockwaves.ring(new THREE.Vector3(c.x - fx * 1.2, c.y, c.z - fz * 1.2), {
        color: 0xd8f4ef, maxRadius: 2.2, duration: 0.48, opacity: 0.55,
      });
    } else if (kicking) {
      race.puffs.spawn(new THREE.Vector3(c.x - fx * 1.6, c.y+0.25, c.z - fz * 1.6), { color: rough>0.1?0x889263:0xe7bd8a, count: 1, size: 0.7, rise: 0.6, life: 0.7 });
    }
    if (boosting) {
      race.puffs.spawn(new THREE.Vector3(c.x - fx * 2.2, c.y + 0.5, c.z - fz * 2.2), { color: pick(flameFor(c)), count: 2, size: 0.6, rise: 0.4, life: 0.35, spread: 0.4 });
    }
    if (c.lost >= 2) {
      race.puffs.spawn(new THREE.Vector3(c.x + fx * 1.4, c.y + 1.6, c.z + fz * 1.4), { color: 0x4a4a52, count: 1, size: 0.6, rise: 2, life: 1 });
    }
    c.puffT = 0.07;
  }
}

// ---------- the zamuro rescue ----------
// Off the course, stuck, or asked for (R): a vulture lifts the car, flies it
// back to the last safe stretch of road and drops it there, minus two coins.
function rescue(c) {
  if (c.rescueT > 0 || c.done || race.state !== 'go') return false;
  Object.assign(c, { rescueT: RESCUE_TIME, rescued: false, drift: 0, driftT: 0, driftExitT: 0, boost: 0, trick: false, hopping: false, outT: 0, stuckT: 0, spin: 0 });
  c.phaseT = RESCUE_TIME + RESCUE_GHOST_TIME;
  spillCoins(c, 2);
  say(c, LINES.rescue, 1.3);
  if (c.isPlayer) sound.sweep(380, 980, 0.45, 'triangle', 0.08);
  if (race.netRace && !c.remote) net.fx(c.netId, 'rescue', {});
  return true;
}

function stepRescue(c, dt) {
  c.rescueT = Math.max(0, c.rescueT - dt);
  const k = 1 - c.rescueT / RESCUE_TIME;
  c.vx = c.vz = c.vy = c.vf = c.vr = 0;
  c.onGround = false;
  c.pitch += (0 - c.pitch) * Math.min(1, dt * 6);
  c.roll += (0 - c.roll) * Math.min(1, dt * 6);
  if (k < 0.38) c.y += 7 * dt;   // lifted up and away
  else if (!c.rescued) {
    // Over the safe spot, facing along the road (or back, for battle bots).
    const safe = c.safe ?? { s: paramOf(c.x, c.z, c.y), off: 0, back: false };
    const p = pointAt(safe.s), q = pointAt(safe.s + 0.5);
    const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1;
    c.x = p.x - tz / l * safe.off; c.z = p.y + tx / l * safe.off;
    c.h = Math.atan2(tx, tz) + (safe.back ? Math.PI : 0);
    c.y = groundAt(c.x, c.z, T.heightAtS(safe.s)) + 5;
    const prog = progressOf(c);
    advanceLap(c, c.prog, prog, T.TOTAL);
    c.prog = prog;
    c.rescued = true;
  } else c.y = Math.max(groundAt(c.x, c.z, c.y), c.y - 7 * dt);   // lowered onto the road
  if (c.rescueT <= 0) {
    c.y = groundAt(c.x, c.z, c.y);
    c.onGround = true;
    c.pitch = c.roll = c.pitchV = c.rollV = 0;
    c.awayT = 1;
    c.phaseT = RESCUE_GHOST_TIME;
    c.impacts = [];
  }
}

// The zamuro model hovers over a car being rescued, then flies off.
const vultures = new Map();
function syncVulture(c, dt) {
  c.awayT = Math.max(0, (c.awayT || 0) - dt);
  let v = vultures.get(c);
  if (!(c.rescueT > 0 || c.awayT > 0)) { if (v) v.visible = false; return; }
  if (!v) {
    v = soaringVulture({ seed: c.def.num });
    v.scale.setScalar(2.1);
    v.name = 'rescue-zamuro';
    race.scene.add(v);
    vultures.set(c, v);
  }
  v.visible = true;
  const lift = c.awayT > 0 ? (1 - c.awayT) * 9 : 0;
  v.position.set(c.x, c.y + 2.2 + lift, c.z);
  v.rotation.y = c.h;
  v.userData.tick(race.clock * 9);
}

// A cow, bus or boulder in the road: a crash and a bounce back.
function hitHazard(c, power, side, hz) {
  crash(c, power, side);
  c.vx *= -0.3; c.vz *= -0.3;
  say(c, pick(race.hazards.lines(hz)), 1.1);
  sound.bonk(power / 10);
}

// "¡YA!": the player's timing decides a turbo or a stall; rivals sometimes
// nail it too.
function launchGrid() {
  if (race.cup && !race.netRace) for (const c of race.cars) markStarted(race.cup.session, c.entrantId);
  for (const c of race.cars) {
    c.phaseT = START_GHOST_TIME;
    if (c.remote) continue;
    const timing = c.isPlayer && !AUTO ? startBoost(race.throttleAt) : Math.random() < 0.35 ? startBoost(1.3) : startBoost(2.2);
    if (timing.boost) {
      c.boost = Math.max(c.boost, timing.boost);
      if (c.isPlayer) { sound.turbo(); say(c, LINES.rocket, 1); }
    }
    if (timing.stall) { c.stall = timing.stall; say(c, LINES.stall, 1); }
  }
  race.throttleAt = null;
}

// Sitting in another car's wake builds draft; a full charge slingshots past.
function slipstreams(dt) {
  for (const c of race.cars) {
    if (c.remote || c.done) continue;
    if (c.rescueT > 0) { c.draft = 0; continue; }
    const wake = race.cars.some(o => o !== c && !o.done && !o.ghost && o.rescueT <= 0 && inSlipstream(o, c));
    c.draft = wake ? c.draft + dt * (c.tune.draftCharge ?? 1) : Math.max(0, c.draft - dt * 2);
    if (c.draft >= DRAFT_TIME) {
      c.draft = 0;
      c.boost = Math.max(c.boost, DRAFT_BOOST * (c.tune.draftBoost ?? 1));
      if (c.isPlayer) { sound.turbo(); c.itemMessage = '¡Rebufo!'; c.itemMessageT = 1; }
    }
  }
}

function setGhost(c, ghost) {
  c.ghost = !!ghost;
  syncGhostAppearance(c);
}

function syncGhostAppearance(c) {
  const ghost = isGhost(c);
  if (!!c.ghostVisible === ghost) return;
  c.ghostVisible = ghost;
  c.car.root.traverse(o => {
    if (!o.material) return;
    const apply = (m) => {
      if (ghost) {
        const clone = m.userData?.ghostClone ? m : m.clone();
        (c.car.ghostMaterials ??= new Set()).add(clone);
        if (!m.userData?.ghostClone) clone.userData = { ...clone.userData, ghostClone: true, baseTransparent: m.transparent, baseOpacity: m.opacity ?? 1 };
        clone.transparent = true;
        clone.opacity = Math.min(0.42, clone.userData.baseOpacity);
        clone.needsUpdate = true;
        return clone;
      }
      if (m.userData?.ghostClone) {
        m.transparent = !!m.userData.baseTransparent;
        m.opacity = m.userData.baseOpacity ?? 1;
        m.needsUpdate = true;
      }
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(apply) : apply(o.material);
  });
}

function collideCars() {
  for (let i = 0; i < race.cars.length; i++) {
    for (let j = i + 1; j < race.cars.length; j++) collidePair(race.cars[i], race.cars[j]);
  }
}

function collidePair(a, b) {
  if (isGhost(a) || isGhost(b) || a.done || b.done || a.dns || b.dns || a.retired || b.retired) return;
  const hit = resolveContact(a, b);
  if (hit?.kind === 'crash') {
    sound.bonk(hit.speed / 8);
    for (const [c, contact] of [[a, hit.a], [b, hit.b]]) if (contact.hit) {
      c.heave.v -= Math.min(2, contact.power * 0.15);
      c.drift = 0; c.driftT = 0;
      if (race.mode === 'battle') popBalloon(c);
      recordImpact(c, race.clock);
    }
  } else if (hit?.kind === 'bump') {
    sound.bonk(0.4);
  }
}

// Sparks under the rear wheels show the drift charge: dust, then blue,
// orange and purple. A stalled engine coughs black smoke instead.
const SPARKS = [0xd8c6a8, 0x4fb6ff, 0xff9a1f, 0xc45bff];
function driftSparks(c, dt) {
  c.sparkT = (c.sparkT || 0) - dt;
  if (c.sparkT > 0) return;
  c.sparkT = 0.05;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -Math.cos(c.h), rz = Math.sin(c.h);
  if (c.drift && c.onGround) {
    const level = c.remote ? c.driftLvl || 0 : driftLevel(c.driftT);
    for (const side of [-1, 1]) {
      race.puffs.spawn(new THREE.Vector3(c.x - fx * 1.7 + rx * side * 1.1, c.y + 0.25, c.z - fz * 1.7 + rz * side * 1.1),
        { color: SPARKS[level], count: 1, size: level ? 0.42 : 0.6, rise: level ? 0.9 : 0.5, life: level ? 0.28 : 0.5, spread: 0.3 });
    }
  }
  if (c.stall > 0) race.puffs.spawn(new THREE.Vector3(c.x - fx * 2.2, c.y + 0.7, c.z - fz * 2.2), { color: 0x3a3a40, count: 1, size: 0.8, rise: 1.6, life: 0.8 });
  if (c.draft > 0.2 && c.isPlayer) {
    race.puffs.spawn(new THREE.Vector3(c.x + fx * 2 + rx * (Math.random() * 4 - 2), c.y + 1 + Math.random(), c.z + fz * 2 + rz * (Math.random() * 4 - 2)),
      { color: 0xf4f8ff, count: 1, size: 0.25, rise: 0, life: 0.25, spread: 0.2 });
  }
}

function syncCar(c, dt) {
  const car = c.car;
  car.root.position.set(c.x, c.y, c.z);
  // a peel spins the car around twice, easing out
  const k = 1 - c.spin / SPIN;
  // A drift swings the tail out; a trick spins the car once in the air.
  c.driftYaw += ((c.drift ? c.drift * 0.42 : 0) - c.driftYaw) * Math.min(1, dt * 9);
  if (c.trick) c.trickT += dt;
  const trickSpin = c.trick ? Math.min(1, c.trickT / 0.45) * Math.PI * 2 : 0;
  car.root.rotation.y = c.h + c.driftYaw + trickSpin + (c.spin > 0 ? (1 - (1 - k) ** 3) * Math.PI * 4 : 0);
  driftSparks(c, dt);
  syncVulture(c, dt);
  car.tumble.rotation.set(c.pitch, 0, c.roll);

  // springy suspension: squat, dive and lean, exaggerated
  const lean = Math.max(-1, Math.min(1, c.latAcc / 60));
  const dive = Math.max(-1, Math.min(1, c.longAcc / 40));
  const heave = c.heave.step(0, 160, 7, dt);
  const sp = c.sp.step(c.onGround ? -dive * 0.12 : 0.05, 140, 6, dt);
  const sr = c.sr.step(c.onGround ? -lean * 0.16 : 0, 140, 6, dt);
  car.chassis.position.y = heave * 0.15 + (c.onGround ? Math.sin(race.clock * 22 + c.def.num) * 0.012 * Math.min(1, Math.abs(c.vf) / 8) : 0);
  car.chassis.rotation.x = sp;
  car.chassis.rotation.z = sr;
  const boostStretch = c.boost > 0 ? Math.min(0.18, c.boost * 0.16) : 0;
  const hopSquash = Math.max(-0.22, Math.min(0.22, heave * 0.08));
  car.chassis.scale.set(
    1 - boostStretch * 0.35 - hopSquash * 0.4,
    1 - boostStretch * 0.45 + hopSquash,
    1 + boostStretch - hopSquash * 0.35
  );
  if (c.boost > 0.4 && c.isPlayer) {
    c.afterimageT = (c.afterimageT || 0) - dt;
    if (c.afterimageT <= 0) {
      c.afterimageT = 0.085;
      race.shockwaves.afterimage(car.chassis, { color: pick(flameFor(c)), duration: 0.24 });
    }
  }

  for (const w of car.wheels) {
    w.spin.rotation.x += c.vf * dt / car.radius;
    if (w.front) w.steer.rotation.y = c.steer * 0.45;
  }
  if (car.flag) car.flag.rotation.x = Math.sin(race.clock * 14) * 0.3 * Math.min(1, Math.abs(c.vf) / 8);

  // the driver: big head lags behind every bump and turn
  const d = car.driver;
  d.neck.rotation.z = c.headLag.step(-lean * 0.5 + sr * 2, 90, 5, dt);
  d.neck.rotation.x = -dive * 0.25 + c.heave.v * 0.01;
  d.neck.rotation.y = c.steer * 0.45;
  const open = c.scream > 0 || c.honkT > 0 || (!c.onGround && c.airTime > 0.3);
  d.update(dt, { open, dizzy: c.dizzy > 0, look: c.steer });
  for (const p of car.danglers) {
    p.rotation.z = p.rotation.z * 0.92 + lean * 0.5 + Math.sin(race.clock * 7) * 0.02;
    p.rotation.x = p.rotation.x * 0.92 + dive * 0.4;
  }

  c.bubble.sprite.position.set(c.x, c.y + 4.4, c.z);
  c.bubble.update(dt);
  if (race.mirror) c.bubble.sprite.scale.x *= -1;   // keep speech readable in the flipped world
}

function updateRace(dt, presentation = true) {
  if (race.state === 'count') {
    // Online, the room's start time drives every countdown at once.
    if (race.netRace) race.count = Math.min(3.999, 1 + (net.state.startAt - net.now()) / 1000);
    else race.count -= dt;
    const n = Math.ceil(race.count) - 1;
    $('count').textContent = n > 0 ? n : '¡YA!';
    // Rocket start: remember when the gas went down (and stayed down).
    if (playerInput().throttle > 0) race.throttleAt ??= race.count;
    else race.throttleAt = null;
    if (race.count <= 1) {
      race.state = 'go';
      if (race.netRace) race.clock = Math.max(0, (net.now() - net.state.startAt) / 1000);
      if (!race.netRace || net.now() - net.state.startAt < 1000) launchGrid();
    }
  } else if (race.state === 'go' || race.state === 'end') {
    race.clock += dt;
    if (race.count > 0) {
      race.count -= dt;
      if (race.count <= 0) $('count').textContent = '';
    }
    for (const c of race.cars) {
      stepProtection(c, race.cars, dt);
      if (c.remote) {
        if (c.rescueT > 0) { c.rescueT = Math.max(0, c.rescueT - dt); if (!c.rescueT) c.awayT = 1; }
        applyRemote(c, dt);
        continue;
      }
      if (c.rescueT > 0) { stepRescue(c, dt); continue; }
      if (c.done) {
        stepCar(c, { throttle: 0, steer: 0 }, dt);
        continue;
      }
      stepCar(c, c.isPlayer && !AUTO ? playerInput(1) : c.human === 2 && !AUTO ? playerInput(2) : aiInput(c), dt);
      if (c.outT > OUT_TIME || c.stuckT > STUCK_TIME) rescue(c);
      if (!c.isPlayer) {
        c.aiHonk -= dt;
        const p = race.player;
        if (c.aiHonk <= 0 && Math.hypot(p.x - c.x, p.z - c.z) < 14) {
          honk(c);
          c.aiHonk = rand(5, 10);
        }
      }
      if (race.mode !== 'battle' && c.lap > race.laps) {
        c.done = true;
        c.time = race.clock;
        if (race.netRace) net.finish(c.netId, c.time);
        if ((c.isPlayer || c.human) && race.cup) race.firstHumanFinish ??= race.clock;
        if (c.isPlayer || c.human) maybeFinish();
      }
    }
    if (race.cup && race.state === 'go' && (race.clock >= race.stageCap
      || (race.firstHumanFinish != null && race.clock - race.firstHumanFinish >= FINISH_GRACE_MS / 1000))) finish();
    collideCars();
    slipstreams(dt);
    for (const c of race.cars) c.popT = Math.max(0, (c.popT || 0) - dt);
    if (race.mode === 'battle' && !race.ended && battleOver(race.cars, race.clock)) endBattle();
  } else if (race.netRace) {
    // Rivals already on the grid still settle into place during the countdown.
    for (const c of race.cars) if (c.remote) applyRemote(c, dt);
  }
  race.items.update(dt, race.cars, race.state === 'go' || race.state === 'end');
  for (const c of race.cars) syncGhostAppearance(c);
  race.hazards?.update(race.clock, dt, race.state === 'go' || race.state === 'end' ? race.cars : [], hitHazard);
  race.puffs.update(dt);
  race.debris.update(dt);
  race.shockwaves.update(dt);
  // The deterministic browser harness can run the same gameplay tick without
  // spending simulation time on poses, the minimap and DOM painting.
  if(!presentation)return;
  for (const c of race.cars) syncCar(c, dt);
  race.sky.update(race.clock);
  tickWind(race.clock, T?.def.rain ? 1.45 : 1);
  for (const o of T.animated) o.userData.tick(race.clock, dt);   // scenery: flags, windmills, birds…
  sound.setEngine(race.player.vf);
  waterAmbience.update(T,race.player.x,race.player.z);

  // HUD
  const p = race.player;
  const order = standings();
  const place = order.indexOf(p);
  if (race.mode === 'battle') {
    $('lap-label').textContent = 'Globos';
    $('lap').textContent = `${p.balloons}/${BALLOONS}`;
  } else {
    $('lap-label').textContent = 'Vuelta';
    $('lap').textContent = `${Math.min(race.laps, Math.max(1, p.lap))}/${race.laps}`;
  }
  if (race.shownPlace !== place) {
    race.shownPlace = place;
    $('pos').innerHTML = `${place + 1}<sup>º</sup>`;
    $('pos').setAttribute('aria-label', `Posición ${place + 1} de ${order.length}`);
  }
  $('leader').textContent = order[0] === p ? '¡Tú!' : order[0].name;
  $('time').textContent = race.mode === 'battle' ? clockText(Math.max(0, BATTLE_TIME - race.clock)) : clockText(p.done ? p.time : race.clock);
  if (race.mode !== 'battle' && race.laps > 1 && p.lap === race.laps && !p.finalLap && !p.done) {
    p.finalLap = true;
    shout('¡Vuelta final!');
    music.setTempo(1.14);
  }
  music.muffle(p.spin > 0 && !race.p2); // a spin-out dulls the band until you recover
  showItem(p);
  readRoad(p, dt);
  if (race.p2) showP2(order);

  // speedometer + boost bar
  $('speed').textContent = Math.round(Math.abs(p.vf) * 4);
  setSpeedLines(p.boost > 0 ? Math.min(0.85, p.boost) : 0);
  const boost = $('boost');
  const ratio = Math.min(1, Math.abs(p.vf) / (p.tune.top * 1.5));
  const lit = Math.round(ratio * 8);
  boost.classList.toggle('turbo', p.boost > 0);
  const charge = p.drift ? String(driftLevel(p.driftT)) : '';
  if (boost.dataset.drift !== charge) boost.dataset.drift = charge;
  const driftHint = $('drift-hint');
  driftHint.hidden = !p.drift;
  const driftText = p.drift ? (Number(charge) ? 'Suelta: turbo' : 'Derrape asistido') : '';
  if (driftHint.textContent !== driftText) driftHint.textContent = driftText;
  const driftButton = document.querySelector('.touch-drift');
  const driftAction = p.drift && Number(charge) ? '¡Suelta!' : 'Derrape';
  if (driftButton.textContent !== driftAction) {
    driftButton.textContent = driftAction;
    driftButton.setAttribute('aria-label', driftAction === 'Derrape' ? 'Derrapar o saltar' : 'Suelta para recibir turbo');
  }
  const segs = boost.children;
  for (let i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i < lit);

  // standings board + minimap, throttled
  if (race.state === 'end' && race.cup && race.cup.session.status === 'intermission') {
    if (race.netRace) {
      race.intermission = net.state.intermissionEndsAt > 0
        ? Math.max(0, (net.state.intermissionEndsAt - net.now()) / 1000)
        : 0;
      $('cup-next').textContent = nextStageText(race.cup.definition, race.cup.session, race.intermission, id => getTrack(id).name);
      updateResultActions(net.state);
    } else if (race.intermission != null) {
      race.intermission = Math.max(0, race.intermission - dt);
      $('cup-next').textContent = nextStageText(race.cup.definition, race.cup.session, race.intermission, id => getTrack(id).name);
      if (race.intermission <= 0 && !(DEBUG && QS.has('manual'))) {
        race.intermission = null;
        advanceStage(race.cup.session);
        startRace(race.playerIndex, race.playerWheel);
        return;
      }
    }
  }
  race.boardT -= dt;
  if (race.boardT <= 0) {
    race.boardT = 0.2;
    renderBoard(order, p);
    if (race.state === 'end') renderResults(order, p);
    const u = paramOf(p.x, p.z, p.y) / T.TOTAL;
    const sector = T.def.sectors?.filter(([start]) => u >= start).at(-1);
    if (sector) $('mm-sub').textContent = sector[1];
  }
  drawMinimap();

  race.shake = Math.max(0, race.shake - dt * 2);
  followCam(race.camera, 'camPos', p, playerInput(1).look, dt);
  if (race.p2) followCam(race.camera2, 'camPos2', race.p2, playerInput(2).look, dt);
  const fx = Math.sin(p.h), fz = Math.cos(p.h);
  if (race.rain.lines.visible) race.rain.update(p.x + fx * 10, p.y, p.z + fz * 10, race.clock, dt);
  race.sun.position.set(p.x - 30, p.y + 40, p.z + 25);
  race.sun.target.position.set(p.x, p.y, p.z);
}

// Chase camera with a bit of shake; holding look-back (C) turns it around.
function followCam(cam, key, p, look, dt) {
  const fx = Math.sin(p.h), fz = Math.cos(p.h), back = look ? -1 : 1;
  const dist = p.boost > 0 ? 12.1 : 11;
  // Layered courses can descend below sea level. Follow the driving deck;
  // clamping this camera to world y=5 puts it above an underwater tunnel.
  const want = new THREE.Vector3(p.x - fx * dist * back, T.def.layered ? p.y + 5 : Math.max(5, p.y + 5), p.z - fz * dist * back);
  if (!race[key] || look !== race[key + 'Look']) race[key] = want.clone();
  race[key + 'Look'] = look;
  race[key].lerp(want, Math.min(1, dt * (p.boost > 0 ? 5.5 : 4)));
  const sh = p.isPlayer ? race.shake * 0.6 : 0;
  // Mirror mode flips the whole scene on x; the camera follows in flipped space.
  const mx = race.mirror ? -1 : 1, at = race[key];
  const lead = p.boost > 0 ? 5.2 : 4;
  cam.position.set(mx * at.x + rand(-sh, sh), at.y + rand(-sh, sh), at.z + rand(-sh, sh));
  cam.lookAt(mx * (p.x + fx * lead * back), p.y + 1.4, p.z + fz * lead * back);
  const fov = p.boost > 0 ? 74 : 60;   // turbo stretches the view
  if (Math.abs(cam.fov - fov) > 0.05) {
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 5);
    cam.updateProjectionMatrix();
  }
}

// Wrong way, incoming items and lap splits for the player.
function readRoad(p, dt) {
  const s = paramOf(p.x, p.z, p.y), a = pointAt(s), b = pointAt(s + 1);
  p.wrongT = wrongWayStep(p.wrongT || 0, p.h, Math.atan2(b.x - a.x, b.y - a.y), p.vf, dt);
  const wrong = race.mode !== 'battle' && race.state === 'go' && !p.done && p.rescueT <= 0 && p.wrongT > WRONG_WAY_TIME;
  if ($('wrong-way').hidden === wrong) $('wrong-way').hidden = !wrong;
  // The nearest projectile coming for the player: which way and what it is.
  let threat = null, best = 60;
  for (const f of race.items.projectiles) {
    if (f.owner === p || f.dead) continue;
    const dx = f.m.position.x - p.x, dz = f.m.position.z - p.z, d = Math.hypot(dx, dz);
    const distantChancleta = !threat && f.kind === 'chancleta' && f.target === p;
    if ((f.target === p || f.kind === 'mango') && (d < best || distantChancleta)) {
      best = Math.min(best, d); threat = { f, dx, dz };
    }
  }
  $('incoming').hidden = !threat && !(p.rainIn > 0);
  $('incoming-arrow').hidden = !threat;
  if (threat) {
    const names = { cohete: '¡Cohete!', chancleta: '¡La chancleta viene por ti!', mango: '¡Mango!' };
    $('incoming-text').textContent = names[threat.f.kind] || '¡Cuidado!';
    const rel = Math.atan2(threat.dx, threat.dz) - p.h;
    $('incoming-arrow').style.transform = `rotate(${(race.mirror ? 1 : -1) * rel}rad)`;
  } else if (p.rainIn > 0) $('incoming-text').textContent = `Aguacero en ${Math.ceil(p.rainIn)} s`;
  // Lap splits: a new lap shows its time; the best one gets a shout.
  if (race.mode !== 'battle' && p.lap > race.lapSeen && p.lap <= race.laps + 1) {
    race.lapSeen = p.lap;
    const { lap, best } = lapSplit(race.splits, race.clock);
    if (best && race.splits.length > 1) shout(`¡Vuelta rápida! ${clockText(lap)}`);
    race.bestLap = Math.min(race.bestLap ?? Infinity, lap);
    $('lap-best').textContent = clockText(race.bestLap);
    $('best-pill').hidden = false;
  }
}

function showP2(order) {
  const p2 = race.p2, place = order.indexOf(p2) + 1, item = activeItem(p2);
  $('p2-pos').innerHTML = `${place}<sup>º</sup>`;
  $('p2-lap').textContent = race.mode === 'battle' ? `Globos ${p2.balloons}/${BALLOONS}` : `Vuelta ${Math.min(race.laps, Math.max(1, p2.lap))}/${race.laps}`;
  $('p2-item').textContent = item ? (item.rolling > 0 ? 'Abriendo…' : ITEMS[item.kind].name) : 'Sin objeto';
}

// Each slot rolls independently: picking a reserve never locks the active item.
const ICONS = Object.values(ITEMS).map((i) => i.icon);
let lastItem = '';
function showItem(p) {
  const key = JSON.stringify([p.inventory.map(i => i && [i.kind, i.n, Math.ceil(i.rolling * 12)]),
    p.selected, p.itemMessageT > 0 ? p.itemMessage : '', p.coins, p.coinsCollected, p.coinFlash > 0, p.done, p.spin > 0]);
  if (key === lastItem) return;
  lastItem = key;
  p.inventory.forEach((item, i) => {
    const selected = i === p.selected;
    const label = item ? item.rolling > 0 ? 'Abriendo…' : ITEMS[item.kind].name : 'Vacío';
    $('item-icon-' + i).innerHTML = item ? item.rolling > 0 ? ICONS[Math.floor(item.rolling * 12) % ICONS.length] : ITEMS[item.kind].icon : '+';
    $('item-n-' + i).textContent = item?.n > 1 ? `×${item.n}` : '';
    $('item-label-' + i).textContent = label;
    const slot = $('item-slot-' + i);
    slot.classList.toggle('selected', selected);
    slot.classList.toggle('rolling', !!(item && item.rolling > 0));
    slot.dataset.rarity = item && item.rolling <= 0 ? (isJuiced(p) ? 'gold' : ITEMS[item.kind]?.rarity || 'blue') : '';
    slot.setAttribute('aria-pressed', String(selected));
    slot.setAttribute('aria-label', `Objeto ${i + 1}: ${label}${selected ? ', equipado' : ', seleccionar'}`);
    slot.disabled = !item || p.done;
  });
  const item = activeItem(p), ready = item && item.rolling <= 0 && !p.done && p.spin <= 0;
  const status = p.itemMessageT > 0 ? p.itemMessage : canBlock(p) ? 'Mango equipado · bloquea un mangazo' :
    item ? 'Elige hacia dónde usarlo' : 'Rompe cajas de madera · guarda 2 objetos';
  if ($('item-status').textContent !== status) $('item-status').textContent = status;
  $('item').classList.toggle('protected', canBlock(p));
  $('throw-front').disabled = $('throw-back').disabled = !ready;
  const aimed = !item || AIMED.has(item.kind);
  $('throw-front').querySelector('span').textContent = item?.kind?.startsWith('jugo') ? 'Beber' : aimed ? 'Adelante' : 'Usar';
  $('throw-back').disabled = !ready || !aimed;
  $('swap-item').disabled = !p.inventory[1 - p.selected] || p.done;
  $('coin-count').textContent = String(p.coins).padStart(2, '0');
  $('coin-bonus').textContent = `+${Number((p.coins * COIN_SPEED * 100).toFixed(1)).toLocaleString('es-VE')}% velocidad`;
  $('coins').classList.toggle('picked', p.coinFlash > 0);
  $('coins').classList.toggle('full', p.coins === MAX_COINS);
}

// Finished cars by time, then everyone else by how far along they are.
// The results come up once every human driver is done.
function maybeFinish() {
  if (race.state === 'end') return;
  if (race.cars.every(c => !(c.isPlayer || c.human) || c.done)) finish();
}

function standings() {
  return race.mode === 'battle' ? battleOrder(race.cars) : raceOrder(race.cars, T.TOTAL);
}

// Time's up or one car left: everyone still holding balloons is done.
function endBattle() {
  race.ended = true;
  for (const c of race.cars) if (!c.done) { c.done = true; c.time = race.clock; }
  if (race.state !== 'end') finish();
}

function scoreCup() {
  if (race.netRace) {
    if (net?.cup) {
      race.cup = { definition: cupById(net.cup.cupId), session: net.cup, mirror: false };
      const session = race.cup.session;
      if (session.status === 'complete') {
        const myId = race.player?.entrantId || race.player?.netId || net.id;
        const trophy = cupTrophy(session, myId);
        if (trophy && recordCupTrophy(profile, session.cupId, trophy)) profileStore.save(profile);
      }
    }
    return;
  }
  const session = race.cup.session;
  if (session.status !== 'racing') return;
  const results = session.entrants.map(entrant => {
    const c = race.cars.find(car => car.entrantId === entrant.id);
    return {
      id: entrant.id,
      classification: c.done ? 'finished' : 'dnf',
      started: true,
      time: c.time,
      progress: c.lap * T.TOTAL + c.prog,
    };
  });
  if (!finalizeStage(session, { results })) return;
  if (session.status === 'complete') {
    const trophy = cupTrophy(session, LOCAL_PLAYER);
    if (trophy && recordCupTrophy(profile, session.cupId, trophy)) profileStore.save(profile);
  }
}

function renderCup() {
  const session = race.cup?.session;
  const active = !!session?.finalized.some(Boolean);
  $('cup-table').hidden = !active;
  if (!active) {
    $('cup-next').textContent = '';
    return;
  }
  const finalizedStages = session.finalized.map((f, idx) => f ? idx : -1).filter(idx => idx >= 0);
  const viewStage = session.finalized[session.stageIndex] ? session.stageIndex : (finalizedStages.at(-1) ?? session.stageIndex);
  const view = cupStandingsView(session, viewStage);
  $('cup-title').textContent = `${race.cup.definition.name} · ${session.status === 'complete' ? 'Final' : `Carrera ${viewStage + 1} de 4`}`;
  const colors = new Map(race.cars.map(c => [c.entrantId || c.netId, c.def.color]));
  const myId = race.player?.entrantId || race.player?.netId || net?.id || LOCAL_PLAYER;
  fillRoster($('cup-board'), view.map((r, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.setProperty('--c', colors.get(r.id) || CARS[r.entrant.loadout.car]?.color || '#fff');
    const details = [
      `+${r.racePoints} pts`,
      r.classification ? CLASSIFICATION_TEXT[r.classification] : null,
      r.stage > 0 || viewStage > 0 ? rankChangeText(r.rankChange) : null,
      r.decidedBy && i <= 2 ? tiebreakText(r.decidedBy) : null,
    ].filter(Boolean).join(' · ');
    return {
      rank: i + 1,
      lead: chip,
      name: r.name,
      detail: details,
      me: r.id === myId,
      end: `${r.points} pts`,
      score: true,
      className: r.rankChange > 0 ? 'rank-up' : r.rankChange < 0 ? 'rank-down' : '',
    };
  }));
  $('cup-next').textContent = nextStageText(race.cup.definition, session, race.intermission, id => getTrack(id).name);
}

function finish() {
  race.state = 'end';
  if (race.netRace && net?.cup) {
    race.cup = { definition: cupById(net.cup.cupId), session: net.cup, mirror: false };
  }
  const p = race.player ?? { done: false, time: 0, lost: 0, coinsCollected: 0, def: CARS[garage.index] ?? CARS[0], netId: net?.id, entrantId: net?.id };
  // A racer the room timed out has no time of its own: everyone finished ahead.
  const ahead = (c) => c.done && (!p.done || c.time < p.time);
  const place = 1 + race.cars.filter((c) => c !== p && ahead(c)).length;
  const winner = race.cars.filter(ahead).sort((a, b) => a.time - b.time)[0];
  $('result-title').textContent = p.dns ? 'No saliste a tiempo (DNS)' : !p.done ? 'Se acabó el tiempo' : place === 1 ? '¡Ganaste!' : `${place}º lugar`;
  $('result-time').textContent = `${T?.name || ''} · ${race.laps} ${race.laps === 1 ? 'vuelta' : 'vueltas'} · ${p.done && !p.dns ? clockText(p.time) : 'sin terminar'} · ${p.def.name} · ${p.lost || 0} piezas perdidas`
    + (winner && place > 1 ? ` · ganó ${winner.name}` : '');
  if (race.bestLap != null) $('result-time').textContent += ` · mejor vuelta ${clockText(race.bestLap)}`;
  if (race.p2) $('result-time').textContent += ` · Jugador 2: ${standings().indexOf(race.p2) + 1}º`;
  if (race.mode === 'battle') {
    const order = standings(), rank = order.indexOf(p) + 1;
    $('result-title').textContent = p.balloons > 0 && rank === 1 ? '¡Ganaste la batalla!' : p.balloons > 0 ? `${rank}º lugar` : '¡Sin globos!';
    $('result-time').textContent = `${T.name} · batalla de globos · ${p.balloons} ${p.balloons === 1 ? 'globo' : 'globos'} · ${p.def.name}`
      + (p.balloons === 0 ? ` · aguantaste ${clockText(p.outAt ?? race.clock)}` : '');
  }
  const won = race.mode === 'battle' ? p.balloons > 0 && standings()[0] === p : p.done && !p.dns && place === 1;
  music.play(RESULTS_SONG, { fallback: 'calipso' });
  music.sting(finishSting(won));
  if (race.cup) {
    scoreCup();
    const session = race.cup.session;
    if (session.status === 'intermission') {
      if (race.netRace) {
        race.intermission = net.state.intermissionEndsAt > 0
          ? Math.max(0, (net.state.intermissionEndsAt - net.now()) / 1000)
          : 12;
      } else race.intermission ??= 12;
    } else if (session.status === 'complete') {
      race.intermission = null;
      const cupRows = championshipStandings(session);
      const myId = p.entrantId || p.netId || net?.id || LOCAL_PLAYER;
      const cupPlace = cupRows.findIndex(row => row.id === myId);
      const trophy = cupTrophy(session, myId);
      $('result-title').textContent = cupPlace === 0 ? `¡Ganaste la ${race.cup.definition.name}!` : `${cupPlace + 1}º en la ${race.cup.definition.name}`;
      if (trophy) $('result-time').textContent += ` · trofeo de ${trophy}`;
      const tiedPodium = cupRows.slice(0, 3).find(row => row.decidedBy);
      if (tiedPodium) $('result-time').textContent += ` · ${tiebreakText(tiedPodium.decidedBy)}`;
    }
    if (race.p2) {
      const p2CupPlace = championshipStandings(session).findIndex(row => row.id === LOCAL_GUEST);
      if (p2CupPlace >= 0) $('result-time').textContent += ` · Copa Jugador 2: ${p2CupPlace + 1}º`;
    }
  }
  renderCup();
  // The taller wallet keeps what you earned. For online cups, wait until the
  // server has finalized the current stage in cupJson before claiming receipts.
  const canPay = !race.paid && (!race.netRace || !race.cup || !!race.cup.session.finalized?.[race.cup.session.stageIndex]);
  if (canPay) {
    race.paid = true;
    const rank = standings().indexOf(p);
    let earned = race.earned || 0;
    if (race.cup) {
      const session = race.cup.session;
      const myId = p.entrantId || p.netId || net?.id || LOCAL_PLAYER;
      const stageRec = session.ledger.find(r => r.stage === session.stageIndex && r.id === myId);
      const stagePlace = stageRec && stageRec.classification === 'finished' ? stageRec.place - 1 : 99;
      earned += rewardCupStage(profile, {
        sessionId: session.sessionId,
        stage: session.stageIndex,
        collected: p.coinsCollected || 0,
        place: stagePlace,
      });
      if (session.status === 'complete') {
        earned += rewardCupCompletion(profile, {
          sessionId: session.sessionId,
          trophy: cupTrophy(session, myId),
        });
      }
      saveWallet();
    } else {
      earned = earnings({ collected: p.coinsCollected || 0, place: p.done || race.mode === 'battle' ? rank : 99 });
      wallet.coins += earned;
      saveWallet();
    }
    race.earned = earned;
  }
  if (race.netRace) updateResultActions(net.state);
  else {
    $('again').textContent = race.cup ? (race.cup.session.status === 'complete' ? 'Otra copa' : 'Siguiente pista') : 'Otra vez';
    $('again').disabled = false; $('back').textContent = 'Garaje';
  }
  race.resultKey = '';
  renderResults(standings(), p);
  $('result').classList.remove('hidden');
  $('result-coins').textContent = `${p.coinsCollected || 0} monedas recogidas · +${race.earned || 0} al taller · tienes ${wallet.coins}`;
  $('again').focus({ preventScroll: true });
}

// Podium (top three, with their car pictures) and the full classification.
// Rivals keep racing behind the results, so this refreshes as they finish.
const PODIUM = [['var(--pk-yellow)', 260, 124], ['var(--pk-teal)', 190, 96], ['var(--pk-coral)', 140, 86]];
function renderResults(order, player) {
  const session = race.cup?.session;
  const cupFinal = session?.status === 'complete';
  const stageMap = session ? new Map(session.ledger.filter(r => r.stage === session.stageIndex).map(r => [r.id, r])) : null;
  const displayOrder = stageMap && stageMap.size
    ? session.entrants.map(e => {
        const car = race.cars.find(c => (c.entrantId || c.netId) === e.id);
        const rec = stageMap.get(e.id);
        return car || {
          entrantId: e.id,
          netId: e.id,
          name: e.name,
          def: CARS[e.loadout.car] ?? CARS[0],
          done: rec?.classification === 'finished',
          time: rec?.time ?? 0,
          lap: race.laps,
        };
      }).sort((a, b) => (stageMap.get(a.entrantId || a.netId)?.place ?? 99) - (stageMap.get(b.entrantId || b.netId)?.place ?? 99))
    : order;
  const key = `${cupFinal}:${stageMap?.size || 0}:${displayOrder.map(c => `${c.entrantId || c.netId || c.name}:${c.done}:${c.balloons}`).join()}`;
  if (key === race.resultKey) return;
  race.resultKey = key;
  const who = (c) => {
    if(!c.portrait){
      const entrant=session?.entrants.find(e=>e.id===(c.entrantId||c.netId));
      let avatar=entrant?.avatar ?? c.avatar;
      if(typeof avatar==='string'){try{avatar=JSON.parse(avatar);}catch{avatar=null;}}
      const model=c.car ?? c.def.build(avatar || ME.avatar,wheelById(entrant?.loadout.wheel||'calle').wheel,renderConfig(entrant?.loadout.parts));
      if(!c.car)repaintCar(model,c.def.color,PAINTS.find(p=>p.id===entrant?.loadout.paint)?.color??null);
      c.portrait=racerPortrait(renderer,model);
      if(!c.car){
        const geometries=new Set(),materials=new Set();
        model.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))if(m.userData.ownedMap)materials.add(m);});
        model.driver.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map.dispose();m.dispose();});
      }
    }
    return `<img src="${c.portrait}" alt="">`;
  };
  const podiumOrder = cupFinal
    ? championshipStandings(session).map(row => race.cars.find(c => (c.entrantId || c.netId) === row.id) || {
        entrantId: row.id,
        name: row.name,
        def: CARS[row.entrant.loadout.car] ?? CARS[0],
      })
    : displayOrder;
  // Second, first, third, like a real podium.
  $('podium').innerHTML = [1, 0, 2].filter(i => podiumOrder[i]).map(i => {
    const c = podiumOrder[i], [color, h, w] = PODIUM[i];
    return `<li style="--c:${color};--h:${h}px;--w:${w}px"><span class="who">${who(c)}</span>`
      + `<span class="name">${esc(c.name)}</span><b class="place">${i + 1}</b></li>`;
  }).join('');
  const myId = player?.entrantId || player?.netId || net?.id || LOCAL_PLAYER;
  fillRoster($('result-board'), displayOrder.map((c, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.setProperty('--c', c.def.color);
    const id = c.entrantId || c.netId;
    const rec = stageMap?.get(id);
    const endText = race.mode === 'battle'
      ? `${c.balloons} ${c.balloons === 1 ? 'globo' : 'globos'}`
      : rec
        ? `${rec.classification === 'finished' ? clockText(rec.time ?? c.time) : CLASSIFICATION_TEXT[rec.classification] ?? 'Sin terminar'} · +${rec.points} pts`
        : c.done ? clockText(c.time) : `vuelta ${Math.min(race.laps, Math.max(1, c.lap))}/${race.laps}`;
    return { rank: i + 1, lead: chip, name: c.name, me: c === player || (id && id === myId), end: endText };
  }));
}


// ======================================================================
// Online (online.js + server/room.js). Remote cars are kinematic: they
// follow their owner's poses about 110 ms behind, never local physics.
// ======================================================================
// Poses carry the sender's estimate of server time, so bursts from a slow
// frame still interpolate evenly. The delay follows each sender's own rate.
function sendPoses() {
  if (!race.netRace || !['go', 'end'].includes(race.state)) return;
  const now = performance.now();
  if (now - race.poseAt < 1000 / POSE_HZ) return;
  race.poseAt = now;
  const stamp = Math.round(net.now());
  net.poses(race.cars.filter(c => !c.remote && !c.dns && !c.retired).map(c => [c.netId, stamp, ...packPose(c)]));
}

function resumePose(c, p) {
  if (!p) return;
  [c.x, c.y, c.z, c.h, c.pitch, c.roll, c.vf, c.steer] = p;
  c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
  c.lap = p[11]; c.prog = p[12]; c.coins = p[14];
  c.phaseT = RESCUE_GHOST_TIME;
}

function applyRemote(c, dt) {
  const buf = c.buf;
  if (!buf.length) { c.vx = c.vz = 0; return; }   // still on its grid slot
  const at = net.now() - c.delay;
  while (buf.length > 2 && buf[1].t <= at) buf.shift();
  const a = buf[0], b = buf[1] || a;
  const k = b === a ? 0 : Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t)));
  // Past the newest pose (a late packet), coast briefly along its heading.
  const ahead = buf.length < 2 || at > b.t ? Math.min(0.25, (at - b.t) / 1000) : 0;
  const P = a.p, Q = b.p;
  const lerp = (i) => P[i] + (Q[i] - P[i]) * k, turn = (i) => P[i] + wrapAngle(Q[i] - P[i]) * k;
  const h0 = c.h, vf0 = c.vf;
  c.x = lerp(0); c.y = lerp(1); c.z = lerp(2); c.h = turn(3); c.pitch = turn(4); c.roll = turn(5);
  c.vf = lerp(6); c.steer = lerp(7); c.spin = lerp(8); c.boost = Q[9];
  const f = Q[10];
  c.onGround = !!(f & FLAG.ground);
  c.dizzy = f & FLAG.dizzy ? 1 : 0;
  c.scream = f & FLAG.open ? 0.2 : 0;
  c.full = !!(f & FLAG.full);
  c.drift = f & FLAG.drift ? (f & FLAG.driftRight ? -1 : 1) : 0;
  c.driftLvl = (f >> DRIFT_SHIFT) & 3;
  c.shield = f & FLAG.shield ? 1 : 0;
  c.phaseRemote = !!(f & FLAG.phase);
  c.phaseT = 0;
  if (f & FLAG.done) c.done = true;
  c.lap = Q[11]; c.prog = Q[12]; c.coins = Q[14];
  // Parts that fell off on the owner's screen fall off here too.
  for (let n = Q[13] - c.lost; n > 0; n--) popPart(c, 10);
  c.lost = Math.max(c.lost, Q[13]);
  c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
  if (ahead > 0 && c.onGround) { c.x += c.vx * ahead; c.z += c.vz * ahead; }
  c.latAcc = wrapAngle(c.h - h0) / dt * c.vf;
  c.longAcc = (c.vf - vf0) / dt;
}

const racerById = (id) => race.cars.find(c => c.netId === id);

function onNetPose(id, stamp, pose) {
  const c = race.netRace && racerById(id);
  if (c?.resuming && !c.remote) { resumePose(c, pose); c.resuming = false; }
  if (!c?.remote) return;
  const last = c.buf.at(-1);
  if (last && stamp <= last.t) return;   // stale or duplicate
  if (last) c.gap = c.gap * 0.8 + Math.min(1000, stamp - last.t) * 0.2;
  c.delay = Math.max(100, Math.min(450, c.gap * 1.6 + 40));
  c.buf.push({ t: stamp, p: pose });
  if (c.buf.length > 24) c.buf.shift();
}

function onNetFx(id, kind, d) {
  const c = race.netRace && racerById(id);
  if (!c || !race.items || !d) return;
  if (kind === 'throw') race.items.remoteThrow(c, d);
  else if (kind === 'peel') race.items.remotePeel(c, d);
  else if (kind === 'hit') race.items.remoteHit(c, d);
  else if (kind === 'slip') race.items.remoteSlip(d);
  else if (kind === 'cloud') race.items.remoteCloud(d);
  else if (kind === 'rescue' && c.remote) { c.rescueT = RESCUE_TIME; c.bubble.say(pick(LINES.rescue), 1.3); }
  else if (kind === 'honk' && c.honkT <= 0) {
    c.honkT = sound.horn(c.def.horn);
    c.bubble.say(LINES.honk[c.def.horn], c.honkT + 0.2);
    c.heave.v += 5;
  } else if (kind === 'say') c.bubble.say(String(d.text ?? '').slice(0, 40), Math.min(3, Number(d.time) || 1.2));
}

// Room state into the race: finishes, departures, ghosting and bot control.
function syncRacers(s) {
  if (net?.cup) {
    race.cup = { definition: cupById(net.cup.cupId), session: net.cup, mirror: false };
  }
  if (!race.netRace || s.raceId !== race.netRace) return;
  for (const r of s.racers) {
    const c = racerById(r.id);
    if (!c) continue;
    c.dns = !!r.dns;
    c.retired = !!r.retired;
    if ((r.retired || r.dns) && !c.isPlayer) {
      disposeRacer(c);
      race.cars.splice(race.cars.indexOf(c), 1);
      continue;
    }
    if ((r.retired || r.dns) && c.isPlayer) {
      c.done = true;
      setGhost(c, true);
      c.car.root.visible = false;
    } else if (r.kind === 'human' && !c.isPlayer) {
      const pl = s.players.find(p => p.id === r.id);
      setGhost(c, !pl?.connected);
    }
    if (r.done) { c.done = true; c.time = r.time; }
    const owned = r.owner === net.id;
    if (owned && c.remote) {
      // The host left: this client now drives the bots from where they were.
      c.remote = false; c.buf = [];
      c.phaseT = c.phaseRemote ? RESCUE_GHOST_TIME : (c.phaseT || 0);
      c.phaseRemote = false;
      c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
      c.lane = gridSlot(r.slot).lane;
      if (r.skillSeed) c.skill = cupSkill({ skillSeed: r.skillSeed }, race.diff);
    } else if (!owned && !c.remote && !c.isPlayer) c.remote = true;
  }
}

function onNetState(s) {
  if (!s.racers) return;   // the room's first state has not arrived yet
  if (net.cup) {
    race.cup = { definition: cupById(net.cup.cupId), session: net.cup, mirror: false };
  } else if (s.mode === 'race') {
    race.cup = null;
  }
  const me = s.players.find(p => p.id === net.id);
  const myRacer = s.racers.find(r => r.id === net.id);
  const inRace = !!myRacer && !myRacer.retired;
  if (s.phase === 'loading' && inRace && s.raceId !== race.netRace && s.raceId !== race.loadingRaceId) {
    selectTrack(s.track, s.laps);
    startRace(garage.index, garage.wheel, s.racers);
  } else if (['count', 'race', 'results', 'complete'].includes(s.phase) && inRace && !race.netRace && mode === 'garage' && me?.racing) {
    // Back from a reload: rejoin the race already under way.
    selectTrack(s.track, s.laps);
    startRace(garage.index, garage.wheel, s.racers);
  } else if (s.phase === 'lobby' && (race.netRace || mode === 'loading') && mode !== 'garage') {
    toGarage();
  }
  syncRacers(s);
  if (['results', 'complete'].includes(s.phase) && race.netRace === s.raceId && mode === 'race') {
    finish();
  }
  if (mode === 'race' && race.state === 'end') updateResultActions(s);
  if (mode === 'garage') {
    if (s.track && TRACKS[trackIndex]?.id !== s.track) selectTrack(s.track, s.laps);
    renderLobby(s);
  }
}

function renderLobby(s) {
  const host = net.isHost, live = !['lobby', 'results', 'complete'].includes(s.phase);
  const racing = s.players.find(p => p.id === net.id)?.racing;
  const myRacer = s.racers?.find(r => r.id === net.id);
  const cup = isCupMode(s.mode) ? cupById(s.mode) : null;
  $('lobby-code').textContent = net.code;
  $('lobby-roster').innerHTML = s.players.map((p, i) =>
    `<li class="pk-row${p.id === net.id ? ' is-me' : ''}${p.connected ? '' : ' away'}"><span class="pk-row-n">${p.id === s.host ? SVG.crown : i + 1}</span>`
    + `<span class="chip" style="--c:${CARS[p.car]?.color || '#fff'}"></span>${esc(p.name)}`
    + `<span class="pk-row-end">${p.connected ? esc(CARS[p.car]?.name || '') : 'reconectando…'}</span></li>`).join('');
  const gridTarget = cup ? GP_GRID : 4;
  const bots = Math.max(0, (s.bots ? Math.max(gridTarget, s.players.length) : s.players.length) - s.players.length);
  $('launch-note').innerHTML = `<span class="pk-dot"></span>${s.players.length} ${s.players.length === 1 ? 'pana' : 'panas'}${bots ? ` + ${bots} ${bots === 1 ? 'rival' : 'rivales'}` : ''}`;
  $('lobby-bots').checked = s.bots;
  $('lobby-bots').disabled = !host || live;
  $('t-prev').disabled = $('t-next').disabled = !host || live || !!cup;
  renderSetup();
  const hostName = s.players.find(p => p.id === s.host)?.name || 'el anfitrión';
  if (s.notice) {
    $('lobby-status').textContent = s.notice;
  } else if (live) {
    if (myRacer?.dns) $('lobby-status').textContent = 'No cargaste a tiempo esta etapa (DNS). Entras en la siguiente pista.';
    else if (racing) $('lobby-status').textContent = 'Tu carrera sigue en curso.';
    else if (cup) $('lobby-status').textContent = 'Campeonato en curso: espectador hasta la próxima copa.';
    else $('lobby-status').textContent = 'Carrera en curso: entras en la próxima.';
  } else {
    $('lobby-status').textContent = host
      ? (cup ? `Tú eliges la copa (${cup.name}) y das la salida.` : 'Tú eliges la pista y das la salida.')
      : (cup ? `${hostName} preparó la ${cup.name}.` : `${hostName} elige la pista y da la salida.`);
  }
  const canRejoinStage = live && myRacer && !myRacer.retired && !myRacer.dns && mode === 'garage';
  $('play').textContent = canRejoinStage ? 'Entrar a la pista' : host ? (live ? 'Carrera en curso' : '¡ARRANCAR!') : live ? 'Carrera en curso' : `Esperando a ${hostName}`;
  $('play').disabled = (!canRejoinStage && (live || !host)) || mode !== 'garage';
  menuFlow?.refresh();
}

function updateResultActions(s) {
  const host = net.isHost;
  const inCupIntermission = net.cup?.status === 'intermission' && s.phase === 'results';
  const inCupComplete = net.cup?.status === 'complete' || s.phase === 'complete';
  if (inCupIntermission) {
    const remainingMs = s.intermissionEndsAt > 0 ? s.intermissionEndsAt - net.now() : 0;
    const waitReadWindow = remainingMs > (GP_INTERMISSION_MS - GP_MIN_READ_MS);
    $('again').textContent = host ? 'Siguiente pista' : 'Siguiente pista pronto…';
    $('again').disabled = !host || waitReadWindow;
  } else if (inCupComplete) {
    $('again').textContent = host ? 'Otra copa' : 'Esperando al anfitrión';
    $('again').disabled = !host || !['results', 'complete'].includes(s.phase);
  } else {
    $('again').textContent = host ? 'Otra carrera' : 'Esperando al anfitrión';
    $('again').disabled = !host || s.phase !== 'results';
  }
  $('back').textContent = host && ['results', 'complete'].includes(s.phase) ? 'Sala' : 'Garaje';
}

function inviteLink() {
  return inviteUrl(net?.code || ROOM || newRoomCode());
}

let joining = null;
async function goOnline(code, lead) {
  if (net || joining) return joining;
  $('lobby').hidden = false;
  $('go-online').hidden = true;
  $('setup').hidden = false;
  $('lobby-code').textContent = code;
  $('lobby-status').textContent = 'Conectando con la sala…';
  $('play').disabled = true;
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  url.searchParams.delete('lead');
  history.replaceState(null, '', url);
  joining = (async () => {
    try {
      const { joinRace } = await (onlineModulePromise || import('./online.js'));
      net = await joinRace({ code, lead, name: ME.name, avatar: ME.avatar, car: garage.index, wheel: garage.wheel, cosmetics: raceStyle(garage.index) });
    } catch (error) {
      console.warn('Derrape online unavailable', error);
      $('lobby-status').textContent = error?.full ? 'La sala está llena.' : 'No pudimos entrar a la sala. Puedes correr en local.';
      $('play').disabled = false;
      $('play').textContent = '¡JUGAR!';
      $('lobby-solo').hidden = false;
      return null;
    } finally { joining = null; menuFlow?.refresh(); }
    net.on('state', onNetState);
    net.on('pose', onNetPose);
    net.on('fx', onNetFx);
    net.on('status', (text, bad) => {
      $('net-status').textContent = text;
      $('net-status').hidden = !text;
      $('net-status').classList.toggle('bad', !!bad);
    });
    net.on('left', () => {
      $('lobby-status').textContent = 'Saliste de la sala. Recarga para volver a entrar.';
      $('lobby-solo').hidden = false;
    });
    $('lobby-solo').hidden = false;
    onNetState(net.state);
    return net;
  })();
  return joining;
}

// ======================================================================
let mode = 'garage';
const clock = new THREE.Clock();
const STEP = 1 / 60;
let acc = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.25);
  if (mode === 'garage' && (!menuFlow || menuFlow.step === 'car')) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    updateGarage(dt);
    // A soft bloom on lamps and the ring, unless the quality is set low.
    if (getSettings().quality !== 'baja') (garage.bloom ??= garageBloom(renderer, garage.scene, garage.camera)).render();
    else renderer.render(garage.scene, garage.camera);
  } else if (mode === 'race') {
    renderer.toneMapping = THREE.NoToneMapping;
    pollPads();
    // fixed physics steps: same race speed at any frame rate
    if (!paused) acc += dt * SPEED;
    while (acc >= STEP && mode === 'race') {
      updateRace(STEP);
      acc -= STEP;
    }
    sendPoses();
    if (race.p2) {
      const w = innerWidth, h = innerHeight;
      renderer.setScissorTest(true);
      renderer.setViewport(0, 0, w / 2, h); renderer.setScissor(0, 0, w / 2, h);
      renderer.render(race.scene, race.camera);
      renderer.setViewport(w / 2, 0, w / 2, h); renderer.setScissor(w / 2, 0, w / 2, h);
      renderer.render(race.scene, race.camera2);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
    } else renderer.render(race.scene, race.camera);
  }
  if (!(DEBUG && QS.has('manual'))) requestAnimationFrame(frame);
}

function resize() {
  for (const cam of [garage.camera, race.camera, race.camera2]) {
    cam.aspect = innerWidth / innerHeight / (race.p2 && cam !== garage.camera ? 2 : 1);
    cam.updateProjectionMatrix();
  }
  renderer.setSize(innerWidth, innerHeight);
  garage.bloom?.size();
  // Make room for the information panel and the lineup, with a centered car
  // above the compact garage controls on a phone.
  const wide = innerWidth > 760 || (innerWidth >= 560 && innerWidth > innerHeight);
  garage.camera.zoom = wide ? (innerHeight < 500 ? .8 : 1) : Math.min(0.86, innerWidth / innerHeight * 1.3);
  // Center the car between the left details and the right-hand edge, above its lineup.
  const shop = wide && document.body.classList.contains('shop-open') ? 260 : 0;
  garage.camera.setViewOffset(innerWidth, innerHeight, wide ? -135 + shop : 0,
    wide ? 40 : -innerHeight * 0.03, innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

if (DEBUG) Object.assign(window, { disposeRacer, makeRacer, placeRacer, aiInput, stepRescue, collidePair, sendPoses, pollPads, music, getWallet: () => wallet, taller, menu, race, garage, renderer, crash, stepCar, startRace, updateRace, finish, renderResults, renderCup, toGarage, showWheel, ITEMS, TRACKS, buildTrack, setup, popBalloon, rescue, getActiveTrack: () => T, getNet: () => net });

// ?track=desierto wins; otherwise the last pick, otherwise the estadio
let savedTrack = 'estadio';
try { savedTrack = localStorage.getItem('derrape:track') || savedTrack; } catch { /* private mode */ }
// The cauchos from the last visit (fallback calle) dress the turntable car.
garage.wheel = wheelById(wallet.wheel).id;   // the profile migrated any old 'derrape:wheels' pick
if (ROOM) goOnline(ROOM, QS.has('lead'));
selectTrack(QS.get('track') || savedTrack);
showCar(0);
frame();
let lastGarageInput = performance.now();
for (const event of ['pointerdown', 'wheel', 'keydown']) {
  addEventListener(event, () => { lastGarageInput = performance.now(); }, { passive: true });
}
renderer.domElement.addEventListener('pointermove', event => {
  if (event.buttons) lastGarageInput = performance.now();
});
const cards = garageCards(CARS, garageCar, showCar,
  () => mode === 'garage' && performance.now() - lastGarageInput > 350);
$('car-lineup').append(cards.fragment);
cards.ready.catch(error => console.warn('Garage previews unavailable', error));
const wheelStrip = wheelCards(WHEEL_DEFINITIONS, pickWheel,
  () => mode === 'garage' && performance.now() - lastGarageInput > 350);
$('wheel-lineup').append(wheelStrip.fragment);
wheelStrip.ready.catch(error => console.warn('Wheel previews unavailable', error));
showWheel(garage.wheel);
renderSetup();
saveWallet();
menuFlow = createMenuFlow({
  tracks: TRACKS, initial: ROOM ? 'track' : 'welcome', pickTrack: switchTrack,
  prepared: Promise.all([cards.ready, wheelStrip.ready, renderer.compileAsync(garage.scene, garage.camera)]).then(() => renderer.render(garage.scene, garage.camera)),
  localPlay(split) { setup.split = split; saveSetup(); renderSetup(); },
  getState: () => {
    const activeMode = net?.state?.mode || setup.mode;
    return { track: TRACKS[trackIndex], trackSummary: $('track-blurb').textContent, car: CARS[garage.index], wheel: wheelById(garage.wheel),
      mode: activeMode, cup: isCupMode(activeMode) ? cupById(activeMode) : null,
      online: !!net || !!joining, split: setup.split,
      canConfigure: !net || (net.isHost && ['lobby', 'results', 'complete'].includes(net.state?.phase)) };
  },
});

onSettings((s, changed) => { if (changed.includes('quality')) applyRaceQuality(renderer, race, s.quality); });
