import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { formatRelative } from '../../utils/format.js';

export function Header({ isOnline, pendingCount, isSyncing, lastSyncTime }) {
  return (
    <header className="header-bar">
      {/* Title */}
      <div style={{ flex: 1 }}>
        <span style={{
          fontWeight: 700,
          fontSize: '0.9375rem',
          color: 'var(--nw-navy)',
          letterSpacing: '0.03em',
        }}>
          NEERWATCH
        </span>
        <span style={{
          marginLeft: 10,
          fontSize: '0.75rem',
          color: 'var(--nw-text-muted)',
          fontWeight: 400,
        }}>
          Water Observation &amp; Early Warning
        </span>
      </div>

      {/* Sync status */}
      {pendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isSyncing
            ? <RefreshCw size={13} color="var(--nw-teal)" style={{ animation: 'spin 1s linear infinite' }} />
            : <span className="sync-dot sync-dot--pending" />
          }
          <span style={{ fontSize: '0.75rem', color: 'var(--nw-text-muted)' }}>
            {isSyncing ? 'Syncing…' : `${pendingCount} pending`}
          </span>
        </div>
      )}
      {!isSyncing && pendingCount === 0 && lastSyncTime && (
        <span style={{ fontSize: '0.75rem', color: 'var(--nw-text-faint)' }}>
          Last sync {formatRelative(lastSyncTime)}
        </span>
      )}

      {/* Connection badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {isOnline ? (
          <>
            <Wifi size={13} color="var(--nw-pass)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--nw-pass)', fontWeight: 600 }}>
              Online
            </span>
          </>
        ) : (
          <>
            <WifiOff size={13} color="var(--nw-warn)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--nw-warn)', fontWeight: 600 }}>
              Offline
            </span>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}
