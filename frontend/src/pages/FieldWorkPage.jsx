import React, { useState, useCallback } from 'react';
import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  MapPin,
  Calendar,
  User,
  AlertTriangle,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  CircleDot,
  Ban,
  Construction,
} from 'lucide-react';
import { useApiData } from '../hooks/useApiData.js';
import { getFieldTasks, createFieldTask, assignFieldTask, updateFieldTaskStatus } from '../services/api.js';
import { getWards } from '../services/api.js';
import { PageHeader, LoadingState, EmptyState } from '../components/ui/States.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { formatDateTime } from '../utils/format.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { canCreateFieldTask, canAssignFieldTask, canUpdateFieldTaskStatus } from '../auth/permissions.js';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     variant: 'neutral', icon: Clock },
  assigned:    { label: 'Assigned',    variant: 'warn',    icon: User },
  in_progress: { label: 'In Progress', variant: 'warn',    icon: CircleDot },
  completed:   { label: 'Completed',   variant: 'pass',    icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   variant: 'neutral', icon: Ban },
};

const PRIORITY_CONFIG = {
  high:   { label: 'High',   className: 'bg-red-50 text-red-700 border border-red-200' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  low:    { label: 'Low',    className: 'bg-slate-50 text-slate-600 border border-slate-200' },
};

const STATUS_TABS = ['all', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

// ── Components ────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority?.toLowerCase()] || PRIORITY_CONFIG.low;
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${cfg.className}`}>
      {cfg.label || priority}
    </span>
  );
}

function TaskCard({ task, onClick }) {
  const StatusIcon = STATUS_CONFIG[task.status]?.icon || Clock;
  const statusCfg = STATUS_CONFIG[task.status] || { label: task.status, variant: 'neutral' };

  return (
    <button
      onClick={() => onClick(task)}
      className="w-full text-left bg-nw-surface border border-nw-border rounded-lg p-4 hover:border-nw-navy hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {task.priority && <PriorityBadge priority={task.priority} />}
            <StatusBadge label={statusCfg.label} variant={statusCfg.variant} />
          </div>
          <p className="font-semibold text-nw-text text-sm leading-snug truncate">{task.title || `Task ${task.id}`}</p>
          {task.description && (
            <p className="text-xs text-nw-text-muted mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {task.wardId && (
              <span className="flex items-center gap-1 text-xs text-nw-text-muted">
                <MapPin size={11} /> Ward {task.wardId}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1 text-xs text-nw-text-muted">
                <Calendar size={11} /> {formatDateTime(task.dueDate)}
              </span>
            )}
            {task.assignedTo && (
              <span className="flex items-center gap-1 text-xs text-nw-text-muted">
                <User size={11} /> {task.assignedTo}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="text-nw-text-faint group-hover:text-nw-navy mt-1 shrink-0 transition-colors" />
      </div>
    </button>
  );
}

function TaskDetailDrawer({ task, onClose, onStatusUpdated, canAssign, canUpdateStatus }) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const statusCfg = STATUS_CONFIG[task.status] || { label: task.status, variant: 'neutral' };
  const StatusIcon = statusCfg.icon || Clock;

  const nextStatus = {
    pending:     'assigned',
    assigned:    'in_progress',
    in_progress: 'completed',
  }[task.status];

  const nextStatusLabel = {
    assigned:    'Start Investigation',
    in_progress: 'Mark Completed',
  }[nextStatus];

  async function handleStatusUpdate(newStatus) {
    try {
      setUpdating(true);
      setUpdateError('');
      await updateFieldTaskStatus(task.id, { status: newStatus });
      onStatusUpdated();
      onClose();
    } catch (err) {
      setUpdateError(err.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-nw-surface border-l border-nw-border shadow-xl flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-nw-border">
          <div>
            <h2 className="font-bold text-nw-text text-base">{task.title || `Task ${task.id}`}</h2>
            <p className="text-xs text-nw-text-muted mt-0.5">Field Investigation Task</p>
          </div>
          <button onClick={onClose} className="text-nw-text-muted hover:text-nw-text p-1 rounded" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-6">
          {/* Status + Priority */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={statusCfg.label} variant={statusCfg.variant} />
            {task.priority && <PriorityBadge priority={task.priority} />}
          </div>

          {task.description && (
            <div>
              <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-nw-text">{task.description}</p>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {task.wardId && (
              <div>
                <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Ward</p>
                <p className="text-sm text-nw-text font-medium">Ward {task.wardId}</p>
              </div>
            )}
            {task.assignedTo && (
              <div>
                <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Assigned To</p>
                <p className="text-sm text-nw-text font-medium">{task.assignedTo}</p>
              </div>
            )}
            {task.dueDate && (
              <div>
                <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Due Date</p>
                <p className="text-sm text-nw-text font-medium">{formatDateTime(task.dueDate)}</p>
              </div>
            )}
            {task.createdAt && (
              <div>
                <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm text-nw-text font-medium">{formatDateTime(task.createdAt)}</p>
              </div>
            )}
          </div>

          {/* Location */}
          {task.location && (
            <div>
              <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Location</p>
              <p className="text-sm font-mono text-nw-text">
                {task.location.lat?.toFixed(5)}, {task.location.lng?.toFixed(5)}
              </p>
            </div>
          )}

          {/* Related items */}
          {task.alertId && (
            <div>
              <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Related Alert</p>
              <p className="text-sm font-mono text-nw-text-muted">{task.alertId}</p>
            </div>
          )}
          {task.clusterId && (
            <div>
              <p className="text-[11px] font-semibold text-nw-text-muted uppercase tracking-wider mb-1">Related Cluster</p>
              <p className="text-sm font-mono text-nw-text-muted">{task.clusterId}</p>
            </div>
          )}

          {/* Error */}
          {updateError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {updateError}
            </div>
          )}
        </div>

        {/* Actions */}
        {canUpdateStatus && nextStatus && nextStatusLabel && (
          <div className="p-6 border-t border-nw-border">
            <button
              onClick={() => handleStatusUpdate(nextStatus)}
              disabled={updating}
              className="w-full nw-btn nw-btn-primary justify-center disabled:opacity-60"
            >
              {updating ? 'Updating…' : nextStatusLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateTaskForm({ wards, onCreated, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', wardId: '', priority: 'medium', dueDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    try {
      setSubmitting(true);
      setError('');
      const body = { title: form.title.trim() };
      if (form.description) body.description = form.description.trim();
      if (form.wardId)      body.wardId = form.wardId;
      if (form.priority)    body.priority = form.priority;
      if (form.dueDate)     body.dueDate = new Date(form.dueDate).toISOString();
      await createFieldTask(body);
      onCreated();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-nw-surface border border-nw-border rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-nw-border">
          <h2 className="font-bold text-nw-text">Create Field Task</h2>
          <button onClick={onClose} className="text-nw-text-muted hover:text-nw-text p-1 rounded" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="nw-label-text">Title <span className="text-nw-fail">*</span></label>
            <input className="nw-input w-full mt-1" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Investigation task title" required />
          </div>
          <div>
            <label className="nw-label-text">Description</label>
            <textarea className="nw-input w-full mt-1 h-20 resize-none" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief task description…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="nw-label-text">Ward</label>
              <select className="nw-input w-full mt-1" value={form.wardId} onChange={e => set('wardId', e.target.value)}>
                <option value="">— Select ward —</option>
                {wards.map(w => <option key={w.wardId} value={w.wardId}>{w.name || w.wardId}</option>)}
              </select>
            </div>
            <div>
              <label className="nw-label-text">Priority</label>
              <select className="nw-input w-full mt-1" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="nw-label-text">Due Date</label>
            <input type="datetime-local" className="nw-input w-full mt-1" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="nw-btn nw-btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="nw-btn nw-btn-primary flex-1 justify-center disabled:opacity-60">
              {submitting ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FieldWorkPage() {
  const { user } = useAuth();
  const role = user?.role || null;

  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  const fetchTasks = useCallback(() => {
    const params = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    return getFieldTasks(params);
  }, [statusFilter]);

  const { data, loading, error, refetch } = useApiData(fetchTasks, [statusFilter]);
  const { data: wardData } = useApiData(() => getWards(), []);
  const wards = wardData?.wards || [];

  // Detect when the endpoint simply isn't deployed yet
  const is404 = error && (error.includes('404') || error.includes('Cannot GET') || error.includes('Not Found'));

  const tasks = data?.tasks || data?.fieldTasks || [];

  // ── Not yet available state ──────────────────────────────────────────────
  if (is404 || (!loading && error && !tasks.length)) {
    return (
      <div className="max-w-4xl mx-auto pb-10">
        <PageHeader
          title="Field Work"
          description="Investigation and field response tasks"
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
            <Construction size={28} className="text-amber-600" />
          </div>
          <h3 className="font-bold text-nw-text text-lg mb-2">Field Work — Coming Soon</h3>
          <p className="text-nw-text-muted text-sm max-w-md mb-4">
            The field task management backend ({' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">/api/field-tasks</code>
            {' '}) has not been deployed yet. Once the backend is ready, this page will automatically display and manage field investigation tasks.
          </p>
          <div className="bg-slate-50 border border-nw-border rounded-lg p-5 text-left text-sm max-w-md w-full">
            <p className="font-semibold text-nw-text mb-3">Expected workflow when live:</p>
            <ol className="space-y-1.5 text-nw-text-muted list-decimal list-inside">
              <li>Contamination cluster detected</li>
              <li>Alert generated</li>
              <li>Admin creates field investigation task</li>
              <li>Task assigned to operator</li>
              <li>Operator updates status from the field</li>
              <li>Task marked as completed</li>
            </ol>
          </div>
          {error && !is404 && (
            <p className="mt-4 text-xs text-nw-text-faint font-mono bg-slate-50 px-3 py-1.5 rounded border border-nw-border">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader
        title="Field Work"
        description="Investigation and field response tasks"
        actions={
          <div className="flex gap-2">
            <button className="nw-btn nw-btn-secondary" onClick={refetch}>
              <RefreshCw size={14} /> Refresh
            </button>
            {canCreateFieldTask(role) && (
              <button className="nw-btn nw-btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Create Task
              </button>
            )}
          </div>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-nw-border pb-0">
        {STATUS_TABS.map(s => {
          const cfg = STATUS_CONFIG[s];
          const label = s === 'all' ? 'All Tasks' : (cfg?.label || s);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                statusFilter === s
                  ? 'border-nw-navy text-nw-navy'
                  : 'border-transparent text-nw-text-muted hover:text-nw-text'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading && <LoadingState message="Loading field tasks…" />}

      {!loading && !error && tasks.length === 0 && (
        <EmptyState
          title="No field tasks"
          message="No tasks match the current filter."
        />
      )}

      {!loading && tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={setSelectedTask} />
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusUpdated={refetch}
          canAssign={canAssignFieldTask(role)}
          canUpdateStatus={canUpdateFieldTaskStatus(role)}
        />
      )}

      {showCreate && (
        <CreateTaskForm
          wards={wards}
          onCreated={() => { setShowCreate(false); refetch(); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
