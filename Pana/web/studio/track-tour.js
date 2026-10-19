// Studio-only camera tour. The route is the same runtime used to build the map.
import { Vector3, Color, Fog } from 'three';
import { createSky } from '/engine/worlds/sky.js';

export const TOUR_SPEED = 24; // metres per second at 1×
function roadHeight(route, s) {
  let height = route.heightAtS(s);
  for (const ramp of route.ramps || []) {
    const along = ((s - ramp.s0) % route.TOTAL + route.TOTAL) % route.TOTAL;
    if (along <= ramp.len) height = Math.max(height, route.heightAtS(s) + ramp.h * along / ramp.len);
  }
  return height;
}
export function tourPose(route, distance) {
  const s = (route.LINE || 0) + Math.max(0, Math.min(route.TOTAL, distance));
  const p = route.pointAt(s), ahead = route.pointAt(s + 14);
  // Anticipate raised ramps and descend gently after them, without camera shake.
  const height = Math.max(...[-12,-8,-4,0,4,8,12].map(offset => roadHeight(route, s + offset) - Math.abs(offset) * .35));
  return {
    position: new Vector3(p.x, height + 3.2, p.y),
    target: new Vector3(ahead.x, roadHeight(route, s + 14) + 2.6, ahead.y),
  };
}

