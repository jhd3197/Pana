import * as THREE from 'three';
import { createLancha, createCuriaraRacer, createRayo } from '/engine/models/vehicles/lancha.js';
import { createAvioneta, createGuacamaya, createTurpial } from '/engine/models/vehicles/avioneta.js';
import { badge, nivelOf, vesselById, VESSEL_SLOTS, PART_SLOTS } from './parts.js';
import { CATALOG, paintOf } from './shop.js';
import { pixelRatio } from '/engine/settings.js';
import { loc, locKey } from '/engine/i18n.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const builders = { penero:createLancha, curiara:createCuriaraRacer, rayo:createRayo, zamuro:createAvioneta, guacamaya:createGuacamaya, turpial:createTurpial };
const owners = { car:locKey('Carro de {name}'), boat:locKey('Lancha de {name}'), air:locKey('Avioneta de {name}') };
const copies = { car:locKey('Copiar carro'), boat:locKey('Copiar lancha'), air:locKey('Copiar avioneta') };

// The car borrows a clone of the actual grid model; vessel builders are the
// same ones used by transform-gates. Never dispose geometry owned by the race.
export function openVehicleDialog({ racer, kind, own, used, taller, onColors }) {
  const def = kind === 'car' ? racer.def : vesselById(kind, racer.cosmetics?.[kind]);
  const tune = racer.tunes?.[kind === 'air' ? 'plane' : kind] ?? (kind === 'car' ? racer.tune : def.tune) ?? def.tune;
  const price = taller?.quoteKit(racer,kind) || 0, short = Math.max(0,price-(taller?.balance || 0));
  const slots = kind === 'car' ? [{id:'wheel',name:loc('Ruedas')},...PART_SLOTS] : VESSEL_SLOTS[kind];
  const parts = kind === 'car' ? { ...racer.cosmetics?.parts, wheel:racer.wheel } : racer.cosmetics?.[kind+'Parts'] || {};
  const status = own ? loc('Este es tu vehículo.') : short ? loc('Te faltan {n} mangos para las piezas.', { n: short }) : loc('Las piezas que ya tienes no se vuelven a cobrar.');
  const cost = loc('{n} mangos · solo las piezas', { n: price }), spin = loc('{name} en 3D; arrastra para girar', { name: def.name });
  const dialog = document.createElement('dialog'); dialog.className = 'vehicle-popup'; dialog.setAttribute('aria-labelledby','vehicle-title');
  dialog.innerHTML = `<header><div><small>${esc(loc(owners[kind], { name: racer.name }))}</small><h2 id="vehicle-title">${esc(def.name)}</h2></div>${badge(nivelOf(tune))}<button type="button" data-close>Cerrar</button></header><div class="vehicle-main"><div class="vehicle-visual"><canvas aria-label="${esc(spin)}"></canvas><p class="vehicle-loading" role="status">Preparando el vehículo…</p></div><div class="vehicle-info"><p>${esc(def.blurb || def.desc || '')}</p>${used?'':'<p class="vehicle-unused">No se usa en esta pista</p>'}<dl>${slots.map(s=>`<div><dt>${esc(s.name)}</dt><dd>${esc(CATALOG[s.id]?.find(p=>p.id===(parts[s.id] || (s.id==='wheel'?'calle':'fabrica')))?.name || loc('De fábrica'))}</dd></div>`).join('')}</dl></div></div><div class="vehicle-actions"><button type="button" data-look aria-pressed="false">Ver de cerca</button>${own?'':`<button type="button" data-copy>${loc(copies[kind])} ${badge(nivelOf(tune))}<small>${esc(cost)}</small></button><button type="button" data-colors>Copiar colores</button>`}</div><p class="vehicle-message" role="status">${esc(status)}</p>`;
  document.body.append(dialog);dialog.showModal();
  let frame=0,renderer=null,vessel=null,closed=false;
  const close=()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);vessel?.dispose();renderer?.dispose();renderer?.forceContextLoss();dialog.close();dialog.remove();};
  dialog.addEventListener('close',close);
  dialog.querySelector('[data-close]').onclick=close;
  dialog.onclick=e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();};
  const look=dialog.querySelector('[data-look]');look.onclick=()=>{const big=dialog.classList.toggle('close-up');look.textContent=big?loc('Volver a la ficha'):loc('Ver de cerca');look.setAttribute('aria-pressed',String(big));};
  const message=dialog.querySelector('.vehicle-message');
  const copy=dialog.querySelector('[data-copy]');if(copy)copy.onclick=()=>{taller?.recommend(racer,kind);message.textContent=short?loc('{name} quedó marcado en tu taller. Te faltan {n} mangos para las piezas.', { name: def.name, n: short }):loc('{name} quedó marcado en tu taller. Listo para equipar o comprar.', { name: def.name });};
  const colors=dialog.querySelector('[data-colors]');if(colors)colors.onclick=()=>{const ok=taller?.copyColors(racer);message.textContent=ok?loc('Colores guardados para todo tu kit.'):loc('Te faltan mangos o el trofeo para esta pintura.');if(ok)onColors?.();};
  try {
    const canvas=dialog.querySelector('canvas');renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(pixelRatio(1.5));
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,200);
    scene.add(new THREE.HemisphereLight(0xfff3db,0x393354,3));const sun=new THREE.DirectionalLight(0xfff3dd,4);sun.position.set(-5,8,5);scene.add(sun);const rim=new THREE.DirectionalLight(0x94adff,2);rim.position.set(5,3,-5);scene.add(rim);
    const color=paintOf(racer.cosmetics,racer.def.color);
    if(kind!=='car')vessel=builders[def.id](racer.avatar || {},color);
    const model=kind==='car'?racer.car.root.clone(true):vessel.group;
    model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.setScalar(1);
    const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    model.position.sub(center);const turn=new THREE.Group();turn.add(model);turn.rotation.y=-.6;scene.add(turn);
    const radius=size.length()/2;let yaw=-.6,drag=null,last=0;
    canvas.onpointerdown=e=>{drag={x:e.clientX,yaw};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag)yaw=drag.yaw+(e.clientX-drag.x)*.009;};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const draw=now=>{if(closed)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);camera.aspect=w/h;const half=Math.min(THREE.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));const distance=radius/Math.sin(half)*.9;camera.position.set(distance*.63,distance*.35,distance*.7);camera.lookAt(0,0,0);camera.updateProjectionMatrix();if(!drag&&!reduced.matches)yaw+=Math.min(.05,(now-last)/1000)*.08;turn.rotation.y=yaw;turn.position.y=reduced.matches?0:Math.sin(now*.0015)*radius*.015;renderer.render(scene,camera);}last=now;frame=requestAnimationFrame(draw);};
    dialog.querySelector('.vehicle-loading').hidden=true;dialog.dataset.sceneReady='true';frame=requestAnimationFrame(draw);
  } catch(error) { dialog.querySelector('.vehicle-loading').textContent=loc('No pudimos abrir la vista 3D. Cierra e inténtalo otra vez.');console.error('Vehicle inspection failed',error); }
  return {close};
}
