import { User as UserIcon, BarChart3, RefreshCw, Settings, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { User } from '@server-panel/types';

const DOMAINS_PER_PAGE_OPTIONS = [20, 50, 100] as const;

export function ProfilePage() {
  const { t } = useTranslation();
  const { user: authUser, setUser } = useAuth();
  const [user, setUserData] = useState<User | null>(authUser);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [totalCost, setTotalCost] = useState<number | null>(null);

  // Load fresh profile data on mount
  useEffect(() => {
    loadProfile();
    loadCostStats();
  }, []);

  const loadProfile = async () => {
    try {
      const profileData = await api.getProfile();
      setUserData(profileData);
      setUser(profileData); // Update auth state
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadCostStats = async () => {
    try {
      const stats = await api.getMyClaimStats();
      setTotalCost(stats.totalCost);
    } catch {
      // Non-critical - silently ignore (operators without pool access)
    }
  };

  const handleRefreshStats = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const stats = await api.refreshDomainStats();
      setRefreshMessage(stats.message);
      // Reload profile and cost stats
      await Promise.all([loadProfile(), loadCostStats()]);
    } catch (error: any) {
      setRefreshMessage(error.message || t('common.failed'));
    } finally {
      setIsRefreshing(false);
      // Clear message after 5 seconds
      setTimeout(() => setRefreshMessage(null), 5000);
    }
  };

  const handleDomainsPerPageChange = async (value: number) => {
    if (!user || user.domainsPerPage === value) return;

    setIsSavingPreferences(true);
    try {
      await api.updatePreferences({ domainsPerPage: value });
      const updatedUser = { ...user, domainsPerPage: value };
      setUserData(updatedUser);
      setUser(updatedUser);
      toast.success(t('profile.domainsPerPageSet', { value }));
    } catch (error: any) {
      toast.error(error.message || t('common.failed'));
    } finally {
      setIsSavingPreferences(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">{t('profile.loadingProfile')}</div>
      </div>
    );
  }

  const hasStats = user.buyerTag && user.totalDomains !== undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <UserIcon className="h-8 w-8" />
            {t('profile.title')}
          </h1>
          <p className="text-gray-400 mt-1">{t('profile.description')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.accountDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              {t('profile.usernameBuyerNickname')}
            </label>
            <div className="px-4 py-3 rounded-md bg-muted/50 border border-border">
              <p className="text-foreground font-mono">{user.username}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('profile.usernameDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              {t('profile.buyerTag')}
            </label>
            <div className="px-4 py-3 rounded-md bg-muted/50 border border-border">
              <p className="text-foreground font-mono">
                {user.buyerTag || <span className="text-muted-foreground italic">{t('common.notSet')}</span>}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('profile.buyerTagDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              {t('profile.role')}
            </label>
            <div className="px-4 py-3 rounded-md bg-muted/50 border border-border">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                user.role === 'ADMIN'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {user.role}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Statistics Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('profile.domainStats')}
          </CardTitle>
          <Button
            onClick={handleRefreshStats}
            disabled={isRefreshing || !user.buyerTag}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? t('common.updating') : t('common.refresh')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user.buyerTag ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('profile.noBuyerTag')}</p>
              <p className="text-xs mt-1">{t('profile.contactAdmin')}</p>
            </div>
          ) : !hasStats ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('profile.noStats')}</p>
              <p className="text-xs mt-1">{t('profile.clickRefresh')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-sm font-medium text-muted-foreground">{t('profile.totalDomains')}</div>
                  <div className="text-3xl font-bold text-foreground">{user.totalDomains || 0}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('profile.withBuyerTag', { tag: user.buyerTag })}
                  </div>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="text-sm font-medium text-green-400">{t('common.active')}</div>
                  <div className="text-3xl font-bold text-green-400">{user.activeDomains || 0}</div>
                  <div className="text-xs text-green-400/70">
                    {t('profile.ofTotal', { percent: user.totalDomains ? Math.round(((user.activeDomains || 0) / user.totalDomains) * 100) : 0 })}
                  </div>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-sm font-medium text-yellow-400">{t('common.inactive')}</div>
                  <div className="text-3xl font-bold text-yellow-400">{user.inactiveDomains || 0}</div>
                  <div className="text-xs text-yellow-400/70">
                    {t('profile.ofTotal', { percent: user.totalDomains ? Math.round(((user.inactiveDomains || 0) / user.totalDomains) * 100) : 0 })}
                  </div>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-sm font-medium text-red-400">{t('common.banned')}</div>
                  <div className="text-3xl font-bold text-red-400">{user.bannedDomains || 0}</div>
                  <div className="text-xs text-red-400/70">
                    {t('profile.ofTotal', { percent: user.totalDomains ? Math.round(((user.bannedDomains || 0) / user.totalDomains) * 100) : 0 })}
                  </div>
                </div>
              </div>

              {/* Total Cost Section */}
              {totalCost !== null && totalCost > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-400">{t('profile.totalCost')}</div>
                      <div className="text-xs text-blue-400/70 mt-1">
                        {t('profile.totalDomains')}: {user.totalDomains || 0}
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-blue-400">
                      ${totalCost.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {user.lastStatsUpdate && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
              {t('profile.lastUpdated', { date: new Date(user.lastStatsUpdate).toLocaleString() })}
            </div>
          )}

          {refreshMessage && (
            <div className={`text-sm text-center py-2 px-4 rounded-md ${
              refreshMessage.includes('success') || refreshMessage.includes('updated')
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
              {refreshMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('profile.preferences')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              {t('profile.domainsPerPage')}
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              {t('profile.domainsPerPageDesc')}
            </p>
            <div className="flex gap-2">
              {DOMAINS_PER_PAGE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={user.domainsPerPage === option ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDomainsPerPageChange(option)}
                  disabled={isSavingPreferences}
                  className="min-w-[60px] gap-1"
                >
                  {user.domainsPerPage === option && <Check className="h-3 w-3" />}
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
