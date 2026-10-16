// Opt-in surface response; the other circuits retain their existing handling.
export function roughnessAt(T,x,z) {
  if(!T.def.offroad)return 0;
  const t=Math.max(0,Math.min(1,(Math.abs(T.offsetOf(x,z))-T.HW+0.35)/T.def.offroad.fullAt));
  return t*t*(3-2*t);
}

// Local wet asphalt is independent of off-road drag and defaults to dry grip.
export function roadWaterAt(T,x,z,time=0){
  return Math.max(0,Math.min(1,T.def.waterAt?.(x,z,time,T)??0));
}
export function roadGripAt(T,x,z,time=0) {
  return Math.max(.4,Math.min(1,(T.def.gripAt?.(x,z)??1)*(1-.4*roadWaterAt(T,x,z,time))));
}
