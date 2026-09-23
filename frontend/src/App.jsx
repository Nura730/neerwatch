import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSyncEngine } from './hooks/useSyncEngine.js';
import { AppShell } from './components/layout/AppShell.jsx';

import { DashboardPage } from './pages/DashboardPage.jsx';
import { MapPage } from './pages/MapPage.jsx';
import { ObservationListPage } from './pages/ObservationListPage.jsx';
import { ObservationFormPage } from './pages/ObservationFormPage.jsx';
import { ClustersPage } from './pages/ClustersPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { WardsPage } from './pages/WardsPage.jsx';
import { RainfallPage } from './pages/RainfallPage.jsx';
import { SyncCenterPage } from './pages/SyncCenterPage.jsx';

export default function App() {
  const syncEngine = useSyncEngine();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell {...syncEngine} />}>
          <Route index element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="observations" element={<ObservationListPage />} />
          <Route path="observations/new" element={<ObservationFormPage />} />
          <Route path="clusters" element={<ClustersPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="wards" element={<WardsPage />} />
          <Route path="rainfall" element={<RainfallPage />} />
          <Route path="sync" element={<SyncCenterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
