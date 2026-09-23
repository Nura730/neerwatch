import React from 'react';
import { useApiData } from '../hooks/useApiData.js';
import { getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { MetricCard } from '../components/ui/MetricCard.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { formatDateTime, formatRate, formatNumber } from '../utils/format.js';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, MapPin, List } from 'lucide-react';

export function WardsPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiData(getWards, []);

  const wards = data?.wards || [];

  // Summary Metrics
  const totalWards = wards.length;
  const totalTests = wards.reduce((sum, w) => sum + (w.totalTests || 0), 0);
  const totalPass = wards.reduce((sum, w) => sum + (w.passCount || 0), 0);
  const totalFail = wards.reduce((sum, w) => sum + (w.failCount || 0), 0);
  const overallRate = totalTests > 0 ? (totalFail / totalTests) : 0;

  // Most affected ward
  const worstWard = [...wards].sort((a, b) => (b.failureRate || 0) - (a.failureRate || 0))[0];

  const columns = [
    {
      key: 'wardId',
      header: 'Ward Name / ID',
      render: (ward) => (
        <div>
          <div className="font-semibold text-nw-text">{ward.name || `Ward ${ward.wardId}`}</div>
          <div className="text-xs text-nw-text-faint font-mono">{ward.wardId}</div>
        </div>
      )
    },
    {
      key: 'totalTests',
      header: 'Total Tests',
      render: (ward) => <span className="font-semibold">{ward.totalTests}</span>
    },
    {
      key: 'passFail',
      header: 'Pass / Fail',
      render: (ward) => (
        <div className="text-sm">
          <span className="text-nw-pass font-semibold">{ward.passCount} pass</span>
          <span className="text-nw-text-faint mx-1">/</span>
          <span className="text-nw-fail font-semibold">{ward.failCount} fail</span>
        </div>
      )
    },
    {
      key: 'failureRate',
      header: 'Observation Failure Rate',
      width: '25%',
      render: (ward) => {
        const failPercent = Math.round((ward.failureRate || 0) * 100);
        const isHighFail = failPercent >= 30;
        const isModerateFail = failPercent >= 15 && failPercent < 30;
        const colorClass = isHighFail ? 'bg-nw-fail text-nw-fail' : isModerateFail ? 'bg-nw-warn text-nw-warn' : 'bg-nw-pass text-nw-pass';
        const colorHex = isHighFail ? 'var(--nw-fail)' : isModerateFail ? 'var(--nw-warn)' : 'var(--nw-pass)';
        
        return (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-nw-surface-3 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${colorClass.split(' ')[0]}`}
                style={{ width: `${Math.min(failPercent, 100)}%` }} 
              />
            </div>
            <span 
              className="text-xs font-bold w-10 text-right"
              style={{ color: colorHex }}
            >
              {failPercent}%
            </span>
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (ward) => {
        const failPercent = Math.round((ward.failureRate || 0) * 100);
        if (failPercent >= 30) return <StatusBadge label="Review required" variant="fail" />;
        if (failPercent >= 15) return <StatusBadge label="Attention" variant="warn" />;
        return <StatusBadge label="Normal" variant="pass" />;
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (ward) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigate(`/observations?wardId=${ward.wardId}`)}
            className="nw-btn nw-btn-secondary nw-btn-sm"
            title="View all tests in this ward"
          >
            <List size={14} /> Tests
          </button>
          <button
            onClick={() => navigate(`/map?wardId=${ward.wardId}`)}
            className="nw-btn nw-btn-secondary nw-btn-sm"
            title="View on Map"
          >
            <MapPin size={14} /> Map
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Wards"
        description="Administrative ward-level summaries aggregating household test results, compliance ratios, and observation failure rates."
        actions={
          <button
            type="button"
            className="nw-btn nw-btn-secondary"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh Wards
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Monitored Wards"
          value={totalWards}
          subtext="Administrative divisions"
        />
        <MetricCard
          label="Total Ward Tests"
          value={formatNumber(totalTests)}
          subtext={`${formatNumber(totalPass)} passed · ${formatNumber(totalFail)} failed`}
        />
        <MetricCard
          label="Overall Failure Rate"
          value={formatRate(overallRate)}
          variant={overallRate > 0.25 ? 'alert' : 'pass'}
          subtext="Aggregate test failure ratio"
        />
        <MetricCard
          label="Highest Failure Ward"
          value={worstWard ? worstWard.name || `Ward ${worstWard.wardId}` : '—'}
          variant="alert"
          subtext={worstWard ? `${formatRate(worstWard.failureRate)} failure rate` : 'No data'}
        />
      </div>

      {loading && <LoadingState message="Aggregating ward-level statistics…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <DataTable 
          columns={columns} 
          data={wards} 
          emptyState={<EmptyState message="No ward summary records found." />}
        />
      )}
    </div>
  );
}
