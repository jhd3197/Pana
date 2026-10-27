import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CARS } from './cars.js';
import { wheelById, composeTune } from './wheel-definitions.js';
import { garageCards } from './garage-cards.js';
import { createTaller, dockTaller } from './taller.js';
import { partsProfile, renderConfig, nivelOf, bandOf } from './parts.js';
import { studioEnvironment, studioRims, showroomPaint, releaseShowroom } from './garage-stage.js';
import { garageBloom } from './garage-bloom.js';
import { paintNext, TIPS } from './loading.js';
import { createMenuFlow } from './menu-flow.js';
import { setMenuImage, trackArt } from './menu-art.js';
import { sound, Puffs, Debris, Shockwaves, makeBubble, setSpeedLines, flyToCounter } from '/engine/fx.js';
import { createItems, ITEMS, SPIN } from './items.js';
import { activeItem, canBlock, COIN_SPEED, MAX_COINS, AIMED, isJuiced } from './item-rules.js';
import { TRACKS, getTrack, makeTrack, loadTrack, loadTracks, trackLoaded } from './tracks.js';
import { createMinimap, drawTrackPreview } from './route-map.js';
import { createRaceWorld } from './race-world.js';
import { createDriver, groundAttitude, G } from './drive.js';
import { createRemoteCars } from './remote-cars.js';
import { START_GHOST_TIME, RESCUE_GHOST_TIME, isGhost, recordImpact, stepProtection } from './recovery-rules.js';
import { loadAvatar, loadName, randomAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { fillRoster } from '/engine/results.js';
import { ICONS as SVG } from '/engine/icons.js';
import { holdButton } from '/engine/touch.js';
import { pixelRatio, bindRenderer, getSettings, onSettings, rendererOptions } from '/engine/settings.js';
import { applyRaceQuality } from './quality.js';
import { shout } from '/engine/kit.js';
import { LAPS, lapsForTrack, RIVALS, AI_WHEELS, POSE_HZ, FINISH_GRACE_MS, GP_GRID, GP_INTERMISSION_MS, GP_MIN_READ_MS, gridSlot, cleanCosmetics, aiVessels, kitTunes } from './online-rules.js';
import { clockText, wrapAngle, raceOrder, aiPedals, resolveContact } from './rules.js';
import { CUPS, cupById, trophyName, cupTracks, difficultyById, rubberBand, cleanLaps, BALLOONS, BATTLE_TIME, battleOrder, battleOver } from './modes.js';
import { abandonCup, advanceStage, beginStage, createCupSession, cupTrophy, finalizeStage, markRacing, markStarted, retryStage, seededOrder, seededUnit, standings as championshipStandings } from './cup-rules.js';
import { advanceLap, ALL_SECTORS, RESCUE_TIME, OUT_TIME, STUCK_TIME } from './course-rules.js';
import { createHazards } from './hazards.js';
import { createMusic, TRACK_STYLE, GARAGE_SONG, RESULTS_SONG, songFor, finishSting } from './music.js';
import { batchRacer, trimDriver, trimShadows, repaintCar, addBalloons, setGhost, syncGhostAppearance } from './racer-render.js';
import { padInput, pressed, keyInput, SPLIT_KEYS, wrongWayStep, WRONG_WAY_TIME, lapSplit } from './controls.js';
import { PAINTS, paintOf, FLAMES, earnings, mirrorUnlocked, repaintHex } from './shop.js';
import { createProfileStore, recordCupTrophy, trophyCredits } from './cup-profile.js';
import { settleRace } from './cup-rewards.js';
import { CLASSIFICATION_TEXT, approximateCupText, cupStandingsView, nextStageText, rankChangeText, tiebreakText } from './cup-ui.js';
let soaringVulture = null; import('/engine/models/fauna/birds/soaring-vulture.js').then(m => { soaringVulture = m.soaringVulture; });   // only rescues need it
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { DRAFT_TIME, DRAFT_BOOST, DRIFT_LEVELS, driftLevel, startBoost, startCue, inSlipstream, loseCoins, physicsFrame, DrivingSpring as Spring } from './drive-rules.js';
import { loc, locn, locKey, formatNumber } from '/engine/i18n.js';

const $ = (id) => document.getElementById(id), esc = (text) => String(text).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const rand = (a, b) => a + Math.random() * (b - a), pick = (list) => list[Math.floor(Math.random() * list.length)];

// test switches: ?auto lets the AI drive your car, ?speed=4 fast-forwards
const QS = new URLSearchParams(location.search), AUTO = QS.has('auto'), SPEED = Number(QS.get('speed')) || 1, DEBUG = QS.has('debug');

// You drive as the pana you made in the hub; the rivals are random ones.
const ME = { name: loadName(), avatar: loadAvatar() };
// ?room=<code> races online with panas (online.js); without it the race is local.
// ?lead=… marks the party's Pana Mayor, who hosts the room (a token when the server checks one).
const ROOM = roomFromUrl();
const onlineModulePromise = ROOM ? import('./online.js') : null;
let net = null;
let menuFlow = null;

const LINES = {
  crash: [locKey('¡AY!'), locKey('¡UEPA!'), locKey('¡Ñooo!'), locKey('¡Mi carro!'), locKey('¡Epa, chamo!'), locKey('¡Qué molleja!')],
  air: [locKey('¡Wiii!'), locKey('¡Ayayay!'), locKey('¡Me fui!')],
  wall: [locKey('¡Ups!'), locKey('¡Pum!'), locKey('¡Mi pintura!')],
  trick: [locKey('¡Truco!'), locKey('¡Qué vacilón!'), locKey('¡Mírame!')],
  rocket: [locKey('¡Arranque cohete!'), locKey('¡Fiuuu!'), locKey('¡Me fui!')],
  pop: [locKey('¡Mi globo!'), locKey('¡Pop!'), locKey('¡Nooo, mi globo!')],
  rescue: [locKey('¡Zamuro, ayúdame!'), locKey('¡Al rescate!'), locKey('¡Sácame de aquí!')],
  out: [locKey('¡Me quedé sin globos!'), locKey('¡Me reventaron!')],
  stall: [locKey('¡Se me ahogó!'), locKey('¡Ay no, el motor!')],
  honk: { meep: '¡MEEP MEEP!', cucaracha: '♪ Cucaracha ♪', grave: '¡PAAAAN!', fiesta: '♪ ¡Rumba! ♪' }, // i18n-ignore: horn sounds and song names
};

let driverCards = null; import('./driver-cards.js').then(m => { driverCards = m; });   // rival panas as cards

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer(rendererOptions({ antialias: true }));
renderer.setPixelRatio(pixelRatio(2));
bindRenderer(renderer, 2);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
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
    if (garage.cars.size >= 20) { const oldest=garage.cars.keys().next().value;releaseShowroom(garage.cars.get(oldest));garage.cars.delete(oldest); }
    const car = showroomPaint(CARS[index].build(ME.avatar, wheelById(wheel).wheel ?? undefined, cfg));
    garage.cars.set(key, repaintCar(car, CARS[index].color, paint));
  }
  return garage.cars.get(key);
}

function showCar(i) {
  garage.index = (i + CARS.length) % CARS.length;
  const def = CARS[garage.index];
  if (wallet.car !== def.id) { wallet.car = def.id; saveWallet(); }
  garage.turn.clear();
  // Bounded garage models; thumbnails borrow these same instances.
  // Race models stay independent because their parts can break off.
  garage.car = garageCar(garage.index);
  garage.turn.add(garage.car.root);
  window.PANA_PREPARED = true; // the shared readiness signal (tests/browser-kit.js)
  garage.ring.material.color.set(def.color);

  document.documentElement.style.setProperty('--car', def.color);
  // Stats bars reflect the car + cauchos + taller parts, from the composed tune.
  taller.renderStats();
  net?.pick(garage.index, garage.wheel, raceStyle(garage.index));
  menuFlow?.refresh();
}

