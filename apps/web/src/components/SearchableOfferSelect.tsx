import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check, ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Offer } from '@server-panel/types';

interface SearchableOfferSelectProps {
  offers: Offer[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  showFolderName?: boolean;
}

export function SearchableOfferSelect({
  offers,
  value,
  onChange,
  placeholder = 'Select an offer...',
  disabled = false,
  isLoading = false,
  className,
  showFolderName = true,
}: SearchableOfferSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOffer = offers.find((o) => o.id === value);

  const filteredOffers = offers.filter((offer) => {
    const searchLower = search.toLowerCase();
    return (
      offer.name.toLowerCase().includes(searchLower) ||
      offer.folderName.toLowerCase().includes(searchLower) ||
      (offer.geo && offer.geo.toLowerCase().includes(searchLower))
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (offerId: string) => {
    onChange(offerId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          isOpen && 'ring-2 ring-ring ring-offset-2'
        )}
      >
        <span className={cn('truncate flex items-center gap-1.5', !selectedOffer && 'text-gray-400')}>
          {isLoading ? t('components.searchableOfferSelect.loading') : selectedOffer ? (
            <>
              {selectedOffer.name}
              {selectedOffer.geo && (
                <span className="inline-flex items-center rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 uppercase">{selectedOffer.geo}</span>
              )}
            </>
          ) : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-700 bg-gray-800 shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('components.searchableOfferSelect.searchPlaceholder')}
                className="w-full h-9 pl-8 pr-3 rounded-md border border-gray-600 bg-gray-700 text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOffers.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {search ? t('components.searchableOfferSelect.noOffers') : t('components.searchableOfferSelect.noOffersAvailable')}
              </div>
            ) : (
              filteredOffers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => handleSelect(offer.id)}
                  className={cn(
                    'relative flex w-full items-center rounded-sm py-2 pl-8 pr-2 text-sm text-white outline-none hover:bg-gray-700 cursor-pointer',
                    value === offer.id && 'bg-gray-700'
                  )}
                >
                  <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                    {value === offer.id && <Check className="h-4 w-4 text-blue-500" />}
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="font-medium flex items-center gap-1.5">
                      {offer.name}
                      {offer.geo && (
                        <span className="inline-flex items-center rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 uppercase">{offer.geo}</span>
                      )}
                    </span>
                    {showFolderName && (
                      <span className="text-xs text-gray-400">{offer.folderName}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
