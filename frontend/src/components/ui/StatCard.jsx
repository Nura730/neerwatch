/** StatCard — compact metric card for the dashboard */
export function StatCard({ label, value, subtext, variant }) {
  const variantClass = variant === 'alert' ? 'stat-card--alert'
                     : variant === 'pass'  ? 'stat-card--pass'
                     : variant === 'warn'  ? 'stat-card--warn'
                     : '';
  return (
    <div className={`stat-card ${variantClass}`}>
      <div className="stat-card__value">{value ?? '—'}</div>
      <div className="stat-card__label">{label}</div>
      {subtext && (
        <div style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)', marginTop: 4 }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
