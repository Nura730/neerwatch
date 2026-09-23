import { useState, useEffect } from 'react';
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
  { value: 'TDS', label: 'TDS (Total Dissolved Solids)', unit: 'mg/L', hint: 'Safe: < 500 mg/L · Failing: ≥ 500 mg/L' },
  { value: 'pH', label: 'pH Value', unit: 'pH', hint: 'Safe: 6.5 – 8.5 · Failing: < 6.5 or > 8.5' },
  { value: 'turbidity', label: 'Turbidity', unit: 'NTU', hint: 'Safe: < 5 NTU · Failing: ≥ 5 NTU' },
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
    <div style={{ maxWidth: 840, margin: '0 auto', paddingBottom: 40 }}>
      <PageHeader
        title="Record New Observation"
        subtitle="Record water quality measurements directly on site. Data is saved to your local database immediately and safely queued for synchronization."
      />

      {/* Offline notice banner */}
      {!isOnline && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'rgba(217,119,6,0.1)',
          border: '1px solid #D97706',
          borderRadius: 8,
          marginBottom: 20,
          color: '#B45309',
          fontSize: '0.875rem'
        }}>
          <WifiOff size={18} />
          <div>
            <strong>Offline Mode Active:</strong> Your observation will be stored safely in local IndexedDB. It will automatically upload when connectivity returns.
          </div>
        </div>
      )}

      {/* Success alert */}
      {successInfo && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid #10B981',
          borderRadius: 8,
          marginBottom: 24,
          color: '#065F46',
          fontSize: '0.875rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: '0.9375rem', marginBottom: 6 }}>
            <CheckCircle2 size={20} color="#10B981" />
            Observation Stored Successfully
          </div>
          <p style={{ margin: '4px 0 10px' }}>
            Saved to local storage with Client ID: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>{successInfo.clientId}</code>
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setSuccessInfo(null)}
              style={{ fontSize: '0.8125rem', padding: '6px 14px' }}
            >
              Record Another
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => navigate('/observations')}
              style={{ fontSize: '0.8125rem', padding: '6px 14px' }}
            >
              View Observations List
            </button>
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} style={{
        background: 'var(--nw-card-bg)',
        border: '1px solid var(--nw-card-border)',
        borderRadius: 8,
        padding: '24px 28px',
        boxShadow: 'var(--nw-card-shadow)',
      }}>
        {formError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid #EF4444',
            borderRadius: 6,
            color: '#B91C1C',
            fontSize: '0.875rem',
            marginBottom: 20
          }}>
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 20 }}>
          {/* Household ID */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)', marginBottom: 6 }}>
              Household ID <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. HH-042"
              value={householdId}
              onChange={(e) => setHouseholdId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid var(--nw-card-border)',
                background: 'var(--nw-bg)',
                color: 'var(--nw-text)',
                fontSize: '0.875rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--nw-text-faint)', marginTop: 4, display: 'block' }}>
              Unique household or tap point identifier
            </span>
          </div>

          {/* Ward Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)', marginBottom: 6 }}>
              Administrative Ward <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={wardId}
              onChange={(e) => setWardId(e.target.value)}
              disabled={loadingWards}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid var(--nw-card-border)',
                background: 'var(--nw-bg)',
                color: 'var(--nw-text)',
                fontSize: '0.875rem',
              }}
            >
              {wards.map((w) => (
                <option key={w.wardId} value={w.wardId}>
                  {w.name || w.wardId}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--nw-text-faint)', marginTop: 4, display: 'block' }}>
              Ward responsible for water supply line
            </span>
          </div>
        </div>

        {/* Test Type selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)', marginBottom: 8 }}>
            Water Quality Parameter <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {TEST_TYPES.map((t) => {
              const selected = testType === t.value;
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTestType(t.value)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    border: selected ? '2px solid #0284C7' : '1px solid var(--nw-card-border)',
                    background: selected ? 'rgba(2,132,199,0.06)' : 'var(--nw-bg)',
                    color: selected ? '#0284C7' : 'var(--nw-text)',
                    fontWeight: selected ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '0.875rem' }}>{t.label.split(' (')[0]}</div>
                  <div style={{ fontSize: '0.75rem', color: selected ? '#0284C7' : 'var(--nw-text-faint)', marginTop: 2 }}>
                    {t.unit ? `Unit: ${t.unit}` : 'Standard scale'}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedTypeObj && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              fontSize: '0.75rem',
              color: 'var(--nw-text-faint)',
              background: 'var(--nw-bg-subtle)',
              padding: '6px 12px',
              borderRadius: 4
            }}>
              <Info size={14} />
              <span>{selectedTypeObj.hint}</span>
            </div>
          )}
        </div>

        {/* Result & Timestamp */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)', marginBottom: 6 }}>
              Test Result Value ({selectedTypeObj?.unit || 'value'}) <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder={`Enter numeric ${testType} value`}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid var(--nw-card-border)',
                background: 'var(--nw-bg)',
                color: 'var(--nw-text)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--nw-text)', marginBottom: 6 }}>
              Sample Timestamp <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="datetime-local"
                value={testedAt}
                onChange={(e) => setTestedAt(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--nw-card-border)',
                  background: 'var(--nw-bg)',
                  color: 'var(--nw-text)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div style={{
          borderTop: '1px solid var(--nw-card-border)',
          paddingTop: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--nw-text)' }}>
              <input
                type="checkbox"
                checked={hasLocation}
                onChange={(e) => setHasLocation(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#0284C7' }}
              />
              <span>Attach GPS Coordinates</span>
            </label>

            {hasLocation && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={handleCaptureGps}
                disabled={detectingGps}
                style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {detectingGps ? (
                  <>
                    <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    Detecting GPS…
                  </>
                ) : (
                  <>
                    <Compass size={13} />
                    Current Device GPS
                  </>
                )}
              </button>
            )}
          </div>

          {gpsError && (
            <div style={{ fontSize: '0.75rem', color: '#B45309', marginBottom: 10 }}>
              {gpsError}
            </div>
          )}

          {hasLocation ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--nw-text-muted)', marginBottom: 4 }}>
                  Latitude (°N)
                </label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="9.9312"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--nw-card-border)',
                    background: 'var(--nw-bg)',
                    color: 'var(--nw-text)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--nw-text-muted)', marginBottom: 4 }}>
                  Longitude (°E)
                </label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="76.2673"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--nw-card-border)',
                    background: 'var(--nw-bg)',
                    color: 'var(--nw-text)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{
              fontSize: '0.8125rem',
              color: 'var(--nw-text-muted)',
              background: 'var(--nw-bg-subtle)',
              padding: '10px 14px',
              borderRadius: 6
            }}>
              GPS coordinate capture omitted. This test will be recorded as <em>missing location</em> and will appear in aggregate and list reports, but excluded from map-based spatial cluster detection.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => navigate('/observations')}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
            style={{ minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {submitting ? (
              <>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
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
