import React from 'react';
import { useAuth } from './AuthContext.jsx';
import { ShieldAlert } from 'lucide-react';

export function RoleGuard({ isAllowed, children, fallback }) {
  const { user } = useAuth();

  if (!user || !isAllowed(user.role)) {
    if (fallback !== undefined) return fallback;

    return (
      <div className="flex flex-col items-center justify-center p-12 bg-nw-surface border border-nw-border rounded shadow-nw-sm text-center">
        <ShieldAlert size={48} className="text-nw-fail mb-4" />
        <h2 className="text-lg font-bold text-nw-text mb-2">Access Denied</h2>
        <p className="text-nw-text-muted text-sm max-w-md">
          You don't have permission to perform this action or view this content. 
          If you believe this is an error, contact your administrator.
        </p>
      </div>
    );
  }

  return children;
}
