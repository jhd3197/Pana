import { SDFModel, ell, cone } from '/engine/models/fauna/farm/sculpt-kit.js';
import { makeAnimal } from '/engine/models/fauna/farm/rig.js';

// Horse/chicken/cow sculpt recipes adapted from threejs-procedural-animals (MIT).
// Copyright (c) 2026 Majid Manzarpour and procedural-animals contributors.
// See /engine/vendor/procedural-animals/README.md and LICENSE for provenance.
// Pana adaptation: simplified anatomy, native skinning, matte coats, absolute-time
// idle poses. Ground at y=0; forward +Z; metres. Every instance owns its GPU data.
function cowSculpt() {
  const m=new SDFModel();
  // Adapted upstream ribcage, girth, abdomen, flank and rump, softened into a
  // broad dairy silhouette. A short neck distinguishes cattle from the horse.
  for(const [c,r] of [
    [[0,1.04,.12],[.36,.4,.56]],[[0,1.02,.44],[.3,.33,.24]],
    [[0,1,-.22],[.39,.37,.36]],[[0,.84,-.08],[.32,.2,.42]],
    [[0,1.17,-.45],[.33,.24,.24]],[[0,1.25,-.68],[.3,.2,.28]],
    [[0,1.35,.04],[.22,.08,.42]],[[0,.83,.6],[.2,.17,.17]],
  ])ell(m,c,r,0,'coat',.085);
  for(const s of [-1,1]) {
    ell(m,[s*.27,1.08,.45],[.13,.27,.17]);
    cone(m,[s*.28,.99,.48],[s*.28,.57,.4],.09,.055);
    cone(m,[s*.28,.57,.4],[s*.28,.13,.45],.049,.04);
    ell(m,[s*.28,1.04,-.65],[.15,.28,.19]);
    cone(m,[s*.28,.92,-.57],[s*.3,.52,-.77],.085,.05);
    cone(m,[s*.3,.52,-.77],[s*.3,.13,-.67],.045,.039);
    // Cloven hoof halves remain visibly separate at the front.
    for(const [x,z]of [[s*.28,.5],[s*.3,-.61]])for(const d of [-1,1])
      ell(m,[x+d*.037,.066,z],[.033,.067,.09],0,'hoof',.006);
  }
  ell(m,[0,.65,-.4],[.18,.13,.2],0,'udder',.035);
  for(const s of [-1,1])for(const z of [-.48,-.32])cone(m,[s*.09,.6,z],[s*.09,.47,z],.028,.018,0,'udder',.01);
  ell(m,[0,1.16,.64],[.24,.27,.26],1,'coat',.1);
  ell(m,[0,1.26,.87],[.19,.21,.24],1,'coat',.08);
  ell(m,[0,1.38,1.04],[.17,.18,.19],2,'coat',.06);
  ell(m,[0,1.22,1.22],[.135,.17,.21],2,'coat',.055,[0,-.5,1]);
  ell(m,[0,1.08,1.39],[.18,.115,.12],2,'muzzle',.035);
  for(const s of [-1,1]) {
    ell(m,[s*.25,1.41,1.01],[.18,.055,.1],2,'coat',.025,[s,0,-.2]);
    cone(m,[s*.12,1.49,.96],[s*.22,1.62,.94],.045,.029,2,'horn',.012);
    cone(m,[s*.22,1.62,.94],[s*.21,1.75,.99],.029,.004,2,'horn',.009);
  }
  return m;
}

export function hatoCow(options){return makeAnimal('cow',cowSculpt,options);}
