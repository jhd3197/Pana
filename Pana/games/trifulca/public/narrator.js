// The TV narrator and the ref: what they shout for each fight event, plus
// the ringside sounds (gloves, the bell, the crowd). Lines come from the
// event; the voice uses the browser's Spanish speech when sound is on.
import { sound } from '/engine/fx.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const LINES = {
  bell: ['¡Sonó la campana!', '¡A pelear, panas!', '¡Arrancó la trifulca!'],
  trompon: ['¡Toma la metralla!', '¡Trompa que viene, trompa que baja!', '¡Se está yendo con todo!', '¡Pega en duro, hermano!', '¡Qué trompón!'],
  counter: ['¡Contragolpe!', '¡Le ganó de mano!', '¡Lo agarró cargando!'],
  dizzy: ['¡Está viendo estrellitas!', '¡Está mareado, mareado!', '¡Se le movió el piso!'],
  caida: ['¡Al suelo!', '¡Te dieron!', '¡Pa\' la lona!', '¡Cayó como mango maduro!'],
  rise: ['¡Se paró!', '¡Elévalo!', '¡Todavía hay pana!'],
  dodged: ['¡Lo esquivó!', '¡Pasó rozando!', '¡Le dio al aire!'],
  shove: ['¡Pa\' fuera!', '¡Lo mandó pa\'l público!', '¡Empujón!'],
  guardbreak: ['¡Le rompió la guardia!', '¡Se le cayeron los brazos!'],
  vecino: ['¡Un vecino lo devuelve!', '¡La señora lo empujó pa\' dentro!', '¡El barrio lo devuelve!'],
  moto: ['¡Pasó una moto!', '¡Cuidado con la moto!', '¡Moto, moto, moto!'],
  clinch: ['Ya, vaya.', '¡Sepárense!', 'Ya, ya, suéltense.'],
  taunt: ['¡Dale, dale!', '¡Se está luciendo!'],
  ropes: ['¡A las cuerdas!', '¡Rebotó en las cuerdas!'],
  domino: ['¡Se cayeron todas las motos!', '¡Dominó de motos!'],
  cajas: ['¡Se vinieron abajo las cajas!', '¡Tomates por todos lados!'],
  campana: ['¡Campana! Los jueces leen la tarjeta…', '¡Se acabó el tiempo!'],
  toro: ['¡Se soltó el toro!', '¡Toro, toro, toro!', '¡Abrieron la manga!'],
  balde: ['¡Le echaron un balde de agua!', '¡La señora del balcón!', "¡Agua fría pa'l mareo!"],
  pito: ['¡Pííí! ¡Pasó la buseta!', '¡Cuidado, que viene la camionetica!'],
  throw: ['¡Ahí va la silla!', '¡Lo lanzó!', '¡Vuela, vuela!'],
  impacto: ['¡Se la estrelló!', '¡En toda la cara!', '¡Silletazo!'],
  relevo: ['¡Relevo!', '¡Entra la pareja!', '¡Cambio de esquina!'],
  fuera: ['¡Fuera de la trifulca!', "¡Se acabó pa' ese!"],
};

// The narrator's line for an event, given names: (id) → name.
export function lineFor(e, name, names = (ids) => ids.map(name).join(' y ')) {
  switch (e.type) {
    case 'dodged': return { text: '¡Lo esquivó! ¡Contragolpe!', say: Math.random() < .4 };
    case 'intro': return { text: e.stage === 'final' ? '¡La gran final!' : e.stage === 'semifinal' ? 'Semifinal' : e.stage === 'cuartos' ? 'Cuartos de final' : e.mode === 'libre' ? '¡Trifulca libre!' : `Pelea ${e.fight}`, big: true };
    case 'bell': return { text: pick(LINES.bell), big: true, say: true };
    case 'trompon': return { text: pick(LINES.trompon), say: Math.random() < .6 };
    case 'hit': return e.contra ? { text: '¡Contragolpe!', say: true } : e.counter ? { text: pick(LINES.counter) } : null;
    case 'dizzy': return { text: pick(LINES.dizzy), say: true };
    case 'caida': return { text: pick(LINES.caida), say: true };
    case 'rise': return { text: pick(LINES.rise), say: true };
    case 'shove': return { text: e.broke ? '¡Le agarró la guardia y pa\' fuera!' : pick(LINES.shove) };
    case 'guardbreak': return { text: pick(LINES.guardbreak) };
    case 'empujon': return e.back ? { text: `${name(e.by)} lo mete pa' dentro` } : null;
    case 'vecino': return { text: pick(LINES.vecino) };
    case 'moto': return { text: pick(LINES.moto), big: true, say: true };
    case 'toro': return { text: pick(LINES.toro), big: true, say: true };
    case 'balde': return { text: pick(LINES.balde), say: true };
    case 'pito': return { text: pick(LINES.pito), big: true };
    case 'clinch': return { text: pick(LINES.clinch), ref: true, say: true };
    case 'taunt': return { text: pick(LINES.taunt) };
    case 'ropes': return Math.random() < .5 ? { text: pick(LINES.ropes) } : null;
    case 'campana': return { text: pick(LINES.campana), big: true, say: true };
    case 'fin': {
      const w = names(e.winners || [e.winner]), l = name(e.loser);
      const text = { ko: `¡K.O.! ¡Gana ${w}!`, cuenta: `¡Diez! ¡Se acabó! Gana ${w}`, puntos: `10 puntos para ${w}`, publico: `¡Empate en la tarjeta! El público dice: ${w}`,
        calma: `¡Cálmate, cálmate! ${name(e.by)} saca a ${l}`, abandono: `${l} se fue. Gana ${w}` }[e.how] || `Gana ${w}`;
      return { text, big: true, say: true };
    }
    case 'throw': return { text: pick(LINES.throw) };
    case 'impacto': return { text: pick(LINES.impacto), say: Math.random() < .5 };
    case 'pickup': return { text: `${name(e.id)} agarró ${{ silla: 'una silla', caja: 'una caja', casco: 'un casco', chancleta: 'una chancleta' }[e.kind] || 'algo'}` };
    case 'relevo': return { text: `${pick(LINES.relevo)} Entra ${name(e.id)}`, say: true };
    case 'fuera': return { text: `${name(e.id)}: ${pick(LINES.fuera)}`, big: true, say: true };
    case 'mano': return { text: 'Mano de caballero.', ref: true, say: true };
    case 'sinmano': return { text: `${name(e.id)} se fue sin dar la mano…` };
    case 'agua': return { text: `${name(e.by)} le da agua a ${name(e.id)}` };
    case 'noche': return { text: '¡Se acabó la noche!', big: true, say: true };
    default: return null;
  }
}

