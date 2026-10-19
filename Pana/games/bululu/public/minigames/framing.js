// Minigame cameras are composed for a 16:9 screen. On a narrower one (a phone
// held upright, a tablet) the camera keeps that horizontal view by widening
// its vertical field, so the panas at either end of the row stay in frame.
// Wider screens keep the composed field and simply see more to the sides.
const COMPOSED = 16 / 9, MAX_FOV = 110;

export function fitCamera(camera, aspect) {
  camera.userData.composedFov ??= camera.fov;
  const base = camera.userData.composedFov * Math.PI / 180;
  const fov = aspect >= COMPOSED ? base : 2 * Math.atan(Math.tan(base / 2) * COMPOSED / aspect);
  camera.fov = Math.min(MAX_FOV, fov * 180 / Math.PI);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

// The largest centered rectangle of `aspect` inside the window, in CSS pixels.
// Online aim games share one camera aspect so screen-space hits agree on every
// display; they draw into this box instead of stretching to the window.
export function letterbox(aspect, w = innerWidth, h = innerHeight) {
  if (!aspect) return { x: 0, y: 0, w, h };
  const width = Math.min(w, h * aspect), height = width / aspect;
  return { x: (w - width) / 2, y: (h - height) / 2, w: width, h: height };
}
