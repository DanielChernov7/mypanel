import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, RotateCcw, History } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { api } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface FileEditorProps {
  serverId: string;
  filePath: string;
}

export function FileEditor({ serverId, filePath }: FileEditorProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [backup, setBackup] = useState(true);
  const [postHook, setPostHook] = useState('');
  const [showBackups, setShowBackups] = useState(false);
  const queryClient = useQueryClient();

  const { data: fileData, isLoading } = useQuery({
    queryKey: ['file', serverId, filePath],
    queryFn: () => api.getFile(serverId, filePath),
  });

  const { data: backups } = useQuery({
    queryKey: ['backups', serverId, filePath],
    queryFn: () => api.getBackups(serverId, filePath),
  });

  useEffect(() => {
    if (fileData) {
      setContent(fileData.content);
      setOriginalContent(fileData.content);
      setHasChanges(false);
    }
  }, [fileData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.applyFile(serverId, {
        path: filePath,
        content,
        backup,
        postHook: postHook || undefined,
      }),
    onSuccess: () => {
      toast.success(t('components.fileEditor.saved'));
      setOriginalContent(content);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['backups', serverId, filePath] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('components.fileEditor.failed'));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (backupId: string) => api.restoreFile(serverId, backupId),
    onSuccess: () => {
      toast.success(t('components.fileEditor.restoredFromBackup'));
      queryClient.invalidateQueries({ queryKey: ['file', serverId, filePath] });
      setShowBackups(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t('components.fileEditor.failedRestore'));
    },
  });

  const handleContentChange = (value: string | undefined) => {
    setContent(value || '');
    setHasChanges(value !== originalContent);
  };

  const handleSave = () => {
    if (!hasChanges) {
      toast.info(t('components.fileEditor.noChangesToSave'));
      return;
    }
    saveMutation.mutate();
  };

  const handleRevert = () => {
    setContent(originalContent);
    setHasChanges(false);
    toast.info(t('components.fileEditor.changesReverted'));
  };

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      py: 'python',
      php: 'php',
      sh: 'shell',
      bash: 'shell',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      md: 'markdown',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">{t('components.fileEditor.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex-1">
          <h3 className="font-semibold text-white">{filePath.split('/').pop()}</h3>
          <p className="text-xs text-gray-400">{filePath}</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={backup}
              onChange={(e) => setBackup(e.target.checked)}
              className="rounded border-input"
            />
            {t('components.fileEditor.backupBeforeSave')}
          </label>

          <Input
            placeholder={t('components.fileEditor.postSaveHook')}
            value={postHook}
            onChange={(e) => setPostHook(e.target.value)}
            className="w-64"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBackups(true)}
            disabled={!backups || backups.length === 0}
          >
            <History className="mr-2 h-4 w-4" />
            {t('components.fileEditor.backupsCount', { count: backups?.length || 0 })}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRevert}
            disabled={!hasChanges}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('components.fileEditor.revert')}
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? t('components.fileEditor.saving') : t('components.fileEditor.save')}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={getLanguage(filePath)}
          value={content}
          onChange={handleContentChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      {/* Backups Dialog */}
      <Dialog open={showBackups} onOpenChange={setShowBackups}>
        <DialogContent onClose={() => setShowBackups(false)}>
          <DialogHeader>
            <DialogTitle>{t('components.fileEditor.fileBackups')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {backups?.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{backup.backupPath.split('/').pop()}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(backup.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restoreMutation.mutate(backup.id)}
                  disabled={restoreMutation.isPending}
                >
                  {t('components.fileEditor.restore')}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
