import React from 'react';
import { formatDateTime, formatMetres } from '../../utils/format.js';
import { StatusBadge } from './StatusBadge.jsx';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * ClusterEvidence — Standardized component to display the backend evidence that generated a cluster
 */
export function ClusterEvidence({ cluster }) {
  if (!cluster) return null;

  return (
    <div className="bg-nw-surface border border-nw-border rounded-md shadow-nw-sm overflow-hidden mb-6">
      <div className="bg-nw-cluster-bg border-b border-nw-border px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <StatusBadge label="Possible Cluster" variant="cluster" />
          <span className="text-xs text-nw-text-muted font-medium">
            Detected {formatDateTime(cluster.detectedAt)}
          </span>
        </div>
        <h2 className="text-lg font-bold text-nw-text mb-1 flex items-center gap-2">
          Ward {cluster.wardId} 
          <span className="text-sm font-normal text-nw-text-muted">— {cluster.testType}</span>
        </h2>
      </div>

      <div className="p-5 border-b border-nw-border">
        <h3 className="nw-label mb-4 text-nw-text-2">Evidence & Parameters</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-nw-surface-2 rounded-md p-3">
            <div className="text-xs text-nw-text-muted uppercase tracking-wide font-semibold mb-1">
              Qualifying Observations
            </div>
            <div className="text-2xl font-bold text-nw-text">
              {cluster.observationCount}
            </div>
          </div>
          
          <div className="bg-nw-surface-2 rounded-md p-3">
            <div className="text-xs text-nw-text-muted uppercase tracking-wide font-semibold mb-1">
              Spatial Extent
            </div>
            <div className="text-2xl font-bold text-nw-text">
              {cluster.radiusMetres ? `≈ ${formatMetres(cluster.radiusMetres)}` : 'Unknown'}
            </div>
          </div>
        </div>

        <div className="bg-nw-surface-2 rounded-md p-3">
          <div className="text-xs text-nw-text-muted uppercase tracking-wide font-semibold mb-2">
            Why was this flagged?
          </div>
          <ul className="space-y-2 text-sm text-nw-text-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-nw-pass shrink-0 mt-0.5" />
              <span>Required number of qualifying positive observations met.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-nw-pass shrink-0 mt-0.5" />
              <span>Observations fall within the configured spatial boundary.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-nw-pass shrink-0 mt-0.5" />
              <span>Observations fall within the configured temporal window.</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="px-5 py-4 bg-nw-surface-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-nw-text-muted">ACTIONS</span>
        <Link 
          to={`/map?cluster=${cluster.id}`} 
          className="nw-btn nw-btn-secondary nw-btn-sm bg-nw-surface"
        >
          View on Map <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
