import { RECIPES, STATIONS } from '/g/cocina/rules.js';
import { object } from './objects.js';
const model=(id,name,factory,previewOptions)=>object({id,name,category:'Objetos',source:'/engine/models/props/kitchen.js',factory,usedBy:['Cocina'],previewOptions});
export const KITCHEN = [
  ...RECIPES.map(r=>({...model(`food-${r.id}`,r.name,'food',r.id),tags:['comida','cocina']})),
  ...STATIONS.filter((s,i,all)=>all.findIndex(a=>a.type===s.type)===i).map(s=>model(`station-${s.type}`,`Estación · ${s.label}`,'kitchenStation',s)),
];
