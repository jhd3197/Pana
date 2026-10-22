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
