import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * FilterBar — Unified filter toolbar
 * 
 * @param {Array} filters - Active filters [{ key, label, value }]
 * @param {Function} onRemoveFilter - (key) => void
 * @param {Function} onClearAll - () => void
 * @param {React.ReactNode} children - Dropdowns or inputs to place in the bar
 */
export function FilterBar({ filters = [], onRemoveFilter, onClearAll, children }) {
  return (
    <div className="bg-nw-surface border border-nw-border rounded-md shadow-nw-sm p-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {children}
      </div>

      {filters.length > 0 && (
        <div className="mt-3 pt-3 border-t border-nw-border-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-nw-text-muted uppercase tracking-wider mr-1">
            Active Filters:
          </span>
          {filters.map((f) => (
            <span 
              key={f.key} 
              className="inline-flex items-center gap-1 bg-nw-surface-3 text-nw-text-2 text-xs font-medium px-2 py-1 rounded border border-nw-border-2"
            >
              {f.label}: {f.value}
              <button 
                onClick={() => onRemoveFilter(f.key)}
                className="hover:text-nw-fail focus:outline-none ml-1"
                aria-label={`Remove ${f.label} filter`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {filters.length > 1 && (
            <button 
              onClick={onClearAll}
              className="text-xs text-nw-navy hover:underline ml-2"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
