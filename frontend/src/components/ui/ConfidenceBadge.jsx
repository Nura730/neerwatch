import React from 'react';

const LEVEL_CONFIG = {
  HIGH:   { className: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500' },
  MEDIUM: { className: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-500' },
  LOW:    { className: 'bg-red-50 text-red-700 border-red-200',              dot: 'bg-red-400' },
};

/**
 * Compact confidence badge for use in tables.
 * Accepts either confidenceScore + confidenceLevel, or derives level from score.
 */
export function ConfidenceBadge({ score, level }) {
  if (score == null && !level) return <span className="text-nw-text-faint text-xs">—</span>;

  // Derive level from score if not provided
  let displayLevel = (level || '').toUpperCase();
  if (!displayLevel && score != null) {
    if (score >= 80) displayLevel = 'HIGH';
    else if (score >= 60) displayLevel = 'MEDIUM';
    else displayLevel = 'LOW';
  }

  const cfg = LEVEL_CONFIG[displayLevel] || LEVEL_CONFIG.MEDIUM;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {displayLevel}
      {score != null && <span className="opacity-70 font-normal">· {score}</span>}
    </div>
  );
}

/**
 * Expanded confidence assessment panel for use in detail views.
 * Displays backend-provided factors and reasons directly.
 */
export function ConfidencePanel({ score, level, factors, reasons }) {
  if (score == null && !level) {
    return (
      <div className="text-sm text-nw-text-muted italic">Confidence data unavailable for this observation.</div>
    );
  }

  let displayLevel = (level || '').toUpperCase();
  if (!displayLevel && score != null) {
    if (score >= 80) displayLevel = 'HIGH';
    else if (score >= 60) displayLevel = 'MEDIUM';
    else displayLevel = 'LOW';
  }

  const cfg = LEVEL_CONFIG[displayLevel] || LEVEL_CONFIG.MEDIUM;

  return (
    <div className="border border-nw-border rounded-lg overflow-hidden">
      <div className="bg-nw-surface-2 px-4 py-3 border-b border-nw-border flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-nw-text-muted">Confidence Assessment</p>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold ${cfg.className}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          {displayLevel}
          {score != null && <span className="font-normal">· {score} / 100</span>}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Score bar */}
        {score != null && (
          <div>
            <div className="flex justify-between text-[11px] text-nw-text-muted mb-1">
              <span>Score</span>
              <span className="font-semibold">{score} / 100</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>
          </div>
        )}

        {/* Factors */}
        {factors && factors.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-nw-text-muted mb-1.5">Factors</p>
            <ul className="space-y-1">
              {factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-nw-text">
                  <span className="text-nw-teal mt-0.5">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reasons */}
        {reasons && reasons.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-nw-text-muted mb-1.5">Reasons</p>
            <ul className="space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-nw-text-muted">
                  <span className="mt-0.5">›</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
