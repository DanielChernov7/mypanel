import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Server, CreateServerDto, User } from '@server-panel/types';
import { formatDate } from '@/lib/utils';

export function ServersPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: servers, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: () => api.getServers(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success(t('servers.serverDeleted'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('servers.failedDelete'));
    },
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t('servers.deleteConfirm'))) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('servers.title')}</h1>
          <p className="text-gray-400">{t('servers.description')}</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('servers.addServer')}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers?.map((server) => (
            <Card
              key={server.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => navigate(`/servers/${server.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{server.name}</h3>
                      {server.overallStatus && (
                        <span
                          className={`h-3 w-3 rounded-full inline-block ${
                            server.overallStatus === 'BANNED' ? 'bg-red-500' : 'bg-green-500'
                          }`}
                          title={
                            server.overallStatus === 'BANNED'
                              ? t('servers.allBannedTitle')
                              : t('servers.activeMixedTitle')
                          }
                          aria-label={
                            server.overallStatus === 'BANNED'
                              ? t('servers.allBannedLabel')
                              : t('servers.activeMixedLabel')
                          }
                        />
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{server.ip}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(e, server.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {server.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {server.notes && (
                  <p className="mt-4 text-sm text-gray-400">{server.notes}</p>
                )}

                {server.lastHeartbeat && (
                  <p className="mt-2 text-xs text-gray-400">
                    {t('common.lastSeen')}: {formatDate(server.lastHeartbeat)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddServerDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
}

function AddServerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<CreateServerDto>({
    name: '',
    ip: '',
    sshPort: 22,
    username: 'root',
    authType: 'password',
    passwordOrKey: '',
    notes: '',
    tags: [],
    cfEmail: '',
    cfApiKey: '',
    defaultOperatorId: undefined,
    addToPoolOnDiscover: false,
    ipCost: 0,
  });
  const [initialDomainsText, setInitialDomainsText] = useState('');
  const [showInitialDomains, setShowInitialDomains] = useState(false);

  const queryClient = useQueryClient();

  // Fetch operators for default owner selection
  const { data: operators = [] } = useQuery<User[]>({
    queryKey: ['operators'],
    queryFn: () => api.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateServerDto) => api.createServer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success(t('servers.serverAdded'));
      onOpenChange(false);
      setFormData({
        name: '',
        ip: '',
        sshPort: 22,
        username: 'root',
        authType: 'password',
        passwordOrKey: '',
        notes: '',
        tags: [],
        cfEmail: '',
        cfApiKey: '',
        defaultOperatorId: undefined,
        addToPoolOnDiscover: false,
        ipCost: 0,
      });
      setInitialDomainsText('');
      setShowInitialDomains(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t('servers.failedAdd'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const initialDomains = initialDomainsText
      .split('\n')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);
    createMutation.mutate({
      ...formData,
      ...(initialDomains.length > 0 ? { initialDomains } : {}),
    });
  };

  const initialDomainsCount = initialDomainsText
    .split('\n')
    .filter(d => d.trim().length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{t('servers.addServerDialog')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.name')}</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.ipAddress')}</label>
            <Input
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.sshPort')}</label>
            <Input
              type="number"
              value={formData.sshPort}
              onChange={(e) =>
                setFormData({ ...formData, sshPort: parseInt(e.target.value) })
              }
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.username')}</label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.authType')}</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.authType}
              onChange={(e) =>
                setFormData({ ...formData, authType: e.target.value as 'password' | 'key' })
              }
            >
              <option value="password" className="bg-gray-900 text-white">{t('common.password')}</option>
              <option value="key" className="bg-gray-900 text-white">{t('common.privateKey')}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-white">
              {formData.authType === 'password' ? t('common.password') : t('common.privateKey')}
            </label>
            <Input
              type={formData.authType === 'password' ? 'password' : 'text'}
              value={formData.passwordOrKey}
              onChange={(e) =>
                setFormData({ ...formData, passwordOrKey: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.tags')}</label>
            <Input
              placeholder={t('servers.form.tagsPlaceholder')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.notes')}</label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="add-to-pool"
                checked={formData.addToPoolOnDiscover || false}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    addToPoolOnDiscover: checked as boolean,
                    // Clear defaultOperatorId if adding to pool
                    defaultOperatorId: checked ? undefined : formData.defaultOperatorId,
                  })
                }
              />
              <label
                htmlFor="add-to-pool"
                className="text-sm font-medium text-white cursor-pointer"
              >
                {t('servers.form.addToPool')}
              </label>
            </div>
            <p className="text-xs text-gray-400">
              {formData.addToPoolOnDiscover
                ? t('servers.form.addToPoolDescOn')
                : t('servers.form.addToPoolDescOff')}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.defaultOwner')}</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              value={formData.defaultOperatorId || ''}
              onChange={(e) =>
                setFormData({ ...formData, defaultOperatorId: e.target.value || undefined })
              }
              disabled={formData.addToPoolOnDiscover}
            >
              <option value="" className="bg-gray-900 text-white">{t('servers.form.noDefaultOwner')}</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id} className="bg-gray-900 text-white">
                  {op.username} ({op.role})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {formData.addToPoolOnDiscover
                ? t('servers.form.disabledWhenPool')
                : t('servers.form.assignedToOperator')}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-white">{t('servers.form.ipCost')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.ipCost || 0}
                onChange={(e) => setFormData({ ...formData, ipCost: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('servers.form.ipCostHelp')}</p>
          </div>
          <div className="border-t border-border pt-4 mt-2">
            <h3 className="text-sm font-semibold text-white mb-3">{t('servers.form.cfTitle')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white">{t('servers.form.cfEmail')}</label>
                <Input
                  type="email"
                  value={formData.cfEmail}
                  onChange={(e) => setFormData({ ...formData, cfEmail: e.target.value })}
                  placeholder={t('servers.form.cfEmailPlaceholder')}
                />
                <p className="text-xs text-gray-400 mt-1">{t('servers.form.cfEmailHelp')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-white">{t('servers.form.cfApiKey')}</label>
                <Input
                  type="password"
                  value={formData.cfApiKey}
                  onChange={(e) => setFormData({ ...formData, cfApiKey: e.target.value })}
                  placeholder={t('servers.form.cfApiKeyPlaceholder')}
                />
                <p className="text-xs text-gray-400 mt-1">{t('servers.form.cfApiKeyHelp')}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-4 mt-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-semibold text-white w-full"
              onClick={() => setShowInitialDomains(!showInitialDomains)}
            >
              {showInitialDomains ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {t('servers.form.initialDomains')}
              {initialDomainsCount > 0 && (
                <span className="text-xs text-gray-400 font-normal">
                  ({initialDomainsCount})
                </span>
              )}
            </button>
            {showInitialDomains && (
              <div className="mt-3">
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y"
                  value={initialDomainsText}
                  onChange={(e) => setInitialDomainsText(e.target.value)}
                  placeholder={t('servers.form.initialDomainsPlaceholder')}
                />
                <p className="text-xs text-gray-400 mt-1">{t('servers.form.initialDomainsHelp')}</p>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? t('common.adding') : t('servers.addServer')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
