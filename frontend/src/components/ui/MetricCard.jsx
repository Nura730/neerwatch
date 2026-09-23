/** MetricCard — Standardized metric card for operational dashboards */
export function MetricCard({ label, value, subtext, variant, icon, trend }) {
  const variantClass = variant === 'alert' ? 'stat-card--alert'
                     : variant === 'pass'  ? 'stat-card--pass'
                     : variant === 'warn'  ? 'stat-card--warn'
                     : '';
  return (
    <div className={`stat-card ${variantClass}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div className="stat-card__label">{label}</div>
          {icon && <div style={{ color: 'var(--nw-text-faint)' }}>{icon}</div>}
        </div>
        <div className="stat-card__value">{value ?? '—'}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
        {subtext && (
          <div style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)' }}>
            {subtext}
          </div>
        )}
        {trend && (
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nw-text-2)' }}>
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
