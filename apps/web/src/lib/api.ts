import type {
  Server,
  CreateServerDto,
  UpdateServerDto,
  FileApplyDto,
  ScriptRunDto,
  LoginDto,
  AuthResponse,
  ApiResponse,
  Job,
  Backup,
  Domain,
  DomainStatus,
  DomainWithServer,
  UpdateDomainDto,
  ScanDomainsDto,
  DomainsQueryParams,
  PaginatedResponse,
  PingThanksDto,
  PingThanksResult,
  Offer,
  CreateOfferDto,
  UpdateOfferDto,
  User,
  CreateUserDto,
  UpdateUserDto,
  BulkBanDomainsDto,
  BulkBanDomainsResult,
  BulkActivateDomainsDto,
  BulkActivateDomainsResult,
  HealthCheckResult,
  AppNotification,
} from '@server-panel/types';

// Queue diagnostics types
interface QueueDiagnosticsJob {
  id: string;
  kind: string;
  status: string;
  progress?: number;
  startedAt?: string;
  createdAt?: string;
  domainId?: string;
  runningMinutes?: number;
  createdBy?: { username: string };
  domain?: { name: string };
  server?: { name: string; ip: string };
  issue?: string;
}

export interface QueueDiagnostics {
  memoryStats: {
    queuedJobs: number;
    runningJobs: number;
    maxConcurrentJobs: number;
    maxSSHJobs: number;
    jobTimeoutMinutes: number;
  };
  memoryQueuedJobIds: string[];
  memoryRunningJobIds: string[];
  dbActiveJobs: QueueDiagnosticsJob[];
  dbQueuedJobs: QueueDiagnosticsJob[];
  stuckJobs: QueueDiagnosticsJob[];
  mismatchedJobs: QueueDiagnosticsJob[];
  recommendations: string[];
}

