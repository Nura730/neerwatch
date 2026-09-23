import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { OfflineBanner } from './OfflineBanner.jsx';

export function AppShell({
  isOnline,
  pendingCount,
  isSyncing,
  lastSyncTime,
  syncError,
  syncStats,
  runSync,
  refreshPendingCount,
}) {
  const contextValue = {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    syncError,
    syncStats,
    runSync,
    refreshPendingCount,
  };

  return (
    <div className="app-shell">
      <Sidebar pendingCount={pendingCount} />
      <div className="main-area">
        <Header
          isOnline={isOnline}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          lastSyncTime={lastSyncTime}
        />
        <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />
        <main className="page-content" id="main-content">
          <Outlet context={contextValue} />
        </main>
      </div>
    </div>
  );
}
