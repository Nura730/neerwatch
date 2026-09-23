import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/ui/States.jsx';
import { saveObservation } from '../db/observationStore.js';
import { getWards } from '../services/api.js';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Compass,
  WifiOff,
  RefreshCw,
  Info
} from 'lucide-react';

const TEST_TYPES = [
  { value: 'TDS', label: 'TDS (Total Dissolved Solids)', unit: 'mg/L', hint: 'Safe: ≤ 500 mg/L · Failing: > 500 mg/L' },
  { value: 'pH', label: 'pH Value', unit: 'pH', hint: 'Safe: 6.5 – 8.5 · Failing: < 6.5 or > 8.5' },
  { value: 'turbidity', label: 'Turbidity', unit: 'NTU', hint: 'Safe: ≤ 4 NTU · Failing: > 4 NTU' },
  { value: 'coliform', label: 'Coliform Bacteria', unit: 'CFU/100mL', hint: 'Safe: 0 CFU · Failing: > 0 CFU' },
];

export function ObservationFormPage() {
  const navigate = useNavigate();
  // Get sync engine context from AppShell outlet if provided
  const context = useOutletContext() || {};
  const { isOnline, refreshPendingCount, runSync } = context;

  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(true);

  // Form State
  const [householdId, setHouseholdId] = useState('');
  const [wardId, setWardId] = useState('');
  const [testType, setTestType] = useState('TDS');
  const [result, setResult] = useState('');
  const [testedAt, setTestedAt] = useState(() => new Date().toISOString().slice(0, 16));
  
  // Location State
  const [hasLocation, setHasLocation] = useState(true);
  const [lat, setLat] = useState('9.9312');
  const [lng, setLng] = useState('76.2673');
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Submission Status
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let mounted = true;
    getWards()
      .then(data => {
        if (mounted && data?.wards) {
          setWards(data.wards);
          if (data.wards.length > 0) {
            setWardId(data.wards[0].wardId);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          // Fallback ward list if offline or error
          const fallbackWards = [
            { wardId: 'ward-01', name: 'Ward 1 - Fort Kochi' },
            { wardId: 'ward-02', name: 'Ward 2 - Mattancherry' },
            { wardId: 'ward-03', name: 'Ward 3 - Palluruthy' },
            { wardId: 'ward-04', name: 'Ward 4 - Edappally' },
            { wardId: 'ward-05', name: 'Ward 5 - Kaloor' },
            { wardId: 'ward-12', name: 'Ward 12 - Ernakulam Central' },
          ];
          setWards(fallbackWards);
          setWardId('ward-12');
        }
      })
      .finally(() => {
        if (mounted) setLoadingWards(false);
      });

    return () => { mounted = false; };
  }, []);

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setDetectingGps(false);
      },
      (err) => {
        setDetectingGps(false);
        setGpsError(`GPS failed (${err.message}). Using manual coordinates.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!householdId.trim()) {
      setFormError('Household ID is required (e.g. HH-042).');
      return;
    }
    if (!wardId) {
      setFormError('Please select a Ward.');
      return;
    }
    if (result === '' || isNaN(Number(result))) {
      setFormError('Please provide a valid numeric test result.');
      return;
    }

    let location = null;
    if (hasLocation) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        setFormError('Valid latitude and longitude numbers are required when location is enabled.');
        return;
      }
      if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        setFormError('Coordinates out of range (-90..90 for lat, -180..180 for lng).');
        return;
      }
      location = { lat: parsedLat, lng: parsedLng };
    }

    setSubmitting(true);

    try {
      const clientId = `NW-LOCAL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const isoTestedAt = new Date(testedAt).toISOString();

      const newObs = {
        clientId,
        householdId: householdId.trim(),
        testType,
        result: Number(result),
        testedAt: isoTestedAt,
        location,
        wardId,
      };

      await saveObservation(newObs);
      if (refreshPendingCount) {
        await refreshPendingCount();
      }

      setSuccessInfo({
        clientId,
        householdId: newObs.householdId,
        testType,
        result: newObs.result,
        hasLocation: Boolean(location),
      });

      // Clear input fields for next entry
      setHouseholdId('');
      setResult('');

      // Auto sync if online
      if (isOnline && runSync) {
        runSync();
      }
    } catch (err) {
      setFormError(`Failed to save observation to local database: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTypeObj = TEST_TYPES.find(t => t.value === testType);

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <PageHeader
        title="Record New Observation"
        description="Record water quality measurements directly on site. Data is saved to your local database immediately and safely queued for synchronization."
      />

      {/* Offline notice banner */}
      {!isOnline && (
        <div className="flex items-center gap-3 p-4 bg-nw-warn-bg border border-nw-warn/30 rounded-md text-nw-warn font-medium text-sm mb-6 shadow-sm">
          <WifiOff size={18} className="shrink-0" />
          <div>
            <strong>Offline Mode Active:</strong> Your observation will be stored safely in local IndexedDB. It will automatically upload when connectivity returns.
          </div>
        </div>
      )}

      {/* Success alert */}
      {successInfo && (
        <div className="p-5 bg-nw-pass-bg border border-nw-pass/30 rounded-md mb-6 text-nw-pass">
          <div className="flex items-center gap-2 font-bold text-base mb-2">
            <CheckCircle2 size={20} />
            Observation Stored Successfully
          </div>
          <p className="text-sm text-nw-text-2 mb-4">
            Saved to local storage with Client ID: <code className="bg-white/50 px-2 py-0.5 rounded border border-nw-pass/20">{successInfo.clientId}</code>
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="nw-btn nw-btn-secondary"
              onClick={() => setSuccessInfo(null)}
            >
              Record Another
            </button>
            <button
              type="button"
              className="nw-btn nw-btn-primary"
              onClick={() => navigate('/observations')}
            >
              View Observations List
            </button>
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-nw-surface border border-nw-border rounded-lg p-6 md:p-8 shadow-nw">
        {formError && (
          <div className="flex items-center gap-3 p-3 bg-nw-fail-bg border border-nw-fail/30 rounded-md text-nw-fail text-sm font-medium mb-6">
            <AlertCircle size={18} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Household ID */}
          <div>
            <label className="nw-label mb-1.5 flex items-center gap-1">
              Household ID <span className="text-nw-fail">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. HH-042"
              value={householdId}
              onChange={(e) => setHouseholdId(e.target.value)}
              required
              className="nw-input"
            />
            <span className="text-xs text-nw-text-faint mt-1.5 block">
              Unique household or tap point identifier
            </span>
          </div>

          {/* Ward Selection */}
          <div>
            <label className="nw-label mb-1.5 flex items-center gap-1">
              Administrative Ward <span className="text-nw-fail">*</span>
            </label>
            <select
              value={wardId}
              onChange={(e) => setWardId(e.target.value)}
              disabled={loadingWards}
              className="nw-input"
            >
              {wards.map((w) => (
                <option key={w.wardId} value={w.wardId}>
                  {w.name || w.wardId}
                </option>
              ))}
            </select>
            <span className="text-xs text-nw-text-faint mt-1.5 block">
              Ward responsible for water supply line
            </span>
          </div>
        </div>

        {/* Test Type selector */}
        <div className="mb-6">
          <label className="nw-label mb-2.5 flex items-center gap-1">
            Water Quality Parameter <span className="text-nw-fail">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEST_TYPES.map((t) => {
              const selected = testType === t.value;
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTestType(t.value)}
                  className={`p-3 rounded-md border text-left transition-all ${
                    selected 
                      ? 'border-[#0284C7] bg-[#0284C7]/10 text-[#0284C7] font-semibold' 
                      : 'border-nw-border bg-nw-bg text-nw-text hover:border-nw-border-2 hover:bg-nw-surface-2'
                  }`}
                >
                  <div className="text-sm">{t.label.split(' (')[0]}</div>
                  <div className={`text-xs mt-1 ${selected ? 'text-[#0284C7]/80' : 'text-nw-text-faint'}`}>
                    {t.unit ? `Unit: ${t.unit}` : 'Standard scale'}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedTypeObj && (
            <div className="flex items-center gap-2 mt-3 text-xs text-nw-text-muted bg-nw-bg-subtle p-2 rounded border border-nw-border-2 font-medium">
              <Info size={14} className="text-nw-teal" />
              <span>{selectedTypeObj.hint}</span>
            </div>
          )}
        </div>

        {/* Result & Timestamp */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="nw-label mb-1.5 flex items-center gap-1">
              Test Result Value ({selectedTypeObj?.unit || 'value'}) <span className="text-nw-fail">*</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder={`Enter numeric ${testType} value`}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              required
              className="nw-input"
            />
          </div>

          <div>
            <label className="nw-label mb-1.5 flex items-center gap-1">
              Sample Timestamp <span className="text-nw-fail">*</span>
            </label>
            <input
              type="datetime-local"
              value={testedAt}
              onChange={(e) => setTestedAt(e.target.value)}
              required
              className="nw-input"
            />
          </div>
        </div>

        {/* Location Section */}
        <div className="border-t border-nw-border-2 pt-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={hasLocation}
                onChange={(e) => setHasLocation(e.target.checked)}
                className="w-4 h-4 text-nw-teal rounded border-nw-border-2 focus:ring-nw-teal"
              />
              <span className="text-sm font-semibold text-nw-text group-hover:text-nw-navy transition-colors">Attach GPS Coordinates</span>
            </label>

            {hasLocation && (
              <button
                type="button"
                className="nw-btn nw-btn-secondary nw-btn-sm flex items-center gap-2"
                onClick={handleCaptureGps}
                disabled={detectingGps}
              >
                {detectingGps ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Detecting GPS…
                  </>
                ) : (
                  <>
                    <Compass size={13} className="text-nw-teal" />
                    Current Device GPS
                  </>
                )}
              </button>
            )}
          </div>

          {gpsError && (
            <div className="text-xs font-medium text-nw-warn mb-4 bg-nw-warn-bg p-2 rounded">
              {gpsError}
            </div>
          )}

          {hasLocation ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="nw-label mb-1.5">Latitude (°N)</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="9.9312"
                  className="nw-input font-mono"
                />
              </div>
              <div>
                <label className="nw-label mb-1.5">Longitude (°E)</label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="76.2673"
                  className="nw-input font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="text-xs text-nw-text-muted bg-nw-surface-2 p-3 rounded-md border border-nw-border-2 leading-relaxed">
              GPS coordinate capture omitted. This test will be recorded as <em>missing location</em> and will appear in aggregate and list reports, but will be excluded from map-based spatial cluster detection.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-nw-border-2">
          <button
            type="button"
            className="nw-btn nw-btn-secondary"
            onClick={() => navigate('/observations')}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="nw-btn nw-btn-primary min-w-[180px] flex items-center justify-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Saving to Local DB…
              </>
            ) : (
              <>
                <Save size={16} />
                Save Observation
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
