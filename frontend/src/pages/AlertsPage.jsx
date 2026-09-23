import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData.js';
import { getAlerts, getWards, resolveAlert } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { formatDateTime } from '../utils/format.js';
import {
  Info,
  MapPin,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { canResolveAlert } from '../auth/permissions.js';

export function AlertsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('active'); // 'all' | 'active' | 'resolved'
  const [filterWard, setFilterWard] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  const fetchAlerts = useCallback(() => {
    const params = {};
    if (filterStatus === 'active') params.active = true;
    if (filterWard) params.wardId = filterWard;
    return getAlerts(params);
  }, [filterStatus, filterWard]);

  const { data: alertsData, loading, error, refetch } = useApiData(fetchAlerts, [fetchAlerts]);
  const { data: wardsData } = useApiData(getWards, []);

  const alerts = alertsData?.alerts || [];
  const wards = wardsData?.wards || [];

  const handleResolve = async (id) => {
    try {
      setResolvingId(id);
      await resolveAlert(id);
      await refetch();
    } catch (err) {
      alert(`Failed to resolve alert: ${err.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const displayedAlerts = alerts.filter(a => {
    if (filterStatus === 'resolved') return a.resolved;
    if (filterStatus === 'active') return !a.resolved;
    return true;
  });

  const activeFilters = [];
  if (filterStatus !== 'all') activeFilters.push({ key: 'status', label: 'Status', value: filterStatus === 'active' ? 'Active' : 'Resolved' });
  if (filterWard) activeFilters.push({ key: 'ward', label: 'Ward', value: filterWard });

  const handleRemoveFilter = (key) => {
    if (key === 'status') setFilterStatus('all');
    if (key === 'ward') setFilterWard('');
  };

  const handleClearAll = () => {
    setFilterStatus('all');
    setFilterWard('');
  };

  const columns = [
    {
      key: 'severity',
      header: 'Severity',
      width: '10%',
      render: (a) => (
        <StatusBadge 
          label={a.severity ? `${a.severity.toUpperCase()}` : 'NOTICE'} 
          variant={a.severity === 'high' ? 'fail' : 'warn'} 
        />
      )
    },
    {
      key: 'message',
      header: 'Title / Message',
      width: '35%',
      render: (a) => <span className="font-semibold text-nw-text">{a.message || a.title}</span>
    },
    {
      key: 'wardId',
      header: 'Ward',
      render: (a) => <span className="text-sm">Ward {a.wardId}</span>
    },
    {
      key: 'clusterId',
      header: 'Cluster Ref',
      render: (a) => a.clusterId ? <span className="font-mono text-xs text-nw-text-muted">{a.clusterId}</span> : <span className="text-nw-text-faint">—</span>
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (a) => <span className="text-xs text-nw-text-muted">{formatDateTime(a.createdAt)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        a.resolved 
          ? <StatusBadge label="Resolved" variant="pass" /> 
          : <StatusBadge label="Under Investigation" variant="neutral" />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate(`/map?wardId=${a.wardId}`)}
            className="nw-btn nw-btn-secondary nw-btn-sm"
          >
            <MapPin size={14} /> View Map
          </button>
          {!a.resolved && user && canResolveAlert(user.role) && (
            <button
              onClick={() => handleResolve(a.id)}
              disabled={resolvingId === a.id}
              className="nw-btn nw-btn-primary nw-btn-sm"
            >
              <CheckCircle size={14} /> {resolvingId === a.id ? 'Resolving...' : 'Resolve'}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Contamination Alerts"
        description="Operational notifications generated automatically from detected water quality clusters to prompt ward-level public health investigation."
        actions={
          <button
            type="button"
            className="nw-btn nw-btn-secondary"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh Alerts
          </button>
        }
      />

      {/* Synthetic Notice */}
      <div className="bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] px-4 py-3 rounded flex items-start gap-3 text-sm mb-6">
        <Info size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Operational Workflow:</strong> Alerts are triggered when test observations form spatial-temporal clusters. Field teams are dispatched to verify localized tap/source points.
        </div>
      </div>

      <FilterBar filters={activeFilters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAll}>
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Status</label>
          <select
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="active">Active (Open)</option>
            <option value="resolved">Resolved</option>
            <option value="all">All Alerts</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Ward</label>
          <select
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={filterWard}
            onChange={e => setFilterWard(e.target.value)}
          >
            <option value="">All Wards</option>
            {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.name || w.wardId}</option>)}
          </select>
        </div>
      </FilterBar>

      {loading && <LoadingState message="Loading alert logs…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && displayedAlerts.length === 0 && (
        <EmptyState
          message={
            filterStatus === 'active'
              ? 'No active contamination alerts in the system.'
              : 'No alerts match the current filter.'
          }
        />
      )}

      {!loading && !error && displayedAlerts.length > 0 && (
        <DataTable 
          columns={columns} 
          data={displayedAlerts} 
        />
      )}
    </div>
  );
}
