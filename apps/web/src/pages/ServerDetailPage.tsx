import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FileText, Play, FolderOpen, History, Plus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileEditor } from '@/components/FileEditor';
import { ScriptRunner } from '@/components/ScriptRunner';
import { BackupList } from '@/components/BackupList';

export function ServerDetailPage() {
  const { serverId } = useParams<{ serverId: string }>();
  const { t } = useTranslation();
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [view, setView] = useState<'files' | 'scripts' | 'backups'>('files');
  const [showCreateDomainDialog, setShowCreateDomainDialog] = useState(false);
  const [newDomainNames, setNewDomainNames] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0, currentDomain: '' });

  const queryClient = useQueryClient();

  const { data: server } = useQuery({
    queryKey: ['server', serverId],
    queryFn: () => api.getServer(serverId!),
    enabled: !!serverId,
  });

  const { data: sites } = useQuery({
    queryKey: ['sites', serverId],
    queryFn: () => api.getSites(serverId!),
    enabled: !!serverId,
  });

  const { data: files } = useQuery({
    queryKey: ['files', serverId, selectedSite],
    queryFn: () => api.browseDirectory(serverId!, `/var/www/${selectedSite}`),
    enabled: !!serverId && !!selectedSite,
  });

  const handleCreateDomains = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainNames.trim() || !serverId) return;

    // Parse domain names (one per line, trim whitespace, filter empty)
    const domains = newDomainNames
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    if (domains.length === 0) return;

    setIsCreating(true);
    setCreateProgress({ current: 0, total: domains.length, currentDomain: '' });

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      setCreateProgress({ current: i + 1, total: domains.length, currentDomain: domain });

      try {
        await api.createDomainWithFolder(serverId, domain);
        successCount++;
      } catch (error: any) {
        failCount++;
        errors.push(`${domain}: ${error.message || 'Failed'}`);
      }
    }

    // Show results
    if (successCount > 0 && failCount === 0) {
      toast.success(t('serverDetail.createdSuccess', { count: successCount }));
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(t('serverDetail.createdPartial', { success: successCount, failed: failCount, errors: errors.join(', ') }));
    } else {
      toast.error(t('serverDetail.createdFailed', { errors: errors.join(', ') }));
    }

    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['sites', serverId] });
    queryClient.invalidateQueries({ queryKey: ['domains'] });

    setIsCreating(false);
    setShowCreateDomainDialog(false);
    setNewDomainNames('');
    setCreateProgress({ current: 0, total: 0, currentDomain: '' });
  };

  if (!server) return <div className="p-8 text-gray-400">{t('common.loading')}</div>;

  return (
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <div className="w-80 border-r bg-card">
        <div className="border-b p-6">
          <h2 className="text-xl font-bold text-white">{server.name}</h2>
          <p className="text-sm text-gray-400">{server.ip}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {server.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              view === 'files'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setView('files')}
          >
            <FileText className="mx-auto h-4 w-4" />
          </button>
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              view === 'scripts'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setView('scripts')}
          >
            <Play className="mx-auto h-4 w-4" />
          </button>
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              view === 'backups'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setView('backups')}
          >
            <History className="mx-auto h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto" style={{ height: 'calc(100vh - 200px)' }}>
          {view === 'files' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">{t('serverDetail.sites')}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateDomainDialog(true)}
                  className="h-7 px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('common.new')}
                </Button>
              </div>
              {sites?.map((site) => (
                <div key={site} className="mb-2">
                  <button
                    className={`w-full rounded-lg p-2 text-left text-sm transition-colors ${
                      selectedSite === site
                        ? 'bg-primary text-white'
                        : 'text-gray-300 hover:bg-accent hover:text-white'
                    }`}
                    onClick={() => setSelectedSite(site)}
                  >
                    <FolderOpen className="mr-2 inline h-4 w-4" />
                    {site}
                  </button>

                  {selectedSite === site && files && (
                    <div className="ml-4 mt-2 space-y-1">
                      {files.map((file) => (
                        <button
                          key={file.path}
                          className={`w-full rounded p-2 text-left text-xs transition-colors ${
                            selectedFile === file.path
                              ? 'bg-secondary text-white'
                              : 'text-gray-300 hover:bg-accent hover:text-white'
                          }`}
                          onClick={() => setSelectedFile(file.path)}
                        >
                          <FileText className="mr-2 inline h-3 w-3" />
                          {file.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {view === 'scripts' && (
            <div className="p-4">
              <ScriptRunner serverId={serverId!} />
            </div>
          )}

          {view === 'backups' && (
            <div className="p-4">
              <BackupList serverId={serverId!} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {selectedFile && view === 'files' ? (
          <FileEditor serverId={serverId!} filePath={selectedFile} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 opacity-20" />
              <p className="mt-4">{t('serverDetail.selectFile')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Domain Dialog */}
      <Dialog open={showCreateDomainDialog} onOpenChange={(open) => !isCreating && setShowCreateDomainDialog(open)}>
        <DialogContent onClose={() => !isCreating && setShowCreateDomainDialog(false)}>
          <DialogHeader>
            <DialogTitle>{t('serverDetail.createDomains')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDomains} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white">{t('serverDetail.domainNames')}</label>
              <textarea
                value={newDomainNames}
                onChange={(e) => setNewDomainNames(e.target.value)}
                placeholder="example1.com&#10;example2.com&#10;example3.com"
                className="w-full h-32 mt-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                disabled={isCreating}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('serverDetail.domainNamesHelp')}
              </p>
            </div>
            {isCreating && createProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{t('serverDetail.creating')}: {createProgress.currentDomain}</span>
                  <span>{createProgress.current} / {createProgress.total}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(createProgress.current / createProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isCreating || !newDomainNames.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('serverDetail.creating')} {createProgress.current}/{createProgress.total}...
                </>
              ) : (
                newDomainNames.split('\n').filter(d => d.trim()).length > 1
                  ? t('serverDetail.createDomains2')
                  : t('serverDetail.createDomain')
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
