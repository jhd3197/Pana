import { SDFModel, ell, cone } from '/engine/models/fauna/farm/sculpt-kit.js';
import { makeAnimal } from '/engine/models/fauna/farm/rig.js';

// Horse/chicken/cow sculpt recipes adapted from threejs-procedural-animals (MIT).
// Copyright (c) 2026 Majid Manzarpour and procedural-animals contributors.
// See /engine/vendor/procedural-animals/README.md and LICENSE for provenance.
// Pana adaptation: simplified anatomy, native skinning, matte coats, absolute-time
// idle poses. Ground at y=0; forward +Z; metres. Every instance owns its GPU data.
function chickenSculpt() {
  const m = new SDFModel();
  // Adapted breast, keel, mantle, belly and cushion recipe (upstream adult hen),
  // doubled in scale, with a broader head and fewer feather layers.
  for (const [c,r] of [
    [[0,.368,.12],[.132,.156,.148]], [[0,.284,.072],[.108,.108,.128]],
    [[0,.472,-.024],[.128,.096,.216]], [[0,.272,-.11],[.128,.132,.172]],
    [[0,.492,-.216],[.104,.104,.124]], [[0,.33,-.256],[.104,.124,.104]],
  ]) ell(m,c,r,0,'coat',.045);
  ell(m,[0,.48,.16],[.084,.15,.092],1,'neck');
  ell(m,[0,.61,.19],[.075,.09,.083],2,'neck',.035);
  cone(m,[0,.595,.25],[0,.57,.36],.035,.003,2,'beak',.009);
  // Comb blade with five rounded points; separate wattles under the bill.
  ell(m,[0,.696,.18],[.015,.033,.08],2,'red',.012);
  for (let i=0;i<5;i++) ell(m,[0,.72+Math.sin(i*.7)*.012,.13+i*.027],[.014,.03,.018],2,'red',.009);
  for (const s of [-1,1]) ell(m,[s*.024,.53,.245],[.018,.048,.031],2,'red',.012);
  for (const s of [-1,1]) {
    ell(m,[s*.085,.22,-.06],[.054,.085,.065]);
    cone(m,[s*.085,.19,-.055],[s*.092,.055,-.01],.018,.014,0,'beak',.01);
    // Three forward toes plus a back toe, tips rounded and grounded.
    for (const d of [-1,0,1]) cone(m,[s*.092,.028,-.01],[s*.092+d*.042,.012,.085-Math.abs(d)*.015],.013,.007,0,'beak',.008);
    cone(m,[s*.092,.028,-.01],[s*.11,.011,-.065],.011,.007,0,'beak',.006);
  }
  return m;
}

export function yardChicken(options){return makeAnimal('chicken',chickenSculpt,options);}
