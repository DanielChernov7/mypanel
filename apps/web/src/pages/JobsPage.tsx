import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, QueueDiagnostics } from '@/lib/api';
import { Job, JobStatus, JobKind } from '@server-panel/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { RefreshCw, Clock, CheckCircle, XCircle, Loader2, StopCircle, AlertTriangle, XOctagon, Activity, ChevronDown, Skull, Database, AlertCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const STATUS_COLORS: Record<JobStatus, string> = {
  queued: 'bg-gray-500',
  pending: 'bg-yellow-500',
  running: 'bg-blue-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
  cancelling: 'bg-orange-500',
  cancelled: 'bg-gray-600',
  cancelled_with_warnings: 'bg-yellow-600',
};

const STATUS_ICONS: Record<JobStatus, any> = {
  queued: Clock,
  pending: Clock,
  running: Loader2,
  success: CheckCircle,
  failed: XCircle,
  cancelling: StopCircle,
  cancelled: XOctagon,
  cancelled_with_warnings: AlertTriangle,
};

const getJobKindLabel = (t: (key: string) => string, kind: JobKind): string => {
  const key = `jobs.kinds.${kind}`;
  return t(key);
};

export function JobsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const { isAdmin } = useAuth();

  const { data: diagnostics, isLoading: diagnosticsLoading, refetch: refetchDiagnostics } = useQuery({
    queryKey: ['queue-diagnostics'],
    queryFn: () => api.getQueueDiagnostics(),
    enabled: isAdmin() && diagnosticsOpen,
    refetchInterval: diagnosticsOpen ? 3000 : false,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', statusFilter, kindFilter],
    queryFn: () => {
      const filters: any = { limit: 50 };
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (kindFilter !== 'all') filters.kind = kindFilter;
      return api.getJobs(filters);
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const jobs = data?.jobs || [];
  const total = data?.total || 0;

  const handleForceFailJob = async (jobId: string) => {
    const confirmed = window.confirm(t('jobs.forceFailConfirm'));
    if (!confirmed) return;

    try {
      const result = await api.forceFailJob(jobId);
      toast.success(result.message);
      refetchDiagnostics();
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to force-fail job');
    }
  };

  const handleReEnqueueAll = async () => {
    const confirmed = window.confirm(t('jobs.reEnqueueConfirm'));
    if (!confirmed) return;

    try {
      const result = await api.reEnqueueOrphanedJobs();
      toast.success(result.message);
      refetchDiagnostics();
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to re-enqueue jobs');
    }
  };

  const handleCancelJob = async (jobId: string, jobKind: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(t('jobs.cancelConfirm', { type: getJobKindLabel(t, jobKind as JobKind) || jobKind }));

    if (!confirmed) return;

    try {
      const result = await api.cancelJob(jobId);
      toast.success(result.message || 'Job cancellation requested');

      // Refetch jobs to show updated status
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel job');
    }
  };

  const getStatusBadge = (status: JobStatus, job?: Job) => {
    // Check if this is a retry-pending job (queued with nextRetryAt)
    const isRetryPending = status === 'queued' && job?.nextRetryAt;

    const Icon = STATUS_ICONS[status];
    const badgeColor = isRetryPending ? 'bg-yellow-600' : STATUS_COLORS[status];
    const statusLabel = isRetryPending
      ? t('jobs.statuses.retryPending')
      : t(`jobs.statuses.${status}`);

    return (
      <Badge className={`${badgeColor} text-white gap-1`}>
        <Icon className={`h-3 w-3 ${status === 'running' || status === 'cancelling' ? 'animate-spin' : ''}`} />
        {statusLabel}
      </Badge>
    );
  };

  const getProgressBar = (job: Job) => {
    // Don't show progress bar for terminal states
    if (['success', 'failed', 'cancelled', 'cancelled_with_warnings'].includes(job.status)) {
      return null;
    }

    if (job.progress === 0) return null;

    // Use orange for cancelling status
    const barColor = job.status === 'cancelling' ? 'bg-orange-500' : 'bg-blue-500';

    return (
      <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${job.progress}%` }}
        />
      </div>
    );
  };

  const getDurationText = (job: Job) => {
    if (!job.startedAt) return null;

    const start = new Date(job.startedAt).getTime();
    const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now();
    const duration = Math.floor((end - start) / 1000);

    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('jobs.title')}</h1>
          <p className="text-gray-400">
            {t('jobs.description', { total })}
          </p>
        </div>

        <div className="flex gap-2">
          {isAdmin() && (
            <Button
              onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
              variant={diagnosticsOpen ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              {t('jobs.queueDiagnostics')}
            </Button>
          )}
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Queue Diagnostics Panel (Admin only) */}
      {isAdmin() && diagnosticsOpen && (
        <Card className="mb-6 border-yellow-500/50 bg-yellow-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-400">
              <Activity className="h-5 w-5" />
              {t('jobs.queueDiagnostics')}
              {diagnosticsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diagnostics ? (
              <div className="space-y-4">
                {/* Memory Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-gray-800 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-white">{diagnostics.memoryStats.runningJobs}</div>
                    <div className="text-xs text-gray-400">{t('jobs.diagnostics.runningMemory')}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-white">{diagnostics.memoryStats.queuedJobs}</div>
                    <div className="text-xs text-gray-400">{t('jobs.diagnostics.queuedMemory')}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-white">{diagnostics.memoryStats.maxConcurrentJobs}</div>
                    <div className="text-xs text-gray-400">{t('jobs.diagnostics.maxConcurrent')}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-white">{diagnostics.memoryStats.maxSSHJobs}</div>
                    <div className="text-xs text-gray-400">{t('jobs.diagnostics.maxSSH')}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-white">{diagnostics.memoryStats.jobTimeoutMinutes}m</div>
                    <div className="text-xs text-gray-400">{t('jobs.diagnostics.jobTimeout')}</div>
                  </div>
                </div>

                {/* Recommendations */}
                {diagnostics.recommendations.length > 0 && (
                  <div className="bg-red-950/30 border border-red-500/50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-red-400 font-medium">
                        <AlertCircle className="h-4 w-4" />
                        {t('jobs.diagnostics.issuesDetected')}
                      </div>
                      {/* Show Re-enqueue button if there are orphaned queued jobs */}
                      {diagnostics.dbQueuedJobs.length > 0 &&
                       diagnostics.memoryStats.queuedJobs === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReEnqueueAll}
                          className="gap-1 border-green-500 text-green-400 hover:bg-green-500/20"
                        >
                          <PlayCircle className="h-3 w-3" />
                          {t('jobs.reEnqueueButton', { count: diagnostics.dbQueuedJobs.length })}
                        </Button>
                      )}
                    </div>
                    <ul className="text-sm text-red-300 space-y-1">
                      {diagnostics.recommendations.map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mismatched Jobs (Critical) */}
                {diagnostics.mismatchedJobs.length > 0 && (
                  <div className="bg-red-950/30 border border-red-500/50 rounded p-3">
                    <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                      <Skull className="h-4 w-4" />
                      {t('jobs.diagnostics.mismatchedJobs')}
                    </div>
                    <div className="space-y-2">
                      {diagnostics.mismatchedJobs.map((job) => (
                        <div key={job.id} className="flex items-center justify-between bg-gray-900 rounded p-2">
                          <div className="text-sm">
                            <span className="text-white font-mono">{job.id.substring(0, 8)}</span>
                            <span className="text-gray-400 ml-2">{job.kind}</span>
                            {job.domain && <span className="text-blue-400 ml-2">{job.domain.name}</span>}
                            {job.createdBy && <span className="text-gray-500 ml-2">by {job.createdBy.username}</span>}
                            {job.runningMinutes !== undefined && (
                              <span className="text-yellow-400 ml-2">{t('jobs.diagnostics.stuckTime', { minutes: job.runningMinutes })}</span>
                            )}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleForceFailJob(job.id)}
                            className="gap-1"
                          >
                            <Skull className="h-3 w-3" />
                            {t('jobs.forceFailButton')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stuck Jobs */}
                {diagnostics.stuckJobs.length > 0 && (
                  <div className="bg-yellow-950/30 border border-yellow-500/50 rounded p-3">
                    <div className="flex items-center gap-2 text-yellow-400 font-medium mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      {t('jobs.diagnostics.stuckJobs')}
                    </div>
                    <div className="space-y-2">
                      {diagnostics.stuckJobs.map((job) => (
                        <div key={job.id} className="flex items-center justify-between bg-gray-900 rounded p-2">
                          <div className="text-sm">
                            <span className="text-white font-mono">{job.id.substring(0, 8)}</span>
                            <Badge className="ml-2 bg-blue-500">{job.status}</Badge>
                            <span className="text-gray-400 ml-2">{job.kind}</span>
                            {job.domain && <span className="text-blue-400 ml-2">{job.domain.name}</span>}
                            {job.createdBy && <span className="text-gray-500 ml-2">by {job.createdBy.username}</span>}
                            <span className="text-yellow-400 ml-2">{t('jobs.diagnostics.stuckProgress', { minutes: job.runningMinutes, percent: job.progress })}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleForceFailJob(job.id)}
                            className="gap-1 border-yellow-500 text-yellow-400 hover:bg-yellow-500/20"
                          >
                            <Skull className="h-3 w-3" />
                            {t('jobs.forceFailButton')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Jobs in DB */}
                {diagnostics.dbActiveJobs.length > 0 && (
                  <details className="group">
                    <summary className="flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer list-none">
                      <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                      <Database className="h-4 w-4" />
                      {t('jobs.diagnostics.activeJobsDB', { count: diagnostics.dbActiveJobs.length })}
                    </summary>
                    <div className="mt-2 space-y-1 text-xs font-mono bg-gray-900 rounded p-2 max-h-40 overflow-y-auto">
                      {diagnostics.dbActiveJobs.map((job) => (
                        <div key={job.id} className="flex items-center gap-2">
                          <span className="text-gray-500">{job.id.substring(0, 8)}</span>
                          <Badge className={`text-xs ${job.status === 'running' ? 'bg-blue-500' : 'bg-yellow-500'}`}>
                            {job.status}
                          </Badge>
                          <span className="text-gray-400">{job.kind}</span>
                          {job.domain && <span className="text-blue-400">{job.domain.name}</span>}
                          {job.runningMinutes !== undefined && <span className="text-yellow-400">{job.runningMinutes}m</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Queued Jobs in DB */}
                {diagnostics.dbQueuedJobs.length > 0 && (
                  <details className="group">
                    <summary className="flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer list-none">
                      <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                      <Clock className="h-4 w-4" />
                      {t('jobs.diagnostics.queuedJobsDB', { count: diagnostics.dbQueuedJobs.length })}
                    </summary>
                    <div className="mt-2 space-y-1 text-xs font-mono bg-gray-900 rounded p-2 max-h-40 overflow-y-auto">
                      {diagnostics.dbQueuedJobs.map((job) => (
                        <div key={job.id} className="flex items-center gap-2">
                          <span className="text-gray-500">{job.id.substring(0, 8)}</span>
                          <span className="text-gray-400">{job.kind}</span>
                          {job.domain && <span className="text-blue-400">{job.domain.name}</span>}
                          {job.createdBy && <span className="text-gray-500">by {job.createdBy.username}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* All OK message */}
                {diagnostics.recommendations.length === 0 &&
                 diagnostics.mismatchedJobs.length === 0 &&
                 diagnostics.stuckJobs.length === 0 && (
                  <div className="text-green-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {t('jobs.diagnostics.queueHealthy')}
                  </div>
                )}
              </div>
            ) : diagnosticsLoading ? (
              <div className="text-gray-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('jobs.diagnostics.loadingDiagnostics')}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('jobs.filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('jobs.allStatuses')}</SelectItem>
              <SelectItem value="queued,pending,running">{t('jobs.activeStatuses')}</SelectItem>
              <SelectItem value="queued">{t('jobs.statuses.queued')}</SelectItem>
              <SelectItem value="pending">{t('jobs.statuses.pending')}</SelectItem>
              <SelectItem value="running">{t('jobs.statuses.running')}</SelectItem>
              <SelectItem value="cancelling">{t('jobs.statuses.cancelling')}</SelectItem>
              <SelectItem value="success">{t('jobs.statuses.success')}</SelectItem>
              <SelectItem value="failed">{t('jobs.statuses.failed')}</SelectItem>
              <SelectItem value="cancelled">{t('jobs.statuses.cancelled')}</SelectItem>
              <SelectItem value="cancelled_with_warnings">{t('jobs.statuses.cancelled_with_warnings')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-64">
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('jobs.filterByType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('jobs.allTypes')}</SelectItem>
              <SelectItem value="SCRIPT_RUN">{t('jobs.kinds.SCRIPT_RUN')}</SelectItem>
              <SelectItem value="TAG_INSERT">{t('jobs.kinds.TAG_INSERT')}</SelectItem>
              <SelectItem value="APPLY_OFFER_TO_DOMAIN">{t('jobs.kinds.APPLY_OFFER_TO_DOMAIN')}</SelectItem>
              <SelectItem value="APPLY_OFFER_TO_DOMAIN_BULK">{t('jobs.kinds.APPLY_OFFER_TO_DOMAIN_BULK')}</SelectItem>
              <SelectItem value="DISCOVER">{t('jobs.kinds.DISCOVER')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Jobs Table */}
      {isLoading ? (
        <div className="text-gray-400">{t('jobs.loadingJobs')}</div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-400">
            {t('jobs.noJobs')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Status Badge */}
                  <div className="flex-shrink-0 mt-1">
                    {getStatusBadge(job.status as JobStatus, job)}
                  </div>

                  {/* Job Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {getJobKindLabel(t, job.kind as JobKind)}
                          </span>
                          {job.domain && (
                            <Badge variant="outline" className="text-xs">
                              {job.domain.name}
                            </Badge>
                          )}
                        </div>

                        {job.server && (
                          <p className="mt-1 text-xs text-gray-400">
                            {t('jobs.server', { name: job.server.name, ip: job.server.ip })}
                          </p>
                        )}

                        {/* Bulk domains list */}
                        {job.payload?.domainNames && job.payload.domainNames.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-400 mb-1">
                              {t('jobs.domainsListCount', { count: job.payload.domainNames.length })}
                            </p>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                              {job.payload.domainNames.slice(0, 20).map((name: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                              {job.payload.domainNames.length > 20 && (
                                <Badge variant="outline" className="text-xs text-gray-500">
                                  {t('jobs.moreCount', { count: job.payload.domainNames.length - 20 })}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-1 text-xs text-gray-500">
                          <span>{formatDate(job.createdAt)}</span>
                          {getDurationText(job) && (
                            <>
                              <span className="mx-2">•</span>
                              <span>{t('jobs.duration')} {getDurationText(job)}</span>
                            </>
                          )}
                          {job.status === 'running' && job.progress > 0 && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="text-blue-400">
                                {t('jobs.complete', { percent: job.progress })}
                              </span>
                            </>
                          )}
                          {job.attempt > 0 && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="text-yellow-400">
                                {t('jobs.attempt', { current: job.attempt + 1, max: job.maxAttempts })}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Retry Scheduled Info */}
                        {job.status === 'queued' && job.nextRetryAt && (
                          <div className="mt-2 text-xs text-yellow-400 bg-yellow-950/30 rounded p-2">
                            <span className="font-medium">{t('jobs.retryScheduled')}</span> {formatDate(job.nextRetryAt)}
                            {job.lastError && (
                              <span className="text-gray-400 ml-2">({job.lastError})</span>
                            )}
                          </div>
                        )}

                        {/* Progress Bar */}
                        {getProgressBar(job)}

                        {/* Error Message */}
                        {job.status === 'failed' && job.errorMessage && (
                          <div className="mt-2 text-xs text-red-400 bg-red-950/30 rounded p-2">
                            <span className="font-medium">{t('jobs.errorLabel')}</span> {job.errorMessage}
                          </div>
                        )}

                        {/* Result Summary */}
                        {job.status === 'success' && job.result && (
                          <div className="mt-2">
                            {typeof job.result === 'object' && (
                              <>
                                {job.result.filesCopied && (
                                  <div className="text-xs text-green-400">
                                    {t('jobs.filesCopied', { count: job.result.filesCopied })}
                                  </div>
                                )}
                                {job.result.filesProcessed && (
                                  <div className="text-xs text-green-400">
                                    {t('jobs.filesProcessed', { count: job.result.filesProcessed })}
                                  </div>
                                )}
                                {job.result.domainsDiscovered && (
                                  <div className="text-xs text-green-400">
                                    {t('jobs.domainsDiscovered', { count: job.result.domainsDiscovered })}
                                  </div>
                                )}

                                {/* Bulk operation results with detailed domain list */}
                                {job.result.successCount !== undefined && (
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium text-white">
                                      {t('jobs.resultSummary', { success: job.result.successCount, failed: job.result.failureCount || 0 })}
                                      {job.result.results && job.result.results.filter((r: any) => r.success && r.palladiumWarning).length > 0 && (
                                        <span className="text-yellow-400">{t('jobs.withWarnings', { count: job.result.results.filter((r: any) => r.success && r.palladiumWarning).length })}</span>
                                      )}
                                      {' '}{t('jobs.totalCount', { count: job.result.totalDomains })}
                                    </div>

                                    {/* Success list (only fully successful, no warnings) */}
                                    {job.result.results && job.result.results.filter((r: any) => r.success && !r.palladiumWarning).length > 0 && (
                                      <details className="group">
                                        <summary className="text-xs text-green-400 cursor-pointer hover:text-green-300 list-none flex items-center gap-1">
                                          <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                                          ✓ {t('jobs.successfulDomains', { count: job.result.results.filter((r: any) => r.success && !r.palladiumWarning).length })}
                                        </summary>
                                        <div className="mt-1 ml-4 space-y-0.5 max-h-32 overflow-y-auto">
                                          {job.result.results.filter((r: any) => r.success && !r.palladiumWarning).map((r: any, idx: number) => (
                                            <div key={idx} className="text-xs text-green-400">
                                              • {r.domainName || r.domainId}
                                              {r.filesCopied && ` (${r.filesCopied} files)`}
                                              {r.campaignId && ` - Campaign: ${r.campaignId}`}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}

                                    {/* Failure list */}
                                    {job.result.results && job.result.results.filter((r: any) => !r.success).length > 0 && (
                                      <details className="group" open>
                                        <summary className="text-xs text-red-400 cursor-pointer hover:text-red-300 list-none flex items-center gap-1">
                                          <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                                          ✗ {t('jobs.failedDomains', { count: job.result.results.filter((r: any) => !r.success).length })}
                                        </summary>
                                        <div className="mt-1 ml-4 space-y-1 max-h-40 overflow-y-auto bg-red-950/20 rounded p-2">
                                          {job.result.results.filter((r: any) => !r.success).map((r: any, idx: number) => (
                                            <div key={idx} className="text-xs">
                                              <div className="text-red-400 font-medium">• {r.domainName || r.domainId}</div>
                                              {r.error && (
                                                <div className="text-red-300 ml-3 mt-0.5">{r.error}</div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}

                                    {/* Warnings list (success but with palladiumWarning) */}
                                    {job.result.results && job.result.results.filter((r: any) => r.success && r.palladiumWarning).length > 0 && (
                                      <details className="group" open>
                                        <summary className="text-xs text-yellow-400 cursor-pointer hover:text-yellow-300 list-none flex items-center gap-1">
                                          <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                                          ⚠ {t('jobs.domainsWithWarnings', { count: job.result.results.filter((r: any) => r.success && r.palladiumWarning).length })}
                                        </summary>
                                        <div className="mt-1 ml-4 space-y-1 max-h-40 overflow-y-auto bg-yellow-950/20 rounded p-2">
                                          {job.result.results.filter((r: any) => r.success && r.palladiumWarning).map((r: any, idx: number) => (
                                            <div key={idx} className="text-xs">
                                              <div className="text-yellow-400 font-medium">• {r.domainName || r.domainId}</div>
                                              <div className="text-yellow-300 ml-3 mt-0.5">{r.palladiumWarning}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Cancellation Warning */}
                        {job.status === 'cancelled_with_warnings' && (
                          <div className="mt-2 text-xs text-yellow-400 bg-yellow-950/30 rounded p-2">
                            <span className="font-medium">{t('common.warning')}:</span> {t('jobs.cancelledWarning')}
                            {job.errorMessage && (
                              <div className="mt-1 text-yellow-300">{job.errorMessage}</div>
                            )}
                          </div>
                        )}

                        {/* Cancelled Message */}
                        {job.status === 'cancelled' && (
                          <div className="mt-2 text-xs text-gray-400 bg-gray-800/30 rounded p-2">
                            {job.errorMessage || job.result?.cancelNotes || job.result?.message || t('jobs.cancelledByUser')}
                          </div>
                        )}
                      </div>

                      {/* Job ID and Actions */}
                      <div className="text-right flex flex-col gap-2">
                        <p className="text-xs text-gray-500 font-mono">
                          {job.id.substring(0, 8)}
                        </p>

                        {/* Cancel Button */}
                        {['queued', 'pending', 'running'].includes(job.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelJob(job.id, job.kind)}
                            className="gap-1 text-xs h-7"
                          >
                            <XOctagon className="h-3 w-3" />
                            {t('common.cancel')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
