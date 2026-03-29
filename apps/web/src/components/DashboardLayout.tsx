import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Server,
  FileText,
  LogOut,
  Globe2,
  FolderOpen,
  Rocket,
  Activity,
  Users,
  User as UserIcon,
  Package,
  DollarSign,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MaintenanceScreen } from './MaintenanceScreen';
import { NotificationBell } from './NotificationBell';
import { useTranslation } from 'react-i18next';

export function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const logout = useAuth((state) => state.logout);
  const isAdmin = useAuth((state) => state.isAdmin);
  const user = useAuth((state) => state.user);

  // Check maintenance mode status (public endpoint)
  const { data: maintenanceStatus, refetch: refetchMaintenanceStatus } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: () => api.getMaintenanceStatus(),
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch on mount
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache old data
  });

  // Check if maintenance mode is enabled and user is operator
  const maintenanceMode = maintenanceStatus?.maintenanceMode || false;
  const isOperator = user?.role === 'OPERATOR';

  // Show maintenance screen for operators when maintenance mode is enabled
  if (maintenanceMode && isOperator) {
    return <MaintenanceScreen onRefresh={() => refetchMaintenanceStatus()} />;
  }

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">{t('nav.serverPanel')}</h1>
          <NotificationBell />
        </div>

        <nav className="space-y-1 px-3">
          {/* Servers - ADMIN only */}
          {isAdmin() && (
            <Link
              to="/servers"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/servers')
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-accent hover:text-white'
              }`}
            >
              <Server className="h-4 w-4" />
              {t('nav.servers')}
            </Link>
          )}

          {/* Domains - Available to all authenticated users */}
          <Link
            to="/domains"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/domains')
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:bg-accent hover:text-white'
            }`}
          >
            <Globe2 className="h-4 w-4" />
            {t('nav.domains')}
          </Link>

          <Link
            to="/offers"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/offers')
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:bg-accent hover:text-white'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            {t('nav.offers')}
          </Link>

          <Link
            to="/deploy-domains"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/deploy-domains')
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:bg-accent hover:text-white'
            }`}
          >
            <Rocket className="h-4 w-4" />
            {t('nav.deployDomains')}
          </Link>

          <Link
            to="/jobs"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/jobs')
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:bg-accent hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            {t('nav.jobs')}
          </Link>

          {/* Profile - Only for OPERATOR */}
          {user?.role === 'OPERATOR' && (
            <Link
              to="/profile"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/profile')
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-accent hover:text-white'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              {t('nav.profile')}
            </Link>
          )}

          {/* Claim Domains - Available to all users */}
          <Link
            to="/claim-domains"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/claim-domains')
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:bg-accent hover:text-white'
            }`}
          >
            <Package className="h-4 w-4" />
            {t('nav.claimDomains')}
          </Link>

          {isAdmin() && (
            <Link
              to="/audit"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/audit')
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-accent hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4" />
              {t('nav.auditLogs')}
            </Link>
          )}

          {isAdmin() && (
            <Link
              to="/pool-management"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/pool-management')
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-accent hover:text-white'
              }`}
            >
              <Package className="h-4 w-4" />
              {t('nav.poolManagement')}
            </Link>
          )}

          {isAdmin() && (
            <Link
              to="/financial"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/financial')
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-accent hover:text-white'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              {t('nav.financial')}
            </Link>
          )}

          {isAdmin() && (
            <Link
              to="/white-generation"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/white-generation')
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-accent hover:text-white'
              }`}
            >
              <Wand2 className="h-4 w-4" />
              White Generation
            </Link>
          )}

          {isAdmin() && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/admin')
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-accent hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              {t('nav.admin')}
            </Link>
          )}
        </nav>

        <div className="absolute bottom-0 w-64 border-t p-4 space-y-2">
          <div className="flex justify-center gap-1">
            <button
              onClick={() => i18n.changeLanguage('en')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                i18n.language === 'en'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-accent'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => i18n.changeLanguage('ru')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                i18n.language === 'ru'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-accent'
              }`}
            >
              RU
            </button>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
