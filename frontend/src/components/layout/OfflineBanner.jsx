import { AlertTriangle, WifiOff } from 'lucide-react';

export function OfflineBanner({ isOnline, pendingCount }) {
  if (isOnline) return null;
  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      <WifiOff size={14} />
      <span>
        <strong>You&apos;re offline.</strong>{' '}
        {pendingCount > 0
          ? `${pendingCount} observation${pendingCount !== 1 ? 's' : ''} will sync when connection is restored.`
          : 'Observations can still be recorded and will sync automatically when connection is restored.'
        }
      </span>
      {pendingCount > 0 && <AlertTriangle size={13} style={{ marginLeft: 'auto' }} />}
    </div>
  );
}
