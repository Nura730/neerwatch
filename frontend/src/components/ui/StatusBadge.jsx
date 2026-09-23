/**
 * StatusBadge — colour-coded pill.
 * variant: pass | fail | warn | neutral | cluster | navy | pending | syncing | synced | failed | duplicate
 */
export function StatusBadge({ label, variant = 'neutral', size = 'sm' }) {
  const variantMap = {
    pass:      'badge-pass',
    fail:      'badge-fail',
    warn:      'badge-warn',
    neutral:   'badge-neutral',
    cluster:   'badge-cluster',
    navy:      'badge-navy',
    pending:   'badge-neutral',
    syncing:   'badge-navy',
    synced:    'badge-pass',
    failed:    'badge-fail',
    duplicate: 'badge-warn',
    high:      'badge-fail',
    medium:    'badge-warn',
    low:       'badge-neutral',
    resolved:  'badge-pass',
    active:    'badge-cluster',
  };
  return (
    <span className={`badge ${variantMap[variant] || 'badge-neutral'}`}
          style={size === 'xs' ? { fontSize: '0.6875rem', padding: '1px 6px' } : {}}>
      {label}
    </span>
  );
}

/**
 * SyncStatusBadge — specific badge for observation sync status.
 */
export function SyncStatusBadge({ status }) {
  const map = {
    pending:   { label: 'Pending',   variant: 'pending'   },
    syncing:   { label: 'Syncing',   variant: 'syncing'   },
    synced:    { label: 'Synced',    variant: 'synced'    },
    failed:    { label: 'Failed',    variant: 'failed'    },
    duplicate: { label: 'Duplicate', variant: 'duplicate' },
  };
  const { label, variant } = map[status] || { label: status, variant: 'neutral' };
  return <StatusBadge label={label} variant={variant} />;
}
