// The race HUD the river games share (Curiara, Lancha, Galope): the shout
// banner (#call), the photo-finish flash (#flash), camera shake, the start
// countdown (#countdown) and the live leaderboard (#leaderboard).
import { loc } from '../i18n.js';

const $ = id => document.getElementById(id);

export function createRaceHud(sound) {
  let callTimer = 0, shake = 0, shakePower = 0, lastCount = '', lastPhoto = null;
  const hud = {
    call(text, kind = '') {
      const e = $('call'); e.textContent = text; e.className = `call ${kind}`; e.classList.remove('hidden');
      void e.offsetWidth; callTimer = .9;
    },
    flash() {
      const e = $('flash'); e.classList.remove('is-on'); void e.offsetWidth; e.classList.add('is-on');
      sound.tone(1600, 0, .05, 'square', .05);
    },
    shake(time, power = time) { shake = Math.max(shake, time); shakePower = Math.max(shakePower, power); },
    // go: the word shown as the race starts ('¡REMA!').
    countdown(state, go) {
      const count = state.phase === 'countdown' ? String(Math.max(1, Math.ceil(state.countdown))) : state.phase === 'racing' && state.time < .75 ? go : '';
      $('countdown').classList.toggle('hidden', !count); $('countdown').textContent = count;
      if (count && count !== lastCount) sound.tone(count === go ? 740 : 370, 0, .12, 'triangle', .06);
      lastCount = count;
    },
    photoFinish(state) {
      if (!state.photo || state.photo.at === lastPhoto) return;
      lastPhoto = state.photo.at; hud.call(loc('¡Foto finish!'), 'is-teal'); hud.flash();
    },
    // rows: the top eight as { me, name, end, color? } (color draws the boat dot).
    leaderboard(rows) {
      $('leaderboard').replaceChildren(...rows.slice(0, 8).map((row, i) => {
        const li = document.createElement('li'); li.className = row.me ? 'pk-row is-me' : 'pk-row';
        const n = document.createElement('b'); n.className = 'pk-row-n'; n.textContent = i + 1;
        const name = document.createElement('span'); name.className = 'row-name'; name.textContent = row.name; name.translate = false;
        const end = document.createElement('span'); end.className = 'pk-row-end'; end.textContent = row.end;
        if (row.color) { const dot = document.createElement('i'); dot.className = 'boat-dot'; dot.style.setProperty('--boat', row.color); li.append(n, dot, name, end); }
        else li.append(n, name, end);
        return li;
      }));
    },
    // Every frame: hides an old shout and shakes the camera after a jolt.
    step(dt, camera) {
      if (callTimer > 0) { callTimer -= dt; if (callTimer <= 0) $('call').classList.add('hidden'); }
      if (shake > 0) {
        shake = Math.max(0, shake - dt); const k = shake * shakePower;
        camera.position.x += (Math.random() - .5) * k; camera.position.y += (Math.random() - .5) * k;
        if (!shake) shakePower = 0;
      }
    },
  };
  return hud;
}
