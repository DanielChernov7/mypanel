import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users as UsersIcon, Plus, Edit, Trash2, Shield, User as UserIcon, Save, Globe, FolderTree, Scan, LayoutList, Wrench, Activity, Bell, Server, CheckCircle, XCircle, Wifi } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { User, CreateUserDto, UpdateUserDto, UserRole } from '@server-panel/types';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // System Settings state
  const [whiteBasePrefix, setWhiteBasePrefix] = useState('');
  const [offerSubfolder, setOfferSubfolder] = useState('');
  const [crmScriptPaths, setCrmScriptPaths] = useState<string[]>([]);
  const [newCrmPath, setNewCrmPath] = useState('');
  const [offerFolderPaths, setOfferFolderPaths] = useState<string[]>([]);
  const [newOfferFolderPath, setNewOfferFolderPath] = useState('');
  const [palladiumCloakingEnabled, setPalladiumCloakingEnabled] = useState(false);
  const [palladiumApiBaseUrl, setPalladiumApiBaseUrl] = useState('');
  const [palladiumApiToken, setPalladiumApiToken] = useState('');
  const [palladiumBotUrl, setPalladiumBotUrl] = useState('');
  const [scanningDomains, setScanningDomains] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(false);
  const [healthCheckInterval, setHealthCheckInterval] = useState('30');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [healthCheckNodes, setHealthCheckNodes] = useState<string[]>([]);
  const [availableNodes, setAvailableNodes] = useState<Array<{ nodeId: string; countryCode: string; country: string; city: string }>>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);

  // Custom Check Nodes state
  const [checkNodes, setCheckNodes] = useState<any[]>([]);
  const [loadingCheckNodes, setLoadingCheckNodes] = useState(false);
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [showEditNodeDialog, setShowEditNodeDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);
  const [nodeFormData, setNodeFormData] = useState({
    name: '',
    ip: '',
    sshPort: 22,
    username: 'root',
    authType: 'password',
    credentials: '',
    countryCode: '',
    country: '',
    city: '',
  });

  const [formData, setFormData] = useState<CreateUserDto>({
    username: '',
    password: '',
    role: 'OPERATOR' as UserRole,
    buyerTag: '',
    domainLimit: 0,
    domainsPerPage: 20,
  });

  const [editFormData, setEditFormData] = useState<UpdateUserDto>({
    username: '',
    password: '',
    role: 'OPERATOR' as UserRole,
    buyerTag: '',
    domainLimit: 0,
    domainsPerPage: 20,
  });


  // Fetch global settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
  });

  // Update system settings form when settings change
  useEffect(() => {
    if (settings) {
      setWhiteBasePrefix(settings.whiteBasePrefix || '/var/www/');
      setOfferSubfolder(settings.offerSubfolder || 'product');
      setCrmScriptPaths(settings.crmScriptPaths || []);
      setOfferFolderPaths(settings.offerFolderPaths || []);
      setPalladiumCloakingEnabled(settings.palladiumCloakingEnabled || false);
      setPalladiumApiBaseUrl(settings.palladiumApiBaseUrl || 'https://api.palladium.expert/v1');
      setPalladiumApiToken(settings.palladiumApiToken || '');
      setPalladiumBotUrl(settings.palladiumBotUrl || 'bot.php');
      setMaintenanceMode(settings.maintenanceMode || false);
      setHealthCheckEnabled(settings.healthCheckEnabled || false);
      setHealthCheckInterval(settings.healthCheckIntervalMinutes || '30');
      setTelegramBotToken(settings.telegramBotToken || '');
      setTelegramChatId(settings.telegramChatId || '');
      setHealthCheckNodes(settings.healthCheckNodes || []);
    }
  }, [settings]);

  // Load check nodes
  const loadCheckNodes = async () => {
    try {
      setLoadingCheckNodes(true);
      const data = await api.getCheckNodes();
      setCheckNodes(data);
    } catch (error: any) {
      console.error('Failed to load check nodes:', error);
    } finally {
      setLoadingCheckNodes(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadCheckNodes();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (error: any) {
      toast.error(t('users.settings.settingsFailed'));
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!formData.username || !formData.password) {
        toast.error(t('users.toast.usernamePasswordRequired'));
        return;
      }

      if (formData.password.length < 6) {
        toast.error(t('users.toast.passwordMin'));
        return;
      }

      if (!formData.buyerTag || formData.buyerTag.trim() === '') {
        toast.error(t('users.toast.buyerTagRequired'));
        return;
      }

      await api.createUser(formData);
      toast.success(t('users.toast.created'));
      setShowCreateDialog(false);
      setFormData({
        username: '',
        password: '',
        role: 'OPERATOR' as UserRole,
        buyerTag: '',
        domainLimit: 0,
        domainsPerPage: 20,
      });
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      // Validate buyer tag
      if (!editFormData.buyerTag || editFormData.buyerTag.trim() === '') {
        toast.error(t('users.toast.buyerTagRequired'));
        return;
      }

      // Only include fields that have values
      const updateData: UpdateUserDto = {};
      if (editFormData.username) updateData.username = editFormData.username;
      if (editFormData.password) {
        if (editFormData.password.length < 6) {
          toast.error(t('users.toast.passwordMin'));
          return;
        }
        updateData.password = editFormData.password;
      }
      if (editFormData.role) updateData.role = editFormData.role;
      if (editFormData.buyerTag) updateData.buyerTag = editFormData.buyerTag;
      if (editFormData.domainLimit !== undefined) updateData.domainLimit = editFormData.domainLimit;
      if (editFormData.domainsPerPage !== undefined) updateData.domainsPerPage = editFormData.domainsPerPage;

      await api.updateUser(selectedUser.id, updateData);
      toast.success(t('users.toast.updated'));
      setShowEditDialog(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await api.deleteUser(selectedUser.id);
      toast.success(t('users.toast.deleted'));
      setShowDeleteDialog(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.updateSetting(key, value),
    onSuccess: (data, variables) => {
      // Update the cache immediately with the response data
      if (data && data.data) {
        queryClient.setQueryData(['settings'], data.data);
      }
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Only show success toast for non-path arrays (they have their own error handling)
      if (variables.key !== 'crmScriptPaths' && variables.key !== 'offerFolderPaths') {
        toast.success(t('users.settings.settingsSaved'));
      }
    },
    onError: (error: any, variables) => {
      // Only show error toast for non-path arrays (they have their own error handling)
      if (variables.key !== 'crmScriptPaths' && variables.key !== 'offerFolderPaths') {
        const errorMessage = error?.response?.data?.error || error.message;
        toast.error(t('users.settings.settingsFailed'));
      }
    },
  });

  const handleSavePathSettings = () => {
    const updates = [
      { key: 'whiteBasePrefix', value: whiteBasePrefix },
      { key: 'offerSubfolder', value: offerSubfolder },
      { key: 'crmScriptPaths', value: JSON.stringify(crmScriptPaths) },
    ];

    updates.forEach(update => updateSettingMutation.mutate(update));
  };

  const handleAddCrmPath = async () => {
    if (newCrmPath.trim()) {
      const pathToAdd = newCrmPath.trim();

      // Validate path contains {domain} placeholder
      if (!pathToAdd.includes('{domain}')) {
        toast.error(t('users.settings.crmScriptPathsHelp'));
        return;
      }

      const newPaths = [...crmScriptPaths, pathToAdd];

      // Clear input immediately for better UX
      setNewCrmPath('');

      // Auto-save to database
      try {
        await updateSettingMutation.mutateAsync({
          key: 'crmScriptPaths',
          value: JSON.stringify(newPaths)
        });
        // State will be updated automatically via invalidateQueries in mutation's onSuccess
      } catch (error: any) {
        // Restore input on error
        setNewCrmPath(pathToAdd);
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save CRM script path';
        toast.error(errorMessage);
      }
    }
  };

  const handleRemoveCrmPath = async (index: number) => {
    const newPaths = crmScriptPaths.filter((_, i) => i !== index);
    const removedPath = crmScriptPaths[index];

    // Auto-save to database
    try {
      await updateSettingMutation.mutateAsync({
        key: 'crmScriptPaths',
        value: JSON.stringify(newPaths)
      });
      // State will be updated automatically via invalidateQueries in mutation's onSuccess
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to remove CRM script path';
      toast.error(errorMessage);
    }
  };

  const handleAddOfferFolderPath = async () => {
    if (newOfferFolderPath.trim()) {
      const pathToAdd = newOfferFolderPath.trim();

      // Validate path contains {domain} placeholder
      if (!pathToAdd.includes('{domain}')) {
        toast.error(t('users.settings.offerFolderPathsHelp'));
        return;
      }

      // Validate path contains {offerFolder} placeholder
      if (!pathToAdd.includes('{offerFolder}')) {
        toast.error(t('users.settings.offerFolderPathsHelp'));
        return;
      }

      const newPaths = [...offerFolderPaths, pathToAdd];

      // Clear input immediately for better UX
      setNewOfferFolderPath('');

      // Auto-save to database
      try {
        await updateSettingMutation.mutateAsync({
          key: 'offerFolderPaths',
          value: JSON.stringify(newPaths)
        });
        // State will be updated automatically via invalidateQueries in mutation's onSuccess
      } catch (error: any) {
        // Restore input on error
        setNewOfferFolderPath(pathToAdd);
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save offer folder path';
        toast.error(errorMessage);
      }
    }
  };

  const handleRemoveOfferFolderPath = async (index: number) => {
    const newPaths = offerFolderPaths.filter((_, i) => i !== index);

    // Auto-save to database
    try {
      await updateSettingMutation.mutateAsync({
        key: 'offerFolderPaths',
        value: JSON.stringify(newPaths)
      });
      // State will be updated automatically via invalidateQueries in mutation's onSuccess
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to remove offer folder path';
      toast.error(errorMessage);
    }
  };

  const handleSavePalladiumSettings = () => {
    const updates = [
      { key: 'palladiumCloakingEnabled', value: palladiumCloakingEnabled ? 'true' : 'false' },
      { key: 'palladiumApiBaseUrl', value: palladiumApiBaseUrl },
      { key: 'palladiumApiToken', value: palladiumApiToken },
      { key: 'palladiumBotUrl', value: palladiumBotUrl },
    ];

    updates.forEach(update => updateSettingMutation.mutate(update));
  };

  const handleToggleMaintenanceMode = () => {
    const newValue = !maintenanceMode;
    setMaintenanceMode(newValue);
    updateSettingMutation.mutate(
      { key: 'maintenanceMode', value: newValue ? 'true' : 'false' },
      {
        onSuccess: () => {
          toast.success(t('users.settings.settingsSaved'));
        },
      }
    );
  };

  const handleScanDomains = async () => {
    try {
      setScanningDomains(true);
      const response = await api.scanDeploymentStatus();
      toast.success(`Scan started! Job ID: ${response.jobId}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start scan');
    } finally {
      setScanningDomains(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      username: user.username,
      password: '', // Leave blank - only update if provided
      role: user.role,
      buyerTag: user.buyerTag || '',
      domainLimit: user.domainLimit || 0,
      domainsPerPage: user.domainsPerPage || 20,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const getRoleBadgeClass = (role: UserRole) => {
    return role === 'ADMIN'
      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  };

  const getRoleIcon = (role: UserRole) => {
    return role === 'ADMIN' ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">{t('users.loadingUsers')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <UsersIcon className="h-8 w-8" />
            {t('users.title')}
          </h1>
          <p className="text-gray-400 mt-1">{t('users.usersDesc')}</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('users.addUser')}
        </Button>
      </div>

      {/* User Management Section */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">{t('users.usersSection')}</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('users.table.username')}</TableHead>
              <TableHead>{t('users.table.role')}</TableHead>
              <TableHead>{t('users.table.buyerTag')}</TableHead>
              <TableHead>{t('users.table.domainsPerPage')}</TableHead>
              <TableHead>{t('common.created')}</TableHead>
              <TableHead className="text-right">{t('users.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRoleBadgeClass(user.role)}`}
                  >
                    {getRoleIcon(user.role)}
                    {user.role}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{user.buyerTag || '-'}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-mono">{user.domainsPerPage || 20}</span>
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(user)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* System Settings Section */}
      <div className="border-t border-gray-700 pt-6 mt-8">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-500" />
          {t('users.settings.title')}
        </h2>
        <p className="text-gray-400 mb-6">{t('users.settings.pathConfigDesc')}</p>

        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 mb-6">
          <p className="text-sm text-blue-200">
            <strong>Administrator Notice:</strong> These settings affect the entire system and all users. Changes made here will apply to all future operations.
          </p>
        </div>

        <div className="space-y-6">
          {/* Path Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-blue-500" />
                <CardTitle>{t('users.settings.pathConfig')}</CardTitle>
              </div>
              <CardDescription>
                {t('users.settings.pathConfigDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">
                  {t('users.settings.whiteBasePrefix')}
                </label>
                <Input
                  type="text"
                  value={whiteBasePrefix}
                  onChange={(e) => setWhiteBasePrefix(e.target.value)}
                  placeholder="/var/www/"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Base directory for domain whitepages (e.g., /var/www/)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">
                  {t('users.settings.offerSubfolder')}
                </label>
                <Input
                  type="text"
                  value={offerSubfolder}
                  onChange={(e) => setOfferSubfolder(e.target.value)}
                  placeholder="product"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Subfolder name for offer files within domain directory
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">
                  {t('users.settings.crmScriptPaths')}
                </label>
                <p className="text-xs text-muted-foreground">
                  CRM script paths that contain the {'{{BUYER_TAG}}'} placeholder.
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                  ⚠️ Required: Use {'{domain}'} as domain placeholder in each path
                </p>

                {/* List of existing paths */}
                {crmScriptPaths.length > 0 && (
                  <div className="space-y-2">
                    {crmScriptPaths.map((path, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
                        <span className="flex-1 text-sm font-mono text-foreground">{path}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCrmPath(index)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new path input */}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newCrmPath}
                    onChange={(e) => setNewCrmPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCrmPath();
                      }
                    }}
                    placeholder='/var/www/{domain}/thanks_you.php'
                    className="font-mono flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCrmPath}
                    disabled={!newCrmPath.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('users.settings.addPath')}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">
                  {t('users.settings.offerFolderPaths')}
                </label>
                <p className="text-xs text-muted-foreground">
                  Files where the {'<base href="./{offerFolder}/">'} tag will be replaced with the actual offer folder name.
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                  Required: Use {'{domain}'} and {'{offerFolder}'} placeholders in each path
                </p>

                {/* List of existing paths */}
                {offerFolderPaths.length > 0 && (
                  <div className="space-y-2">
                    {offerFolderPaths.map((path, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
                        <span className="flex-1 text-sm font-mono text-foreground">{path}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOfferFolderPath(index)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new path input */}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newOfferFolderPath}
                    onChange={(e) => setNewOfferFolderPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOfferFolderPath();
                      }
                    }}
                    placeholder='/var/www/{domain}/{offerFolder}/information.php'
                    className="font-mono flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOfferFolderPath}
                    disabled={!newOfferFolderPath.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('users.settings.addPath')}
                  </Button>
                </div>
              </div>

              <Button onClick={handleSavePathSettings} disabled={updateSettingMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {t('users.settings.savePaths')}
              </Button>
            </CardContent>
          </Card>

          {/* Palladium Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <CardTitle>{t('users.settings.palladium')}</CardTitle>
              </div>
              <CardDescription>
                {t('users.settings.palladiumDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="palladium-enabled"
                  checked={palladiumCloakingEnabled}
                  onChange={(e) => setPalladiumCloakingEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                <label
                  htmlFor="palladium-enabled"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  {t('users.settings.enableCloaking')}
                </label>
              </div>

              {palladiumCloakingEnabled && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground block">
                      {t('users.settings.apiBaseUrl')}
                    </label>
                    <Input
                      type="text"
                      value={palladiumApiBaseUrl}
                      onChange={(e) => setPalladiumApiBaseUrl(e.target.value)}
                      placeholder="https://api.palladium.expert/v1"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Base URL for Palladium API endpoints
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground block">
                      Palladium API Token
                    </label>
                    <Input
                      type="password"
                      value={palladiumApiToken}
                      onChange={(e) => setPalladiumApiToken(e.target.value)}
                      placeholder="Enter your Palladium API token"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your Palladium API authentication token (Bearer token)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground block">
                      Bot URL (Cloak Page)
                    </label>
                    <Input
                      type="text"
                      value={palladiumBotUrl}
                      onChange={(e) => setPalladiumBotUrl(e.target.value)}
                      placeholder="bot.php"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      The bot/cloak page URL used for Palladium campaigns (e.g., bot.php, cloak.php)
                    </p>
                  </div>
                </>
              )}

              <Button onClick={handleSavePalladiumSettings} disabled={updateSettingMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Palladium Settings
              </Button>

              {palladiumCloakingEnabled && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm border border-blue-200 dark:border-blue-800">
                  <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                    ✓ Palladium Integration Enabled
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Users will see the Palladium cloaking option when changing offers. Campaigns will be automatically created with selected GEO settings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Mode */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-500" />
                <CardTitle>Maintenance Mode</CardTitle>
              </div>
              <CardDescription>
                Block operator access during system maintenance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-md p-4 border ${
                maintenanceMode
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {maintenanceMode ? (
                      <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold mb-1 ${
                      maintenanceMode
                        ? 'text-orange-800 dark:text-orange-200'
                        : 'text-green-800 dark:text-green-200'
                    }`}>
                      {maintenanceMode ? '⚠️ Maintenance Mode Active' : '✓ System Operational'}
                    </p>
                    <p className={`text-sm ${
                      maintenanceMode
                        ? 'text-orange-700 dark:text-orange-300'
                        : 'text-green-700 dark:text-green-300'
                    }`}>
                      {maintenanceMode
                        ? 'Operators cannot access the panel. Only admins can log in and make changes.'
                        : 'All users have normal access to the panel.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Enable maintenance mode
                  </p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, operators will see a maintenance screen
                  </p>
                </div>
                <Button
                  onClick={handleToggleMaintenanceMode}
                  disabled={updateSettingMutation.isPending}
                  variant={maintenanceMode ? 'destructive' : 'default'}
                  className={maintenanceMode ? 'bg-orange-600 hover:bg-orange-700' : ''}
                >
                  {maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Health Check & Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-500" />
                <CardTitle>Health Check & Notifications</CardTitle>
              </div>
              <CardDescription>
                Periodic health checks for active domains with Telegram notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Health Check Enabled</p>
                  <p className="text-xs text-gray-400">Automatically check all active domains on a schedule</p>
                </div>
                <button
                  onClick={() => {
                    const newValue = !healthCheckEnabled;
                    setHealthCheckEnabled(newValue);
                    updateSettingMutation.mutate({
                      key: 'healthCheckEnabled',
                      value: newValue ? 'true' : 'false',
                    });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    healthCheckEnabled ? 'bg-cyan-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      healthCheckEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Interval */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-200">Check Interval (minutes)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="1440"
                    value={healthCheckInterval}
                    onChange={(e) => setHealthCheckInterval(e.target.value)}
                    className="w-32"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      updateSettingMutation.mutate({
                        key: 'healthCheckIntervalMinutes',
                        value: healthCheckInterval,
                      });
                    }}
                    disabled={updateSettingMutation.isPending}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>

              {/* Check Nodes */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <div className="space-y-1 mb-3">
                  <label className="text-sm font-medium text-gray-200">{t('users.settings.healthCheckNodes')}</label>
                  <p className="text-xs text-gray-400">{t('users.settings.healthCheckNodesDesc')}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setLoadingNodes(true);
                        try {
                          const nodes = await api.getCheckHostNodes();
                          setAvailableNodes(nodes);
                        } catch (error: any) {
                          toast.error(error.message || 'Failed to load nodes');
                        } finally {
                          setLoadingNodes(false);
                        }
                      }}
                      disabled={loadingNodes}
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      {loadingNodes ? t('users.settings.loadingNodes') : t('users.settings.loadNodes')}
                    </Button>
                    <span className="text-xs text-gray-400">
                      {healthCheckNodes.length > 0
                        ? t('users.settings.nodesSelected', { count: healthCheckNodes.length })
                        : t('users.settings.nodesAutomatic')}
                    </span>
                  </div>

                  {availableNodes.length > 0 && (
                    <>
                      <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-md p-2 space-y-1">
                        {(() => {
                          // Group nodes by country code
                          const grouped = new Map<string, typeof availableNodes>();
                          for (const node of availableNodes) {
                            const key = node.countryCode.toUpperCase();
                            if (!grouped.has(key)) grouped.set(key, []);
                            grouped.get(key)!.push(node);
                          }
                          // Sort groups by country code
                          const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                          return sortedGroups.map(([cc, nodes]) => (
                            <div key={cc} className="space-y-0.5">
                              {nodes.map((node) => (
                                <label key={node.nodeId} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700/50 cursor-pointer text-sm">
                                  <input
                                    type="checkbox"
                                    checked={healthCheckNodes.includes(node.nodeId)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setHealthCheckNodes([...healthCheckNodes, node.nodeId]);
                                      } else {
                                        setHealthCheckNodes(healthCheckNodes.filter(n => n !== node.nodeId));
                                      }
                                    }}
                                    className="rounded border-gray-600"
                                  />
                                  <span className="text-gray-200">
                                    {cc} / {node.city}
                                  </span>
                                  <span className="text-gray-500 text-xs ml-auto">{node.nodeId}</span>
                                </label>
                              ))}
                            </div>
                          ));
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateSettingMutation.mutate({
                              key: 'healthCheckNodes',
                              value: JSON.stringify(healthCheckNodes),
                            });
                          }}
                          disabled={updateSettingMutation.isPending}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          {t('users.settings.saveNodes')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setHealthCheckNodes([]);
                          }}
                        >
                          Clear All
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Telegram Settings */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">Telegram Notifications</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm text-gray-300">Bot Token</label>
                    <Input
                      type="password"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      placeholder="123456:ABC-DEF1234ghIkl..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-gray-300">Chat ID</label>
                    <Input
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="-1001234567890"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      updateSettingMutation.mutate({ key: 'telegramBotToken', value: telegramBotToken });
                      updateSettingMutation.mutate({ key: 'telegramChatId', value: telegramChatId });
                    }}
                    disabled={updateSettingMutation.isPending}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save Telegram Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custom Health Check Nodes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-500" />
                <CardTitle>Custom Health Check Nodes</CardTitle>
              </div>
              <CardDescription>
                Custom VPS nodes for geo-specific health checks via SSH (curl + dig)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  {checkNodes.length} node(s) configured, {checkNodes.filter((n: any) => n.enabled).length} enabled
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setNodeFormData({
                      name: '', ip: '', sshPort: 22, username: 'root',
                      authType: 'password', credentials: '', countryCode: '', country: '', city: '',
                    });
                    setShowAddNodeDialog(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Node
                </Button>
              </div>

              {loadingCheckNodes ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : checkNodes.length === 0 ? (
                <div className="text-sm text-gray-500">No custom check nodes configured. Add a VPS to use as a health check probe.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead>Last Check</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkNodes.map((node: any) => (
                      <TableRow key={node.id}>
                        <TableCell className="font-medium">{node.name}</TableCell>
                        <TableCell className="font-mono text-sm">{node.ip}:{node.sshPort}</TableCell>
                        <TableCell>
                          <span className="text-sm">{node.countryCode} {node.city ? `/ ${node.city}` : ''}</span>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={async () => {
                              try {
                                await api.updateCheckNode(node.id, { enabled: !node.enabled });
                                loadCheckNodes();
                                toast.success(node.enabled ? 'Node disabled' : 'Node enabled');
                              } catch (err: any) {
                                toast.error(err.message);
                              }
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              node.enabled ? 'bg-cyan-600' : 'bg-gray-600'
                            }`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              node.enabled ? 'translate-x-5' : 'translate-x-1'
                            }`} />
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-gray-400">
                          {node.lastCheckAt ? new Date(node.lastCheckAt).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          {node.lastError ? (
                            <span className="text-xs text-red-400 truncate max-w-[120px] inline-block" title={node.lastError}>
                              {node.lastError.substring(0, 30)}...
                            </span>
                          ) : node.lastCheckAt ? (
                            <span className="text-xs text-green-400">OK</span>
                          ) : (
                            <span className="text-xs text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                setTestingNodeId(node.id);
                                try {
                                  const result = await api.testCheckNode(node.id);
                                  if (result.success) {
                                    toast.success(result.message);
                                  } else {
                                    toast.error(result.message);
                                  }
                                  loadCheckNodes();
                                } catch (err: any) {
                                  toast.error(err.message);
                                } finally {
                                  setTestingNodeId(null);
                                }
                              }}
                              disabled={testingNodeId === node.id}
                            >
                              <Wifi className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingNode(node);
                                setNodeFormData({
                                  name: node.name,
                                  ip: node.ip,
                                  sshPort: node.sshPort,
                                  username: node.username,
                                  authType: node.authType,
                                  credentials: '',
                                  countryCode: node.countryCode,
                                  country: node.country,
                                  city: node.city || '',
                                });
                                setShowEditNodeDialog(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                if (!confirm(`Delete check node "${node.name}"?`)) return;
                                try {
                                  await api.deleteCheckNode(node.id);
                                  loadCheckNodes();
                                  toast.success('Node deleted');
                                } catch (err: any) {
                                  toast.error(err.message);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Domain Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scan className="h-5 w-5 text-blue-500" />
                <CardTitle>Domain Management</CardTitle>
              </div>
              <CardDescription>
                Scan all domains to check deployment status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                  Scan All Domains
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  This will check all domains to determine if their deployment directory (/var/www/domain.com) is empty or has files. The scan runs as a background job and updates the isEmpty flag for each domain.
                </p>
              </div>

              <Button
                onClick={handleScanDomains}
                disabled={scanningDomains}
                className="w-full sm:w-auto"
              >
                <Scan className="h-4 w-4 mr-2" />
                {scanningDomains ? 'Starting Scan...' : 'Scan All Domains'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user account to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-200">Username *</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">Password *</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">Role *</label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as UserRole })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              >
                <option value="OPERATOR">Operator</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {/* Buyer Tag Field */}
            <div>
              <label className="text-sm font-medium text-gray-200">Buyer Tag *</label>
              <Input
                value={formData.buyerTag}
                onChange={(e) => setFormData({ ...formData, buyerTag: e.target.value })}
                placeholder="Enter buyer tag"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Buyer tag associated with this user for deploy domains logic
              </p>
            </div>

            {/* Domains Per Page Field */}
            <div>
              <label className="text-sm font-medium text-gray-200 flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Domains Per Page
              </label>
              <select
                value={formData.domainsPerPage || 20}
                onChange={(e) =>
                  setFormData({ ...formData, domainsPerPage: parseInt(e.target.value) })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                How many domains to display per page in the Domains list
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user account details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-200">Username</label>
              <Input
                value={editFormData.username}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, username: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">
                New Password (leave blank to keep current)
              </label>
              <Input
                type="password"
                value={editFormData.password}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, password: e.target.value })
                }
                placeholder="Leave blank to keep current password"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">Role</label>
              <select
                value={editFormData.role}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, role: e.target.value as UserRole })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              >
                <option value="OPERATOR">Operator</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {/* Buyer Tag Field */}
            <div>
              <label className="text-sm font-medium text-gray-200">Buyer Tag *</label>
              <Input
                value={editFormData.buyerTag}
                onChange={(e) => setEditFormData({ ...editFormData, buyerTag: e.target.value })}
                placeholder="Enter buyer tag"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Buyer tag associated with this user for deploy domains logic
              </p>
            </div>

            {/* Domains Per Page Field */}
            <div>
              <label className="text-sm font-medium text-gray-200 flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Domains Per Page
              </label>
              <select
                value={editFormData.domainsPerPage || 20}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, domainsPerPage: parseInt(e.target.value) })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                How many domains to display per page in the Domains list
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Check Node Dialog */}
      <Dialog open={showAddNodeDialog} onOpenChange={setShowAddNodeDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Custom Check Node</DialogTitle>
            <DialogDescription>Add a VPS as a custom health check probe node</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-200">Name *</label>
              <Input
                value={nodeFormData.name}
                onChange={(e) => setNodeFormData({ ...nodeFormData, name: e.target.value })}
                placeholder="Latvia VPS"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-200">IP Address *</label>
                <Input
                  value={nodeFormData.ip}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, ip: e.target.value })}
                  placeholder="85.203.39.44"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">SSH Port</label>
                <Input
                  type="number"
                  value={nodeFormData.sshPort}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, sshPort: parseInt(e.target.value) || 22 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-200">Username</label>
                <Input
                  value={nodeFormData.username}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, username: e.target.value })}
                  placeholder="root"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">Auth Type</label>
                <select
                  value={nodeFormData.authType}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, authType: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="password">Password</option>
                  <option value="key">SSH Key</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">
                {nodeFormData.authType === 'key' ? 'Private Key *' : 'Password *'}
              </label>
              {nodeFormData.authType === 'key' ? (
                <textarea
                  value={nodeFormData.credentials}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, credentials: e.target.value })}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono text-xs h-24"
                />
              ) : (
                <Input
                  type="password"
                  value={nodeFormData.credentials}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, credentials: e.target.value })}
                  placeholder="SSH password"
                />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-200">Country Code *</label>
                <Input
                  value={nodeFormData.countryCode}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, countryCode: e.target.value.toUpperCase() })}
                  placeholder="LV"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">Country *</label>
                <Input
                  value={nodeFormData.country}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, country: e.target.value })}
                  placeholder="Latvia"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">City</label>
                <Input
                  value={nodeFormData.city}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, city: e.target.value })}
                  placeholder="Riga"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNodeDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                if (!nodeFormData.name || !nodeFormData.ip || !nodeFormData.credentials || !nodeFormData.countryCode || !nodeFormData.country) {
                  toast.error('Please fill in all required fields');
                  return;
                }
                await api.createCheckNode(nodeFormData);
                setShowAddNodeDialog(false);
                loadCheckNodes();
                toast.success('Check node created');
              } catch (err: any) {
                toast.error(err.message);
              }
            }}>
              Create Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Check Node Dialog */}
      <Dialog open={showEditNodeDialog} onOpenChange={setShowEditNodeDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Check Node</DialogTitle>
            <DialogDescription>Update check node settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-200">Name *</label>
              <Input
                value={nodeFormData.name}
                onChange={(e) => setNodeFormData({ ...nodeFormData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-200">IP Address *</label>
                <Input
                  value={nodeFormData.ip}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, ip: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">SSH Port</label>
                <Input
                  type="number"
                  value={nodeFormData.sshPort}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, sshPort: parseInt(e.target.value) || 22 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-200">Username</label>
                <Input
                  value={nodeFormData.username}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, username: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">Auth Type</label>
                <select
                  value={nodeFormData.authType}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, authType: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="password">Password</option>
                  <option value="key">SSH Key</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">
                {nodeFormData.authType === 'key' ? 'Private Key' : 'Password'} (leave empty to keep current)
              </label>
              {nodeFormData.authType === 'key' ? (
                <textarea
                  value={nodeFormData.credentials}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, credentials: e.target.value })}
                  placeholder="Leave empty to keep current key"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono text-xs h-24"
                />
              ) : (
                <Input
                  type="password"
                  value={nodeFormData.credentials}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, credentials: e.target.value })}
                  placeholder="Leave empty to keep current password"
                />
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-200">Country Code *</label>
                <Input
                  value={nodeFormData.countryCode}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, countryCode: e.target.value.toUpperCase() })}
                  maxLength={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">Country *</label>
                <Input
                  value={nodeFormData.country}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, country: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-200">City</label>
                <Input
                  value={nodeFormData.city}
                  onChange={(e) => setNodeFormData({ ...nodeFormData, city: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditNodeDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                if (!editingNode) return;
                const updateData: any = {
                  name: nodeFormData.name,
                  ip: nodeFormData.ip,
                  sshPort: nodeFormData.sshPort,
                  username: nodeFormData.username,
                  authType: nodeFormData.authType,
                  countryCode: nodeFormData.countryCode,
                  country: nodeFormData.country,
                  city: nodeFormData.city,
                };
                // Only include credentials if provided
                if (nodeFormData.credentials) {
                  updateData.credentials = nodeFormData.credentials;
                }
                await api.updateCheckNode(editingNode.id, updateData);
                setShowEditNodeDialog(false);
                setEditingNode(null);
                loadCheckNodes();
                toast.success('Check node updated');
              } catch (err: any) {
                toast.error(err.message);
              }
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user "{selectedUser?.username}"? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
