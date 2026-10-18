import test from 'node:test';
import assert from 'node:assert/strict';
import { TABLE_ARENAS,validArena,validTableArena } from '../arena-layouts.js';
import { DominoGame } from '../../games/domino/public/rules.js';
import { CaidaGame } from '../../games/caida/public/rules.js';
import { Poker } from '../../games/poquer/public/rules.js';

for(const mapId of ['guipuzcoana','san-carlos']){
  test(`${mapId}: table-only registry and host-owned snapshot games`,()=>{
    assert.ok(TABLE_ARENAS.some(m=>m.id===mapId));assert.equal(validArena(mapId),false);assert.equal(validTableArena(mapId),true);
    for(const Game of [DominoGame,CaidaGame]){
      const game=new Game();game.addPlayer(1,'Uno');game.addPlayer(2,'Dos');
      const map=(id,mapId,seq=1)=>game.accept(id,{action:Game===CaidaGame?'configure':'map',mapId,options:{mapId},revision:game.revision,seq},1);
      assert.equal(map(2,mapId),false);assert.equal(map(1,'invalid'),false);assert.equal(map(1,mapId),true);
      assert.equal(map(1,'plaza'),false,'replayed sequence');
      const restored=Game.restore(game.snapshot(),new Map([[2,{id:2,name:'Dos'}]]));assert.equal(restored.mapId,mapId);
      game.start();assert.equal(map(1,'plaza',2),false,'cannot move a running table');assert.equal(game.mapId,mapId);
    }
  });
  test(`${mapId}: private poker views retain the setting across hands`,()=>{
    const p=new Poker();p.add(1,{name:'Uno'});p.add(2,{name:'Dos'});
    assert.equal(p.setMap(mapId),true);assert.equal(p.setMap('__proto__'),false);p.start();
    assert.equal(p.setMap('plaza'),false);assert.equal(p.view(1).mapId,mapId);assert.equal(p.view(2).mapId,mapId);
    p.act(p.turn,'fold');p.start();assert.equal(p.view(1).mapId,mapId);
    assert.ok(p.view(1).players.find(x=>x.id===2).hole.every(c=>c===null),'map change cannot expose private cards');
  });
}
