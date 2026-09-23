import { AlertTriangle, WifiOff } from 'lucide-react';

export function OfflineBanner({ isOnline, pendingCount }) {
  if (isOnline) return null;
  return (
    <div className="bg-nw-warn text-white px-6 py-2.5 flex items-center gap-3 text-xs font-medium shrink-0 shadow-[0_2px_10px_rgba(217,119,6,0.2)] z-20" role="alert" aria-live="polite">
      <WifiOff size={16} className="shrink-0" />
      <span className="flex-1">
        <strong className="font-bold mr-1">You&apos;re offline.</strong>
        {pendingCount > 0
          ? `${pendingCount} observation${pendingCount !== 1 ? 's' : ''} will sync when connection is restored.`
          : 'Observations can still be recorded and will sync automatically when connection is restored.'
        }
      </span>
      {pendingCount > 0 && <AlertTriangle size={14} className="shrink-0" />}
    </div>
  );
}
