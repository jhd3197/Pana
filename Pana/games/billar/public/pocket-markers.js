import * as THREE from 'three';
// A painted number texture on a billboard in the 3D world. Camera rotation
// never changes the physical pocket's number or makes it upside down.
export function pocketMarker(number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#15112b'; ctx.beginPath(); ctx.arc(48, 48, 43, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = '#fff5df'; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(number, 48, 50);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
}
