import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData.js';
import {
  getFieldTasks,
  getWards,
  assignFieldTask,
  updateFieldTaskStatus,
} from '../services/api.js';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { CreateFieldTaskModal } from '../components/ui/CreateFieldTaskModal.jsx';
import { formatDateTime, formatDate } from '../utils/format.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { canManageFieldTasks } from '../auth/permissions.js';
import {
  RefreshCw,
  Plus,
  X,
  MapPin,
  Calendar,
  User,
  ClipboardList,
  CheckCircle,
  XCircle,
  PlayCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

const STATUSES = [
  { value: '',            label: 'All' },
  { value: 'pending',     label: 'Pending' },
  { value: 'assigned',    label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
];

const PRIORITIES = [
  { value: '',         label: 'All priorities' },
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const PRIORITY_VARIANT = {
  low:      'neutral',
  medium:   'navy',
  high:     'warn',
  critical: 'fail',
};

const STATUS_VARIANT = {
  pending:     'neutral',
  assigned:    'navy',
  in_progress: 'warn',
  completed:   'pass',
  cancelled:   'neutral',
};

const STATUS_LABEL = {
  pending:     'Pending',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

// Backend-defined valid transitions — mirrored here for UX only (backend validates)
const VALID_TRANSITIONS = {
  pending:     ['in_progress', 'cancelled'],
  assigned:    ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

const TRANSITION_LABELS = {
  in_progress: 'Start Investigation',
  completed:   'Mark Completed',
  cancelled:   'Cancel Task',
  pending:     'Revert to Pending',
};

const TRANSITION_VARIANT = {
  in_progress: 'nw-btn-primary',
  completed:   'nw-btn-primary',
  cancelled:   'nw-btn-danger',
  pending:     'nw-btn-secondary',
};

// ─── Task Detail Drawer ──────────────────────────────────────────────────────

function FieldTaskDrawer({ task, onClose, onTaskUpdated, canManage }) {
  const [actionBusy, setActionBusy] = useState(null);
  const [assignInput, setAssignInput] = useState('');
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!task) return null;

  const isTerminal = task.status === 'completed' || task.status === 'cancelled';

  const handleStatusChange = async (newStatus) => {
    setActionError(null);
    setActionBusy(newStatus);
    try {
      const data = await updateFieldTaskStatus(task.id, { status: newStatus });
      onTaskUpdated(data.task);
    } catch (err) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setActionError(null);
    setActionBusy('assign');
    try {
      const data = await assignFieldTask(task.id, { assignedTo: assignInput.trim() || null });
      onTaskUpdated(data.task);
      setShowAssignForm(false);
      setAssignInput('');
    } catch (err) {
      setActionError(err.message || 'Assignment failed.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleUnassign = async () => {
    setActionError(null);
    setActionBusy('unassign');
    try {
      const data = await assignFieldTask(task.id, { assignedTo: null });
      onTaskUpdated(data.task);
    } catch (err) {
      setActionError(err.message || 'Unassign failed.');
    } finally {
      setActionBusy(null);
    }
  };

  const transitions = VALID_TRANSITIONS[task.status] || [];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        className="fixed inset-y-0 right-0 w-full max-w-md bg-nw-surface shadow-2xl z-50 flex flex-col border-l border-nw-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-nw-border bg-nw-surface-2">
          <h2 id="task-drawer-title" className="text-base font-bold text-nw-text">Field Task</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded text-nw-text-muted hover:text-nw-text hover:bg-nw-surface-3 transition-colors"
            aria-label="Close task details"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title + badges */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <StatusBadge label={STATUS_LABEL[task.status] || task.status} variant={STATUS_VARIANT[task.status] || 'neutral'} />
              <StatusBadge label={(task.priority || 'medium').toUpperCase()} variant={PRIORITY_VARIANT[task.priority] || 'neutral'} />
            </div>
            <h3 className="text-lg font-bold text-nw-text leading-snug">{task.title}</h3>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <p className="nw-label mb-1">Description</p>
              <p className="text-sm text-nw-text-2 bg-nw-surface-2 rounded p-3 border border-nw-border whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Details */}
          <div className="space-y-0">
            <p className="nw-label mb-2">Details</p>
            <div className="bg-nw-surface-2 rounded border border-nw-border divide-y divide-nw-border text-sm">
              <div className="flex justify-between px-3 py-2.5">
                <span className="text-nw-text-muted">Ward</span>
                <span className="font-medium text-nw-text">{task.wardId || '—'}</span>
              </div>
              {task.location && (
                <div className="flex justify-between px-3 py-2.5">
                  <span className="text-nw-text-muted flex items-center gap-1"><MapPin size={12} /> Location</span>
                  <span className="font-mono text-xs text-nw-text">{task.location.lat.toFixed(4)}, {task.location.lng.toFixed(4)}</span>
                </div>
              )}
              <div className="flex justify-between px-3 py-2.5">
                <span className="text-nw-text-muted flex items-center gap-1"><User size={12} /> Assigned To</span>
                <span className="font-medium text-nw-text">{task.assignedTo || <span className="text-nw-text-faint italic">Unassigned</span>}</span>
              </div>
              {task.dueAt && (
                <div className="flex justify-between px-3 py-2.5">
                  <span className="text-nw-text-muted flex items-center gap-1"><Calendar size={12} /> Due Date</span>
                  <span className="font-medium text-nw-text">{formatDate(task.dueAt)}</span>
                </div>
              )}
              {task.completedAt && (
                <div className="flex justify-between px-3 py-2.5">
                  <span className="text-nw-text-muted">Completed</span>
                  <span className="font-medium text-nw-pass">{formatDateTime(task.completedAt)}</span>
                </div>
              )}
              {task.sourceObservationId && (
                <div className="flex justify-between items-center px-3 py-2.5">
                  <span className="text-nw-text-muted">Linked Observation</span>
                  <Link
                    to="/observations"
                    className="text-nw-teal text-xs hover:underline flex items-center gap-1 font-mono"
                  >
                    {task.sourceObservationId.slice(-8)} <ExternalLink size={11} />
                  </Link>
                </div>
              )}
              <div className="flex justify-between px-3 py-2.5">
                <span className="text-nw-text-muted">Created</span>
                <span className="text-nw-text-muted text-xs">{formatDateTime(task.createdAt)}</span>
              </div>
              <div className="flex justify-between px-3 py-2.5">
                <span className="text-nw-text-muted">Updated</span>
                <span className="text-nw-text-muted text-xs">{formatDateTime(task.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions footer */}
        {canManage && !isTerminal && (
          <div className="border-t border-nw-border px-6 py-4 bg-nw-surface-2 space-y-3">
            {actionError && (
              <div className="bg-nw-fail-bg text-nw-fail text-xs rounded px-3 py-2 border border-nw-fail/20">
                {actionError}
              </div>
            )}

            {/* Assignment */}
            {!showAssignForm ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="nw-btn nw-btn-secondary nw-btn-sm flex-1"
                  onClick={() => { setShowAssignForm(true); setAssignInput(task.assignedTo || ''); }}
                  disabled={!!actionBusy}
                >
                  <User size={13} /> {task.assignedTo ? 'Reassign' : 'Assign'}
                </button>
                {task.assignedTo && (
                  <button
                    type="button"
                    className="nw-btn nw-btn-secondary nw-btn-sm"
                    onClick={handleUnassign}
                    disabled={!!actionBusy}
                  >
                    {actionBusy === 'unassign' ? <Loader2 size={13} className="animate-spin" /> : 'Unassign'}
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleAssign} className="flex gap-2">
                <input
                  type="text"
                  className="nw-input text-sm py-1.5 flex-1"
                  value={assignInput}
                  onChange={e => setAssignInput(e.target.value)}
                  placeholder="Operator name or email"
                  autoFocus
                />
                <button type="submit" className="nw-btn nw-btn-primary nw-btn-sm" disabled={!!actionBusy}>
                  {actionBusy === 'assign' ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
                </button>
                <button type="button" className="nw-btn nw-btn-secondary nw-btn-sm" onClick={() => setShowAssignForm(false)}>
                  Cancel
                </button>
              </form>
            )}

            {/* Status transitions */}
            {transitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {transitions.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`nw-btn nw-btn-sm ${TRANSITION_VARIANT[t] || 'nw-btn-secondary'}`}
                    onClick={() => handleStatusChange(t)}
                    disabled={!!actionBusy}
                  >
                    {actionBusy === t ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : t === 'completed' ? (
                      <CheckCircle size={13} />
                    ) : t === 'cancelled' ? (
                      <XCircle size={13} />
                    ) : (
                      <PlayCircle size={13} />
                    )}
                    {TRANSITION_LABELS[t] || t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── FieldWorkPage ───────────────────────────────────────────────────────────

export function FieldWorkPage() {
  const { user } = useAuth();
  const canManage = user ? canManageFieldTasks(user.role) : false;

  const [statusFilter,   setStatusFilter]   = useState('');
  const [wardFilter,     setWardFilter]      = useState('');
  const [priorityFilter, setPriorityFilter]  = useState('');
  const [selectedTask,   setSelectedTask]    = useState(null);
  const [showCreate,     setShowCreate]      = useState(false);
  // Local patches: id → updated task object for optimistic UI updates without full refetch
  const [taskPatches,    setTaskPatches]     = useState({});

  const fetchFn = useCallback(() => {
    const params = {};
    if (statusFilter)   params.status   = statusFilter;
    if (wardFilter)     params.wardId   = wardFilter;
    if (priorityFilter) params.priority = priorityFilter;
    return getFieldTasks(params);
  }, [statusFilter, wardFilter, priorityFilter]);

  const { data, loading, error, refetch } = useApiData(fetchFn, [fetchFn]);
  const { data: wardsData }               = useApiData(getWards, []);
  const wards = wardsData?.wards || [];

  const tasks = useMemo(() => {
    const base = data?.tasks || [];
    return base.map(t => taskPatches[t.id] ? { ...t, ...taskPatches[t.id] } : t);
  }, [data, taskPatches]);

  const handleTaskUpdated = (updatedTask) => {
    setTaskPatches(prev => ({ ...prev, [updatedTask.id]: updatedTask }));
    setSelectedTask(updatedTask);
  };

  const handleTaskCreated = () => {
    setTaskPatches({});
    refetch();
    setShowCreate(false);
  };

  // Active filter chips
  const activeFilters = [];
  if (wardFilter)     activeFilters.push({ key: 'wardId',   label: 'Ward',     value: wardFilter });
  if (priorityFilter) activeFilters.push({ key: 'priority', label: 'Priority', value: priorityFilter });

  const handleRemoveFilter = (key) => {
    if (key === 'wardId')   setWardFilter('');
    if (key === 'priority') setPriorityFilter('');
  };

  const handleClearAll = () => {
    setWardFilter('');
    setPriorityFilter('');
  };

  const columns = [
    {
      key: 'title',
      header: 'Task',
      render: (t) => (
        <span className="font-semibold text-nw-text max-w-[220px] block truncate" title={t.title}>
          {t.title}
        </span>
      ),
    },
    {
      key: 'wardId',
      header: 'Ward',
      render: (t) => <span className="text-sm text-nw-text-2">{t.wardId || '—'}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t) => (
        <StatusBadge
          label={(t.priority || 'medium').charAt(0).toUpperCase() + (t.priority || 'medium').slice(1)}
          variant={PRIORITY_VARIANT[t.priority] || 'neutral'}
          size="xs"
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <StatusBadge
          label={STATUS_LABEL[t.status] || t.status}
          variant={STATUS_VARIANT[t.status] || 'neutral'}
          size="xs"
        />
      ),
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (t) => (
        <span className="text-sm text-nw-text-muted truncate max-w-[120px] block" title={t.assignedTo || ''}>
          {t.assignedTo || <span className="italic text-nw-text-faint">Unassigned</span>}
        </span>
      ),
    },
    {
      key: 'dueAt',
      header: 'Due',
      render: (t) => (
        <span className="text-xs text-nw-text-muted">{t.dueAt ? formatDate(t.dueAt) : '—'}</span>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Field Work"
        description="Investigation and field response tasks"
        actions={
          <div className="flex gap-2">
            <button className="nw-btn nw-btn-secondary" onClick={refetch} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
            {canManage && (
              <button className="nw-btn nw-btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Create Task
              </button>
            )}
          </div>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 mb-4" role="tablist" aria-label="Filter by status">
        {STATUSES.map(s => (
          <button
            key={s.value}
            role="tab"
            aria-selected={statusFilter === s.value}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors border ${
              statusFilter === s.value
                ? 'bg-nw-navy text-white border-nw-navy'
                : 'bg-nw-surface text-nw-text-2 border-nw-border hover:bg-nw-surface-2'
            }`}
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterBar filters={activeFilters} onRemoveFilter={handleRemoveFilter} onClearAll={handleClearAll}>
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Ward</label>
          <select
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={wardFilter}
            onChange={e => setWardFilter(e.target.value)}
          >
            <option value="">All wards</option>
            {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.name || w.wardId}</option>)}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Priority</label>
          <select
            className="nw-input text-sm py-1.5 min-w-[140px]"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
          >
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </FilterBar>

      {loading && <LoadingState message="Loading field tasks…" />}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && (
        <DataTable
          columns={columns}
          data={tasks}
          onRowClick={(t) => setSelectedTask(t)}
          emptyState={
            <EmptyState
              title="No field tasks"
              message="No field tasks match the current filters."
              icon={<ClipboardList size={32} />}
              action={
                canManage && (
                  <button className="nw-btn nw-btn-primary mt-2" onClick={() => setShowCreate(true)}>
                    <Plus size={14} /> Create Task
                  </button>
                )
              }
            />
          }
        />
      )}

      {selectedTask && (
        <FieldTaskDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={handleTaskUpdated}
          canManage={canManage}
        />
      )}

      <CreateFieldTaskModal
        open={showCreate}
        prefill={{}}
        onClose={() => setShowCreate(false)}
        onCreated={handleTaskCreated}
      />
    </div>
  );
}
