import { bird } from '/engine/models/fauna/birds/flight-rig.js';

// Species proportions and palette; +Z is forward, metres.
const species = {
  kind: 'vulture',
  id:'soaring-vulture',
  name:'Zamuro planeador',
  body:0x383c3b,
  wing:0x343a3b,
  tip:0x777e7d,
  span:2.1,
  flap:.09,
  rate:1.4,
  tail:.4
};
export const soaringVulture=options=>bird(species,options);
