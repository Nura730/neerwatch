import { useState, useCallback, useMemo } from 'react';
import { useApiData } from '../hooks/useApiData.js';
import { getRainfall, getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { formatDate } from '../utils/format.js';
import { Info, Filter } from 'lucide-react';
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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader
        title="Rainfall Environmental Context"
        subtitle="Precipitation records overlaid across municipal wards to provide situational context during surface water runoff and water quality investigations."
        action={
          <button
            type="button"
            className="btn btn--outline"
            onClick={refetch}
            disabled={loading}
            style={{ fontSize: '0.8125rem' }}
          >
            Refresh Readings
          </button>
        }
      />

      {/* Synthetic notice & Context clarification */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(2,132,199,0.06)',
        border: '1px solid #BAE6FD',
        borderRadius: 8,
        fontSize: '0.8125rem',
        color: '#0369A1',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Environmental Context Notice:</strong> Rainfall data shown here is synthetic for demonstration. Heavy rainfall events often trigger non-point source runoff, turbidity spikes, or microbial seepage into aging pipelines. This is displayed as contextual evidence, not as an automated prediction.
        </div>
      </div>

      {/* Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          label="Total Gauge Readings"
          value={totalReadings}
          subtext="Ward gauge logs"
        />
        <StatCard
          label="Peak Rainfall Recorded"
          value={`${maxRainfall} mm`}
          variant={maxRainfall > 30 ? 'alert' : 'neutral'}
          subtext="Highest single daily reading"
        />
        <StatCard
          label="Average Precipitation"
          value={`${avgRainfall} mm`}
          subtext="Mean across active records"
        />
      </div>

      {/* Ward Filter Bar */}
      <div style={{
        display: 'flex',
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
          <Filter size={15} color="var(--nw-text-muted)" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)' }}>
            Filter by Ward:
          </span>
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--nw-card-border)',
              background: 'var(--nw-bg)',
              color: 'var(--nw-text)',
              fontSize: '0.8125rem',
            }}
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
            className="btn btn--outline"
            onClick={() => setSelectedWard('')}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* State views */}
      {loading && <LoadingState message="Loading rainfall context data…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && readings.length === 0 && (
        <EmptyState message="No rainfall measurements available for the selected ward." />
      )}

      {!loading && !error && readings.length > 0 && (
        <>
          {/* Chart Section */}
          <div style={{
            background: 'var(--nw-card-bg)',
            border: '1px solid var(--nw-card-border)',
            borderRadius: 8,
            padding: '20px 24px',
            marginBottom: 24,
            boxShadow: 'var(--nw-card-shadow)',
          }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--nw-text)', marginBottom: 16 }}>
              Precipitation Readings Timeline (mm)
            </h3>
            <div style={{ width: '100%', height: 260 }}>
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
                          <div style={{
                            background: '#1E293B',
                            color: '#F8FAFC',
                            padding: '8px 12px',
                            borderRadius: 6,
                            fontSize: '0.75rem'
                          }}>
                            <div style={{ fontWeight: 600 }}>{d.date}</div>
                            <div>Ward: {d.wardId}</div>
                            <div style={{ color: '#38BDF8', fontWeight: 700, marginTop: 4 }}>
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

          {/* Table of Readings */}
          <div style={{
            background: 'var(--nw-card-bg)',
            border: '1px solid var(--nw-card-border)',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: 'var(--nw-card-shadow)',
          }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ward ID</th>
                  <th>Recorded Date</th>
                  <th>Precipitation (mm)</th>
                  <th>Runoff Implication</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r, idx) => {
                  const isHeavy = r.rainfallMm >= 25;
                  const isModerate = r.rainfallMm >= 10 && r.rainfallMm < 25;
                  return (
                    <tr key={`${r.wardId}-${r.recordedAt}-${idx}`}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--nw-text)' }}>{r.wardId}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--nw-text)' }}>
                          {formatDate(r.recordedAt)}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0284C7' }}>
                          {r.rainfallMm} mm
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                          background: isHeavy ? 'rgba(220,38,38,0.1)' : isModerate ? 'rgba(217,119,6,0.1)' : 'rgba(2,132,199,0.08)',
                          color: isHeavy ? '#DC2626' : isModerate ? '#D97706' : '#0369A1',
                        }}>
                          {isHeavy ? 'High Runoff Potential' : isModerate ? 'Moderate Runoff' : 'Low / Baseline'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
