import { bootGame } from '/engine/game-shell.js';
import { loadAvatar } from '/engine/avatar.js';
import { createGameMenu } from '/engine/ui.js';
import { sound } from '/engine/fx.js';
import { LightningTrial } from './lightning-trial.js';
import { loc } from '/engine/i18n.js';
const $=id=>document.getElementById(id), trial=new LightningTrial(loadAvatar());
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const menu=createGameMenu({title:loc('Prueba de rayos · Bochinche'),sound,
  // The lab sits beside Bochinche's index.html: it names its own Instrucciones page, not the game's instructions.js.
  instructions:{goal:loc('Prueba cómo se siente un rayo antes de llevarlo a la pelea.'),
    howTo:[loc('Cada lanzamiento coloca a los panas en el mismo sitio. Cambia una capa y vuelve a probar. Los ajustes se aplican al siguiente golpe.')],
    sections:[{title:loc('Prueba de rayos'),rows:[
      {action:loc('Lanzar rayo'),keyboard:'K',touch:loc('Botón Lanzar rayo')},
      {action:loc('Golpe sin efectos'),keyboard:loc('Clic'),touch:loc('Botón Golpe sin efectos')},
      {action:loc('Reiniciar prueba'),keyboard:'R',touch:loc('Botón Reiniciar')}]}]},note:()=>loc('Práctica local. La prueba se pausa al abrir el menú.')});
$('menu-slot').append(menu.createButton({className:'pk-btn'}));
let world=null, effects=null;
const phases={ready:loc('Listo para probar'),charge:loc('Cargando…'),impact:loc('¡Contacto!'),done:loc('Prueba terminada')};
function settings(){
  for(const id of ['lightning','flash','stop','shake','slow'])trial.settings[id]=$(id).checked;
  trial.settings.stopFrames=Number($('stopFrames').value);
  trial.settings.shakeStrength=Number($('shakeStrength').value)/100;
  $('stop-value').textContent=`${Math.round(trial.settings.stopFrames/60*1000)} ms`;
  $('shake-value').textContent=`${$('shakeStrength').value} / 24`;
}
for(const el of document.querySelectorAll('input'))el.addEventListener('input',settings);
settings();
function sync(){
  const busy=trial.phase==='charge'||trial.phase==='impact';
  $('cast').disabled=$('baseline').disabled=!world||busy;
  $('phase').textContent=trial.frozen?loc('Pausa de impacto'):phases[trial.phase];
  $('damage').textContent=`${Math.round(trial.combat.fighters[1].percent)}%`;
  $('motion-note').hidden=!reduced.matches;
}
function cast(baseline=false){
  if(!world||menu.isOpen)return;
  settings();
  if(trial.cast()&&baseline)Object.assign(trial.active,{lightning:false,flash:false,stop:false,shake:false});
  sync();
}
$('cast').onclick=()=>cast(); $('baseline').onclick=()=>cast(true);
$('reset').onclick=()=>{trial.reset();sync();};
function key(e){
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||menu.isOpen)return;
  if(e.code==='KeyK'){e.preventDefault();cast();}
  if(e.code==='KeyR'){trial.reset();sync();}
}
addEventListener('keydown',key);
const {sceneReady}=bootGame({
  load:async()=>{
    const [{createBochincheScene},{createLightningEffects}]=await Promise.all([import('./scene.js'),import('./lightning-effects.js')]);
    const created=createBochincheScene($('world'),{practice:true});effects=createLightningEffects(created.scene);return created;
  },
  ready:created=>{world=created;world.update(trial.snapshot());sync();window.PANA_PREPARED=true;},
  frame:(dt,scene)=>{
    if(menu.isOpen||document.hidden)return;
    trial.step(dt);scene.update(trial.snapshot());
    scene.frame(trial.frozen?0:dt*(trial.active?.slow?.25:1),camera=>effects.frame(trial,camera,reduced.matches));
    sync();
  },
  dispose:()=>{removeEventListener('keydown',key);effects?.dispose();},
});
if(new URLSearchParams(location.search).has('debug'))window.lightningDebug={trial,get effects(){return effects;},get world(){return world;},sceneReady};
