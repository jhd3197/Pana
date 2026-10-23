import * as THREE from 'three';
import { createLancha, createCuriaraRacer, createRayo } from '/engine/models/vehicles/lancha.js';
import { createAvioneta, createGuacamaya, createTurpial } from '/engine/models/vehicles/avioneta.js';
import { badge, nivelOf, vesselById, VESSEL_SLOTS, PART_SLOTS } from './parts.js';
import { CATALOG, paintOf } from './shop.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const builders = { penero:createLancha, curiara:createCuriaraRacer, rayo:createRayo, zamuro:createAvioneta, guacamaya:createGuacamaya, turpial:createTurpial };
const labels = { car:'Carro', boat:'Lancha', air:'Avioneta' };

// The car borrows a clone of the actual grid model; vessel builders are the
// same ones used by transform-gates. Never dispose geometry owned by the race.
export function openVehicleDialog({ racer, kind, own, used, taller, onColors }) {
  const def = kind === 'car' ? racer.def : vesselById(kind, racer.cosmetics?.[kind]);
  const tune = racer.tunes?.[kind === 'air' ? 'plane' : kind] ?? (kind === 'car' ? racer.tune : def.tune) ?? def.tune;
  const price = taller?.quoteKit(racer,kind) || 0, short = Math.max(0,price-(taller?.balance || 0));
  const slots = kind === 'car' ? [{id:'wheel',name:'Ruedas'},...PART_SLOTS] : VESSEL_SLOTS[kind];
  const parts = kind === 'car' ? { ...racer.cosmetics?.parts, wheel:racer.wheel } : racer.cosmetics?.[kind+'Parts'] || {};
  const dialog = document.createElement('dialog'); dialog.className = 'vehicle-popup'; dialog.setAttribute('aria-labelledby','vehicle-title');
  dialog.innerHTML = `<header><div><small>${labels[kind]} de ${esc(racer.name)}</small><h2 id="vehicle-title">${esc(def.name)}</h2></div>${badge(nivelOf(tune))}<button type="button" data-close>Cerrar</button></header><div class="vehicle-main"><div class="vehicle-visual"><canvas aria-label="${esc(def.name)} en 3D; arrastra para girar"></canvas><p class="vehicle-loading" role="status">Preparando el vehículo…</p></div><div class="vehicle-info"><p>${esc(def.blurb || def.desc || '')}</p>${used?'':'<p class="vehicle-unused">No se usa en esta pista</p>'}<dl>${slots.map(s=>`<div><dt>${esc(s.name)}</dt><dd>${esc(CATALOG[s.id]?.find(p=>p.id===(parts[s.id] || (s.id==='wheel'?'calle':'fabrica')))?.name || 'De fábrica')}</dd></div>`).join('')}</dl></div></div><div class="vehicle-actions"><button type="button" data-look aria-pressed="false">Ver de cerca</button>${own?'':`<button type="button" data-copy>Copiar ${labels[kind].toLowerCase()} ${badge(nivelOf(tune))}<small>${price} mangos · solo las piezas</small></button><button type="button" data-colors>Copiar colores</button>`}</div><p class="vehicle-message" role="status">${own?'Este es tu vehículo.':short?`Te faltan ${short} mangos para las piezas.`:'Las piezas que ya tienes no se vuelven a cobrar.'}</p>`;
  document.body.append(dialog);dialog.showModal();
  let frame=0,renderer=null,vessel=null,closed=false;
  const close=()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);vessel?.dispose();renderer?.dispose();renderer?.forceContextLoss();dialog.close();dialog.remove();};
  dialog.addEventListener('close',close);
  dialog.querySelector('[data-close]').onclick=close;
  dialog.onclick=e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();};
  const look=dialog.querySelector('[data-look]');look.onclick=()=>{const big=dialog.classList.toggle('close-up');look.textContent=big?'Volver a la ficha':'Ver de cerca';look.setAttribute('aria-pressed',String(big));};
  const message=dialog.querySelector('.vehicle-message');
  const copy=dialog.querySelector('[data-copy]');if(copy)copy.onclick=()=>{taller?.recommend(racer,kind);message.textContent=`${def.name} quedó marcado en tu taller.${short?` Te faltan ${short} mangos para las piezas.`:' Listo para equipar o comprar.'}`;};
  const colors=dialog.querySelector('[data-colors]');if(colors)colors.onclick=()=>{const ok=taller?.copyColors(racer);message.textContent=ok?'Colores guardados para todo tu kit.':'Te faltan mangos o el trofeo para esta pintura.';if(ok)onColors?.();};
  try {
    const canvas=dialog.querySelector('canvas');renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
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
  } catch(error) { dialog.querySelector('.vehicle-loading').textContent='No pudimos abrir la vista 3D. Cierra e inténtalo otra vez.';console.error('Vehicle inspection failed',error); }
  return {close};
}
