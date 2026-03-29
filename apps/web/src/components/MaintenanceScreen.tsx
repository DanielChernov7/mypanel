import { Wrench, Clock, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MaintenanceScreenProps {
  onRefresh: () => Promise<any>;
}

export function MaintenanceScreen({ onRefresh }: MaintenanceScreenProps) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Main Alert Box */}
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-t-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="bg-white/20 p-4 rounded-full">
              <Wrench className="h-12 w-12 text-white animate-pulse" />
            </div>
            <h1 className="text-5xl font-bold text-white">
              {t('components.maintenance.title')}
            </h1>
          </div>
          <p className="text-center text-white/90 text-xl font-medium">
            {t('components.maintenance.subtitle')}
          </p>
        </div>

        {/* Info Table */}
        <div className="bg-gray-800 border-4 border-orange-500 rounded-b-2xl overflow-hidden shadow-2xl">
          <div className="p-8">
            <div className="bg-orange-500/10 border-2 border-orange-500 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="h-8 w-8 text-orange-400" />
                <h2 className="text-2xl font-bold text-orange-400">{t('components.maintenance.warning')}</h2>
              </div>
              <p className="text-white text-lg">
                {t('components.maintenance.warningText')}
              </p>
            </div>

            {/* Information Cards */}
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-start gap-4">
                  <Clock className="h-8 w-8 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{t('components.maintenance.whenAccess')}</h3>
                    <p className="text-gray-300 text-base">
                      {t('components.maintenance.whenAccessText')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-6 border-l-4 border-green-500">
                <div className="flex items-start gap-4">
                  <Shield className="h-8 w-8 text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{t('components.maintenance.dataSafe')}</h3>
                    <p className="text-gray-300 text-base">
                      {t('components.maintenance.dataSafeText')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 rounded-lg p-6 border-2 border-orange-500">
                <p className="text-center text-white text-lg font-semibold">
                  📞 При <span className="font-extrabold">срочных</span> вопросах обращайтесь к Дане
                </p>
              </div>
            </div>

            {/* Refresh Button */}
            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleRefresh}
                disabled={checking}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-6 text-lg"
              >
                <RefreshCw className={`h-5 w-5 mr-2 ${checking ? 'animate-spin' : ''}`} />
                {checking ? t('components.maintenance.checking') : t('components.maintenance.checkStatus')}
              </Button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <p className="text-center text-gray-400 text-base">
                {t('components.maintenance.thanks')}
              </p>
              <p className="text-center text-gray-500 text-sm mt-2">
                {t('components.maintenance.maintenanceMode')}
              </p>
              <p className="text-center text-gray-600 text-xs mt-2">
                {t('components.maintenance.pressCheck')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
