// Pure route guidance for the chase camera. Presentation only: never feeds
// steering, lap progress or the physical driving surface.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
const cyclic=(n,total)=>((n+total/2)%total+total)%total-total/2;

export function cameraGuidance(T,p,state,dt,{look=false,comfort=false,disabled=false}={}) {
  const elapsed=clamp(Number.isFinite(dt)?dt:0,0,.1);
  const speed=Math.max(0,p.vf||0);
  const anchor=state.s==null?null:T.pointAt(state.s);
  const reset=state.track!==T.id||state.look!==look||state.x==null||Math.hypot(p.x-state.x,p.z-state.z)>40
    ||Math.abs(p.y-(state.y??p.y))>12||(anchor&&Math.hypot(p.x-anchor.x,p.z-anchor.y)>40);
  if(reset){state.offset=0;state.rise=0;state.roll=0;state.s=null;}
  let offset=0,rise=0,roll=0;
  const s=T.paramOf(p.x,p.z,p.y);
  // A nearby parallel lane must not take over the camera. Height-aware
  // projection selects the deck; local arc continuity rejects branch jumps.
  const continuous=state.s==null||Math.abs(cyclic(s-state.s,T.TOTAL))<Math.max(12,speed*elapsed*3+3);
  if(continuous)state.s=s;
  if(!disabled&&!look&&speed>3&&continuous&&!p.rescueT&&!p.flyLift){
    const a=T.pointAt(s),near=T.pointAt(s+1);
    const tangent=Math.atan2(near.x-a.x,near.y-a.y);
    const alignment=Math.abs(angle(tangent-p.h));
    const onRoute=Math.hypot(p.x-a.x,p.z-a.y)<T.HW+4;
    if(onRoute&&alignment<1.2){
      const distance=clamp(6+speed*.32,8,24),ahead=T.pointAt(s+distance);
      const forward=Math.atan2(ahead.x-a.x,ahead.y-a.y);
      const weight=clamp((speed-3)/18,0,1);
      offset=clamp(angle(forward-p.h)*.6,-.38,.38)*weight;
      // Small pitch anticipation preserves the car while opening the next
      // slope. Boats and flying drawings follow their own elevation.
      if(p.onGround&&!p.boat)rise=clamp((T.heightAtS(s+distance)-T.heightAtS(s))*.18,-1.2,1.2)*weight;
      if(!comfort&&p.onGround&&!p.boat)roll=clamp(angle(forward-tangent)*.12,-.025,.025)*weight;
    }
  }
  const blend=1-Math.exp(-elapsed*5);
  state.offset+=(offset-state.offset)*blend;
  state.rise+=(rise-state.rise)*blend;
  // Comfort is immediate: changing the setting must not leave residual roll.
  state.roll=comfort?0:state.roll+(roll-state.roll)*blend;
  state.x=p.x;state.y=p.y;state.z=p.z;state.track=T.id;state.look=look;
  return {heading:p.h+state.offset,rise:state.rise,roll:state.roll,continuous};
}
