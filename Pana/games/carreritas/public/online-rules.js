// Shared by the Carreritas room (server) and online.js (browser): plain data and
// pure functions only, no Three.js and no DOM.

import { CAR_DEFINITIONS } from './car-definitions.js';
import { TRACK_DEFINITIONS } from './track-definitions.js';
import { WHEEL_DEFINITIONS } from './wheel-definitions.js';
import { PAINTS, HORNS, FLAMES } from './shop.js';
import { cleanParts } from './parts.js';
import { BOAT_DEFINITIONS, AIR_DEFINITIONS, cleanVesselParts, kitTunes } from './parts.js';

export { kitTunes };

export const LAPS = 3;
export const lapsForTrack = id => TRACK_DEFINITIONS.find(t=>t.id===id)?.defaultLaps ?? LAPS;
export const MIN_GRID = 4;               // bots fill the grid up to four racers
export const GP_GRID = 8;                // Grand Prix defaults to eight racers
export const POSE_HZ = 20;
export const COUNTDOWN_MS = 3500;        // "3" shows a little longer than the rest
export const LOAD_TIMEOUT_MS = 30000;
export const GP_LOAD_TIMEOUT_MS = 60000;
export const FINISH_GRACE_MS = 40000;    // after the first finish, stragglers get this long
export const GP_INTERMISSION_MS = 12000;
export const GP_MIN_READ_MS = 5000;
export const GP_PROTOCOL = 2;

export const RIVALS = ['Don Pancho', 'La Chama', 'El Gocho', 'Tía Carmen', 'El Catire', 'Yoli', 'El Pelúo', 'La Nena']; // i18n-ignore: rival names are names
// Thematic cauchos per car, so rival loadouts show up in every race.
export const AI_WHEELS = { chamo: 'calle', lancha: 'lluvia', machito: 'barro', bala: 'slick', toro: 'barro', familiar: 'lluvia', rumbera: 'palo', montanero: 'barro',
  escarabajo: 'calle', sedan: 'calle', buseta: 'lluvia', pickup: 'barro', jeep: 'barro', hatch: 'slick', rustico: 'barro', malibu: 'slick' };

export const CAR_COUNT = CAR_DEFINITIONS.length;
export const TRACK_IDS = TRACK_DEFINITIONS.map(t => t.id);
export const WHEEL_IDS = WHEEL_DEFINITIONS.map(w => w.id);

export const cleanCar = (n) => Number.isInteger(n) && n >= 0 && n < CAR_COUNT ? n : 0;
export const cleanWheel = (id) => WHEEL_IDS.includes(id) ? id : 'calle';
export const cleanTrack = (id) => TRACK_IDS.includes(id === 'playa' ? 'bululu' : id) ? (id === 'playa' ? 'bululu' : id) : TRACK_IDS[0];
export const cleanDifficulty = (id) => ['facil', 'normal', 'dificil'].includes(id) ? id : 'normal';
export function cleanCosmetics(value) {
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{value=null;}}
  // Taller parts ride along only when set; unknown slots or ids are dropped.
  const parts=cleanParts(value?.parts);
  const boatParts=cleanVesselParts('boat',value?.boatParts), airParts=cleanVesselParts('air',value?.airParts);
  return {...(/^#[0-9a-f]{6}$/i.test(value?.paintColor) ? {paintColor:value.paintColor} : {}),paint:PAINTS.some(p=>p.id===value?.paint)?value.paint:'fabrica',
    horn:HORNS.some(h=>h.id===value?.horn)?value.horn:'propio',
    flame:FLAMES.some(f=>f.id===value?.flame)?value.flame:'fuego',
    ...(BOAT_DEFINITIONS.some(v=>v.id===value?.boat)&&value.boat!=='penero'?{boat:value.boat}:{}),
    ...(AIR_DEFINITIONS.some(v=>v.id===value?.air)&&value.air!=='zamuro'?{air:value.air}:{}),
    ...(Object.keys(parts).length?{parts}:{}),
    ...(Object.keys(boatParts).length?{boatParts}:{}),
    ...(Object.keys(airParts).length?{airParts}:{})};
}

// Bots race their own little kits: each car id picks a lancha and an avioneta
// deterministically, so rival loadouts (and their nivels) show up everywhere.
const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export const aiVessels = (carId) => ({
  boat: BOAT_DEFINITIONS[hash(`${carId}:lancha`) % BOAT_DEFINITIONS.length].id,
  air: AIR_DEFINITIONS[hash(`${carId}:avioneta`) % AIR_DEFINITIONS.length].id,
});

// A pose is a flat array so 20 Hz updates stay small:
// [x, y, z, h, pitch, roll, vf, steer, spin, boost, flags, lap, prog, lost, coins]
export const POSE_LENGTH = 15;
export const FLAG = { ground: 1, dizzy: 2, open: 4, full: 8, done: 16, drift: 32, driftRight: 64, shield: 512, phase: 1024 };
// Drift charge level 0..3 rides in two more flag bits (×128).
export const DRIFT_SHIFT = 7;

const r2 = (v) => Math.round(v * 100) / 100;
export function packPose(c) {
  const flags = (c.onGround ? FLAG.ground : 0) | (c.dizzy > 0 ? FLAG.dizzy : 0)
    | (c.scream > 0 || c.honkT > 0 || (!c.onGround && c.airTime > 0.3) ? FLAG.open : 0)
    | (!c.inventory?.includes(null) ? FLAG.full : 0) | (c.done ? FLAG.done : 0)
    | (c.drift ? FLAG.drift | (c.drift < 0 ? FLAG.driftRight : 0) | ((c.driftLvl || 0) << DRIFT_SHIFT) : 0)
    | (c.shield > 0 ? FLAG.shield : 0) | (c.phaseT > 0 || c.rescueT > 0 ? FLAG.phase : 0);
  return [r2(c.x), r2(c.y), r2(c.z), r2(c.h), r2(c.pitch), r2(c.roll), r2(c.vf), r2(c.steer),
    r2(c.spin), r2(c.boost), flags, c.lap, Math.round(c.prog), c.lost, c.coins || 0];
}

// Server-side check: finite numbers of the right count, nothing else.
export function validPose(p) {
  return Array.isArray(p) && p.length === POSE_LENGTH && p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6);
}

// Grid slot -> lane and row, two by two like the local race.
export const gridSlot = (slot) => ({ lane: slot % 2 ? -3.5 : 3.5, row: Math.floor(slot / 2) });
