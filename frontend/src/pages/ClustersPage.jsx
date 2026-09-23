import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData.js';
import { getClusters, getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import {
  formatDate,
  formatDateTime,
  formatMetres,
  formatRate,
  testTypeLabel
} from '../utils/format.js';
import {
  MapPin,
  Clock,
  Activity,
  ExternalLink,
  Info,
  Calendar
} from 'lucide-react';

export function ClustersPage() {
  const navigate = useNavigate();
  const [filterActive, setFilterActive] = useState('active'); // 'all' | 'active' | 'resolved'
  const [filterWard, setFilterWard] = useState('');
  const [selectedCluster, setSelectedCluster] = useState(null);

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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader
        title="Contamination Clusters"
        subtitle="Spatially and temporally concentrated water test failures detected by deterministic, rule-based algorithms (500m radius, 7-day window, ≥3 failing observations)."
        action={
          <button
            type="button"
            className="btn btn--outline"
            onClick={refetch}
            disabled={loading}
            style={{ fontSize: '0.8125rem' }}
          >
            Refresh
          </button>
        }
      />

      {/* Synthetic data banner */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(2,132,199,0.06)',
        border: '1px solid #BAE6FD',
        borderRadius: 6,
        fontSize: '0.8125rem',
        color: '#0369A1',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Info size={16} />
        <span>
          <strong>Cluster Rule Notice:</strong> Clusters represent spatial-temporal concentrations of test failures meeting the threshold. They indicate areas requiring field sanitary inspection and verification.
        </span>
      </div>

      {/* Filters Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
        background: 'var(--nw-card-bg)',
        border: '1px solid var(--nw-card-border)',
        borderRadius: 8,
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)' }}>Status:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'active', label: 'Active Clusters' },
              { id: 'all', label: 'All Clusters' },
              { id: 'resolved', label: 'Resolved' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterActive(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  fontWeight: filterActive === tab.id ? 600 : 400,
                  background: filterActive === tab.id ? 'var(--nw-sidebar-active)' : 'transparent',
                  color: filterActive === tab.id ? '#0284C7' : 'var(--nw-text-muted)',
                  border: filterActive === tab.id ? '1px solid #BAE6FD' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)' }}>Ward:</span>
          <select
            value={filterWard}
            onChange={(e) => setFilterWard(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid var(--nw-card-border)',
              background: 'var(--nw-bg)',
              color: 'var(--nw-text)',
              fontSize: '0.8125rem',
            }}
          >
            <option value="">All Wards</option>
            {wards.map(w => (
              <option key={w.wardId} value={w.wardId}>
                {w.name || w.wardId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content State */}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 }}>
          {displayedClusters.map(cluster => {
            const isSelected = selectedCluster?.id === cluster.id;
            return (
              <div
                key={cluster.id}
                onClick={() => setSelectedCluster(isSelected ? null : cluster)}
                style={{
                  background: 'var(--nw-card-bg)',
                  border: isSelected ? '2px solid #0284C7' : '1px solid var(--nw-card-border)',
                  borderRadius: 8,
                  padding: '18px 20px',
                  boxShadow: 'var(--nw-card-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--nw-text)' }}>
                        {testTypeLabel(cluster.testType)} Cluster
                      </span>
                      <StatusBadge
                        label={cluster.active ? 'Active' : 'Resolved'}
                        variant={cluster.active ? 'cluster' : 'pass'}
                        size="xs"
                      />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} />
                      <span>{cluster.wardId}</span>
                      <span>·</span>
                      <span>Radius: {formatMetres(cluster.radiusMetres)}</span>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  background: 'var(--nw-bg-subtle)',
                  padding: '10px 14px',
                  borderRadius: 6,
                }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Observations
                    </div>
                    <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--nw-text)' }}>
                      {cluster.observationCount} failing
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Failure Rate
                    </div>
                    <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#DC2626' }}>
                      {formatRate(cluster.failureRate)}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} />
                    <span>Detected: {formatDateTime(cluster.detectedAt)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={12} />
                    <span>
                      Window: {formatDate(cluster.windowStart)} – {formatDate(cluster.windowEnd)}
                    </span>
                  </div>
                  {cluster.centroid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={12} />
                      <span>
                        Centroid: {cluster.centroid.lat?.toFixed(4)}°N, {cluster.centroid.lng?.toFixed(4)}°E
                      </span>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--nw-card-border)' }}>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => navigate(`/map?wardId=${cluster.wardId}`)}
                    style={{
                      width: '100%',
                      fontSize: '0.8125rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <span>Inspect On Geographic Map</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
