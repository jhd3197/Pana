// Venezuelan dichos for NPC barks, shared by every game. Pools are grouped by
// mood; each game maps its own events onto them. A line marked `crude` only
// plays when the table opts into "más criollo" (pajúo, pacuso, latazo…).
// Pure data: no DOM, so rules tests can import it.

export const FRASES = {
  saludo: ['Aquí', 'Llevándola', 'Dentro de lo que cabe', 'Tú sabes cómo es', 'En la lucha por la locha'],
  presume: ['¡Vacílate esto!', '¡Pedazo de loco!', '¡Cuarto bate!', '¡Empepao!'],
  aplauso: ['¡La sacaste de jonrón!', '¡Palo!', '¡Es arrecho de verdad, vale!', '¡Pedazo de loco!'],
  sorpresa: ['¡Me agarró fuera de base!', '¡Ñooo!', '¡Epa!', '¡Qué molleja!'],
  queja: ['La masa no está pa\' bollo', 'Estoy arrecho', 'Tú sabes cómo es', 'Llevándola'],
  salado: ['Más salado que pescado en Semana Santa', '¡Qué pavoso!'],
  ñapa: ['¡Con ñapa!', '¡Ñapa pa\' mí!', 'El que no llora no mama'],
  burla: ['Te quedaste sin el chivo y sin el mecate', 'Puro camburipeo', 'No llevas aura'],
  derrota: ['No nos despechamos, nos enguayabamos', 'Te perdiste del mapa', '¡Vamos por la revancha!'],
  cierre: ['Calabaza, calabaza, cada quien para su casa', '¡Se acabó la pea!'],
  sapo: ['¡Sapo!', { text: '¡Pajúo!', crude: true }],
};

const text = line => typeof line === 'string' ? line : line.text;
const allowed = (line, crude) => crude || typeof line === 'string' || !line.crude;

// FNV-1a: every client hashes the same event seed to the same line, so
// barks agree online without sending text over the network.
function hash(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

export function pickLine(pool, seed, { crude = false } = {}) {
  const lines = (Array.isArray(pool) ? pool : FRASES[pool] || []).filter(line => allowed(line, crude));
  return lines.length ? text(lines[hash(seed) % lines.length]) : '';
}
