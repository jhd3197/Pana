import { reefFishSchool } from '/engine/models/fauna/aquatic/reef-fish-school.js';

// Verify the whole swimming envelope against terrain and path clearance.
export function placeReefSchools(parent,{spots,groundAt,waterY=0,clearance=()=>true,seed=71}) {
  const schools=[];
  for(const [i,[x,z]]of spots.entries()) {
    const radius=3.05,y=waterY-1.1;
    const samples=[[0,0],...[1.5,radius].flatMap(r=>Array.from({length:32},(_,j)=>[Math.cos(j*Math.PI/16)*r,Math.sin(j*Math.PI/16)*r]))];
    if(!clearance(x,z,radius)||samples.some(([dx,dz])=>groundAt(x+dx,z+dz)>y-.65))continue;
    const school=reefFishSchool({seed:seed+i*19});school.position.set(x,y,z);school.userData.waterY=waterY;parent.add(school);schools.push(school);
  }
  return schools;
}
