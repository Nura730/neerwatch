import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

/** LoadingState */
export function LoadingState({ message = 'Loading data...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-nw-text-muted">
      <Loader2 size={28} className="animate-spin text-nw-text-faint mb-3" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

/** ErrorState */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-nw-fail-bg border border-nw-fail/20 rounded-md m-4">
      <AlertCircle size={32} className="text-nw-fail mb-3" />
      <h3 className="text-base font-bold text-nw-fail mb-1">Unable to load data</h3>
      <p className="text-sm text-nw-fail/80 mb-4 max-w-md">
        {message?.includes('fetch') ? "You're offline. Locally stored observations remain available." : message}
      </p>
      {onRetry && (
        <button 
          className="nw-btn bg-white text-nw-text hover:bg-gray-50 border border-nw-border-2"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** EmptyState */
export function EmptyState({ title = 'No data available', message, action, icon }) {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center bg-nw-surface border border-nw-border border-dashed rounded-md m-4">
      <div className="text-nw-text-faint mb-3">
        {icon || <Inbox size={32} />}
      </div>
      <h3 className="text-base font-semibold text-nw-text mb-1">{title}</h3>
      {message && <p className="text-sm text-nw-text-muted mb-4 max-w-md">{message}</p>}
      {action}
    </div>
  );
}

/** PageHeader */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-4 border-b border-nw-border">
      <div>
        <h1 className="text-xl font-bold text-nw-text m-0 mb-1">{title}</h1>
        {description && <p className="text-sm text-nw-text-muted m-0">{description}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
