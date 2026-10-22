import { nivelOf, kitNivel, trackPieces, matagigantes } from './parts.js';
import { claimReceipt, receiptKey } from './cup-profile.js';
import { earnings } from './shop.js';

export function rewardCupStage(profile, { sessionId, stage, collected = 0, place = 99, profileId = 'local' }) {
  const key = receiptKey(sessionId, `stage-${stage}`, profileId);
  if (!claimReceipt(profile, key)) return 0;
  const amount = earnings({ collected, place });
  profile.wallet.coins += amount;
  return amount;
}

export function rewardCupCompletion(profile, { sessionId, trophy, profileId = 'local' }) {
  if (!trophy) return 0;
  const key = receiptKey(sessionId, 'cup-bonus', profileId);
  if (!claimReceipt(profile, key)) return 0;
  const amount = earnings({ trophy });
  profile.wallet.coins += amount;
  return amount;
}

// Shared settlement: the ceremony never owns money or repeats an award.
export function settleRace({race,profile,player,order,track,myId,trophy,record=false}) {
 if(race.paid || (race.netRace && race.cup && !race.cup.session.finalized?.[race.cup.session.stageIndex])) return false;
 race.paid=true;const session=race.cup?.session,rank=order.indexOf(player);
 const rec=session?.ledger.find(r=>r.stage===session.stageIndex && r.id===myId);
 const place=session ? rec?.classification==='finished' ? rec.place-1 : 99 : player.done || race.mode==='battle' ? rank : 99;
 const collected=player.coinsCollected||0;
 const use=trackPieces(track),pi=c=>kitNivel({car:nivelOf(c.tunes?.car ?? c.tune ?? c.def.tune),boat:nivelOf(c.tunes?.boat ?? c.def.tune),air:nivelOf(c.tunes?.plane ?? c.def.tune)},use);
 const giants=player.done&&!player.dns?matagigantes(pi(player),order.slice(rank+1).map(c=>({name:c.name,pi:pi(c)}))):{giants:[],bonus:0};
 const giant=giants.bonus;
 const extra=giant+(record?5:0);
 let earned=0;
 if(session) {
  earned=rewardCupStage(profile,{sessionId:session.sessionId,stage:session.stageIndex,collected,place});
  if(session.status==='complete') earned+=rewardCupCompletion(profile,{sessionId:session.sessionId,trophy});
  if(extra && claimReceipt(profile,receiptKey(session.sessionId,`extras-${session.stageIndex}`))) {profile.wallet.coins+=extra;earned+=extra;}
 } else {earned=earnings({collected,place})+extra;profile.wallet.coins+=earned;}
 race.earned=(race.earned||0)+earned;race.rewardDetail={collected,giant,record:record?5:0,giants:giants.giants,podium:earnings({place}),cup:session?.status==='complete'?earnings({trophy}):0,prizes:Math.max(0,earned-collected-extra)};
 return true;
}
