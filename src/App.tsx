import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './contexts/LanguageContext';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import LoadingScreen from './components/LoadingScreen';

// Simple hash-based router
const useHashRouter = () => {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1) || '/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  return { route, navigate };
};

const AppRouter: React.FC = () => {
  const { state } = useAuth();
  const { route } = useHashRouter();

  // Show loading screen while initializing
  if (state.loading) {
    return <LoadingScreen />;
  }

  // Route based on authentication and setup status
  const getActiveComponent = () => {
    // If not set up, show setup page
    if (!state.isSetup) {
      return <SetupPage />;
    }

    // If set up but not authenticated, show login page
    if (!state.isAuthenticated) {
      if (route === '/recovery') {
        // Add recovery page later
        return <LoginPage />;
      }
      return <LoginPage />;
    }

    // If authenticated, show appropriate page based on route
    switch (route) {
      case '/dashboard':
      case '/':
        return <DashboardPage />;
      case '/add-password':
        return <DashboardPage />; // Will handle this in dashboard
      case '/settings':
        return <DashboardPage />; // Will handle this in dashboard
      case '/export':
        return <DashboardPage />; // Will handle this in dashboard
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {getActiveComponent()}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App; 