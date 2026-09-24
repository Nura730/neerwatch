import React, { useState, useCallback, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createFieldTask } from '../../services/api.js';
import { useApiData } from '../../hooks/useApiData.js';
import { getWards } from '../../services/api.js';

const PRIORITIES = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/**
 * Modal for creating a new field task.
 * prefill: { wardId?, description?, sourceObservationId?, title? }
 */
export function CreateFieldTaskModal({ open, onClose, onCreated, prefill = {} }) {
  // Track the last seen prefill so we can reset when a new prefill arrives with a new open
  const [lastPrefillKey, setLastPrefillKey] = useState('');
  const prefillKey = `${prefill.title || ''}|${prefill.wardId || ''}|${prefill.sourceObservationId || ''}`;

  const defaultForm = useCallback(() => ({
    title:               prefill.title               || '',
    wardId:              prefill.wardId              || '',
    description:         prefill.description         || '',
    priority:            'medium',
    dueAt:               '',
    assignedTo:          '',
    lat:                 '',
    lng:                 '',
    sourceObservationId: prefill.sourceObservationId || '',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm]         = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const { data: wardsData } = useApiData(getWards, []);
  const wards = wardsData?.wards || [];

  // Reset form when the modal is newly opened with a different prefill
  if (open && prefillKey !== lastPrefillKey) {
    setLastPrefillKey(prefillKey);
    setForm({
      title:               prefill.title               || '',
      wardId:              prefill.wardId              || '',
      description:         prefill.description         || '',
      priority:            'medium',
      dueAt:               '',
      assignedTo:          '',
      lat:                 '',
      lng:                 '',
      sourceObservationId: prefill.sourceObservationId || '',
    });
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const body = {
      title:   form.title.trim(),
      wardId:  form.wardId.trim(),
    };
    if (form.description.trim())         body.description         = form.description.trim();
    if (form.priority)                   body.priority            = form.priority;
    if (form.dueAt)                      body.dueAt               = form.dueAt;
    if (form.assignedTo.trim())          body.assignedTo          = form.assignedTo.trim();
    if (form.sourceObservationId.trim()) body.sourceObservationId = form.sourceObservationId.trim();
    if (form.lat && form.lng) {
      const lat = parseFloat(form.lat);
      const lng = parseFloat(form.lng);
      if (!isNaN(lat) && !isNaN(lng)) body.location = { lat, lng };
    }

    try {
      setSubmitting(true);
      const data = await createFieldTask(body);
      onCreated(data.task);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create field task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-nw-surface border border-nw-border rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-nw-border bg-nw-surface-2">
            <h2 id="create-task-title" className="text-base font-bold text-nw-text">Create Field Task</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-nw-text-muted hover:text-nw-text hover:bg-nw-surface-3 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-nw-fail-bg border border-nw-fail/20 text-nw-fail text-sm rounded px-3 py-2">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="nw-label-text" htmlFor="ft-title">
                Title <span className="text-nw-fail">*</span>
              </label>
              <input
                id="ft-title"
                type="text"
                className="nw-input"
                value={form.title}
                onChange={set('title')}
                required
                placeholder="e.g. Inspect Ward 03 borewell source"
                maxLength={200}
              />
            </div>

            {/* Ward */}
            <div>
              <label className="nw-label-text" htmlFor="ft-ward">
                Ward <span className="text-nw-fail">*</span>
              </label>
              {wards.length > 0 ? (
                <select
                  id="ft-ward"
                  className="nw-input nw-select"
                  value={form.wardId}
                  onChange={set('wardId')}
                  required
                >
                  <option value="">Select ward</option>
                  {wards.map(w => (
                    <option key={w.wardId} value={w.wardId}>{w.name || w.wardId}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="ft-ward"
                  type="text"
                  className="nw-input"
                  value={form.wardId}
                  onChange={set('wardId')}
                  required
                  placeholder="e.g. ward-01"
                />
              )}
            </div>

            {/* Description */}
            <div>
              <label className="nw-label-text" htmlFor="ft-desc">Description</label>
              <textarea
                id="ft-desc"
                className="nw-input min-h-[72px] resize-y"
                value={form.description}
                onChange={set('description')}
                placeholder="Optional details about the investigation"
                maxLength={1000}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="nw-label-text" htmlFor="ft-priority">Priority</label>
              <select id="ft-priority" className="nw-input nw-select" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="nw-label-text" htmlFor="ft-due">Due Date (optional)</label>
              <input
                id="ft-due"
                type="date"
                className="nw-input"
                value={form.dueAt}
                onChange={set('dueAt')}
              />
            </div>

            {/* Assign to */}
            <div>
              <label className="nw-label-text" htmlFor="ft-assigned">Assign To (optional)</label>
              <input
                id="ft-assigned"
                type="text"
                className="nw-input"
                value={form.assignedTo}
                onChange={set('assignedTo')}
                placeholder="Operator name or email"
              />
            </div>

            {/* Location */}
            <div>
              <span className="nw-label-text block mb-1">Location (optional)</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nw-text-muted mb-0.5 block" htmlFor="ft-lat">Latitude</label>
                  <input
                    id="ft-lat"
                    type="number"
                    step="any"
                    className="nw-input font-mono text-sm"
                    value={form.lat}
                    onChange={set('lat')}
                    placeholder="8.5241"
                  />
                </div>
                <div>
                  <label className="text-xs text-nw-text-muted mb-0.5 block" htmlFor="ft-lng">Longitude</label>
                  <input
                    id="ft-lng"
                    type="number"
                    step="any"
                    className="nw-input font-mono text-sm"
                    value={form.lng}
                    onChange={set('lng')}
                    placeholder="76.9366"
                  />
                </div>
              </div>
            </div>

            {/* Source observation (hidden if blank, pre-filled from context) */}
            {form.sourceObservationId && (
              <div className="bg-nw-surface-2 border border-nw-border rounded px-3 py-2 text-xs text-nw-text-muted">
                Linked to observation: <span className="font-mono text-nw-text">{form.sourceObservationId}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="nw-btn nw-btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="nw-btn nw-btn-primary"
                disabled={submitting}
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
