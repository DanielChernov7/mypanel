// Server Types
export interface Server {
  id: string;
  name: string;
  ip: string;
  sshPort: number;
  username: string;
  authType: 'password' | 'key';
  passwordOrKey: string;
  notes?: string | null;
  tags: string[];
  lastHeartbeat?: Date | string | null;
  cfEmail?: string | null;
  cfApiKey?: string | null;
  defaultOperatorId?: string | null;
  addToPoolOnDiscover?: boolean; // Auto-add discovered domains to claim pool
  ipCost?: number; // Cost of the server IP, distributed across all domains on the server
  hostProvider?: string | null; // "HSTQ" | "VULTR" | "Bitlaunch" | "Inferno"
  hostLocation?: string | null; // "Amsterdam" | "Frankfurt" | "London"
  reviewPeriodDays?: number | null; // Per-server review period override (days)
  overallStatus?: 'ACTIVE' | 'BANNED';
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateServerDto {
  name: string;
  ip: string;
  sshPort?: number;
  username: string;
  authType: 'password' | 'key';
  passwordOrKey: string;
  notes?: string;
  tags?: string[];
  cfEmail?: string;
  cfApiKey?: string;
  defaultOperatorId?: string;
  addToPoolOnDiscover?: boolean; // Auto-add discovered domains to claim pool
  ipCost?: number; // Cost of the server IP
  hostProvider?: string; // "HSTQ" | "VULTR" | "Bitlaunch" | "Inferno"
  hostLocation?: string; // "Amsterdam" | "Frankfurt" | "London"
  reviewPeriodDays?: number; // Per-server review period override (days)
  initialDomains?: string[]; // Optional list of domains to create on server
}

export interface UpdateServerDto {
  name?: string;
  ip?: string;
  sshPort?: number;
  username?: string;
  authType?: 'password' | 'key';
  passwordOrKey?: string;
  notes?: string;
  tags?: string[];
  cfEmail?: string;
  cfApiKey?: string;
  defaultOperatorId?: string | null;
  addToPoolOnDiscover?: boolean; // Auto-add discovered domains to claim pool
  ipCost?: number; // Cost of the server IP
  hostProvider?: string; // "HSTQ" | "VULTR" | "Bitlaunch" | "Inferno"
  hostLocation?: string; // "Amsterdam" | "Frankfurt" | "London"
  reviewPeriodDays?: number | null; // Per-server review period override (days)
}

// Site/Directory Types
export interface Site {
  name: string;
  path: string;
  size?: number;
  modifiedAt?: Date | string;
}

// File Types
export interface FileInfo {
  path: string;
  content: string;
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modifiedAt: Date | string;
  checksum: string;
}

export interface FileApplyDto {
  path: string;
  content: string;
  backup?: boolean;
  postHook?: string;
}

export interface FileRestoreDto {
  path: string;
  backupId: string;
}

// Script Types
export interface WhitelistScript {
  id: string;
  serverId: string;
  pathPattern: string;
  description?: string;
  createdAt: Date | string;
}

export interface ScriptRunDto {
  scriptPath: string;
  args?: string[];
  timeoutSec?: number;
}

// Job Types
export type JobKind =
  | 'FILE_APPLY'
  | 'SCRIPT_RUN'
  | 'DISCOVER'
  | 'TAG_INSERT'
  | 'APPLY_OFFER_TO_DOMAIN'
  | 'APPLY_OFFER_TO_DOMAIN_BULK'
  | 'DEPLOY_DOMAINS'
  | 'SCAN_DEPLOYMENT_STATUS'
  | 'DEPLOY_CLOAK_BULK'
  | 'DOMAIN_HEALTH_CHECK'
  | 'BULK_UPDATE_OFFER_META'
  | 'DOMAIN_IMPORT';
export type JobStatus =
  | 'queued'
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelling'              // Job is being cancelled and rolled back
  | 'cancelled'               // Job was successfully cancelled and cleaned up
  | 'cancelled_with_warnings'; // Job was cancelled but rollback was incomplete

export interface Job {
  id: string;
  kind: JobKind;
  status: JobStatus;
  serverId: string;
  domainId?: string;
  payload: any;
  result?: any;
  progress: number; // 0-100
  errorMessage?: string;
  // Retry logic
  attempt: number; // Current attempt (0-based)
  maxAttempts: number; // Max attempts before permanent failure
  nextRetryAt?: Date | string | null; // When to retry (null = no retry scheduled)
  lastError?: string | null; // Last error message (preserved across retries)
  // Timestamps
  startedAt?: Date | string;
  finishedAt?: Date | string;
  createdById: string;
  createdAt: Date | string;
  // Optional populated relations
  server?: Server;
  domain?: Domain;
  createdBy?: User;
}

// Audit Types
export interface Audit {
  id: string;
  userId: string;
  serverId: string;
  action: string;
  path?: string;
  preChecksum?: string;
  postChecksum?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  metadata?: any;
  createdAt: Date | string;
}

// Backup Types
export interface Backup {
  id: string;
  serverId: string;
  path: string;
  backupPath: string;
  size: number | string;
  checksum: string;
  createdAt: Date | string;
}

// Auth Types
export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Palladium integration fields (optional per-user settings)
  palladiumApiKey?: string;
  palladiumEmail?: string;
  palladiumTelegram?: string;
  // Buyer tag for deploy domains logic
  buyerTag?: string;
  // Domain limit for operators (how many domains they can claim)
  domainLimit?: number;
  // Domain statistics (cached counts by buyerTag)
  totalDomains?: number;
  activeDomains?: number;
  inactiveDomains?: number;
  bannedDomains?: number;
  lastStatsUpdate?: Date | string;
  // User preferences
  domainsPerPage?: number; // 20, 50, or 100
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  role?: UserRole;
  // Palladium integration fields (optional)
  palladiumApiKey?: string;
  palladiumEmail?: string;
  palladiumTelegram?: string;
  // Buyer tag (optional)
  buyerTag?: string;
  // Domain limit for operators
  domainLimit?: number;
  // User preferences
  domainsPerPage?: number;
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  role?: UserRole;
  // Palladium integration fields (optional)
  palladiumApiKey?: string;
  palladiumEmail?: string;
  palladiumTelegram?: string;
  // Buyer tag (optional)
  buyerTag?: string;
  // Domain limit for operators
  domainLimit?: number;
  // User preferences
  domainsPerPage?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// WebSocket Types
export type WSMessageType = 'log' | 'status' | 'error';

export interface WSMessage {
  type: WSMessageType;
  data: any;
  ts: number;
}

export interface LogMessage {
  type: 'stdout' | 'stderr';
  content: string;
  ts: number;
}

export interface StatusMessage {
  status: JobStatus;
  exitCode?: number;
  ts: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Search and Filter Types
export interface SearchParams {
  query?: string;
  serverId?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

// Bulk Operation Types
export interface BulkFileApplyDto {
  servers: string[];
  path: string;
  content: string;
  backup?: boolean;
  dryRun?: boolean;
}

export interface BulkFileApplyResult {
  serverId: string;
  serverName: string;
  success: boolean;
  error?: string;
  diff?: string;
}

// Domain Types
export type DomainStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';

export interface Domain {
  id: string;
  name: string;
  serverId: string;
  status: DomainStatus;
  buyerTag?: string; // Buyer tag for grouping domains
  assignedOperatorId?: string; // Assigned operator for role-based access
  inPool?: boolean; // True if domain is in the claim pool
  poolApproved?: boolean; // True if admin approved domain for pool
  claimedFromPool?: boolean; // True if domain was claimed from pool
  customPrice?: number | null; // Custom price (overrides zone default)
  zonePrice?: number | null; // Domain registration price per zone (e.g. 7.20 for .org)
  serverCostSnapshot?: number | null; // Snapshotted server IP cost per domain at claim time
  geo?: string;
  offerName?: string;
  currentOfferId?: string; // Track which offer is currently applied
  offerFolder?: string; // Unique offer folder name (e.g., "product-a7f3b9c"), null means use default "product"
  googleTag?: string;
  conversion?: string;
  hasTag: boolean;
  hasConversion: boolean;
  isEmpty: boolean; // True if /var/www/domain.com is empty (no deployed content)
  palladiumCampaignId?: string; // Palladium campaign identifier
  palladiumCampaignGeo?: string; // JSON array of countries for Palladium campaign
  targetTraffic: number; // Cached target traffic from Palladium (total)
  targetUniqueTraffic: number; // Cached target unique traffic from Palladium
  botTotalTraffic: number; // Cached bot total traffic from Palladium
  botTraffic: number; // Cached bot unique traffic from Palladium
  trafficUpdatedAt?: Date | string; // When traffic stats were last updated
  healthStatus?: string; // HEALTHY | WARNING | CRITICAL | UNKNOWN
  lastHealthCheckAt?: Date | string;
  dnsBlocked?: boolean;
  dnsBlockedCountries?: string | null; // Comma-separated: "LV,EE"
  dnsBlockDetectedAt?: Date | string | null;
  reviewDeadline?: Date | string | null;
  lastReviewedAt?: Date | string | null;
  lastScannedAt?: Date | string;
  lastScanAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  server?: Server; // Optional populated server
  currentOffer?: Offer; // Optional populated offer
  assignedOperator?: User; // Optional populated assigned operator
}

export interface DomainWithServer extends Domain {
  server: Server;
}

export interface UpdateDomainDto {
  status?: DomainStatus;
  googleTag?: string;
  conversion?: string;
  customPrice?: number | null;
}

export interface InsertGoogleTagsDto {
  googleTag?: string;
  conversion?: string;
}

export interface ScanDomainsDto {
  domainIds?: string[]; // If omitted, scan all
}

export interface BulkBanDomainsDto {
  domains: string[]; // Array of domain names to ban
  deletePalladiumCampaigns?: boolean; // If true, also delete Palladium campaigns for banned domains
}

export interface BulkBanDomainsResult {
  banned: string[]; // Domains that were successfully banned
  alreadyBanned: string[]; // Domains that were already banned
  notFound: string[]; // Domains not found in database
  errors: Array<{ domain: string; error: string }>; // Domains that failed with errors
  campaignsDeleted?: string[]; // Domains whose Palladium campaigns were deleted
  campaignErrors?: Array<{ domain: string; campaignId: string; error: string }>; // Campaign deletion errors
}

// Bulk Activate Domains Types
export interface BulkActivateDomainsDto {
  domains: string[]; // Array of domain names to activate
}

export interface BulkActivateDomainsResult {
  activated: string[]; // Domains that were successfully activated (INACTIVE -> ACTIVE)
  alreadyActive: string[]; // Domains that were already ACTIVE
  banned: string[]; // Domains that are BANNED (skipped)
  notFound: string[]; // Domains not found in database
  errors: Array<{ domain: string; error: string }>; // Domains that failed with errors
}

export interface DomainScanResult {
  domainId: string;
  domainName: string;
  success: boolean;
  buyerTag?: string;
  error?: string;
}

export interface DomainsQueryParams {
  query?: string;
  status?: DomainStatus;
  hasTag?: 'true' | 'false';
  hasConversion?: 'true' | 'false';
  ownerId?: string;
  reviewStatus?: 'overdue' | 'due_soon' | 'ok' | '';
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'status' | 'buyerTag' | 'geo' | 'offerName' | 'lastScannedAt' | 'traffic' | 'reviewDeadline';
  sortOrder?: 'asc' | 'desc';
}

// Ping Thanks Types
export interface PingThanksDto {
  protocol: 'https' | 'http';
  path: string;
  query: string;
  timeout: number;
  retries: number;
  expect?: string;
  method?: 'GET' | 'POST';
  formData?: Record<string, string>;
}

export interface PingThanksResult {
  domainId: string;
  domainName?: string;
  ok: boolean;
  status?: number;
  timeMs?: number;
  url: string;
  error?: string | {
    code: string;
    message: string;
  };
  requestId?: string;
}

export interface PingThanksBulkDto extends PingThanksDto {
  domainIds: string[];
}

// Offer Types
export interface Offer {
  id: string;
  name: string;
  folderName: string;
  geo?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateOfferDto {
  name: string;
  folderName: string;
  geo?: string;
}

export interface UpdateOfferDto {
  name?: string;
  folderName?: string;
  geo?: string | null;
}

// Change Offer Types
export interface ChangeOfferDto {
  offerId: string;
}

export interface ChangeOfferBulkDto {
  domainIds: string[];
  offerId: string;
}

export interface AssignOperatorDto {
  operatorId: string | null; // null = unassign operator
}

export interface ChangeOfferResult {
  domainId: string;
  domainName: string;
  success: boolean;
  error?: string;
  filesCopied?: number;
  offerFolder?: string;
  offerName?: string;
  previousOfferId?: string;
  newOfferId: string;
  palladiumWarning?: string;
  // Rollback info (only on failure)
  rollbackStatus?: 'success' | 'failed' | 'not_needed';
  rolledBack?: string[];
}

// Palladium Integration Types
export interface PalladiumProfile {
  userId: number;
  email: string;
  registered: string;
  payment: string;
  daysPassed: string;
  paymentPlan: string;
  companies: number;
  clicks: number;
  companyLimit: number;
  selectedTimeZone: string;
  selectedTimeZoneLocal: string;
  isActive: boolean;
  paidExpiration: string;
  telegram: string;
  isTeamUser: boolean;
  isTeamUserEditAllow: boolean;
}

export interface PalladiumProfileError {
  error: 'NO_API_KEY' | 'UNAUTHORIZED' | 'REQUEST_FAILED';
  message: string;
  details?: any;
}

export interface PalladiumProfileResponse {
  success: true;
  profile: PalladiumProfile;
  keySource?: 'user' | 'global'; // Which API key was used
}

export interface PalladiumProfileErrorResponse {
  success: false;
  error: PalladiumProfileError;
}

export interface PalladiumTeamUser {
  id: number;
  firstName: string;
  email: string;
  telegram: string;
  editingAllowed: number;
  companyLimit: number;
}

// Health Check Types
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface HealthCheckNodeResult {
  nodeId: string;
  countryCode: string;
  country: string;
  city: string;
  success: boolean;
  httpStatus: string | null;
  responseTimeMs: number | null;
  statusMessage: string | null;
  ip: string | null;
  error: string | null;
  isCustomNode?: boolean;
  customNodeName?: string;
}

export interface HealthCheckResult {
  id: string;
  domainId: string;
  healthStatus: HealthStatus;
  totalNodes: number;
  successNodes: number;
  failedNodes: number;
  avgResponseTimeMs: number | null;
  nodeResults: HealthCheckNodeResult[];
  checkHostRequestId: string | null;
  issues: string[];
  dnsBlocked: boolean;
  dnsBlockedCountries: string[];
  dnsDetectedBlockers: string[];
  dnsNodeResults?: any[];
  checkedAt: Date | string;
}

export type NotificationType = 'HEALTH_ALERT' | 'HEALTH_RESOLVED' | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata: any;
  read: boolean;
  createdAt: Date | string;
}

// Domain Pool / Claim Types
export interface DomainPoolStats {
  totalAvailable: number;
  byServer: Array<{
    serverId: string;
    serverName: string;
    serverIp: string;
    availableCount: number;
  }>;
}

export interface ClaimDomainsDto {
  count: number; // How many domains to claim
}

export interface ClaimDomainsResult {
  success: boolean;
  claimedCount: number;
  domains: Array<{
    id: string;
    name: string;
    serverId: string;
    serverName: string;
  }>;
  remainingLimit: number; // How many more domains user can claim
}

// Domain Claim Audit
export interface DomainClaimAudit {
  id: string;
  userId: string;
  username: string;
  action: 'CLAIM_DOMAINS';
  claimedCount: number;
  domainIds: string[];
  domainNames: string[];
  createdAt: Date | string;
}

// Domain Import Types
export type DomainImportStatusType = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DomainImportRequest {
  domain: string;
  serverId?: string;
  serverIp?: string;
  buyerTag?: string;
  operatorId?: string;
  metadata?: Record<string, any>;
}

export interface DomainImportBulkRequest {
  domains: DomainImportRequest[];
}

export interface DomainImportResponse {
  id: string;
  domainName: string;
  serverId: string;
  status: DomainImportStatusType;
  domainId?: string | null;
  jobId?: string | null;
  errorMessage?: string | null;
  createdAt: Date | string;
}

export interface DomainImportBulkResponse {
  total: number;
  accepted: number;
  rejected: number;
  results: Array<{
    domain: string;
    accepted: boolean;
    importId?: string;
    error?: string;
  }>;
}

export interface DomainImportDlqEntry {
  id: string;
  importId: string;
  domainName: string;
  serverId: string;
  buyerTag?: string | null;
  operatorId?: string | null;
  errorMessage: string;
  attempts: number;
  payload: any;
  resolvedAt?: Date | string | null;
  createdAt: Date | string;
}

// Check Node Types (Custom Health Check Nodes)
export interface CheckNode {
  id: string;
  name: string;
  ip: string;
  sshPort: number;
  username: string;
  authType: 'password' | 'key';
  countryCode: string;
  country: string;
  city: string;
  enabled: boolean;
  lastCheckAt?: Date | string | null;
  lastError?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateCheckNodeDto {
  name: string;
  ip: string;
  sshPort?: number;
  username?: string;
  authType?: 'password' | 'key';
  credentials: string;
  countryCode: string;
  country: string;
  city?: string;
}

export interface UpdateCheckNodeDto {
  name?: string;
  ip?: string;
  sshPort?: number;
  username?: string;
  authType?: 'password' | 'key';
  credentials?: string;
  countryCode?: string;
  country?: string;
  city?: string;
  enabled?: boolean;
}
