// One offscreen renderer for still pictures of panas (portrait.js,
// wardrobe-preview.js): jobs take turns on it, so a page never holds more
// than one extra WebGL context, and it lets that context go after 4 s idle.
// job(renderer) sets its own size and tone mapping and returns the image.
import * as THREE from 'three';
let renderer = null, idle = 0, queue = Promise.resolve();
export function snapshot(job) {
  const run = queue.then(async () => {
    clearTimeout(idle);
    renderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true });
    try { return await job(renderer); } finally {
      idle = setTimeout(() => { renderer?.dispose(); renderer?.forceContextLoss(); renderer = null; }, 4000);
    }
  });
  queue = run.catch(() => {});
  return run;
}