// Equipping wheels rebuilds the turntable car and stats bars,
// and persists the choice for the next visit.
function showWheel(id) {
  const def = wheelById(id);
  garage.wheel = def.id;
  try { localStorage.setItem('carreritas:wheels', def.id); } catch { /* private mode */ }
  if (wallet.wheel !== def.id) { wallet.wheel = def.id; saveWallet(); }
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
  const look = Math.sin(garage.t * 0.9), turnTo = look * 0.6;
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

// Restore the showroom framing after visiting a part slot.
const GARAGE_TARGET = new THREE.Vector3(0, 1.5, 0);
const GARAGE_CAM = new THREE.Vector3(8, 4.5, 9.5);
function updateGarageCamera(dt) {
  if (garage.glide <= 0) return;
  garage.glide = Math.max(0, garage.glide - dt);
  const k = Math.min(1, dt * 5);
  garage.controls.target.lerp(garage.frame?.[1] ?? GARAGE_TARGET, k);
  garage.camera.position.lerp(garage.frame?.[0] ?? GARAGE_CAM, k);
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
  garage.frame = TAB_FRAMES[tab] ?? null;
  garage.glide = 1.4;
}

$('t-prev').onclick = () => switchTrack(trackIndex - 1);
$('t-next').onclick = () => switchTrack(trackIndex + 1);
$('play').onclick = () => {
  sound.unlock();
  if (net && !(setup.split && net.state.players.length < 2)) {   // alone in the room, split screen races here
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
$('go-online').onclick = () => { sound.unlock(); return goOnline(newRoomCode(), true); };
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

const world = createRaceWorld({ scene: race.scene, cameras: [race.camera, race.camera2], puffs: race.puffs, shockwaves: race.shockwaves,
  sound, track: () => T, groundAt, racing: () => mode === 'race' });
Object.assign(race, { rain: world.rain, sky: world.sky, hemi: world.hemi, sun: world.sun });
const applyPalette = world.applyPalette;
race.debris = new Debris(race.scene);
// Race presentation loads with the first race, keeping the garage's first load
// small: lazyRace puts a no-op stub on race[key] now and swaps in make(module)
// when the import() lands. New race modules follow the same one line.
const lazyRace = (key, stub, load, make) => { race[key] = stub; return load.then(m => { race[key] = make(m); return m; }); };
let driftFx = null;
import('./drift-fx.js').then(m => { driftFx = m; });
lazyRace('water', { update() {}, stop() {} }, import('./water-ambience.js'), m => m.createWaterAmbience(sound));   // river and sea sound
lazyRace('skidMarks', { lay() {}, update() {}, clear() {} }, import('./skid-marks.js'), m => new m.SkidMarks(race.scene, { focus: () => race.player }));
lazyRace('slowMo', { update() {}, trigger() {}, scale: 1, punch: 0 }, import('./slow-mo.js'), m => m.createSlowMo());
lazyRace('glow', { boost() {}, impact() {}, coins() {} }, import('./race-fx.js'), m => m.createRaceFx(race.scene));   // turbo, hit and coin glow
lazyRace('tags', { update() {}, clear() {} }, import('./name-tags.js'), m => m.createNameTags());   // names over nearby racers
lazyRace('hud', { update() {}, reset() {} }, import('./race-hud.js'), m => m.createRaceHud());   // standings pop-in, speed gauge
lazyRace('audio', { update() {} }, import('./drift-audio.js'), m => m.createDriftAudio(sound));   // drift screech, chimes, outboard
lazyRace('shadowCache', null, import('./shadow-cache.js'), m => m.cacheShadows(renderer, () => race.trackGroup));   // still scenery cast once per cell
lazyRace('props', { setTrack() {}, sync() {}, update() {} }, import('./breakables.js'), m => m.createBreakables({ race, sound, track: () => T }))
  .then(() => { if (T?.group) race.props.setTrack(T); });   // barrels and crates to smash
const screensReady = lazyRace('screens', { grid() {}, finish() {}, tick() {} }, import('./race-screens.js'), m => m.createRaceScreens({sound,taller}));
// A max-charge release dilates time (local races) and punches the camera.
race.purpleRelease = () => { race.slowMo.trigger(); race.shake = Math.min(1.2, race.shake + 0.45); };

// ---------- race setup: mode, difficulty, laps, mirror (local races) ----------
let profileStorage = null;
try { profileStorage = localStorage; } catch { /* private mode */ }
const profileStore = createProfileStore(profileStorage, { onMangos: balance => { $('shop-coins').textContent = balance; } });   // fights elsewhere pay in
const profile = profileStore.load();
const setup = profile.setup;
const isCupMode = (mode) => CUPS.some(c => c.id === mode);

// Personal-best ghost: the recorder samples the local car and the replay
// drives a translucent replica (ghost-recorder.js / ghost-car.js). The stub
// no-ops until the modules land; ghostReady is awaited before any race.
race.ghost = null;
race.recorder = { begin() {}, step() {}, finish() { return null; }, discard() {} };
let ghostIO = null, ghostPlay = null;
const ghostReady = Promise.all([import('./ghost-recorder.js'), import('./ghost-car.js')]).then(([io, play]) => {
  ghostIO = io; ghostPlay = play;
  race.recorder = io.createGhostRecorder({ storage: profileStorage });
});

// ---------- the taller: wallet, paints, horns, turbo flames ----------
let wallet = profile.wallet;
function saveWallet() {
  profileStore.save(profile);
  $('shop-coins').textContent = wallet.coins;
}
const raceStyle = index => cleanCosmetics({paintColor:wallet.copiedPaint,paint:wallet.paint[CARS[index].id],horn:wallet.horn,flame:wallet.flame,parts:wallet.parts[CARS[index].id],boat:wallet.boat,boatParts:wallet.boatParts?.[wallet.boat],air:wallet.air,airParts:wallet.airParts?.[wallet.air]});
const hornFor = c => c.cosmetics.horn !== 'propio' ? c.cosmetics.horn : c.def.horn;
const flameFor = c => FLAMES.find(f => f.id === c.cosmetics.flame)?.colors ?? FLAMES[0].colors;

// The Taller owns visible part slots, hover previews and direct purchases.
let cards;
const taller = createTaller({
  $, wallet, sound, carThumbnail: index => cards?.image(index), getTrack: () => TRACKS[trackIndex], previewCar: i => { garage.turn.clear(); garage.car = garageCar(i); garage.turn.add(garage.car.root); }, previewVessel: (kind, id, color) => import('./garage-vessels.js').then(m => m.previewVessel(garage, ME.avatar, kind, id, color)), cars: CARS, getIndex: () => garage.index, selectCar: i => showCar(i),
  getWheel: () => garage.wheel, setWheel: id => showWheel(id), onTab: frameTab,
  trophies: () => loadTrophies(), save: saveWallet, refreshCar: () => showCar(garage.index), onHorn: garageHonk,
});
const openShop = dockTaller({ $, taller, sound, resize: () => resize(), onClosed: () => { garage.frame = null; garage.glide = 1.2; } });

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
  $('mirror').title = mirrorOpen ? '' : loc('Gana un trofeo en una copa para desbloquear el modo espejo');
  $('mirror').setAttribute('aria-checked', String(setup.mirror));
  $('split').setAttribute('aria-checked', String(setup.split));
  const battle = activeMode === 'battle', cup = isCupMode(activeMode) ? cupById(activeMode) : null;
  if (!net) {
    $('launch-note').innerHTML = `<span class="pk-dot"></span>${cup ? (setup.split ? loc('Dos panas contra 6 rivales') : loc('Tú contra 7 rivales')) : setup.split ? loc('Dos panas contra 2 rivales') : loc('Tú contra 3 rivales')}`;
  }
  for (const b of $('laps-pick').querySelectorAll('button')) b.disabled = battle || !!cup;
  for (const b of $('difficulty-pick').querySelectorAll('button')) b.disabled = !hostCanConfig;
  const trophies = profile.trophies, legacy = profile.legacyTrophies;
  for (const b of $('mode-pick').querySelectorAll('button')) {
    b.hidden = !!net && b.dataset.mode === 'battle';
    b.disabled = !hostCanConfig;
    const won = trophies[b.dataset.mode], earlier = legacy[b.dataset.mode];
    const shown = won ?? earlier?.trophy;
    b.title = !shown ? '' : !won && earlier ? loc('Trofeo de {trophy} · Edición anterior', { trophy: trophyName(shown) }) : loc('Trofeo de {trophy}', { trophy: trophyName(shown) });
    b.querySelector('.mode-trophy')?.remove();
    b.querySelector('.mode-legacy')?.remove();
    if (shown) {
      const dot = document.createElement('span');
      dot.className = 'mode-trophy';
      dot.style.setProperty('--trophy', `var(--trophy-${shown})`);
      dot.setAttribute('aria-label', !won && earlier ? loc('trofeo de {trophy}, edición anterior', { trophy: trophyName(shown) }) : loc('trofeo de {trophy}', { trophy: trophyName(shown) }));
      b.append(dot);
    }
    if (!won && earlier) {
      const label = document.createElement('small');
      label.className = 'mode-legacy';
      label.textContent = loc('Edición anterior');
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
      btn.innerHTML = `<span>${idx + 1}. ${esc(trackDef.name)}</span><small>${locn(stage.laps, '{n} vuelta', '{n} vueltas')}</small>`;
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
  if (!mirrorOpen && !cup && activeMode !== 'battle') $('setup-note').textContent = loc('Gana un trofeo en una copa para desbloquear el modo espejo.');
  else $('setup-note').textContent = cup
    ? `${cup.name}: ${cupTracks(cup).map(id => getTrack(id).name).join(' → ')}. ${approximateCupText(cup)}`
    : battle ? loc('Globos: tres globos por carro. Cada golpe revienta uno. Gana el último con globos.') : '';
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
  try { localStorage.setItem('carreritas:track', def.id); } catch { /* private mode */ }
  $('track-name').textContent = def.name;
  const laps = lapsOverride ?? (net ? net.state?.laps || LAPS : setup.mode === 'battle' ? 0 : setup.laps);
  // The map's module is still downloading: name and blurb now, route and times when it lands.
  if (!trackLoaded(def.id)) {
    $('track-blurb').textContent = def.blurb;
    const map = $('track-map'); map.getContext('2d').clearRect(0, 0, map.width, map.height);
    loadTrack(def.id).then(() => { if (selectedTrackId === def.id) selectTrack(def.id, lapsOverride); })
      .catch(error => console.warn('Track unavailable', def.id, error));
    menuFlow?.refresh();
    return null;
  }
  if (!trackRoutes.has(def.id)) trackRoutes.set(def.id, makeTrack(def));
  const route = trackRoutes.get(def.id);
  // Puerto's eight-car timing proof averages 170 s; this broader pace band
  // leaves room for ordinary mistakes and item exchanges. Other maps use the
  // same planning estimate until their own driving profiles are recorded.
  const estimate=laps?[36,27].map(speed=>{
    const seconds=Math.round(route.TOTAL*laps/speed/15)*15;
    return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }):[];
  $('track-blurb').textContent = (laps ? loc('{from}–{to} min aprox.', { from: estimate[0], to: estimate[1] }) + ' · ' + locn(laps, '{n} vuelta', '{n} vueltas') : loc('batalla de globos')) + '. ' + def.blurb
    + (def.rain ? ' ' + loc('Está lloviendo: los cauchos de lluvia agarran mejor.') : '');
  const activeMode = net ? (net.state?.mode || 'race') : setup.mode;
  const cup = isCupMode(activeMode) ? cupById(activeMode) : null;
  const cupStageIdx = cup ? cup.stages.findIndex(s => s.track === def.id) : -1;
  $('track-of').textContent = cupStageIdx >= 0 ? loc('Carrera {n}/4', { n: cupStageIdx + 1 }) : loc('Pista {n}/{total}', { n: trackIndex + 1, total: TRACKS.length });
  drawTrackPreview($('track-map'), route);
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
  gatesApi?.setTrack(T);
  race.props.setTrack(T);
  ghostIO?.devGhost(T.id);   // start fetching the track's shipped ghost, if any
  applyPalette(T.def.palette);
  race.items = createItems({
    scene: race.trackGroup, puffs: race.puffs, sound, G, track: T, rain: race.rain,
    crash: (c, power, side) => crash(c, power, side),
    explode: (pos) => {
      race.shockwaves.explode(pos, { radius: 4.8, scorch: true });
      if (race.player) {
        const d = Math.hypot(race.player.x - pos.x, race.player.z - pos.z);
        if (d < 45) race.shake = Math.min(1.2, race.shake + (1 - d / 45) * 0.85);
      }
    },
    coinPicked: (c, worldPos, streak) => {
      race.glow.coins(worldPos, 14);
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
  applyRaceQuality(renderer, race, getSettings());
  $('mm-track').textContent = T.name;
  $('mm-sub').textContent = loc('{km} km por vuelta', { km: (T.TOTAL / 1000).toFixed(2) });
  minimap.build(T);
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
  const { id } = TRACKS[(i + TRACKS.length) % TRACKS.length];
  selectTrack(id);
  net?.track(id);
}

// ---------- race HUD: minimap (standings and gauge live in race-hud.js) ----------
const minimap = createMinimap($('mm'));
const lapProgress = (c) => paramOf(c.x, c.z, c.y) / T.TOTAL;

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
    id: LOCAL_GUEST, name: loc('Jugador 2'), kind: 'human', owner: 'local', avatar: randomAvatar(),
    loadout: { car: guestCar, wheel: 'calle' }, skillSeed: `${sessionId}:guest`,
  });
  for (let i = 0; entrants.length < GP_RACERS; i++) {
    const car = cars[i];
    entrants.push({
      id: `local-bot-${i + 1}`, name: names[i], kind: 'bot', owner: 'local', avatar: randomAvatar(),
      loadout: { car, wheel: AI_WHEELS[CARS[car].id] || 'calle', ...aiVessels(CARS[car].id) }, skillSeed: `${sessionId}:bot-${i + 1}`,
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
  cosmetics=cleanCosmetics(cosmetics ?? (isPlayer ? raceStyle(index) : aiVessels(CARS[index].id)));
  const car = def.build(who.avatar, wheel.wheel ?? undefined, renderConfig(cosmetics.parts));
  repaintCar(car, def.color, paintOf(cosmetics));
  batchRacer(car,paintOf(cosmetics,def.color)); trimDriver(car);
  if (!isPlayer) { driverCards?.cardDriver(car); driverCards?.farCar(car); }
  trimShadows(car, isPlayer ? 12 : 6);
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
    wheel: wheel.id, tunes: kitTunes(cosmetics, def, wheel), tune: composeTune(def.tune, wheel.profile, partsProfile(cosmetics.parts)),   // stepCar drives with the active piece's tune (transform-gates swaps it)
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
  Object.assign(c,groundAttitude(c,T),{onGround:true,pitchV:0,rollV:0});
  c.prog = progressOf(c);
  c.safe = { s, off: lane, back: false };
}

// Battle starts: a racer at arc length s, optionally facing backwards.
function placeAlong(c, s, backwards) {
  const p = pointAt(s), p2 = pointAt(s + 0.5);
  const tx = p2.x - p.x, tz = p2.y - p.y;
  Object.assign(c, { x: p.x, z: p.y, h: Math.atan2(tx, tz) + (backwards ? Math.PI : 0), reverse: backwards && !c.isPlayer });
  c.y = groundAt(c.x, c.z, T.heightAtS(s));
  Object.assign(c,groundAttitude(c,T),{onGround:true,pitchV:0,rollV:0});
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
  for (const v of vultures.values()) {
    const geometries=new Set();v.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());v.removeFromParent();
  }
  vultures.clear();
  race.cars.forEach(disposeRacer);
  race.cars = [];
  if (race.ghost) { disposeRacer(race.ghost.car); race.ghost = null; }
  race.tags.clear(); race.audio.update(null, 0, false);
  race.recorder.discard();
  race.puffs.clear();
  race.debris.clear();
  race.shockwaves.clear();
  race.skidMarks.clear();
  setSpeedLines(0);
  race.items?.clear();
  race.player = null;
}

let loadGeneration = 0;
// roster (online only): [{ id, kind, owner, name, avatar, car, wheel, slot }]
// from the room. Without one the race is the local player plus three bots.
async function startRace(playerIndex, wheelId = garage.wheel, roster = null) {
  if (mode === 'loading' && (!roster || net?.state.raceId === race.loadingRaceId)) return;
  driftFeats.reset();   // a new race starts the milestone counts over; no await before the generation guard below
  driftCombo.reset();                     // …and the style score
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
  $('loading-meta').textContent = race.cup ? [race.cup.definition.name, loc('Carrera {n} de 4', { n: race.cup.session.stageIndex + 1 }), locn(race.laps, '{n} vuelta', '{n} vueltas')].join(' · ')
    : race.mode === 'battle' ? ['Carreritas', loc('Batalla de globos'), def.name].join(' · ') : ['Carreritas', loc('Pista {n} de {total}', { n: trackIndex + 1, total: TRACKS.length }), locn(race.laps, '{n} vuelta', '{n} vueltas')].join(' · ');
  $('loading-blurb').textContent = def.blurb;
  music.preload(songFor(def.id, race.mode));
  $('loading-tip-icon').innerHTML = tip[0];
  $('loading-tip').textContent = tip[1];
  $('play').disabled = true;
  sound.stopEngine();
  music.stop();
  race.water.stop();
  const step = async (label, progress) => {
    $('loading-status').textContent = label;
    $('loading-progress').value = progress;
    $('loading-pct').textContent = `${Math.round(progress * 100)}%`;
    await paintNext();
    return generation === loadGeneration;
  };
  try {
    if (!await step(loc('Preparando la pista…'), 0.05)) return;
    const cameraModule = await import('./chase-camera.js');
    if (generation !== loadGeneration) return;
    followCam ||= cameraModule.createChaseCamera(race, () => T, rand, () => cameraStyle);
    clearRace();
    await loadTrack(TRACKS[trackIndex].id);
    if (generation !== loadGeneration) return;
    if (beginTrack(TRACKS[trackIndex].id)) {
      let progress = 0.12;
      for (const label of T.buildSteps()) {
        race.trackGroup = T.group;
        if (!await step(label, progress)) return;
        progress += 0.1;
      }
      finishTrack();
    }
    if (!await step(loc('Preparando los carros…'), 0.5)) return;
    if (roster) {
      const activeRoster = roster.filter(r => (!r.retired && !r.dns) || r.id === net.id);
      for (const [i, r] of activeRoster.entries()) {
        if (!await step(loc('Preparando los panas… {n}/{total}', { n: i + 1, total: activeRoster.length }), 0.5 + (i + 1) / activeRoster.length * 0.3)) return;
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
        if (!await step(loc('Preparando los panas… {n}/{total}', { n: i + 1, total: grid.length }), 0.5 + (i + 1) / grid.length * 0.3)) return;
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
        const p2 = makeRacer((playerIndex + 1) % CARS.length, false, loc('Jugador 2'), 'calle');
        p2.human = 2;
        p2.skill = 1;
        race.cars.push(p2);
      }
      for (let i = race.cars.length; i < RACERS; i++) {
        if (!await step(loc('Preparando los panas… {n}/{total}', { n: i, total: RACERS }), 0.5 + i * 0.08)) return;
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
    $('best-pill').hidden = true; race.hud.reset();
    $('ghost-pill').hidden = true;
    $('stage-pill').hidden = !race.cup;
    if (race.cup) $('stage-readout').textContent = `${race.cup.session.stageIndex + 1}/4`;
    $('race').classList.toggle('split', !!race.p2);
    $('p2-hud').hidden = !race.p2;
    resize();
    race.playerIndex = playerIndex;
    race.playerWheel = wheelId;
    // The ghost races every mode but battle; ?noghost turns the feature off.
    if (race.mode !== 'battle' && !QS.has('noghost')) {
      race.recorder.begin(T.id);
      // Your best lap, or the shipped dev ghost while it is faster (ghost-recorder.js).
      const recorded = ghostIO?.pickGhost(ghostIO.loadGhost(T.id, profileStorage), ghostIO.devGhost(T.id));
      if (recorded && ghostPlay) {
        race.ghost = ghostPlay.spawnGhost({ recording: recorded, buildCar: () => {
          const by = recorded.by, car = by ? Math.max(0, CARS.findIndex(d => d.id === recorded.car)) : playerIndex;
          const c = makeRacer(car, false, by || ME.name, wheelId, by ? recorded.avatar : ME.avatar, by ? null : raceStyle(playerIndex));
          c.name = by || loc('Fantasma');
          setGhost(c, true);
          return c;
        } });
        $('ghost-time').textContent = clockText(recorded.lap);
        $('ghost-pill').hidden = false;
      }
    }
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
    race.earned = 0; race.rewardDetail = null; race.lapRecord = false;
    await screensReady; if (generation !== loadGeneration) return;
    $('loading').classList.add('hidden'); $('garage').classList.add('hidden');
    await race.screens.prepare(race.cars, race.player, T, AUTO || (roster && net.state.startAt > 0)); if (generation !== loadGeneration) return;
    race.screens.tick('off', 0); $('loading').classList.remove('hidden');
    if (!await step(loc('Preparando los gráficos…'), 0.81)) return;
    renderer.toneMapping = THREE.NoToneMapping;
    updateRace(0);
    const { prepareRace } = await import('./prepare-race.js');
    if (generation !== loadGeneration) return;
    // Each gate vessel sculpts its own pana (~300 ms): build and warm them
    // behind the cover, not as each racer reaches the gate on lap one.
    await gatesReady; const vessels = [];
    for (const c of race.cars) { const built = gatesApi.prebuild(c); vessels.push(...built); if (built.length && !await step(loc('Preparando los vehículos…'), 0.81)) return; }
    // Cars turn translucent at GO (start grace): compile that variant now too.
    const solid = race.cars.filter(c => !c.ghost);
    vessels.forEach(g => { g.visible = true; }); solid.forEach(c => { c.ghost = true; syncGhostAppearance(c); });
    try {
      try { if (!await prepareRace(renderer, race.scene, race.p2 ? [race.camera, race.camera2] : race.camera, step)) return; }
      finally { solid.forEach(c => { c.ghost = false; syncGhostAppearance(c); }); }
      await renderer.compileAsync(race.scene, race.camera);   // and their solid variants
    } finally { vessels.forEach(g => { g.visible = false; }); }
    if (roster) {
      // Everyone counts down together once every pana has loaded.
      net.loaded();
      if (!await step(loc('Esperando a los panas…'), 1)) return;
      if (!await net.until(s => s.raceId !== race.netRace || s.startAt > 0 || s.phase === 'lobby', (s) => {
        const racing = s.players.filter(p => p.racing), ready = racing.filter(p => p.loaded).length;
        $('loading-status').textContent = loc('Esperando a los panas… {n}/{total} listos', { n: ready, total: racing.length });
      }) || generation !== loadGeneration) return;
      if (net.state.raceId !== race.netRace || net.state.phase === 'lobby') return;
      syncRacers(net.state);
    } else if (!await step(loc('¡Listo!'), 1)) return;
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
    clock.reset();
    mode = 'race';
    $('garage').inert = $('race').inert = false;
    $('loading').classList.add('hidden');
    renderer.domElement.tabIndex = -1;
    renderer.domElement.focus({ preventScroll: true });
    if (roster && ['results', 'complete'].includes(net.state.phase)) finish();
  } catch (error) {
    console.error('Carreritas loading failed', error);
    if (generation === loadGeneration) {
      if (!race.trackReady && T?.group) race.trackGroup = T.group;
      race.screens.tick('off', 0); $('loading').classList.remove('hidden');
      $('loading-status').textContent = loc('No pudimos preparar la carrera. Vuelve al garaje e inténtalo otra vez.');
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
  race.screens.tick('off', 0);
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
  race.water.stop();
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
let cameraStyle = 'dinamica';
try { if (localStorage.getItem('carreritas:camera') === 'suave') cameraStyle = 'suave'; } catch { /* session preference */ }
// The pad drives the car through controls.js; the engine works the garage and menus with it.
const menu = createGameMenu({ pad: { native: true, playing: () => mode === 'race' && race.state !== 'end', help: [['RT / A', loc('Acelerar')], ['LT / B', loc('Frenar')], ['Stick izq. / Cruceta', loc('Girar')], ['RB', loc('Derrapar')], ['LB', loc('Objeto adelante')], ['X', loc('Objeto atrás')], ['Cruceta ↑', loc('Cambiar objeto')], ['View / L3', loc('Mirar atrás')], ['Y', loc('Rescate')]] },
  title: 'Carreritas', heading: loc('Pausa'), sound, orientation: 'horizontal',
  options: [{ id: 'camera', label: loc('Cámara'), choices: [['dinamica', loc('Dinámica')], ['suave', loc('Suave · sin inclinación')]], get: () => cameraStyle,
    set(value) { if (!['dinamica', 'suave'].includes(value)) return; cameraStyle = value; try { localStorage.setItem('carreritas:camera', value); } catch { /* session preference */ } } }],
  note: () => mode === 'race' ? (race.state === 'end' ? loc('La carrera terminó.') : race.netRace ? loc('Carrera online: no se detiene.') : loc('La carrera está en pausa.')) : loc('Estás en el garaje.'),
  controls: [['W / ↑', loc('Acelerar')], ['S / ↓', loc('Frenar')], ['A D / ← →', loc('Girar')], ['Shift / K', loc('Saltar y derrapar · truco en el aire')], ['Espacio / E', loc('Lanzar objeto adelante')],
    ['X', loc('Lanzar objeto atrás')], ['1 2', loc('Elegir objeto')], ['Q', loc('Cambiar objeto')], ['R', loc('Pedir rescate al zamuro')], ['C', loc('Mirar atrás')], ['H', loc('Claxon')], ['M', loc('Sonido')], ['Esc', loc('Pausa')]],
  tips: [loc('Mantén el botón de derrape y gira. La ayuda corrige si te acercas al borde; gira al otro lado para abrir la curva.'),
    loc('Suelta el botón de derrape al salir de la curva: el carro se estabiliza y las chispas dan turbo. No hace falta esperar a las moradas.'),
    loc('Puedes acelerar antes del ¡YA!. Desde el final del "1" sales con arranque cohete; desde el "3" el motor se ahoga y sale flojito un momento.'),
    loc('Rompe cajas de madera para conseguir objetos. Cada moneda da un poquito más de velocidad.'),
    loc('Sales y vuelves del rescate como fantasma durante 3 segundos. Los roces entre carros ya no te lanzan al aire.'),
    loc('Cada carro tiene su talento: lee su ficha y combina cauchos con derrapes, rebufo o piruetas.'),
    loc('Calidad Rápida reduce sombras, lluvia y detalles para equipos lentos. No cambia la física ni reduce el retraso de internet.')],
  actions: [
    { id: 'restart', label: loc('Reiniciar carrera'), kind: 'secondary', visible: () => mode === 'race' && !race.netRace && (!race.cup || ['loading', 'racing'].includes(race.cup.session.status)), run: () => startRace(race.playerIndex, race.playerWheel) },
    { id: 'to-garage', label: loc('Volver al garaje'), kind: 'secondary', visible: () => mode === 'race', run: () => toGarage() },
  ],
  invite: () => inviteLink(),
  canOpen: () => mode !== 'loading',
  onOpen() {
    resetInput();
    if (mode !== 'race' || race.netRace) return;
    paused = true;
    music.pause();
    race.water.stop(); race.audio.update(null, 0, false);   // no screech under the pause menu
    if (sound.engine) sound.engine.g.gain.setTargetAtTime(0, sound.ctx.currentTime, 0.05);
  },
  onClose() { if (paused) music.resume(); paused = false; acc = 0; clock.reset(); },
});
$('race').querySelector('.hud-corner').append(menu.createButton({ id: 'pause', label: loc('Pausa'), className: 'pause-button pk-btn pk-btn--sm' }));
$('garage').querySelector('.bar').append(menu.createButton({ id: 'settings', label: loc('Ajustes'), className: 'toggle pk-btn pk-btn--sm' }));
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
  if (race.netRace && net.isHost && ['results', 'complete'].includes(net.state.phase)) { net.lobby(); net.garage(false); }
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
  if (k === 'escape' && mode === 'loading' && !document.querySelector('dialog:modal')) toGarage();
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
let padsBefore = [null, null], pads = null;
// game-entry.js has already loaded it: not a first-load module of its own.
import('/engine/gamepad.js').then(m => { pads = m; });
function pollPads() {
  // Alone, the pad in use drives; split screen hands out the controllers in order.
  const list = !pads ? [] : race.p2 ? pads.padList() : [pads.activePad()];
  race.pads = [padInput(list[0],getSettings()), padInput(list[1],getSettings())];
  race.pads.forEach((pad, i) => {
    const hit = pressed(pad, padsBefore[i]);
    const who = i === 0 ? race.player : race.p2;
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
  else if (c.aiDrift && (Math.abs(diff) < 0.08 || (c.drift && Math.sign(diff) !== c.drift) || c.driftT > DRIFT_LEVELS[2] + 0.3)) c.aiDrift = false;   // rivals let go just into purple, never into a burn
  return { ...aiPedals(diff, race.mode === 'battle' ? 0 : gap), drift: c.aiDrift && race.diff?.drift !== false };
}

function say(c, lines, time) {
  const text = typeof lines === 'string' ? lines : pick(lines);
  c.bubble.say(loc(text), time);
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
  if (lost) race.glow.coins(new THREE.Vector3(c.x, c.y + 1.6, c.z), lost * 10);
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
  race.glow.impact(c, power, side);
  spillCoins(c, power >= 14 ? 2 : 1);
  say(c, LINES.crash);
  popPart(c, power);
  if (power > 14) popPart(c, power);
  race.puffs.spawn(new THREE.Vector3(c.x, c.y + 1, c.z), { color: 0xc8c8d0, count: 8, spread: 2 });
  if (c.isPlayer) race.shake = Math.min(1, race.shake + power * 0.05);
  recordImpact(c, race.clock, true);
}

const { stepCar } = createDriver({ race, track: () => T, say, popPart, progressOf, flameFor, lines: LINES, auto: AUTO });
// Milestone toasts for the local player's drifting; the module loads during
// boot (awaited below, before PANA_PREPARED), keeping the garage's first load small.
let driftApi = null; const featsReady = import('./feats.js').then(m => { driftApi = m.createDriftFeats($('toast')); });
const driftFeats = { step: (c, dt) => driftApi?.step(c, dt), reset: () => driftApi?.reset(), win: () => driftApi?.win() };
// Style scoring and its combo meter: same lazy pattern, same first-race load.
let comboApi = null; const comboReady = import('./drift-combo.js').then(m => { comboApi = m.createDriftCombo($('combo')); });
const driftCombo = {
  step: (c, dt) => comboApi?.step(c, dt), finish: (c) => comboApi?.finish(c), reset: () => comboApi?.reset(),
  update: (c) => comboApi?.update(c), totalOf: (c) => comboApi?.totalOf(c) ?? 0, bestChainOf: (c) => comboApi?.bestChainOf(c) ?? 1,
  live: (c) => comboApi?.live(c),
};
// River stretches that turn cars into lanchas (transform-gates.js), same lazy load.
let gatesApi = null; const gatesReady = import('./transform-gates.js').then(m => { gatesApi = m.createTransformGates({ race, sound, track: () => T }); if (T?.group) gatesApi.setTrack(T); });
if (DEBUG) window.PANA_DRIFT_SCORE = () => race.player ? driftCombo.live(race.player) : null;
if (DEBUG) window.PANA_GHOST = () => race.ghost ? { lap: race.ghost.lap, clock: race.clock, x: race.ghost.car.x, y: race.ghost.car.y, z: race.ghost.car.z } : null;

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
  if (!v) { if (!soaringVulture) return;
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
      if (c.isPlayer) { sound.turbo(); c.itemMessage = loc('¡Rebufo!'); c.itemMessageT = 1; }
    }
  }
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

// Sparks, stall smoke and draft streaks live in drift-fx.js.

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
  driftFx?.driftSparks(race.puffs, c, dt);
  race.skidMarks.lay(c, dt);
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
  if (!(car.driverCard || car.far) || driverCards.showRival(car, c, [race.camera, race.p2 && race.camera2])) {
    d.neck.rotation.z = c.headLag.step(-lean * 0.5 + sr * 2, 90, 5, dt);
    d.neck.rotation.x = -dive * 0.25 + c.heave.v * 0.01;
    d.neck.rotation.y = c.steer * 0.45;
    const open = c.scream > 0 || c.honkT > 0 || (!c.onGround && c.airTime > 0.3);
    d.update(dt, { open, dizzy: c.dizzy > 0, look: c.steer });
  }
  for (const p of car.danglers) {
    p.rotation.z = p.rotation.z * 0.92 + lean * 0.5 + Math.sin(race.clock * 7) * 0.02;
    p.rotation.x = p.rotation.x * 0.92 + dive * 0.4;
  }

  c.bubble.sprite.position.set(c.x, c.y + 4.4, c.z);
  c.bubble.update(dt);
  if (race.mirror) c.bubble.sprite.scale.x *= -1;   // keep speech readable in the flipped world
}

function updateRace(dt, presentation = true) {
  race.screens.tick(race.state, race.count, race.cars, dt, standings(), race.clock);
  if (race.state === 'count') {
    // Online, the room's start time drives every countdown at once.
    if (race.netRace) race.count = Math.min(3.999, 1 + (net.state.startAt - net.now()) / 1000);
    else race.count -= dt;
    const n = Math.ceil(race.count) - 1;
    $('count').textContent = n > 0 ? n : loc('¡YA!');
    // Rocket start: remember when the gas went down (and stayed down); the number's colour shows how the start will go.
    race.throttleAt = playerInput().throttle > 0 ? race.throttleAt ?? race.count : null;
    $('count').dataset.rev = race.throttleAt == null ? '' : startCue(race.throttleAt);
    if (race.count <= 1) {
      race.state = 'go';
      if (race.netRace) race.clock = Math.max(0, (net.now() - net.state.startAt) / 1000);
      if (!race.netRace || net.now() - net.state.startAt < 1000) launchGrid();
    }
  } else if (race.state === 'go' || race.state === 'end') {
    race.clock += dt;
    if (race.count > 0) {
      race.count -= dt; $('count').dataset.rev = '';
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
        driftCombo.step(c, dt);   // a finished car still banks its last chain
        continue;
      }
      stepCar(c, c.isPlayer && !AUTO ? playerInput(1) : c.human === 2 && !AUTO ? playerInput(2) : aiInput(c), dt);
      if (c.isPlayer) driftFeats.step(c, dt);   // milestone toasts read the drift the step left
      driftCombo.step(c, dt);   // style scoring reads every local car, bots included
      gatesApi?.step(c, dt);    // on a river stretch a drift charges the wake turbo
      if (c.outT > OUT_TIME || c.stuckT > STUCK_TIME) rescue(c);
      if (!c.isPlayer) {
        c.aiHonk -= dt;
        const p = race.player;
        if (c.aiHonk <= 0 && Math.hypot(p.x - c.x, p.z - c.z) < 14) {
          honk(c);
          c.aiHonk = rand(5, 10);
        }
      }
      // The recorder sees the crossing step before finish() closes the take.
      if (c.isPlayer) race.recorder.step(race.clock, c);   // the ghost recorder samples at its own rate
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
  race.ghost?.update(race.clock * 1000, dt);   // the replica follows the recording, countdown included
  for (const c of race.cars) syncGhostAppearance(c);
  race.hazards?.update(race.clock, dt, race.state === 'go' || race.state === 'end' ? race.cars : [], hitHazard);
  race.puffs.update(dt);
  race.skidMarks.update(dt);
  race.debris.update(dt);
  race.shockwaves.update(dt);
  // The deterministic browser harness can run the same gameplay tick without
  // spending simulation time on poses, the minimap and DOM painting.
  if (presentation) presentRace(dt);
}

// Poses, camera, scenery animation and the HUD: once per drawn frame, for the
// time the physics steps covered (frame() runs several steps on a slow frame).
// HUD text is written only when it changes: a write invalidates layout even when equal.
function setText(id, text) { const el = $(id); if (el.textContent !== text) el.textContent = text; }
function presentRace(dt) {
  for (const c of race.cars) { syncCar(c, dt); gatesApi?.sync(c, dt); race.props.sync(c); }
  race.props.update(dt);
  if (race.ghost) { syncCar(race.ghost.car, dt); gatesApi?.sync(race.ghost.car, dt); }   // the replay turns lancha on river runs too
  race.sky.update(race.clock, T.def.palette?.daylight ?? 1);
  tickWind(race.clock, T?.def.rain ? 1.45 : 1);
  for (const o of T.animated) o.userData.tick(race.clock, dt);   // scenery: flags, windmills, birds…
  sound.setEngine(race.player.vf);
  race.audio.update(race.player, dt, race.state === 'go' && !paused);
  race.water.update(T,race.player.x,race.player.z);

  // HUD
  const p = race.player;
  const order = standings();
  const place = order.indexOf(p);
  race.tags.update(race.ghost ? [...race.cars, race.ghost.car] : race.cars, race.camera, p, { show: !race.split && race.state !== 'end', order });
  if (race.mode === 'battle') {
    setText('lap-label', loc('Globos'));
    setText('lap', `${p.balloons}/${BALLOONS}`);
  } else {
    setText('lap-label', loc('Vuelta'));
    setText('lap', `${Math.min(race.laps, Math.max(1, p.lap))}/${race.laps}`);
  }
  if (race.shownPlace !== place) {
    race.shownPlace = place;
    $('pos').innerHTML = `${place + 1}<sup>º</sup>`;
    $('pos').setAttribute('aria-label', loc('Posición {n} de {total}', { n: place + 1, total: order.length }));
  }
  setText('leader', order[0] === p ? loc('¡Tú!') : order[0].name);
  setText('time', race.mode === 'battle' ? clockText(Math.max(0, BATTLE_TIME - race.clock)) : clockText(p.done ? p.time : race.clock));
  if (race.mode !== 'battle' && race.laps > 1 && p.lap === race.laps && !p.finalLap && !p.done) {
    p.finalLap = true;
    shout(loc('¡Vuelta final!'));
    music.setTempo(1.14);
  }
  music.muffle(p.spin > 0 && !race.p2); // a spin-out dulls the band until you recover
  showItem(p);
  readRoad(p, dt);
  if (race.p2) showP2(order);

  // speedometer + boost bar
  race.hud.update(race, order, dt);
  setSpeedLines(p.boost > 0 ? Math.min(0.85, p.boost) : 0);
  const boost = $('boost');
  const ratio = Math.min(1, Math.abs(p.vf) / (p.tune.top * 1.5));
  const lit = Math.round(ratio * 8);
  boost.classList.toggle('turbo', p.boost > 0);
  const charge = p.drift ? String(driftLevel(p.driftT)) : '';
  if (boost.dataset.drift !== charge) boost.dataset.drift = charge;
  const driftHint = $('drift-hint');
  driftHint.hidden = !p.drift;
  const driftText = p.drift ? (Number(charge) ? loc('Suelta: turbo') : loc('Derrape asistido')) : '';
  if (driftHint.textContent !== driftText) driftHint.textContent = driftText;
  const driftButton = document.querySelector('.touch-drift');
  const driftAction = p.drift && Number(charge) ? loc('¡Suelta!') : loc('Derrape');
  if (driftButton.textContent !== driftAction) {
    driftButton.textContent = driftAction;
    driftButton.setAttribute('aria-label', driftAction === loc('Derrape') ? loc('Derrapar o saltar') : loc('Suelta para recibir turbo'));
  }
  const segs = boost.children;
  for (let i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i < lit);
  driftCombo.update(p);   // the combo meter mirrors the live style chain

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
    if (race.state === 'end') renderResults(order, p);
    const u = paramOf(p.x, p.z, p.y) / T.TOTAL;
    const sector = T.def.sectors?.filter(([start]) => u >= start).at(-1);
    if (sector) $('mm-sub').textContent = sector[1];
  }
  minimap.draw(race.cars, lapProgress, race.mirror);

  race.shake = Math.max(0, race.shake - dt * 2);
  followCam(race.camera, 'camPos', p, playerInput(1).look, dt);
  if (race.p2) followCam(race.camera2, 'camPos2', race.p2, playerInput(2).look, dt);
  const fx = Math.sin(p.h), fz = Math.cos(p.h);
  if (race.rain.lines.visible || race.rain.snow.visible) race.rain.update(p.x + fx * 10, p.y, p.z + fz * 10, race.clock, dt);
  const sunlight=T.def.drivingEffects?T.def.palette?.sunDirection:null;
  race.sun.position.set(p.x+(sunlight?.x??-.6)*50,p.y+(sunlight?.y??.8)*50,p.z+(sunlight?.z??.5)*50);
  race.sun.target.position.set(p.x, p.y, p.z);
}

// Loaded on race entry so camera prototypes do not increase garage first load.
let followCam;

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
    const names = { cohete: loc('¡Cohete!'), chancleta: loc('¡La chancleta viene por ti!'), mango: loc('¡Mango!') };
    $('incoming-text').textContent = names[threat.f.kind] || loc('¡Cuidado!');
    const rel = Math.atan2(threat.dx, threat.dz) - p.h;
    $('incoming-arrow').style.transform = `rotate(${(race.mirror ? 1 : -1) * rel}rad)`;
  } else if (p.rainIn > 0) $('incoming-text').textContent = loc('Aguacero en {s} s', { s: Math.ceil(p.rainIn) });
  // Lap splits: a new lap shows its time; the best one gets a shout.
  if (race.mode !== 'battle' && p.lap > race.lapSeen && p.lap <= race.laps + 1) {
    race.lapSeen = p.lap;
    const { lap, best } = lapSplit(race.splits, race.clock);
    if (best && race.splits.length > 1) shout(loc('¡Vuelta rápida! {time}', { time: clockText(lap) }), { tone: 'teal' });
    race.bestLap = Math.min(race.bestLap ?? Infinity, lap);
    $('lap-best').textContent = clockText(race.bestLap);
    $('best-pill').hidden = false;
  }
}

function showP2(order) {
  const p2 = race.p2, place = order.indexOf(p2) + 1, item = activeItem(p2);
  $('p2-pos').innerHTML = `${place}<sup>º</sup>`;
  $('p2-lap').textContent = race.mode === 'battle' ? loc('Globos {n}/{total}', { n: p2.balloons, total: BALLOONS }) : loc('Vuelta {n}/{total}', { n: Math.min(race.laps, Math.max(1, p2.lap)), total: race.laps });
  $('p2-item').textContent = item ? (item.rolling > 0 ? loc('Abriendo…') : ITEMS[item.kind].name) : loc('Sin objeto');
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
    const label = item ? item.rolling > 0 ? loc('Abriendo…') : ITEMS[item.kind].name : loc('Vacío');
    $('item-icon-' + i).innerHTML = item ? item.rolling > 0 ? ICONS[Math.floor(item.rolling * 12) % ICONS.length] : ITEMS[item.kind].icon : '+';
    $('item-n-' + i).textContent = item?.n > 1 ? `×${item.n}` : '';
    $('item-label-' + i).textContent = label;
    const slot = $('item-slot-' + i);
    slot.classList.toggle('selected', selected);
    slot.classList.toggle('rolling', !!(item && item.rolling > 0));
    slot.dataset.rarity = item && item.rolling <= 0 ? (isJuiced(p) ? 'gold' : ITEMS[item.kind]?.rarity || 'blue') : '';
    slot.setAttribute('aria-pressed', String(selected));
    slot.setAttribute('aria-label', selected ? loc('Objeto {n}: {item}, equipado', { n: i + 1, item: label }) : loc('Objeto {n}: {item}, seleccionar', { n: i + 1, item: label }));
    slot.disabled = !item || p.done;
  });
  const item = activeItem(p), ready = item && item.rolling <= 0 && !p.done && p.spin <= 0;
  const status = p.itemMessageT > 0 ? p.itemMessage : canBlock(p) ? loc('Mango equipado · bloquea un mangazo') : '';
  if ($('item-status').textContent !== status) $('item-status').textContent = status;
  $('item').classList.toggle('protected', canBlock(p));
  $('throw-front').disabled = $('throw-back').disabled = !ready;
  const aimed = !item || AIMED.has(item.kind);
  $('throw-front').querySelector('span').textContent = item?.kind?.startsWith('jugo') ? loc('Beber') : aimed ? loc('Adelante') : loc('Usar');
  $('throw-back').disabled = !ready || !aimed;
  $('swap-item').disabled = !p.inventory[1 - p.selected] || p.done;
  $('coin-count').textContent = String(p.coins).padStart(2, '0');
  $('coin-bonus').textContent = loc('+{pct}% velocidad', { pct: formatNumber(Number((p.coins * COIN_SPEED * 100).toFixed(1))) });
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
  $('cup-title').textContent = race.cup.definition.name + ' · ' + (session.status === 'complete' ? loc('Final') : loc('Carrera {n} de 4', { n: viewStage + 1 }));
  const colors = new Map(race.cars.map(c => [c.entrantId || c.netId, c.def.color]));
  const myId = race.player?.entrantId || race.player?.netId || net?.id || LOCAL_PLAYER;
  fillRoster($('cup-board'), view.map((r, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.setProperty('--c', colors.get(r.id) || CARS[r.entrant.loadout.car]?.color || '#fff');
    const details = [
      loc('+{n} pts', { n: r.racePoints }),
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
      end: loc('{n} pts', { n: r.points }),
      score: true,
      className: r.rankChange > 0 ? 'rank-up' : r.rankChange < 0 ? 'rank-down' : '',
    };
  }));
  $('cup-next').textContent = nextStageText(race.cup.definition, session, race.intermission, id => getTrack(id).name);
}

function finish() {
  race.state = 'end';
  driftCombo.finish(race.player);   // bank a live chain so the results count it
  const ghost = race.recorder.finish(); race.lapRecord ||= !!ghost?.saved;
  if (ghost?.saved) {
    shout(loc('¡Nuevo fantasma! Tu mejor vuelta corre contigo'));
    const lapMs = Math.round(ghost.best * 1000), trackId = T.id;   // stats load lazily: the garage's first load is capped
    import('/engine/stats.js').then(m => m.statRecord(`carreritas.best-lap:${trackId}`, lapMs, { better: 'min' }));
  }
  if (race.netRace && net?.cup) {
    race.cup = { definition: cupById(net.cup.cupId), session: net.cup, mirror: false };
  }
  const p = race.player ?? { done: false, time: 0, lost: 0, coinsCollected: 0, def: CARS[garage.index] ?? CARS[0], netId: net?.id, entrantId: net?.id };
  // A racer the room timed out has no time of its own: everyone finished ahead.
  const ahead = (c) => c.done && (!p.done || c.time < p.time);
  const place = 1 + race.cars.filter((c) => c !== p && ahead(c)).length;
  const winner = race.cars.filter(ahead).sort((a, b) => a.time - b.time)[0];
  $('result-title').textContent = p.dns ? loc('No saliste a tiempo (DNS)') : !p.done ? loc('Se acabó el tiempo') : place === 1 ? loc('¡Ganaste!') : loc('{n}º lugar', { n: place });
  $('result-time').textContent = `${T?.name || ''} · ${locn(race.laps, '{n} vuelta', '{n} vueltas')} · ${p.done && !p.dns ? clockText(p.time) : loc('sin terminar')} · ${p.def.name} · ${locn(p.lost || 0, '{n} piezas perdidas', '{n} piezas perdidas')}`
    + (winner && place > 1 ? ' · ' + loc('ganó {name}', { name: winner.name }) : '');
  if (race.bestLap != null) $('result-time').textContent += ' · ' + loc('mejor vuelta {time}', { time: clockText(race.bestLap) });
  if (race.p2) $('result-time').textContent += ' · ' + loc('Jugador 2: {n}º', { n: standings().indexOf(race.p2) + 1 });
  if (race.mode === 'battle') {
    const order = standings(), rank = order.indexOf(p) + 1;
    $('result-title').textContent = p.balloons > 0 && rank === 1 ? loc('¡Ganaste la batalla!') : p.balloons > 0 ? loc('{n}º lugar', { n: rank }) : loc('¡Sin globos!');
    $('result-time').textContent = `${T.name} · ${loc('batalla de globos')} · ${locn(p.balloons, '{n} globo', '{n} globos')} · ${p.def.name}`
      + (p.balloons === 0 ? ' · ' + loc('aguantaste {time}', { time: clockText(p.outAt ?? race.clock) }) : '');
  }
  const won = race.mode === 'battle' ? p.balloons > 0 && standings()[0] === p : p.done && !p.dns && place === 1;
  if (won) driftFeats.win();
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
      $('result-title').textContent = cupPlace === 0 ? loc('¡Ganaste la {cup}!', { cup: race.cup.definition.name }) : loc('{n}º en la {cup}', { n: cupPlace + 1, cup: race.cup.definition.name });
      if (trophy) $('result-time').textContent += ' · ' + loc('trofeo de {trophy}', { trophy: trophyName(trophy) });
      const tiedPodium = cupRows.slice(0, 3).find(row => row.decidedBy);
      if (tiedPodium) $('result-time').textContent += ` · ${tiebreakText(tiedPodium.decidedBy)}`;
    }
    if (race.p2) {
      const p2CupPlace = championshipStandings(session).findIndex(row => row.id === LOCAL_GUEST);
      if (p2CupPlace >= 0) $('result-time').textContent += ' · ' + loc('Copa Jugador 2: {n}º', { n: p2CupPlace + 1 });
    }
  }
  renderCup();
  const myId = p.entrantId || p.netId || net?.id || LOCAL_PLAYER;
  if (settleRace({ race, profile, player: p, order: standings(), track: T, myId,
    trophy: race.cup ? cupTrophy(race.cup.session, myId) : null, record: race.lapRecord })) saveWallet();
  if (race.netRace) updateResultActions(net.state);
  else {
    $('again').textContent = race.cup ? (race.cup.session.status === 'complete' ? loc('Otra copa') : loc('Siguiente pista')) : loc('Otra vez');
    $('again').disabled = false; $('back').textContent = loc('Garaje');
  }
  race.resultKey = '';
  renderResults(standings(), p);
  $('result').classList.remove('hidden');
  race.screens.finish({ player: p, track: T, earned: race.earned || 0, balance: wallet.coins, best: race.bestLap, place, detail: race.rewardDetail });
  $('again').focus({ preventScroll: true });
}

// Refresh the visible classification as rivals finish.
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
  const key = `${cupFinal}:${stageMap?.size || 0}:${displayOrder.map(c => `${c.entrantId || c.netId || c.name}:${c.done}:${c.balloons}:${driftCombo.totalOf(c)}`).join()}`;
  if (key === race.resultKey) return;
  race.resultKey = key;
  const myId = player?.entrantId || player?.netId || net?.id || LOCAL_PLAYER;
  // Style is additive flavour: the classification order never changes, only a
  // detail line per scorer and the Rey del Derrape tag for the best one.
  const styleBest = displayOrder.reduce((best, c) => Math.max(best, driftCombo.totalOf(c)), 0);
  const hitsBest = displayOrder.reduce((best, c) => Math.max(best, c.hits || 0), 0);   // El Chocón: most hits (walls, cars, props), 5 or more
  fillRoster($('result-board'), displayOrder.map((c, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.setProperty('--c', c.def.color);
    const id = c.entrantId || c.netId;
    const rec = stageMap?.get(id);
    const endText = race.mode === 'battle'
      ? locn(c.balloons, '{n} globo', '{n} globos')
      : rec
        ? `${rec.classification === 'finished' ? clockText(rec.time ?? c.time) : CLASSIFICATION_TEXT[rec.classification] ?? loc('Sin terminar')} · ${loc('+{n} pts', { n: rec.points })}`
        : c.done ? clockText(c.time) : loc('vuelta {n}/{total}', { n: Math.min(race.laps, Math.max(1, c.lap)), total: race.laps });
    const style = driftCombo.totalOf(c);
    const king = style > 0 && style === styleBest, chocon = hitsBest >= 5 && c.hits === hitsBest;
    const level = nivelOf(c.tunes?.car ?? c.tune ?? c.def.tune);
    const detail = [loc('Nivel {band} {n}', { band: bandOf(level).letter, n: level }), style > 0 && (king ? loc('Estilo: {n} pts · ¡Rey del Derrape!', { n: style }) : loc('Estilo: {n} pts', { n: style })), chocon && loc('El Chocón: {n} choques', { n: c.hits })].filter(Boolean).join(' · ');
    return {
      rank: i + 1, lead: chip, name: c.name, me: c === player || (id && id === myId), end: endText,
      detail: detail || null,
      className: [king && 'style-king', chocon && 'chocon'].filter(Boolean).join(' '),
    };
  }));
  race.screens.rows?.(displayOrder,player);
}

// ======================================================================
// Online (online.js + server/room.js). Remote cars are kinematic: they
// follow their owner's poses about 110 ms behind, never local physics.
// ======================================================================
// Poses carry the sender's estimate of server time, so bursts from a slow
// frame still interpolate evenly. The delay follows each sender's own rate.
const { sendPoses, resumePose, applyRemote, onNetPose, onNetFx, racerById } = createRemoteCars({ race, link: () => net, popPart, lines: LINES });

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
  if (!s.racers || !net) return;   // the room's first state has not arrived yet
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
    `<li class="pk-row${p.id === net.id ? ' is-me' : ''}${p.connected ? '' : ' away'}" translate="no"><span class="pk-row-n">${p.id === s.host ? SVG.crown : i + 1}</span>`
    + `<span class="chip" style="--c:${CARS[p.car]?.color || '#fff'}"></span>${esc(p.name)}`
    + `<span class="pk-row-end">${p.connected ? esc(CARS[p.car]?.name || '') : loc('reconectando…')}</span></li>`).join('');
  const gridTarget = cup ? GP_GRID : 4;
  const bots = Math.max(0, (s.bots ? Math.max(gridTarget, s.players.length) : s.players.length) - s.players.length);
  $('launch-note').innerHTML = `<span class="pk-dot"></span>${locn(s.players.length, '{n} pana', '{n} panas')}${bots ? ` + ${locn(bots, '{n} rival', '{n} rivales')}` : ''}`;
  $('lobby-bots').checked = s.bots;
  $('lobby-bots').disabled = !host || live;
  $('t-prev').disabled = $('t-next').disabled = !host || live || !!cup;
  renderSetup();
  const hostName = s.players.find(p => p.id === s.host)?.name || loc('el anfitrión');
  if (s.notice) {
    $('lobby-status').textContent = loc(s.notice);
  } else if (live) {
    if (myRacer?.dns) $('lobby-status').textContent = loc('No cargaste a tiempo esta etapa (DNS). Entras en la siguiente pista.');
    else if (racing) $('lobby-status').textContent = loc('Tu carrera sigue en curso.');
    else if (cup) $('lobby-status').textContent = loc('Campeonato en curso: espectador hasta la próxima copa.');
    else $('lobby-status').textContent = loc('Carrera en curso: entras en la próxima.');
  } else {
    $('lobby-status').textContent = host
      ? (cup ? loc('Tú eliges la copa ({cup}) y das la salida.', { cup: cup.name }) : loc('Tú eliges la pista y das la salida.'))
      : (cup ? loc('{name} preparó la {cup}.', { name: hostName, cup: cup.name }) : loc('{name} elige la pista y da la salida.', { name: hostName }));
  }
  const canRejoinStage = live && myRacer && !myRacer.retired && !myRacer.dns && mode === 'garage';
  $('play').textContent = canRejoinStage ? loc('Entrar a la pista') : host ? (live ? loc('Carrera en curso') : loc('¡Vámonos!')) : live ? loc('Carrera en curso') : loc('Esperando a {name}', { name: hostName });
  $('split').closest('label').hidden = s.players.length > 1; $('start').disabled = !host; $('start').textContent = host ? loc('¡Arrancar!') : loc('Esperando a {name}', { name: hostName }); menuFlow?.enter(s.garage || live ? 'garage' : 'lobby');
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
    $('again').textContent = host ? loc('Siguiente pista') : loc('Siguiente pista pronto…');
    $('again').disabled = !host || waitReadWindow;
  } else if (inCupComplete) {
    $('again').textContent = host ? loc('Otra copa') : loc('Esperando al anfitrión');
    $('again').disabled = !host || !['results', 'complete'].includes(s.phase);
  } else {
    $('again').textContent = host ? loc('Otra carrera') : loc('Esperando al anfitrión');
    $('again').disabled = !host || s.phase !== 'results';
  }
  $('back').textContent = host && ['results', 'complete'].includes(s.phase) ? loc('Sala') : loc('Garaje');
}

function inviteLink() {
  return inviteUrl(net?.code || ROOM || newRoomCode());
}

let joining = null, markBooted;
const booted = new Promise(resolve => { markBooted = resolve; });   // room state waits for the garage and menu
async function goOnline(code, lead) {
  if (net || joining) return joining;
  $('lobby').hidden = false;
  $('go-online').hidden = true;
  $('setup').hidden = false;
  $('lobby-code').textContent = code;
  $('lobby').dataset.failed = 'false'; $('lobby-status').textContent = loc('Conectando con la sala…');
  $('play').disabled = true;
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  url.searchParams.delete('lead');
  history.replaceState(null, '', url);
  joining = (async () => {
    try {
      const { joinRace } = await (onlineModulePromise || import('./online.js'));
      net = await joinRace({ code, lead, name: ME.name, avatar: ME.avatar, car: garage.index, wheel: garage.wheel, cosmetics: raceStyle(garage.index) }).then(link => booted.then(() => link));
    } catch (error) {
      $('lobby').dataset.failed = 'true'; console.warn('Carreritas online unavailable', error);
      $('lobby-status').textContent = error?.full ? loc('La sala está llena.') : loc('No pudimos entrar a la sala. Puedes correr en local.');
      $('play').disabled = false;
      $('play').textContent = loc('¡Vámonos!');
      $('lobby-solo').hidden = false;
      return null;
    } finally { joining = null; menuFlow?.refresh(); }
    net.on('state', onNetState);
    net.on('pose', onNetPose);
    net.on('fx', onNetFx);
    net.on('status', (text, bad) => {
      $('net-status').textContent = text;
      $('net-status').hidden = !text;
      $('net-status').classList.toggle('bad', !!bad); document.dispatchEvent(new Event('pana:sala-update'));
    });
    net.on('left', () => { document.dispatchEvent(new Event('pana:sala-update'));
      $('lobby-status').textContent = loc('Saliste de la sala. Recarga para volver a entrar.');
      $('lobby-solo').hidden = false;
    });
    net.pick(garage.index, garage.wheel, raceStyle(garage.index));   // a car picked while connecting
    onNetState(net.state);
    return net;
  })();
  return joining;
}

// ======================================================================
let mode = 'garage';
const clock = new THREE.Timer().reset();
const STEP = 1 / 60;
let acc = 0;

const FINE_POINTER = matchMedia('(pointer: fine)').matches;
function frame() {
  const dt = Math.min(clock.update().getDelta(), 0.25); menuFlow?.sync(mode);
  if (mode === 'garage' && (!menuFlow || menuFlow.step === 'car')) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    updateGarage(dt);
    // A soft bloom on lamps and the ring, unless the quality is set low.
    // Phones skip it: their high pixel ratio smears the glow.
    if (getSettings().detail !== 'baja' && FINE_POINTER) (garage.bloom ??= garageBloom(renderer, garage.scene, garage.camera)).render();
    else renderer.render(garage.scene, garage.camera);
  } else if (mode === 'race') {
    renderer.toneMapping = THREE.NoToneMapping;
    pollPads();
    // fixed physics steps: same race speed at any frame rate
    race.slowMo.update(dt);
    const budget = physicsFrame(acc, paused ? 0 : dt, SPEED, race.netRace ? 1 : race.slowMo.scale);
    acc = budget.remainder;
    let stepped = 0;
    for (let i = 0; i < budget.steps && mode === 'race'; i++) {
      updateRace(STEP, false);
      stepped += STEP;
    }
    if (stepped && mode === 'race') presentRace(stepped);
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

if (DEBUG) Object.assign(window, { sound, loadTrack, disposeRacer, makeRacer, placeRacer, aiInput, stepRescue, collidePair, sendPoses, pollPads, music, getWallet: () => wallet, taller, menu, race, garage, renderer, crash, stepCar, startRace, updateRace, presentRace, finish, renderResults, renderCup, toGarage, showWheel, ITEMS, TRACKS, buildTrack, setup, popBalloon, rescue, getDriftFeats: () => driftApi, getActiveTrack: () => T, getGates: () => gatesApi, exportGhost: (id = T.id) => ghostIO?.downloadGhost(id, { by: 'jhd3197 (dev)', car: CARS[garage.index].id, avatar: ME.avatar }, profileStorage), getNet: () => net });
// ?track=desierto wins; otherwise the last pick, otherwise the estadio
let savedTrack = 'estadio';
try { savedTrack = localStorage.getItem('carreritas:track') || localStorage.getItem('derrape:track') || savedTrack; } catch { /* private mode */ }
// The cauchos from the last visit (fallback calle) dress the turntable car.
garage.wheel = wheelById(wallet.wheel).id;   // the profile migrated any old 'carreritas:wheels' pick
garage.index = Math.max(0, CARS.findIndex(c => c.id === wallet.car));   // the room join below sends this car
if (ROOM) goOnline(ROOM, QS.get('lead') ?? '');   // first: a reload reclaims its seat inside the reconnection window
// Suites call buildTrack() and read TRACKS synchronously: every map loads before
// PANA_PREPARED (showCar below). startRace() loads its own map either way.
await Promise.all([featsReady, comboReady, ghostReady, gatesReady]);   // milestone toasts, the style score and the ghost are ready before any race can start
if (DEBUG) await loadTracks();
selectTrack(QS.get('track') || savedTrack);
showCar(garage.index);
frame();
let lastGarageInput = performance.now();
for (const event of ['pointerdown', 'wheel', 'keydown']) {
  addEventListener(event, () => { lastGarageInput = performance.now(); }, { passive: true });
}
renderer.domElement.addEventListener('pointermove', event => {
  if (event.buttons) lastGarageInput = performance.now();
});
cards = garageCards(CARS, garageCar,
  () => mode === 'garage' && performance.now() - lastGarageInput > 350);
cards.ready.catch(error => console.warn('Garage previews unavailable', error));
showWheel(garage.wheel);
renderSetup();
saveWallet();
menuFlow = createMenuFlow({
  tracks: TRACKS, openTaller: openShop, pickTrack: switchTrack, start: () => { if(net?.link.left){net=null;history.replaceState(null,'',location.pathname);} return net ? net.garage(true) : menuFlow.enter('garage'); }, back: () => net ? net.garage(false) : menuFlow.enter('lobby'),
  prepared: Promise.all([cards.ready, renderer.compileAsync(garage.scene, garage.camera)]).then(() => renderer.render(garage.scene, garage.camera)),
  getState: () => {
    const activeMode = net?.state?.mode || setup.mode;
    return { track: TRACKS[trackIndex], trackSummary: $('track-blurb').textContent, car: CARS[garage.index], wheel: wheelById(garage.wheel),
      mode: activeMode, cup: isCupMode(activeMode) ? cupById(activeMode) : null,
      online: !!net || !!joining, split: setup.split, boat: wallet.boat, air: wallet.air, sala: { connection: joining ? 'connecting' : net?.link.left ? 'offline' : net && $('net-status').classList.contains('bad') ? 'connecting' : net ? 'online' : $('lobby').dataset.failed === 'true' ? 'offline' : 'local', players: net?.state.players || [], local: { def: CARS[garage.index], wheel: garage.wheel, cosmetics: raceStyle(garage.index) }, cars: CARS },
      canConfigure: !net || (net.isHost && ['lobby', 'results', 'complete'].includes(net.state?.phase)) };
  },
});
markBooted(); export const sceneReady = Promise.race([menuFlow.ready, new Promise(go => { const t = setInterval(() => { if (mode !== 'garage') { clearInterval(t); go(); } }, 200); })]);   // the shared lobby waits for the garage, or a race rejoined after a reload
onSettings((s, changed) => { if (changed.includes('detail') || changed.includes('shadows')) applyRaceQuality(renderer, race, s); });
