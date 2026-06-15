import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const cleanAuthHash = () => {
    if (typeof window === 'undefined' || !window.location.hash) return;

    const hash = window.location.hash.slice(1);
    const isSupabaseAuthHash = !hash || hash.includes('access_token=') || hash.includes('refresh_token=') || hash.includes('error=');
    if (!isSupabaseAuthHash) return;

    window.history.replaceState(
      window.history.state,
      document.title,
      `${window.location.pathname}${window.location.search}`
    );
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const currentUser = await base44.auth.me();
      cleanAuthHash();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);

      if (error?.status === 401 || error?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setAuthError({ type: 'unknown', message: error?.message || 'Authentication check failed' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setIsLoadingPublicSettings(false);
    }
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    try {
      await base44.auth.logout(shouldRedirect ? window.location.href : undefined);
    } catch (error) {
      console.error('Logout failed:', error);
      if (shouldRedirect) {
        window.location.href = '/login';
      }
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
