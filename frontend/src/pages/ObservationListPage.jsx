import React, { useState, useCallback } from 'react';
import { useApiData } from '../hooks/useApiData.js';
import { getTests, getWards } from '../services/api.js';
import { getAllObservations } from '../db/observationStore.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge, SyncStatusBadge } from '../components/ui/StatusBadge.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { ObservationDetailDrawer } from '../components/ui/ObservationDetailDrawer.jsx';
import { formatDateTime, testTypeLabel, testTypeUnit, formatNumber } from '../utils/format.js';
import { classifyResult } from '../services/mock.js';
import { MapPin, MapPinOff, RefreshCw, Eye, Plus } from 'lucide-react';

import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { canCreateTest } from '../auth/permissions.js';

const TEST_TYPES = ['TDS', 'pH', 'turbidity', 'coliform'];

export function ObservationListPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ wardId: '', testType: '', from: '', to: '' });
  const [showLocal, setShowLocal] = useState(true);
  const [localObs, setLocalObs] = useState([]);
  const [selectedObs, setSelectedObs] = useState(null);

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

  const activeFilters = [];
  if (filters.wardId) activeFilters.push({ key: 'wardId', label: 'Ward', value: filters.wardId });
  if (filters.testType) activeFilters.push({ key: 'testType', label: 'Type', value: testTypeLabel(filters.testType) });
  if (filters.from) activeFilters.push({ key: 'from', label: 'From', value: filters.from });
  if (filters.to) activeFilters.push({ key: 'to', label: 'To', value: filters.to });
  if (!showLocal) activeFilters.push({ key: 'showLocal', label: 'Local', value: 'Hidden' });

  const handleRemoveFilter = (key) => {
    if (key === 'showLocal') setShowLocal(true);
    else setFilters(f => ({ ...f, [key]: '' }));
  };

  const handleClearAll = () => {
    setFilters({ wardId: '', testType: '', from: '', to: '' });
    setShowLocal(true);
  };

  const columns = [
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (obs) => {
        const resultClass = classifyResult(obs.testType, obs.result);
        return <StatusBadge label={resultClass === 'fail' ? 'Elevated' : resultClass === 'pass' ? 'Normal' : 'Unknown'} variant={resultClass === 'fail' ? 'fail' : resultClass === 'pass' ? 'pass' : 'neutral'} />;
      }
    },
    {
      key: 'testType',
      header: 'Parameter',
      render: (obs) => <span className="font-semibold text-nw-text">{testTypeLabel(obs.testType)}</span>
    },
    {
      key: 'result',
      header: 'Result',
      render: (obs) => <span className="font-mono text-sm">{obs.result} <span className="text-nw-text-faint">{testTypeUnit(obs.testType)}</span></span>
    },
    {
      key: 'wardId',
      header: 'Ward',
      render: (obs) => <span className="text-sm">Ward {obs.wardId}</span>
    },
    {
      key: 'location',
      header: 'Location',
      render: (obs) => (
        obs.location ? (
          <span className="flex items-center gap-1 text-xs text-nw-text-muted font-mono">
            <MapPin size={11} className="text-nw-teal" /> {obs.location.lat.toFixed(4)}, {obs.location.lng.toFixed(4)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-nw-warn font-medium">
            <MapPinOff size={11} /> Missing
          </span>
        )
      )
    },
    {
      key: 'testedAt',
      header: 'Tested',
      render: (obs) => <span className="text-xs text-nw-text-muted">{formatDateTime(obs.testedAt)}</span>
    },
    {
      key: 'syncStatus',
      header: 'Sync Status',
      render: (obs) => <SyncStatusBadge status={obs.syncStatus || 'synced'} />
    },
    {
      key: 'action',
      header: 'Action',
      render: (obs) => (
        <button 
          onClick={(e) => { e.stopPropagation(); setSelectedObs(obs); }}
          className="text-nw-navy hover:text-nw-teal p-1 rounded hover:bg-nw-surface-2 transition-colors flex items-center justify-center"
          title="View details"
        >
          <Eye size={16} />
        </button>
      )
    }
  ];

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Field Observations"
        description={`${formatNumber(data?.total || backendObs.length)} total observations${localOnly.length > 0 ? ` · ${localOnly.length} local (unsynced)` : ''}`}
        actions={
          <div className="flex gap-2">
            <button className="nw-btn nw-btn-secondary" onClick={refetch}>
              <RefreshCw size={14} /> Refresh
            </button>
            {user && canCreateTest(user.role) && (
              <Link to="/observations/new" className="nw-btn nw-btn-primary">
                <Plus size={14} /> Create Test
              </Link>
            )}
          </div>
        }
      />

      <FilterBar 
        filters={activeFilters} 
        onRemoveFilter={handleRemoveFilter} 
        onClearAll={handleClearAll}
      >
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1" htmlFor="filter-ward">Ward</label>
          <select
            id="filter-ward"
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={filters.wardId}
            onChange={e => setFilters(f => ({ ...f, wardId: e.target.value }))}
          >
            <option value="">All wards</option>
            {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1" htmlFor="filter-type">Parameter</label>
          <select
            id="filter-type"
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={filters.testType}
            onChange={e => setFilters(f => ({ ...f, testType: e.target.value }))}
          >
            <option value="">All parameters</option>
            {TEST_TYPES.map(t => <option key={t} value={t}>{testTypeLabel(t)}</option>)}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1" htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            className="nw-input text-sm py-1.5 min-w-[130px]"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1" htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            className="nw-input text-sm py-1.5 min-w-[130px]"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2 mt-5 ml-2">
          <input
            id="show-local"
            type="checkbox"
            checked={showLocal}
            onChange={e => setShowLocal(e.target.checked)}
            className="w-4 h-4 text-nw-teal rounded border-nw-border-2 focus:ring-nw-teal"
          />
          <label htmlFor="show-local" className="text-sm text-nw-text-2 cursor-pointer font-medium">
            Include unsynced
          </label>
        </div>
      </FilterBar>

      {loading && <LoadingState message="Loading observations…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      
      {!loading && !error && (
        <>
          <DataTable 
            columns={columns} 
            data={displayObs} 
            onRowClick={(obs) => setSelectedObs(obs)}
            emptyState={<EmptyState title="No observations" message="No observations match the current filters." />}
          />
          
          {data && displayObs.length > 0 && (
            <div className="flex items-center justify-between text-xs text-nw-text-muted mt-3 px-1">
              <span>Showing {displayObs.length} of {formatNumber(data.total)} observations</span>
              <span>Page {data.page} (max {data.limit} per page)</span>
            </div>
          )}
        </>
      )}

      {selectedObs && (
        <ObservationDetailDrawer 
          observation={selectedObs} 
          onClose={() => setSelectedObs(null)} 
        />
      )}
    </div>
  );
}
