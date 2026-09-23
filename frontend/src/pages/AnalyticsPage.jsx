import React, { useState, useCallback, useRef } from 'react';
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Construction,
  BarChart2,
  Percent,
  FlaskConical,
  ListFilter,
} from 'lucide-react';
import { useApiData } from '../hooks/useApiData.js';
import { getContaminationTrend } from '../services/api.js';
import { getWards } from '../services/api.js';
import { PageHeader, LoadingState } from '../components/ui/States.jsx';
import { formatNumber } from '../utils/format.js';

// ── Test types ────────────────────────────────────────────────────────────────

const TEST_TYPES = [
  { value: '', label: 'All Parameters' },
  { value: 'TDS', label: 'TDS' },
  { value: 'pH', label: 'pH' },
  { value: 'turbidity', label: 'Turbidity' },
  { value: 'coliform', label: 'Coliform' },
];

const PERIODS = [
  { value: 'day',   label: 'Day' },
  { value: 'week',  label: 'Week' },
  { value: 'month', label: 'Month' },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, highlight }) {
  return (
    <div className={`bg-nw-surface border rounded-lg p-5 ${highlight ? 'border-nw-fail' : 'border-nw-border'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${highlight ? 'bg-red-50' : 'bg-nw-surface-2'}`}>
          <Icon size={18} className={highlight ? 'text-nw-fail' : 'text-nw-navy'} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-nw-text-muted">{label}</span>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${highlight ? 'text-nw-fail' : 'text-nw-text'}`}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-xs text-nw-text-muted mt-1">{sub}</p>}
    </div>
  );
}

// ── Mini line chart ───────────────────────────────────────────────────────────

