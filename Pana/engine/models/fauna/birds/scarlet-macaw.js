import { bird } from '/engine/models/fauna/birds/flight-rig.js';

// Species proportions and palette; +Z is forward, metres.
const species = {
  kind: 'macaw',
  id:'scarlet-macaw',
  name:'Guacamaya roja',
  body:0xcd3d30,
  wing:0xd04332,
  tip:0x286bb3,
  span:1.55,
  flap:.55,
  rate:5.4,
  tail:1.0
};
export const scarletMacaw=options=>bird(species,options);
