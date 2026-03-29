import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Shield, Globe, X } from 'lucide-react';
import { api } from '@/lib/api';
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

interface DeployCloakModalProps {
  domainIds: string[];
  domains: Array<{ id: string; name: string }>;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (countries: string[]) => void;
  isLoading?: boolean;
}

export function DeployCloakModal({
  domainIds,
  domains,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DeployCloakModalProps) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<string[]>([]);

  // Fetch global settings to check if Palladium is enabled
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
    enabled: isOpen,
  });

  const palladiumCloakingEnabled = settings?.palladiumCloakingEnabled || false;

  const handleConfirm = () => {
    if (countries.length === 0) return;
    onConfirm(countries);
  };

  const handleClose = () => {
    setCountries([]);
    onClose();
  };

  if (!palladiumCloakingEnabled) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              <DialogTitle>{t('components.deployCloak.titleDisabled')}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              {t('components.deployCloak.notEnabledDesc')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-500" />
            <DialogTitle>{t('components.deployCloak.title')}</DialogTitle>
          </div>
          <DialogDescription>
            <span>{t('components.deployCloak.descriptionPrefix')} <strong>{domainIds.length}</strong> {t('components.deployCloak.descriptionSuffix', { plural: domainIds.length !== 1 ? 's' : '' })}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Domain List */}
          <div>
            <label className="text-sm font-semibold mb-2 block text-foreground">
              {t('components.deployCloak.deployingTo')}
            </label>
            <div className="border rounded-md p-3 bg-muted/50 max-h-32 overflow-y-auto">
              <ul className="space-y-1.5 text-sm">
                {domains.map((domain) => (
                  <li key={domain.id} className="flex items-center gap-2 text-foreground font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0"></span>
                    {domain.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Country Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <label className="text-sm font-semibold text-foreground">{t('components.deployCloak.countries')}</label>
            </div>

            {/* Primary target countries (most used) */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">{t('components.deployCloak.primaryTargetCountries')}</p>
              <div className="flex flex-wrap gap-2">
                {['LT', 'LV', 'UA', 'PL', 'NL', 'IE', 'CH'].map((country) => {
                  const isSelected = countries.includes(country);
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setCountries(prev => prev.filter(c => c !== country));
                        } else {
                          setCountries(prev => [...prev, country]);
                        }
                      }}
                      disabled={isLoading}
                      className={`
                        px-3 py-1.5 rounded-md text-xs font-semibold transition-colors
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
            </div>

            {/* Other popular countries */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('components.deployCloak.otherPopularCountries')}</p>
              <div className="flex flex-wrap gap-2">
                {['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'BE', 'AT', 'SE', 'NO', 'DK', 'FI'].map((country) => {
                  const isSelected = countries.includes(country);
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setCountries(prev => prev.filter(c => c !== country));
                        } else {
                          setCountries(prev => [...prev, country]);
                        }
                      }}
                      disabled={isLoading}
                      className={`
                        px-3 py-1.5 rounded-md text-xs font-medium transition-colors
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
            </div>

            {/* Custom input for other countries */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('components.deployCloak.addCustomCountries')}</p>
              <Input
                type="text"
                placeholder={t('components.deployCloak.enterCountryCodes')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.currentTarget.value.trim().toUpperCase();
                    if (input && !countries.includes(input)) {
                      setCountries(prev => [...prev, input]);
                      e.currentTarget.value = '';
                    }
                  }
                }}
                disabled={isLoading}
                className="text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                {t('components.deployCloak.pressEnterToAdd')}
              </p>
            </div>

            {/* Selected countries display */}
            {countries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  {t('components.deployCloak.selectedCountries', { count: countries.length })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {countries.map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium"
                    >
                      {country}
                      <button
                        type="button"
                        onClick={() => setCountries(prev => prev.filter(c => c !== country))}
                        className="ml-1 hover:text-purple-900 dark:hover:text-purple-100"
                        disabled={isLoading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCountries([])}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  disabled={isLoading}
                >
                  {t('components.deployCloak.clearAll')}
                </button>
              </div>
            )}
          </div>

          {/* Info Message */}
          <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-3 text-sm">
            <p className="font-medium text-purple-800 dark:text-purple-200 mb-1">
              {t('components.deployCloak.whatWillHappen')}
            </p>
            <ul className="text-purple-700 dark:text-purple-300 space-y-1 list-disc list-inside">
              <li>{t('components.deployCloak.campaignCreated')}</li>
              <li>{t('components.deployCloak.cloakDeployed')}</li>
              <li>{t('components.deployCloak.existingBackedUp')}</li>
              <li>{t('components.deployCloak.noOfferFiles')}</li>
            </ul>
          </div>
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
            disabled={countries.length === 0 || isLoading}
            className="font-medium bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? t('components.deployCloak.deploying') : t('components.deployCloak.deployCount', { count: domainIds.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
