import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Package, Plus, Minus, Search, Server, Loader2, RefreshCw, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type { Domain, Server as ServerType } from '@server-panel/types';

export function PoolManagementPage() {
  const { t } = useTranslation();

  // Pool domains state
  const [poolDomains, setPoolDomains] = useState<Domain[]>([]);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolPage, setPoolPage] = useState(1);

  // Pending approval state
  const [pendingDomains, setPendingDomains] = useState<Domain[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [selectedPendingDomains, setSelectedPendingDomains] = useState<Set<string>>(new Set());
  const [pendingPrices, setPendingPrices] = useState<Record<string, string>>({});
  const [zonePricing, setZonePricing] = useState<Record<string, number>>({ com: 0, org: 0, site: 0, website: 0, life: 0, online: 0, space: 0, other: 0 });

  // Available domains state
  const [availableDomains, setAvailableDomains] = useState<Domain[]>([]);
  const [availableTotal, setAvailableTotal] = useState(0);
  const [availablePage, setAvailablePage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Shared state
  const [servers, setServers] = useState<ServerType[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Selection state
  const [selectedPoolDomains, setSelectedPoolDomains] = useState<Set<string>>(new Set());
  const [selectedAvailableDomains, setSelectedAvailableDomains] = useState<Set<string>>(new Set());

  // Pricing state
  const ZONE_KEYS = ['Com', 'Org', 'Site', 'Website', 'Life', 'Online', 'Space', 'Other'] as const;
  const [pricing, setPricing] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const z of ZONE_KEYS) {
      initial[`domainCost${z}`] = '';
    }
    return initial;
  });
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  const pageSize = 50;

  const fetchServers = useCallback(async () => {
    try {
      const data = await api.getServers();
      setServers(data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  }, []);

  const fetchPoolDomains = useCallback(async () => {
    try {
      const serverId = selectedServerId === 'all' ? undefined : selectedServerId;
      const data = await api.getPoolDomains(poolPage, pageSize, serverId);
      setPoolDomains(data.items);
      setPoolTotal(data.total);
    } catch (error: any) {
      toast.error(t('errors.failed', { action: t('common.loading') }) + ': ' + (error.message || t('errors.UNKNOWN')));
    }
  }, [poolPage, selectedServerId]);

  const fetchPendingDomains = useCallback(async () => {
    try {
      const serverId = selectedServerId === 'all' ? undefined : selectedServerId;
      const data = await api.getPendingPoolDomains(pendingPage, pageSize, serverId);
      setPendingDomains(data.items);
      setPendingTotal(data.total);
      setZonePricing(data.zonePricing);
    } catch (error: any) {
      toast.error(t('errors.failed', { action: t('common.loading') }) + ': ' + (error.message || t('errors.UNKNOWN')));
    }
  }, [pendingPage, selectedServerId]);

  const fetchAvailableDomains = useCallback(async () => {
    try {
      const serverId = selectedServerId === 'all' ? undefined : selectedServerId;
      const data = await api.getAvailableForPool(availablePage, pageSize, serverId, searchQuery || undefined);
      setAvailableDomains(data.items);
      setAvailableTotal(data.total);
    } catch (error: any) {
      toast.error(t('errors.failed', { action: t('common.loading') }) + ': ' + (error.message || t('errors.UNKNOWN')));
    }
  }, [availablePage, selectedServerId, searchQuery]);

  const fetchPricing = useCallback(async () => {
    try {
      const settings = await api.getSettings();
      const newPricing: Record<string, string> = {};
      for (const z of ZONE_KEYS) {
        newPricing[`domainCost${z}`] = settings[`domainCost${z}`] || '0';
      }
      setPricing(newPricing);
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
    }
  }, []);

  const savePricing = async () => {
    setIsSavingPricing(true);
    try {
      const promises: Promise<any>[] = [];
      for (const z of ZONE_KEYS) {
        promises.push(api.updateSetting(`domainCost${z}`, pricing[`domainCost${z}`]));
      }
      await Promise.all(promises);
      toast.success(t('users.settings.settingsSaved'));
    } catch (error: any) {
      toast.error(t('users.settings.settingsFailed') + ': ' + (error.message || t('errors.UNKNOWN')));
    } finally {
      setIsSavingPricing(false);
    }
  };

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchServers(), fetchPoolDomains(), fetchPendingDomains(), fetchAvailableDomains(), fetchPricing()]);
    setIsLoading(false);
  }, [fetchServers, fetchPoolDomains, fetchPendingDomains, fetchAvailableDomains, fetchPricing]);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchPoolDomains();
  }, [fetchPoolDomains]);

  useEffect(() => {
    fetchPendingDomains();
  }, [fetchPendingDomains]);

  useEffect(() => {
    fetchAvailableDomains();
  }, [fetchAvailableDomains]);

  const handleAddToPool = async () => {
    if (selectedAvailableDomains.size === 0) {
      toast.error(t('domains.selectAtLeast'));
      return;
    }

    try {
      setIsProcessing(true);
      const result = await api.addToPool(Array.from(selectedAvailableDomains));
      toast.success(t('pool.addedToPending', { count: result.addedCount }));
      setSelectedAvailableDomains(new Set());
      await Promise.all([fetchPoolDomains(), fetchPendingDomains(), fetchAvailableDomains()]);
    } catch (error: any) {
      toast.error(t('errors.failed', { action: t('pool.addDomains') }) + ': ' + (error.message || t('errors.UNKNOWN')));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFromPool = async () => {
    if (selectedPoolDomains.size === 0) {
      toast.error(t('domains.selectAtLeast'));
      return;
    }

    try {
      setIsProcessing(true);
      const result = await api.removeFromPool(Array.from(selectedPoolDomains));
      toast.success(t('pool.removedFromPool', { count: result.removedCount }));
      setSelectedPoolDomains(new Set());
      await Promise.all([fetchPoolDomains(), fetchAvailableDomains()]);
    } catch (error: any) {
      toast.error(t('errors.failed', { action: t('pool.removeDomains') }) + ': ' + (error.message || t('errors.UNKNOWN')));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveSelected = async () => {
    if (selectedPendingDomains.size === 0) {
      toast.error(t('domains.selectAtLeast'));
      return;
    }

    try {
      setIsProcessing(true);
      const domainIds = Array.from(selectedPendingDomains);

      // Collect prices that were explicitly set
      const prices: Record<string, number> = {};
      for (const id of domainIds) {
        const priceStr = pendingPrices[id];
        if (priceStr !== undefined && priceStr !== '') {
          const price = parseFloat(priceStr);
          if (!isNaN(price) && price >= 0) {
            prices[id] = price;
          }
        }
      }

      const result = await api.approvePoolDomains(domainIds, Object.keys(prices).length > 0 ? prices : undefined);
      toast.success(t('pool.approvedCount', { count: result.approvedCount }));
      setSelectedPendingDomains(new Set());
      setPendingPrices({});
      await Promise.all([fetchPoolDomains(), fetchPendingDomains()]);
    } catch (error: any) {
      toast.error(t('errors.failed', { action: t('pool.approveDomains') }) + ': ' + (error.message || t('errors.UNKNOWN')));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAllOnPage = async () => {
    if (pendingDomains.length === 0) return;

    try {
      setIsProcessing(true);
      const domainIds = pendingDomains.map(d => d.id);

      // Collect prices that were explicitly set
      const prices: Record<string, number> = {};
      for (const id of domainIds) {
        const priceStr = pendingPrices[id];
        if (priceStr !== undefined && priceStr !== '') {
          const price = parseFloat(priceStr);
          if (!isNaN(price) && price >= 0) {
            prices[id] = price;
          }
        }
      }

      const result = await api.approvePoolDomains(domainIds, Object.keys(prices).length > 0 ? prices : undefined);
      toast.success(t('pool.approvedCount', { count: result.approvedCount }));
      setSelectedPendingDomains(new Set());
      setPendingPrices({});
      await Promise.all([fetchPoolDomains(), fetchPendingDomains()]);
    } catch (error: any) {
      toast.error(t('errors.failed', { action: t('pool.approveDomains') }) + ': ' + (error.message || t('errors.UNKNOWN')));
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePoolDomainSelection = (id: string) => {
    const newSelection = new Set(selectedPoolDomains);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedPoolDomains(newSelection);
  };

  const toggleAvailableDomainSelection = (id: string) => {
    const newSelection = new Set(selectedAvailableDomains);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedAvailableDomains(newSelection);
  };

  const togglePendingDomainSelection = (id: string) => {
    const newSelection = new Set(selectedPendingDomains);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedPendingDomains(newSelection);
  };

  const selectAllPool = () => {
    if (selectedPoolDomains.size === poolDomains.length) {
      setSelectedPoolDomains(new Set());
    } else {
      setSelectedPoolDomains(new Set(poolDomains.map(d => d.id)));
    }
  };

  const selectAllAvailable = () => {
    if (selectedAvailableDomains.size === availableDomains.length) {
      setSelectedAvailableDomains(new Set());
    } else {
      setSelectedAvailableDomains(new Set(availableDomains.map(d => d.id)));
    }
  };

  const selectAllPending = () => {
    if (selectedPendingDomains.size === pendingDomains.length) {
      setSelectedPendingDomains(new Set());
    } else {
      setSelectedPendingDomains(new Set(pendingDomains.map(d => d.id)));
    }
  };

  const getZoneForDomain = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.com')) return 'com';
    if (lower.endsWith('.org')) return 'org';
    if (lower.endsWith('.site')) return 'site';
    if (lower.endsWith('.website')) return 'website';
    if (lower.endsWith('.life')) return 'life';
    if (lower.endsWith('.online')) return 'online';
    if (lower.endsWith('.space')) return 'space';
    return 'other';
  };

  const ZONE_LABELS: Record<string, string> = {
    com: '.com', org: '.org', site: '.site', website: '.website',
    life: '.life', online: '.online', space: '.space', other: 'other',
  };

  const ZONE_COLORS: Record<string, string> = {
    com: 'bg-blue-500/20 text-blue-400',
    org: 'bg-green-500/20 text-green-400',
    site: 'bg-cyan-500/20 text-cyan-400',
    website: 'bg-teal-500/20 text-teal-400',
    life: 'bg-pink-500/20 text-pink-400',
    online: 'bg-orange-500/20 text-orange-400',
    space: 'bg-indigo-500/20 text-indigo-400',
    other: 'bg-purple-500/20 text-purple-400',
  };

  const getDefaultPrice = (name: string): number => {
    const zone = getZoneForDomain(name);
    return zonePricing[zone] ?? zonePricing.other ?? 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const poolPageCount = Math.ceil(poolTotal / pageSize);
  const pendingPageCount = Math.ceil(pendingTotal / pageSize);
  const availablePageCount = Math.ceil(availableTotal / pageSize);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('pool.title')}</h1>
          <p className="text-gray-400 mt-1">
            {t('pool.description')}
          </p>
        </div>
        <Button variant="outline" onClick={fetchAllData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              {t('pool.domainsInPool')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-white">{poolTotal}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              {t('pool.pendingApproval')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold text-white">{pendingTotal}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              {t('pool.availableToAdd')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-white">{availableTotal}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('pool.filterByServer')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('pool.allServers')}</SelectItem>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name} ({server.ip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pool" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pool">
            {t('pool.inPool')} ({poolTotal})
          </TabsTrigger>
          <TabsTrigger value="pending">
            {t('pool.pendingApproval')} ({pendingTotal})
          </TabsTrigger>
          <TabsTrigger value="available">
            {t('pool.available')} ({availableTotal})
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <DollarSign className="h-4 w-4 mr-1" />
            {t('pool.pricing')}
          </TabsTrigger>
        </TabsList>

        {/* Pool Domains Tab */}
        <TabsContent value="pool">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('pool.domainsInPool')}</CardTitle>
                  <CardDescription>
                    {t('pool.domainsInPoolDesc')}
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleRemoveFromPool}
                  disabled={selectedPoolDomains.size === 0 || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Minus className="h-4 w-4 mr-2" />
                  )}
                  {t('pool.removeSelected')} ({selectedPoolDomains.size})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {poolDomains.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedPoolDomains.size === poolDomains.length && poolDomains.length > 0}
                            onCheckedChange={selectAllPool}
                          />
                        </TableHead>
                        <TableHead>{t('common.domain')}</TableHead>
                        <TableHead>{t('common.server')}</TableHead>
                        <TableHead>{t('common.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poolDomains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPoolDomains.has(domain.id)}
                              onCheckedChange={() => togglePoolDomainSelection(domain.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{domain.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Server className="h-4 w-4" />
                              {(domain as any).server?.name || t('common.noData')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              domain.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                              domain.status === 'INACTIVE' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {domain.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {poolPageCount > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPoolPage(p => Math.max(1, p - 1))}
                        disabled={poolPage === 1}
                      >
                        {t('common.previous')}
                      </Button>
                      <span className="text-sm text-gray-400">
                        {t('common.pageOf', { page: poolPage, total: poolPageCount })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPoolPage(p => Math.min(poolPageCount, p + 1))}
                        disabled={poolPage === poolPageCount}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  {t('pool.noDomainsInPool')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Approval Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Approval</CardTitle>
                  <CardDescription>
                    Review and set prices before approving domains for the pool
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleApproveAllOnPage}
                    disabled={pendingDomains.length === 0 || isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve All on Page
                  </Button>
                  <Button
                    onClick={handleApproveSelected}
                    disabled={selectedPendingDomains.size === 0 || isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve Selected ({selectedPendingDomains.size})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingDomains.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedPendingDomains.size === pendingDomains.length && pendingDomains.length > 0}
                            onCheckedChange={selectAllPending}
                          />
                        </TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Server</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead className="w-32">Price ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDomains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPendingDomains.has(domain.id)}
                              onCheckedChange={() => togglePendingDomainSelection(domain.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{domain.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Server className="h-4 w-4" />
                              {(domain as any).server?.name || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const zone = getZoneForDomain(domain.name);
                              return (
                                <span className={`px-2 py-1 rounded text-xs ${ZONE_COLORS[zone] || ZONE_COLORS.other}`}>
                                  {ZONE_LABELS[zone] || 'other'}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-28 h-8 text-sm"
                              placeholder={getDefaultPrice(domain.name).toFixed(2)}
                              value={pendingPrices[domain.id] ?? ''}
                              onChange={(e) => setPendingPrices(prev => ({
                                ...prev,
                                [domain.id]: e.target.value,
                              }))}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {pendingPageCount > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                        disabled={pendingPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-400">
                        Page {pendingPage} of {pendingPageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingPage(p => Math.min(pendingPageCount, p + 1))}
                        disabled={pendingPage === pendingPageCount}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No domains pending approval
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Available Domains Tab */}
        <TabsContent value="available">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Available Domains</CardTitle>
                  <CardDescription>
                    Unassigned domains that can be added to the pool
                  </CardDescription>
                </div>
                <Button
                  onClick={handleAddToPool}
                  disabled={selectedAvailableDomains.size === 0 || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add to Pool ({selectedAvailableDomains.size})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search domains..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {availableDomains.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedAvailableDomains.size === availableDomains.length && availableDomains.length > 0}
                            onCheckedChange={selectAllAvailable}
                          />
                        </TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Server</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableDomains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAvailableDomains.has(domain.id)}
                              onCheckedChange={() => toggleAvailableDomainSelection(domain.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{domain.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Server className="h-4 w-4" />
                              {(domain as any).server?.name || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              domain.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                              domain.status === 'INACTIVE' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {domain.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {availablePageCount > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAvailablePage(p => Math.max(1, p - 1))}
                        disabled={availablePage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-400">
                        Page {availablePage} of {availablePageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAvailablePage(p => Math.min(availablePageCount, p + 1))}
                        disabled={availablePage === availablePageCount}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  {searchQuery ? 'No domains match your search' : 'No available domains to add'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Domain Zone Pricing</CardTitle>
                <CardDescription>
                  Set prices per domain zone. Used for claim cost calculations and financial reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="max-w-md space-y-4">
                  {ZONE_KEYS.map((z) => {
                    const key = `domainCost${z}`;
                    const label = z === 'Other' ? 'Other Domains' : `.${z.toUpperCase()} Domains`;
                    return (
                      <div key={key} className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-200 w-40 shrink-0" htmlFor={key}>{label}</label>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <Input
                            id={key}
                            type="number"
                            step="0.01"
                            min="0"
                            value={pricing[key]}
                            onChange={(e) => setPricing(p => ({ ...p, [key]: e.target.value }))}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-700">
                  <Button onClick={savePricing} disabled={isSavingPricing}>
                    {isSavingPricing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Pricing'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Server IP Cost</CardTitle>
                <CardDescription>
                  Cost per server IP address. When domains are claimed, this cost is divided by the total number of claimed domains from that server and added to each domain's price.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {servers.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No servers found</p>
                ) : (
                  <div className="max-w-lg space-y-3">
                    {servers.map((server) => (
                      <div key={server.id} className="flex items-center gap-4">
                        <div className="w-48 shrink-0">
                          <span className="text-sm font-medium text-gray-200">{server.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({server.ip})</span>
                        </div>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={server.ipCost ?? 0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setServers(prev => prev.map(s => s.id === server.id ? { ...s, ipCost: value } : s));
                            }}
                            onBlur={async (e) => {
                              const value = parseFloat(e.target.value) || 0;
                              try {
                                await api.updateServer(server.id, { ipCost: value });
                                toast.success(`IP cost updated for ${server.name}`);
                              } catch (err: any) {
                                toast.error('Failed to update IP cost: ' + (err.message || 'Unknown error'));
                                fetchServers();
                              }
                            }}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
