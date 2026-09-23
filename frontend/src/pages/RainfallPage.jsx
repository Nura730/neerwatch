import React, { useState, useCallback, useMemo } from 'react';
import { useApiData } from '../hooks/useApiData.js';
import { getRainfall, getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { MetricCard } from '../components/ui/MetricCard.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { formatDate } from '../utils/format.js';
import { Info, Filter, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export function RainfallPage() {
  const [selectedWard, setSelectedWard] = useState('');

  const fetchRainfall = useCallback(() => {
    const params = {};
    if (selectedWard) params.wardId = selectedWard;
    return getRainfall(params);
  }, [selectedWard]);

  const { data: rainData, loading, error, refetch } = useApiData(fetchRainfall, [fetchRainfall]);
  const { data: wardsData } = useApiData(getWards, []);

  const rawReadings = rainData?.rainfall;
  const readings = rawReadings || [];
  const wards = wardsData?.wards || [];

  // Summary Metrics
  const totalReadings = readings.length;
  const maxRainfall = readings.reduce((max, r) => Math.max(max, r.rainfallMm || 0), 0);
  const avgRainfall = totalReadings > 0
    ? (readings.reduce((sum, r) => sum + (r.rainfallMm || 0), 0) / totalReadings).toFixed(1)
    : 0;

  // Chart data preparation
  const chartData = useMemo(() => {
    if (!rawReadings) return [];
    // Sort chronological
    const sorted = [...rawReadings].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    return sorted.map(r => ({
      date: formatDate(r.recordedAt),
      rainfallMm: r.rainfallMm,
      wardId: r.wardId,
      fullDate: r.recordedAt,
    }));
  }, [rawReadings]);

  const columns = [
    {
      key: 'wardId',
      header: 'Ward ID',
      render: (r) => <span className="font-semibold text-nw-text">{r.wardId}</span>
    },
    {
      key: 'recordedAt',
      header: 'Recorded Date',
      render: (r) => <span className="text-sm">{formatDate(r.recordedAt)}</span>
    },
    {
      key: 'rainfallMm',
      header: 'Precipitation (mm)',
      render: (r) => <span className="font-bold text-[#0284C7]">{r.rainfallMm} mm</span>
    },
    {
      key: 'implication',
      header: 'Runoff Implication',
      render: (r) => {
        const isHeavy = r.rainfallMm >= 25;
        const isModerate = r.rainfallMm >= 10 && r.rainfallMm < 25;
        const className = isHeavy 
          ? 'bg-nw-fail/10 text-nw-fail' 
          : isModerate 
            ? 'bg-nw-warn/10 text-nw-warn' 
            : 'bg-[#0284C7]/10 text-[#0369A1]';
        const label = isHeavy ? 'High Runoff Potential' : isModerate ? 'Moderate Runoff' : 'Low / Baseline';
        
        return (
          <span className={`text-xs px-2 py-1 rounded font-semibold ${className}`}>
            {label}
          </span>
        );
      }
    }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Rainfall Environmental Context"
        description="Precipitation records overlaid across municipal wards to provide situational context during surface water runoff and water quality investigations."
        actions={
          <button
            type="button"
            className="nw-btn nw-btn-secondary"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh Readings
          </button>
        }
      />

      <div className="bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] px-4 py-3 rounded flex items-start gap-3 text-sm mb-6">
        <Info size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Environmental Context Notice:</strong> Rainfall data shown here is synthetic for demonstration. Heavy rainfall events often trigger non-point source runoff, turbidity spikes, or microbial seepage into aging pipelines. This is displayed as contextual evidence, not as an automated prediction.
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="Total Gauge Readings"
          value={totalReadings}
          subtext="Ward gauge logs"
        />
        <MetricCard
          label="Peak Rainfall Recorded"
          value={`${maxRainfall} mm`}
          variant={maxRainfall > 30 ? 'alert' : 'neutral'}
          subtext="Highest single daily reading"
        />
        <MetricCard
          label="Average Precipitation"
          value={`${avgRainfall} mm`}
          subtext="Mean across active records"
        />
      </div>

      <div className="bg-nw-surface border border-nw-border rounded-md p-3 mb-5 flex items-center justify-between shadow-nw-sm">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-nw-text-muted" />
          <span className="text-sm font-semibold text-nw-text">Filter by Ward:</span>
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="nw-input text-sm py-1.5 w-auto pr-8 min-w-[180px]"
          >
            <option value="">All Municipal Wards</option>
            {wards.map(w => (
              <option key={w.wardId} value={w.wardId}>
                {w.name || w.wardId}
              </option>
            ))}
          </select>
        </div>

        {selectedWard && (
          <button
            type="button"
            className="nw-btn nw-btn-secondary nw-btn-sm"
            onClick={() => setSelectedWard('')}
          >
            Clear Filter
          </button>
        )}
      </div>

      {loading && <LoadingState message="Loading rainfall context data…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && readings.length === 0 && (
        <EmptyState message="No rainfall measurements available for the selected ward." />
      )}

      {!loading && !error && readings.length > 0 && (
        <>
          <div className="bg-nw-surface border border-nw-border rounded-md p-6 mb-6 shadow-nw-sm">
            <h3 className="text-base font-semibold text-nw-text mb-4">
              Precipitation Readings Timeline (mm)
            </h3>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#1E293B] text-[#F8FAFC] px-3 py-2 rounded text-xs shadow-lg">
                            <div className="font-semibold">{d.date}</div>
                            <div className="text-nw-text-muted">Ward: {d.wardId}</div>
                            <div className="text-[#38BDF8] font-bold mt-1">
                              Precipitation: {d.rainfallMm} mm
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="rainfallMm" fill="#0284C7" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.rainfallMm > 25 ? '#0369A1' : entry.rainfallMm > 10 ? '#0284C7' : '#38BDF8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <DataTable columns={columns} data={readings} />
        </>
      )}
    </div>
  );
}
