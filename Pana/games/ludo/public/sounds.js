// Short, synthesized cues through the shared voice budget and master volume.
// No separate AudioContext, timers, asset downloads or gameplay randomness.
export function createLudoSounds(sound, { audible = () => true } = {}) {
  const ready = () => audible() && !sound.muted && sound.volume > 0;
  function notes(frequencies, gap = .075, volume = .045) {
    frequencies.forEach((frequency, i) => sound.tone(frequency, i * gap, .12, 'triangle', volume, 2));
  }
  function sweep(from, to, duration = .2, volume = .045) {
    sound.sweep(from, to, duration, 'sine', volume, 2);
  }
  return {
    shake(power) { if (ready()) sound.tone(310 + power * 160, 0, .045, 'triangle', .025); },
    throw(power) { if (ready()) sweep(430 + power * 220, 160, .22, .055); },
    bounce(strength) {
      if (!ready()) return;
      sound.tone(145 + strength * 95, 0, .06, 'triangle', .025 + strength * .04);
      sound.tone(660 + strength * 170, 0, .045, 'sine', .012 + strength * .015);
    },
    result(value) {
      if (!ready()) return;
      notes(value === 6 ? [659, 831, 988] : [440 + value * 45], .065, .045);
    },
    step(index = 0) { if (ready()) sound.tone(440 + Math.min(index, 6) * 35, 0, .055, 'triangle', .028); },
    land({ entry = false, home = false, capture = false, win = false } = {}) {
      if (!ready()) return;
      if (win) notes([523, 659, 784, 1047, 784, 1047], .105, .06);
      else if (home) notes([523, 659, 784, 1047], .085, .05);
      else if (capture) { sweep(180, 720, .18, .07); notes([784, 988], .09, .04); }
      else if (entry) notes([392, 523], .075, .045);
      else sound.tone(330, 0, .08, 'triangle', .045);
    },
    returnHome() { if (ready()) sweep(360, 110, .15, .045); },
    moment(kind) {
      if (!ready()) return;
      const melodies={intro:[392,523,659],turn:[523,784],suspense:[196,208],safe:[784,1047],block:[220,294],leap:[392,784],sprint:[440,660,880],nearmiss:[660,440],nomoves:[330,294,220],sleep:[196,147],podium:[523,659,784,1047]};
      if(melodies[kind])notes(melodies[kind],kind==='suspense'?.18:.095,kind==='sleep'?.02:.04);
    },
    trick(style) {
      if (!ready()) return;
      switch (style) {
        case 'leap': sweep(220, 950, .22); break;
        case 'sprint': sweep(280, 760, .25); break;
        case 'highfive': notes([660, 880], .08); break;
        case 'slip': sweep(1000, 180, .32); break;
        case 'rollbarrel': notes([220, 260, 220, 260], .055, .025); break;
        case 'moonwalk': notes([440, 392, 330], .09, .035); break;
        case 'spring': sweep(180, 950, .24); break;
        case 'dodge': sweep(800, 230, .14); break;
        case 'piggy': notes([294, 392, 294, 440], .1, .035); break;
        case 'umbrella': sweep(330, 880, .4, .03); break;
        case 'tunnel': sweep(260, 95, .28); break;
        case 'gum': sweep(150, 650, .35); break;
      }
    },
  };
}
