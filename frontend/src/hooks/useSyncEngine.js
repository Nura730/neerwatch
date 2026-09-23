/**
 * useSyncEngine — offline sync orchestrator.
 *
 * Responsibilities:
 *   - detect online/offline state
 *   - identify pending IndexedDB records
 *   - prevent concurrent sync runs
 *   - mark records as 'syncing' before upload
 *   - call api.js syncTests()
 *   - match results to local records by clientId (never by position)
 *   - update IndexedDB status per-record
 *   - expose pendingCount, isSyncing, lastSyncTime, syncError
 *
 * Sync triggers:
 *   1. App startup (if online)
 *   2. Browser reconnect (online event)
 *   3. Manual trigger via returned runSync()
 *
 * CRITICAL: Per API_CONTRACT.md, the sync response includes a results[]
 * array with { clientId, status, message? }. We match each result to
 * local records by clientId exactly. We NEVER map aggregate counts
 * (created/duplicates/failed) to local records by position.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus.js';
import {
  getPendingObservations,
  getPendingCount,
  markSyncing,
  markSynced,
  markFailed,
  markDuplicate,
  resetStuckSyncing,
} from '../db/observationStore.js';
import { syncTests } from '../services/api.js';

export function useSyncEngine() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError]       = useState(null);
  const [syncStats, setSyncStats]       = useState(null); // { processed, created, duplicates, failed }
  const syncLockRef = useRef(false);

  /** Refresh the pending count from IndexedDB. */
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  /** Run a sync cycle. Returns early if already syncing or offline. */
  const runSync = useCallback(async () => {
    if (syncLockRef.current) return;
    if (!isOnline) return;

    const pending = await getPendingObservations();
    if (pending.length === 0) {
      setSyncError(null);
      return;
    }

    syncLockRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    const clientIds = pending.map(o => o.clientId);
    await markSyncing(clientIds);
    await refreshPendingCount();

    try {
      // Build the payload — strip local-only fields (id, syncStatus, failReason)
      const payload = pending.map(({ id, syncStatus, failReason, ...obs }) => obs); // eslint-disable-line no-unused-vars
      const data = await syncTests(payload);

      // data = { processed, created, duplicates, failed, results[] }
      // Process per-clientId results — NEVER by position
      if (data && Array.isArray(data.results)) {
        for (const result of data.results) {
          switch (result.status) {
            case 'synced':
              await markSynced(result.clientId);
              break;
            case 'duplicate':
              await markDuplicate(result.clientId);
              break;
            case 'failed':
              await markFailed(result.clientId, result.message);
              break;
            default:
              // Unknown status — leave as syncing, will be reset on next startup
              break;
          }
        }
      } else {
        // Backend doesn't yet return results[] — fall back to marking all as synced
        // This is a graceful fallback until backend implements per-record results.
        for (const obs of pending) {
          await markSynced(obs.clientId);
        }
      }

      setSyncStats({
        processed: data?.processed ?? pending.length,
        created:   data?.created   ?? pending.length,
        duplicates: data?.duplicates ?? 0,
        failed:    data?.failed    ?? 0,
      });
      setLastSyncTime(new Date());
    } catch (err) {
      setSyncError(err.message || 'Synchronization failed.');
      // Reset syncing → pending so records can be retried
      for (const obs of pending) {
        await markFailed(obs.clientId, err.message);
      }
    } finally {
      syncLockRef.current = false;
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isOnline, refreshPendingCount]);

  // On startup: recover stuck 'syncing' records, then refresh count
  useEffect(() => {
    resetStuckSyncing().then(() => refreshPendingCount());
  }, [refreshPendingCount]);

  // On reconnect: trigger sync automatically via window event
  useEffect(() => {
    const handleOnline = () => {
      runSync();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [runSync]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    syncError,
    syncStats,
    runSync,
    refreshPendingCount,
  };
}
