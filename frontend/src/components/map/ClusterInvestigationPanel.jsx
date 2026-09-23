import { formatDateTime, formatMetres, formatRate, testTypeLabel } from '../../utils/format.js';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { X, MapPin, Clock, Activity, CloudRain } from 'lucide-react';

/**
 * ClusterInvestigationPanel — right-side panel opened when a cluster is clicked.
 * Displays all contract fields. Never navigates away.
 * Uses "Possible contamination cluster" — never "Confirmed".
 */
export function ClusterInvestigationPanel({ cluster, rainfallData, onClose }) {
  if (!cluster) return null;

  const wardRainfall = rainfallData
    ? rainfallData.filter(r => r.wardId === cluster.wardId)
    : [];
  const totalRainfall = wardRainfall.reduce((sum, r) => sum + r.rainfallMm, 0);

  return (
    <aside className="cluster-panel" aria-label="Cluster investigation panel">
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--nw-border)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StatusBadge label="Possible Cluster" variant="cluster" />
            {cluster.active && <StatusBadge label="Active" variant="active" />}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--nw-text)' }}>
            {testTypeLabel(cluster.testType)} — {cluster.wardId}
          </div>
        </div>
        <button
          onClick={onClose}
          className="nw-btn nw-btn-secondary nw-btn-sm"
          aria-label="Close investigation panel"
          style={{ padding: '4px 8px', flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Why flagged */}
        <section>
          <div className="nw-label" style={{ marginBottom: 8 }}>Why This Was Flagged</div>
          <div style={{
            background: 'var(--nw-cluster-bg)',
            border: '1px solid #FECACA',
            borderRadius: 5,
            padding: '10px 12px',
            fontSize: '0.875rem',
            color: 'var(--nw-cluster)',
            lineHeight: 1.5,
          }}>
            <strong>{cluster.observationCount}</strong> positive {testTypeLabel(cluster.testType)} observations
            {' '}within approximately <strong>{formatMetres(cluster.radiusMetres)}</strong>
            {' '}over the observation window.
            Failure rate: <strong>{formatRate(cluster.failureRate)}</strong>.
          </div>
        </section>

        {/* Evidence */}
        <section>
          <div className="nw-label" style={{ marginBottom: 8 }}>Detection Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DetailRow icon={<Activity size={13} />} label="Test type"
              value={testTypeLabel(cluster.testType)} />
            <DetailRow icon={<MapPin size={13} />} label="Approximate centre"
              value={`${cluster.centroid.lat.toFixed(4)}°N, ${cluster.centroid.lng.toFixed(4)}°E`} />
            <DetailRow icon={<MapPin size={13} />} label="Radius"
              value={formatMetres(cluster.radiusMetres)} />
            <DetailRow icon={<Activity size={13} />} label="Observations in window"
              value={cluster.observationCount} />
            <DetailRow icon={<Activity size={13} />} label="Failure rate"
              value={formatRate(cluster.failureRate)} />
          </div>
        </section>

        {/* Time window */}
        <section>
          <div className="nw-label" style={{ marginBottom: 8 }}>Observation Window</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DetailRow icon={<Clock size={13} />} label="Window start"
              value={formatDateTime(cluster.windowStart)} />
            <DetailRow icon={<Clock size={13} />} label="Window end"
              value={formatDateTime(cluster.windowEnd)} />
            <DetailRow icon={<Clock size={13} />} label="Detected at"
              value={formatDateTime(cluster.detectedAt)} />
          </div>
        </section>

        {/* Rainfall context */}
        {wardRainfall.length > 0 && (
          <section>
            <div className="nw-label" style={{ marginBottom: 8 }}>Rainfall Context</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--nw-text-2)' }}>
              <CloudRain size={13} color="var(--nw-navy)" />
              <span>{totalRainfall.toFixed(1)} mm over the observation window ({wardRainfall.length} days)</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
              Rainfall data is shown as environmental context only. The relationship between
              rainfall and water quality requires investigation.
            </p>
          </section>
        )}

        {/* Detection rule note */}
        <section>
          <div className="nw-label" style={{ marginBottom: 8 }}>Detection Rule</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--nw-text-muted)', margin: 0, lineHeight: 1.5 }}>
            This cluster was identified by the backend&apos;s deterministic
            detection rule: a configured minimum number of positive observations
            within a configured spatial radius and time window.
            Exact parameters are defined by the backend configuration.
          </p>
        </section>

        {/* Disclaimer */}
        <div className="synthetic-banner">
          Possible contamination cluster detected — not confirmed.
          Field investigation is required to verify this finding.
        </div>

      </div>
    </aside>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--nw-text-muted)' }}>
        {icon}
        {label}
      </span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--nw-text-2)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}
