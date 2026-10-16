import * as THREE from 'three';
import { M, mesh, box, canvasMat, rng } from '/engine/models/core/primitives.js';
import { archPanel } from '/engine/models/core/architecture-kit.js';
import { bush } from '/engine/models/vegetation/bush.js';
import { bake } from '/engine/models/core/static-batch.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { addWaterMotion } from '/engine/models/effects/water-details.js';

function lettering(words, color = '#fff0ca', bg = '#387c82', w = 4, h = 1.1) {
  return mesh(new THREE.PlaneGeometry(w, h), canvasMat(768, 192, ctx => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(12, 12, 744, 168);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 64px Nunito, sans-serif'; ctx.fillText(words, 384, 100, 710);
  }));
}

// Small architectural trim does not need bevelled extrusions or round iron
// tubes on hundreds of homes. These profiles retain the silhouette cheaply.
function archFrame(w,h,thickness,material,x=0,y=0,z=0) {
  const g=new THREE.Group(),spring=h-w/2;g.position.set(x,y,z);
  for(const side of [-1,1])g.add(box(thickness,spring,.15,material,side*(w+thickness)/2,spring/2,0));
  const shape=new THREE.Shape();shape.absarc(0,spring,w/2+thickness,0,Math.PI,false);
  shape.absarc(0,spring,w/2,Math.PI,0,true);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:false,curveSegments:8});geometry.translate(0,0,-.075);
  g.add(mesh(geometry,material));return g;
}
function railing(group,from,to,{height=.85,material,spacing=.32}={}) {
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),count=Math.ceil(a.distanceTo(b)/spacing);
  for(let i=0;i<=count;i++){const p=a.clone().lerp(b,i/count);group.add(box(.045,height,.045,material,p.x,p.y+height/2,p.z));}
  for(const y of [.12,height])group.add(box(Math.abs(b.x-a.x)+.06,.055,Math.abs(b.z-a.z)+.06,material,(a.x+b.x)/2,a.y+y,(a.z+b.z)/2));
}

