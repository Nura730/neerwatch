import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Droplet, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      setError('');
      setIsSubmitting(true);
      await login(email, password);
      // navigation handled by useEffect
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-nw-bg px-4">
      <div className="w-full max-w-md bg-nw-surface rounded-lg shadow-nw-md border border-nw-border overflow-hidden">
        <div className="bg-nw-navy p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Droplet className="text-nw-teal-light" size={28} />
            <span className="text-xl font-bold text-white tracking-wide">
              NEERWATCH
            </span>
          </div>
          <p className="text-nw-teal-light text-sm font-medium">
            Water Observation & Early Warning
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <h2 className="text-lg font-bold text-nw-text mb-6">Sign In</h2>

          {error && (
            <div className="mb-6 p-3 bg-nw-fail-bg border border-[#FECACA] rounded text-nw-fail text-sm flex gap-2 items-start">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-5 mb-8">
            <div>
              <label className="nw-label-text" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="nw-input w-full"
                placeholder="operator@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            
            <div>
              <label className="nw-label-text" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="nw-input w-full"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-nw-navy hover:bg-[#1E6785] text-white font-semibold py-2.5 px-4 rounded transition-colors disabled:opacity-70 flex justify-center"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="p-6 bg-slate-50 border-t border-nw-border">
          <p className="text-xs text-nw-text-muted font-semibold uppercase tracking-wider mb-3 text-center">Demo Accounts</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { setEmail('admin@neerwatch.local'); setPassword('ChangeThisPassword1!'); }}
              className="nw-btn nw-btn-secondary nw-btn-sm justify-center text-[11px]"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => { setEmail('operator@neerwatch.local'); setPassword('ChangeThisPassword2!'); }}
              className="nw-btn nw-btn-secondary nw-btn-sm justify-center text-[11px]"
            >
              Operator
            </button>
            <button
              type="button"
              onClick={() => { setEmail('viewer@neerwatch.local'); setPassword('ChangeThisPassword3!'); }}
              className="nw-btn nw-btn-secondary nw-btn-sm justify-center text-[11px]"
            >
              Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
