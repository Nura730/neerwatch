import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader, EmptyState, LoadingState } from '../components/ui/States.jsx';
import { SyncStatusBadge } from '../components/ui/StatusBadge.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { MetricCard } from '../components/ui/MetricCard.jsx';
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
  Trash2,
  Activity
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

  const activeFilters = [];
  if (filterTab !== 'all') activeFilters.push({ key: 'status', label: 'Status Filter', value: filterTab.charAt(0).toUpperCase() + filterTab.slice(1) });

  const handleRemoveFilter = () => setFilterTab('all');
  const handleClearAll = () => setFilterTab('all');

  const columns = [
    {
      key: 'syncStatus',
      header: 'Sync Status',
      render: (obs) => (
        <div className="flex flex-col gap-1 items-start">
          <SyncStatusBadge status={obs.syncStatus} />
          {obs.failReason && (
            <div className="text-[10px] font-medium text-nw-fail max-w-[160px] leading-tight">
              {obs.failReason}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'clientId',
      header: 'Client ID / Household',
      render: (obs) => (
        <div>
          <div className="font-semibold text-nw-text">{obs.householdId}</div>
          <div className="text-[10px] text-nw-text-faint font-mono mt-0.5">{obs.clientId}</div>
        </div>
      )
    },
    {
      key: 'wardId',
      header: 'Ward',
      render: (obs) => <span className="text-sm">Ward {obs.wardId}</span>
    },
    {
      key: 'result',
      header: 'Parameter & Result',
      render: (obs) => (
        <div>
          <div className="font-bold text-sm text-nw-text">
            {obs.result} <span className="text-[10px] font-normal text-nw-text-faint">{testTypeUnit(obs.testType)}</span>
          </div>
          <div className="text-[10px] font-semibold text-nw-text-muted mt-0.5 tracking-wider uppercase">
            {testTypeLabel(obs.testType)}
          </div>
        </div>
      )
    },
    {
      key: 'testedAt',
      header: 'Sampled Timestamp',
      render: (obs) => <span className="text-xs text-nw-text-muted">{formatDateTime(obs.testedAt)}</span>
    },
    {
      key: 'location',
      header: 'GPS Location',
      render: (obs) => {
        const hasGps = obs.location && obs.location.lat != null && obs.location.lng != null;
        return hasGps ? (
          <span className="text-[11px] font-mono text-nw-text-2">
            {obs.location.lat?.toFixed(4)}, {obs.location.lng?.toFixed(4)}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-nw-warn">Missing GPS</span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (obs) => {
        const isFailed = obs.syncStatus === 'failed';
        return (
          <div className="flex justify-end gap-2">
            {isFailed && (
              <button
                type="button"
                className="text-[#0284C7] hover:bg-[#E0F2FE] p-1.5 rounded transition-colors"
                onClick={() => handleRetry(obs.clientId)}
                title="Retry syncing this record"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              type="button"
              className="text-nw-fail hover:bg-nw-fail-bg p-1.5 rounded transition-colors"
              onClick={() => handleDelete(obs.clientId)}
              title="Delete from local database"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Sync Center & Offline Queue"
        description="Manage offline-queued observations, monitor IndexedDB storage, and synchronize local observations with the central backend server."
        actions={
          <div className="flex gap-3">
            <button
              type="button"
              className="nw-btn nw-btn-secondary"
              onClick={handleResetStuck}
              title="Reset any stuck syncing records to pending"
            >
              Reset Stuck
            </button>
            <button
              type="button"
              className="nw-btn nw-btn-primary flex items-center gap-2"
              onClick={handleManualSync}
              disabled={!isOnline || isSyncing || pendingCount === 0}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing Now…' : 'Sync Pending Now'}</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Network & Engine State */}
        <div className="bg-nw-surface border border-nw-border rounded-md p-6 shadow-nw-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-nw-text uppercase tracking-wide">
                Network Connection
              </span>
              <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full ${isOnline ? 'bg-nw-pass-bg text-nw-pass' : 'bg-nw-warn-bg text-nw-warn'}`}>
                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span>{isOnline ? 'Online (Connected)' : 'Offline (Disconnected)'}</span>
              </div>
            </div>

            <p className="text-sm text-nw-text-muted leading-relaxed mb-4">
              {isOnline ? (
                'Live connection to central gateway active. Pending records synchronize automatically when connection is restored.'
              ) : (
                'Operating in offline mode. Observations are stored safely in browser IndexedDB.'
              )}
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-nw-border flex items-center gap-2 text-xs font-medium text-nw-text-muted">
            <Activity size={14} />
            Last Sync: {lastSyncTime ? formatRelative(lastSyncTime) : 'None recorded this session'}
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="bg-nw-surface border border-nw-border rounded-md p-6 shadow-nw-sm">
          <div className="text-sm font-bold text-nw-text uppercase tracking-wide mb-4">
            IndexedDB Local Queue
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Pending" value={counts.pending} variant={counts.pending > 0 ? 'warn' : 'neutral'} />
            <MetricCard label="Failed" value={counts.failed} variant={counts.failed > 0 ? 'alert' : 'neutral'} />
            <MetricCard label="Synced" value={counts.synced} variant="pass" />
            <MetricCard label="Duplicate" value={counts.duplicate} variant="neutral" />
          </div>
        </div>
      </div>

      {/* Sync Error Notice if any */}
      {syncError && (
        <div className="flex items-center gap-3 p-4 bg-nw-fail-bg border border-nw-fail/30 rounded-md text-nw-fail text-sm font-medium mb-6">
          <AlertTriangle size={18} className="shrink-0" />
          <div>
            <strong>Synchronization Error:</strong> {syncError}
          </div>
        </div>
      )}

      {/* Last Sync Stats */}
      {syncStats && (
        <div className="flex items-center gap-3 p-4 bg-nw-pass-bg border border-nw-pass/30 rounded-md text-nw-pass text-sm font-medium mb-6">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>
            Batch sync processed <strong>{syncStats.processed}</strong> records: <strong>{syncStats.created}</strong> inserted, <strong>{syncStats.duplicates}</strong> duplicates skipped, <strong>{syncStats.failed}</strong> failed.
          </span>
        </div>
      )}

      <FilterBar filters={activeFilters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAll}>
        <div className="flex items-center gap-2">
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filterTab === tab.id 
                  ? 'bg-[#0284C7] text-white' 
                  : 'bg-nw-surface-2 text-nw-text-muted hover:text-nw-text hover:bg-nw-surface-3 border border-nw-border-2'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </FilterBar>

      {/* Local Records Table */}
      {loadingDb ? (
        <LoadingState message="Reading local IndexedDB storage…" />
      ) : filteredRecords.length === 0 ? (
        <EmptyState message="No local observation records match this filter." />
      ) : (
        <DataTable columns={columns} data={filteredRecords} />
      )}
    </div>
  );
}
