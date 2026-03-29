import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, FolderOpen, X, FileIcon, Download, Eye, FileText, Save, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Offer, CreateOfferDto, UpdateOfferDto } from '@server-panel/types';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

function getPreviewUrl(offerId: string) {
  return `/api/offers/${offerId}/preview/`;
}

export function OffersPage() {
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState<CreateOfferDto>({
    name: '',
    folderName: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [viewingOffer, setViewingOffer] = useState<Offer | null>(null);
  const [editingFile, setEditingFile] = useState<{ offerId: string; filename: string; content: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: offers, isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: () => api.getOffers(),
  });

  const createMutation = useMutation({
    mutationFn: ({ data, files }: { data: CreateOfferDto; files?: File[] }) =>
      api.createOffer(data, files),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      const uploadedCount = result.uploadedFiles?.length || 0;
      if (uploadedCount > 0) {
        toast.success(t('offers.toast.createdWithFiles', { count: uploadedCount }));
      } else {
        toast.success(t('offers.toast.created'));
      }
      setShowCreateDialog(false);
      setFormData({ name: '', folderName: '', geo: '' });
      setSelectedFiles([]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create offer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOfferDto }) =>
      api.updateOffer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      toast.success(t('offers.toast.updated'));
      setShowEditDialog(false);
      setEditingOffer(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update offer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteOffer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      toast.success(t('offers.toast.deleted'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete offer');
    },
  });

  const { data: offerFiles, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['offer-files', viewingOffer?.id],
    queryFn: () => api.getOfferFiles(viewingOffer!.id),
    enabled: !!viewingOffer,
  });

  const updateFileMutation = useMutation({
    mutationFn: ({ offerId, filename, content }: { offerId: string; filename: string; content: string }) =>
      api.updateOfferFile(offerId, filename, content),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['offer-files', editingFile?.offerId] });
      toast.success(t('offers.toast.fileSaved', { name: data.backupCreated }));
      setEditingFile(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update file');
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => api.downloadOffer(id),
    onSuccess: (blob, id) => {
      const offer = offers?.find(o => o.id === id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${offer?.folderName || 'offer'}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t('offers.toast.downloaded'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to download offer');
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.folderName.trim()) {
      toast.error(t('offers.createDialog.fillAll'));
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error(t('offers.createDialog.selectFiles'));
      return;
    }
    createMutation.mutate({ data: formData, files: selectedFiles });
  };

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('File/folder input change event triggered', files);

    if (files && files.length > 0) {
      const fileArray = Array.from(files);

      // Check if this is a folder selection (files will have webkitRelativePath)
      const isFolder = fileArray.some(f => (f as any).webkitRelativePath);

      console.log(
        isFolder
          ? `Selected folder contents: ${fileArray.map(f => (f as any).webkitRelativePath || f.name).join(', ')}`
          : `Selected files: ${fileArray.map(f => f.name).join(', ')}`
      );

      setSelectedFiles(prev => {
        const newFiles = [...prev, ...fileArray];
        console.log('Updated file list:', newFiles.map(f => (f as any).webkitRelativePath || f.name));
        return newFiles;
      });

      // Show appropriate toast message
      if (isFolder) {
        const folderName = (fileArray[0] as any).webkitRelativePath?.split('/')[0] || 'folder';
        toast.success(`Added ${files.length} file${files.length > 1 ? 's' : ''} from "${folderName}"`);
      } else {
        toast.success(`Added ${files.length} file${files.length > 1 ? 's' : ''}`);
      }
    }

    // Reset input so same files/folder can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData({
      name: offer.name,
      folderName: offer.folderName,
      geo: offer.geo || '',
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!editingOffer) return;
    if (!formData.name.trim() || !formData.folderName.trim()) {
      toast.error(t('offers.createDialog.fillAll'));
      return;
    }
    updateMutation.mutate({ id: editingOffer.id, data: formData });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(t('offers.deleteConfirm', { name }))) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = (type: 'create' | 'edit') => {
    if (type === 'create') {
      setShowCreateDialog(false);
      setSelectedFiles([]);
    } else {
      setShowEditDialog(false);
      setEditingOffer(null);
    }
    setFormData({ name: '', folderName: '', geo: '' });
  };

  const handleViewFiles = (offer: Offer) => {
    setViewingOffer(offer);
  };

  const handleEditFile = async (offerId: string, filename: string) => {
    try {
      const fileData = await api.getOfferFile(offerId, filename);
      setEditingFile({
        offerId,
        filename,
        content: fileData.content,
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load file');
    }
  };

  const handleSaveFile = () => {
    if (!editingFile) return;
    updateFileMutation.mutate({
      offerId: editingFile.offerId,
      filename: editingFile.filename,
      content: editingFile.content,
    });
  };

  const handleDownload = (id: string) => {
    downloadMutation.mutate(id);
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('offers.title')}</h1>
          <p className="text-gray-400">{t('offers.description')}</p>
        </div>
        {isAdmin() && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('offers.newOffer')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-gray-400">{t('offers.loadingOffers')}</div>
      ) : offers && offers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <Card
              key={offer.id}
              className="transition-colors hover:bg-accent/50 cursor-pointer group"
              onClick={() => window.open(getPreviewUrl(offer.id), '_blank')}
            >
              <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-white truncate">{offer.name}</h3>
                        {offer.geo && (
                          <span className="inline-flex items-center rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 uppercase flex-shrink-0">{offer.geo}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">
                        <code className="text-blue-300 text-xs">{offer.folderName}</code>
                      </p>
                    </div>
                    <div className="flex gap-0.5 ml-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(getPreviewUrl(offer.id), '_blank')}
                        title={t('offers.previewOffer')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-purple-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleViewFiles(offer)}
                        title={t('offers.viewFiles')}
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDownload(offer.id)}
                        title={t('offers.downloadOffer')}
                        disabled={downloadMutation.isPending}
                      >
                        <Download className="h-3.5 w-3.5 text-green-400" />
                      </Button>
                      {isAdmin() && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(offer)}
                            title={t('offers.editOffer')}
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDelete(offer.id, offer.name)}
                            title={t('offers.deleteOffer')}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">{t('offers.noOffers')}</h3>
            <p className="text-gray-400 mb-4">
              {isAdmin() ? t('offers.noOffersDescAdmin') : t('offers.noOffersDesc')}
            </p>
            {isAdmin() && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('offers.createFirstOffer')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Offer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && handleCloseDialog('create')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('offers.createDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('offers.createDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('offers.createDialog.offerName')}
              </label>
              <Input
                placeholder={t('offers.createDialog.offerNamePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('offers.createDialog.offerNameHelp')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('offers.createDialog.offerFolder')}
              </label>
              <Input
                placeholder={t('offers.createDialog.offerFolderPlaceholder')}
                value={formData.folderName}
                onChange={(e) => setFormData({ ...formData, folderName: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1">{t('offers.createDialog.offerFolderHelpText')} <code>/offers</code></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('offers.createDialog.geo')}
              </label>
              <Input
                placeholder={t('offers.createDialog.geoPlaceholder')}
                value={formData.geo || ''}
                onChange={(e) => setFormData({ ...formData, geo: e.target.value.toUpperCase() })}
                maxLength={5}
                className="w-32"
              />
              <p className="text-xs text-gray-400 mt-1">{t('offers.createDialog.geoHelp')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('offers.createDialog.attachFiles')}
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    // @ts-ignore - webkitdirectory is not in TypeScript types but is widely supported
                    webkitdirectory=""
                    directory=""
                    onChange={handleFilesSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={createMutation.isPending}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {t('offers.createDialog.chooseFiles')}
                  </Button>
                  <p className="text-xs text-gray-400">
                    {t('offers.createDialog.chooseFilesHelp')}
                  </p>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-white">
                        {t('offers.createDialog.filesSelected', { count: selectedFiles.length })}
                      </span>
                      <span className="text-gray-400">
                        {t('offers.createDialog.totalSize', { size: formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0)) })}
                      </span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-700 rounded-md p-3">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-800 rounded px-3 py-2"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">
                                {(file as any).webkitRelativePath || file.name}
                              </p>
                              <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFile(index)}
                            disabled={createMutation.isPending}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleCloseDialog('create')}
              disabled={createMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || selectedFiles.length === 0}
            >
              {createMutation.isPending
                ? t('offers.createDialog.uploading', { count: selectedFiles.length })
                : selectedFiles.length > 0
                ? t('offers.createDialog.createWith', { count: selectedFiles.length })
                : t('offers.createDialog.selectToCreate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Offer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => !open && handleCloseDialog('edit')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('offers.editDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('offers.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('offers.createDialog.offerName')}
              </label>
              <Input
                placeholder={t('offers.createDialog.offerNamePlaceholder')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('offers.createDialog.offerFolder')}
              </label>
              <Input
                placeholder={t('offers.createDialog.offerFolderPlaceholder')}
                value={formData.folderName}
                onChange={(e) => setFormData({ ...formData, folderName: e.target.value })}
              />
              <p className="text-xs text-yellow-400 mt-1">
                {t('offers.editDialog.folderWarning')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t('offers.createDialog.geo')}
              </label>
              <Input
                placeholder={t('offers.createDialog.geoPlaceholder')}
                value={formData.geo || ''}
                onChange={(e) => setFormData({ ...formData, geo: e.target.value.toUpperCase() })}
                maxLength={5}
                className="w-32"
              />
              <p className="text-xs text-gray-400 mt-1">{t('offers.createDialog.geoHelp')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleCloseDialog('edit')}
              disabled={updateMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t('common.updating') : t('offers.editDialog.updateOffer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Files Dialog */}
      <Dialog open={!!viewingOffer} onOpenChange={(open) => !open && setViewingOffer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Files in {viewingOffer?.name}</DialogTitle>
            <DialogDescription>
              Viewing files in folder: <code className="text-blue-300">{viewingOffer?.folderName}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {isLoadingFiles ? (
              <div className="text-gray-400 py-8 text-center">Loading files...</div>
            ) : offerFiles && offerFiles.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {offerFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between bg-gray-800 rounded px-4 py-3 hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)} • Modified: {formatDate(file.modifiedAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditFile(viewingOffer!.id, file.name)}
                    >
                      <Pencil className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileIcon className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                <p className="text-gray-400">No files in this offer</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingOffer(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit File Dialog */}
      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit File</DialogTitle>
            <DialogDescription>
              Editing: <code className="text-blue-300">{editingFile?.filename}</code>
              <br />
              <span className="text-yellow-400 text-xs">A backup will be created before saving changes</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <textarea
              value={editingFile?.content || ''}
              onChange={(e) => setEditingFile(editingFile ? { ...editingFile, content: e.target.value } : null)}
              className="w-full h-full min-h-[400px] bg-gray-900 text-white font-mono text-sm p-4 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
              spellCheck={false}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingFile(null)}
              disabled={updateFileMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveFile}
              disabled={updateFileMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateFileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
