import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { formatDate, formatBytes } from '@/lib/utils';

interface BackupListProps {
  serverId: string;
}

export function BackupList({ serverId }: BackupListProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups', serverId],
    queryFn: () => api.getBackups(serverId),
  });

  const restoreMutation = useMutation({
    mutationFn: (backupId: string) => api.restoreFile(serverId, backupId),
    onSuccess: () => {
      toast.success(t('components.backupList.restored'));
      queryClient.invalidateQueries({ queryKey: ['backups', serverId] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('components.backupList.failed'));
    },
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400">{t('components.backupList.loading')}</div>;
  }

  if (!backups || backups.length === 0) {
    return <div className="text-sm text-gray-400">{t('components.backupList.noBackups')}</div>;
  }

  return (
    <div className="space-y-2">
      {backups.map((backup) => (
        <Card key={backup.id}>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-white">{backup.path.split('/').pop()}</p>
                <p className="text-xs text-gray-400">{backup.path}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{formatDate(backup.createdAt)}</span>
                <span>{formatBytes(Number(backup.size))}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => restoreMutation.mutate(backup.id)}
                disabled={restoreMutation.isPending}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                {t('components.backupList.restore')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
