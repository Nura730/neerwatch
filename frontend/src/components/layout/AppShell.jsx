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
    <div className="flex h-screen w-full overflow-hidden bg-nw-bg font-sans text-nw-text selection:bg-nw-teal selection:text-white">
      <Sidebar pendingCount={pendingCount} />
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Header
          isOnline={isOnline}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          lastSyncTime={lastSyncTime}
        />
        <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 outline-none" id="main-content" tabIndex="-1">
          <Outlet context={contextValue} />
        </main>
      </div>
    </div>
  );
}
