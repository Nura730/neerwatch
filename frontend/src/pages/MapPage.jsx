import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip } from 'react-leaflet';
import { useApiData } from '../hooks/useApiData.js';
import { getTestsMap, getClusters, getRainfall, getWards } from '../services/api.js';
import { ClusterInvestigationPanel } from '../components/map/ClusterInvestigationPanel.jsx';
import { LoadingState, ErrorState } from '../components/ui/States.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { formatDateTime, testTypeLabel, testTypeUnit } from '../utils/format.js';
import { classifyResult } from '../services/mock.js';
import { MapPin, Info, AlertTriangle, Layers } from 'lucide-react';
import L from 'leaflet';

// Fix Leaflet default icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const KOCHI_CENTER = [9.9312, 76.2673];
const DEFAULT_ZOOM = 13;
const TEST_TYPES = ['TDS', 'pH', 'turbidity', 'coliform'];

export function MapPage() {
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [filters, setFilters] = useState({ wardId: '', testType: '', resultClass: '' });
  
  const mapFetch      = useCallback(() => getTestsMap(filters.wardId ? { wardId: filters.wardId } : {}), [filters.wardId]);
  const clusterFetch  = useCallback(() => getClusters(), []);
  const rainfallFetch = useCallback(() => getRainfall(), []);
  const wardFetch     = useCallback(() => getWards(), []);

  const { data: mapData,   loading: mapLoading,     error: mapError }   = useApiData(mapFetch, [filters.wardId]);
  const { data: clusterD,  loading: clusterLoading, error: clusterError } = useApiData(clusterFetch);
  const { data: rainfallD }                                               = useApiData(rainfallFetch);
  const { data: wardData }                                                = useApiData(wardFetch);

  const observations = mapData?.observations || [];
  const clusters     = clusterD?.clusters    || [];
  const rainfall     = rainfallD?.rainfall   || [];
  const wards        = wardData?.wards       || [];

  // Client side filtering for testType and resultClass (since api doesn't natively support it on getTestsMap or we don't want to overfetch)
  const filteredObservations = observations.filter(obs => {
    if (filters.testType && obs.testType !== filters.testType) return false;
    if (filters.resultClass) {
      const classification = classifyResult(obs.testType, obs.result);
      if (classification !== filters.resultClass) return false;
    }
    return true;
  });

  const activeFilters = [];
  if (filters.wardId) activeFilters.push({ key: 'wardId', label: 'Ward', value: filters.wardId });
  if (filters.testType) activeFilters.push({ key: 'testType', label: 'Type', value: testTypeLabel(filters.testType) });
  if (filters.resultClass) activeFilters.push({ key: 'resultClass', label: 'Result', value: filters.resultClass === 'fail' ? 'Elevated' : 'Normal' });

  const handleRemoveFilter = (key) => setFilters(f => ({ ...f, [key]: '' }));
  const handleClearAll = () => setFilters({ wardId: '', testType: '', resultClass: '' });

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] -mx-6 -mt-6 -mb-6 bg-nw-bg">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="bg-nw-surface border-b border-nw-border px-6 py-3 flex items-center justify-between shrink-0 z-20">
        <h1 className="text-lg font-bold text-nw-text m-0 flex items-center gap-2">
          <MapPin size={18} className="text-nw-navy" /> Observation Map
        </h1>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-nw-surface-2 px-3 py-1.5 rounded-full border border-nw-border-2">
            <LegendItem color="#B91C1C" label="Elevated Result" />
            <LegendItem color="#059669" label="Normal Result" />
            <LegendItem color="#D97706" label="Possible Cluster" circle />
          </div>
          
          <div className="bg-[#FFFBEB] border border-[#FDE68A] text-[#78350F] px-3 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Synthetic demonstration data
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 pb-2 shrink-0 bg-nw-bg z-10">
        <FilterBar filters={activeFilters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAll}>
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-nw-text-muted" />
            <span className="text-xs font-semibold text-nw-text mr-1">Map Layers:</span>
          </div>
          
          <select
            className="nw-input text-xs py-1.5 min-w-[130px] !w-auto"
            value={filters.wardId}
            onChange={e => setFilters(f => ({ ...f, wardId: e.target.value }))}
          >
            <option value="">All wards</option>
            {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.name || w.wardId}</option>)}
          </select>
          
          <select
            className="nw-input text-xs py-1.5 min-w-[130px] !w-auto"
            value={filters.testType}
            onChange={e => setFilters(f => ({ ...f, testType: e.target.value }))}
          >
            <option value="">All parameters</option>
            {TEST_TYPES.map(t => <option key={t} value={t}>{testTypeLabel(t)}</option>)}
          </select>

          <select
            className="nw-input text-xs py-1.5 min-w-[130px] !w-auto"
            value={filters.resultClass}
            onChange={e => setFilters(f => ({ ...f, resultClass: e.target.value }))}
          >
            <option value="">All results</option>
            <option value="fail">Elevated (Fail)</option>
            <option value="pass">Normal (Pass)</option>
          </select>
        </FilterBar>
      </div>

      {/* ── Map + Panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {(mapLoading || clusterLoading) && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-[2000] flex items-center justify-center">
            <LoadingState message="Loading spatial data…" />
          </div>
        )}
        
        {mapError && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000]"><ErrorState message={mapError} /></div>}
        {clusterError && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000]"><ErrorState message={clusterError} /></div>}

        <div className="flex-1 relative bg-[#E5E3DF]">
          <MapContainer
            center={KOCHI_CENTER}
            zoom={DEFAULT_ZOOM}
            className="w-full h-full z-10"
            aria-label="Water quality observation map"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Cluster circles */}
            {clusters.map(cluster => (
              <Circle
                key={cluster.id}
                center={[cluster.centroid.lat, cluster.centroid.lng]}
                radius={cluster.radiusMetres}
                pathOptions={{
                  color: '#D97706',
                  fillColor: '#D97706',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '6 4',
                }}
                eventHandlers={{ click: () => setSelectedCluster(cluster) }}
              >
                <Tooltip direction="top" opacity={1} className="font-sans text-xs">
                  <div className="font-bold text-nw-warn">Possible Cluster</div>
                  <div>{testTypeLabel(cluster.testType)} — {cluster.wardId}</div>
                  <div className="text-nw-text-muted mt-1 text-[10px]">Click to investigate</div>
                </Tooltip>
              </Circle>
            ))}

            {/* Observation markers */}
            {filteredObservations.map(obs => {
              if (!obs.location) return null;
              const isFail = classifyResult(obs.testType, obs.result) === 'fail';
              return (
                <CircleMarker
                  key={obs.clientId}
                  center={[obs.location.lat, obs.location.lng]}
                  radius={isFail ? 7 : 5}
                  pathOptions={{
                    color: isFail ? '#9B1C1C' : '#065F46',
                    fillColor: isFail ? '#B91C1C' : '#059669',
                    fillOpacity: 0.85,
                    weight: 1.5,
                  }}
                >
                  <Popup className="font-sans">
                    <div className="min-w-[180px]">
                      <div className="font-bold text-sm mb-1 text-nw-text flex items-center justify-between">
                        {obs.householdId}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${isFail ? 'bg-nw-fail-bg text-nw-fail' : 'bg-nw-pass-bg text-nw-pass'}`}>
                          {isFail ? 'Elevated' : 'Normal'}
                        </span>
                      </div>
                      
                      <div className="bg-nw-surface-2 rounded p-2 mb-2">
                        <div className="text-xs flex justify-between mb-1">
                          <span className="text-nw-text-muted font-medium">Parameter</span>
                          <span className="font-semibold">{testTypeLabel(obs.testType)}</span>
                        </div>
                        <div className="text-xs flex justify-between mb-1">
                          <span className="text-nw-text-muted font-medium">Result</span>
                          <span className="font-bold text-nw-text">{obs.result} <span className="text-[10px] text-nw-text-faint">{testTypeUnit(obs.testType)}</span></span>
                        </div>
                        <div className="text-xs flex justify-between">
                          <span className="text-nw-text-muted font-medium">Ward</span>
                          <span className="font-medium">{obs.wardId}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-nw-border-2">
                        <div className="text-[10px] text-nw-text-muted flex items-center gap-1">
                          <Info size={10} /> Synthetic Data
                        </div>
                        <div className="text-[10px] text-nw-text-muted">
                          {formatDateTime(obs.testedAt)}
                        </div>
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
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-nw-text-muted">
      {circle ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-dashed block" style={{ borderColor: color }} />
      ) : (
        <span className="w-2.5 h-2.5 rounded-full block" style={{ background: color }} />
      )}
      {label}
    </div>
  );
}
