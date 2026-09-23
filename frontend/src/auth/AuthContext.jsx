import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from './authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function initAuth() {
      try {
        const currentUser = await authService.getCurrentUser();
        if (mounted && currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Session restoration failed:', err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Listen for global unauthorized events to trigger logout
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('nw:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nw:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    const user = await authService.login(email, password);
    setUser(user);
  };

  const logout = () => {
    authService.clearToken();
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