// ---------- voice ----------
let voice = null;
function findVoice() {
  if (voice || !globalThis.speechSynthesis) return voice;
  const voices = speechSynthesis.getVoices();
  voice = voices.find(v => /es[-_]VE/i.test(v.lang)) || voices.find(v => /es[-_](US|MX|CO|419)/i.test(v.lang)) || voices.find(v => /^es/i.test(v.lang)) || null;
  return voice;
}
export function say(text, { enabled = true, ref = false } = {}) {
  if (!enabled || sound.muted || !globalThis.speechSynthesis || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[¡!¿?…]/g, m => (m === '…' ? '.' : m)));
    const v = findVoice(); if (v) u.voice = v;
    u.lang = v?.lang || 'es-VE'; u.rate = ref ? 1 : 1.18; u.pitch = ref ? .8 : 1.15; u.volume = Math.min(1, sound.volume ?? 1);
    speechSynthesis.speak(u);
  } catch { /* Speech is a nicety; the banner already shows the line. */ }
}
export function hush() { try { globalThis.speechSynthesis?.cancel(); } catch { /* nothing to stop */ } }

// ---------- ringside sounds ----------
function noise(seconds, { freq = 900, q = .7, vol = .2, attack = .05 } = {}) {
  if (!sound.ctx || sound.muted) return;
  const ctx = sound.ctx, t = ctx.currentTime, len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
  const gain = ctx.createGain(); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(vol, t + attack); gain.gain.exponentialRampToValueAtTime(.001, t + seconds);
  src.connect(filter).connect(gain).connect(sound.out()); src.start(t);
}
function bell(times = 3) {
  for (let i = 0; i < times; i++) {
    sound.tone(1320, i * .28, .5, 'sine', .12); sound.tone(1980, i * .28, .35, 'sine', .05); sound.tone(660, i * .28, .6, 'triangle', .05);
  }
}
export const crowd = (power = 1) => noise(1.2 + power * .6, { freq: 1100, q: .5, vol: .09 * power, attack: .15 });

export function sfx(e) {
  if (!sound.ctx || sound.muted) return;
  switch (e.type) {
    case 'hit': sound.bonk(e.counter ? 1.6 : 1); break;
    case 'trompon': sound.bonk(3); sound.sweep(260, 70, .3, 'sine', .2); crowd(1.2); break;
    case 'block': sound.tone(220, 0, .06, 'square', .05); break;
    case 'wind': sound.sweep(180, 420, .5, 'triangle', .05); break;
    case 'jab': case 'dodge': case 'grab': sound.whoosh(); break;
    case 'shove': case 'empujon': sound.bonk(.8); sound.plop(); break;
    case 'dizzy': sound.boing(); break;
    case 'caida': sound.bonk(3.4); sound.boing(); crowd(1.6); break;
    case 'count': sound.tone(e.n >= 8 ? 520 : 440, 0, .12, 'square', .08); break;
    case 'rise': sound.pickup(2); crowd(.8); break;
    case 'bell': case 'campana': bell(e.type === 'bell' ? 1 : 3); break;
    case 'fin': bell(3); crowd(2); break;
    case 'moto': sound.sweep(300, 900, 1.2, 'sawtooth', .04); sound.sweep(900, 200, 1.4, 'sawtooth', .03); break;
    case 'mano': sound.pickup(3); break;
    case 'toro': noise(1.4, { freq: 180, q: .8, vol: .25 }); crowd(2); break;
    case 'balde': sound.splat(); break;
    case 'pito': sound.horn('grave'); break;
    case 'throw': sound.whoosh(); break;
    case 'impacto': sound.bonk(3); sound.splat(); crowd(1.2); break;
    case 'relevo': sound.tone(660, 0, .1, 'square', .07); sound.tone(880, .1, .12, 'square', .07); break;
    case 'fuera': sound.boing(); crowd(1.4); break;
    case 'bet': sound.tick(2); break;
    case 'cheer': case 'taunt': crowd(.6); break;
    case 'noche': sound.horn('fiesta'); break;
    case 'ropes': sound.boing(); break;
    default: break;
  }
}
