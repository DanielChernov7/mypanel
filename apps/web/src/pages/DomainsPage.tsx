import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Globe2, Search, RefreshCw, Scan, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Code, Edit, FileText, Package, Ban, Shield, X, Play, CheckSquare, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ProgressBar } from '@/components/ProgressBar';
import { useProgressStore } from '@/stores/progressStore';
import { ChangeOfferModal } from '@/components/ChangeOfferModal';
import { BulkEditOfferMetaModal } from '@/components/BulkEditOfferMetaModal';
import { DeployCloakModal } from '@/components/DeployCloakModal';
import { HealthDotPopover } from '@/components/HealthDotPopover';
import type { DomainStatus, DomainWithServer, PingThanksDto, PingThanksResult, BulkBanDomainsResult, User } from '@server-panel/types';
import { formatDate, formatDateOnly, formatTimeOnly, countryCodeToFlag } from '@/lib/utils';
import { showActionErrorToast, showBulkOperationSummary, showBulkItemError } from '@/lib/errorHandler';
import { useAuth } from '@/hooks/useAuth';

function generateTestLeadData(): Record<string, string> {
  const firstNames = ['Oleksandr', 'Andriy', 'Dmytro', 'Serhiy', 'Maksym', 'Ivan', 'Artem', 'Mykola', 'Viktor', 'Oleg', 'Taras', 'Yuriy', 'Bogdan', 'Yaroslav', 'Roman'];
  const lastNames = ['Shevchenko', 'Bondarenko', 'Kovalenko', 'Melnyk', 'Tkachenko', 'Kravchenko', 'Oliynyk', 'Ivanov', 'Petrenko', 'Morozov', 'Savchenko', 'Sydorenko', 'Lysenko', 'Goncharenko'];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const rand = Math.floor(Math.random() * 900 + 100);
  const phone = '+380' + String(Math.floor(Math.random() * 900000000 + 100000000));
  return {
    f_name: firstName,
    l_name: lastName,
    email: `test.${firstName.toLowerCase()}${rand}@test.com`,
    phone2: phone,
    source: 'test',
  };
}

