// Artifact metres become 30 simulation units; rendering uses .014 units/metre.
export const ARTIFACT_UNIT = 30;
const platform = (id, x, top, width, kind = 'platform') => ({id, x:x*30, y:top*30-12, width:width*30, height:24, kind});
export const PANA_STAGES = ['salto-angel','catatumbo'].map(id => ({
  id, displayName:id==='salto-angel'?'Salto Ángel':'Catatumbo', // i18n-ignore: place name
  platforms:[platform('main',0,0,id==='salto-angel'?42:46,'ground'),
    platform('left',id==='salto-angel'?-11:-13,7.5,10),
    platform('right',id==='salto-angel'?11:13,7.5,10),
    platform('top',0,id==='salto-angel'?15:14,9)],
  ledges:[{platformId:'main',side:'left'},{platformId:'main',side:'right'}],
  spawns:[{x:-360,y:0},{x:360,y:0}],
  blastZone:{left:-1800,right:1800,bottom:id==='salto-angel'?-1200:-780,top:1620},
}));
PANA_STAGES.push({id:'los-roques',displayName:'Los Roques', // i18n-ignore: place name
  platforms:[platform('main',-15,0,38,'ground'),platform('muelle',24,0,24,'ground'),
    platform('faro-balcon',-28,10,10),platform('faro-tope',-28,19,6),
    platform('terraza',-11,7.5,10),platform('enramada',23,7,10),
    platform('balsa',8,2.2,6),platform('penero',46,1.3,12,'ground'),platform('penero-techo',45.5,5.2,5)],
  ledges:['main','muelle','penero'].flatMap(platformId=>['left','right'].map(side=>({platformId,side}))),
  spawns:[-26,24,-12,16,-2,32].map(x=>({x:x*30,y:0})),
  blastZone:{left:-2460,right:2940,bottom:-1020,top:1920},
});
export function roquesAt(frame) {
  const t=frame/60,boat=Math.sin(t/5.5*Math.PI*2)*.4;
  return {balsa:{x:(8+Math.sin(t/7*Math.PI)*1.4)*30,y:(2.2+Math.sin(t/7*Math.PI*2)*.35)*30-12},
    penero:{x:46*30,y:(1.3+boat)*30-12},'penero-techo':{x:45.5*30,y:(5.2+boat)*30-12}};
}
function movePlatform(combat,id,next) {
  const p=combat.stage.platforms.find(p=>p.id===id),dx=next.x-p.x,dy=next.y-p.y;
  for(const f of combat.fighters)if(f.grounded&&f.supportPlatform===id){f.position.x+=dx;f.position.y+=dy;}
  Object.assign(p,next);p.position={...next};
  for(const ledge of combat.stage.ledges)if(ledge.platformId===id){ledge.position.x+=dx;ledge.position.y+=dy;}
}
export function canoeAt(frame) {
  const a=Math.sin(frame/60/11*Math.PI*2);
  return {x:a*270,y:(15+(1-Math.cos(a*.9))*1.6)*30-12};
}
export function stormAt(frame) {
  const spots=[9,-3,17,-14,3,-19,13,-9,0,20,-16,6], cycle=660;
  const n=Math.floor(frame/cycle), age=frame%cycle;
  return {x:spots[n%spots.length]*30,warning:age>=564,hit:frame>0&&age===0,
    hitX:spots[(n-1+spots.length)%spots.length]*30};
}
export function advanceStage(combat) {
  if(combat.stage.id==='los-roques')for(const [id,pose] of Object.entries(roquesAt(combat.frame)))movePlatform(combat,id,pose);
  if(combat.stage.id==='salto-angel') {
    const p=combat.stage.platforms.find(p=>p.id==='top'), next=canoeAt(combat.frame);
    for(const f of combat.fighters) if(f.grounded&&f.supportPlatform==='top') {
      f.position.x+=next.x-p.x; f.position.y+=next.y-p.y;
    }
    Object.assign(p,next); p.position={...next};
  }
  if(combat.stage.id!=='catatumbo')return;
  const storm=stormAt(combat.frame);
  if(!storm.hit)return;
  combat.emit({type:'storm',position:{x:storm.hitX,y:0}});
  for(const f of combat.fighters) {
    if(f.stocks<=0||f.invulnerableFrames>0||['ko','respawn','ledge'].includes(f.state))continue;
    if(Math.abs(f.position.x-storm.hitX)>90+f.definition.size.width/2||Math.abs(f.position.y)>180)continue;
    f.percent+=18;f.state='hitstun';f.grounded=false;f.supportPlatform=null;
    f.action=null;f.pendingHitstopDi=null;f.hitstunFrames=45;f.hitstopFrames=6;f.velocity={x:0,y:900};f.launchVelocity={x:0,y:0};
    combat.emit({type:'hit',target:f.slot,move:'catatumbo',damage:18,position:{...f.position}});
  }
}
