import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Globe, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PoolStats {
  totalAvailable: number;
  com: { available: number; price: number };
  org: { available: number; price: number };
  other: { available: number; price: number };
}

interface MyStats {
  domainLimit: number;
  totalClaimed: number;
  remainingLimit: number;
  totalCost: number;
}

interface ClaimedDomain {
  id: string;
  name: string;
  serverId: string;
  serverName: string;
}

export function ClaimDomainsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [comClaimCount, setComClaimCount] = useState<number>(1);
  const [orgClaimCount, setOrgClaimCount] = useState<number>(1);
  const [otherClaimCount, setOtherClaimCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimingCom, setIsClaimingCom] = useState(false);
  const [isClaimingOrg, setIsClaimingOrg] = useState(false);
  const [isClaimingOther, setIsClaimingOther] = useState(false);

  // Claimed domains dialog
  const [claimedDomains, setClaimedDomains] = useState<ClaimedDomain[]>([]);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [poolData, statsData] = await Promise.all([
        api.getDomainPoolStats(),
        api.getMyClaimStats(),
      ]);

      setPoolStats(poolData);
      setMyStats(statsData);
    } catch (error: any) {
      toast.error(t('claimDomains.failedLoad', { error: error.message || 'Unknown error' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaimCom = async () => {
    if (!myStats || comClaimCount <= 0) return;

    try {
      setIsClaimingCom(true);
      const result = await api.claimDomains(comClaimCount, 'com');
      setClaimedDomains(result.domains);
      setClaimDialogOpen(true);
      await fetchData();
      setComClaimCount(1);
    } catch (error: any) {
      toast.error(error.message || t('common.failed'));
    } finally {
      setIsClaimingCom(false);
    }
  };

  const handleClaimOrg = async () => {
    if (!myStats || orgClaimCount <= 0) return;

    try {
      setIsClaimingOrg(true);
      const result = await api.claimDomains(orgClaimCount, 'org');
      setClaimedDomains(result.domains);
      setClaimDialogOpen(true);
      await fetchData();
      setOrgClaimCount(1);
    } catch (error: any) {
      toast.error(error.message || t('common.failed'));
    } finally {
      setIsClaimingOrg(false);
    }
  };

  const handleClaimOther = async () => {
    if (!myStats || otherClaimCount <= 0) return;

    try {
      setIsClaimingOther(true);
      const result = await api.claimDomains(otherClaimCount, 'other');
      setClaimedDomains(result.domains);
      setClaimDialogOpen(true);
      await fetchData();
      setOtherClaimCount(1);
    } catch (error: any) {
      toast.error(error.message || t('common.failed'));
    } finally {
      setIsClaimingOther(false);
    }
  };

  const handleCopyDomains = async () => {
    const text = claimedDomains.map(d => d.name).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('claimDomains.failedCopy'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const maxClaimableCom = poolStats?.com.available || 0;
  const maxClaimableOrg = poolStats?.org.available || 0;
  const maxClaimableOther = poolStats?.other.available || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('claimDomains.title')}</h1>
        <div className="text-sm text-gray-400">
          {t('claimDomains.claimedUnlimited', { claimed: myStats?.totalClaimed || 0 })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* .COM Domains */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                .COM
              </span>
              <span className="text-2xl font-bold">{poolStats?.com.available || 0}</span>
            </CardTitle>
            {isAdmin && (
              <div className="text-sm text-gray-400">
                {t('claimDomains.perDomain', { price: poolStats?.com.price?.toFixed(2) || '0.00' })}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {maxClaimableCom > 0 ? (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={maxClaimableCom}
                  value={comClaimCount}
                  onChange={(e) => setComClaimCount(Math.max(1, Math.min(maxClaimableCom, parseInt(e.target.value) || 1)))}
                  className="w-20"
                />
                <Button onClick={handleClaimCom} disabled={isClaimingCom} className="flex-1">
                  {isClaimingCom ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isAdmin ? (
                    t('claimDomains.claimWithPrice', { count: comClaimCount, price: ((poolStats?.com.price || 0) * comClaimCount).toFixed(2) })
                  ) : (
                    t('claimDomains.claim', { count: comClaimCount })
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('claimDomains.noCom')}</p>
            )}
          </CardContent>
        </Card>

        {/* .ORG Domains */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-500" />
                .ORG
              </span>
              <span className="text-2xl font-bold">{poolStats?.org.available || 0}</span>
            </CardTitle>
            {isAdmin && (
              <div className="text-sm text-gray-400">
                {t('claimDomains.perDomain', { price: poolStats?.org.price?.toFixed(2) || '0.00' })}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {maxClaimableOrg > 0 ? (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={maxClaimableOrg}
                  value={orgClaimCount}
                  onChange={(e) => setOrgClaimCount(Math.max(1, Math.min(maxClaimableOrg, parseInt(e.target.value) || 1)))}
                  className="w-20"
                />
                <Button onClick={handleClaimOrg} disabled={isClaimingOrg} variant="secondary" className="flex-1">
                  {isClaimingOrg ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isAdmin ? (
                    t('claimDomains.claimWithPrice', { count: orgClaimCount, price: ((poolStats?.org.price || 0) * orgClaimCount).toFixed(2) })
                  ) : (
                    t('claimDomains.claim', { count: orgClaimCount })
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('claimDomains.noOrg')}</p>
            )}
          </CardContent>
        </Card>

        {/* Other Domains */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-500" />
                Other
              </span>
              <span className="text-2xl font-bold">{poolStats?.other.available || 0}</span>
            </CardTitle>
            {isAdmin && (
              <div className="text-sm text-gray-400">
                {t('claimDomains.perDomain', { price: poolStats?.other.price?.toFixed(2) || '0.00' })}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {maxClaimableOther > 0 ? (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={maxClaimableOther}
                  value={otherClaimCount}
                  onChange={(e) => setOtherClaimCount(Math.max(1, Math.min(maxClaimableOther, parseInt(e.target.value) || 1)))}
                  className="w-20"
                />
                <Button onClick={handleClaimOther} disabled={isClaimingOther} variant="secondary" className="flex-1">
                  {isClaimingOther ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isAdmin ? (
                    t('claimDomains.claimWithPrice', { count: otherClaimCount, price: ((poolStats?.other.price || 0) * otherClaimCount).toFixed(2) })
                  ) : (
                    t('claimDomains.claim', { count: otherClaimCount })
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('claimDomains.noOther')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claimed Domains Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('claimDomains.claimedTitle', { count: claimedDomains.length })}</DialogTitle>
            <DialogDescription>
              {t('claimDomains.claimedDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-gray-400">#</th>
                  <th className="text-left p-2 font-medium text-gray-400">{t('claimDomains.domainHeader')}</th>
                  <th className="text-left p-2 font-medium text-gray-400">{t('claimDomains.serverHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {claimedDomains.map((domain, idx) => (
                  <tr key={domain.id} className="border-t border-gray-800">
                    <td className="p-2 text-gray-500">{idx + 1}</td>
                    <td className="p-2 font-medium text-white">{domain.name}</td>
                    <td className="p-2 text-gray-400">{domain.serverName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleCopyDomains}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  {t('common.copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  {t('common.copyAll')}
                </>
              )}
            </Button>
            <Button size="sm" onClick={() => setClaimDialogOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
