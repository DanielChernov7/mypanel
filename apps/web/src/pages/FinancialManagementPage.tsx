import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DollarSign,
  Users,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  Package,
  AlertCircle,
  Trash2,
  Undo2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/utils';

interface OperatorStat {
  id: string;
  username: string;
  domainLimit: number;
  totalClaimed: number;
  activeDomains: number;
  inactiveDomains: number;
  bannedDomains: number;
  remainingLimit: number;
  domainCost: number;
  totalCost: number;
}

interface DomainCostDetail {
  name: string;
  zonePrice: number;
  serverCost: number;
  serverDomainCount: number | null;
  total: number;
}

interface ClaimHistoryItem {
  id: string;
  userId: string;
  username: string;
  claimedCount: number;
  domainIds: string[];
  domainNames: string[];
  domainCost: number;
  totalCost: number;
  domainCostDetails?: DomainCostDetail[];
  createdAt: string;
}

export function FinancialManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('operators');
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [operatorStartDate, setOperatorStartDate] = useState('');
  const [operatorEndDate, setOperatorEndDate] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [returningDomains, setReturningDomains] = useState<Set<string>>(new Set());
  const pageSize = 20;

  // Fetch operators statistics
  const { data: operatorsData, isLoading: operatorsLoading } = useQuery({
    queryKey: ['operators-stats'],
    queryFn: () => api.getOperatorsStats(),
  });

  // Fetch pool stats (available domains per zone)
  const { data: poolStats } = useQuery({
    queryKey: ['pool-stats'],
    queryFn: () => api.getDomainPoolStats(),
  });

  // Fetch claim history
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['claim-history', historyPage, selectedOperator, startDate, endDate],
    queryFn: () => api.getClaimHistory({
      page: historyPage,
      limit: pageSize,
      operatorId: selectedOperator || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  });

  const handleExportOperators = () => {
    const token = api.getToken();
    const url = api.getOperatorsCsvUrl({
      startDate: operatorStartDate || undefined,
      endDate: operatorEndDate || undefined,
    });

    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(response => response.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const datePart = operatorStartDate || operatorEndDate
          ? `${operatorStartDate || 'all'}-to-${operatorEndDate || 'now'}`
          : new Date().toISOString().split('T')[0];
        a.download = `operators-stats-${datePart}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        toast.success(t('financial.csvExported'));
      })
      .catch(() => {
        toast.error(t('financial.csvExportFailed'));
      });
  };

  const handleExportHistory = () => {
    const token = api.getToken();
    const url = api.getClaimsCsvUrl({
      operatorId: selectedOperator || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(response => response.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const datePart = startDate || endDate
          ? `${startDate || 'all'}-to-${endDate || 'now'}`
          : new Date().toISOString().split('T')[0];
        a.download = `claim-history-${datePart}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        toast.success(t('financial.csvExported'));
      })
      .catch(() => {
        toast.error(t('financial.csvExportFailed'));
      });
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleDeleteClaimHistory = async (id: string) => {
    try {
      await api.deleteClaimHistory(id);
      toast.success(t('financial.claimHistoryDeleted'));
      setDeleteConfirmId(null);
      refetchHistory();
    } catch (error: any) {
      toast.error(error.message || t('financial.claimHistoryDeleteFailed'));
    }
  };

  const handleReturnToPool = async (domainIds: string[], claimId: string) => {
    try {
      setReturningDomains(prev => new Set([...prev, claimId]));
      const result = await api.returnDomainsToPool(domainIds);
      toast.success(t('financial.returnedToPool', { count: result.returnedCount }));
      refetchHistory();
    } catch (error: any) {
      toast.error(error.message || t('financial.returnToPoolFailed'));
    } finally {
      setReturningDomains(prev => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
  };

  const historyPageCount = historyData ? Math.ceil(historyData.total / pageSize) : 1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('financial.title')}</h1>
        <p className="text-gray-400 mt-1">
          {t('financial.description')}
        </p>
      </div>

      {/* Summary Cards — Pool availability per zone + totals */}
      {(poolStats || operatorsData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {poolStats && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">.COM</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="text-2xl font-bold text-white">{poolStats.com.available}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">${poolStats.com.price.toFixed(2)} / domain</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">.ORG</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-500" />
                    <span className="text-2xl font-bold text-white">{poolStats.org.available}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">${poolStats.org.price.toFixed(2)} / domain</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t('financial.otherZones')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-yellow-500" />
                    <span className="text-2xl font-bold text-white">{poolStats.other.available}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">${poolStats.other.price.toFixed(2)} / domain</p>
                </CardContent>
              </Card>
            </>
          )}

          {operatorsData && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('financial.totalDomainsClaimed')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold text-white">
                      {operatorsData.totals.totalClaimed}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    {t('financial.totalRevenue')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold text-white">
                      ${operatorsData.totals.totalCost.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="operators">
            <Users className="h-4 w-4 mr-2" />
            {t('financial.operatorStats')}
          </TabsTrigger>
          <TabsTrigger value="history">
            <Calendar className="h-4 w-4 mr-2" />
            {t('financial.claimHistory')}
          </TabsTrigger>
        </TabsList>

        {/* Operators Statistics Tab */}
        <TabsContent value="operators">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('financial.operatorStats')}</CardTitle>
                  <CardDescription>
                    {t('financial.domainClaimsAndCosts')}
                  </CardDescription>
                </div>
                <Button onClick={handleExportOperators} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  {(operatorStartDate || operatorEndDate) ? t('financial.exportCsvPeriod') : t('financial.exportCsv')}
                </Button>
              </div>
              {/* Export Date Filters */}
              <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-border">
                <div className="text-sm text-gray-400 self-center mr-1">{t('financial.exportPeriod')}</div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t('financial.startDate')}</label>
                  <Input
                    type="date"
                    value={operatorStartDate}
                    onChange={(e) => setOperatorStartDate(e.target.value)}
                    className="w-40 h-9"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t('financial.endDate')}</label>
                  <Input
                    type="date"
                    value={operatorEndDate}
                    onChange={(e) => setOperatorEndDate(e.target.value)}
                    className="w-40 h-9"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    setOperatorStartDate(firstDay.toISOString().split('T')[0]);
                    setOperatorEndDate(now.toISOString().split('T')[0]);
                  }}
                >
                  {t('financial.thisMonth')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                    setOperatorStartDate(firstDay.toISOString().split('T')[0]);
                    setOperatorEndDate(lastDay.toISOString().split('T')[0]);
                  }}
                >
                  {t('financial.lastMonth')}
                </Button>
                {(operatorStartDate || operatorEndDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-500"
                    onClick={() => {
                      setOperatorStartDate('');
                      setOperatorEndDate('');
                    }}
                  >
                    {t('common.clear')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {operatorsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : operatorsData && operatorsData.operators.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('financial.operator')}</TableHead>
                      <TableHead className="text-right">{t('financial.claimed')}</TableHead>
                      <TableHead className="text-right">{t('financial.totalCost')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operatorsData.operators.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell className="font-medium">{op.username}</TableCell>
                        <TableCell className="text-right font-semibold">{op.totalClaimed}</TableCell>
                        <TableCell className="text-right font-bold text-green-400">
                          ${op.totalCost.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>{t('financial.total')}</TableCell>
                      <TableCell className="text-right">{operatorsData.totals.totalClaimed}</TableCell>
                      <TableCell className="text-right text-green-400">
                        ${operatorsData.totals.totalCost.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p>{t('financial.noOperatorsFound')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claim History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>{t('financial.claimHistory')}</CardTitle>
                  <CardDescription>
                    {t('financial.historicalRecord')}
                  </CardDescription>
                </div>
                <Button onClick={handleExportHistory} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  {t('financial.exportCsv')}
                </Button>
              </div>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm text-gray-400 mb-1 block">{t('financial.filterByOperator')}</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-white"
                    value={selectedOperator}
                    onChange={(e) => {
                      setSelectedOperator(e.target.value);
                      setHistoryPage(1);
                    }}
                  >
                    <option value="">{t('financial.allOperators')}</option>
                    {operatorsData?.operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('financial.startDate')}</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-40"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('financial.endDate')}</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-40"
                  />
                </div>
                {(selectedOperator || startDate || endDate) && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedOperator('');
                        setStartDate('');
                        setEndDate('');
                        setHistoryPage(1);
                      }}
                    >
                      {t('financial.clearFilters')}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : historyData && historyData.items.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('financial.date')}</TableHead>
                        <TableHead>{t('financial.operator')}</TableHead>
                        <TableHead className="text-right">{t('financial.domains')}</TableHead>
                        <TableHead className="text-right">{t('financial.costDomain')}</TableHead>
                        <TableHead className="text-right">{t('financial.totalCost')}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.items.map((item) => (
                        <>
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleRowExpand(item.id)}
                          >
                            <TableCell>{formatDate(item.createdAt)}</TableCell>
                            <TableCell className="font-medium">{item.username}</TableCell>
                            <TableCell className="text-right">{item.claimedCount}</TableCell>
                            <TableCell className="text-right">${item.domainCost.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-bold text-green-400">
                              ${item.totalCost.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-gray-400">
                                  {expandedRows.has(item.id) ? '▲' : '▼'}
                                </span>
                                {deleteConfirmId === item.id ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-6 text-xs px-2"
                                      onClick={() => handleDeleteClaimHistory(item.id)}
                                    >
                                      {t('common.confirm')}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs px-2"
                                      onClick={() => setDeleteConfirmId(null)}
                                    >
                                      {t('common.cancel')}
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-400"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(item.id);
                                    }}
                                    title={t('financial.deleteClaimRecord')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedRows.has(item.id) && (
                            <TableRow key={`${item.id}-details`}>
                              <TableCell colSpan={6} className="bg-muted/30">
                                <div className="p-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm text-gray-400">{t('financial.claimedDomains')}</p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={returningDomains.has(item.id)}
                                      onClick={() => handleReturnToPool(item.domainIds, item.id)}
                                    >
                                      {returningDomains.has(item.id) ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <Undo2 className="h-3 w-3 mr-1" />
                                      )}
                                      {t('financial.returnToPool')}
                                    </Button>
                                  </div>
                                  {item.domainCostDetails && item.domainCostDetails.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {item.domainCostDetails.map((detail, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between px-2 py-1.5 bg-background rounded text-xs"
                                        >
                                          <span className="font-mono">{detail.name}</span>
                                          <div className="flex items-center gap-3 text-gray-400">
                                            <span>
                                              {t('financial.domainPrice')}: <span className="text-white">${detail.zonePrice.toFixed(2)}</span>
                                            </span>
                                            {detail.serverCost > 0 && (
                                              <span>
                                                {t('financial.serverPrice')}: <span className="text-white">${detail.serverCost.toFixed(2)}</span>
                                                {detail.serverDomainCount && (
                                                  <span className="text-gray-500 ml-1">(1/{detail.serverDomainCount})</span>
                                                )}
                                              </span>
                                            )}
                                            <span className="text-green-400 font-semibold">
                                              = ${detail.total.toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {item.domainNames.map((name, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-1 bg-background rounded text-xs font-mono"
                                        >
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-400">
                      {t('financial.showingRange', { from: (historyPage - 1) * pageSize + 1, to: Math.min(historyPage * pageSize, historyData.total), total: historyData.total })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-400">
                        {t('financial.pageOf', { page: historyPage, total: historyPageCount })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage(p => Math.min(historyPageCount, p + 1))}
                        disabled={historyPage >= historyPageCount}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p>{t('financial.noClaimHistory')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
