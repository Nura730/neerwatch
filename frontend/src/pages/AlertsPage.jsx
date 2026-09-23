import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData.js';
import { getAlerts, getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { formatDateTime } from '../utils/format.js';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Clock,
  ArrowRight,
  Info
} from 'lucide-react';

export function AlertsPage() {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('active'); // 'all' | 'active' | 'resolved'
  const [filterWard, setFilterWard] = useState('');

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

  const displayedAlerts = alerts.filter(a => {
    if (filterStatus === 'resolved') return a.resolved;
    if (filterStatus === 'active') return !a.resolved;
    return true;
  });

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader
        title="Contamination Alerts"
        subtitle="Operational notifications generated automatically from detected water quality clusters to prompt ward-level public health investigation."
        action={
          <button
            type="button"
            className="btn btn--outline"
            onClick={refetch}
            disabled={loading}
            style={{ fontSize: '0.8125rem' }}
          >
            Refresh Alerts
          </button>
        }
      />

      {/* Synthetic Notice */}
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
          <strong>Operational Workflow:</strong> Alerts are triggered when test observations form spatial-temporal clusters. Field teams are dispatched to verify localized tap/source points.
        </span>
      </div>

      {/* Filter Toolbar */}
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
              { id: 'active', label: 'Active Alerts' },
              { id: 'all', label: 'All Alerts' },
              { id: 'resolved', label: 'Resolved' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  fontWeight: filterStatus === tab.id ? 600 : 400,
                  background: filterStatus === tab.id ? 'var(--nw-sidebar-active)' : 'transparent',
                  color: filterStatus === tab.id ? '#0284C7' : 'var(--nw-text-muted)',
                  border: filterStatus === tab.id ? '1px solid #BAE6FD' : '1px solid transparent',
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

      {/* State View */}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayedAlerts.map(alert => {
            const isHigh = alert.severity === 'high';
            const isResolved = alert.resolved;

            return (
              <div
                key={alert.id}
                style={{
                  background: 'var(--nw-card-bg)',
                  border: '1px solid var(--nw-card-border)',
                  borderLeft: isResolved
                    ? '4px solid #10B981'
                    : isHigh
                    ? '4px solid #DC2626'
                    : '4px solid #D97706',
                  borderRadius: 8,
                  padding: '16px 20px',
                  boxShadow: 'var(--nw-card-shadow)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 260 }}>
                  <div style={{
                    marginTop: 2,
                    padding: 8,
                    borderRadius: '50%',
                    background: isResolved
                      ? 'rgba(16,185,129,0.1)'
                      : isHigh
                      ? 'rgba(220,38,38,0.1)'
                      : 'rgba(217,119,6,0.1)',
                  }}>
                    {isResolved ? (
                      <CheckCircle2 size={20} color="#10B981" />
                    ) : (
                      <AlertTriangle size={20} color={isHigh ? '#DC2626' : '#D97706'} />
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--nw-text)' }}>
                        {alert.message}
                      </span>
                      <StatusBadge
                        label={alert.severity ? `${alert.severity.toUpperCase()} SEVERITY` : 'NOTICE'}
                        variant={alert.severity === 'high' ? 'fail' : 'warn'}
                        size="xs"
                      />
                      {isResolved && (
                        <StatusBadge label="Resolved" variant="pass" size="xs" />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--nw-text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} />
                        {alert.wardId}
                      </span>
                      <span>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        Triggered {formatDateTime(alert.createdAt)}
                      </span>
                      {alert.clusterId && (
                        <>
                          <span>·</span>
                          <span>Cluster Ref: <code>{alert.clusterId}</code></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => navigate(`/map?wardId=${alert.wardId}`)}
                    style={{ fontSize: '0.8125rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>View Map</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => navigate(`/clusters`)}
                    style={{ fontSize: '0.8125rem', padding: '6px 14px' }}
                  >
                    View Cluster
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
