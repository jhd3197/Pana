// The shared sound (engine/fx.js) for games that keep it off their first load:
// settings and menu clicks land on this stand-in until fx.js arrives, and a
// failed import only means silence.
export function lazySound(volume = .8) {
  const play = (name, ...args) => { if (audio.impl) { audio.impl.muted = audio.muted; audio.impl[name]?.(...args); } };
  const audio = {
    muted: false, volume, music: null, unlocked: false, impl: null,
    unlock() { this.unlocked = true; this.impl?.unlock(); },
    setVolume(value) { this.volume = value; this.impl?.setVolume(value); },
    setMusicVolume(value) { this.music = value; this.impl?.setMusicVolume(value); },
    tone: (...args) => play('tone', ...args),
    clickDown: () => play('clickDown'),
    clickUp: () => play('clickUp'),
  };
  import('./fx.js').then(({ sound }) => {
    audio.impl = sound; sound.setVolume(audio.volume);
    if (audio.music != null) sound.setMusicVolume(audio.music);
    if (audio.unlocked) sound.unlock();
  }).catch(() => {});
  return audio;
}
