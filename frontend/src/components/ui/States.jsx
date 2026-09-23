import { Loader2 } from 'lucide-react';

/** LoadingState */
export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="state-container">
      <Loader2 size={24} color="var(--nw-text-faint)" style={{ animation: 'spin 1s linear infinite' }} />
      <p>{message}</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** ErrorState */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-container">
      <h3>Unable to load data</h3>
      <p style={{ color: 'var(--nw-fail)' }}>{message}</p>
      {onRetry && (
        <button className="nw-btn nw-btn-secondary nw-btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** EmptyState */
export function EmptyState({ title = 'No data', message, action }) {
  return (
    <div className="state-container">
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

/** PageHeader */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
