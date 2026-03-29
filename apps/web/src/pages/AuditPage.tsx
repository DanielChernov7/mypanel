import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { Search, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Action type colors
const actionColors: Record<string, string> = {
  STATUS_CHANGE: 'bg-amber-500',
  UPDATE_PALLADIUM_GEO: 'bg-purple-500',
  CLOUDFLARE_PURGE: 'bg-blue-500',
  BUYER_TAG_EDIT: 'bg-yellow-500',
  GEO_EDIT: 'bg-green-500',
  OFFER_EDIT: 'bg-orange-500',
  PING_THANKS: 'bg-cyan-500',
  ATOMIC_REFRESH: 'bg-pink-500',
  ASSIGN_OPERATOR: 'bg-indigo-500',
  POOL_ADD_DOMAINS: 'bg-teal-500',
  POOL_REMOVE_DOMAINS: 'bg-red-500',
  CLEANUP_ORPHAN_DOMAINS: 'bg-gray-500',
  DEPLOY_CLOAK: 'bg-violet-500',
  DEPLOY_DOMAIN: 'bg-emerald-500',
  DEPLOY_PALLADIUM_CLOAK: 'bg-fuchsia-500',
  CHANGE_OFFER: 'bg-lime-500',
  CHANGE_CLOAK: 'bg-rose-500',
};

export function AuditPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [actionFilter, setActionFilter] = useState<string>('');

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit', { search, page, pageSize, action: actionFilter }],
    queryFn: () => api.getAuditLogs({
      search: search || undefined,
      page: page.toString(),
      pageSize: pageSize.toString(),
      action: actionFilter || undefined,
    }),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const totalPages = auditData ? Math.ceil(auditData.total / pageSize) : 0;

  // Get unique actions for filter
  const actionTypes = Object.keys(actionColors);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t('audit.title')}</h1>
        <p className="text-gray-400">{t('audit.description')}</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={t('audit.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch}>{t('common.search')}</Button>
        </div>

        {/* Action filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-gray-400" />
          <Button
            variant={actionFilter === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActionFilter(''); setPage(1); }}
          >
            {t('common.all')}
          </Button>
          {actionTypes.map((action) => (
            <Button
              key={action}
              variant={actionFilter === action ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActionFilter(action); setPage(1); }}
              className="text-xs"
            >
              {action.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>

        {/* Active filters display */}
        {(search || actionFilter) && (
          <div className="flex gap-2 items-center text-sm text-gray-400">
            <span>{t('audit.activeFilters')}</span>
            {search && (
              <Badge variant="secondary" className="gap-1">
                {t('common.search')}: {search}
                <X className="h-3 w-3 cursor-pointer" onClick={clearSearch} />
              </Badge>
            )}
            {actionFilter && (
              <Badge variant="secondary" className="gap-1">
                {t('common.actions')}: {actionFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setActionFilter('')} />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      {auditData && (
        <div className="mb-4 text-sm text-gray-400">
          {t('audit.showingRange', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize, auditData.total), total: auditData.total })}
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : auditData?.items.length === 0 ? (
        <div className="text-gray-400">{t('audit.noLogs')}</div>
      ) : (
        <div className="space-y-3">
          {auditData?.items.map((audit: any) => (
            <Card key={audit.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={actionColors[audit.action] || 'bg-gray-500'}>
                        {audit.action.replace(/_/g, ' ')}
                      </Badge>
                      {audit.server && (
                        <span className="text-sm font-medium text-white">
                          {audit.server.name} ({audit.server.ip})
                        </span>
                      )}
                      {audit.domain && (
                        <Badge variant="outline" className="text-xs">
                          {audit.domain.name}
                        </Badge>
                      )}
                    </div>

                    {audit.path && (
                      <p className="mt-2 text-sm text-gray-400 font-mono truncate">{audit.path}</p>
                    )}

                    {/* Metadata display */}
                    {audit.metadata && (
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        {audit.metadata.domainName && !audit.domain && (
                          <div>{t('audit.metadata.domain')} <span className="text-gray-300">{audit.metadata.domainName}</span></div>
                        )}
                        {audit.metadata.oldGeo && audit.metadata.newGeo && (
                          <div>
                            {t('audit.metadata.geo')} <span className="text-red-400">{audit.metadata.oldGeo}</span>
                            {' → '}
                            <span className="text-green-400">{audit.metadata.newGeo}</span>
                          </div>
                        )}
                        {audit.metadata.oldCampaignId && audit.metadata.newCampaignId && (
                          <div>
                            {t('audit.metadata.campaign')} <span className="text-gray-300">{audit.metadata.oldCampaignId}</span>
                            {' → '}
                            <span className="text-gray-300">{audit.metadata.newCampaignId}</span>
                          </div>
                        )}
                        {audit.metadata.oldBuyerTag !== undefined && audit.metadata.newBuyerTag !== undefined && (
                          <div>
                            {t('audit.metadata.buyerTag')} <span className="text-red-400">{audit.metadata.oldBuyerTag || t('common.none')}</span>
                            {' → '}
                            <span className="text-green-400">{audit.metadata.newBuyerTag || t('common.none')}</span>
                          </div>
                        )}
                        {audit.metadata.oldOfferName !== undefined && audit.metadata.newOfferName !== undefined && (
                          <div>
                            {t('audit.metadata.offer')} <span className="text-red-400">{audit.metadata.oldOfferName || t('common.none')}</span>
                            {' → '}
                            <span className="text-green-400">{audit.metadata.newOfferName || t('common.none')}</span>
                          </div>
                        )}
                        {audit.metadata.oldStatus && audit.metadata.newStatus && (
                          <div>
                            {t('audit.metadata.status')} <span className={`font-medium ${audit.metadata.oldStatus === 'ACTIVE' ? 'text-green-400' : audit.metadata.oldStatus === 'BANNED' ? 'text-red-400' : 'text-gray-400'}`}>{audit.metadata.oldStatus}</span>
                            {' → '}
                            <span className={`font-medium ${audit.metadata.newStatus === 'ACTIVE' ? 'text-green-400' : audit.metadata.newStatus === 'BANNED' ? 'text-red-400' : 'text-gray-400'}`}>{audit.metadata.newStatus}</span>
                          </div>
                        )}
                        {audit.metadata.countries && Array.isArray(audit.metadata.countries) && (
                          <div>{t('audit.metadata.countries')} <span className="text-gray-300">{audit.metadata.countries.join(', ')}</span></div>
                        )}
                        {audit.metadata.campaignId && !audit.metadata.oldCampaignId && (
                          <div>{t('audit.metadata.campaignId')} <span className="text-gray-300">{audit.metadata.campaignId}</span></div>
                        )}
                        {audit.metadata.targetLink && (
                          <div>{t('audit.metadata.target')} <span className="text-gray-300 truncate">{audit.metadata.targetLink}</span></div>
                        )}
                        {audit.metadata.botLink && (
                          <div>{t('audit.metadata.botLink')} <span className="text-gray-300">{audit.metadata.botLink}</span></div>
                        )}
                        {audit.metadata.offerName && !audit.metadata.oldOfferName && (
                          <div>{t('audit.metadata.offer')} <span className="text-gray-300">{audit.metadata.offerName}</span></div>
                        )}
                        {audit.metadata.filesCopied !== undefined && (
                          <div>{t('audit.metadata.filesCopied')} <span className="text-gray-300">{audit.metadata.filesCopied}</span></div>
                        )}
                        {audit.metadata.cloakDeployed !== undefined && (
                          <div>
                            {t('audit.metadata.cloak')} <span className={audit.metadata.cloakDeployed ? 'text-green-400' : 'text-gray-400'}>
                              {audit.metadata.cloakDeployed ? t('common.yes') : t('common.no')}
                            </span>
                            {audit.metadata.cloakDeployed && audit.metadata.palladiumGeo && (
                              <span className="text-gray-400"> ({Array.isArray(audit.metadata.palladiumGeo) ? audit.metadata.palladiumGeo.join(', ') : audit.metadata.palladiumGeo})</span>
                            )}
                          </div>
                        )}
                        {audit.metadata.palladiumWarning && (
                          <div className="text-yellow-400">{t('audit.metadata.palladiumWarning')} {audit.metadata.palladiumWarning}</div>
                        )}
                        {audit.metadata.status !== undefined && (
                          <div>{t('audit.metadata.statusLabel')} <span className={audit.metadata.ok ? 'text-green-400' : 'text-red-400'}>{audit.metadata.status}</span></div>
                        )}
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-400">
                      <span className="font-medium text-gray-300">{audit.user?.username || 'system'}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(audit.createdAt)}</span>
                    </div>

                    {audit.exitCode !== null && audit.exitCode !== undefined && (
                      <div className="mt-2">
                        <Badge variant={audit.exitCode === 0 ? 'default' : 'destructive'}>
                          {t('audit.exitCode', { code: audit.exitCode })}
                        </Badge>
                      </div>
                    )}

                    {(audit.stdout || audit.stderr) && (
                      <div className="mt-3 space-y-2">
                        {audit.stdout && (
                          <div>
                            <p className="text-xs font-medium text-gray-300">{t('common.output')}:</p>
                            <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-2 text-xs text-gray-300">
                              {audit.stdout}
                            </pre>
                          </div>
                        )}
                        {audit.stderr && (
                          <div>
                            <p className="text-xs font-medium text-red-400">{t('common.error')}:</p>
                            <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-2 text-xs text-red-400">
                              {audit.stderr}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {t('common.pageOf', { page, total: totalPages })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              {t('common.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
