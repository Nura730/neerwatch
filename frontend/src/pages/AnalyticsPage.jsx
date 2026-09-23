import React, { useState, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useApiData } from '../hooks/useApiData.js';
import { getContaminationTrend, getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { formatNumber } from '../utils/format.js';
import { BarChart2 } from 'lucide-react';

const INTERVALS = [
  { value: 'day',   label: 'Day' },
  { value: 'week',  label: 'Week' },
  { value: 'month', label: 'Month' },
];

const TEST_TYPES = [
  { value: '',          label: 'All Parameters' },
  { value: 'TDS',       label: 'TDS' },
  { value: 'pH',        label: 'pH' },
  { value: 'turbidity', label: 'Turbidity' },
  { value: 'coliform',  label: 'Coliform' },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const total    = payload.find(p => p.dataKey === 'totalTests')?.value ?? 0;
  const positive = payload.find(p => p.dataKey === 'positiveTests')?.value ?? 0;
  const rate     = payload.find(p => p.dataKey === 'positiveRate')?.value ?? 0;
  return (
    <div className="bg-nw-surface border border-nw-border rounded shadow-md px-4 py-3 text-sm min-w-[180px]">
      <p className="font-bold text-nw-text mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-nw-text-muted">Total observations</span>
          <span className="font-semibold text-nw-navy tabular-nums">{formatNumber(total)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-nw-text-muted">Failing observations</span>
          <span className="font-semibold text-nw-fail tabular-nums">{formatNumber(positive)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-nw-border pt-1.5 mt-1.5">
          <span className="text-nw-text-muted">Positive rate</span>
          <span className="font-bold text-nw-teal tabular-nums">{rate}%</span>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [interval,  setInterval_]  = useState('day');
  const [wardId,    setWardId]      = useState('');
  const [testType,  setTestType]    = useState('');
  const [from,      setFrom]        = useState('');
  const [to,        setTo]          = useState('');

  const fetchFn = useCallback(() => {
    const params = { interval };
    if (wardId)   params.wardId   = wardId;
    if (testType) params.testType = testType;
    if (from)     params.from     = from;
    if (to)       params.to       = to;
    return getContaminationTrend(params);
  }, [interval, wardId, testType, from, to]);

  const { data, loading, error, refetch } = useApiData(fetchFn, [fetchFn]);
  const { data: wardsData }               = useApiData(getWards, []);
  const wards = wardsData?.wards || [];

  const series = useMemo(() => data?.series || [], [data]);

  const summary = useMemo(() => {
    if (!series.length) return { total: 0, positive: 0, rate: 0 };
    const total    = series.reduce((s, d) => s + (d.totalTests    || 0), 0);
    const positive = series.reduce((s, d) => s + (d.positiveTests || 0), 0);
    const rate     = total > 0 ? Math.round((positive / total) * 1000) / 10 : 0;
    return { total, positive, rate };
  }, [series]);

  const activeFilters = [];
  if (wardId)   activeFilters.push({ key: 'wardId',   label: 'Ward',   value: wardId });
  if (testType) activeFilters.push({ key: 'testType', label: 'Type',   value: testType });
  if (from)     activeFilters.push({ key: 'from',     label: 'From',   value: from });
  if (to)       activeFilters.push({ key: 'to',       label: 'To',     value: to });

  const handleRemoveFilter = (key) => {
    if (key === 'wardId')   setWardId('');
    if (key === 'testType') setTestType('');
    if (key === 'from')     setFrom('');
    if (key === 'to')       setTo('');
  };

  const handleClearAll = () => {
    setWardId('');
    setTestType('');
    setFrom('');
    setTo('');
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Contamination Analytics"
        description="Observed water-quality trends over time — aggregated from field test results"
      />

      {/* Interval selector */}
      <div className="flex gap-1 mb-4" role="group" aria-label="Time interval">
        {INTERVALS.map(i => (
          <button
            key={i.value}
            className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${
              interval === i.value
                ? 'bg-nw-navy text-white border-nw-navy'
                : 'bg-nw-surface text-nw-text-2 border-nw-border hover:bg-nw-surface-2'
            }`}
            onClick={() => setInterval_(i.value)}
            aria-pressed={interval === i.value}
          >
            {i.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <FilterBar filters={activeFilters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAll}>
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Ward</label>
          <select
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={wardId}
            onChange={e => setWardId(e.target.value)}
          >
            <option value="">All wards</option>
            {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.name || w.wardId}</option>)}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Parameter</label>
          <select
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={testType}
            onChange={e => setTestType(e.target.value)}
          >
            {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">From</label>
          <input
            type="date"
            className="nw-input text-sm py-1.5 min-w-[130px]"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">To</label>
          <input
            type="date"
            className="nw-input text-sm py-1.5 min-w-[130px]"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </div>
      </FilterBar>

      {loading && <LoadingState message="Loading contamination trends…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="stat-card stat-card--pass">
              <div className="stat-card__label">Total Observations</div>
              <div className="stat-card__value">{formatNumber(summary.total)}</div>
            </div>
            <div className="stat-card stat-card--alert">
              <div className="stat-card__label">Failing Observations</div>
              <div className="stat-card__value">{formatNumber(summary.positive)}</div>
            </div>
            <div className={`stat-card ${summary.rate >= 20 ? 'stat-card--alert' : summary.rate >= 10 ? 'stat-card--warn' : 'stat-card--pass'}`}>
              <div className="stat-card__label">Positive Rate</div>
              <div className="stat-card__value">{summary.rate}%</div>
            </div>
          </div>

          {/* Chart */}
          {series.length === 0 ? (
            <EmptyState
              title="No analytics data"
              message="No observations are available for the selected period and filters."
              icon={<BarChart2 size={32} />}
            />
          ) : (
            <div className="bg-nw-surface border border-nw-border rounded-md shadow-nw-sm p-6">
              <h2 className="text-sm font-bold text-nw-text mb-1">Observed Contamination Trend</h2>
              <p className="text-xs text-nw-text-muted mb-5">
                Total and failing water tests per {interval}.
                Positive rate indicates the fraction of tests exceeding parameter thresholds.
              </p>

              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={series} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    label={{ value: 'Tests', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94A3B8' }, dy: 30 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={v => `${v}%`}
                    label={{ value: 'Rate %', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#94A3B8' }, dy: -30 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    formatter={(value) => {
                      if (value === 'totalTests')    return 'Total Tests';
                      if (value === 'positiveTests') return 'Failing Tests';
                      if (value === 'positiveRate')  return 'Positive Rate (%)';
                      return value;
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalTests"
                    stroke="#164E63"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#164E63' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="positiveTests"
                    stroke="#B91C1C"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#B91C1C' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="positiveRate"
                    stroke="#0F766E"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              <p className="text-xs text-nw-text-faint mt-4 border-t border-nw-border pt-3">
                Data represents observed test results from field submissions.
                Positive rate is the percentage of tests that exceeded parameter safety thresholds.
                Rainfall and contamination trends are shown together for investigation purposes only — no causal relationship is implied.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
