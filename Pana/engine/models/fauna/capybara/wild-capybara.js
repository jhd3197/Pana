import { M, rng } from '/engine/models/core/primitives.js';
import { capybaraForm } from '/engine/models/fauna/capybara/shape.js';

const dark=M(0x202627,{roughness:.85,flatShading:false});
const mat=color=>M(color,{roughness:.88,flatShading:false});
export function wildCapybara({seed=7}={}){
  const g=capybaraForm(mat(0x92704c),{eyes:dark}),phase=rng(seed)()*6;
  const ears=[g.children[1],g.children[4]],rest=ears.map(o=>o.rotation.x);
  g.name='Chigüire';g.userData={assetId:'wild-capybara',species:'capybara',footprintRadius:1.8,
    tick(t){ears.forEach((ear,i)=>{ear.rotation.x=rest[i]+Math.sin(t*1.5+phase+i)*.055;});},
  };
  g.userData.tick(0);return g;
}
