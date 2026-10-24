// Content-addressed recordings: editing a prompt cannot play an old recording.
export function voiceKey(text) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

// Labels are separate recordings so shuffled answers always match the screen.
export function narrationLines(question) {
  return [question.text, ...question.answers.flatMap((answer, i) => [`Opción ${'ABCD'[i]}.`, answer])];
}

export const CORRECT_INTRO = 'La respuesta correcta es:';
export function revealLines(question) {
  return [CORRECT_INTRO, `Opción ${'ABCD'[question.correct]}.`, question.answers[question.correct]];
}
