import React, { useState } from 'react';
import { authService } from '../auth/authService.js';
import { ROLES } from '../auth/permissions.js';
import { UserPlus, CheckCircle, AlertCircle } from 'lucide-react';

export function UsersPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLES.VIEWER);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !role) {
      setError('All fields are required.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setIsSubmitting(true);
      await authService.registerUser(email, password, role);
      setSuccess(`User ${email} created successfully with role ${role}.`);
      setEmail('');
      setPassword('');
      setRole(ROLES.VIEWER);
    } catch (err) {
      setError(err.message || 'Failed to create user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header mb-6">
        <h1 className="flex items-center gap-2">
          <UserPlus className="text-nw-navy" size={20} />
          User Management
        </h1>
        <p>Register new users and assign roles.</p>
      </div>

      <div className="bg-nw-surface border border-nw-border rounded-lg shadow-nw-sm p-6">
        <h2 className="text-sm font-bold text-nw-text mb-4 uppercase tracking-wide">Create New User</h2>

        {error && (
          <div className="mb-4 p-3 bg-nw-fail-bg border border-[#FECACA] rounded text-nw-fail text-sm flex gap-2 items-start">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-nw-pass-bg border border-[#A7F3D0] rounded text-nw-pass text-sm flex gap-2 items-start">
            <CheckCircle size={16} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="nw-label-text" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="nw-input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            
            <div>
              <label className="nw-label-text" htmlFor="password">Temporary Password</label>
              <input
                id="password"
                type="password"
                className="nw-input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div>
            <label className="nw-label-text" htmlFor="role">System Role</label>
            <select
              id="role"
              className="nw-input nw-select w-full max-w-xs"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSubmitting}
              required
            >
              <option value={ROLES.VIEWER}>Viewer (Read-only)</option>
              <option value={ROLES.OPERATOR}>Operator (Can create & sync tests)</option>
              <option value={ROLES.ADMIN}>Administrator (Full access)</option>
            </select>
          </div>

          <div className="pt-2 border-t border-nw-border-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="nw-btn nw-btn-primary"
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
