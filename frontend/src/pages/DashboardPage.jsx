import React, { useCallback, useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip } from 'react-leaflet';
import { AlertTriangle, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useApiData } from '../hooks/useApiData.js';
import { getDashboard, getClusters, getAlerts, getTestsMap } from '../services/api.js';
import { MetricCard } from '../components/ui/MetricCard.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { LoadingState, ErrorState, PageHeader } from '../components/ui/States.jsx';
import { formatDateTime, formatMetres, testTypeLabel, formatNumber, testTypeUnit } from '../utils/format.js';
import { classifyResult } from '../services/mock.js';
import L from 'leaflet';

const KOCHI_CENTER = [9.9312, 76.2673];
const DEFAULT_ZOOM = 13;

export function DashboardPage() {
  const { pendingCount, lastSyncTime } = useOutletContext();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onlineHandler = () => setIsOnline(true);
    const offlineHandler = () => setIsOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);

  const dashFetch  = useCallback(() => getDashboard(), []);
  const clusterFetch = useCallback(() => getClusters({ active: true }), []);
  const alertFetch = useCallback(() => getAlerts({ active: true }), []);
  const mapFetch = useCallback(() => getTestsMap(), []);

  const { data: dash, loading: dashLoading, error: dashError, refetch: refetchDash } = useApiData(dashFetch);
  const { data: clusterD, loading: clusterLoading } = useApiData(clusterFetch);
  const { data: alertD, loading: alertLoading } = useApiData(alertFetch);
  const { data: mapData, loading: mapLoading } = useApiData(mapFetch);

  const activeClusters = clusterD?.clusters || [];
  const activeAlerts   = alertD?.alerts || [];
  const observations = mapData?.observations || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-nw-text m-0">Dashboard</h1>
          <p className="text-sm text-nw-text-muted m-0">System-wide operational overview</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full ${isOnline ? 'bg-nw-pass-bg text-nw-pass' : 'bg-nw-warn-bg text-nw-warn'}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? 'System Online' : 'System Offline'}
          </div>
          {lastSyncTime && (
            <div className="text-xs text-nw-text-muted">
              Last sync: {formatDateTime(lastSyncTime)}
            </div>
          )}
          <button className="nw-btn bg-white text-nw-text border border-nw-border-2" onClick={refetchDash}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-[#FFFBEB] border border-[#FDE68A] text-[#78350F] px-4 py-2 rounded flex items-center gap-2 text-xs font-semibold mb-6">
        <AlertTriangle size={14} />
        DEMO DATA — Synthetic observations for prototype demonstration.
      </div>

      <section className="mb-6">
        {dashLoading && <LoadingState message="Loading metrics…" />}
        {dashError && <ErrorState message={dashError} onRetry={refetchDash} />}
        {dash && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard
              label="Total Observations"
              value={formatNumber(dash.totalTests)}
              subtext="All time"
            />
            <MetricCard
              label="Failing / Positive"
              value={formatNumber(dash.positiveTests)}
              subtext={dash.totalTests ? `${Math.round(dash.positiveTests / dash.totalTests * 100)}% of total` : ''}
              variant="alert"
            />
            <MetricCard
              label="Active Clusters"
              value={dash.activeClusters}
              subtext="Requires investigation"
              variant={dash.activeClusters > 0 ? 'alert' : 'pass'}
            />
            <MetricCard
              label="Pending Sync"
              value={pendingCount}
              subtext="Awaiting upload"
              variant={pendingCount > 0 ? 'warn' : 'neutral'}
            />
            {dash.missingLocations > 0 && (
              <MetricCard
                label="Missing Locations"
                value={dash.missingLocations}
                subtext="Excluded from spatial map"
                variant="warn"
              />
            )}
          </div>
        )}
      </section>

      <section className="flex-1 flex gap-6 min-h-[400px]">
        {/* Main interactive map */}
        <div className="flex-1 bg-nw-surface border border-nw-border rounded-md shadow-nw-sm flex flex-col overflow-hidden relative">
          <div className="absolute top-4 left-14 z-[400] bg-white/90 backdrop-blur px-3 py-2 rounded shadow-sm border border-nw-border text-xs font-semibold text-nw-text-muted uppercase tracking-wide">
            Live Observation Map
          </div>
          {mapLoading ? (
             <LoadingState message="Loading map..." />
          ) : (
            <MapContainer center={KOCHI_CENTER} zoom={DEFAULT_ZOOM} style={{ width: '100%', height: '100%', zIndex: 1 }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {activeClusters.map(cluster => (
                <Circle
                  key={`dash-${cluster.id}`}
                  center={[cluster.centroid.lat, cluster.centroid.lng]}
                  radius={cluster.radiusMetres}
                  pathOptions={{ color: '#D97706', fillColor: '#D97706', fillOpacity: 0.1, weight: 2, dashArray: '4 4' }}
                />
              ))}
              {observations.map(obs => {
                if (!obs.location) return null;
                const isFail = classifyResult(obs.testType, obs.result) === 'fail';
                return (
                  <CircleMarker
                    key={`dash-${obs.clientId}`}
                    center={[obs.location.lat, obs.location.lng]}
                    radius={5}
                    pathOptions={{ color: isFail ? '#9B1C1C' : '#065F46', fillColor: isFail ? '#B91C1C' : '#059669', fillOpacity: 0.9, weight: 1 }}
                  >
                    <Popup>
                      <div className="font-sans text-xs min-w-[150px]">
                        <div className="font-bold mb-1">{testTypeLabel(obs.testType)}</div>
                        <div className="text-nw-text-muted mb-1">Result: {obs.result} {testTypeUnit(obs.testType)}</div>
                        <div className="text-nw-text-muted mb-2">Ward {obs.wardId}</div>
                        <Link to="/map" className="text-nw-navy hover:underline font-semibold flex items-center gap-1">
                          Investigate <MapPin size={10} />
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Sidebar: Requires Attention */}
        <div className="w-[340px] bg-nw-surface border border-nw-border rounded-md shadow-nw-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-nw-border bg-nw-surface-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-nw-text uppercase tracking-wide">Requires Attention</h2>
            <span className="bg-nw-fail-bg text-nw-fail text-xs font-bold px-2 py-0.5 rounded-full">
              {activeClusters.length + activeAlerts.length} issues
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-nw-bg">
            {clusterLoading || alertLoading ? <LoadingState message="Loading..." /> : (
              <>
                {activeAlerts.map(alert => (
                  <div key={alert.id} className="bg-white border-l-4 border-nw-fail border-y border-r border-y-nw-border border-r-nw-border rounded p-3 shadow-sm">
                    <div className="flex gap-2 mb-2">
                      <StatusBadge label="CRITICAL ALERT" variant="fail" size="xs" />
                      {alert.wardId && <StatusBadge label={`Ward ${alert.wardId}`} variant="neutral" size="xs" />}
                    </div>
                    <div className="text-sm font-semibold text-nw-text mb-1">{alert.title || alert.message}</div>
                    <div className="text-xs text-nw-text-muted">Generated: {formatDateTime(alert.createdAt)}</div>
                  </div>
                ))}
                
                {activeClusters.map(cluster => (
                  <div key={cluster.id} className="bg-white border-l-4 border-nw-cluster border-y border-r border-y-nw-border border-r-nw-border rounded p-3 shadow-sm">
                    <div className="flex gap-2 mb-2">
                      <StatusBadge label="POSSIBLE CLUSTER" variant="cluster" size="xs" />
                      <StatusBadge label={`Ward ${cluster.wardId}`} variant="neutral" size="xs" />
                    </div>
                    <div className="text-sm text-nw-text-2 mb-2">
                      <strong>{cluster.observationCount}</strong> qualifying observations within {cluster.radiusMetres ? `≈${formatMetres(cluster.radiusMetres)}` : 'spatial threshold'}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-[11px] text-nw-text-muted font-medium">Detected {formatDateTime(cluster.detectedAt)}</div>
                      <Link to={`/clusters?id=${cluster.id}`} className="text-xs font-semibold text-nw-navy hover:underline">
                        View evidence
                      </Link>
                    </div>
                  </div>
                ))}

                {activeClusters.length === 0 && activeAlerts.length === 0 && (
                  <div className="text-center text-nw-text-muted text-sm py-8">
                    No active clusters or alerts requiring attention.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