export function createTrackTour({ scene, camera, controls, canvas, invalidate, overview, copy, animate }) {
  const $ = id => document.getElementById(id), panel = $('track-tour');
  const stage = canvas.parentElement, app = $('studio-app');
  const maxPolarAngle = controls.maxPolarAngle;
  const canvasLabel = canvas.getAttribute('aria-label');
  let projection, atmosphere, sky;
  let route = null, asset = null, active = false, playing = false, distance = 0, speed = 1;
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const length = () => route?.TOTAL || 0;
  const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
  function update() {
    panel.hidden = !route;
    stage.classList.toggle('touring', active);
    canvas.setAttribute('aria-label', active ? 'Recorrido 3D de la pista. Espacio para reproducir o pausar; flechas para avanzar o retroceder. En pausa, arrastra para mirar alrededor.' : canvasLabel);
    text('tour-play', playing ? 'Pausar' : distance >= length() && route ? 'Repetir recorrido' : active ? 'Continuar' : 'Recorrer pista');
    $('tour-play').setAttribute('aria-pressed', String(playing));
    $('tour-progress').value = length() ? distance / length() * 1000 : 0;
    const percent = length() ? Math.round(distance / length() * 100) : 0;
    $('tour-progress').setAttribute('aria-valuetext', `${percent} %, ${Math.round(distance)} de ${Math.round(length())} metros`);
    text('tour-time', `${clock(distance / TOUR_SPEED)} / ${clock(length() / TOUR_SPEED)}`);
    text('tour-position', `${Math.round(distance).toLocaleString('es')} m · ${percent} %`);
    text('tour-state', !active ? 'Una vuelta por la pista.' : playing ? 'Recorriendo la pista.' : distance >= length() ? 'Vuelta completa. Puedes repetir o volver a la vista general.' : 'En pausa. Arrastra para mirar alrededor.');
    $('tour-overview').disabled = !active;
    $('tour-copy').disabled = !active;
  }
  function pose(dt = 0) {
    const view = tourPose(route, distance);
    camera.position.copy(view.position); controls.target.copy(view.target); camera.lookAt(view.target);
    animate(distance / TOUR_SPEED, dt);
    sky?.update(distance / TOUR_SPEED);
    invalidate();
  }
  function enter() {
    if (active) return;
    projection = { fov: camera.fov, near: camera.near, far: camera.far };
    atmosphere = { background: scene.background, fog: scene.fog };
    const palette = route.def.palette;
    sky = createSky(palette);scene.add(sky.mesh);
    scene.background = new Color(palette.horizon);
    scene.fog = new Fog(palette.horizon, palette.fog?.[0] ?? 80, palette.fog?.[1] ?? 260);
    active = true; controls.autoRotate = false; $('rotate').setAttribute('aria-pressed', 'false');
    camera.fov = 64; camera.near = .1; camera.far = 5000; camera.updateProjectionMatrix();
    controls.minDistance = .5; controls.maxDistance = 250; controls.maxPolarAngle = Math.PI * .95;
    // Flush residual orbit damping before the route takes ownership of the camera.
    controls.enableDamping = false; controls.update(); controls.enableDamping = true;
  }
  function pause() { if (!playing) return; playing = false; controls.enabled = true; update(); }
  function play() {
    if (!route) return;
    if (playing) { pause(); return; }
    enter(); if (distance >= length()) distance = 0;
    playing = true; controls.enabled = false; pose(); update();
  }
  function seek(value) {
    if (!route) return;
    pause(); enter(); distance = Math.max(0, Math.min(length(), value));
    controls.enabled = true; pose(); update();
  }
  function leave() {
    active = false; playing = false; distance = 0; controls.enabled = true;
    if (projection) { Object.assign(camera, projection); camera.updateProjectionMatrix(); projection = null; }
    sky?.dispose();sky = null;
    if (atmosphere) { Object.assign(scene, atmosphere); atmosphere = null; }
    controls.maxPolarAngle = maxPolarAngle;
    update(); invalidate();
  }
  function showOverview() { if (!active) return; leave(); overview(); }
  $('tour-play').onclick = play;
  $('tour-progress').oninput = event => seek(Number(event.target.value) / 1000 * length());
  $('tour-speed').onchange = event => { speed = Number(event.target.value); };
  $('tour-overview').onclick = showOverview;
  $('tour-expand').onclick = () => {
    const expanded = app.classList.toggle('expanded-view');
    $('tour-expand').textContent = expanded ? 'Reducir visor' : 'Ampliar visor';
    $('tour-expand').setAttribute('aria-pressed', String(expanded)); invalidate();
  };
  $('tour-copy').onclick = async () => {
    if (!route || !active) return;
    pause(); const point = tourPose(route, distance).position;
    const text = `${asset.name}\nRevisar el circuito en el ${((distance / length()) * 100).toFixed(1)} % (${distance.toFixed(1)} de ${length().toFixed(1)} m desde la salida).\nPista XYZ: ${point.x.toFixed(2)}, ${roadHeight(route, (route.LINE || 0) + distance).toFixed(2)}, ${point.z.toFixed(2)}\nCámara XYZ: ${camera.position.toArray().map(v => v.toFixed(2)).join(', ')}\nFuente: ${asset.source}\nStudio: ${location.origin}/studio/assets/${encodeURIComponent(asset.id)}\nComentario: `;
    $('tour-state').textContent = await copy(text) ? 'Punto copiado. Pégalo junto a tu comentario.' : 'No se pudo copiar el punto. Puedes indicar el porcentaje visible.';
  };
  canvas.addEventListener('keydown', event => {
    if (!route || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') { event.preventDefault(); play(); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); seek(distance + (event.key === 'ArrowRight' ? 1 : -1) * TOUR_SPEED * 5); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  return {
    get active() { return active; }, get playing() { return playing; }, get distance() { return distance; },
    setTrack(next, info) {
      leave(); route = next || null; asset = info; speed = 1; $('tour-speed').value = '1';
      if (!route) { app.classList.remove('expanded-view'); $('tour-expand').textContent = 'Ampliar visor'; $('tour-expand').setAttribute('aria-pressed', 'false'); }
      update();
    },
    step(dt) {
      if (!playing) return;
      distance = Math.min(length(), distance + Math.max(0, Math.min(.1, dt)) * TOUR_SPEED * speed);
      pose(dt); if (distance >= length()) pause(); update();
    },
    overview: showOverview,
  };
}