function TrendChart({ points, onPointClick, selectedIdx }) {
  const svgRef = useRef(null);

  if (!points || points.length === 0) return null;

  const W = 700, H = 220, PAD = { top: 16, right: 16, bottom: 40, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const vals = points.map(p => p.positiveRate ?? p.failureRate ?? p.failCount ?? 0);
  const maxV = Math.max(...vals, 0.01);
  const minV = 0;

  const xScale = (i) => PAD.left + (i / (points.length - 1 || 1)) * innerW;
  const yScale = (v) => PAD.top + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(vals[i])}`).join(' ');
  const areaD = `${pathD} L ${xScale(points.length - 1)} ${H - PAD.bottom} L ${xScale(0)} ${H - PAD.bottom} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    v: minV + t * (maxV - minV),
    y: yScale(minV + t * (maxV - minV)),
  }));

  return (
    <div className="relative overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: '320px', maxHeight: '260px' }}
        aria-label="Contamination trend chart"
      >
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#E2E8F0" strokeWidth={1} />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="#94A3B8">
              {(t.v * 100).toFixed(0)}%
            </text>
          </g>
        ))}

        {/* Area fill */}
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F766E" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0F766E" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#trendGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#0F766E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i} className="cursor-pointer" onClick={() => onPointClick(i)}>
            <circle
              cx={xScale(i)}
              cy={yScale(vals[i])}
              r={selectedIdx === i ? 6 : 4}
              fill={selectedIdx === i ? '#164E63' : '#0F766E'}
              stroke="white"
              strokeWidth={2}
            />
            {/* X-axis labels — sparse */}
            {(i === 0 || i === points.length - 1 || (points.length <= 14 && i % 2 === 0) || i % Math.ceil(points.length / 7) === 0) && (
              <text
                x={xScale(i)}
                y={H - PAD.bottom + 16}
                textAnchor="middle"
                fontSize={9}
                fill="#94A3B8"
              >
                {p.period || p.date || p.label || ''}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [period, setPeriod] = useState('week');
  const [wardId, setWardId] = useState('');
  const [testType, setTestType] = useState('');
  const [selectedPoint, setSelectedPoint] = useState(null);

  const { data: wardData } = useApiData(() => getWards(), []);
  const wards = wardData?.wards || [];

  const fetchTrend = useCallback(() => {
    const params = { period };
    if (wardId)   params.wardId = wardId;
    if (testType) params.testType = testType;
    return getContaminationTrend(params);
  }, [period, wardId, testType]);

  const { data, loading, error, refetch } = useApiData(fetchTrend, [period, wardId, testType]);

  // Detect endpoint not yet deployed
  const is404 = error && (error.includes('404') || error.includes('Cannot GET') || error.includes('Not Found'));

  // Extract data safely using various possible field names
  const summary = data?.summary || data;
  const totalObservations = summary?.totalObservations ?? summary?.total ?? null;
  const failingObservations = summary?.failingObservations ?? summary?.positiveTests ?? summary?.failing ?? null;
  const positiveRate = summary?.positiveRate ?? (totalObservations && failingObservations != null
    ? failingObservations / totalObservations : null);
  const dataPoints = data?.trend || data?.points || data?.series || [];

  const selectedPointData = selectedPoint !== null ? dataPoints[selectedPoint] : null;

  // ── Not yet available ────────────────────────────────────────────────────
  if (is404) {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        <PageHeader
          title="Contamination Analytics"
          description="Observed water-quality trends over time"
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
            <Construction size={28} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-nw-text text-lg mb-2">Analytics — Coming Soon</h3>
          <p className="text-nw-text-muted text-sm max-w-md mb-4">
            The analytics backend ({' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">/api/analytics/contamination-trend</code>
            {' '}) has not been deployed yet. Once available, this page will display real-time water quality trend analysis derived from field observations.
          </p>
          <div className="bg-slate-50 border border-nw-border rounded-lg p-5 text-left text-sm max-w-md w-full">
            <p className="font-semibold text-nw-text mb-3">Will display when live:</p>
            <ul className="space-y-1.5 text-nw-text-muted list-disc list-inside">
              <li>Total and failing observations over time</li>
              <li>Observed positive rate trend</li>
              <li>Filter by period (Day / Week / Month)</li>
              <li>Filter by ward and test parameter</li>
              <li>Drill into specific time periods</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader
        title="Contamination Analytics"
        description="Observed water-quality trends over time"
        actions={
          <button className="nw-btn nw-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-nw-surface border border-nw-border rounded-lg p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider block mb-1.5">
            Time Range
          </label>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
                  period === p.value
                    ? 'bg-nw-navy text-white border-nw-navy'
                    : 'bg-white text-nw-text-muted border-nw-border hover:border-nw-navy'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider block mb-1.5">Ward</label>
          <select className="nw-input text-sm py-1.5 min-w-[150px]" value={wardId} onChange={e => setWardId(e.target.value)}>
            <option value="">All Wards</option>
            {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.name || w.wardId}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider block mb-1.5">Parameter</label>
          <select className="nw-input text-sm py-1.5 min-w-[150px]" value={testType} onChange={e => setTestType(e.target.value)}>
            {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <LoadingState message="Loading contamination trends…" />}

      {error && !is404 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 mb-6 text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Failed to load analytics</p>
            <p className="text-red-600">{error}</p>
            <button onClick={refetch} className="mt-2 text-nw-navy underline text-sm">Retry</button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Total Observations"
              value={totalObservations !== null ? formatNumber(totalObservations) : '—'}
              sub="From current filters"
              icon={BarChart2}
            />
            <StatCard
              label="Failing Observations"
              value={failingObservations !== null ? formatNumber(failingObservations) : '—'}
              sub="Results above safe threshold"
              icon={FlaskConical}
              highlight={failingObservations > 0}
            />
            <StatCard
              label="Positive Rate"
              value={positiveRate !== null ? `${(positiveRate * 100).toFixed(1)}%` : '—'}
              sub="Proportion of failing observations"
              icon={Percent}
            />
          </div>

          {/* Chart */}
          {dataPoints.length > 0 ? (
            <div className="bg-nw-surface border border-nw-border rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-nw-text">Observed Contamination Trend</h3>
                  <p className="text-xs text-nw-text-muted mt-0.5">Positive rate (%) over selected period — click a point for detail</p>
                </div>
                <TrendingUp size={18} className="text-nw-teal" />
              </div>
              <TrendChart points={dataPoints} onPointClick={setSelectedPoint} selectedIdx={selectedPoint} />

              {selectedPointData && (
                <div className="mt-4 p-4 bg-nw-surface-2 border border-nw-border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <ListFilter size={14} className="text-nw-navy" />
                    <h4 className="font-semibold text-sm text-nw-text">
                      Period: {selectedPointData.period || selectedPointData.date || selectedPointData.label || `Point ${selectedPoint + 1}`}
                    </h4>
                    <button onClick={() => setSelectedPoint(null)} className="ml-auto text-nw-text-muted hover:text-nw-text">
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedPointData.total != null && (
                      <div><p className="text-[10px] font-bold text-nw-text-muted uppercase tracking-wider">Total</p>
                      <p className="text-lg font-bold text-nw-text">{formatNumber(selectedPointData.total)}</p></div>
                    )}
                    {selectedPointData.failing != null && (
                      <div><p className="text-[10px] font-bold text-nw-text-muted uppercase tracking-wider">Failing</p>
                      <p className="text-lg font-bold text-nw-fail">{formatNumber(selectedPointData.failing)}</p></div>
                    )}
                    {selectedPointData.positiveRate != null && (
                      <div><p className="text-[10px] font-bold text-nw-text-muted uppercase tracking-wider">Rate</p>
                      <p className="text-lg font-bold text-nw-text">{(selectedPointData.positiveRate * 100).toFixed(1)}%</p></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            !loading && (
              <div className="bg-nw-surface border border-nw-border rounded-lg p-12 flex flex-col items-center text-center">
                <TrendingUp size={32} className="text-nw-text-faint mb-3" />
                <p className="font-semibold text-nw-text mb-1">No analytics data available</p>
                <p className="text-sm text-nw-text-muted">No data is available for the selected period and filters.</p>
              </div>
            )
          )}

          {/* Contextual note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">About these observations</p>
            <p>
              Figures reflect actual field test results recorded in NEERWATCH. Rainfall and water quality signals are shown
              together to support investigation — correlation does not imply causation.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
