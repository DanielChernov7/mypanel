import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe2, Package, AlertCircle, Tag } from 'lucide-react';
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

interface BulkEditOfferMetaModalProps {
  isOpen: boolean;
  domainCount: number;
  domains?: Array<{ id: string; name: string }>; // List of domains for display
  onClose: () => void;
  onConfirm: (updates: { offerName?: string; geo?: string; buyerTag?: string }) => void;
  isLoading?: boolean;
}

const COMMON_GEOS = [
  { value: 'PL', label: 'Poland (PL)' },
  { value: 'CZ', label: 'Czech Republic (CZ)' },
  { value: 'SK', label: 'Slovakia (SK)' },
  { value: 'HU', label: 'Hungary (HU)' },
  { value: 'RO', label: 'Romania (RO)' },
  { value: 'BG', label: 'Bulgaria (BG)' },
  { value: 'HR', label: 'Croatia (HR)' },
  { value: 'SI', label: 'Slovenia (SI)' },
  { value: 'UA', label: 'Ukraine (UA)' },
  { value: 'LV', label: 'Latvia (LV)' },
  { value: 'LT', label: 'Lithuania (LT)' },
  { value: 'EE', label: 'Estonia (EE)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'AT', label: 'Austria (AT)' },
  { value: 'CH', label: 'Switzerland (CH)' },
  { value: 'IT', label: 'Italy (IT)' },
  { value: 'ES', label: 'Spain (ES)' },
  { value: 'PT', label: 'Portugal (PT)' },
  { value: 'FR', label: 'France (FR)' },
  { value: 'BE', label: 'Belgium (BE)' },
  { value: 'NL', label: 'Netherlands (NL)' },
];

export function BulkEditOfferMetaModal({
  isOpen,
  domainCount,
  domains = [],
  onClose,
  onConfirm,
  isLoading = false,
}: BulkEditOfferMetaModalProps) {
  const { t } = useTranslation();
  const [offerName, setOfferName] = useState('');
  const [geo, setGeo] = useState('');
  const [useCustomGeo, setUseCustomGeo] = useState(false);
  const [customGeo, setCustomGeo] = useState('');
  const [buyerTag, setBuyerTag] = useState('');

  const handleConfirm = () => {
    const updates: { offerName?: string; geo?: string; buyerTag?: string } = {};

    if (offerName.trim()) {
      updates.offerName = offerName.trim();
    }

    const finalGeo = useCustomGeo ? customGeo.trim() : geo;
    if (finalGeo) {
      updates.geo = finalGeo;
    }

    if (buyerTag.trim()) {
      updates.buyerTag = buyerTag.trim();
    }

    if (Object.keys(updates).length === 0) {
      return; // No updates provided
    }

    onConfirm(updates);
  };

  const handleClose = () => {
    setOfferName('');
    setGeo('');
    setCustomGeo('');
    setUseCustomGeo(false);
    setBuyerTag('');
    onClose();
  };

  const hasUpdates = offerName.trim() || geo || (useCustomGeo && customGeo.trim()) || buyerTag.trim();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            <DialogTitle>{t('components.bulkEditMeta.title')}</DialogTitle>
          </div>
          <DialogDescription>
            <span>{t('components.bulkEditMeta.descriptionPrefix')} <strong>{domainCount}</strong> {t('components.bulkEditMeta.descriptionSuffix', { plural: domainCount !== 1 ? 's' : '' })}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Domain List */}
          {domains.length > 0 && (
            <div>
              <label className="text-sm font-semibold mb-2 block text-foreground">
                {t('components.bulkEditMeta.editingMetaFor')}
              </label>
              <div className="border rounded-md p-3 bg-muted/50 max-h-32 overflow-y-auto">
                <ul className="space-y-1.5 text-sm">
                  {domains.map((domain) => (
                    <li key={domain.id} className="flex items-center gap-2 text-foreground font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                      {domain.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Offer Name Input */}
          <div>
            <label className="text-sm font-semibold mb-2 block text-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('components.bulkEditMeta.offerName')}
            </label>
            <Input
              type="text"
              value={offerName}
              onChange={(e) => setOfferName(e.target.value)}
              placeholder={t('components.bulkEditMeta.offerNamePlaceholder')}
              disabled={isLoading}
              className="text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('components.bulkEditMeta.leaveEmptyToKeep')}
            </p>
          </div>

          {/* Buyer Tag Input */}
          <div>
            <label className="text-sm font-semibold mb-2 block text-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {t('components.bulkEditMeta.buyerTag')}
            </label>
            <Input
              type="text"
              value={buyerTag}
              onChange={(e) => setBuyerTag(e.target.value)}
              placeholder={t('components.bulkEditMeta.buyerTagPlaceholder')}
              disabled={isLoading}
              className="text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('components.bulkEditMeta.leaveEmptyToKeep')}
            </p>
          </div>

          {/* Geo Selection */}
          <div>
            <label className="text-sm font-semibold mb-2 block text-foreground flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              {t('components.bulkEditMeta.geo')}
            </label>

            {!useCustomGeo ? (
              <>
                <select
                  value={geo}
                  onChange={(e) => setGeo(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-background border border-input text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{t('components.bulkEditMeta.selectCountry')}</option>
                  {COMMON_GEOS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseCustomGeo(true)}
                  className="text-xs text-blue-500 hover:text-blue-400 mt-1"
                  disabled={isLoading}
                >
                  {t('components.bulkEditMeta.enterCustomGeo')}
                </button>
              </>
            ) : (
              <>
                <Input
                  type="text"
                  value={customGeo}
                  onChange={(e) => setCustomGeo(e.target.value.toUpperCase())}
                  placeholder={t('components.bulkEditMeta.geoPlaceholder')}
                  disabled={isLoading}
                  className="text-foreground"
                  maxLength={3}
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomGeo(false);
                    setCustomGeo('');
                  }}
                  className="text-xs text-blue-500 hover:text-blue-400 mt-1"
                  disabled={isLoading}
                >
                  {t('components.bulkEditMeta.useDropdown')}
                </button>
              </>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t('components.bulkEditMeta.leaveEmptyToKeep')}
            </p>
          </div>

          {/* Preview */}
          {hasUpdates && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm border border-green-200 dark:border-green-800">
              <p className="font-medium text-green-800 dark:text-green-200 mb-1">
                {t('components.bulkEditMeta.updatesToApply')}
              </p>
              <ul className="text-green-700 dark:text-green-300 space-y-1">
                {offerName.trim() && (
                  <li>• {t('components.bulkEditMeta.offerNameArrow')} → <strong>{offerName.trim()}</strong></li>
                )}
                {buyerTag.trim() && (
                  <li>• {t('components.bulkEditMeta.buyerTagArrow')} → <strong>{buyerTag.trim()}</strong></li>
                )}
                {(geo || (useCustomGeo && customGeo.trim())) && (
                  <li>• {t('components.bulkEditMeta.geoArrow')} → <strong>{useCustomGeo ? customGeo.trim() : geo}</strong></li>
                )}
              </ul>
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
            disabled={!hasUpdates || isLoading}
            className="font-medium"
          >
            {isLoading ? t('components.bulkEditMeta.applying') : t('components.bulkEditMeta.updateDomains', { count: domainCount, plural: domainCount !== 1 ? 's' : '' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
