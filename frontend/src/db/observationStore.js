/**
 * NEERWATCH Observation Store — src/db/observationStore.js
 *
 * All IndexedDB read/write operations for observations.
 * Keep database logic here; do not scatter db calls across components.
 *
 * syncStatus values:
 *   pending   — saved locally, not yet synced
 *   syncing   — currently being sent to backend
 *   synced    — backend confirmed creation
 *   failed    — backend rejected or network error
 *   duplicate — backend reported clientId already existed
 */

import db from './db.js';

/**
 * Save a new observation to IndexedDB.
 * @param {Object} observation — full observation object including clientId
 * @returns {number} The auto-incremented local id
 */
export async function saveObservation(observation) {
  return db.observations.add({
    ...observation,
    syncStatus: 'pending',
    createdAt: observation.createdAt || new Date().toISOString(),
  });
}

/**
 * Get all observations stored locally, newest first.
 */
export async function getAllObservations() {
  return db.observations.orderBy('createdAt').reverse().toArray();
}

/**
 * Get all observations with syncStatus === 'pending'.
 */
export async function getPendingObservations() {
  return db.observations.where('syncStatus').equals('pending').toArray();
}

/**
 * Get count of pending observations.
 */
export async function getPendingCount() {
  return db.observations.where('syncStatus').equals('pending').count();
}

/**
 * Mark a list of observations as 'syncing' before sending to backend.
 * @param {string[]} clientIds
 */
export async function markSyncing(clientIds) {
  return db.observations
    .where('clientId')
    .anyOf(clientIds)
    .modify({ syncStatus: 'syncing' });
}

/**
 * Mark an observation as 'synced' by clientId.
 * @param {string} clientId
 */
export async function markSynced(clientId) {
  return db.observations
    .where('clientId')
    .equals(clientId)
    .modify({ syncStatus: 'synced' });
}

/**
 * Mark an observation as 'failed' by clientId.
 * @param {string} clientId
 * @param {string} [reason]
 */
export async function markFailed(clientId, reason) {
  return db.observations
    .where('clientId')
    .equals(clientId)
    .modify({ syncStatus: 'failed', failReason: reason || null });
}

/**
 * Mark an observation as 'duplicate' by clientId.
 * @param {string} clientId
 */
export async function markDuplicate(clientId) {
  return db.observations
    .where('clientId')
    .equals(clientId)
    .modify({ syncStatus: 'duplicate' });
}

/**
 * Reset all 'syncing' observations back to 'pending'.
 * Called on app startup to recover from a mid-sync crash.
 */
export async function resetStuckSyncing() {
  return db.observations
    .where('syncStatus')
    .equals('syncing')
    .modify({ syncStatus: 'pending' });
}

/**
 * Reset a failed observation back to pending for retry.
 * @param {string} clientId
 */
export async function retryFailed(clientId) {
  return db.observations
    .where('clientId')
    .equals(clientId)
    .modify({ syncStatus: 'pending', failReason: null });
}

/**
 * Delete a locally stored observation by clientId.
 * @param {string} clientId
 */
export async function deleteObservation(clientId) {
  return db.observations.where('clientId').equals(clientId).delete();
}
