import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip } from 'react-leaflet';
import { useApiData } from '../hooks/useApiData.js';
import { getTestsMap, getClusters, getRainfall } from '../services/api.js';
import { ClusterInvestigationPanel } from '../components/map/ClusterInvestigationPanel.jsx';
import { LoadingState, ErrorState } from '../components/ui/States.jsx';
import { formatDateTime, testTypeLabel, testTypeUnit } from '../utils/format.js';
import { classifyResult } from '../services/mock.js';

// Kochi/Ernakulam default centre
const KOCHI_CENTER = [9.9312, 76.2673];
const DEFAULT_ZOOM = 13;

// Fix Leaflet default icon issue in Vite
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export function MapPage() {
  const [selectedCluster, setSelectedCluster] = useState(null);

  const mapFetch      = useCallback(() => getTestsMap(), []);
  const clusterFetch  = useCallback(() => getClusters(), []);
  const rainfallFetch = useCallback(() => getRainfall(), []);

  const { data: mapData,   loading: mapLoading,     error: mapError }   = useApiData(mapFetch);
  const { data: clusterD,  loading: clusterLoading, error: clusterError } = useApiData(clusterFetch);
  const { data: rainfallD }                                               = useApiData(rainfallFetch);

  const observations = mapData?.observations || [];
  const clusters     = clusterD?.clusters    || [];
  const rainfall     = rainfallD?.rainfall   || [];

  if (mapLoading || clusterLoading) return <LoadingState message="Loading map data…" />;
  if (mapError)   return <ErrorState message={mapError} />;
  if (clusterError) return <ErrorState message={clusterError} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-24px' }}>

      {/* ── Map toolbar ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 20px',
        background: 'var(--nw-surface)',
        borderBottom: '1px solid var(--nw-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--nw-text)' }}>
          Observation Map
        </h1>
        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
          <LegendItem color="var(--nw-fail)" label="Positive observation" />
          <LegendItem color="var(--nw-pass)" label="Negative observation" />
          <LegendItem color="var(--nw-warn)" label="Possible cluster" circle />
        </div>
        <div className="synthetic-banner" style={{ margin: 0 }}>
          Synthetic demonstration data
        </div>
      </div>

      {/* ── Map + Panel ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={KOCHI_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ width: '100%', height: '100%' }}
            aria-label="Water quality observation map"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Cluster circles — rendered first so markers appear on top */}
            {clusters.map(cluster => (
              <Circle
                key={cluster.id}
                center={[cluster.centroid.lat, cluster.centroid.lng]}
                radius={cluster.radiusMetres}
                pathOptions={{
                  color: '#D97706',
                  fillColor: '#D97706',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '6 4',
                }}
                eventHandlers={{ click: () => setSelectedCluster(cluster) }}
              >
                <Tooltip>
                  Possible cluster — {testTypeLabel(cluster.testType)} — {cluster.wardId}
                  {'\n'}Click to investigate
                </Tooltip>
              </Circle>
            ))}

            {/* Observation markers */}
            {observations.map(obs => {
              if (!obs.location) return null;
              const resultClass = classifyResult(obs.testType, obs.result);
              const isFail = resultClass === 'fail';
              return (
                <CircleMarker
                  key={obs.clientId}
                  center={[obs.location.lat, obs.location.lng]}
                  radius={6}
                  pathOptions={{
                    color: isFail ? '#9B1C1C' : '#065F46',
                    fillColor: isFail ? '#B91C1C' : '#059669',
                    fillOpacity: 0.85,
                    weight: 1.5,
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{obs.householdId}</div>
                      <div style={{ color: '#475569', marginBottom: 2 }}>
                        <strong>Test:</strong> {testTypeLabel(obs.testType)}
                      </div>
                      <div style={{ color: '#475569', marginBottom: 2 }}>
                        <strong>Result:</strong> {obs.result} {testTypeUnit(obs.testType)}
                      </div>
                      <div style={{ color: '#475569', marginBottom: 2 }}>
                        <strong>Ward:</strong> {obs.wardId}
                      </div>
                      <div style={{ color: '#94A3B8', fontSize: 11 }}>
                        {formatDateTime(obs.testedAt)}
                      </div>
                      <div style={{
                        marginTop: 6,
                        padding: '3px 7px',
                        borderRadius: 3,
                        background: isFail ? '#FEE2E2' : '#DCFCE7',
                        color: isFail ? '#B91C1C' : '#15803D',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'inline-block',
                      }}>
                        {isFail ? 'Elevated result' : 'Within range'}
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                        Synthetic demonstration data
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Cluster investigation panel */}
        {selectedCluster && (
          <ClusterInvestigationPanel
            cluster={selectedCluster}
            rainfallData={rainfall}
            onClose={() => setSelectedCluster(null)}
          />
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label, circle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--nw-text-muted)' }}>
      {circle ? (
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          border: `2px dashed ${color}`,
          display: 'inline-block',
        }} />
      ) : (
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, display: 'inline-block',
        }} />
      )}
      {label}
    </div>
  );
}