// Same 5.4 m shell and ground origin for every style; all projecting details
// stay within the old flower-box envelope. Seed changes details, not clearance.
export function house({ w = 7, h = 6, color = 0xe5b965, seed = 1, label = '', style } = {}) {
  const styles = ['tejas','balcon','tienda','terraza'];
  style = styles.includes(style) ? style : styles[((seed % 4) + 4) % 4];
  const random = rng(seed + 141), g = new THREE.Group();
  g.name = `Casa · ${style}`; g.userData.houseStyle = style;
  const wall = M(color), trim = M(0xf5e3bc), dark = M(0x374d50), wood = M(0x805239), iron = M(0x344e4d);
  const paint = M([0x397774,0x805145,0x4a667e,0x637647][Math.floor(random()*4)]);
  const twoFloors = h > 6, upper = h - 2.05, plinth = M(new THREE.Color(color).multiplyScalar(.75).getHex());
  g.add(box(w,h,5.4,wall,0,h/2,0),box(w+.1,.65,5.5,plinth,0,.325,0));
  g.add(box(w+.28,.2,5.65,trim,0,h-.1,0));
  // Corner quoins, varied in height, ground each painted facade.
  for(const x of [-w/2+.13,w/2-.13])g.add(box(.26,h-.7,.12,trim,x,(h+.7)/2,2.74));
  if(twoFloors)g.add(box(w+.18,.14,5.6,trim,0,3.35,0));
  if(style==='balcon'||style==='terraza') {
    // A stepped parapet and a roof terrace interrupt the tiled-roof rhythm.
    g.add(box(w,.16,5.4,M(0xab8c69),0,h+.02,0));
    for(const z of [-2.6,2.6])g.add(box(w,.6,.2,wall,0,h+.35,z),box(w+.16,.13,.3,trim,0,h+.68,z));
    for(const x of [-w/2+.1,w/2-.1])g.add(box(.2,.6,5.2,wall,x,h+.35,0));
    const crest = style==='balcon'?w*.52:w*.3;
    g.add(box(crest,.45,.24,wall,style==='terraza'?-w*.22:0,h+.85,2.6));
    g.add(box(crest+.18,.12,.35,trim,style==='terraza'?-w*.22:0,h+1.1,2.6));
    if(style==='terraza') {
      for(const x of [-w*.27,w*.27])for(const z of [-1.6,1.2])g.add(box(.12,1.4,.12,wood,x,h+.75,z));
      for(let x=-w*.34;x<=w*.34;x+=.62)g.add(box(.13,.12,3.2,wood,x,h+1.48,-.2));
      for(const x of [-w*.27,w*.27])g.add(box(.12,.15,3.2,wood,x,h+1.4,-.2));
    }
  } else {
    const rise = style==='tienda'?.72:1.25, half = 2.98, slope = Math.atan2(rise,half);
    const tile = [0xbc6244,0xcb7954,0xa74f39].map(c=>M(c));
    for(const x of [-w/2,w/2]) {
      const shape = new THREE.Shape();shape.moveTo(-2.7,0);shape.lineTo(2.7,0);shape.lineTo(0,rise*.9);shape.closePath();
      const end=mesh(new THREE.ShapeGeometry(shape),wall,x,h,0);end.rotation.y=x<0?-Math.PI/2:Math.PI/2;g.add(end);
    }
    for(const side of [-1,1]) {
      const roof=new THREE.Group();roof.position.set(0,h+rise/2-.1,side*half/2);roof.rotation.x=side*slope;
      roof.add(box(w+.6,.12,Math.hypot(half,rise),tile[0]));
      for(let x=-w/2-.1;x<w/2+.3;x+=.4) {
        const row=mesh(new THREE.CylinderGeometry(.15,.17,Math.hypot(half,rise)+.08,6,1,true,0,Math.PI),tile[Math.floor(random()*3)],x,.07,0);
        row.rotation.x=Math.PI/2;roof.add(row);
      }
      g.add(roof);
    }
    g.add(box(w+.65,.14,.22,tile[1],0,h+rise-.05,0));
  }
  function windowAt(x,y,{arched=false,tall=false,flowers=false,shutters=true}={}) {
    const height=tall?1.95:1.4,width=tall?1.05:1.15;
    if(arched) {
      g.add(archPanel(width,height,.08,dark,x,y-height/2,2.77));
      g.add(archFrame(width,height,.12,trim,x,y-height/2,2.85));
    } else g.add(box(width+.23,height+.24,.12,trim,x,y,2.76),box(width,height,.08,dark,x,y,2.85));
    g.add(box(.06,height-.1,.06,trim,x,y,2.92),box(width,.06,.06,trim,x,y+.1,2.92));
    if(shutters)for(const side of [-1,1]) {
      const shutter=new THREE.Group();shutter.position.set(x+side*(width/2+.25),y,2.88);shutter.rotation.y=side*(.15+random()*.5);
      shutter.add(box(.38,height,.07,paint));
      for(let j=0;j<4;j++)shutter.add(box(.3,.045,.03,trim,0,-height*.3+j*height*.2,.05));g.add(shutter);
    }
    g.add(box(width+.35,.13,.4,trim,x,y-height/2-.14,2.91));
    if(flowers) {
      g.add(box(width,.28,.35,M(0xb66a4e),x,y-height/2,3.03));
      const plant=bush({seed:seed+Math.round(x*10),flowers:true});plant.scale.set(.43,.3,.25);plant.position.set(x,y-height/2+.12,3.05);g.add(plant);
    }
  }
  function doorway(x,width=1.35) {
    g.add(archPanel(width,2.65,.1,wood,x,.05,2.8),archFrame(width,2.65,.16,trim,x,.05,2.88));
    g.add(box(.045,2.1,.04,trim,x,1.1,2.88));
    for(const s of [-1,1])g.add(box(width*.32,.72,.035,paint,x+s*width*.25,.63,2.88),box(.07,.07,.06,M(0xd3ad60),x+s*.13,1.3,2.94));
  }
  const balcony = style==='balcon'&&twoFloors;
  if(style==='tienda') {
    // The wide, asymmetric store opening reads differently even without a label.
    const x=-w*.16,width=w*.46;
    g.add(archPanel(width,2.75,.12,dark,x,.15,2.8),archFrame(width,2.75,.16,trim,x,.15,2.9));
    for(const s of [-1,0,1])g.add(box(.075,2,.06,wood,x+s*width*.31,1.2,2.92));
    doorway(w*.32,1.05);
    const awning=new THREE.Group();awning.position.set(0,3.2,2.68);awning.rotation.x=.14;
    const aw=(w-.5)/10;
    for(let i=0;i<10;i++) {
      const cloth=i%2?trim:paint;
      awning.add(box(aw,.06,.7,cloth,-(w-.5)/2+(i+.5)*aw,0,.28));
      awning.add(box(aw,.22,.06,cloth,-(w-.5)/2+(i+.5)*aw,-.1,.6));
    }
    g.add(awning);
  } else {
    const doorX=style==='terraza'?-w*.28:0;doorway(doorX);
    if(style==='terraza')windowAt(w*.22,1.95,{arched:true,shutters:false});
    else for(const x of [-w*.31,w*.31])windowAt(x,2.05,{arched:style==='balcon',shutters:style!=='balcon'});
  }
  if(twoFloors) {
    const positions=balcony?[-w*.3,0,w*.3]:[-w*.29,w*.29];
    for(const [i,x] of positions.entries())windowAt(x,upper,{tall:balcony,arched:style==='balcon',shutters:!balcony,flowers:style==='tejas'&&i===1});
    if(balcony) {
      const y=upper-1.14;g.add(box(w-.4,.18,.72,trim,0,y,2.98));
      railing(g,[-w/2+.3,y+.1,3.3],[w/2-.3,y+.1,3.3],{height:.85,material:iron,spacing:.32});
      for(const x of [-w/2+.3,w/2-.3])railing(g,[x,y+.1,2.72],[x,y+.1,3.3],{height:.85,material:iron});
    }
  } else if(style!=='tienda') {
    const vent=mesh(new THREE.TorusGeometry(.24,.06,5,16),trim,0,h-.9,2.79);g.add(vent);
    g.add(mesh(new THREE.CircleGeometry(.22,16),dark,0,h-.9,2.78));
  }
  // Sparse side openings keep corner houses from exposing blank colored boxes.
  for(const side of [-1,1])for(const y of twoFloors?[2.1,upper]:[2.1]) {
    g.add(box(.1,1.35,1.2,trim,side*(w/2+.03),y,-.5));
    g.add(box(.05,1.1,.95,paint,side*(w/2+.1),y,-.5));
  }
  if(label) {
    const sign=lettering(label,'#ffedcb',style==='tienda'?'#345f5c':'#80503c',w*.7,.55);
    sign.position.set(0,style==='tienda'?3.76:3.72,2.84);g.add(sign);
  }
  // Paint is vertex data, so a whole street can share a handful of materials.
  // Keep textured signs and the foliage's existing vertex colors intact.
  g.traverse(o=>{
    if(!o.isMesh||o.material.map||o.material.vertexColors)return;
    const m=o.material,c=m.color,colors=new Float32Array(o.geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
    o.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    o.material=M(0xffffff,{vertexColors:true,flatShading:m.flatShading,roughness:m.roughness,side:m.side});
  });
  const out=bake(g);out.name=g.name;out.userData.houseStyle=style;
  const owned=new Set();g.traverse(o=>{if(o.geometry)owned.add(o.geometry);});owned.forEach(geo=>geo.dispose());
  return out;
}

export function church() {
  const g = house({ w: 8.5, h: 7.8, color: 0xf2c76e, seed: 3, style: 'tejas' });
  const tower = new THREE.Group(); tower.position.set(2.3, 7.8, -0.5);
  tower.add(box(3.3, 4.3, 3.3, M(0xf3cd83), 0, 1.7, 0));
  tower.add(box(3.65, 0.25, 3.65, M(0xffe3ae), 0, 3.8, 0));
  tower.add(mesh(new THREE.ConeGeometry(2.55, 2.1, 4), M(0xc76b44), 0, 4.9, 0));
  tower.rotation.y = 0;
  tower.add(box(1.35, 2, 0.05, M(0x5c503d), 0, 2.15, 1.68));
  tower.add(mesh(new THREE.CylinderGeometry(0.4, 0.65, 0.8, 10), M(0xa18442, { metalness: 0.4 }), 0, 2.15, 1.7));
  tower.add(box(0.18, 1.6, 0.18, M(0x86543d), 0, 6.5, 0));
  tower.add(box(1, 0.18, 0.18, M(0x86543d), 0, 6.65, 0));
  g.add(tower);
  const sign = lettering('PLAZA PANA', '#fff1cb', '#b26644', 4.6, 0.85); sign.position.set(0, 3.78, 2.81); g.add(sign);
  return g;
}

// The plaza's crowned-capybara fountain as a standalone landmark.
export function plazaFountain() {
  const f = fountain(), out = bake(f.group);
  f.capy.dispose(); f.group.traverse(o => o.geometry?.dispose());
  out.userData.tick = addWaterMotion(out, f.impacts, f.curves);
  return out;
}

export function fountain() {
  const g = new THREE.Group(), stone = M(0xe5caa0), rim = M(0xf6dfb8);
  g.add(mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.3, 16), stone, 0, 0.15, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.88, 3.02, 0.55, 16), rim, 0, 0.46, 0));
  const water = mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.05, 32), M(0x47bec1, { metalness: 0.15, roughness: 0.25 }), 0, 0.76, 0); g.add(water);
  // Rounded coping and a glazed mosaic frieze around the existing footprint.
  const glaze = M(0x398f88, { roughness: 0.42 }), trim = M(0xf6dfb8, { flatShading: false, roughness: 0.8 });
  for (const [radius, y, thickness] of [[2.84, 0.74, 0.1], [1.48, 2.42, 0.07]]) {
    const ring = mesh(new THREE.TorusGeometry(radius, thickness, 6, 48), trim, 0, y, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  }
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, tile = box(0.18, 0.15, 0.045, i % 3 ? glaze : trim, Math.sin(a) * 2.94, 0.48, Math.cos(a) * 2.94);
    tile.rotation.y = a; g.add(tile);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.8, 1.05, 1.8, 8), stone, 0, 1.35, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.24, 12), rim, 0, 2.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.03, 24), M(0x69d2d0), 0, 2.44, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.65, 0.8, 1.2, 8), stone, 0, 2.9, 0));
  const capy = buildCharacter({ fur: '#e8b97f', hat: 'corona', glasses: 'none', outfit: 'nada', face: 'feliz' });
  capy.group.position.y = 3.5; capy.group.scale.setScalar(1.15); g.add(capy.group);
  const streams = new THREE.Group(), curves = [], impacts = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.cos(a) * 1.35, 2.4, Math.sin(a) * 1.35), new THREE.Vector3(Math.cos(a) * 2.2, 2.2, Math.sin(a) * 2.2), new THREE.Vector3(Math.cos(a) * 2.35, 0.8, Math.sin(a) * 2.35));
    curves.push(curve); impacts.push([Math.cos(a) * 2.35, 0.8, Math.sin(a) * 2.35, 0.2]);
    streams.add(mesh(new THREE.TubeGeometry(curve, 10, 0.045, 4, false), M(0x91e5e1, { transparent: true, opacity: 0.75 })));
  }
  g.add(streams);
  return { group: g, streams, water, capy, curves, impacts };
}
