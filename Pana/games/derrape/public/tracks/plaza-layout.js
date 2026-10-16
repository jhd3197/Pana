// Town planning is independent of the racing line. Coordinates are world metres.
import { MathUtils } from 'three';

export const AVENUES = [-300, -190, -85, 85, 195, 295, 405];
export const STREETS = [-310, -200, -85, 60, 165, 275];
export const STREET_HALF = 9.6;
export const ROUTE = [[-190,60],[-85,60],[85,60],[195,60],[195,165],[195,275],[190,355],
  [200,405],[260,405],[340,405],[420,405],[500,405],[580,405],[640,405],[675,350],
  [650,280],[530,245],[450,215],[405,165],[295,165],[295,60],[295,-85],
  [195,-85],[195,-200],[85,-200],[85,-85],[-85,-85],[-190,-85]];
export const BLOCKS = AVENUES.slice(0,-1).flatMap((x,col) => STREETS.slice(0,-1).map((z,row) => ({
  id:`${col}:${row}`, col,row,x0:x,x1:AVENUES[col+1],z0:z,z1:STREETS[row+1],
  kind:col===2&&row===2?'historic':col===3&&row===2?'market':
    col===4&&row===1?'lookout':col===1&&row===3?'park':'homes',
})));

// The shared plaza stays level; eastern streets climb a broad, gentle ridge.
export function townHeight(x,z) {
  const hill = 28 * Math.exp(-(((x-250)/185)**2) - ((z+185)/155)**2);
  const ridge = 52 * Math.exp(-(((x-480)/260)**2) - ((z+480)/180)**2);
  return hill*MathUtils.smoothstep(x,65,185) + ridge*MathUtils.smoothstep(x,100,300) + 10*MathUtils.smoothstep(z,280,375);
}
export function streetDistance(x,z) {
  return Math.min(...AVENUES.map(a=>Math.abs(x-a)),...STREETS.map(s=>Math.abs(z-s)));
}