export function DomainsPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DomainStatus | ''>('');
  const [tagFilter, setTagFilter] = useState<'true' | 'false' | ''>('');
  const [conversionFilter, setConversionFilter] = useState<'true' | 'false' | ''>('');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [reviewFilter, setReviewFilter] = useState<'overdue' | 'due_soon' | 'ok' | ''>('');
  const [page, setPage] = useState(1);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [googleTagInputs, setGoogleTagInputs] = useState<Record<string, string>>({});
  const [conversionInputs, setConversionInputs] = useState<Record<string, string>>({});
  // Unified edit metadata state (combines Buyer Tag, GEO, Offer Name, Palladium GEO)
  const [editMetaDomain, setEditMetaDomain] = useState<{
    id: string;
    name: string;
    currentBuyerTag: string;
    currentGeo: string;
    currentOffer: string;
    palladiumCampaignId: string | null;
    currentPalladiumGeo: string[];
  } | null>(null);
  const [buyerTagInput, setBuyerTagInput] = useState('');
  const [geoInput, setGeoInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [palladiumGeoInput, setPalladiumGeoInput] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [pingThanksMode, setPingThanksMode] = useState<'single' | 'bulk' | null>(null);
  const [pingThanksDomain, setPingThanksDomain] = useState<{ id: string; name: string } | null>(null);
  const [pingThanksOptions, setPingThanksOptions] = useState<PingThanksDto>({
    protocol: 'https',
    path: '{offerFolder}/core.php',
    query: '',
    timeout: 10000,
    retries: 1,
    expect: '',
    method: 'POST',
    formData: generateTestLeadData(),
  });
  const [changeOfferMode, setChangeOfferMode] = useState<'single' | 'bulk' | null>(null);
  const [changeOfferDomain, setChangeOfferDomain] = useState<{ id: string; name: string } | null>(null);
  const [bulkSelectedDomainsList, setBulkSelectedDomainsList] = useState<Array<{ id: string; name: string }>>([]);
  const [showBulkEditOfferMeta, setShowBulkEditOfferMeta] = useState(false);
  const [showDeployCloak, setShowDeployCloak] = useState(false);
  const [showBulkSelect, setShowBulkSelect] = useState(false);
  const [bulkSelectInput, setBulkSelectInput] = useState('');
  const [bulkSelectResult, setBulkSelectResult] = useState<{
    found: string[];
    notFound: string[];
    selected: number;
  } | null>(null);
  const [bulkBanResult, setBulkBanResult] = useState<{
    banned: string[];
    notFound: string[];
    alreadyBanned: string[];
    errors: Array<{ domain: string; error: string }>;
  } | null>(null);
  const [bulkBanFromSelectPending, setBulkBanFromSelectPending] = useState(false);
  const [confirmBanWithCampaign, setConfirmBanWithCampaign] = useState<{
    domainId: string;
    domainName: string;
    campaignId: string;
    newStatus: DomainStatus;
  } | null>(null);
  const [confirmBulkStatusChange, setConfirmBulkStatusChange] = useState<{
    newStatus: DomainStatus;
    domains: { id: string; name: string; currentStatus: DomainStatus }[];
  } | null>(null);
  const [confirmBulkOwnerChange, setConfirmBulkOwnerChange] = useState<{
    newOwnerId: string | null;
    newOwnerName: string;
    domains: { id: string; name: string; currentOwner: string | null }[];
  } | null>(null);
  const [confirmReturnToPool, setConfirmReturnToPool] = useState(false);
  const [returningToPool, setReturningToPool] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { startProgress, updateProgress, completeProgress } = useProgressStore();
  const { isAdmin, user: authUser } = useAuth();
  const { t } = useTranslation();
  const limit = authUser?.domainsPerPage || 20;

  // Fetch operators for assignment dropdown (only for admins)
  const { data: operators = [] } = useQuery<User[]>({
    queryKey: ['operators'],
    queryFn: () => api.getOperators(),
    enabled: isAdmin(), // Only fetch for admins
  });

  // Sorting state for Traffic column (server-side sorting)
  const [trafficSort, setTrafficSort] = useState<'asc' | 'desc' | null>(null);

  const { data: domainsData, isLoading } = useQuery({
    queryKey: ['domains', query, statusFilter, tagFilter, conversionFilter, ownerFilter, reviewFilter, page, limit, trafficSort],
    queryFn: () =>
      api.getDomains({
        query: query || undefined,
        status: statusFilter || undefined,
        hasTag: tagFilter || undefined,
        hasConversion: conversionFilter || undefined,
        ownerId: ownerFilter || undefined,
        reviewStatus: reviewFilter || undefined,
        page,
        limit,
        sortBy: trafficSort ? 'traffic' : 'name',
        sortOrder: trafficSort || 'asc',
      }),
  });

  const [campaignStats, setCampaignStats] = useState<Record<string, { botTraffic: string; targetTraffic: string; botTotalTraffic: string; targetUniqueTraffic: string }>>({});

  // Fetch total traffic across all operator's domains
  const { data: totalTrafficData } = useQuery({
    queryKey: ['total-traffic'],
    queryFn: () => api.getTotalTraffic(),
  });

  // Reset page to 1 when limit changes (user changed preference)
  useEffect(() => {
    setPage(1);
  }, [limit]);

  // Fetch campaign stats separately (or use from API response when traffic sorting)
  useEffect(() => {
    if (!domainsData?.items) return;

    // When traffic sorting is active, API returns campaignStats in response
    if (trafficSort && domainsData.campaignStats) {
      setCampaignStats(domainsData.campaignStats);
      return;
    }

    const campaignIds = domainsData.items
      .filter(d => d.palladiumCampaignId)
      .map(d => d.palladiumCampaignId as string);

    if (campaignIds.length === 0) {
      setCampaignStats({});
      return;
    }

    api.getCampaignStats(campaignIds)
      .then(stats => setCampaignStats(stats))
      .catch(() => setCampaignStats({}));
  }, [domainsData?.items, domainsData?.campaignStats, trafficSort]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DomainStatus }) =>
      api.updateDomain(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t('domains.domainStatusUpdated'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('domains.failedUpdateDomainStatus'));
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (domainId: string) =>
      api.deleteDomainCampaign(domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('domains.failedDeleteCampaign'));
    },
  });

  const deleteCampaignsBulkMutation = useMutation({
    mutationFn: (domainIds: string[]) =>
      api.deleteDomainCampaignsBulk(domainIds),
    onError: (error: any) => {
      toast.error(error.message || t('domains.failedDeleteCampaigns'));
    },
  });

  const scanMutation = useMutation({
    mutationFn: (domainIds?: string[]) => api.scanDomains({ domainIds }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      if (data?.alreadyExists) {
        toast.info(t('domains.jobAlreadyInProgress'));
      } else {
        toast.success(
          t('domains.scannedDomains', { scanned: data.scanned, updated: data.updated })
        );
      }
    },
    onError: (error: any) => {
      // Enhanced error surfacing
      showActionErrorToast('Rescan', error);
    },
  });

  const refreshTrafficMutation = useMutation({
    mutationFn: () => api.refreshTrafficStats(),
    onSuccess: (data) => {
      toast.success(t('domains.trafficRefreshStarted'), {
        description: t('domains.trafficRefreshDesc'),
      });
      // Refresh data after a delay to show updated values
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['domains'] });
      }, 3000);
    },
    onError: (error: any) => {
      toast.error(error.message || t('domains.failedRefreshTraffic'));
    },
  });

  const insertTagsMutation = useMutation({
    mutationFn: ({ id, googleTag, conversion, replaceConversion }: { id: string; googleTag?: string; conversion?: string; replaceConversion?: boolean }) =>
      api.insertGoogleTags(id, googleTag, conversion, replaceConversion),
    onSuccess: (data, variables) => {
      if (data?.alreadyExists) {
        toast.info(t('domains.jobAlreadyInProgress'));
        return;
      }
      // Job has been created and is processing asynchronously
      toast.success(
        t('domains.tagJobStarted', { domain: data.domainName }),
        {
          description: t('domains.tagJobDesc', { jobId: data.jobId }),
          duration: 5000,
        }
      );

      // DO NOT clear inputs or close expanded section
      // This allows users to modify tags and re-insert multiple times
      // setExpandedDomain(null);  // Keep section open
      // setGoogleTagInputs({});   // Keep input values
      // setConversionInputs({});  // Keep input values

      // Invalidate queries after a short delay to show updated status
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['domains'] });
      }, 2000);
    },
    onError: (error: any, variables) => {
      // Enhanced error surfacing
      const domain = domainsData?.items.find(d => d.id === variables.id);
      showActionErrorToast('Insert Tags', error, {
        domain: domain?.name,
      });
    },
  });


  const handleBulkSelect = async () => {
    // Parse domains from textarea (one per line)
    const lines = bulkSelectInput.split('\n');
    const domainNames = lines
      .map(line => line.trim().toLowerCase())
      .filter(line => line.length > 0);

    if (domainNames.length === 0) {
      toast.error(t('domains.enterAtLeast'));
      return;
    }

    try {
      // Lookup domains across the entire database
      const result = await api.lookupDomains(domainNames);

      const newSelection = new Set(selectedDomains);
      for (const domain of result.found) {
        newSelection.add(domain.id);
      }

      // Update selection
      setSelectedDomains(newSelection);

      // Set result
      setBulkSelectResult({
        found: result.found.map(d => d.name),
        notFound: result.notFound,
        selected: newSelection.size,
      });

      if (result.found.length > 0) {
        toast.success(t('domains.selectedCount', { count: result.found.length }));
      }
      if (result.notFound.length > 0) {
        toast.warning(t('domains.notFoundCount', { count: result.notFound.length }));
      }
    } catch (error: any) {
      toast.error(`${t('domains.failedLookupDomains')}: ${error.message}`);
    }
  };

  const bulkBanMutation = useMutation({
    mutationFn: ({ domains, deletePalladiumCampaigns }: { domains: string[]; deletePalladiumCampaigns: boolean }) =>
      api.bulkBanDomains({ domains, deletePalladiumCampaigns }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });

      const successCount = result.banned.length;
      const campaignsDeleted = result.campaignsDeleted?.length || 0;
      const campaignErrors = result.campaignErrors?.length || 0;

      let message = t('domains.bannedCount', { count: successCount });
      if (result.alreadyBanned.length > 0) {
        message += ` (${result.alreadyBanned.length} ${t('domains.alreadyBanned').toLowerCase()})`;
      }
      if (campaignsDeleted > 0) {
        message += `, ${t('domains.deletedCampaigns', { count: campaignsDeleted })}`;
      }

      if (result.errors.length === 0 && result.notFound.length === 0 && campaignErrors === 0) {
        toast.success(message);
      } else {
        toast.warning(`${message}. ${t('common.warnings')}: ${result.notFound.length} ${t('domains.notFound').toLowerCase()}, ${result.errors.length + campaignErrors} ${t('domains.errors').toLowerCase()}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || t('domains.failedBanDomains'));
      setBulkBanResult(null);
    },
  });

  const editBuyerTagMutation = useMutation({
    mutationFn: ({ id, buyerTag }: { id: string; buyerTag: string }) => api.editBuyerTag(id, buyerTag),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t('domains.buyerTagUpdated', { value: data.buyerTag }));
      // Update the current value in editMetaDomain state
      setEditMetaDomain(prev => prev ? { ...prev, currentBuyerTag: data.buyerTag } : null);
    },
    onError: (error: any) => {
      const message = error.message === 'BUYER_TAG_KEY_NOT_FOUND'
        ? t('domains.buyerTagKeyNotFound')
        : error.message || t('domains.failedUpdateBuyerTag');
      toast.error(message);
    },
  });

  const editGeoMutation = useMutation({
    mutationFn: ({ id, geo }: { id: string; geo: string }) => api.editGeo(id, geo),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t('domains.geoUpdated', { value: data.geo }));
      // Update the current value in editMetaDomain state
      setEditMetaDomain(prev => prev ? { ...prev, currentGeo: data.geo } : null);
    },
    onError: (error: any) => {
      const message = error.message === 'LANG_KEY_NOT_FOUND'
        ? t('domains.langKeyNotFound')
        : error.message || t('domains.failedUpdateGeo');
      toast.error(message);
    },
  });

  const editOfferMutation = useMutation({
    mutationFn: ({ id, offerName }: { id: string; offerName: string }) => api.editOfferName(id, offerName),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t('domains.offerNameUpdated', { value: data.offerName }));
      // Update the current value in editMetaDomain state
      setEditMetaDomain(prev => prev ? { ...prev, currentOffer: data.offerName } : null);
    },
    onError: (error: any) => {
      const message = error.message === 'OFFER_KEY_NOT_FOUND'
        ? t('domains.offerKeyNotFound')
        : error.message || t('domains.failedUpdateOfferName');
      toast.error(message);
    },
  });

  const updatePalladiumGeoMutation = useMutation({
    mutationFn: ({ id, countries }: { id: string; countries: string[] }) => api.updatePalladiumGeo(id, countries),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t('domains.palladiumGeoUpdated', { value: data.palladiumCampaignGeo.join(', ') }));
      // Update the current value in editMetaDomain state
      setEditMetaDomain(prev => prev ? { ...prev, currentPalladiumGeo: data.palladiumCampaignGeo } : null);
      setPalladiumGeoInput(data.palladiumCampaignGeo);
    },
    onError: (error: any) => {
      toast.error(error.message || t('domains.failedUpdatePalladiumGeo'));
    },
  });

  const changeOfferMutation = useMutation({
    mutationFn: ({ id, offerId, buyerTag, palladiumOptions }: { id: string; offerId: string; buyerTag?: string; palladiumOptions?: { enabled: boolean; countries: string[] } }) =>
      api.changeOffer(id, offerId, buyerTag, palladiumOptions),
    onSuccess: (data) => {
      if (data?.alreadyExists) {
        toast.info(t('domains.jobAlreadyInProgress'));
        return;
      }
      const description = data.palladiumWarning
        ? `Job ID: ${data.jobId}. Warning: ${data.palladiumWarning}`
        : `Job ID: ${data.jobId}. Check the Jobs page for progress.`;

      toast.success(t('domains.offerChangeJobCreated', { domain: data.domainName }), {
        description,
        duration: 7000,
      });
      setChangeOfferMode(null);
      setChangeOfferDomain(null);
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
    onError: (error: any) => {
      showActionErrorToast('Change Offer', error, {
        domain: changeOfferDomain?.name,
      });
    },
  });

  const changeOfferBulkMutation = useMutation({
    mutationFn: ({ domainIds, offerId, buyerTag, palladiumOptions }: { domainIds: string[]; offerId: string; buyerTag?: string; palladiumOptions?: { enabled: boolean; countries: string[] } }) =>
      api.changeOfferBulk(domainIds, offerId, buyerTag, palladiumOptions),
    onSuccess: (data) => {
      if ((data as any)?.alreadyExists) {
        toast.info(t('domains.jobAlreadyInProgress'));
        return;
      }
      toast.success(t('domains.bulkOfferChangeJobCreated'), {
        description: t('domains.bulkOfferChangeDesc', { count: data.totalDomains, jobId: data.jobId }),
        duration: 5000,
      });
      setChangeOfferMode(null);
      setSelectedDomains(new Set());
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
    onError: (error: any) => {
      showActionErrorToast('Bulk Change Offer', error);
    },
  });

  const deployCloakBulkMutation = useMutation({
    mutationFn: ({ domainIds, countries }: { domainIds: string[]; countries: string[] }) =>
      api.deployCloakBulk(domainIds, countries),
    onSuccess: (data) => {
      if ((data as any)?.alreadyExists) {
        toast.info(t('domains.jobAlreadyInProgress'));
        return;
      }
      toast.success(t('domains.bulkCloakJobCreated'), {
        description: t('domains.bulkCloakDesc', { count: data.totalDomains, countries: data.countries.join(', '), jobId: data.jobId }),
        duration: 5000,
      });
      setShowDeployCloak(false);
      setSelectedDomains(new Set());
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
    onError: (error: any) => {
      showActionErrorToast('Bulk Deploy Cloak', error);
    },
  });

  const bulkUpdateOfferMetaMutation = useMutation({
    mutationFn: ({ domainIds, updates }: { domainIds: string[]; updates: { offerName?: string; geo?: string; buyerTag?: string } }) =>
      api.bulkUpdateOfferMeta(domainIds, updates),
    onSuccess: (data) => {
      if (data?.alreadyExists) {
        toast.info(t('domains.jobAlreadyInProgress'));
        return;
      }
      // New response format: job created in background
      if (data.jobId) {
        const updatesList = [];
        if (data.updates?.offerName) updatesList.push(`Offer: ${data.updates.offerName}`);
        if (data.updates?.geo) updatesList.push(`Geo: ${data.updates.geo}`);
        if (data.updates?.buyerTag) updatesList.push(`Buyer Tag: ${data.updates.buyerTag}`);

        toast.success(t('domains.bgJobStarted', { count: data.domainCount }), {
          description: t('domains.bgJobDesc', { updates: updatesList.join(', ') }),
          duration: 5000,
        });

        setShowBulkEditOfferMeta(false);
        setSelectedDomains(new Set());
        return;
      }

      // Legacy response format (backward compatibility)
      const updatesList = [];
      if (data.updates?.offerName) updatesList.push(`Offer: ${data.updates.offerName}`);
      if (data.updates?.geo) updatesList.push(`Geo: ${data.updates.geo}`);

      if (data.failedCount === 0) {
        toast.success(t('domains.metadataUpdated', { count: data.updatedCount }), {
          description: t('domains.metadataUpdatedDesc', { updates: updatesList.join(', ') }),
          duration: 7000,
        });
      } else if (data.updatedCount > 0) {
        toast.warning(t('domains.partialSuccess', { updated: data.updatedCount, total: data.totalCount }), {
          description: data.message,
          duration: 10000,
        });
      } else {
        toast.error(t('domains.failedUpdateDomains'), {
          description: data.message,
          duration: 10000,
        });
      }

      setShowBulkEditOfferMeta(false);
      setSelectedDomains(new Set());
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
    onError: (error: any) => {
      showActionErrorToast('Bulk Edit Offer Metadata', error);
    },
  });

  const reviewDomainMutation = useMutation({
    mutationFn: (domainId: string) => api.reviewDomain(domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t('domains.reviewSuccess'));
    },
    onError: (error: any) => {
      showActionErrorToast('Review domain', error);
    },
  });

  const bulkReviewMutation = useMutation({
    mutationFn: (domainIds: string[]) => api.bulkReviewDomains(domainIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t('domains.reviewBulkSuccess', { count: data.reviewed?.length || 0 }));
      setSelectedDomains(new Set());
    },
    onError: (error: any) => {
      showActionErrorToast('Bulk review', error);
    },
  });

  const assignOperatorMutation = useMutation({
    mutationFn: ({ domainId, operatorId }: { domainId: string; operatorId: string | null }) =>
      api.assignOperator(domainId, operatorId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      const ownerName = data.assignedOperator?.username || 'Unassigned';
      toast.success(t('domains.ownerAssigned'), {
        description: t('domains.assignedTo', { domain: data.name, owner: ownerName }),
      });
    },
    onError: (error: any) => {
      toast.error(error.message || t('domains.failedAssignOwner'));
    },
  });

  const pingThanksMutation = useMutation({
    mutationFn: (id: string) => api.pingThanks(id, pingThanksOptions),
    onSuccess: (result: PingThanksResult) => {
      if (result.ok) {
        toast.success(t('domains.pingSucceeded'), {
          description: `${result.domainName} — ${result.status} (${result.timeMs}ms)`,
        });
      } else {
        showActionErrorToast('Test Registration', result.error, {
          domain: result.domainName,
        });
      }
      setPingThanksMode(null);
      setPingThanksDomain(null);
    },
    onError: (error: any) => {
      showActionErrorToast('Test Registration', error, {
        domain: pingThanksDomain?.name,
      });
    },
  });

  const handleStatusChange = async (domainId: string, newStatus: DomainStatus) => {
    // Check if multiple domains are selected and current domain is in selection
    if (selectedDomains.size > 1 && selectedDomains.has(domainId)) {
      // Fetch all selected domains from server (works across all pages)
      try {
        const allSelectedIds = Array.from(selectedDomains);
        const domainsFromServer = await api.lookupDomainsByIds(allSelectedIds);

        const selectedDomainsInfo = domainsFromServer.map(d => ({
          id: d.id,
          name: d.name,
          currentStatus: d.status
        }));

        // Show bulk confirmation dialog
        setConfirmBulkStatusChange({
          newStatus,
          domains: selectedDomainsInfo,
        });
      } catch (error: any) {
        toast.error(t('domains.failedLoadSelectedDomains') + ': ' + (error.message || t('common.unknownError')));
      }
      return;
    }

    // Single domain change - check if banning a domain with a Palladium campaign
    if (newStatus === 'BANNED') {
      const domain = domainsData?.items.find(d => d.id === domainId);
      if (domain?.palladiumCampaignId) {
        // Show confirmation dialog
        setConfirmBanWithCampaign({
          domainId: domain.id,
          domainName: domain.name,
          campaignId: domain.palladiumCampaignId,
          newStatus,
        });
        return;
      }
    }

    updateStatusMutation.mutate({ id: domainId, status: newStatus });
  };

  const handleConfirmBulkStatusChange = async () => {
    if (!confirmBulkStatusChange) return;

    const { newStatus, domains } = confirmBulkStatusChange;

    // If banning, check for domains with Palladium campaigns
    if (newStatus === 'BANNED') {
      const domainsWithCampaigns = domainsData?.items
        .filter(d => domains.some(sd => sd.id === d.id) && d.palladiumCampaignId)
        .map(d => d.id) || [];

      if (domainsWithCampaigns.length > 0) {
        // Delete campaigns first
        try {
          await deleteCampaignsBulkMutation.mutateAsync(domainsWithCampaigns);
        } catch (error) {
          // Continue anyway, some campaigns may have been deleted
        }
      }
    }

    // Update all domains status
    let successCount = 0;
    let errorCount = 0;

    for (const domain of domains) {
      try {
        await updateStatusMutation.mutateAsync({ id: domain.id, status: newStatus });
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['domains'] });
    setConfirmBulkStatusChange(null);
    setSelectedDomains(new Set());

    if (errorCount === 0) {
      toast.success(`Updated ${successCount} domain(s) to ${newStatus}`);
    } else {
      toast.warning(`Updated ${successCount} domain(s), ${errorCount} failed`);
    }
  };

  const handleConfirmBanWithCampaign = async () => {
    if (!confirmBanWithCampaign) return;

    try {
      // Delete campaign first
      await deleteCampaignMutation.mutateAsync(confirmBanWithCampaign.domainId);

      // Then update status
      updateStatusMutation.mutate({
        id: confirmBanWithCampaign.domainId,
        status: confirmBanWithCampaign.newStatus,
      });

      toast.success(`Campaign deleted and domain banned`);
      setConfirmBanWithCampaign(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete campaign');
    }
  };

  const handleScanSelected = async () => {
    if (selectedDomains.size === 0) {
      toast.info('Please select at least one domain');
      return;
    }

    const domainIds = Array.from(selectedDomains);
    startProgress('Rescanning selected domains...', domainIds.length);

    let errorCount = 0;
    for (let i = 0; i < domainIds.length; i++) {
      const domain = domainsData?.items.find(d => d.id === domainIds[i]);
      try {
        await api.scanDomains({ domainIds: [domainIds[i]] });
        updateProgress(i + 1);
      } catch (error) {
        errorCount++;
        if (domain) {
          // Show throttled error toast for item
          showBulkItemError('Rescan', domain.name, error, { throttle: true });
        }
        updateProgress(i + 1);
      }
    }

    completeProgress(errorCount);
    queryClient.invalidateQueries({ queryKey: ['domains'] });

    if (errorCount === 0) {
      toast.success(`Scanned ${domainIds.length} domains successfully`);
    } else {
      toast.warning(`Scanned with ${errorCount} errors`);
    }
  };


  const handlePingThanksSelected = async () => {
    if (selectedDomains.size === 0) {
      toast.info('Please select at least one domain');
      return;
    }

    setPingThanksMode(null);
    const domainIds = Array.from(selectedDomains);
    startProgress('Testing registration on selected domains...', domainIds.length);

    try {
      const response = await api.pingThanksBulk(domainIds, pingThanksOptions);
      const results = response.results;

      // Update progress as results come in
      completeProgress(0);

      // Count successes and failures
      const successCount = results.filter(r => r.ok).length;
      const failedCount = results.filter(r => !r.ok).length;

      // Show summary
      showBulkOperationSummary('Test Registration', results.map(r => ({
        domainId: r.domainId,
        domainName: r.domainName || 'Unknown',
        ok: r.ok,
        error: r.error,
      })));

      // Show individual errors (throttled)
      results.filter(r => !r.ok).forEach((result, index) => {
        if (index < 3) { // Show first 3 errors
          showBulkItemError('Test Registration', result.domainName || 'Unknown', result.error || 'Failed', { throttle: true });
        }
      });
    } catch (error: any) {
      completeProgress(domainIds.length);
      showActionErrorToast('Test Registration', error);
    }
  };

  const handleBulkRescan = async () => {
    if (!domainsData?.items) return;

    const allDomains = domainsData.items;
    startProgress('Bulk rescanning all domains...', allDomains.length);

    let errorCount = 0;
    for (let i = 0; i < allDomains.length; i++) {
      const domain = allDomains[i];
      try {
        await api.scanDomains({ domainIds: [domain.id] });
        updateProgress(i + 1);
      } catch (error) {
        errorCount++;
        // Show throttled error toast for item
        showBulkItemError('Bulk Rescan', domain.name, error, { throttle: true });
        updateProgress(i + 1);
      }
    }

    completeProgress(errorCount);
    queryClient.invalidateQueries({ queryKey: ['domains'] });

    if (errorCount === 0) {
      toast.success(`Scanned ${allDomains.length} domains successfully`);
    } else {
      toast.warning(`Scanned with ${errorCount} errors`);
    }
  };

  const handleDiscoverDomains = async () => {
    try {
      setIsDiscovering(true);
      startProgress(t('domains.discovering'), 1);

      const result = await api.discoverDomains();

      completeProgress(0);
      queryClient.invalidateQueries({ queryKey: ['domains'] });

      toast.success(t('domains.discoveredResult', { discovered: result.totalDiscovered, created: result.totalCreated }));
    } catch (error: any) {
      completeProgress(1);
      showActionErrorToast(t('domains.discover'), error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleDomainClick = (domain: DomainWithServer) => {
    // Navigate to server detail page with domain pre-selected
    navigate(`/servers/${domain.serverId}?domain=${domain.name}`);
  };

  const toggleDomainSelection = (domainId: string) => {
    const newSelection = new Set(selectedDomains);
    if (newSelection.has(domainId)) {
      newSelection.delete(domainId);
    } else {
      newSelection.add(domainId);
    }
    setSelectedDomains(newSelection);
  };

  const toggleSelectAll = () => {
    if (!domainsData?.items) return;

    if (selectedDomains.size === domainsData.items.length) {
      setSelectedDomains(new Set());
    } else {
      setSelectedDomains(new Set(domainsData.items.map((d) => d.id)));
    }
  };

  // Toggle traffic sorting: null -> desc -> asc -> null (off)
  // Sorting is now done server-side across all pages
  const toggleTrafficSort = () => {
    setTrafficSort((prev) => {
      if (prev === null) return 'desc'; // First click: descending (highest first)
      if (prev === 'desc') return 'asc'; // Second click: ascending (lowest first)
      return null; // Third click: disable sorting
    });
    // Reset to page 1 when changing sort
    setPage(1);
  };

  // Domains are now sorted server-side, just use items directly
  const sortedDomains = domainsData?.items || [];

  const handleInsertTags = (domainId: string) => {
    const googleTag = (googleTagInputs[domainId] || '').trim();
    const conversion = (conversionInputs[domainId] || '').trim();

    if (!googleTag && !conversion) {
      toast.error('Enter Google Tag, Conversion, or both');
      return;
    }

    // Check if domain already has conversion - if so, we're replacing
    const domain = domainsData?.items.find(d => d.id === domainId);
    const replaceConversion = domain?.hasConversion === true;

    insertTagsMutation.mutate({
      id: domainId,
      googleTag: googleTag || undefined,
      conversion: conversion || undefined,
      replaceConversion,
    });
  };


  const handleAssignOperator = async (domainId: string, operatorId: string) => {
    // Check if multiple domains are selected and current domain is in selection
    if (selectedDomains.size > 1 && selectedDomains.has(domainId)) {
      // Fetch all selected domains from server (works across all pages)
      try {
        const allSelectedIds = Array.from(selectedDomains);
        const domainsFromServer = await api.lookupDomainsByIds(allSelectedIds);

        const selectedDomainsInfo = domainsFromServer.map(d => ({
          id: d.id,
          name: d.name,
          currentOwner: d.assignedOperator?.username || null,
        }));

        // Get operator name for display
        const newOwnerName = operatorId
          ? operators.find(op => op.id === operatorId)?.username || 'Unknown'
          : 'Unassigned';

        // Show bulk confirmation dialog
        setConfirmBulkOwnerChange({
          newOwnerId: operatorId || null,
          newOwnerName,
          domains: selectedDomainsInfo,
        });
      } catch (error: any) {
        toast.error(t('domains.failedLoadSelectedDomains') + ': ' + (error.message || t('common.unknownError')));
      }
      return;
    }

    // Single domain change
    assignOperatorMutation.mutate({
      domainId,
      operatorId: operatorId || null,
    });
  };

  const handleConfirmBulkOwnerChange = async () => {
    if (!confirmBulkOwnerChange) return;

    const { newOwnerId, newOwnerName, domains } = confirmBulkOwnerChange;

    // Update all domains owner
    let successCount = 0;
    let errorCount = 0;

    for (const domain of domains) {
      try {
        await assignOperatorMutation.mutateAsync({
          domainId: domain.id,
          operatorId: newOwnerId,
        });
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['domains'] });
    setConfirmBulkOwnerChange(null);
    setSelectedDomains(new Set());

    if (errorCount === 0) {
      toast.success(`Assigned ${successCount} domain(s) to ${newOwnerName}`);
    } else {
      toast.warning(`Assigned ${successCount} domain(s), ${errorCount} failed`);
    }
  };

  const handleReturnToPool = async () => {
    if (selectedDomains.size === 0) return;
    setConfirmReturnToPool(false);
    setReturningToPool(true);
    try {
      const domainIds = Array.from(selectedDomains);
      const result = await api.returnDomainsToPool(domainIds);
      toast.success(`Returned ${result.returnedCount} domain(s) to pool`);
      setSelectedDomains(new Set());
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to return domains to pool');
    } finally {
      setReturningToPool(false);
    }
  };

  const toggleExpanded = (domainId: string) => {
    setExpandedDomain(expandedDomain === domainId ? null : domainId);
  };

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, domainId: string) => {
    // Don't toggle if clicking on interactive elements
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('input, select, button, a');

    if (!isInteractive) {
      toggleExpanded(domainId);
    }
  };

  const getStatusColor = (status: DomainStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'INACTIVE':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'BANNED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Globe2 className="h-8 w-8" />
          Domains
        </h1>
        <p className="text-gray-400">Global view of all domains across all servers</p>
      </div>

      {/* Filters and Actions */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search domains, IPs, buyer tags, or owners..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DomainStatus | '')}
        >
          <option value="" className="bg-gray-900 text-white">{t('domains.allStatus')}</option>
          <option value="ACTIVE" className="bg-gray-900 text-green-400">✓ {t('domains.activeStatus')}</option>
          <option value="INACTIVE" className="bg-gray-900 text-gray-400">○ {t('domains.inactiveStatus')}</option>
          <option value="BANNED" className="bg-gray-900 text-red-400">✕ {t('domains.bannedStatus')}</option>
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value as 'true' | 'false' | '')}
        >
          <option value="" className="bg-gray-900 text-white">{t('domains.allTags')}</option>
          <option value="true" className="bg-gray-900 text-green-400">✓ {t('domains.tagInstalled')}</option>
          <option value="false" className="bg-gray-900 text-gray-400">○ {t('domains.tagMissing')}</option>
        </select>

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={conversionFilter}
          onChange={(e) => setConversionFilter(e.target.value as 'true' | 'false' | '')}
        >
          <option value="" className="bg-gray-900 text-white">{t('domains.allConversions')}</option>
          <option value="true" className="bg-gray-900 text-green-400">✓ {t('domains.conversionInstalled')}</option>
          <option value="false" className="bg-gray-900 text-gray-400">○ {t('domains.conversionMissing')}</option>
        </select>

        {isAdmin() && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={ownerFilter}
            onChange={(e) => { setOwnerFilter(e.target.value); setPage(1); }}
          >
            <option value="" className="bg-gray-900 text-white">{t('domains.allOwners')}</option>
            <option value="unassigned" className="bg-gray-900 text-gray-400">{t('domains.unassigned')}</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id} className="bg-gray-900 text-white">{op.username}</option>
            ))}
          </select>
        )}

        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={reviewFilter}
          onChange={(e) => { setReviewFilter(e.target.value as any); setPage(1); }}
        >
          <option value="" className="bg-gray-900 text-white">{t('domains.reviewAll')}</option>
          <option value="overdue" className="bg-gray-900 text-red-400">{t('domains.reviewOverdue')}</option>
          <option value="due_soon" className="bg-gray-900 text-amber-400">{t('domains.reviewDueSoon')}</option>
          <option value="ok" className="bg-gray-900 text-green-400">{t('domains.reviewOk')}</option>
        </select>

        <Button
          variant="outline"
          onClick={handleDiscoverDomains}
          disabled={isDiscovering}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isDiscovering ? 'animate-spin' : ''}`} />
          {t('domains.discover')}
        </Button>

        <Button
          variant="outline"
          onClick={handleBulkRescan}
          disabled={scanMutation.isPending}
        >
          <Scan className={`mr-2 h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          {t('domains.bulkRescanAll')}
        </Button>

        <Button
          variant="outline"
          onClick={() => refreshTrafficMutation.mutate()}
          disabled={refreshTrafficMutation.isPending}
          title={t('domains.refreshTraffic')}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshTrafficMutation.isPending ? 'animate-spin' : ''}`} />
          {t('domains.refreshTraffic')}
        </Button>

        {selectedDomains.size > 0 && (
          <>
            <Button
              onClick={handleScanSelected}
              disabled={scanMutation.isPending}
            >
              <Scan className={`mr-2 h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
              Rescan Selected ({selectedDomains.size})
            </Button>
            <Button
              variant="outline"
              onClick={() => setPingThanksMode('bulk')}
            >
              <Globe2 className="mr-2 h-4 w-4" />
              Test Registration ({selectedDomains.size})
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                // Load all selected domains from server for display in modal
                try {
                  const allSelectedIds = Array.from(selectedDomains);
                  const domainsFromServer = await api.lookupDomainsByIds(allSelectedIds);
                  setBulkSelectedDomainsList(domainsFromServer.map(d => ({ id: d.id, name: d.name })));
                  setChangeOfferMode('bulk');
                } catch (error: any) {
                  toast.error(t('domains.failedLoadSelectedDomains') + ': ' + (error.message || t('common.unknownError')));
                }
              }}
            >
              <Package className="mr-2 h-4 w-4" />
              Change Offer ({selectedDomains.size})
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBulkEditOfferMeta(true)}
            >
              <Package className="mr-2 h-4 w-4" />
              Edit Metadata ({selectedDomains.size})
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeployCloak(true)}
              className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            >
              <Shield className="mr-2 h-4 w-4" />
              Deploy Cloak ({selectedDomains.size})
            </Button>
            <Button
              variant="outline"
              onClick={() => bulkReviewMutation.mutate(Array.from(selectedDomains))}
              disabled={bulkReviewMutation.isPending}
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${bulkReviewMutation.isPending ? 'animate-spin' : ''}`} />
              {t('domains.reviewBulkButton')} ({selectedDomains.size})
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setConfirmReturnToPool(true)}
                disabled={returningToPool}
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Return to Pool ({selectedDomains.size})
              </Button>
            )}
          </>
        )}
      </div>

      {/* Bulk Select Domains */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <button
            onClick={() => setShowBulkSelect(!showBulkSelect)}
            className="flex items-center gap-2 text-lg font-semibold text-white w-full"
          >
            <CheckSquare className="h-5 w-5 text-blue-400" />
            Bulk Select Domains
            {showBulkSelect ? (
              <ChevronUp className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-auto" />
            )}
          </button>

          {showBulkSelect && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Domain List
                  <span className="text-gray-500 text-xs ml-2">(One domain per line, e.g., example.com)</span>
                </label>
                <textarea
                  value={bulkSelectInput}
                  onChange={(e) => setBulkSelectInput(e.target.value)}
                  placeholder="example1.com&#10;example2.com&#10;example3.com"
                  className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <Button
                  onClick={handleBulkSelect}
                  disabled={!bulkSelectInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Select Domains
                </Button>

                <Button
                  onClick={async () => {
                    const lines = bulkSelectInput.split('\n');
                    const domainNames = lines
                      .map(line => line.trim().toLowerCase())
                      .filter(line => line.length > 0);

                    if (domainNames.length === 0) {
                      toast.error('Please enter at least one domain');
                      return;
                    }

                    setBulkBanFromSelectPending(true);
                    setBulkBanResult(null);

                    try {
                      const result = await api.bulkBanDomains({
                        domains: domainNames,
                        deletePalladiumCampaigns: true,
                      });

                      setBulkBanResult({
                        banned: result.banned,
                        notFound: result.notFound,
                        alreadyBanned: result.alreadyBanned,
                        errors: result.errors || [],
                      });

                      if (result.banned.length > 0) {
                        toast.success(`Banned ${result.banned.length} domain(s)`);
                      }
                      if (result.notFound.length > 0) {
                        toast.warning(`${result.notFound.length} domain(s) not found`);
                      }
                      if (result.errors.length > 0) {
                        toast.error(`${result.errors.length} domain(s) failed`);
                      }

                      queryClient.invalidateQueries({ queryKey: ['domains'] });
                    } catch (error: any) {
                      toast.error(`Failed to ban domains: ${error.message}`);
                    } finally {
                      setBulkBanFromSelectPending(false);
                    }
                  }}
                  disabled={!bulkSelectInput.trim() || bulkBanFromSelectPending}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {bulkBanFromSelectPending ? 'Banning...' : 'Ban Domains'}
                </Button>

                {bulkSelectInput.trim() && (
                  <span className="text-sm text-gray-400">
                    {bulkSelectInput.split('\n').filter(l => l.trim()).length} domain(s) to process
                  </span>
                )}

                {selectedDomains.size > 0 && (
                  <Button
                    onClick={() => {
                      setSelectedDomains(new Set());
                      toast.success('Selection cleared');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Clear Selection ({selectedDomains.size})
                  </Button>
                )}
              </div>

              {/* Selection Results Display */}
              {bulkSelectResult && (
                <div className="mt-4 p-4 bg-gray-800 rounded-md border border-gray-700 space-y-3">
                  <h3 className="text-sm font-semibold text-white">Selection Summary</h3>

                  {bulkSelectResult.found.length > 0 && (
                    <div className="text-sm">
                      <span className="text-green-400 font-medium">✓ Found & Selected:</span>
                      <span className="text-gray-300 ml-2">{bulkSelectResult.found.length} domain(s)</span>
                      <div className="ml-4 mt-1 text-gray-400 max-h-32 overflow-y-auto">
                        {bulkSelectResult.found.map((domain, idx) => (
                          <div key={idx} className="text-xs text-green-300">• {domain}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bulkSelectResult.notFound.length > 0 && (
                    <div className="text-sm">
                      <span className="text-orange-400 font-medium">⚠ Not Found:</span>
                      <span className="text-gray-300 ml-2">{bulkSelectResult.notFound.length} domain(s)</span>
                      <div className="ml-4 mt-1 text-gray-400 max-h-32 overflow-y-auto">
                        {bulkSelectResult.notFound.map((domain, idx) => (
                          <div key={idx} className="text-xs text-orange-300">• {domain}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm pt-2 border-t border-gray-700">
                    <span className="text-blue-400 font-medium">Total Selected:</span>
                    <span className="text-white ml-2 text-lg font-bold">{bulkSelectResult.selected}</span>
                    <span className="text-gray-400 ml-2">domain(s)</span>
                  </div>
                </div>
              )}

              {/* Ban Results Display */}
              {bulkBanResult && (
                <div className="mt-4 p-4 bg-gray-800 rounded-md border border-red-700 space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-400" />
                    Ban Results
                  </h3>

                  <div className="text-sm space-y-2">
                    {bulkBanResult.banned.length > 0 && (
                      <div className="text-sm">
                        <span className="text-green-400 font-medium">✓ Banned:</span>
                        <span className="text-gray-300 ml-2">{bulkBanResult.banned.length} domain(s)</span>
                        <div className="ml-4 mt-1 max-h-24 overflow-y-auto">
                          {bulkBanResult.banned.map((domain, idx) => (
                            <div key={idx} className="text-xs text-green-300">• {domain}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {bulkBanResult.alreadyBanned.length > 0 && (
                      <div className="text-sm">
                        <span className="text-yellow-400 font-medium">⚠ Already Banned:</span>
                        <span className="text-gray-300 ml-2">{bulkBanResult.alreadyBanned.length} domain(s)</span>
                        <div className="ml-4 mt-1 max-h-24 overflow-y-auto">
                          {bulkBanResult.alreadyBanned.map((domain, idx) => (
                            <div key={idx} className="text-xs text-yellow-300">• {domain}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {bulkBanResult.notFound.length > 0 && (
                      <div className="text-sm">
                        <span className="text-orange-400 font-medium">⚠ Not Found:</span>
                        <span className="text-gray-300 ml-2">{bulkBanResult.notFound.length} domain(s)</span>
                        <div className="ml-4 mt-1 max-h-24 overflow-y-auto">
                          {bulkBanResult.notFound.map((domain, idx) => (
                            <div key={idx} className="text-xs text-orange-300">• {domain}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {bulkBanResult.errors.length > 0 && (
                      <div className="text-sm">
                        <span className="text-red-400 font-medium">✗ Errors:</span>
                        <span className="text-gray-300 ml-2">{bulkBanResult.errors.length} domain(s)</span>
                        <div className="ml-4 mt-1 max-h-24 overflow-y-auto">
                          {bulkBanResult.errors.map((err, idx) => (
                            <div key={idx} className="text-xs text-red-300">• {err.domain}: {err.error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => setBulkBanResult(null)}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Clear Results
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="text-gray-400">Loading domains...</div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="bg-card">
                      <th className="p-4 text-left">
                        <input
                          type="checkbox"
                          checked={
                            domainsData?.items &&
                            selectedDomains.size === domainsData.items.length &&
                            domainsData.items.length > 0
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-input"
                        />
                      </th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Domain</th>
                      {isAdmin() && <th className="p-4 text-left text-sm font-semibold text-white">Server IP</th>}
                      {isAdmin() && <th className="p-4 text-left text-sm font-semibold text-white">Owner</th>}
                      <th className="p-4 text-left text-sm font-semibold text-white">Status</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Buyer Tag</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Geo</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Offer Name</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">{t('domains.reviewColumn')}</th>
                      <th
                        className="p-4 text-left text-sm font-semibold text-white cursor-pointer hover:bg-gray-700 select-none"
                        onClick={toggleTrafficSort}
                        title="Click to sort by target traffic"
                      >
                        <div className="flex items-center gap-1">
                          Traffic
                          {trafficSort === 'desc' && <ChevronDown className="h-4 w-4" />}
                          {trafficSort === 'asc' && <ChevronUp className="h-4 w-4" />}
                          {trafficSort === null && <span className="text-gray-500 text-xs ml-1">↕</span>}
                        </div>
                      </th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Cloak</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Tag</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Conversion</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">{t('domains.health')}</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Last Scanned</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Actions</th>
                      <th className="p-4 text-left text-sm font-semibold text-white">Expand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDomains.map((domain) => (
                      <React.Fragment key={domain.id}>
                        <tr
                          className="border-b hover:bg-accent transition-colors cursor-pointer"
                          onClick={(e) => handleRowClick(e, domain.id)}
                        >
                          <td className="p-4">
                            <input
                                type="checkbox"
                                checked={selectedDomains.has(domain.id)}
                                onChange={() => toggleDomainSelection(domain.id)}
                                className="accent-[hsl(var(--primary))] rounded border-input"
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`https://${domain.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-white hover:text-primary transition-colors text-left"
                              >
                                {domain.name}
                              </a>
                              {isAdmin() && (domain.inPool || domain.claimedFromPool) && (
                                <span
                                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${
                                    domain.inPool
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                  }`}
                                  title={domain.inPool ? 'In pool (available for claim)' : 'Claimed from pool'}
                                >
                                  {domain.inPool ? 'In Pool' : 'Pool'}
                                </span>
                              )}
                            </div>
                          </td>
                          {isAdmin() && <td className="p-4 text-sm text-gray-400">{domain.server.ip}</td>}
                          {isAdmin() && (
                            <td className="p-4">
                              <select
                                className="h-7 rounded-md border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={domain.assignedOperatorId || ''}
                                onChange={(e) => handleAssignOperator(domain.id, e.target.value)}
                                disabled={assignOperatorMutation.isPending}
                              >
                                <option value="">Unassigned</option>
                                {operators.map((op) => (
                                  <option key={op.id} value={op.id}>
                                    {op.username}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          <td className="p-4">
                            <select
                              className={`h-7 rounded-md border px-2 py-0.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${getStatusColor(domain.status)}`}
                              value={domain.status}
                              onChange={(e) => handleStatusChange(domain.id, e.target.value as DomainStatus)}
                              disabled={updateStatusMutation.isPending}
                            >
                              <option value="ACTIVE" className="bg-gray-900 text-green-400">Active</option>
                              <option value="INACTIVE" className="bg-gray-900 text-gray-400">Inactive</option>
                              <option value="BANNED" className="bg-gray-900 text-red-400">Banned</option>
                            </select>
                          </td>
                          <td className="p-4 text-sm text-gray-300">
                            {domain.buyerTag || <span className="text-gray-500">—</span>}
                          </td>
                          <td className="p-4 text-sm text-gray-300">
                            {domain.geo || <span className="text-gray-500">—</span>}
                          </td>
                          <td className="p-4 text-sm text-gray-300">
                            {domain.offerName ? (
                              <span
                                className="max-w-[200px] truncate inline-block"
                                title={domain.offerName}
                              >
                                {domain.offerName}
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="p-4 text-sm">
                            {(() => {
                              if (!domain.reviewDeadline) return <span className="text-gray-500 text-xs">—</span>;
                              const now = new Date();
                              const deadline = new Date(domain.reviewDeadline);
                              const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                              if (daysLeft < 0) {
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center rounded bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 text-[10px] font-medium">
                                      {Math.abs(daysLeft)}d overdue
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); reviewDomainMutation.mutate(domain.id); }}
                                      className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline"
                                      title={t('domains.reviewButton')}
                                    >
                                      {t('domains.reviewButton')}
                                    </button>
                                  </div>
                                );
                              }
                              return <span className="text-gray-500 text-xs">{daysLeft}d</span>;
                            })()}
                          </td>
                          <td className="p-4 text-xs">
                            {domain.palladiumCampaignId ? (
                              // Use DB values (from domain) or fallback to campaignStats for live data
                              <div className="flex flex-col gap-0.5" title="Total / Unique traffic">
                                <span className="text-green-400">T: {domain.targetTraffic || campaignStats[domain.palladiumCampaignId]?.targetTraffic || 0}/{domain.targetUniqueTraffic || campaignStats[domain.palladiumCampaignId]?.targetUniqueTraffic || 0}</span>
                                <span className="text-red-400">B: {domain.botTotalTraffic || campaignStats[domain.palladiumCampaignId]?.botTotalTraffic || 0}/{domain.botTraffic || campaignStats[domain.palladiumCampaignId]?.botTraffic || 0}</span>
                              </div>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center">
                              <span
                                className={`h-3 w-3 rounded-full inline-block ${domain.palladiumCampaignId ? 'bg-green-500' : 'bg-gray-500'}`}
                                title={domain.palladiumCampaignId ? `Campaign: ${domain.palladiumCampaignId}` : 'No cloak'}
                                aria-label={domain.palladiumCampaignId ? 'Has cloak' : 'No cloak'}
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center">
                              <span
                                className={`h-3 w-3 rounded-full inline-block ${domain.hasTag ? 'bg-green-500' : 'bg-gray-500'}`}
                                title={domain.hasTag ? 'Installed' : 'Missing'}
                                aria-label={domain.hasTag ? 'Installed' : 'Missing'}
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center">
                              <span
                                className={`h-3 w-3 rounded-full inline-block ${domain.hasConversion ? 'bg-green-500' : 'bg-gray-500'}`}
                                title={domain.hasConversion ? 'Installed' : 'Missing'}
                                aria-label={domain.hasConversion ? 'Installed' : 'Missing'}
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center">
                              <HealthDotPopover
                                domainId={domain.id}
                                healthStatus={domain.healthStatus}
                                dnsBlockedCountries={domain.dnsBlockedCountries}
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            {domain.lastScannedAt ? (
                              <div className="flex flex-col leading-tight">
                                <span className="text-xs text-gray-300">{formatDateOnly(domain.lastScannedAt)}</span>
                                <span className="text-xs text-gray-400">{formatTimeOnly(domain.lastScannedAt)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">Never</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const palladiumGeo = domain.palladiumCampaignGeo
                                    ? (typeof domain.palladiumCampaignGeo === 'string'
                                      ? JSON.parse(domain.palladiumCampaignGeo)
                                      : domain.palladiumCampaignGeo)
                                    : [];
                                  setEditMetaDomain({
                                    id: domain.id,
                                    name: domain.name,
                                    currentBuyerTag: domain.buyerTag || '',
                                    currentGeo: domain.geo || '',
                                    currentOffer: domain.offerName || '',
                                    palladiumCampaignId: domain.palladiumCampaignId || null,
                                    currentPalladiumGeo: palladiumGeo,
                                  });
                                  setBuyerTagInput(domain.buyerTag || '');
                                  setGeoInput(domain.geo || '');
                                  setOfferInput(domain.offerName || '');
                                  setPalladiumGeoInput(palladiumGeo);
                                }}
                                disabled={editBuyerTagMutation.isPending || editGeoMutation.isPending || editOfferMutation.isPending}
                                title="Edit Metadata"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setChangeOfferMode('single');
                                  setChangeOfferDomain({
                                    id: domain.id,
                                    name: domain.name,
                                  });
                                }}
                                disabled={changeOfferMutation.isPending}
                                title="Change Offer"
                              >
                                <Package className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => scanMutation.mutate([domain.id])}
                                disabled={scanMutation.isPending}
                                title="Scan"
                              >
                                <Scan className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpanded(domain.id)}
                            >
                              {expandedDomain === domain.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded Google Tags Section */}
                        {expandedDomain === domain.id && (
                          <tr key={`${domain.id}-expanded`} className="border-b bg-card/50">
                            <td colSpan={isAdmin() ? 16 : 14} className="p-6">
                              <div className="space-y-6">
                                {/* Cloak Info Section */}
                                <div className="border-b border-gray-700 pb-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Shield className="h-5 w-5 text-primary" />
                                    <h3 className="text-lg font-semibold text-white">Cloak (Palladium)</h3>
                                  </div>
                                  {domain.palladiumCampaignId ? (
                                    <div className="space-y-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-400 w-24">Campaign ID:</span>
                                        <span className="text-white font-mono">{domain.palladiumCampaignId}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-400 w-24">Geo:</span>
                                        <div className="flex items-center gap-1">
                                          {domain.palladiumCampaignGeo ? (
                                            JSON.parse(domain.palladiumCampaignGeo).map((code: string) => (
                                              <span
                                                key={code}
                                                className="text-lg"
                                                title={code}
                                              >
                                                {countryCodeToFlag(code)}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-gray-500">—</span>
                                          )}
                                        </div>
                                      </div>
                                      {isAdmin() && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-400 w-24">Offer Path:</span>
                                          <span className="text-white font-mono text-xs">
                                            /var/www/{domain.name}/{domain.offerFolder || 'product'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500 text-sm">No cloak configured for this domain</p>
                                  )}
                                </div>

                                {/* Google Tag Section */}
                                <div className="flex items-center gap-2 mb-4">
                                  <Code className="h-5 w-5 text-primary" />
                                  <h3 className="text-lg font-semibold text-white">Google Tag & Conversion</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                      Google Tag
                                    </label>
                                    <textarea
                                      className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm text-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                                      placeholder="<!-- Google tag (gtag.js) -->&#10;<script async src=&quot;https://www.googletagmanager.com/gtag/js?id=AW-...&quot;></script>&#10;..."
                                      value={googleTagInputs[domain.id] || domain.googleTag || ''}
                                      onChange={(e) =>
                                        setGoogleTagInputs({ ...googleTagInputs, [domain.id]: e.target.value })
                                      }
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                      Conversion
                                    </label>
                                    <textarea
                                      className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm text-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                                      placeholder="<!-- Event snippet for conversion page -->&#10;<script>&#10;  gtag('event', 'conversion', {...});&#10;</script>"
                                      value={conversionInputs[domain.id] || domain.conversion || ''}
                                      onChange={(e) =>
                                        setConversionInputs({ ...conversionInputs, [domain.id]: e.target.value })
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-between items-center">
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setPingThanksDomain({ id: domain.id, name: domain.name });
                                        setPingThanksMode('single');
                                      }}
                                      title="Send test registration to core.php"
                                    >
                                      Test Registration
                                    </Button>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setExpandedDomain(null);
                                        setGoogleTagInputs({});
                                        setConversionInputs({});
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => handleInsertTags(domain.id)}
                                      disabled={
                                        insertTagsMutation.isPending ||
                                        (!googleTagInputs[domain.id]?.trim() && !conversionInputs[domain.id]?.trim())
                                      }
                                    >
                                      {insertTagsMutation.isPending ? 'Processing...'
                                        : googleTagInputs[domain.id]?.trim() && conversionInputs[domain.id]?.trim()
                                          ? (domain.hasTag ? 'Replace Tags' : 'Insert Tags')
                                          : conversionInputs[domain.id]?.trim()
                                            ? (domain.hasConversion ? 'Replace Conversion' : 'Insert Conversion')
                                            : (domain.hasTag ? 'Replace Tag' : 'Insert Tag')
                                      }
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Traffic Stats Summary */}
              {domainsData && domainsData.items.length > 0 && (() => {
                // Calculate total traffic for current page (use DB values or fallback to campaignStats)
                const pageTrafficStats = sortedDomains.reduce(
                  (acc, domain) => {
                    if (domain.palladiumCampaignId) {
                      acc.totalTarget += domain.targetTraffic || 0;
                      acc.totalTargetUnique += domain.targetUniqueTraffic || 0;
                      acc.totalBotTotal += domain.botTotalTraffic || 0;
                      acc.totalBot += domain.botTraffic || 0;
                    }
                    return acc;
                  },
                  { totalTarget: 0, totalTargetUnique: 0, totalBotTotal: 0, totalBot: 0 }
                );

                return (
                  <div className="flex items-center justify-center gap-6 border-t bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Page Traffic:</span>
                      <span className="font-semibold text-green-500">
                        Target: {pageTrafficStats.totalTarget.toLocaleString()}/{pageTrafficStats.totalTargetUnique.toLocaleString()}
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className="font-semibold text-red-500">
                        Bot: {pageTrafficStats.totalBotTotal.toLocaleString()}/{pageTrafficStats.totalBot.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}
              {/* Total Traffic across all pages — always visible */}
              <div className="flex items-center justify-center gap-6 border-t border-gray-700 p-3 bg-gray-800/60">
                {totalTrafficData ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {isAdmin() ? 'Total — All Domains' : 'Total — All Your Domains'} ({totalTrafficData.totalDomains.toLocaleString()}):
                    </span>
                    <span className="font-bold text-green-400">
                      Target: {totalTrafficData.totalTarget.toLocaleString()}/{totalTrafficData.totalTargetUnique.toLocaleString()}
                    </span>
                    <span className="text-gray-500">|</span>
                    <span className="font-bold text-red-400">
                      Bot: {totalTrafficData.totalBotTotal.toLocaleString()}/{totalTrafficData.totalBot.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Loading total traffic...</span>
                )}
              </div>

              {/* Pagination */}
              {domainsData && (() => {
                const totalPages = Math.ceil(domainsData.total / domainsData.pageSize);
                return totalPages > 1 && (
                  <div className="flex items-center justify-between border-t p-4">
                    <div className="text-sm text-gray-400">
                      Showing {(page - 1) * limit + 1} to{' '}
                      {Math.min(page * limit, domainsData.total)} of {domainsData.total} domains
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-white">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {domainsData?.items.length === 0 && (
            <div className="mt-8 text-center text-gray-400">
              <Globe2 className="mx-auto h-12 w-12 opacity-20" />
              <p className="mt-4">{t('domains.noDomains')}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleDiscoverDomains}
                disabled={isDiscovering}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('domains.discoverDomains')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Domain Metadata Modal (Buyer Tag, GEO, Offer Name, Palladium GEO) */}
      <Dialog open={!!editMetaDomain} onOpenChange={(open) => {
        if (!open) {
          setEditMetaDomain(null);
          setBuyerTagInput('');
          setGeoInput('');
          setOfferInput('');
          setPalladiumGeoInput([]);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Domain Metadata</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* Buyer Tag */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  Buyer Tag
                </label>
                {editMetaDomain?.currentBuyerTag && (
                  <span className="text-xs text-muted-foreground">
                    Current: {editMetaDomain.currentBuyerTag}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={buyerTagInput}
                  onChange={(e) => setBuyerTagInput(e.target.value)}
                  placeholder="Enter buyer tag (e.g., dma1)"
                  disabled={editBuyerTagMutation.isPending}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => editMetaDomain && editBuyerTagMutation.mutate({
                    id: editMetaDomain.id,
                    buyerTag: buyerTagInput
                  })}
                  disabled={editBuyerTagMutation.isPending || !buyerTagInput.trim()}
                >
                  {editBuyerTagMutation.isPending ? '...' : 'Save'}
                </Button>
              </div>
            </div>

            {/* GEO */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  GEO (Country Code)
                </label>
                {editMetaDomain?.currentGeo && (
                  <span className="text-xs text-muted-foreground">
                    Current: {editMetaDomain.currentGeo}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={geoInput}
                  onChange={(e) => setGeoInput(e.target.value)}
                  placeholder="Enter geo value (e.g., lv, cz, ee)"
                  disabled={editGeoMutation.isPending}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => editMetaDomain && editGeoMutation.mutate({
                    id: editMetaDomain.id,
                    geo: geoInput
                  })}
                  disabled={editGeoMutation.isPending || !geoInput.trim()}
                >
                  {editGeoMutation.isPending ? '...' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Offer Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  Offer Name
                </label>
                {editMetaDomain?.currentOffer && (
                  <span className="text-xs text-muted-foreground">
                    Current: {editMetaDomain.currentOffer}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value)}
                  placeholder="Enter offer name (e.g., Latvian Invest Native)"
                  disabled={editOfferMutation.isPending}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => editMetaDomain && editOfferMutation.mutate({
                    id: editMetaDomain.id,
                    offerName: offerInput
                  })}
                  disabled={editOfferMutation.isPending || !offerInput.trim()}
                >
                  {editOfferMutation.isPending ? '...' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Palladium GEO - only show if domain has a campaign */}
            {editMetaDomain?.palladiumCampaignId && (
              <div className="space-y-3 border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-500" />
                    Palladium Cloak GEO
                  </label>
                  {editMetaDomain?.currentPalladiumGeo?.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Current: {editMetaDomain.currentPalladiumGeo.join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Update which countries are targeted in the Palladium cloak campaign.
                </p>

                {/* Quick select countries */}
                <div className="flex flex-wrap gap-1.5">
                  {['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'PL', 'CZ'].map((country) => {
                    const isSelected = palladiumGeoInput.includes(country);
                    return (
                      <button
                        key={country}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setPalladiumGeoInput(prev => prev.filter(c => c !== country));
                          } else {
                            setPalladiumGeoInput(prev => [...prev, country]);
                          }
                        }}
                        disabled={updatePalladiumGeoMutation.isPending}
                        className={`
                          px-2 py-1 rounded text-xs font-medium transition-colors
                          ${isSelected
                            ? 'bg-purple-500 text-white hover:bg-purple-600'
                            : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        {country}
                      </button>
                    );
                  })}
                </div>

                {/* Custom country input */}
                <Input
                  type="text"
                  placeholder="Add custom code (press Enter)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget.value.trim().toUpperCase();
                      if (input && !palladiumGeoInput.includes(input)) {
                        setPalladiumGeoInput(prev => [...prev, input]);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                  disabled={updatePalladiumGeoMutation.isPending}
                  className="text-sm"
                />

                {/* Selected countries with remove option */}
                {palladiumGeoInput.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Selected:</span>
                    <div className="flex flex-wrap gap-1">
                      {palladiumGeoInput.map((country) => (
                        <span
                          key={country}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs"
                        >
                          {country}
                          <button
                            type="button"
                            onClick={() => setPalladiumGeoInput(prev => prev.filter(c => c !== country))}
                            className="hover:text-purple-900 dark:hover:text-purple-100"
                            disabled={updatePalladiumGeoMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save button */}
                <Button
                  size="sm"
                  onClick={() => editMetaDomain && updatePalladiumGeoMutation.mutate({
                    id: editMetaDomain.id,
                    countries: palladiumGeoInput
                  })}
                  disabled={updatePalladiumGeoMutation.isPending || palladiumGeoInput.length === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {updatePalladiumGeoMutation.isPending ? 'Updating...' : `Save Palladium GEO (${palladiumGeoInput.length})`}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditMetaDomain(null);
                setBuyerTagInput('');
                setGeoInput('');
                setOfferInput('');
                setPalladiumGeoInput([]);
              }}
              disabled={editBuyerTagMutation.isPending || editGeoMutation.isPending || editOfferMutation.isPending || updatePalladiumGeoMutation.isPending}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Return to Pool Confirmation Modal */}
      <Dialog open={confirmReturnToPool} onOpenChange={setConfirmReturnToPool}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Domains to Pool</DialogTitle>
            <DialogDescription>
              This will return {selectedDomains.size} selected domain(s) to the claim pool.
              <br /><br />
              Domains will be <strong>unassigned</strong> from their current operators and become available for claiming. Buyer tags will be cleared.
              <br /><br />
              Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmReturnToPool(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReturnToPool}
              disabled={returningToPool}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Return to Pool ({selectedDomains.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Domain with Campaign Confirmation Modal */}
      <Dialog open={!!confirmBanWithCampaign} onOpenChange={(open) => !open && setConfirmBanWithCampaign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban Domain with Palladium Campaign</DialogTitle>
            <DialogDescription>
              Domain <strong>{confirmBanWithCampaign?.domainName}</strong> has an active Palladium campaign (ID: <strong>{confirmBanWithCampaign?.campaignId}</strong>).
              <br /><br />
              <span className="text-green-500">✓ Campaign found and will be deleted</span>
              <br /><br />
              This will:
              <br />
              1. Delete the Palladium campaign via API
              <br />
              2. Set the domain status to BANNED
              <br /><br />
              Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmBanWithCampaign(null)}
              disabled={deleteCampaignMutation.isPending || updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBanWithCampaign}
              disabled={deleteCampaignMutation.isPending || updateStatusMutation.isPending}
            >
              {deleteCampaignMutation.isPending || updateStatusMutation.isPending ? 'Processing...' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Change Confirmation Modal */}
      <Dialog open={!!confirmBulkStatusChange} onOpenChange={(open) => !open && setConfirmBulkStatusChange(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Change Status to {confirmBulkStatusChange?.newStatus}
            </DialogTitle>
            <DialogDescription>
              You are about to change the status of {confirmBulkStatusChange?.domains.length} selected domain(s).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0 select-none">
                  <tr>
                    <th className="text-left p-2 text-gray-300">Domain</th>
                    <th className="text-left p-2 text-gray-300">Current</th>
                    <th className="text-left p-2 text-gray-300">New</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmBulkStatusChange?.domains.map((domain) => (
                    <tr key={domain.id} className="border-t border-gray-700">
                      <td className="p-2 text-white">{domain.name}</td>
                      <td className="p-2 select-none">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          domain.currentStatus === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                          domain.currentStatus === 'BANNED' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {domain.currentStatus}
                        </span>
                      </td>
                      <td className="p-2 select-none">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          confirmBulkStatusChange.newStatus === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                          confirmBulkStatusChange.newStatus === 'BANNED' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {confirmBulkStatusChange.newStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {confirmBulkStatusChange?.newStatus === 'BANNED' && (
              <p className="mt-3 text-sm text-yellow-400">
                ⚠️ Domains with Palladium campaigns will have their campaigns deleted automatically.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmBulkStatusChange(null)}
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBulkStatusChange}
              disabled={updateStatusMutation.isPending}
              className={
                confirmBulkStatusChange?.newStatus === 'BANNED' ? 'bg-red-600 hover:bg-red-700' :
                confirmBulkStatusChange?.newStatus === 'ACTIVE' ? 'bg-green-600 hover:bg-green-700' :
                ''
              }
            >
              {updateStatusMutation.isPending ? 'Processing...' : `Change to ${confirmBulkStatusChange?.newStatus}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Owner Change Confirmation Modal */}
      <Dialog open={!!confirmBulkOwnerChange} onOpenChange={(open) => !open && setConfirmBulkOwnerChange(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Change Owner to {confirmBulkOwnerChange?.newOwnerName}
            </DialogTitle>
            <DialogDescription>
              You are about to change the owner of {confirmBulkOwnerChange?.domains.length} selected domain(s).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0 select-none">
                  <tr>
                    <th className="text-left p-2 text-gray-300">Domain</th>
                    <th className="text-left p-2 text-gray-300">Current Owner</th>
                    <th className="text-left p-2 text-gray-300">New Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmBulkOwnerChange?.domains.map((domain) => (
                    <tr key={domain.id} className="border-t border-gray-700">
                      <td className="p-2 text-white">{domain.name}</td>
                      <td className="p-2 select-none">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          domain.currentOwner ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {domain.currentOwner || 'Unassigned'}
                        </span>
                      </td>
                      <td className="p-2 select-none">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          confirmBulkOwnerChange.newOwnerId ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {confirmBulkOwnerChange.newOwnerName}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmBulkOwnerChange(null)}
              disabled={assignOperatorMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBulkOwnerChange}
              disabled={assignOperatorMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assignOperatorMutation.isPending ? 'Processing...' : `Assign to ${confirmBulkOwnerChange?.newOwnerName}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Registration Modal */}
      <Dialog
        open={!!pingThanksMode}
        onOpenChange={(open) => {
          if (!open) {
            setPingThanksMode(null);
            setPingThanksDomain(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pingThanksMode === 'single' ? `Test Registration: ${pingThanksDomain?.name}` : `Test Registration (${selectedDomains.size} domains)`}
            </DialogTitle>
            <DialogDescription>
              Send test lead to core.php or HTTP ping to any path
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Protocol */}
              <div>
                <label className="text-sm font-medium text-gray-200">Protocol</label>
                <select
                  className="w-full mt-1 bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2"
                  value={pingThanksOptions.protocol}
                  onChange={(e) => setPingThanksOptions({ ...pingThanksOptions, protocol: e.target.value as 'https' | 'http' })}
                >
                  <option value="https">https</option>
                  <option value="http">http</option>
                </select>
              </div>

              {/* Method */}
              <div>
                <label className="text-sm font-medium text-gray-200">Method</label>
                <select
                  className="w-full mt-1 bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2"
                  value={pingThanksOptions.method || 'GET'}
                  onChange={(e) => {
                    const method = e.target.value as 'GET' | 'POST';
                    setPingThanksOptions({
                      ...pingThanksOptions,
                      method,
                      formData: method === 'POST' && !pingThanksOptions.formData ? generateTestLeadData() : pingThanksOptions.formData,
                    });
                  }}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
            </div>

            {/* Path */}
            <div>
              <label className="text-sm font-medium text-gray-200">Path</label>
              <Input
                className="mt-1"
                value={pingThanksOptions.path}
                onChange={(e) => setPingThanksOptions({ ...pingThanksOptions, path: e.target.value })}
                placeholder="product/core.php"
              />
            </div>

            {/* Query String — only for GET */}
            {pingThanksOptions.method !== 'POST' && (
              <div>
                <label className="text-sm font-medium text-gray-200">Query String</label>
                <Input
                  className="mt-1"
                  value={pingThanksOptions.query}
                  onChange={(e) => setPingThanksOptions({ ...pingThanksOptions, query: e.target.value })}
                  placeholder="simple_test=1&token=11123"
                />
              </div>
            )}

            {/* Form Data — only for POST */}
            {pingThanksOptions.method === 'POST' && pingThanksOptions.formData && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-200">Test Lead Data</label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setPingThanksOptions({ ...pingThanksOptions, formData: generateTestLeadData() })}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Regenerate
                  </Button>
                </div>
                {Object.entries(pingThanksOptions.formData).map(([key, value]) => (
                  <div key={key} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-16 shrink-0 text-right">{key}</span>
                    <Input
                      className="flex-1 h-8 text-sm"
                      value={value}
                      onChange={(e) => setPingThanksOptions({
                        ...pingThanksOptions,
                        formData: { ...pingThanksOptions.formData, [key]: e.target.value },
                      })}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Timeout */}
              <div>
                <label className="text-sm font-medium text-gray-200">Timeout (ms)</label>
                <Input
                  className="mt-1"
                  type="number"
                  value={pingThanksOptions.timeout}
                  onChange={(e) => setPingThanksOptions({ ...pingThanksOptions, timeout: parseInt(e.target.value) || 10000 })}
                  placeholder="10000"
                />
              </div>

              {/* Retries */}
              <div>
                <label className="text-sm font-medium text-gray-200">Retries</label>
                <Input
                  className="mt-1"
                  type="number"
                  value={pingThanksOptions.retries}
                  onChange={(e) => setPingThanksOptions({ ...pingThanksOptions, retries: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPingThanksMode(null);
                setPingThanksDomain(null);
              }}
              disabled={pingThanksMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pingThanksMode === 'single' && pingThanksDomain) {
                  pingThanksMutation.mutate(pingThanksDomain.id);
                } else if (pingThanksMode === 'bulk') {
                  handlePingThanksSelected();
                }
              }}
              disabled={pingThanksMutation.isPending}
            >
              {pingThanksMutation.isPending ? 'Sending...' : (pingThanksMode === 'single' ? 'Send' : `Send (${selectedDomains.size} domains)`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Offer Modal */}
      <ChangeOfferModal
        mode={changeOfferMode === 'single' ? 'single' : 'bulk'}
        domainId={changeOfferDomain?.id}
        domainName={changeOfferDomain?.name}
        domainIds={Array.from(selectedDomains)}
        domains={
          changeOfferMode === 'single' && changeOfferDomain
            ? [{ id: changeOfferDomain.id, name: changeOfferDomain.name }]
            : bulkSelectedDomainsList
        }
        domainCount={selectedDomains.size}
        isOpen={!!changeOfferMode}
        onClose={() => {
          setChangeOfferMode(null);
          setChangeOfferDomain(null);
          setBulkSelectedDomainsList([]);
        }}
        onConfirm={(offerId, buyerTag, palladiumOptions) => {
          if (changeOfferMode === 'single' && changeOfferDomain) {
            changeOfferMutation.mutate({ id: changeOfferDomain.id, offerId, buyerTag, palladiumOptions });
          } else if (changeOfferMode === 'bulk') {
            changeOfferBulkMutation.mutate({ domainIds: Array.from(selectedDomains), offerId, buyerTag, palladiumOptions });
          }
        }}
        isLoading={changeOfferMutation.isPending || changeOfferBulkMutation.isPending}
      />

      {/* Bulk Edit Offer Metadata Modal */}
      <BulkEditOfferMetaModal
        isOpen={showBulkEditOfferMeta}
        domainCount={selectedDomains.size}
        domains={domainsData?.items
          .filter(d => selectedDomains.has(d.id))
          .map(d => ({ id: d.id, name: d.name })) || []}
        onClose={() => setShowBulkEditOfferMeta(false)}
        onConfirm={(updates) => {
          bulkUpdateOfferMetaMutation.mutate({
            domainIds: Array.from(selectedDomains),
            updates,
          });
        }}
        isLoading={bulkUpdateOfferMetaMutation.isPending}
      />

      {/* Deploy Cloak Modal */}
      <DeployCloakModal
        isOpen={showDeployCloak}
        domainIds={Array.from(selectedDomains)}
        domains={domainsData?.items
          .filter(d => selectedDomains.has(d.id))
          .map(d => ({ id: d.id, name: d.name })) || []}
        onClose={() => setShowDeployCloak(false)}
        onConfirm={(countries) => {
          deployCloakBulkMutation.mutate({
            domainIds: Array.from(selectedDomains),
            countries,
          });
        }}
        isLoading={deployCloakBulkMutation.isPending}
      />

      {/* Progress Bar */}
      <ProgressBar />
    </div>
  );
}
