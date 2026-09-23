/**
 * formatDate — format ISO 8601 date strings for display.
 */

/**
 * Format: "23 Sep 2026"
 */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/**
 * Format: "23 Sep 2026 · 14:30"
 */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * Format: "2 hours ago", "3 days ago", etc.
 */
export function formatRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)  return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Format a failure rate as a percentage string.
 */
export function formatRate(rate) {
  if (rate === null || rate === undefined) return '—';
  return `${Math.round(rate * 100)}%`;
}

/**
 * Format a number with comma grouping.
 */
export function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN');
}

/**
 * Format metres: <1000 → "650 m", ≥1000 → "1.2 km"
 */
export function formatMetres(m) {
  if (m === null || m === undefined) return '—';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * Return label for testType display.
 */
export function testTypeLabel(testType) {
  const labels = { TDS: 'TDS', pH: 'pH', turbidity: 'Turbidity', coliform: 'Coliform' };
  return labels[testType] || testType;
}

/**
 * Return label for testType unit.
 */
export function testTypeUnit(testType) {
  const units = { TDS: 'mg/L', pH: '', turbidity: 'NTU', coliform: 'CFU/100mL' };
  return units[testType] || '';
}
