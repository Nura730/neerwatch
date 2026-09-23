import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { formatRelative } from '../../utils/format.js';

export function Header({ isOnline, pendingCount, isSyncing, lastSyncTime }) {
  return (
    <header className="h-[60px] px-6 bg-white border-b border-nw-border flex items-center shrink-0 z-10 shadow-sm">
      {/* Title */}
      <div className="flex-1 flex items-center">
        <span className="font-bold text-[15px] text-nw-navy tracking-wide">
          NEERWATCH
        </span>
        <span className="ml-3 text-xs text-nw-text-muted font-medium hidden sm:inline-block">
          Water Observation &amp; Early Warning
        </span>
      </div>

      {/* Sync status */}
      <div className="flex items-center gap-4">
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <RefreshCw size={14} className="text-nw-teal animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-nw-warn animate-pulse" />
            )}
            <span className="text-xs font-medium text-nw-text-muted">
              {isSyncing ? 'Syncing…' : `${pendingCount} pending`}
            </span>
          </div>
        )}
        {!isSyncing && pendingCount === 0 && lastSyncTime && (
          <span className="text-xs font-medium text-nw-text-faint hidden sm:inline-block">
            Last sync {formatRelative(lastSyncTime)}
          </span>
        )}

        {/* Connection badge */}
        <div className="flex items-center gap-1.5 ml-2 pl-4 border-l border-nw-border-2">
          {isOnline ? (
            <>
              <Wifi size={14} className="text-nw-pass" />
              <span className="text-xs font-bold text-nw-pass">Online</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-nw-warn" />
              <span className="text-xs font-bold text-nw-warn">Offline</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
