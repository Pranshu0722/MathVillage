import { recordAttempt } from '../engine/engineAPI';

export async function safeRecordAttempt(args) {
  try {
    await recordAttempt(args);
  } catch (e) {
    console.error('[Engine] recordAttempt failed:', e);
    window.dispatchEvent(new CustomEvent('game-engine-error'));
  }
}
