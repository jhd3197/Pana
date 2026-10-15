// Opt-in surface response; the other circuits retain their existing handling.
export function roughnessAt(T,x,z) {
  if(!T.def.offroad)return 0;
  const t=Math.max(0,Math.min(1,(Math.abs(T.offsetOf(x,z))-T.HW+0.35)/T.def.offroad.fullAt));
  return t*t*(3-2*t);
}
