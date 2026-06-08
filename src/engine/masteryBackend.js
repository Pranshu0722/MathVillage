// Resolves the active mastery backend from the feature flag and presents ONE
// uniform interface to engineAPI. BKT is always bundled (pure JS, tiny).
// DKT is dynamically imported only when VITE_MASTERY_BACKEND=dkt, so TF.js
// (~2 MB) is excluded from the default bundle entirely.
import { MASTERY_BACKEND } from './backendConfig';
import * as bkt from './masteryModel';

let _dkt = null;

/** Idempotent readiness hook. No-op for BKT; lazy-loads TF.js model for DKT. */
export async function ensureBackendReady() {
  if (MASTERY_BACKEND === 'dkt') {
    _dkt = await import('./masteryModelDKT');
    if (typeof _dkt.loadModel === 'function') await _dkt.loadModel();
  }
}

function _backend() {
  return _dkt ?? bkt;
}

export const activeBackend = {
  createInitialBelief: (...args) => _backend().createInitialBelief(...args),
  updateBelief: (...args) => _backend().updateBelief(...args),
  getMastery: (...args) => _backend().getMastery(...args),
};
