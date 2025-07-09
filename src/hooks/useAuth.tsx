import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { AppState, AuthResponse } from '../types';
import { userApi, handleApiCall, secureStorage } from '../utils/api';

interface AuthContextType {
  state: AppState;
  login: (masterPassword: string) => Promise<AuthResponse>;
  logout: () => void;
  checkSetup: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    masterKey: null,
    isSetup: false,
    loading: true,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if app is set up and restore auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if app is set up
        const isSetup = await handleApiCall(() => userApi.isAppSetup());
        
        // Check if user was previously authenticated
        const wasAuthenticated = secureStorage.getAuthState();
        const masterKey = secureStorage.getMasterKey();

        setState(prev => ({
          ...prev,
          isSetup,
          isAuthenticated: wasAuthenticated && !!masterKey,
          masterKey,
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize',
        }));
      }
    };

    initializeAuth();
  }, []);

  const login = async (masterPassword: string): Promise<AuthResponse> => {
    setIsLoading(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      const response = await handleApiCall(() => 
        userApi.login({ master_password: masterPassword })
      );

      if (response.success && response.master_key) {
        // Store authentication state
        secureStorage.setMasterKey(response.master_key);
        secureStorage.setAuthState(true);

        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          masterKey: response.master_key!,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.message,
        }));
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
      return {
        success: false,
        message: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear stored authentication state
    secureStorage.clearAll();

    setState(prev => ({
      ...prev,
      isAuthenticated: false,
      masterKey: null,
      error: null,
    }));
  };

  const checkSetup = async () => {
    try {
      const isSetup = await handleApiCall(() => userApi.isAppSetup());
      setState(prev => ({
        ...prev,
        isSetup,
      }));
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check setup',
      }));
    }
  };

  const value: AuthContextType = {
    state,
    login,
    logout,
    checkSetup,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Custom hook for protected routes
export const useRequireAuth = () => {
  const { state } = useAuth();
  
  useEffect(() => {
    if (!state.loading && !state.isAuthenticated) {
      // Redirect to login or setup page
      window.location.hash = state.isSetup ? '/login' : '/setup';
    }
  }, [state.loading, state.isAuthenticated, state.isSetup]);

  return state;
};

// Custom hook for setup check
export const useRequireSetup = () => {
  const { state } = useAuth();
  
  useEffect(() => {
    if (!state.loading && state.isSetup) {
      // Redirect to login if already set up
      window.location.hash = '/login';
    }
  }, [state.loading, state.isSetup]);

  return state;
}; 