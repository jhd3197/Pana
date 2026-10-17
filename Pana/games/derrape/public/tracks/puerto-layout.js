// Compressed fictional harbor, not a geographic reconstruction of La Guaira.
// Sea is +Z; hills are -Z. All occupied land is described independently of the lap.
export const ROUTE = [
  [-380,30],[-380,210],[-310,285],[-190,285],[-120,220],[-120,60],
  [-30,0],[120,0],[260,-45],[320,-130],[280,-220],[180,-245],
  [110,-330],[-10,-390],[-150,-360],[-220,-260],[-160,-180],
  [-40,-160],[-10,-105],[-90,-60],[-250,-60],
];
export const DOCK = { x0: -450, x1: -65, z0: 25, z1: 335, top: 4.2 };
export const FORT = { x: -50, z: -282, y: 64, radius: 43 };
export const PIERS = [{x:42,z:134,w:32,d:190},{x:180,z:121,w:32,d:165}];
export const TOWN_LANDMARKS = [[-285,-150,25],[-92,-113,18],[134,-112,18]];
export const TOWN_STREETS = [
  [[-460,-110],[-240,-110]], [[-450,-213],[-250,-213]],
  [[-450,-250],[-450,-75]], [[20,-78],[260,-78]],
  [[20,-145],[270,-145]], [[20,-181],[20,-20]],
  [[260,-185],[260,-78]], [[-365,-298],[-275,-298]], [[90,-298],[280,-298]],
];
// Sites also shape the terrain: houses sit on earth terraces, not tall box plinths.
export function townSites(T) {
  const lots=[];
  for(const x of [-420,-392,-364,-336,-308,-280])for(const z of [-87,-134,-187,-237])lots.push([x,z,z===-87||z===-187?Math.PI:0]);
  for(const x of [40,68,96,124,152,180,208,236])for(const z of [-37,-99,-172])lots.push([x,z,0]);
  for(const x of [-344,-304,100,140,180,220,260])for(const z of [-277,-318])lots.push([x,z,z===-277?Math.PI:0]);
  return lots.filter(([x,z])=>Math.abs(T.offsetOf(x,z))>T.HW+21&&Math.hypot(x-FORT.x,z-FORT.z)>=75&&
    !TOWN_LANDMARKS.some(([a,b,r])=>Math.hypot(x-a,z-b)<r+13))
    .map(([x,z,rot])=>({x,z,rot,y:roadHeight(x,z)-.25}));
}
export function townTerraces(x,z,h,sites) {
  for(const site of sites) {
    const d=Math.max(Math.abs(x-site.x)-13,Math.abs(z-site.z)-11);
    if(d<8)h=mix(h,site.y,1-smooth(d,0,8));
  }
  return h;
}
export const smooth = (v,a,b) => { const t = Math.max(0,Math.min(1,(v-a)/(b-a))); return t*t*(3-2*t); };
const mix = (a,b,t) => a+(b-a)*t;
export function roadHeight(x,z) { return 4.2 + 66 * smooth(-z,95,385); }
export function coast(x) { return 39 + 12*Math.sin(x*.007) + 6*Math.cos(x*.019); }
const boxField = (x,z,x0,z0,x1,z1) => Math.max(x0-x,x-x1,z0-z,z-z1);
export function harborLand(x,z) {
  return boxField(x,z,DOCK.x0,DOCK.z0,DOCK.x1,DOCK.z1) <= 0 ||
    PIERS.some(p=>boxField(x,z,p.x-p.w/2,35,p.x+p.w/2,p.z+p.d/2)<=0) ||
    boxField(x,z,394,20,425,407)<=0 || boxField(x,z,48,385,425,413)<=0;
}
export function baseHeight(x,z) {
  if (harborLand(x,z)) return 3.65;
  const shore = coast(x), inland = 1-smooth(z,shore-15,shore+10);
  const mountain = roadHeight(x,z)-.65 + smooth(-z,420,750)*(85+48*Math.sin(x*.006+z*.004)**2+22*Math.cos(z*.012));
  const fortBlend = 1-smooth(Math.hypot(x-FORT.x,z-FORT.z),43,80);
  const land = mix(mountain,FORT.y-.25,fortBlend);
  return mix(-9,land,inland);
}
