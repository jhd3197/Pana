import { bird } from '/engine/models/fauna/birds/flight-rig.js';

// Species proportions and palette; +Z is forward, metres.
const species = {
  kind: 'ibis',
  id:'scarlet-ibis',
  name:'Corocora roja',
  body:0xd9513a,
  wing:0xdc543d,
  tip:0x392b29,
  span:1.5,
  flap:.48,
  rate:4.3,
  tail:.26
};
export const scarletIbis=options=>bird(species,options);
