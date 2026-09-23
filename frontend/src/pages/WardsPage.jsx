import { useApiData } from '../hooks/useApiData.js';
import { getWards } from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { formatDateTime, formatRate, formatNumber } from '../utils/format.js';
import { useNavigate } from 'react-router-dom';

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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader
        title="Ward Aggregation & Water Health"
        subtitle="Administrative ward-level summaries aggregating household test results, compliance ratios, and sanitary failure rates across Kochi."
        action={
          <button
            type="button"
            className="btn btn--outline"
            onClick={refetch}
            disabled={loading}
            style={{ fontSize: '0.8125rem' }}
          >
            Refresh Wards
          </button>
        }
      />

      {/* Overview Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <StatCard
          label="Monitored Wards"
          value={totalWards}
          subtext="Administrative divisions"
        />
        <StatCard
          label="Total Ward Tests"
          value={formatNumber(totalTests)}
          subtext={`${formatNumber(totalPass)} passed · ${formatNumber(totalFail)} failed`}
        />
        <StatCard
          label="Overall Failure Rate"
          value={formatRate(overallRate)}
          variant={overallRate > 0.25 ? 'alert' : 'pass'}
          subtext="Aggregate water test failure ratio"
        />
        <StatCard
          label="Highest Failure Ward"
          value={worstWard ? worstWard.name || worstWard.wardId : '—'}
          variant="alert"
          subtext={worstWard ? `${formatRate(worstWard.failureRate)} failure rate` : 'No data'}
        />
      </div>

      {/* State handling */}
      {loading && <LoadingState message="Aggregating ward-level statistics…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && wards.length === 0 && (
        <EmptyState message="No ward summary records found." />
      )}

      {!loading && !error && wards.length > 0 && (
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
                <th>Ward Name / ID</th>
                <th>Total Tests</th>
                <th>Pass / Fail</th>
                <th style={{ width: 220 }}>Failure Rate</th>
                <th>Last Tested</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wards.map((ward) => {
                const failPercent = Math.round((ward.failureRate || 0) * 100);
                const isHighFail = failPercent >= 30;
                const isModerateFail = failPercent >= 15 && failPercent < 30;

                return (
                  <tr key={ward.wardId}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--nw-text)' }}>
                        {ward.name || ward.wardId}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--nw-text-faint)' }}>
                        <code>{ward.wardId}</code>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{ward.totalTests}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>
                        <span style={{ color: '#16A34A', fontWeight: 600 }}>{ward.passCount} pass</span>
                        {' / '}
                        <span style={{ color: '#DC2626', fontWeight: 600 }}>{ward.failCount} fail</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          flex: 1,
                          height: 8,
                          background: 'var(--nw-bg-subtle)',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.min(failPercent, 100)}%`,
                            height: '100%',
                            background: isHighFail ? '#DC2626' : isModerateFail ? '#D97706' : '#16A34A',
                            borderRadius: 4,
                          }} />
                        </div>
                        <span style={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          minWidth: 42,
                          color: isHighFail ? '#DC2626' : isModerateFail ? '#D97706' : 'var(--nw-text)',
                        }}>
                          {failPercent}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)' }}>
                        {formatDateTime(ward.lastTestedAt)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn--outline"
                          onClick={() => navigate(`/observations?wardId=${ward.wardId}`)}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          title="View all tests in this ward"
                        >
                          Tests
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline"
                          onClick={() => navigate(`/map?wardId=${ward.wardId}`)}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          title="View on Map"
                        >
                          Map
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
