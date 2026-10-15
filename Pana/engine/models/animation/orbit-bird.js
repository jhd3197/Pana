

// Compose flight with the local pose. Only the root owns the update callback.
export function orbitBird(bird,{cx,cz,cy=14,r=16,speed=.5,phase=0}){
  const pose=bird.userData.tick;
  bird.userData.flight={cx,cz,cy,r,speed,phase};
  bird.userData.tick=t=>{
    pose(t);const a=t*speed+phase;
    bird.position.set(cx+Math.cos(a)*r,cy+Math.sin(t*1.3+phase)*.8,cz+Math.sin(a)*r);
    bird.rotation.set(0,-a+(speed<0?Math.PI:0),-.10*Math.sign(speed));
  };
  bird.userData.tick(0);return bird;
}
