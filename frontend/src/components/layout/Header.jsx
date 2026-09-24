import { Wifi, WifiOff, RefreshCw, LogOut, User, Menu } from 'lucide-react';
import { formatRelative } from '../../utils/format.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLES } from '../../auth/permissions.js';

const ROLE_LABELS = {
  [ROLES.VIEWER]: 'Viewer',
  [ROLES.OPERATOR]: 'Operator',
  [ROLES.ADMIN]: 'Administrator'
};

export function Header({ isOnline, pendingCount, isSyncing, lastSyncTime, onMenuToggle }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-[60px] px-4 sm:px-6 bg-white border-b border-nw-border flex items-center shrink-0 z-10 shadow-sm justify-between">
      {/* Hamburger (mobile only) + Title */}
      <div className="flex items-center">
        <button
          onClick={onMenuToggle}
          className="md:hidden mr-3 -ml-1 p-2 rounded text-nw-text-muted hover:text-nw-text hover:bg-nw-surface-2 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <span className="font-bold text-[15px] text-nw-navy tracking-wide">
          NEERWATCH
        </span>
        <span className="ml-3 text-xs text-nw-text-muted font-medium hidden sm:inline-block">
          Water Observation &amp; Early Warning
        </span>
      </div>

      <div className="flex items-center gap-6">
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
                <span className="text-xs font-bold text-nw-pass hidden sm:inline-block">Online</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-nw-warn" />
                <span className="text-xs font-bold text-nw-warn hidden sm:inline-block">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* User Identity & Logout */}
        {user ? (
          <div className="flex items-center gap-4 pl-4 border-l border-nw-border-2">
            <div className="flex items-center gap-2 text-right hidden md:flex">
              <div className="w-8 h-8 rounded-full bg-nw-surface-2 flex items-center justify-center text-nw-text-muted border border-nw-border-2">
                <User size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-nw-text leading-tight">{user.email}</span>
                <span className="text-[11px] text-nw-text-muted font-medium">{ROLE_LABELS[user.role] || user.role}</span>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-nw-text-muted hover:text-nw-fail transition-colors text-sm font-medium"
              title="Logout"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline-block">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 pl-4 border-l border-nw-border-2">
            <div className="flex items-center gap-2 text-right hidden md:flex">
              <div className="w-8 h-8 rounded-full bg-nw-surface-2 flex items-center justify-center text-nw-text-muted border border-nw-border-2">
                <User size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-nw-text leading-tight">Public</span>
                <span className="text-[11px] text-nw-text-muted font-medium">Viewer</span>
              </div>
            </div>
            <a
              href="/login"
              className="nw-btn nw-btn-primary nw-btn-sm"
            >
              Sign In
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
