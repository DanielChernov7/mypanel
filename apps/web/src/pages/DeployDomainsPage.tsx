import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Upload, Rocket, Search, Globe, X, Folder, FileArchive, Loader2, ClipboardPaste } from 'lucide-react';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { normalizeToZip, readFromEntries, readFromHandles, FolderNotReadableError, formatFileSize, type FileWithPath } from '@/lib/zipUtils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableOfferSelect } from '@/components/SearchableOfferSelect';
import type { DomainWithServer, Offer } from '@server-panel/types';

interface WhiteFolder {
  name: string;
  path: string;
  createdAt: Date;
  fileCount: number;
}

interface DomainConfig {
  domainId: string;
  domainName: string;
  whiteSourceId: string | null;
  cloakSourceId: string | null;
  offerId: string | null;
}

// Component for White file/folder upload with drag-and-drop
function WhiteUploadZone({
  domainId,
  whiteFile,
  isZipping,
  onUpload,
  onRemove
}: {
  domainId: string;
  whiteFile: File | undefined;
  isZipping: boolean;
  onUpload: (domainId: string, files: FileList | FileWithPath[]) => void;
  onRemove: (domainId: string) => void;
}) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setShowMenu(false);

    const dt = e.dataTransfer;

    // .zip file → use directly
    if (dt.files.length === 1 && dt.files[0].name.toLowerCase().endsWith('.zip')) {
      onUpload(domainId, dt.files);
      return;
    }

    // CRITICAL: capture entries and handles SYNCHRONOUSLY during the drop event.
    // After the event handler returns, DataTransfer items may be invalidated.
    const entries: FileSystemEntry[] = [];
    const handlePromises: Promise<FileSystemHandle | null>[] = [];
    for (let i = 0; i < dt.items.length; i++) {
      // Legacy Entry API
      try {
        const entry = dt.items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      } catch (err) {
        console.warn(`[DROP] webkitGetAsEntry failed for item ${i}:`, err);
      }
      // Modern File System Access API — start promises synchronously
      try {
        if ('getAsFileSystemHandle' in DataTransferItem.prototype) {
          // @ts-ignore - getAsFileSystemHandle exists in Chrome/Edge but not in TS types
          handlePromises.push(dt.items[i].getAsFileSystemHandle());
        }
      } catch (err) {
        console.warn(`[DROP] getAsFileSystemHandle failed for item ${i}:`, err);
      }
    }

    console.log(`[DROP] Captured ${entries.length} entries, ${handlePromises.length} handle promises from ${dt.items.length} items`);

    // Strategy 1: Legacy Entry API (webkitGetAsEntry)
    let folderFiles: FileWithPath[] = [];
    if (entries.length > 0) {
      try {
        folderFiles = await readFromEntries(entries);
        console.log(`[DROP] readFromEntries returned ${folderFiles.length} files`);
      } catch (err) {
        console.warn('[DROP] readFromEntries failed:', err);
      }
    }

    // Strategy 2: File System Access API (getAsFileSystemHandle) — more reliable on Windows
    if (folderFiles.length === 0 && handlePromises.length > 0) {
      try {
        const handles = (await Promise.all(handlePromises)).filter((h): h is FileSystemHandle => h !== null);
        console.log(`[DROP] Got ${handles.length} handles, trying readFromHandles`);
        if (handles.length > 0) {
          folderFiles = await readFromHandles(handles);
          console.log(`[DROP] readFromHandles returned ${folderFiles.length} files`);
        }
      } catch (err) {
        console.warn('[DROP] readFromHandles failed:', err);
      }
    }

    // Strategy 3: dt.files directly (some browsers flatten folder contents)
    if (folderFiles.length === 0 && dt.files.length > 0) {
      console.log(`[DROP] Handles empty, falling back to dt.files (${dt.files.length} files)`);
      const realFiles = Array.from(dt.files).filter(f => f.size > 0);
      if (realFiles.length > 0) {
        onUpload(domainId, realFiles as unknown as FileList);
        return;
      }
    }

    // Strategy 4: open folder picker as last resort
    if (folderFiles.length === 0) {
      toast.info(t('deploy.folderPickerFallback'));
      setTimeout(() => folderInputRef.current?.click(), 150);
      return;
    }

    onUpload(domainId, folderFiles);
  };

  // Close menu when clicking outside
  useState(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  // Show zipping progress
  if (isZipping) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
        <span className="text-xs text-blue-500">{t('deploy.zipping')}</span>
      </div>
    );
  }

  if (whiteFile) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-600 flex items-center gap-1 truncate max-w-[140px]" title={whiteFile.name}>
          <FileArchive className="h-3 w-3 flex-shrink-0" />
          {whiteFile.name}
        </span>
        <Button
          onClick={() => onRemove(domainId)}
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Hidden inputs */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is not in types but works in browsers
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          if (e.target.files) onUpload(domainId, e.target.files);
          setShowMenu(false);
        }}
        className="hidden"
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        onChange={(e) => {
          if (e.target.files) onUpload(domainId, e.target.files);
          setShowMenu(false);
        }}
        className="hidden"
      />

      {/* Dropzone */}
      <div
        onClick={() => setShowMenu(!showMenu)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-md p-2 text-center text-xs transition-colors cursor-pointer ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-gray-600 hover:border-gray-400 hover:bg-muted/30'
        }`}
      >
        <Upload className="h-3 w-3 mx-auto mb-0.5 text-gray-400" />
        <div className="text-gray-400 text-[10px]">{t('deploy.dropOrClick')}</div>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[120px]">
          <button
            onClick={() => {
              folderInputRef.current?.click();
            }}
            className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2"
          >
            <Folder className="h-3 w-3" />
            {t('deploy.selectFolder')}
          </button>
          <button
            onClick={() => {
              zipInputRef.current?.click();
            }}
            className="w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2"
          >
            <FileArchive className="h-3 w-3" />
            {t('deploy.selectZip')}
          </button>
        </div>
      )}
    </div>
  );
}

export function DeployDomainsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isAdmin = useAuth((state) => state.isAdmin);
  const user = useAuth((state) => state.user);

  // API data
  const { data: domainsData, isLoading: loadingDomains } = useQuery({
    queryKey: ['domains', { limit: 1000 }],
    queryFn: () => api.getDomains({ limit: 1000 }),
    staleTime: 30_000,
  });

  const { data: offersData } = useQuery({
    queryKey: ['offers'],
    queryFn: () => api.getOffers(),
    staleTime: 60_000,
  });

  // Fetch global settings to check if Palladium is enabled
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
    staleTime: 60_000,
  });

  const palladiumCloakingEnabled = settings?.palladiumCloakingEnabled || false;

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyEmpty, setShowOnlyEmpty] = useState(false);
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(new Set());
  const [domainConfigs, setDomainConfigs] = useState<Map<string, DomainConfig>>(new Map());
  const [whiteFiles, setWhiteFiles] = useState<Map<string, File>>(new Map()); // Map domainId -> white file (always zip)
  const [zippingDomains, setZippingDomains] = useState<Set<string>>(new Set()); // Domains currently being zipped
  const [deploying, setDeploying] = useState(false);

  // Bulk paste state
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [bulkPasteLoading, setBulkPasteLoading] = useState(false);
  const [bulkSelectResult, setBulkSelectResult] = useState<{
    found: string[];
    notFound: string[];
  } | null>(null);

  // Palladium cloaking state
  const [palladiumEnabled, setPalladiumEnabled] = useState<boolean>(false);
  const [palladiumCountries, setPalladiumCountries] = useState<string[]>([]);

  // WordPress processing mode
  const [wpMode, setWpMode] = useState<'off' | 'simple' | 'full_rebuild'>('off');

  // CRM metadata - buyer tag (admin only)
  const [crmBuyerTag, setCrmBuyerTag] = useState('');

  const domains = domainsData?.items || [];
  const offers = offersData || [];

  // Handle white file/folder upload for a specific domain.
  // Any input (zip, folder, files) → always becomes a single zip.
  const handleWhiteFileUpload = async (domainId: string, files: FileList | FileWithPath[]) => {
    if (!files || files.length === 0) return;

    const saveZip = (zipFile: File) => {
      const newWhiteFiles = new Map(whiteFiles);
      newWhiteFiles.set(domainId, zipFile);
      setWhiteFiles(newWhiteFiles);

      const whiteId = `white_${domainId}_${Date.now()}`;
      const newConfigs = new Map(domainConfigs);
      const config = newConfigs.get(domainId) || {
        domainId,
        domainName: domains.find(d => d.id === domainId)?.name || '',
        whiteSourceId: whiteId,
        cloakSourceId: null,
        offerId: null,
      };
      config.whiteSourceId = whiteId;
      newConfigs.set(domainId, config);
      setDomainConfigs(newConfigs);

      const newSelected = new Set(selectedDomainIds);
      newSelected.add(domainId);
      setSelectedDomainIds(newSelected);
    };

    // Show zipping spinner (normalizeToZip handles pass-through for .zip)
    setZippingDomains(prev => new Set(prev).add(domainId));

    try {
      const result = await normalizeToZip(files);
      saveZip(result.file);

      if (result.skippedFiles.length > 0) {
        toast.warning(t('deploy.folderZippedWithSkipped', {
          count: result.addedFiles,
          skipped: result.skippedFiles.length,
          size: formatFileSize(result.file.size),
        }));
      } else {
        toast.success(t('deploy.whiteUploaded', {
          name: result.file.name,
          size: formatFileSize(result.file.size),
        }));
      }
    } catch (error: any) {
      if (error instanceof FolderNotReadableError) {
        toast.error(t('deploy.folderUnreadable'));
      } else {
        console.error('[DeployDomains] normalizeToZip failed:', error);
        toast.error(t('deploy.failedToZip', { error: error.message }));
      }
    } finally {
      setZippingDomains(prev => {
        const next = new Set(prev);
        next.delete(domainId);
        return next;
      });
    }
  };

  // Remove white file for a domain
  const removeWhiteFile = (domainId: string) => {
    const newWhiteFiles = new Map(whiteFiles);
    newWhiteFiles.delete(domainId);
    setWhiteFiles(newWhiteFiles);

    const newConfigs = new Map(domainConfigs);
    const config = newConfigs.get(domainId);
    if (config) {
      config.whiteSourceId = null;
      newConfigs.set(domainId, config);
    }
    setDomainConfigs(newConfigs);
  };

  // Update domain configuration
  const updateDomainConfig = (domainId: string, field: 'whiteSourceId' | 'offerId', value: string | null) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;

    const newConfigs = new Map(domainConfigs);
    const config = newConfigs.get(domainId) || {
      domainId,
      domainName: domain.name,
      whiteSourceId: null,
      cloakSourceId: null,
      offerId: null,
    };

    config[field] = value;
    newConfigs.set(domainId, config);
    setDomainConfigs(newConfigs);

    // Auto-select the domain when offer is selected
    if (field === 'offerId' && value) {
      const newSelected = new Set(selectedDomainIds);
      newSelected.add(domainId);
      setSelectedDomainIds(newSelected);
    }
  };

  // Toggle domain selection
  const toggleDomainSelection = (domainId: string) => {
    const newSelected = new Set(selectedDomainIds);
    if (newSelected.has(domainId)) {
      newSelected.delete(domainId);
    } else {
      newSelected.add(domainId);
    }
    setSelectedDomainIds(newSelected);
  };

  // Filter domains by search query and isEmpty status
  const filteredDomains = domains.filter(domain => {
    const matchesSearch = domain.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEmpty = !showOnlyEmpty || domain.isEmpty === true;
    return matchesSearch && matchesEmpty;
  });

  // Sort: selected domains float to top, rest stay in original order
  const selectedDomains = filteredDomains.filter(d => selectedDomainIds.has(d.id));
  const unselectedDomains = filteredDomains.filter(d => !selectedDomainIds.has(d.id));

  // Select all filtered domains
  const selectAllDomains = () => {
    const newSelected = new Set<string>();
    filteredDomains.forEach(domain => newSelected.add(domain.id));
    setSelectedDomainIds(newSelected);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedDomainIds(new Set());
  };

  // Bulk paste: select domains from pasted list via API lookup
  const handleBulkPasteSelect = async () => {
    const lines = bulkPasteText
      .split(/[\n,;]+/)
      .map(line => line.trim().toLowerCase())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error(t('deploy.bulkPasteEmpty'));
      return;
    }

    setBulkPasteLoading(true);
    try {
      const result = await api.lookupDomains(lines);

      const newSelected = new Set(selectedDomainIds);
      for (const domain of result.found) {
        newSelected.add(domain.id);
      }
      setSelectedDomainIds(newSelected);

      setBulkSelectResult({
        found: result.found.map(d => d.name),
        notFound: result.notFound,
      });

      if (result.found.length > 0) {
        toast.success(`Selected ${result.found.length} domain(s)`);
      }
      if (result.notFound.length > 0) {
        toast.warning(`${result.notFound.length} domain(s) not found`);
      }
    } catch (error: any) {
      toast.error(`Failed to lookup domains: ${error.message}`);
    } finally {
      setBulkPasteLoading(false);
    }
  };

  // Deploy domains
  const handleDeploy = async () => {
    // Validate: at least one domain selected
    if (selectedDomainIds.size === 0) {
      toast.error(t('deploy.selectAtLeastOne'));
      return;
    }

    // Validate: all selected domains have complete configuration
    const invalidDomains: string[] = [];
    const deployConfigs: Array<{
      domainId: string;
      whiteSourceId: string;
      cloakSourceId: string | null;
      offerId: string | null;
    }> = [];

    selectedDomainIds.forEach(domainId => {
      const config = domainConfigs.get(domainId);
      const domain = domains.find(d => d.id === domainId);

      if (!config || !config.whiteSourceId) {
        invalidDomains.push(domain?.name || domainId);
      } else {
        deployConfigs.push({
          domainId: config.domainId,
          whiteSourceId: config.whiteSourceId,
          cloakSourceId: config.cloakSourceId,
          offerId: config.offerId,
        });
      }
    });

    if (invalidDomains.length > 0) {
      toast.error(t('deploy.missingConfig', {
        domains: invalidDomains.length > 3
          ? t('deploy.missingConfigMore', { domains: invalidDomains.slice(0, 3).join(', '), count: invalidDomains.length - 3 })
          : invalidDomains.join(', ')
      }));
      return;
    }

    try {
      setDeploying(true);

      // Build CRM metadata - use admin-provided buyer tag or user's default buyer tag
      const crmMetadata: { buyerTag?: string } = {};
      if (isAdmin() && crmBuyerTag.trim()) {
        // Admin manually set a buyer tag
        crmMetadata.buyerTag = crmBuyerTag.trim();
      } else if (user?.buyerTag) {
        // Use user's default buyer tag
        crmMetadata.buyerTag = user.buyerTag;
      }

      // Prepare Palladium options
      const palladiumOptions = palladiumEnabled && palladiumCountries.length > 0
        ? { enabled: true, countries: palladiumCountries }
        : undefined;

      const result = await api.deployDomains(
        deployConfigs,
        whiteFiles,
        Object.keys(crmMetadata).length > 0 ? crmMetadata : undefined,
        palladiumOptions,
        wpMode !== 'off' ? wpMode : undefined
      );

      if ((result as any)?.alreadyExists) {
        toast.info(t('domains.jobAlreadyInProgress'));
        setDeploying(false);
        return;
      }

      toast.success(t('deploy.deployJobCreated'));

      // Navigate to jobs page
      setTimeout(() => {
        navigate(`/jobs?jobId=${result.jobId}`);
      }, 1000);
    } catch (error: any) {
      console.error('Deployment failed:', error);
      toast.error(t('deploy.deploymentFailed', { error: error.message }));
      setDeploying(false);
    }
  };

  const loading = loadingDomains;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-white">{t('deploy.title')}</h1>
        <p className="text-muted-foreground">
          {t('deploy.description')}
        </p>
      </div>

      {/* Buyer Tag Section - Admin Only, visible only when at least one domain has an offer selected */}
      {isAdmin() && Array.from(domainConfigs.values()).some(c => c.offerId) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('deploy.buyerTagOptional')}</CardTitle>
            <CardDescription>
              {t('deploy.buyerTagOverrideDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <label className="text-sm font-medium mb-2 block">
                {t('deploy.buyerTag')}
              </label>
              <Input
                type="text"
                value={crmBuyerTag}
                onChange={(e) => setCrmBuyerTag(e.target.value)}
                placeholder={t('deploy.buyerTagPlaceholder', { default: user?.buyerTag || t('common.none') })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('deploy.buyerTagHelp')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Palladium Cloaking Section (when enabled globally) */}
      {palladiumCloakingEnabled && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <CardTitle>{t('deploy.palladiumCloakingTitle')}</CardTitle>
            </div>
            <CardDescription>
              {t('deploy.palladiumCloakingDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="palladium-enable"
                  checked={palladiumEnabled}
                  onCheckedChange={(checked) => setPalladiumEnabled(checked as boolean)}
                  disabled={deploying}
                />
                <label
                  htmlFor="palladium-enable"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  {t('deploy.enableCloak')}
                </label>
              </div>

              {palladiumEnabled && (
                <div className="space-y-3 pl-6">
                  <label className="text-sm font-medium text-foreground block">
                    {t('deploy.targetCountries')}
                  </label>

                  {/* Popular countries quick select */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t('deploy.quickSelectCountries')}</p>
                    <div className="flex flex-wrap gap-2">
                      {['LT', 'LV', 'UA', 'PL', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI'].map((country) => {
                        const isSelected = palladiumCountries.includes(country);
                        return (
                          <button
                            key={country}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setPalladiumCountries(prev => prev.filter(c => c !== country));
                              } else {
                                setPalladiumCountries(prev => [...prev, country]);
                              }
                            }}
                            disabled={deploying}
                            className={`
                              px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                              ${isSelected
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
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
                  </div>

                  {/* Custom input for other countries */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t('deploy.addCustomCountries')}</p>
                    <Input
                      type="text"
                      placeholder={t('deploy.enterCountryCodes')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget.value.trim().toUpperCase();
                          if (input && !palladiumCountries.includes(input)) {
                            setPalladiumCountries(prev => [...prev, input]);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                      disabled={deploying}
                      className="text-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('deploy.pressEnterToAdd')}
                    </p>
                  </div>

                  {/* Selected countries display */}
                  {palladiumCountries.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">
                        {t('deploy.selectedCountries', { count: palladiumCountries.length })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {palladiumCountries.map((country) => (
                          <span
                            key={country}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium"
                          >
                            {country}
                            <button
                              type="button"
                              onClick={() => setPalladiumCountries(prev => prev.filter(c => c !== country))}
                              className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                              disabled={deploying}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPalladiumCountries([])}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                        disabled={deploying}
                      >
                        {t('deploy.clearAll')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                <p className="text-blue-800 dark:text-blue-200">
                  {t('deploy.palladiumCampaignInfo')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WordPress Processing Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-500" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wpMode !== 'off'}
                onChange={(e) => setWpMode(e.target.checked ? 'simple' : 'off')}
                disabled={deploying}
                className="w-4 h-4 rounded text-purple-500"
              />
              <CardTitle className="cursor-pointer">{t('deploy.wpProcessing')}</CardTitle>
            </label>
          </div>
          <CardDescription>
            {t('deploy.wpProcessingDesc')}
          </CardDescription>
        </CardHeader>
        {wpMode !== 'off' && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-4">
                {(['simple', 'full_rebuild'] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="wpMode"
                      value={mode}
                      checked={wpMode === mode}
                      onChange={() => setWpMode(mode)}
                      disabled={deploying}
                      className="w-4 h-4 text-purple-500"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {t(`deploy.wpMode_${mode}`)}
                    </span>
                  </label>
                ))}
              </div>

              <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-3 text-sm">
                <p className="text-purple-800 dark:text-purple-200">
                  {t(`deploy.wpModeInfo_${wpMode}`)}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Domains Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('deploy.configureDomains')}</CardTitle>
          <CardDescription>
            {t('deploy.configureDomainsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Selection Controls */}
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('deploy.domainSearch')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-only-empty"
                  checked={showOnlyEmpty}
                  onCheckedChange={(checked) => setShowOnlyEmpty(checked as boolean)}
                />
                <label
                  htmlFor="show-only-empty"
                  className="text-sm font-medium cursor-pointer whitespace-nowrap"
                >
                  {t('deploy.onlyEmpty')}
                </label>
              </div>
              <Button onClick={selectAllDomains} variant="outline" size="sm">
                Select All ({filteredDomains.length})
              </Button>
              <Button onClick={clearAllSelections} variant="outline" size="sm">
                Clear
              </Button>
              <Button
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                variant={showBulkPaste ? 'secondary' : 'outline'}
                size="sm"
              >
                <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                {t('deploy.bulkPaste')}
              </Button>
              <div className="text-sm text-muted-foreground">
                Selected: {selectedDomainIds.size}
              </div>
            </div>

            {/* Bulk paste area */}
            {showBulkPaste && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <p className="text-xs text-muted-foreground">{t('deploy.bulkPasteHint')}</p>
                <textarea
                  value={bulkPasteText}
                  onChange={(e) => { setBulkPasteText(e.target.value); setBulkSelectResult(null); }}
                  placeholder={t('deploy.bulkPastePlaceholder')}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleBulkPasteSelect} size="sm" disabled={!bulkPasteText.trim() || bulkPasteLoading}>
                    {bulkPasteLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {t('deploy.bulkPasteApply')}
                  </Button>
                  <Button onClick={() => { setShowBulkPaste(false); setBulkPasteText(''); setBulkSelectResult(null); }} variant="ghost" size="sm">
                    {t('common.cancel')}
                  </Button>
                  {bulkPasteText.trim() && !bulkSelectResult && (
                    <span className="text-xs text-muted-foreground">
                      {bulkPasteText.split(/[\n,;]+/).filter(l => l.trim()).length} domain(s) to lookup
                    </span>
                  )}
                </div>

                {/* Results summary */}
                {bulkSelectResult && (
                  <div className="mt-2 p-3 rounded-md border bg-background space-y-2">
                    {bulkSelectResult.found.length > 0 && (
                      <div className="text-sm">
                        <span className="text-green-500 font-medium">Found & selected: {bulkSelectResult.found.length}</span>
                        <div className="mt-1 max-h-28 overflow-y-auto">
                          {bulkSelectResult.found.map((name, i) => (
                            <div key={i} className="text-xs text-green-400/80">• {name}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {bulkSelectResult.notFound.length > 0 && (
                      <div className="text-sm">
                        <span className="text-orange-500 font-medium">Not found: {bulkSelectResult.notFound.length}</span>
                        <div className="mt-1 max-h-28 overflow-y-auto">
                          {bulkSelectResult.notFound.map((name, i) => (
                            <div key={i} className="text-xs text-orange-400/80">• {name}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bulk offer select for all selected domains */}
            {selectedDomainIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <span className="text-sm font-medium whitespace-nowrap">{t('deploy.offerForAll')}</span>
                <SearchableOfferSelect
                  offers={offers}
                  value=""
                  onChange={(value) => {
                    if (!value) return;
                    const newConfigs = new Map(domainConfigs);
                    selectedDomainIds.forEach(domainId => {
                      const domain = domains.find(d => d.id === domainId);
                      if (!domain) return;
                      const config = newConfigs.get(domainId) || {
                        domainId,
                        domainName: domain.name,
                        whiteSourceId: null,
                        cloakSourceId: null,
                        offerId: null,
                      };
                      config.offerId = value;
                      newConfigs.set(domainId, config);
                    });
                    setDomainConfigs(newConfigs);
                    const offerName = offers.find(o => o.id === value)?.name || value;
                    toast.success(t('deploy.offerAppliedToAll', { offer: offerName, count: selectedDomainIds.size }));
                  }}
                  placeholder={t('deploy.selectOfferForSelected')}
                  className="w-[250px]"
                  showFolderName={false}
                />
                <span className="text-xs text-muted-foreground">
                  {t('deploy.offerForAllHint', { count: selectedDomainIds.size })}
                </span>
              </div>
            )}

            {/* Domains Table */}
            <div className="border rounded-lg max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedDomainIds.size === filteredDomains.length && filteredDomains.length > 0}
                        onChange={(e) => e.target.checked ? selectAllDomains() : clearAllSelections()}
                        className="w-4 h-4"
                      />
                    </TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead className="w-[220px]">White</TableHead>
                    <TableHead className="w-[200px]">Offer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDomains.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {searchQuery ? 'No domains match your search' : 'No domains found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {/* Selected domains — pinned to top */}
                      {selectedDomains.map((domain) => {
                        const config = domainConfigs.get(domain.id);
                        const whiteFile = whiteFiles.get(domain.id);
                        return (
                          <TableRow key={domain.id} className="bg-primary/5 border-l-2 border-l-primary">
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => toggleDomainSelection(domain.id)}
                                className="w-4 h-4"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{domain.name}</TableCell>
                            <TableCell>
                              <WhiteUploadZone
                                domainId={domain.id}
                                whiteFile={whiteFile}
                                isZipping={zippingDomains.has(domain.id)}
                                onUpload={handleWhiteFileUpload}
                                onRemove={removeWhiteFile}
                              />
                            </TableCell>
                            <TableCell>
                              <SearchableOfferSelect
                                offers={offers}
                                value={config?.offerId || ''}
                                onChange={(value) => updateDomainConfig(domain.id, 'offerId', value || null)}
                                placeholder="Select Offer"
                                className="w-[200px]"
                                showFolderName={false}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Divider between selected and unselected */}
                      {selectedDomains.length > 0 && unselectedDomains.length > 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="py-1 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
                                unselected · {unselectedDomains.length}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Unselected domains */}
                      {unselectedDomains.map((domain) => {
                        const config = domainConfigs.get(domain.id);
                        const whiteFile = whiteFiles.get(domain.id);
                        return (
                          <TableRow key={domain.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => toggleDomainSelection(domain.id)}
                                className="w-4 h-4"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{domain.name}</TableCell>
                            <TableCell>
                              <WhiteUploadZone
                                domainId={domain.id}
                                whiteFile={whiteFile}
                                isZipping={zippingDomains.has(domain.id)}
                                onUpload={handleWhiteFileUpload}
                                onRemove={removeWhiteFile}
                              />
                            </TableCell>
                            <TableCell>
                              <SearchableOfferSelect
                                offers={offers}
                                value={config?.offerId || ''}
                                onChange={(value) => updateDomainConfig(domain.id, 'offerId', value || null)}
                                placeholder="Select Offer"
                                className="w-[200px]"
                                showFolderName={false}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Deploy Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleDeploy}
                disabled={deploying || selectedDomainIds.size === 0}
                size="lg"
              >
                <Rocket className="mr-2 h-4 w-4" />
                {deploying ? 'Deploying...' : `Deploy to ${selectedDomainIds.size} Domain(s)`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
