import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSyncEngine } from './hooks/useSyncEngine.js';
import { AppShell } from './components/layout/AppShell.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';

import { RoleGuard } from './auth/RoleGuard.jsx';
import { canCreateTest, canSyncTests, canManageUsers } from './auth/permissions.js';

import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { MapPage } from './pages/MapPage.jsx';
import { ObservationListPage } from './pages/ObservationListPage.jsx';
import { ObservationFormPage } from './pages/ObservationFormPage.jsx';
import { ClustersPage } from './pages/ClustersPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { WardsPage } from './pages/WardsPage.jsx';
import { RainfallPage } from './pages/RainfallPage.jsx';
import { SyncCenterPage } from './pages/SyncCenterPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';

export default function App() {
  const syncEngine = useSyncEngine();

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<AppShell {...syncEngine} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="observations" element={<ObservationListPage />} />
            <Route path="observations/new" element={
              <RoleGuard isAllowed={canCreateTest}>
                <ObservationFormPage />
              </RoleGuard>
            } />
            <Route path="clusters" element={<ClustersPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="wards" element={<WardsPage />} />
            <Route path="rainfall" element={<RainfallPage />} />
            <Route path="sync" element={
              <RoleGuard isAllowed={canSyncTests}>
                <SyncCenterPage />
              </RoleGuard>
            } />
            <Route path="users" element={
              <RoleGuard isAllowed={canManageUsers}>
                <UsersPage />
              </RoleGuard>
            } />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
