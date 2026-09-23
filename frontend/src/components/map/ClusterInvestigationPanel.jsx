import React from 'react';
import { formatDateTime, formatMetres, formatRate, testTypeLabel } from '../../utils/format.js';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { ClusterEvidence } from '../ui/ClusterEvidence.jsx';
import { X, MapPin, Clock, Activity, CloudRain } from 'lucide-react';

export function ClusterInvestigationPanel({ cluster, rainfallData, onClose }) {
  if (!cluster) return null;

  const wardRainfall = rainfallData
    ? rainfallData.filter(r => r.wardId === cluster.wardId)
    : [];
  const totalRainfall = wardRainfall.reduce((sum, r) => sum + r.rainfallMm, 0);

  return (
    <aside className="w-[380px] shrink-0 bg-nw-surface border-l border-nw-border flex flex-col overflow-y-auto shadow-[-4px_0_15px_rgba(0,0,0,0.05)] z-[1000] relative" aria-label="Cluster investigation panel">
      {/* Header */}
      <div className="px-5 py-4 border-b border-nw-border bg-nw-surface-2 flex items-start justify-between sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge label="Possible Cluster" variant="cluster" />
            {cluster.active && <StatusBadge label="Active" variant="active" />}
          </div>
          <div className="font-bold text-base text-nw-text">
            {testTypeLabel(cluster.testType)} — {cluster.wardId}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 -mr-1.5 rounded-md text-nw-text-muted hover:text-nw-text hover:bg-nw-surface-3 transition-colors"
          aria-label="Close investigation panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-6">
        
        {/* Evidence Component (Reused) */}
        <ClusterEvidence cluster={cluster} />

        {/* Detailed Window */}
        <section>
          <div className="nw-label mb-3">Observation Window</div>
          <div className="flex flex-col gap-2 bg-nw-surface-2 p-3 rounded-md border border-nw-border-2">
            <DetailRow icon={<Clock size={14} />} label="Window start"
              value={formatDateTime(cluster.windowStart)} />
            <DetailRow icon={<Clock size={14} />} label="Window end"
              value={formatDateTime(cluster.windowEnd)} />
            <DetailRow icon={<Clock size={14} />} label="Detected at"
              value={formatDateTime(cluster.detectedAt)} />
          </div>
        </section>

        {/* Technical Details */}
        <section>
          <div className="nw-label mb-3">Detection Technical Details</div>
          <div className="flex flex-col gap-2 bg-nw-surface-2 p-3 rounded-md border border-nw-border-2">
            <DetailRow icon={<Activity size={14} />} label="Test parameter"
              value={testTypeLabel(cluster.testType)} />
            <DetailRow icon={<MapPin size={14} />} label="Approximate centre"
              value={`${cluster.centroid.lat.toFixed(4)}°N, ${cluster.centroid.lng.toFixed(4)}°E`} />
            <DetailRow icon={<Activity size={14} />} label="Observation failure rate"
              value={formatRate(cluster.failureRate)} />
          </div>
        </section>

        {/* Rainfall context */}
        {wardRainfall.length > 0 && (
          <section className="bg-blue-50 border border-blue-100 rounded-md p-4">
            <div className="nw-label text-[#0369A1] mb-2">Rainfall Context</div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#0369A1]">
              <CloudRain size={16} />
              <span>{totalRainfall.toFixed(1)} mm over {wardRainfall.length} days</span>
            </div>
            <p className="text-xs text-[#0369A1]/80 mt-2 leading-relaxed">
              Rainfall data is shown as environmental context only. The relationship between
              rainfall and water quality requires investigation.
            </p>
          </section>
        )}

        {/* Disclaimer */}
        <div className="bg-nw-warn-bg border border-nw-warn/20 text-nw-warn text-xs font-medium p-3 rounded-md text-center shadow-sm">
          Possible contamination cluster detected — not confirmed. Field investigation is required.
        </div>

      </div>
    </aside>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex justify-between items-center gap-2 py-1">
      <span className="flex items-center gap-1.5 text-xs text-nw-text-muted">
        {icon}
        {label}
      </span>
      <span className="text-xs text-nw-text-2 font-medium">
        {value}
      </span>
    </div>
  );
}