const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // Register callback for auth failures
  setUnauthorizedHandler(handler: () => void) {
    this.onUnauthorized = handler;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    } catch {
      // Network failure (no response at all), retry once
      try {
        response = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
        });
      } catch {
        throw new Error('Network error. Check your connection.');
      }
    }

    // Handle 401 - session expired or invalid token
    // NOTE: Skip for login endpoint — let it return the actual error from the server
    // NOTE: 403 means "authenticated but not authorized" - don't clear auth for that
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      // Clear auth state
      this.clearToken();

      // Trigger logout handler if registered
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }

      throw new Error('Session expired. Please log in again.');
    }

    // Handle 403 - permission denied (user is authenticated but lacks access)
    if (response.status === 403) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Access denied. You do not have permission to perform this action.');
    }

    // Handle 409 - job already running (dedup)
    if (response.status === 409) {
      const data = await response.json().catch(() => ({}));
      if (data.existingJobId) {
        return { ...data, success: true, alreadyExists: true } as any;
      }
      throw new Error(data.error || 'Conflict');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(credentials: LoginDto): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return response.data!;
  }

  async getProfile(): Promise<User> {
    const response = await this.request<User>('/auth/profile');
    return response.data!;
  }

  async refreshDomainStats(): Promise<{
    totalDomains: number;
    activeDomains: number;
    inactiveDomains: number;
    bannedDomains: number;
    message: string;
  }> {
    const response = await this.request<{
      totalDomains: number;
      activeDomains: number;
      inactiveDomains: number;
      bannedDomains: number;
      message: string;
    }>('/auth/profile/refresh-stats', {
      method: 'POST',
    });
    return response.data!;
  }

  async updatePreferences(data: { domainsPerPage?: number }): Promise<{
    id: string;
    username: string;
    domainsPerPage: number;
  }> {
    const response = await this.request<{
      id: string;
      username: string;
      domainsPerPage: number;
    }>('/auth/profile/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  // Servers
  async getServers(): Promise<Server[]> {
    const response = await this.request<Server[]>('/servers');
    return response.data!;
  }

  async getServer(id: string): Promise<Server> {
    const response = await this.request<Server>(`/servers/${id}`);
    return response.data!;
  }

  async createServer(data: CreateServerDto): Promise<Server> {
    const response = await this.request<Server>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async updateServer(id: string, data: UpdateServerDto): Promise<Server> {
    const response = await this.request<Server>(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async deleteServer(id: string): Promise<void> {
    await this.request(`/servers/${id}`, {
      method: 'DELETE',
    });
  }

  async createDomainWithFolder(serverId: string, domainName: string): Promise<{
    domain: Domain;
    folderCreated: boolean;
    path: string;
  }> {
    const response = await this.request<any>(`/servers/${serverId}/create-domain`, {
      method: 'POST',
      body: JSON.stringify({ domainName }),
    });
    return response.data!;
  }

  async getSites(serverId: string): Promise<string[]> {
    const response = await this.request<string[]>(`/servers/${serverId}/sites`);
    return response.data!;
  }

  async getFile(serverId: string, path: string): Promise<any> {
    const response = await this.request<any>(
      `/servers/${serverId}/files?path=${encodeURIComponent(path)}`
    );
    return response.data!;
  }

  async browseDirectory(serverId: string, path: string): Promise<any[]> {
    const response = await this.request<any[]>(
      `/servers/${serverId}/browse?path=${encodeURIComponent(path)}`
    );
    return response.data!;
  }

  async applyFile(serverId: string, data: FileApplyDto): Promise<any> {
    const response = await this.request<any>(`/servers/${serverId}/files/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async restoreFile(serverId: string, backupId: string): Promise<void> {
    await this.request(`/servers/${serverId}/files/restore`, {
      method: 'POST',
      body: JSON.stringify({ backupId }),
    });
  }

  async getScripts(serverId: string): Promise<string[]> {
    const response = await this.request<string[]>(`/servers/${serverId}/scripts`);
    return response.data!;
  }

  async getBackups(serverId: string, path?: string): Promise<Backup[]> {
    let url = `/servers/${serverId}/backups`;
    if (path) {
      url += `?path=${encodeURIComponent(path)}`;
    }
    const response = await this.request<Backup[]>(url);
    return response.data!;
  }

  // Scripts
  async runScript(serverId: string, data: ScriptRunDto): Promise<{ jobId: string }> {
    const response = await this.request<{ jobId: string }>(`/scripts/${serverId}/run`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  // Jobs
  async getJobs(filters?: {
    serverId?: string;
    status?: string;
    kind?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: Job[]; total: number; limit: number; offset: number }> {
    const params = new URLSearchParams();

    if (filters?.serverId) params.append('serverId', filters.serverId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.kind) params.append('kind', filters.kind);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await this.request<{
      jobs: Job[];
      total: number;
      limit: number;
      offset: number;
    }>(`/jobs?${params}`);
    return response.data!;
  }

  async getJob(id: string): Promise<Job> {
    const response = await this.request<Job>(`/jobs/${id}`);
    return response.data!;
  }

  async cancelJob(id: string): Promise<{ jobId: string; status: string; message: string }> {
    const response = await this.request<{
      jobId: string;
      status: string;
      message: string;
    }>(`/jobs/${id}/cancel`, {
      method: 'POST',
    });
    return response.data!;
  }

  async getQueueDiagnostics(): Promise<QueueDiagnostics> {
    const response = await this.request<QueueDiagnostics>('/jobs/queue/diagnostics');
    return response.data!;
  }

  async forceFailJob(id: string): Promise<{ jobId: string; previousStatus: string; newStatus: string; message: string }> {
    const response = await this.request<{
      jobId: string;
      previousStatus: string;
      newStatus: string;
      message: string;
    }>(`/jobs/${id}/force-fail`, {
      method: 'POST',
    });
    return response.data!;
  }

  async reEnqueueOrphanedJobs(): Promise<{
    totalOrphaned: number;
    enqueued: number;
    failed: number;
    errors?: string[];
    message: string;
  }> {
    const response = await this.request<{
      totalOrphaned: number;
      enqueued: number;
      failed: number;
      errors?: string[];
      message: string;
    }>('/jobs/queue/re-enqueue-all', {
      method: 'POST',
    });
    return response.data!;
  }

  // Audit
  async getAuditLogs(filters?: any): Promise<any> {
    // Filter out undefined/null/empty values before creating URLSearchParams
    const cleanFilters: Record<string, string> = {};
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          cleanFilters[key] = String(value);
        }
      }
    }
    const params = new URLSearchParams(cleanFilters);
    const response = await this.request<any>(`/audit?${params}`);
    return response.data!;
  }

  // Domains
  async getDomains(params?: DomainsQueryParams): Promise<PaginatedResponse<DomainWithServer> & { campaignStats?: Record<string, { botTraffic: string; targetTraffic: string; botTotalTraffic: string; targetUniqueTraffic: string }> }> {
    const queryParams = new URLSearchParams();

    if (params?.query) queryParams.append('query', params.query);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.hasTag) queryParams.append('hasTag', params.hasTag);
    if (params?.hasConversion) queryParams.append('hasConversion', params.hasConversion);
    if (params?.ownerId) queryParams.append('ownerId', params.ownerId);
    if (params?.reviewStatus) queryParams.append('reviewStatus', params.reviewStatus);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const response = await this.request<PaginatedResponse<DomainWithServer> & { campaignStats?: Record<string, { botTraffic: string; targetTraffic: string; botTotalTraffic: string; targetUniqueTraffic: string }> }>(
      `/domains?${queryParams}`
    );
    return response.data!;
  }

  async getDomain(id: string): Promise<DomainWithServer> {
    const response = await this.request<DomainWithServer>(`/domains/${id}`);
    return response.data!;
  }

  async lookupDomains(names: string[]): Promise<{
    found: Array<{ id: string; name: string; status: string; geo: string | null; buyerTag: string | null; offerName: string | null }>;
    notFound: string[];
  }> {
    const response = await this.request<{
      found: Array<{ id: string; name: string; status: string; geo: string | null; buyerTag: string | null; offerName: string | null }>;
      notFound: string[];
    }>('/domains/lookup', {
      method: 'POST',
      body: JSON.stringify({ names }),
    });
    return response.data!;
  }

  async lookupDomainsByIds(ids: string[]): Promise<Array<{
    id: string;
    name: string;
    status: DomainStatus;
    palladiumCampaignId: string | null;
    assignedOperator: { id: string; username: string } | null;
  }>> {
    const response = await this.request<Array<{
      id: string;
      name: string;
      status: DomainStatus;
      palladiumCampaignId: string | null;
      assignedOperator: { id: string; username: string } | null;
    }>>('/domains/lookup-by-ids', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return response.data!;
  }

  async updateDomain(id: string, data: UpdateDomainDto): Promise<Domain> {
    const response = await this.request<Domain>(`/domains/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async scanDomains(data?: ScanDomainsDto): Promise<any> {
    const response = await this.request<any>('/domains/scan', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
    return response.data!;
  }

  async reviewDomain(domainId: string): Promise<any> {
    const response = await this.request<any>(`/domains/${domainId}/review`, {
      method: 'POST',
    });
    return response.data!;
  }

  async bulkReviewDomains(domainIds: string[]): Promise<any> {
    const response = await this.request<any>('/domains/bulk-review', {
      method: 'POST',
      body: JSON.stringify({ domainIds }),
    });
    return response.data!;
  }

  async bulkBanDomains(data: BulkBanDomainsDto): Promise<BulkBanDomainsResult> {
    const response = await this.request<BulkBanDomainsResult>('/domains/bulk-ban', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async bulkActivateDomains(data: BulkActivateDomainsDto): Promise<BulkActivateDomainsResult> {
    const response = await this.request<BulkActivateDomainsResult>('/domains/bulk-activate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async discoverDomains(): Promise<any> {
    const response = await this.request<any>('/domains/discover', {
      method: 'POST',
    });
    return response.data!;
  }

  async discoverServerDomains(serverId: string): Promise<any> {
    const response = await this.request<any>(`/servers/${serverId}/discover`, {
      method: 'POST',
    });
    return response.data!;
  }

  async deleteDomain(id: string): Promise<void> {
    await this.request(`/domains/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteDomainCampaign(id: string): Promise<{ domain: Domain; message: string }> {
    const response = await this.request<{ domain: Domain; message: string }>(`/domains/${id}/campaign`, {
      method: 'DELETE',
    });
    return response.data!;
  }

  async deleteDomainCampaignsBulk(domainIds: string[]): Promise<{
    deleted: Array<{ domainId: string; domainName: string; campaignId: string }>;
    errors: Array<{ domainId: string; domainName: string; campaignId: string; error: string }>;
    message: string;
  }> {
    const response = await this.request<{
      deleted: Array<{ domainId: string; domainName: string; campaignId: string }>;
      errors: Array<{ domainId: string; domainName: string; campaignId: string; error: string }>;
      message: string;
    }>(`/domains/campaigns/bulk`, {
      method: 'DELETE',
      body: JSON.stringify({ domainIds }),
    });
    return response.data!;
  }

  async insertGoogleTags(id: string, googleTag?: string, conversion?: string, replaceConversion?: boolean): Promise<any> {
    const response = await this.request<any>(`/domains/${id}/insert-tags`, {
      method: 'POST',
      body: JSON.stringify({
        googleTag: googleTag || undefined,
        conversion: conversion || undefined,
        replaceConversion,
      }),
    });
    return response.data!;
  }

  async atomicRefresh(id: string): Promise<any> {
    const response = await this.request<any>(`/domains/${id}/atomic-refresh`, {
      method: 'POST',
    });
    return response.data!;
  }


  async pingThanks(id: string, options: PingThanksDto): Promise<PingThanksResult> {
    const response = await this.request<PingThanksResult>(`/domains/${id}/ping-thanks`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
    return response.data!;
  }

  async pingThanksBulk(domainIds: string[], options: PingThanksDto): Promise<{ results: PingThanksResult[] }> {
    const response = await this.request<{ results: PingThanksResult[] }>('/domains/ping-thanks/bulk', {
      method: 'POST',
      body: JSON.stringify({ domainIds, ...options }),
    });
    return response.data!;
  }

  async editBuyerTag(id: string, buyerTag: string): Promise<any> {
    const response = await this.request<any>(`/domains/${id}/buyer-tag`, {
      method: 'PATCH',
      body: JSON.stringify({ buyerTag }),
    });
    return response.data!;
  }

  async editGeo(id: string, geo: string): Promise<any> {
    const response = await this.request<any>(`/domains/${id}/geo`, {
      method: 'PATCH',
      body: JSON.stringify({ geo }),
    });
    return response.data!;
  }

  async editOfferName(id: string, offerName: string): Promise<any> {
    const response = await this.request<any>(`/domains/${id}/offer`, {
      method: 'PATCH',
      body: JSON.stringify({ offerName }),
    });
    return response.data!;
  }

  async updatePalladiumGeo(id: string, countries: string[]): Promise<any> {
    const response = await this.request<any>(`/domains/${id}/palladium-geo`, {
      method: 'PATCH',
      body: JSON.stringify({ countries }),
    });
    return response.data!;
  }

  async getCampaignStats(campaignIds: string[]): Promise<Record<string, { botTraffic: string; targetTraffic: string; botTotalTraffic: string; targetUniqueTraffic: string }>> {
    const response = await this.request<{ success: boolean; stats: Record<string, { botTraffic: string; targetTraffic: string; botTotalTraffic: string; targetUniqueTraffic: string }> }>('/domains/campaign-stats', {
      method: 'POST',
      body: JSON.stringify({ campaignIds }),
    });
    return (response as any).stats || {};
  }

  async refreshTrafficStats(): Promise<{ updated: number; total: number; message: string }> {
    const response = await this.request<{ updated: number; total: number; message: string }>('/domains/refresh-traffic', {
      method: 'POST',
    });
    return response.data!;
  }

  async getTotalTraffic(): Promise<{ totalTarget: number; totalTargetUnique: number; totalBotTotal: number; totalBot: number; totalDomains: number }> {
    const response = await this.request<{ totalTarget: number; totalTargetUnique: number; totalBotTotal: number; totalBot: number; totalDomains: number }>('/domains/total-traffic');
    return response.data!;
  }

  async assignOperator(domainId: string, operatorId: string | null): Promise<Domain> {
    const response = await this.request<Domain>(`/domains/${domainId}/assign-operator`, {
      method: 'PATCH',
      body: JSON.stringify({ operatorId }),
    });
    return response.data!;
  }

  async changeOffer(id: string, offerId: string, buyerTag?: string, palladiumOptions?: { enabled: boolean; countries: string[] }): Promise<any> {
    const response = await this.request<any>(`/domains/${id}/change-offer`, {
      method: 'POST',
      body: JSON.stringify({ offerId, buyerTag, palladiumOptions }),
    });
    return response.data!;
  }

  async changeOfferBulk(domainIds: string[], offerId: string, buyerTag?: string, palladiumOptions?: { enabled: boolean; countries: string[] }): Promise<{ jobId: string; message: string; totalDomains: number }> {
    const response = await this.request<{ jobId: string; message: string; totalDomains: number }>('/domains/change-offer-bulk', {
      method: 'POST',
      body: JSON.stringify({ domainIds, offerId, buyerTag, palladiumOptions }),
    });
    return response.data!;
  }

  async deployCloakBulk(domainIds: string[], countries: string[]): Promise<{ jobId: string; message: string; totalDomains: number; countries: string[] }> {
    const response = await this.request<{ jobId: string; message: string; totalDomains: number; countries: string[] }>('/domains/deploy-cloak-bulk', {
      method: 'POST',
      body: JSON.stringify({
        domainIds,
        countries,
      }),
    });
    return response.data!;
  }

  async uploadCloak(domainId: string, file: File): Promise<{ domainName: string; cloakPath: string; message: string }> {
    const formData = new FormData();
    formData.append('cloak', file);

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    // Don't set Content-Type, browser will set it with boundary for FormData

    const response = await fetch(`${API_BASE}/domains/${domainId}/upload-cloak`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Handle 401/403
    if (response.status === 401 || response.status === 403) {
      this.clearToken();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  }

  async bulkUpdateOfferMeta(domainIds: string[], updates: { offerName?: string; geo?: string; buyerTag?: string }): Promise<any> {
    const response = await this.request<any>('/domains/bulk-update-offer-meta', {
      method: 'POST',
      body: JSON.stringify({ domainIds, ...updates }),
    });
    return response.data!;
  }

  // Offers
  async getOffers(): Promise<Offer[]> {
    const response = await this.request<Offer[]>('/offers');
    return response.data!;
  }

  async getOffer(id: string): Promise<Offer> {
    const response = await this.request<Offer>(`/offers/${id}`);
    return response.data!;
  }

  async createOffer(data: CreateOfferDto, files?: File[]): Promise<Offer> {
    if (files && files.length > 0) {
      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('folderName', data.folderName);

      files.forEach(file => {
        // Use webkitRelativePath to preserve folder structure, fallback to name
        const relativePath = (file as any).webkitRelativePath || file.name;
        // Remove the top-level folder from path (e.g., "product/index.php" -> "index.php")
        // This is because the user selected a folder, and we want its contents, not nested
        const pathParts = relativePath.split('/');
        const cleanPath = pathParts.length > 1 ? pathParts.slice(1).join('/') : relativePath;
        formData.append('files', file, cleanPath);
      });

      const headers: HeadersInit = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      // Don't set Content-Type, browser will set it with boundary for FormData

      const response = await fetch(`${API_BASE}/offers`, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Handle 401/403
      if (response.status === 401 || response.status === 403) {
        this.clearToken();
        if (this.onUnauthorized) {
          this.onUnauthorized();
        }
        throw new Error('Session expired. Please log in again.');
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }

      return result.data;
    } else {
      // Regular JSON request without files
      const response = await this.request<Offer>('/offers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data!;
    }
  }

  async updateOffer(id: string, data: UpdateOfferDto): Promise<Offer> {
    const response = await this.request<Offer>(`/offers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async deleteOffer(id: string): Promise<void> {
    await this.request(`/offers/${id}`, {
      method: 'DELETE',
    });
  }

  async getOfferFiles(id: string): Promise<Array<{ name: string; size: number; modifiedAt: Date }>> {
    const response = await this.request<Array<{ name: string; size: number; modifiedAt: Date }>>(`/offers/${id}/files`);
    return response.data!;
  }

  async getOfferFile(id: string, filename: string): Promise<{ filename: string; content: string; size: number; modifiedAt: Date }> {
    // Encode each path segment separately to preserve slashes
    const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
    const response = await this.request<{ filename: string; content: string; size: number; modifiedAt: Date }>(
      `/offers/${id}/files/${encodedPath}`
    );
    return response.data!;
  }

  async updateOfferFile(id: string, filename: string, content: string): Promise<{ filename: string; size: number; modifiedAt: Date; backupCreated: string }> {
    // Encode each path segment separately to preserve slashes
    const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
    const response = await this.request<{ filename: string; size: number; modifiedAt: Date; backupCreated: string }>(
      `/offers/${id}/files/${encodedPath}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }
    );
    return response.data!;
  }

  async downloadOffer(id: string): Promise<Blob> {
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/offers/${id}/download`, {
      headers,
    });

    // Handle 401/403
    if (response.status === 401 || response.status === 403) {
      this.clearToken();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Download failed');
    }

    return await response.blob();
  }

  // Whites
  async uploadWhite(files: File[]): Promise<{ whiteFolder: string; path: string; fileCount: number; warning?: string }> {
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file);
    });

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/whites/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Handle 401/403
    if (response.status === 401 || response.status === 403) {
      this.clearToken();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new Error('Session expired. Please log in again.');
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Upload failed');
    }

    return result.data;
  }

  async getWhites(): Promise<Array<{ name: string; path: string; createdAt: Date; fileCount: number }>> {
    const response = await this.request<Array<{ name: string; path: string; createdAt: Date; fileCount: number }>>('/whites');
    return response.data!;
  }

  async deleteWhite(folderName: string): Promise<void> {
    await this.request(`/whites/${folderName}`, {
      method: 'DELETE',
    });
  }

  // Deploy Domains
  async deployDomains(
    domainConfigs: Array<{
      domainId: string;
      whiteSourceId: string;
      cloakSourceId: string | null;
      offerId: string | null;
    }>,
    whiteFiles: Map<string, File>, // Map of domainId -> white zip file
    crmMetadata?: { buyerTag?: string },
    palladiumOptions?: { enabled: boolean; countries: string[] },
    wpMode?: 'off' | 'simple' | 'full_rebuild'
  ): Promise<{ jobId: string; message: string; totalDomains: number }> {
    const formData = new FormData();

    // Add domain configurations as JSON string
    formData.append('domainConfigs', JSON.stringify(domainConfigs));

    // Add CRM metadata if provided
    if (crmMetadata) {
      formData.append('crmMetadata', JSON.stringify(crmMetadata));
    }

    // Add Palladium options if provided
    if (palladiumOptions) {
      formData.append('palladiumOptions', JSON.stringify(palladiumOptions));
    }

    // Add WP mode if not default
    if (wpMode && wpMode !== 'off') {
      formData.append('wpMode', wpMode);
    }

    // Add white files (always zip) with fieldname format: white_<domainId>
    whiteFiles.forEach((file, domainId) => {
      formData.append(`white_${domainId}`, file);
    });

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/domains/deploy-domains`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Handle 401/403
    if (response.status === 401 || response.status === 403) {
      this.clearToken();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new Error('Session expired. Please log in again.');
    }

    const result = await response.json();

    // Handle 409 - job already running (dedup)
    if (response.status === 409 && result.existingJobId) {
      return { ...result, success: true, alreadyExists: true } as any;
    }

    if (!response.ok) {
      throw new Error(result.error || 'Deployment failed');
    }

    return result.data;
  }

  async scanDeploymentStatus(): Promise<{ jobId: string; message: string }> {
    const response = await this.request<{ jobId: string; message: string }>('/domains/scan-deployment-status', {
      method: 'POST',
    });
    return response.data!;
  }

  // Users (ADMIN only)
  async getUsers(): Promise<User[]> {
    const response = await this.request<User[]>('/users');
    return response.data!;
  }

  async getUser(id: string): Promise<User> {
    const response = await this.request<User>(`/users/${id}`);
    return response.data!;
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const response = await this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const response = await this.request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async deleteUser(id: string): Promise<void> {
    await this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getOperators(): Promise<User[]> {
    const response = await this.request<User[]>('/users/operators');
    return response.data!;
  }

  // Settings
  async getSettings(): Promise<any> {
    const response = await this.request<any>('/settings');
    return response.data!;
  }

  async updateSetting(key: string, value: string): Promise<any> {
    const response = await this.request<any>(`/settings/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
    return response.data!;
  }

  // Check maintenance mode - public endpoint (no auth required)
  async getMaintenanceStatus(): Promise<{ maintenanceMode: boolean }> {
    const response = await fetch(`${API_BASE}/settings/maintenance-status`);
    const data = await response.json();
    return data;
  }

  // Domain Pool / Claim System
  async getDomainPoolStats(): Promise<{
    totalAvailable: number;
    com: { available: number; price: number };
    org: { available: number; price: number };
    other: { available: number; price: number };
  }> {
    const response = await this.request<any>('/domains/pool/stats');
    return response.data!;
  }

  async claimDomains(count: number, zone: 'com' | 'org' | 'other'): Promise<{
    claimedCount: number;
    domains: Array<{
      id: string;
      name: string;
      serverId: string;
      serverName: string;
    }>;
    remainingLimit: number;
  }> {
    const response = await this.request<any>('/domains/pool/claim', {
      method: 'POST',
      body: JSON.stringify({ count, zone }),
    });
    return response.data!;
  }

  async getMyClaimStats(): Promise<{
    domainLimit: number;
    totalClaimed: number;
    remainingLimit: number;
    activeDomains: number;
    inactiveDomains: number;
    bannedDomains: number;
    totalCost: number;
  }> {
    const response = await this.request<any>('/domains/pool/my-stats');
    return response.data!;
  }

  async getClaimAuditLog(page: number = 1, limit: number = 50): Promise<{
    items: Array<{
      id: string;
      userId: string;
      username: string;
      action: string;
      claimedCount: number;
      domainNames: string[];
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const response = await this.request<any>(`/domains/pool/audit?page=${page}&limit=${limit}`);
    return response.data!;
  }

  // Pool Management (Admin only)
  async getPoolDomains(page: number = 1, limit: number = 50, serverId?: string): Promise<{
    items: Domain[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (serverId) params.append('serverId', serverId);

    const response = await this.request<any>(`/domains/pool/domains?${params}`);
    return response.data!;
  }

  async getAvailableForPool(page: number = 1, limit: number = 50, serverId?: string, query?: string): Promise<{
    items: Domain[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (serverId) params.append('serverId', serverId);
    if (query) params.append('query', query);

    const response = await this.request<any>(`/domains/pool/available?${params}`);
    return response.data!;
  }

  async addToPool(domainIds: string[]): Promise<{ addedCount: number; requestedCount: number }> {
    const response = await this.request<any>('/domains/pool/add', {
      method: 'POST',
      body: JSON.stringify({ domainIds }),
    });
    return response.data!;
  }

  async removeFromPool(domainIds: string[]): Promise<{ removedCount: number; requestedCount: number }> {
    const response = await this.request<any>('/domains/pool/remove', {
      method: 'POST',
      body: JSON.stringify({ domainIds }),
    });
    return response.data!;
  }

  async getPendingPoolDomains(page: number = 1, limit: number = 50, serverId?: string): Promise<{
    items: Domain[];
    total: number;
    page: number;
    pageSize: number;
    zonePricing: Record<string, number>;
  }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (serverId) params.append('serverId', serverId);

    const response = await this.request<any>(`/domains/pool/pending?${params}`);
    return response.data!;
  }

  async approvePoolDomains(domainIds: string[], prices?: Record<string, number>): Promise<{ approvedCount: number }> {
    const response = await this.request<any>('/domains/pool/approve', {
      method: 'POST',
      body: JSON.stringify({ domainIds, prices }),
    });
    return response.data!;
  }

  async updatePendingDomainPrice(domainId: string, price: number): Promise<Domain> {
    const response = await this.request<Domain>(`/domains/pool/pending/${domainId}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ price }),
    });
    return response.data!;
  }

  // Financial Management (Admin only)
  async getOperatorsStats(): Promise<{
    operators: Array<{
      id: string;
      username: string;
      domainLimit: number;
      totalClaimed: number;
      activeDomains: number;
      inactiveDomains: number;
      bannedDomains: number;
      remainingLimit: number;
      domainCost: number;
      totalCost: number;
    }>;
    totals: {
      totalOperators: number;
      totalClaimed: number;
      totalActive: number;
      totalInactive: number;
      totalBanned: number;
      totalLimit: number;
      totalCost: number;
      domainCost: number;
    };
  }> {
    const response = await this.request<any>('/domains/pool/operators-stats');
    return response.data!;
  }

  async getClaimHistory(params?: {
    page?: number;
    limit?: number;
    operatorId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    items: Array<{
      id: string;
      userId: string;
      username: string;
      claimedCount: number;
      domainIds: string[];
      domainNames: string[];
      domainCost: number;
      totalCost: number;
      domainCostDetails?: Array<{
        name: string;
        zonePrice: number;
        serverCost: number;
        serverDomainCount: number | null;
        total: number;
      }>;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.operatorId) searchParams.append('operatorId', params.operatorId);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);

    const query = searchParams.toString();
    const response = await this.request<any>(`/domains/pool/claim-history${query ? `?${query}` : ''}`);
    return response.data!;
  }

  getOperatorsCsvUrl(params?: { startDate?: string; endDate?: string }): string {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const query = searchParams.toString();
    return `/api/domains/pool/export/operators-csv${query ? `?${query}` : ''}`;
  }

  async returnDomainsToPool(domainIds: string[]): Promise<{ returnedCount: number; domainNames: string[] }> {
    const response = await this.request<{ returnedCount: number; domainNames: string[] }>('/domains/pool/return', {
      method: 'POST',
      body: JSON.stringify({ domainIds }),
    });
    return response.data!;
  }

  async deleteClaimHistory(id: string): Promise<{ deletedId: string }> {
    const response = await this.request<{ deletedId: string }>(`/domains/pool/claim-history/${id}`, {
      method: 'DELETE',
    });
    return response.data!;
  }

  getClaimsCsvUrl(params?: { operatorId?: string; startDate?: string; endDate?: string }): string {
    const searchParams = new URLSearchParams();
    if (params?.operatorId) searchParams.append('operatorId', params.operatorId);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const query = searchParams.toString();
    return `/api/domains/pool/export/claims-csv${query ? `?${query}` : ''}`;
  }

  // Notifications
  async getNotifications(): Promise<{
    notifications: AppNotification[];
    unreadCount: number;
  }> {
    const response = await this.request<{
      notifications: AppNotification[];
      unreadCount: number;
    }>('/notifications');
    return response.data!;
  }

  async markNotificationsRead(ids: string[] | 'all'): Promise<void> {
    await this.request('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  // Domain Health
  async getDomainHealth(domainId: string): Promise<HealthCheckResult | null> {
    const response = await this.request<HealthCheckResult | null>(`/domains/${domainId}/health`);
    return response.data!;
  }

  async getDomainHealthHistory(domainId: string): Promise<HealthCheckResult[]> {
    const response = await this.request<HealthCheckResult[]>(`/domains/${domainId}/health/history`);
    return response.data!;
  }

  async getCheckHostNodes(): Promise<Array<{ nodeId: string; countryCode: string; country: string; city: string }>> {
    const response = await this.request<Array<{ nodeId: string; countryCode: string; country: string; city: string }>>('/domains/dns-nodes');
    return response.data!;
  }

  async triggerHealthCheck(): Promise<{ jobId: string }> {
    const response = await this.request<{ jobId: string }>('/domains/health-check', {
      method: 'POST',
    });
    return response.data!;
  }

  // Check Nodes (Custom Health Check Nodes)
  async getCheckNodes(): Promise<any[]> {
    const response = await this.request<any[]>('/check-nodes');
    return response.data!;
  }

  async createCheckNode(data: {
    name: string;
    ip: string;
    sshPort?: number;
    username?: string;
    authType?: string;
    credentials: string;
    countryCode: string;
    country: string;
    city?: string;
  }): Promise<any> {
    const response = await this.request<any>('/check-nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async updateCheckNode(id: string, data: Record<string, any>): Promise<any> {
    const response = await this.request<any>(`/check-nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data!;
  }

  async deleteCheckNode(id: string): Promise<void> {
    await this.request(`/check-nodes/${id}`, {
      method: 'DELETE',
    });
  }

  async testCheckNode(id: string): Promise<{
    success: boolean;
    message: string;
    curlAvailable: boolean;
    digAvailable: boolean;
    latencyMs: number;
  }> {
    const response = await this.request<{
      success: boolean;
      message: string;
      curlAvailable: boolean;
      digAvailable: boolean;
      latencyMs: number;
    }>(`/check-nodes/${id}/test`, {
      method: 'POST',
    });
    return response.data!;
  }

  getToken(): string | null {
    return this.token;
  }

  // WebSocket
  getWebSocketUrl(jobId: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = 3001; // API server port
    return `${protocol}//${host}:${port}/ws/jobs/${jobId}?token=${this.token}`;
  }
}

export const api = new ApiClient();
