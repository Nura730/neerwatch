import { useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, ArrowRight, MapPin, RefreshCw } from 'lucide-react';
import { useApiData } from '../hooks/useApiData.js';
import { getDashboard, getClusters, getAlerts } from '../services/api.js';
import { StatCard } from '../components/ui/StatCard.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { LoadingState, ErrorState, PageHeader } from '../components/ui/States.jsx';
import { formatDateTime, formatMetres, testTypeLabel, formatNumber } from '../utils/format.js';

export function DashboardPage() {
  const { pendingCount } = useOutletContext();
  const dashFetch  = useCallback(() => getDashboard(), []);
  const clusterFetch = useCallback(() => getClusters({ active: true }), []);
  const alertFetch = useCallback(() => getAlerts({ active: true }), []);

  const { data: dash,     loading: dashLoading,     error: dashError,     refetch: refetchDash }   = useApiData(dashFetch);
  const { data: clusterD, loading: clusterLoading,  error: clusterError }  = useApiData(clusterFetch);
  const { data: alertD,   loading: alertLoading,    error: alertError }    = useApiData(alertFetch);

  const activeClusters = clusterD?.clusters || [];
  const activeAlerts   = alertD?.alerts || [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="System-wide water quality monitoring overview — Ernakulam / Kochi"
        actions={
          <button className="nw-btn nw-btn-secondary nw-btn-sm" onClick={refetchDash} aria-label="Refresh dashboard">
            <RefreshCw size={13} />
            Refresh
          </button>
        }
      />

      {/* ── Synthetic data notice ─────────────────────────────────────────── */}
      <div className="synthetic-banner" style={{ marginBottom: 20 }}>
        <AlertTriangle size={13} />
        Synthetic demonstration data — not real public-health measurements.
      </div>

      {/* ── Key metrics ──────────────────────────────────────────────────── */}
      <section aria-label="Key metrics">
        {dashLoading && <LoadingState message="Loading metrics…" />}
        {dashError   && <ErrorState  message={dashError} onRetry={refetchDash} />}
        {dash && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard
              label="Total Observations"
              value={formatNumber(dash.totalTests)}
              subtext="All time"
            />
            <StatCard
              label="Positive Observations"
              value={formatNumber(dash.positiveTests)}
              subtext={dash.totalTests ? `${Math.round(dash.positiveTests / dash.totalTests * 100)}% of total` : ''}
              variant="alert"
            />
            <StatCard
              label="Active Clusters"
              value={dash.activeClusters}
              subtext="Possible contamination clusters"
              variant={dash.activeClusters > 0 ? 'alert' : 'pass'}
            />
            <StatCard
              label="Pending Sync"
              value={pendingCount}
              subtext="Observations awaiting upload"
              variant={pendingCount > 0 ? 'warn' : undefined}
            />
            {dash.missingLocations > 0 && (
              <StatCard
                label="Missing Locations"
                value={dash.missingLocations}
                subtext="Excluded from map"
                variant="warn"
              />
            )}
          </div>
        )}
      </section>

      {/* ── Attention Required ────────────────────────────────────────────── */}
      {(activeClusters.length > 0 || activeAlerts.length > 0) && (
        <section aria-label="Attention required" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--nw-text)', marginBottom: 12 }}>
            Attention Required
          </h2>

          {clusterLoading && <LoadingState message="Loading clusters…" />}
          {clusterError   && <p style={{ color: 'var(--nw-fail)', fontSize: '0.875rem' }}>{clusterError}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeClusters.map(cluster => (
              <AttentionCard key={cluster.id} cluster={cluster} />
            ))}
            {alertLoading && <LoadingState message="Loading alerts…" />}
            {alertError   && <p style={{ color: 'var(--nw-fail)', fontSize: '0.875rem' }}>{alertError}</p>}
            {activeAlerts.map(alert => (
              <AlertAttentionCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {/* ── Quick links ───────────────────────────────────────────────────── */}
      <section aria-label="Quick actions">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--nw-text)', marginBottom: 12 }}>
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/observations/new" className="nw-btn nw-btn-primary">
            Record Observation
          </Link>
          <Link to="/map" className="nw-btn nw-btn-secondary">
            <MapPin size={14} /> Open Map
          </Link>
          <Link to="/sync" className="nw-btn nw-btn-secondary">
            <RefreshCw size={14} /> Sync Center
          </Link>
        </div>
      </section>
    </div>
  );
}

function AttentionCard({ cluster }) {
  return (
    <div className="attention-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <StatusBadge label="Possible Cluster" variant="cluster" />
          <StatusBadge label={testTypeLabel(cluster.testType)} variant="neutral" />
          <StatusBadge label={cluster.wardId} variant="neutral" size="xs" />
        </div>
        <Link to="/map" style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: '0.75rem', color: 'var(--nw-navy)', textDecoration: 'none', fontWeight: 500,
        }}>
          View on Map <ArrowRight size={11} />
        </Link>
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--nw-text-2)' }}>
        <strong>{cluster.observationCount}</strong> positive observations
        {' '}within approximately <strong>{formatMetres(cluster.radiusMetres)}</strong>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)', marginTop: 4 }}>
        Detected {formatDateTime(cluster.detectedAt)}
      </div>
    </div>
  );
}

function AlertAttentionCard({ alert }) {
  return (
    <div className="attention-card" style={{ borderLeftColor: 'var(--nw-warn)' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <StatusBadge label="Alert" variant="warn" />
        <StatusBadge label={alert.severity === 'high' ? 'High severity' : alert.severity} variant={alert.severity === 'high' ? 'fail' : 'warn'} />
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--nw-text-2)' }}>{alert.message}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)', marginTop: 4 }}>
        {formatDateTime(alert.createdAt)} · Ward {alert.wardId}
      </div>
    </div>
  );
}
