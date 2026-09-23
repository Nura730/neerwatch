import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, EmptyState, LoadingState } from '../components/ui/States.jsx';
import { SyncStatusBadge } from '../components/ui/StatusBadge.jsx';
import {
  getAllObservations,
  retryFailed,
  deleteObservation,
  resetStuckSyncing
} from '../db/observationStore.js';
import { formatDateTime, formatRelative, testTypeLabel, testTypeUnit } from '../utils/format.js';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2
} from 'lucide-react';

export function SyncCenterPage() {
  const context = useOutletContext() || {};
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    syncError,
    syncStats,
    runSync,
    refreshPendingCount,
  } = context;

  const [localRecords, setLocalRecords] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'failed' | 'synced' | 'duplicate'

  const loadLocalRecords = useCallback(async () => {
    try {
      const records = await getAllObservations();
      setLocalRecords(records);
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    loadLocalRecords();
  }, [loadLocalRecords, pendingCount, isSyncing]);

  const handleRetry = async (clientId) => {
    await retryFailed(clientId);
    if (refreshPendingCount) await refreshPendingCount();
    await loadLocalRecords();
  };

  const handleDelete = async (clientId) => {
    if (window.confirm('Are you sure you want to remove this observation from local storage?')) {
      await deleteObservation(clientId);
      if (refreshPendingCount) await refreshPendingCount();
      await loadLocalRecords();
    }
  };

  const handleResetStuck = async () => {
    await resetStuckSyncing();
    if (refreshPendingCount) await refreshPendingCount();
    await loadLocalRecords();
  };

  const handleManualSync = async () => {
    if (runSync) {
      await runSync();
      await loadLocalRecords();
    }
  };

  // Counts by status in local database
  const counts = {
    pending: localRecords.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'syncing').length,
    synced: localRecords.filter(r => r.syncStatus === 'synced').length,
    failed: localRecords.filter(r => r.syncStatus === 'failed').length,
    duplicate: localRecords.filter(r => r.syncStatus === 'duplicate').length,
  };

  const filteredRecords = localRecords.filter(r => {
    if (filterTab === 'pending') return r.syncStatus === 'pending' || r.syncStatus === 'syncing';
    if (filterTab === 'failed') return r.syncStatus === 'failed';
    if (filterTab === 'synced') return r.syncStatus === 'synced';
    if (filterTab === 'duplicate') return r.syncStatus === 'duplicate';
    return true;
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader
        title="Sync Center & Offline Queue"
        subtitle="Manage offline-queued observations, monitor IndexedDB storage, and synchronize local observations with the central backend server."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn--outline"
              onClick={handleResetStuck}
              title="Reset any stuck syncing records to pending"
              style={{ fontSize: '0.8125rem' }}
            >
              Reset Stuck Records
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleManualSync}
              disabled={!isOnline || isSyncing || pendingCount === 0}
              style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isSyncing ? 'Syncing Now…' : 'Sync Pending Now'}</span>
            </button>
          </div>
        }
      />

      {/* Sync Status Alert Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Network & Engine State */}
        <div style={{
          background: 'var(--nw-card-bg)',
          border: '1px solid var(--nw-card-border)',
          borderRadius: 8,
          padding: '16px 20px',
          boxShadow: 'var(--nw-card-shadow)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)' }}>
              Network Connection
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: isOnline ? '#16A34A' : '#D97706',
            }}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>{isOnline ? 'Online (Connected)' : 'Offline (Disconnected)'}</span>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)', lineHeight: 1.5 }}>
            {isOnline ? (
              'Live connection to central gateway active. Pending records synchronize automatically.'
            ) : (
              'Operating in offline mode. Observations are stored safely in browser IndexedDB.'
            )}
          </div>

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--nw-card-border)', fontSize: '0.75rem', color: 'var(--nw-text-faint)' }}>
            Last Sync: {lastSyncTime ? formatRelative(lastSyncTime) : 'None recorded this session'}
          </div>
        </div>

        {/* Queue Metrics */}
        <div style={{
          background: 'var(--nw-card-bg)',
          border: '1px solid var(--nw-card-border)',
          borderRadius: 8,
          padding: '16px 20px',
          boxShadow: 'var(--nw-card-shadow)',
        }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)', marginBottom: 12 }}>
            IndexedDB Local Queue
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
            <div style={{ background: 'var(--nw-bg-subtle)', padding: '8px 4px', borderRadius: 6 }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: counts.pending > 0 ? '#D97706' : 'var(--nw-text)' }}>
                {counts.pending}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)' }}>Pending</div>
            </div>
            <div style={{ background: 'var(--nw-bg-subtle)', padding: '8px 4px', borderRadius: 6 }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#16A34A' }}>
                {counts.synced}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)' }}>Synced</div>
            </div>
            <div style={{ background: 'var(--nw-bg-subtle)', padding: '8px 4px', borderRadius: 6 }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: counts.failed > 0 ? '#DC2626' : 'var(--nw-text)' }}>
                {counts.failed}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)' }}>Failed</div>
            </div>
            <div style={{ background: 'var(--nw-bg-subtle)', padding: '8px 4px', borderRadius: 6 }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--nw-text-muted)' }}>
                {counts.duplicate}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)' }}>Duplicate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Error Notice if any */}
      {syncError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid #EF4444',
          borderRadius: 8,
          color: '#B91C1C',
          fontSize: '0.875rem',
          marginBottom: 20
        }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Synchronization Error:</strong> {syncError}
          </div>
        </div>
      )}

      {/* Last Sync Stats */}
      {syncStats && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid #10B981',
          borderRadius: 8,
          color: '#065F46',
          fontSize: '0.8125rem',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>
            Batch sync processed <strong>{syncStats.processed}</strong> records: <strong>{syncStats.created}</strong> inserted, <strong>{syncStats.duplicates}</strong> duplicates skipped, <strong>{syncStats.failed}</strong> failed.
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
        borderBottom: '1px solid var(--nw-card-border)',
        paddingBottom: 10,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: `All Local (${localRecords.length})` },
            { id: 'pending', label: `Pending Sync (${counts.pending})` },
            { id: 'failed', label: `Failed (${counts.failed})` },
            { id: 'synced', label: `Synced (${counts.synced})` },
            { id: 'duplicate', label: `Duplicate (${counts.duplicate})` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: '0.8125rem',
                fontWeight: filterTab === tab.id ? 600 : 400,
                background: filterTab === tab.id ? 'var(--nw-sidebar-active)' : 'transparent',
                color: filterTab === tab.id ? '#0284C7' : 'var(--nw-text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn--outline"
          onClick={loadLocalRecords}
          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
        >
          Refresh DB
        </button>
      </div>

      {/* Local Records Table */}
      {loadingDb ? (
        <LoadingState message="Reading local IndexedDB storage…" />
      ) : filteredRecords.length === 0 ? (
        <EmptyState message="No local observation records match this filter." />
      ) : (
        <div style={{
          background: 'var(--nw-card-bg)',
          border: '1px solid var(--nw-card-border)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: 'var(--nw-card-shadow)',
        }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sync Status</th>
                <th>Client ID / Household</th>
                <th>Ward</th>
                <th>Parameter & Result</th>
                <th>Sampled Timestamp</th>
                <th>GPS Location</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(obs => {
                const hasGps = obs.location && obs.location.lat != null && obs.location.lng != null;
                const isFailed = obs.syncStatus === 'failed';

                return (
                  <tr key={obs.clientId}>
                    <td>
                      <SyncStatusBadge status={obs.syncStatus} />
                      {obs.failReason && (
                        <div style={{ fontSize: '0.6875rem', color: '#DC2626', marginTop: 4, maxWidth: 160 }}>
                          {obs.failReason}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--nw-text)' }}>
                        {obs.householdId}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)' }}>
                        <code>{obs.clientId}</code>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem' }}>{obs.wardId}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)' }}>
                        {obs.result} {testTypeUnit(obs.testType)}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)' }}>
                        {testTypeLabel(obs.testType)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)' }}>
                        {formatDateTime(obs.testedAt)}
                      </span>
                    </td>
                    <td>
                      {hasGps ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--nw-text)' }}>
                          {obs.location.lat?.toFixed(4)}, {obs.location.lng?.toFixed(4)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.6875rem', color: '#D97706', fontWeight: 600 }}>
                          Missing GPS
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        {isFailed && (
                          <button
                            type="button"
                            className="btn btn--outline"
                            onClick={() => handleRetry(obs.clientId)}
                            title="Retry syncing this record"
                            style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#0284C7' }}
                          >
                            <RotateCcw size={12} style={{ marginRight: 4 }} />
                            Retry
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn--outline"
                          onClick={() => handleDelete(obs.clientId)}
                          title="Delete from local database"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#DC2626' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
