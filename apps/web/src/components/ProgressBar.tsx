import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgressStore } from '@/stores/progressStore';
import { CheckCircle, XCircle } from 'lucide-react';

export function ProgressBar() {
  const { t } = useTranslation();
  const { isActive, current, total, label, status, errorCount, resetProgress } = useProgressStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
    }
  }, [isActive]);

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      // Auto-hide after 3 seconds
      const timeout = setTimeout(() => {
        setIsVisible(false);
        // Reset after fade out
        setTimeout(() => {
          resetProgress();
        }, 300);
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [status, resetProgress]);

  if (!isVisible) return null;

  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const getStatusColor = () => {
    if (status === 'success') return 'bg-green-500';
    if (status === 'error') return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const getStatusMessage = () => {
    if (status === 'success') {
      return t('components.progressBar.allScannedSuccess');
    }
    if (status === 'error') {
      return t('components.progressBar.scanCompletedWithErrors', { count: errorCount, plural: errorCount !== 1 ? 's' : '' });
    }
    return `${label} (${current} / ${total})`;
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 min-w-[320px] max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white flex items-center gap-2">
            {status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {status === 'error' && <XCircle className="h-4 w-4 text-orange-500" />}
            {getStatusMessage()}
          </span>
          {status === 'running' && (
            <span className="text-xs text-gray-400">{percentage}%</span>
          )}
        </div>

        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getStatusColor()}`}
            style={{ width: `${percentage}%` }}
          >
            {status === 'running' && (
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {status === 'running' && (
          <p className="text-xs text-gray-400 mt-2">
            {t('components.progressBar.pleaseWait')}
          </p>
        )}
      </div>
    </div>
  );
}
