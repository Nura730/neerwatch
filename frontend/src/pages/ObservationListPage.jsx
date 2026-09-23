import { useState, useCallback } from 'react';
import { useApiData } from '../hooks/useApiData.js';
import { getTests, getWards } from '../services/api.js';
import { getAllObservations } from '../db/observationStore.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge, SyncStatusBadge } from '../components/ui/StatusBadge.jsx';
import { formatDateTime, testTypeLabel, testTypeUnit, formatNumber } from '../utils/format.js';
import { classifyResult } from '../services/mock.js';
import { MapPin, MapPinOff, Filter } from 'lucide-react';

const TEST_TYPES = ['TDS', 'pH', 'turbidity', 'coliform'];

export function ObservationListPage() {
  const [filters, setFilters] = useState({ wardId: '', testType: '', from: '', to: '' });
  const [showLocal, setShowLocal] = useState(true);
  const [localObs, setLocalObs] = useState([]);

  const fetchFn = useCallback(() => getTests(filters), [filters]);
  const wardFetch = useCallback(() => getWards(), []);

  const { data, loading, error, refetch } = useApiData(fetchFn, [filters]);
  const { data: wardData } = useApiData(wardFetch);
  const wards = wardData?.wards || [];

  // Load local observations on mount
  useState(() => {
    getAllObservations().then(setLocalObs);
  });

  const backendObs = data?.observations || [];
  // Merge: backend first, then local-only (pending/failed)
  const localOnly = localObs.filter(
    lo => !backendObs.find(bo => bo.clientId === lo.clientId)
  );
  const displayObs = showLocal ? [...localOnly, ...backendObs] : backendObs;

  return (
    <div>
      <PageHeader
        title="Observations"
        description={`${formatNumber(data?.total || backendObs.length)} total observations${localOnly.length > 0 ? ` · ${localOnly.length} local (unsynced)` : ''}`}
      />

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="nw-card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Filter size={14} color="var(--nw-text-muted)" style={{ marginBottom: 8 }} />
          <div>
            <label className="nw-label-text" htmlFor="filter-ward">Ward</label>
            <select
              id="filter-ward"
              className="nw-input nw-select"
              style={{ width: 180 }}
              value={filters.wardId}
              onChange={e => setFilters(f => ({ ...f, wardId: e.target.value }))}
            >
              <option value="">All wards</option>
              {wards.map(w => (
                <option key={w.wardId} value={w.wardId}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="nw-label-text" htmlFor="filter-type">Test Type</label>
            <select
              id="filter-type"
              className="nw-input nw-select"
              style={{ width: 140 }}
              value={filters.testType}
              onChange={e => setFilters(f => ({ ...f, testType: e.target.value }))}
            >
              <option value="">All types</option>
              {TEST_TYPES.map(t => <option key={t} value={t}>{testTypeLabel(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="nw-label-text" htmlFor="filter-from">From</label>
            <input
              id="filter-from"
              type="date"
              className="nw-input"
              style={{ width: 150 }}
              value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="nw-label-text" htmlFor="filter-to">To</label>
            <input
              id="filter-to"
              type="date"
              className="nw-input"
              style={{ width: 150 }}
              value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <input
              id="show-local"
              type="checkbox"
              checked={showLocal}
              onChange={e => setShowLocal(e.target.checked)}
            />
            <label htmlFor="show-local" style={{ fontSize: '0.8125rem', color: 'var(--nw-text-2)', cursor: 'pointer' }}>
              Include unsynced local
            </label>
          </div>
          <button className="nw-btn nw-btn-secondary nw-btn-sm" onClick={refetch}>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {loading && <LoadingState message="Loading observations…" />}
      {error   && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && displayObs.length === 0 && (
        <EmptyState title="No observations" message="No observations match the current filters." />
      )}
      {!loading && !error && displayObs.length > 0 && (
        <div className="nw-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="nw-table" aria-label="Observations list">
              <thead>
                <tr>
                  <th>Household</th>
                  <th>Test Type</th>
                  <th>Result</th>
                  <th>Classification</th>
                  <th>Ward</th>
                  <th>Date / Time</th>
                  <th>Location</th>
                  <th>Sync</th>
                </tr>
              </thead>
              <tbody>
                {displayObs.map(obs => {
                  const resultClass = classifyResult(obs.testType, obs.result);
                  return (
                    <tr key={obs.clientId}>
                      <td style={{ fontWeight: 500, color: 'var(--nw-text)' }}>
                        {obs.householdId}
                      </td>
                      <td>{testTypeLabel(obs.testType)}</td>
                      <td className="nw-mono">
                        {obs.result} {testTypeUnit(obs.testType)}
                      </td>
                      <td>
                        <StatusBadge
                          label={resultClass === 'fail' ? 'Elevated' : resultClass === 'pass' ? 'Within range' : 'Unknown'}
                          variant={resultClass === 'fail' ? 'fail' : resultClass === 'pass' ? 'pass' : 'neutral'}
                        />
                      </td>
                      <td style={{ color: 'var(--nw-text-muted)' }}>{obs.wardId}</td>
                      <td className="nw-mono" style={{ fontSize: '0.75rem' }}>
                        {formatDateTime(obs.testedAt)}
                      </td>
                      <td>
                        {obs.location ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--nw-text-muted)', fontSize: '0.75rem' }}>
                            <MapPin size={11} />
                            {obs.location.lat.toFixed(4)}, {obs.location.lng.toFixed(4)}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--nw-warn)', fontSize: '0.75rem' }}>
                            <MapPinOff size={11} />
                            Missing
                          </span>
                        )}
                      </td>
                      <td>
                        {obs.syncStatus
                          ? <SyncStatusBadge status={obs.syncStatus} />
                          : <StatusBadge label="Synced" variant="synced" />
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--nw-border)', fontSize: '0.75rem', color: 'var(--nw-text-muted)' }}>
              Showing {displayObs.length} of {formatNumber(data.total)} observations
              (page {data.page} · {data.limit} per page)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
