import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Package, Upload, X, Globe } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableOfferSelect } from '@/components/SearchableOfferSelect';
import type { Offer } from '@server-panel/types';

interface ChangeOfferModalProps {
  mode: 'single' | 'bulk';
  domainId?: string;
  domainName?: string;
  domainIds?: string[];
  domainNames?: string[]; // NEW: Array of domain names
  domains?: Array<{ id: string; name: string }>; // NEW: Full domain info
  domainCount?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (offerId: string, buyerTag?: string, palladiumOptions?: { enabled: boolean; countries: string[] }) => void;
  isLoading?: boolean;
}

export function ChangeOfferModal({
  mode,
  domainId,
  domainName,
  domainIds,
  domainNames,
  domains,
  domainCount,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: ChangeOfferModalProps) {
  const { t } = useTranslation();
  const isAdmin = useAuth((state) => state.isAdmin);
  const user = useAuth((state) => state.user);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [buyerTag, setBuyerTag] = useState<string>('');
  const [cloakFile, setCloakFile] = useState<File | null>(null);
  const [isUploadingCloak, setIsUploadingCloak] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Palladium cloaking state
  const [palladiumEnabled, setPalladiumEnabled] = useState<boolean>(false);
  const [palladiumCountries, setPalladiumCountries] = useState<string[]>([]);

  // Fetch available offers
  const { data: offers = [], isLoading: isLoadingOffers } = useQuery({
    queryKey: ['offers'],
    queryFn: () => api.getOffers(),
    enabled: isOpen, // Only fetch when modal is open
  });

  // Fetch global settings to check if Palladium is enabled
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
    enabled: isOpen,
  });

  const palladiumCloakingEnabled = settings?.palladiumCloakingEnabled || false;

  // Build list of domains for display
  const domainList = domains ||
    (mode === 'single' && domainId && domainName
      ? [{ id: domainId, name: domainName }]
      : (domainIds && domainNames
          ? domainIds.map((id, idx) => ({ id, name: domainNames[idx] }))
          : []
        )
    );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file name
      if (file.name !== 'index.php') {
        alert(t('components.changeOffer.cloakMustBeIndexPhp'));
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setCloakFile(file);
    }
  };

  const handleConfirm = async () => {
    if (!selectedOfferId) return;

    try {
      // If cloak file is provided and we're in single mode, upload it first
      if (cloakFile && mode === 'single' && domainId) {
        setIsUploadingCloak(true);
        await api.uploadCloak(domainId, cloakFile);
        setIsUploadingCloak(false);
      }

      // Prepare Palladium options
      const palladiumOptions = palladiumEnabled && palladiumCountries.length > 0
        ? { enabled: true, countries: palladiumCountries }
        : undefined;

      // Determine buyer tag: admin can input manually, operator uses their profile buyer tag
      const finalBuyerTag = isAdmin()
        ? (buyerTag.trim() || undefined)
        : (user?.buyerTag || undefined);

      // Call parent's onConfirm
      onConfirm(selectedOfferId, finalBuyerTag, palladiumOptions);
    } catch (error: any) {
      setIsUploadingCloak(false);
      alert(t('components.changeOffer.failedUploadCloak', { error: error.message }));
    }
  };

  const handleClose = () => {
    setSelectedOfferId('');
    setBuyerTag('');
    setCloakFile(null);
    setIsUploadingCloak(false);
    setPalladiumEnabled(false);
    setPalladiumCountries([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            <DialogTitle>
              {mode === 'single' ? t('components.changeOffer.title') : t('components.changeOffer.titleBulk')}
            </DialogTitle>
          </div>
          <DialogDescription>
            {mode === 'single' ? (
              <span>{t('components.changeOffer.changeOfferSinglePrefix')} <strong>{domainName}</strong></span>
            ) : (
              <span>{t('components.changeOffer.changeOfferBulkPrefix')} <strong>{domainCount}</strong> {t('components.changeOffer.changeOfferBulkSuffix', { plural: domainCount !== 1 ? 's' : '' })}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Domain List */}
          <div>
            <label className="text-sm font-semibold mb-2 block text-foreground">
              {t('components.changeOffer.changingOfferFor')}
            </label>
            <div className="border rounded-md p-3 bg-muted/50 max-h-32 overflow-y-auto">
              <ul className="space-y-1.5 text-sm">
                {domainList.map((domain) => (
                  <li key={domain.id} className="flex items-center gap-2 text-foreground font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                    {domain.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Offer Selection */}
          {offers.length === 0 && !isLoadingOffers ? (
            <div className="text-center py-6 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground mb-1">{t('components.changeOffer.noOffers')}</p>
              <p className="text-sm">{t('components.changeOffer.noOffersHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">{t('components.changeOffer.selectOffer')}</label>
              <SearchableOfferSelect
                offers={offers}
                value={selectedOfferId}
                onChange={setSelectedOfferId}
                placeholder={t('components.changeOffer.selectAnOffer')}
                disabled={isLoading}
                isLoading={isLoadingOffers}
                showFolderName={true}
              />
            </div>
          )}

          {/* Buyer Tag Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              {isAdmin() ? t('components.changeOffer.buyerTagOptional') : t('components.changeOffer.buyerTag')}
            </label>
            {isAdmin() ? (
              <>
                <Input
                  type="text"
                  placeholder={t('components.changeOffer.enterBuyerTag')}
                  value={buyerTag}
                  onChange={(e) => setBuyerTag(e.target.value)}
                  disabled={isLoading}
                  className="text-foreground"
                />
                <p className="text-xs text-muted-foreground">{t('components.changeOffer.buyerTagHelpText')} <code>{'{{BUYER_TAG}}'}</code></p>
              </>
            ) : (
              <>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/30 text-foreground font-medium">
                  {user?.buyerTag || t('common.notSet')}
                </div>
                <p className="text-xs text-muted-foreground">{t('components.changeOffer.buyerTagHelpOperatorText')} <code>{'{{BUYER_TAG}}'}</code></p>
              </>
            )}
          </div>

          {/* Cloak Upload (Single Mode Only) */}
          {mode === 'single' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">
                {t('components.changeOffer.uploadCloak')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".php"
                  onChange={handleFileSelect}
                  disabled={isLoading || isUploadingCloak}
                  className="hidden"
                  id="cloak-file-input"
                />
                <label
                  htmlFor="cloak-file-input"
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer transition-colors
                    ${isLoading || isUploadingCloak
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-background text-foreground hover:bg-muted border-border'
                    }
                  `}
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {cloakFile ? t('components.changeOffer.changeFile') : t('components.changeOffer.chooseFile')}
                  </span>
                </label>
                {cloakFile && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground font-medium">{cloakFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCloakFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      disabled={isLoading || isUploadingCloak}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('components.changeOffer.uploadCloakHint')}
              </p>
            </div>
          )}

          {/* Palladium Cloaking Section (when enabled globally) */}
          {palladiumCloakingEnabled && (
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <label className="text-sm font-semibold text-foreground">{t('components.changeOffer.palladiumCloak')}</label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="palladium-enable"
                    checked={palladiumEnabled}
                    onCheckedChange={(checked) => setPalladiumEnabled(checked as boolean)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="palladium-enable"
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    {t('components.changeOffer.enableCloak')}
                  </label>
                </div>

                {palladiumEnabled && (
                  <div className="space-y-3 pl-6">
                    <label className="text-sm font-medium text-foreground block">
                      {t('components.changeOffer.targetCountries')}
                    </label>

                    {/* Primary target countries (most used) */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">{t('components.changeOffer.primaryTargetCountries')}</p>
                      <div className="flex flex-wrap gap-2">
                        {['LT', 'LV', 'UA', 'PL', 'NL', 'IE', 'CH'].map((country) => {
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
                              disabled={isLoading}
                              className={`
                                px-3 py-1.5 rounded-md text-xs font-semibold transition-colors
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

                    {/* Other popular countries */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{t('components.changeOffer.otherPopularCountries')}</p>
                      <div className="flex flex-wrap gap-2">
                        {['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'BE', 'AT', 'SE', 'NO', 'DK', 'FI', 'UA'].map((country) => {
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
                              disabled={isLoading}
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
                      <p className="text-xs text-muted-foreground">{t('components.changeOffer.addCustomCountries')}</p>
                      <Input
                        type="text"
                        placeholder={t('components.changeOffer.enterCountryCodes')}
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
                        disabled={isLoading}
                        className="text-foreground"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('components.changeOffer.pressEnterToAdd')}
                      </p>
                    </div>

                    {/* Selected countries display */}
                    {palladiumCountries.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">
                          {t('components.changeOffer.selectedCountries', { count: palladiumCountries.length })}
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
                                disabled={isLoading}
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
                          disabled={isLoading}
                        >
                          {t('components.changeOffer.clearAll')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                <p className="text-blue-800 dark:text-blue-200">
                  {t('components.changeOffer.palladiumCampaignInfo')}
                </p>
              </div>
            </div>
          )}

          {/* Info Messages */}
          {mode === 'bulk' && selectedOfferId && (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                {t('components.changeOffer.bulkOperationTitle')}
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                {t('components.changeOffer.bulkOperationDesc', { count: domainCount, plural: domainCount !== 1 ? 's' : '' })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="text-foreground"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedOfferId || isLoading || isUploadingCloak || offers.length === 0}
            className="font-medium"
          >
            {isUploadingCloak ? t('components.changeOffer.uploadingCloak') : isLoading ? t('common.processing') : t('components.changeOffer.applyOffer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
