import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData.js';
import { getClusters, getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { ClusterEvidence } from '../components/ui/ClusterEvidence.jsx';
import {
  formatDate,
  formatDateTime,
  formatMetres,
  testTypeLabel
} from '../utils/format.js';
import {
  MapPin,
  Clock,
  Activity,
  ExternalLink,
  Info,
  Calendar,
  RefreshCw
} from 'lucide-react';

export function ClustersPage() {
  const navigate = useNavigate();
  const [filterActive, setFilterActive] = useState('active'); // 'all' | 'active' | 'resolved'
  const [filterWard, setFilterWard] = useState('');

  const fetchClusters = useCallback(() => {
    const params = {};
    if (filterActive === 'active') params.active = true;
    if (filterWard) params.wardId = filterWard;
    return getClusters(params);
  }, [filterActive, filterWard]);

  const { data: clustersData, loading, error, refetch } = useApiData(fetchClusters, [fetchClusters]);
  const { data: wardsData } = useApiData(getWards, []);

  const clusters = clustersData?.clusters || [];
  const wards = wardsData?.wards || [];

  // Filter client side if 'resolved' is chosen (since API supports active=true)
  const displayedClusters = clusters.filter(c => {
    if (filterActive === 'resolved') return !c.active;
    if (filterActive === 'active') return c.active;
    return true;
  });

  const activeFilters = [];
  if (filterActive !== 'all') activeFilters.push({ key: 'status', label: 'Status', value: filterActive === 'active' ? 'Active' : 'Resolved' });
  if (filterWard) activeFilters.push({ key: 'ward', label: 'Ward', value: filterWard });

  const handleRemoveFilter = (key) => {
    if (key === 'status') setFilterActive('all');
    if (key === 'ward') setFilterWard('');
  };

  const handleClearAll = () => {
    setFilterActive('all');
    setFilterWard('');
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Contamination Clusters"
        description="Spatially and temporally concentrated water test failures detected by deterministic algorithms (500m radius, 7-day window, ≥3 failing observations)."
        actions={
          <button
            type="button"
            className="nw-btn nw-btn-secondary"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh Clusters
          </button>
        }
      />

      <div className="bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] px-4 py-3 rounded flex items-start gap-3 text-sm mb-6">
        <Info size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Cluster Rule Notice:</strong> Clusters represent spatial-temporal concentrations of test failures meeting the threshold. They indicate areas requiring field sanitary inspection and verification.
        </div>
      </div>

      <FilterBar filters={activeFilters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAll}>
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Status</label>
          <select
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={filterActive}
            onChange={e => setFilterActive(e.target.value)}
          >
            <option value="active">Active Clusters</option>
            <option value="resolved">Resolved</option>
            <option value="all">All Clusters</option>
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

      {loading && <LoadingState message="Loading cluster records…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && displayedClusters.length === 0 && (
        <EmptyState
          message={
            filterActive === 'active'
              ? 'No active contamination clusters detected.'
              : 'No clusters match the selected criteria.'
          }
        />
      )}

      {!loading && !error && displayedClusters.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayedClusters.map(cluster => (
            <div
              key={cluster.id}
              className="bg-nw-surface border border-nw-border rounded-md shadow-nw-sm flex flex-col h-full hover:border-nw-teal/30 transition-colors"
            >
              {/* Header */}
              <div className="p-5 border-b border-nw-border bg-nw-surface-2 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge label="Possible Cluster" variant="cluster" size="xs" />
                    {cluster.active && <StatusBadge label="Active" variant="active" size="xs" />}
                    {!cluster.active && <StatusBadge label="Resolved" variant="pass" size="xs" />}
                  </div>
                  <div className="font-bold text-lg text-nw-text">
                    {testTypeLabel(cluster.testType)} Cluster
                  </div>
                  <div className="text-xs text-nw-text-muted flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1"><MapPin size={12} /> {cluster.wardId}</span>
                    <span>·</span>
                    <span>Radius: {formatMetres(cluster.radiusMetres)}</span>
                  </div>
                </div>
              </div>

              {/* Evidence & Details */}
              <div className="p-5 flex flex-col gap-6 flex-1">
                <ClusterEvidence cluster={cluster} />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-xs text-nw-text-muted flex flex-col gap-2 bg-nw-bg rounded p-3 border border-nw-border-2">
                    <div className="flex items-center gap-1.5"><Clock size={12} /> Detected: {formatDateTime(cluster.detectedAt)}</div>
                    <div className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(cluster.windowStart)} – {formatDate(cluster.windowEnd)}</div>
                  </div>
                  {cluster.centroid && (
                    <div className="text-xs text-nw-text-muted flex flex-col gap-2 bg-nw-bg rounded p-3 border border-nw-border-2 justify-center">
                      <div className="flex items-center gap-1.5">
                        <Activity size={12} className="shrink-0" />
                        <span>Centroid: {cluster.centroid.lat?.toFixed(4)}°N, {cluster.centroid.lng?.toFixed(4)}°E</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-nw-border bg-nw-surface-2 mt-auto">
                <button
                  type="button"
                  className="w-full nw-btn nw-btn-secondary"
                  onClick={() => navigate(`/map?wardId=${cluster.wardId}`)}
                >
                  Inspect On Geographic Map <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
