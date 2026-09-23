import React, { useEffect } from 'react';
import { X, MapPin, ShieldCheck } from 'lucide-react';
import { StatusBadge, SyncStatusBadge } from './StatusBadge.jsx';
import { formatDateTime, testTypeLabel } from '../../utils/format.js';
import { Link } from 'react-router-dom';

export function ObservationDetailDrawer({ observation, onClose }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!observation) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-nw-surface shadow-2xl z-50 flex flex-col transform transition-transform border-l border-nw-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-nw-border bg-nw-surface-2">
          <h2 className="text-lg font-bold text-nw-text">Observation Details</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-md text-nw-text-muted hover:text-nw-text hover:bg-nw-surface-3 transition-colors"
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <StatusBadge label={testTypeLabel(observation.testType)} variant="neutral" />
            <SyncStatusBadge status={observation.syncStatus || 'synced'} />
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="nw-label mb-2">Identifiers</h3>
              <div className="bg-nw-surface-2 rounded p-3 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-nw-text-muted">Observation ID</span>
                  <span className="nw-mono font-medium">{observation.clientId || observation._id}</span>
                </div>
                {observation.householdId && (
                  <div className="flex justify-between">
                    <span className="text-nw-text-muted">Household ID</span>
                    <span className="font-medium">{observation.householdId}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="nw-label mb-2">Result</h3>
              <div className="bg-nw-surface-2 rounded p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-nw-text mb-1">
                  {observation.result}
                </span>
                <span className="text-sm text-nw-text-muted uppercase tracking-wider">
                  {testTypeLabel(observation.testType)}
                </span>
              </div>
            </div>

            <div>
              <h3 className="nw-label mb-2">Location & Time</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-nw-border-2 pb-2">
                  <span className="text-nw-text-muted">Ward</span>
                  <span className="font-medium">{observation.wardId}</span>
                </div>
                <div className="flex justify-between border-b border-nw-border-2 pb-2">
                  <span className="text-nw-text-muted">Tested</span>
                  <span className="font-medium">{formatDateTime(observation.testedAt)}</span>
                </div>
                <div className="flex justify-between border-b border-nw-border-2 pb-2">
                  <span className="text-nw-text-muted">Created</span>
                  <span className="font-medium">{formatDateTime(observation.createdAt || observation.testedAt)}</span>
                </div>

                <div className="pt-2">
                  <span className="text-nw-text-muted block mb-1">Coordinates</span>
                  {observation.location ? (
                    <div className="flex items-center justify-between">
                      <span className="nw-mono bg-nw-surface-3 px-2 py-1 rounded text-xs">
                        {observation.location.lat.toFixed(6)}, {observation.location.lng.toFixed(6)}
                      </span>
                      <Link
                        to={`/map?lat=${observation.location.lat}&lng=${observation.location.lng}`}
                        className="text-nw-teal hover:underline text-xs flex items-center gap-1 font-medium"
                      >
                        <MapPin size={12} /> View on Map
                      </Link>
                    </div>
                  ) : (
                    <span className="text-nw-warn text-xs font-medium flex items-center gap-1 bg-nw-warn-bg px-2 py-1 rounded inline-flex">
                      Location unavailable
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Confidence Assessment — shown only if backend provides it */}
            {observation.confidenceScore !== undefined && observation.confidenceScore !== null ? (
              <div>
                <h3 className="nw-label mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={13} />
                  Confidence Assessment
                </h3>
                <div className="bg-nw-surface-2 border border-nw-border rounded p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <StatusBadge
                      label={(observation.confidenceLevel || '').toUpperCase()}
                      variant={
                        observation.confidenceLevel === 'high'   ? 'pass'
                        : observation.confidenceLevel === 'medium' ? 'warn'
                        : 'fail'
                      }
                    />
                    <span className="font-mono font-bold text-xl text-nw-text">
                      {observation.confidenceScore}
                      <span className="text-sm font-normal text-nw-text-muted"> / 100</span>
                    </span>
                  </div>

                  <div className="rate-bar" aria-hidden="true">
                    <div
                      className={`rate-bar__fill${
                        observation.confidenceScore >= 80 ? '' :
                        observation.confidenceScore >= 60 ? ' rate-bar__fill--warn' :
                        ' rate-bar__fill--fail'
                      }`}
                      style={{ width: `${observation.confidenceScore}%` }}
                    />
                  </div>

                  {Array.isArray(observation.confidenceReasons) && observation.confidenceReasons.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-nw-text-muted uppercase tracking-wider mb-1.5">Why</p>
                      <ul className="space-y-1">
                        {observation.confidenceReasons.map((r, i) => (
                          <li key={i} className="text-xs text-nw-text-2 flex items-start gap-1.5">
                            <span className="text-nw-teal shrink-0 mt-0.5">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
