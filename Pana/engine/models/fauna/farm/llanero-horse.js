import { SDFModel, ell, cone } from '/engine/models/fauna/farm/sculpt-kit.js';
import { makeAnimal } from '/engine/models/fauna/farm/rig.js';

// Horse/chicken/cow sculpt recipes adapted from threejs-procedural-animals (MIT).
// Copyright (c) 2026 Majid Manzarpour and procedural-animals contributors.
// See /engine/vendor/procedural-animals/README.md and LICENSE for provenance.
// Pana adaptation: simplified anatomy, native skinning, matte coats, absolute-time
// idle poses. Ground at y=0; forward +Z; metres. Every instance owns its GPU data.
function horseSculpt() {
  const m = new SDFModel();
  // Upstream ribcage / girth / abdomen / flank / withers recipe, broadened for
  // Pana's soft toy proportions. Lower limb anatomy retains the hock and pastern.
  for (const [c,r] of [
    [[0,1.26,.14],[.32,.345,.56]], [[0,1.22,.46],[.27,.29,.2]],
    [[0,1.25,-.16],[.32,.29,.32]], [[0,1.32,-.38],[.29,.22,.22]],
    [[0,1.5,.44],[.1,.12,.22]], [[0,1.46,.08],[.2,.085,.36]],
    [[0,1.41,-.6],[.3,.24,.28]], [[0,1.08,.64],[.2,.16,.17]],
  ]) ell(m,c,r);
  for (const s of [-1,1]) {
    ell(m,[s*.14,1.33,-.72],[.16,.22,.15]);
    // Front leg: shoulder, elbow, knee, cannon, fetlock, hoof.
    ell(m,[s*.24,1.27,.48],[.115,.3,.18]);
    cone(m,[s*.24,1.19,.5],[s*.26,.9,.39],.105,.073);
    cone(m,[s*.26,.9,.39],[s*.26,.55,.53],.075,.045);
    ell(m,[s*.26,.55,.53],[.057,.065,.055]);
    cone(m,[s*.26,.53,.53],[s*.26,.18,.52],.037,.04);
    cone(m,[s*.26,.18,.52],[s*.26,.09,.59],.046,.055);
    ell(m,[s*.26,.065,.6],[.076,.066,.095],0,'hoof',.018);
    // Rear leg: muscular thigh, forward stifle, rear hock, slim cannon.
    ell(m,[s*.24,1.18,-.59],[.15,.28,.22]);
    cone(m,[s*.25,1.17,-.61],[s*.27,.87,-.37],.14,.095);
    cone(m,[s*.27,.87,-.37],[s*.27,.53,-.73],.087,.045);
    ell(m,[s*.27,.53,-.73],[.055,.065,.056]);
    cone(m,[s*.27,.53,-.73],[s*.27,.17,-.65],.037,.038);
    cone(m,[s*.27,.17,-.65],[s*.27,.08,-.57],.043,.057);
    ell(m,[s*.27,.065,-.56],[.075,.066,.096],0,'hoof',.018);
  }
  // Same tapered, rising neck construction as upstream, with fewer sections.
  for (const [c,r] of [
    [[0,1.4,.64],[.22,.28,.26]], [[0,1.62,.73],[.16,.26,.22]],
    [[0,1.82,.84],[.12,.23,.17]],
  ]) ell(m,c,r,1,'coat',.09,[0,.75,.6]);
  ell(m,[0,1.93,.99],[.135,.14,.18],2);
  ell(m,[0,1.79,1.15],[.092,.115,.22],2,'coat',.055,[0,-.7,1]);
  ell(m,[0,1.64,1.3],[.115,.095,.115],2,'muzzle',.05);
  for (const s of [-1,1]) {
    ell(m,[s*.075,1.82,1.02],[.075,.13,.115],2);
    m.ell({c:[s*.095,2.09,.91],r:[.045,.16,.038],bone:2,tag:'coat',k:.025,up:[s*.2,1,-.13]});
  }
  // Broad overlapping hair locks replace the upstream shell/fur renderer.
  for (let i=0;i<9;i++) {
    const t=i/8;
    ell(m,[-.105,1.57+t*.45,.43+t*.42],[.055,.15,.072],1,'mane',.02,[0,.9,.4]);
  }
  ell(m,[0,2.015,1.02],[.08,.055,.11],2,'mane',.022,[0,-.4,1]);
  return m;
}

export function llaneroHorse(options){return makeAnimal('horse',horseSculpt,options);}
