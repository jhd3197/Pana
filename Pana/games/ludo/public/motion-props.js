import * as THREE from 'three';

export function createMotionProps(style, color) {
  const root = new THREE.Group(); root.name = `Camino: ${style}`;
  const mat = (c, extra={}) => new THREE.MeshStandardMaterial({color:c,roughness:.45,...extra});
  const cream=mat('#fff6e2'),team=mat(color),pink=mat('#ff8fc8');
  function mesh(geometry,material,parent=root){const m=new THREE.Mesh(geometry,material);parent.add(m);m.castShadow=true;return m;}
  if(style==='umbrella') {
    mesh(new THREE.CylinderGeometry(.012,.012,.65,8),mat('#65544a')).position.y=.6;
    const canopy=new THREE.Group();canopy.position.y=.92;root.add(canopy);root.userData.canopy=canopy;
    for(let i=0;i<8;i++)mesh(new THREE.SphereGeometry(.43,6,6,i*Math.PI/4,Math.PI/4,0,Math.PI/2),i%2?cream:team,canopy).scale.y=.55;
  } else if(style==='slip') {
    const banana=mat('#ffd84a',{side:THREE.DoubleSide});
    for(let i=0;i<3;i++) {
      const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,.08,0),new THREE.Vector3(.1,-.02,0),new THREE.Vector3(.23,.04,0));
      const peel=mesh(new THREE.TubeGeometry(curve,8,.025,4,false),banana);peel.rotation.y=i*Math.PI*2/3;
    }
  } else if(style==='spring') {
    const points=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*12;points.push(new THREE.Vector3(Math.cos(a)*.1,i/96*.3,Math.sin(a)*.1));}
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),96,.012,6,false),mat('#a3b6c3',{metalness:.7}));
    mesh(new THREE.CylinderGeometry(.15,.15,.025,24),team).position.y=.3;
  } else if(style==='tunnel') {
    for(let i=0;i<2;i++){const hole=mesh(new THREE.CircleGeometry(.15,24),mat('#241929'));hole.rotation.x=-Math.PI/2;}
    const mound=mesh(new THREE.SphereGeometry(.14,16,8),mat('#a97a50'));mound.scale.y=.5;root.userData.mound=mound;
  } else if(style==='gum') {
    mesh(new THREE.SphereGeometry(.13,16,8),pink).scale.y=.12;
    const strand=mesh(new THREE.CylinderGeometry(.022,.035,1,8),pink);root.userData.strand=strand;
  }
  // Empty materials are not attached to geometry and must not retain GPU state.
  for(const material of [cream,team,pink]) {
    let used=false;root.traverse(m=>{if(m.material===material)used=true;});if(!used)material.dispose();
  }
  return root;
}
