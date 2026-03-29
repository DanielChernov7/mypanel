import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './components/DashboardLayout';
import { ServersPage } from './pages/ServersPage';
import { ServerDetailPage } from './pages/ServerDetailPage';
import { DomainsPage } from './pages/DomainsPage';
import { OffersPage } from './pages/OffersPage';
import { DeployDomainsPage } from './pages/DeployDomainsPage';
import { JobsPage } from './pages/JobsPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ClaimDomainsPage } from './pages/ClaimDomainsPage';
import { PoolManagementPage } from './pages/PoolManagementPage';
import { FinancialManagementPage } from './pages/FinancialManagementPage';
import { WhiteGenerationPage } from './pages/WhiteGenerationPage';
import { useAuth } from './hooks/useAuth';
import { initializeAuthHandler } from './lib/auth-setup';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuth((state) => state.isAuthenticated);

  // Check if token exists in localStorage
  const hasToken = !!localStorage.getItem('token');

  // If not authenticated or no token, redirect to login
  if (!isAuthenticated || !hasToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const isAdmin = useAuth((state) => state.isAdmin);

  // Check if token exists in localStorage
  const hasToken = !!localStorage.getItem('token');

  // If not authenticated or no token, redirect to login
  if (!isAuthenticated || !hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">{t('access.denied')}</h2>
          <p className="text-gray-400">{t('access.noPermission')}</p>
          <p className="text-gray-500 mt-4">{t('access.adminRequired')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function OperatorRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const user = useAuth((state) => state.user);

  // Check if token exists in localStorage
  const hasToken = !!localStorage.getItem('token');

  // If not authenticated or no token, redirect to login
  if (!isAuthenticated || !hasToken) {
    return <Navigate to="/login" replace />;
  }

  // Only OPERATOR role can access
  if (user?.role !== 'OPERATOR') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">{t('access.denied')}</h2>
          <p className="text-gray-400">{t('access.operatorOnly')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  // Initialize auth error handler on app mount
  useEffect(() => {
    initializeAuthHandler();
  }, []);

  return (
    <div className="dark min-h-screen">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          {/* Default redirect: ADMIN → servers, OPERATOR → domains */}
          <Route index element={<Navigate to="/domains" />} />

          {/* Servers - ADMIN only */}
          <Route
            path="servers"
            element={
              <AdminRoute>
                <ServersPage />
              </AdminRoute>
            }
          />
          <Route
            path="servers/:serverId"
            element={
              <AdminRoute>
                <ServerDetailPage />
              </AdminRoute>
            }
          />

          {/* Domains - Available to all authenticated users */}
          <Route path="domains" element={<DomainsPage />} />
          <Route path="offers" element={<OffersPage />} />
          <Route path="deploy-domains" element={<DeployDomainsPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route
            path="profile"
            element={
              <OperatorRoute>
                <ProfilePage />
              </OperatorRoute>
            }
          />
          <Route
            path="claim-domains"
            element={
              <OperatorRoute>
                <ClaimDomainsPage />
              </OperatorRoute>
            }
          />
          <Route
            path="audit"
            element={
              <AdminRoute>
                <AuditPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="pool-management"
            element={
              <AdminRoute>
                <PoolManagementPage />
              </AdminRoute>
            }
          />
          <Route
            path="financial"
            element={
              <AdminRoute>
                <FinancialManagementPage />
              </AdminRoute>
            }
          />
          <Route
            path="white-generation"
            element={
              <AdminRoute>
                <WhiteGenerationPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
