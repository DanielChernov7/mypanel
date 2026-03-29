import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';

import {
  users,
  servers,
  domains,
  offers,
  jobs,
  settings,
  notifications,
  audits,
  generateId,
  findUserByCredentials,
} from './data';

const app = express();
const JWT_SECRET = 'demo-secret';

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

/** Verify JWT and attach user to request */
function authenticateToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = users.find((u) => u.id === payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/** Require ADMIN role */
function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const user = (req as any).user;
  if (user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Helper: wrap response in { success, data } envelope
function ok<T>(res: express.Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = findUserByCredentials(username, password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
  const { ...safeUser } = user;
  ok(res, { token, user: safeUser });
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  const user = (req as any).user;
  ok(res, user);
});

app.post('/api/auth/profile/refresh-stats', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const userDomains = user.buyerTag
    ? domains.filter((d) => d.buyerTag === user.buyerTag)
    : domains;
  ok(res, {
    totalDomains: userDomains.length,
    activeDomains: userDomains.filter((d) => d.status === 'ACTIVE').length,
    inactiveDomains: userDomains.filter((d) => d.status === 'INACTIVE').length,
    bannedDomains: userDomains.filter((d) => d.status === 'BANNED').length,
    message: 'Stats refreshed',
  });
});

app.patch('/api/auth/profile/preferences', authenticateToken, (req, res) => {
  const user = (req as any).user;
  if (req.body.domainsPerPage) user.domainsPerPage = req.body.domainsPerPage;
  ok(res, { id: user.id, username: user.username, domainsPerPage: user.domainsPerPage });
});

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------
app.get('/api/servers', authenticateToken, (_req, res) => {
  const safe = servers.map(({ passwordOrKey, ...rest }) => rest);
  ok(res, safe);
});

app.get('/api/servers/:id', authenticateToken, (req, res) => {
  const server = servers.find((s) => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { passwordOrKey, ...safe } = server;
  ok(res, safe);
});

app.post('/api/servers', authenticateToken, (req, res) => {
  const server = {
    id: generateId(),
    sshPort: 22,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body,
  };
  servers.push(server);
  const { passwordOrKey, ...safe } = server;
  ok(res, safe, 201);
});

app.patch('/api/servers/:id', authenticateToken, (req, res) => {
  const idx = servers.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Server not found' });
  Object.assign(servers[idx], req.body, { updatedAt: new Date().toISOString() });
  const { passwordOrKey, ...safe } = servers[idx];
  ok(res, safe);
});

app.delete('/api/servers/:id', authenticateToken, (req, res) => {
  const idx = servers.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Server not found' });
  servers.splice(idx, 1);
  ok(res, { message: 'Server deleted' });
});

app.get('/api/servers/:id/browse', authenticateToken, (req, res) => {
  ok(res, [
    { name: 'index.html', type: 'file', size: 1234 },
    { name: 'product', type: 'directory', size: 0 },
    { name: 'thanks_you.php', type: 'file', size: 4567 },
    { name: '.htaccess', type: 'file', size: 234 },
    { name: 'assets', type: 'directory', size: 0 },
  ]);
});

app.get('/api/servers/:id/files', authenticateToken, (req, res) => {
  const path = req.query.path as string || '/var/www/index.html';
  ok(res, {
    path,
    content: '<!-- Demo file content -->\n<html><body>Hello World</body></html>',
    size: 64,
    permissions: '-rw-r--r--',
    owner: 'www-data',
    group: 'www-data',
    modifiedAt: new Date().toISOString(),
    checksum: 'abc123',
  });
});

app.post('/api/servers/:id/files/apply', authenticateToken, (req, res) => {
  ok(res, { message: 'File applied successfully', path: req.body.path });
});

app.get('/api/servers/:id/sites', authenticateToken, (req, res) => {
  const serverDomains = domains.filter((d) => d.serverId === req.params.id);
  ok(res, serverDomains.map((d) => d.name));
});

app.post('/api/servers/:id/discover', authenticateToken, (req, res) => {
  ok(res, { discovered: 0, message: 'Domain discovery complete (demo)' });
});

app.post('/api/servers/:id/create-domain', authenticateToken, (req, res) => {
  const { domainName } = req.body;
  const domain = {
    id: generateId(),
    name: domainName,
    serverId: req.params.id,
    status: 'INACTIVE' as const,
    hasTag: false,
    hasConversion: false,
    isEmpty: true,
    targetTraffic: 0,
    targetUniqueTraffic: 0,
    botTotalTraffic: 0,
    botTraffic: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  domains.push(domain as any);
  ok(res, { domain, folderCreated: true, path: `/var/www/${domainName}` });
});

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------
app.get('/api/domains', authenticateToken, (req, res) => {
  let filtered = [...domains];
  const query = req.query.query as string;
  const status = req.query.status as string;
  const ownerId = req.query.ownerId as string;
  const sortBy = (req.query.sortBy as string) || 'name';
  const sortOrder = (req.query.sortOrder as string) || 'asc';
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter((d) => d.name.toLowerCase().includes(q));
  }
  if (status) {
    filtered = filtered.filter((d) => d.status === status);
  }
  if (ownerId) {
    const operator = users.find((u) => u.id === ownerId);
    if (operator?.buyerTag) {
      filtered = filtered.filter((d) => d.buyerTag === operator.buyerTag);
    }
  }

  // Sort
  filtered.sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? '';
    const bVal = (b as any)[sortBy] ?? '';
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map((d) => ({
    ...d,
    server: servers.find((s) => s.id === d.serverId)
      ? (() => { const { passwordOrKey, ...s } = servers.find((s) => s.id === d.serverId)!; return s; })()
      : undefined,
  }));

  ok(res, { items, total, page, pageSize: limit });
});

app.get('/api/domains/:id', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  const server = servers.find((s) => s.id === domain.serverId);
  const safeServer = server ? (() => { const { passwordOrKey, ...s } = server; return s; })() : undefined;
  ok(res, { ...domain, server: safeServer });
});

app.patch('/api/domains/:id', authenticateToken, (req, res) => {
  const idx = domains.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Domain not found' });
  const allowed = ['status', 'googleTag', 'conversion', 'customPrice'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) (domains[idx] as any)[key] = req.body[key];
  }
  if (req.body.googleTag) domains[idx].hasTag = true;
  if (req.body.conversion) domains[idx].hasConversion = true;
  (domains[idx] as any).updatedAt = new Date().toISOString();
  ok(res, domains[idx]);
});

app.delete('/api/domains/:id', authenticateToken, (req, res) => {
  const idx = domains.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Domain not found' });
  domains.splice(idx, 1);
  ok(res, { message: 'Domain deleted' });
});

app.post('/api/domains/scan', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'DISCOVER',
    status: 'success',
    serverId: servers[0]?.id || 'srv-1',
    payload: req.body || {},
    result: { scannedCount: domains.length },
    progress: 100,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  ok(res, { success: true, message: 'Scan job created', jobId });
});

app.post('/api/domains/:id/change-offer', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });

  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'APPLY_OFFER_TO_DOMAIN',
    status: 'success',
    serverId: domain.serverId,
    domainId: domain.id,
    payload: { offerId: req.body.offerId, buyerTag: req.body.buyerTag },
    result: { domainName: domain.name, success: true, filesCopied: 12 },
    progress: 100,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  // Update domain offer reference
  if (req.body.offerId) {
    domain.currentOfferId = req.body.offerId;
    const offer = offers.find((o) => o.id === req.body.offerId);
    if (offer) domain.offerName = offer.name;
  }

  ok(res, { jobId, message: 'Change offer job created' });
});

app.post('/api/domains/change-offer-bulk', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const { domainIds, offerId } = req.body;
  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'APPLY_OFFER_TO_DOMAIN_BULK',
    status: 'running',
    serverId: servers[0]?.id || 'srv-1',
    payload: { domainIds, offerId },
    progress: 0,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  ok(res, { jobId, message: 'Bulk change offer job created', totalDomains: domainIds?.length || 0 });
});

app.post('/api/domains/:id/campaign', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (domain) domain.palladiumCampaignId = 'camp-' + generateId();
  ok(res, { success: true, campaignId: 'camp-' + generateId() });
});

app.delete('/api/domains/:id/campaign', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (domain) {
    const oldId = domain.palladiumCampaignId;
    domain.palladiumCampaignId = undefined;
    ok(res, { domain, message: `Campaign ${oldId || ''} deleted` });
  } else {
    ok(res, { success: true });
  }
});

app.post('/api/domains/:id/ping-thanks', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  const name = domain?.name || 'unknown.com';
  ok(res, {
    domainId: req.params.id,
    domainName: name,
    ok: true,
    status: 200,
    timeMs: Math.floor(Math.random() * 300) + 50,
    url: `https://${name}/thanks_you.php`,
  });
});

app.post('/api/domains/ping-thanks/bulk', authenticateToken, (req, res) => {
  const { domainIds } = req.body;
  const results = (domainIds || []).map((id: string) => {
    const domain = domains.find((d) => d.id === id);
    const name = domain?.name || 'unknown.com';
    return {
      domainId: id,
      domainName: name,
      ok: true,
      status: 200,
      timeMs: Math.floor(Math.random() * 300) + 50,
      url: `https://${name}/thanks_you.php`,
    };
  });
  ok(res, { results });
});

app.post('/api/domains/bulk-ban', authenticateToken, (req, res) => {
  const { domains: domainNames } = req.body;
  const banned: string[] = [];
  const alreadyBanned: string[] = [];
  const notFound: string[] = [];

  for (const name of domainNames || []) {
    const domain = domains.find((d) => d.name === name);
    if (!domain) {
      notFound.push(name);
    } else if (domain.status === 'BANNED') {
      alreadyBanned.push(name);
    } else {
      domain.status = 'BANNED';
      banned.push(name);
    }
  }

  ok(res, { banned, alreadyBanned, notFound, errors: [] });
});

app.post('/api/domains/bulk-activate', authenticateToken, (req, res) => {
  const { domains: domainNames } = req.body;
  const activated: string[] = [];
  const alreadyActive: string[] = [];
  const bannedList: string[] = [];
  const notFound: string[] = [];

  for (const name of domainNames || []) {
    const domain = domains.find((d) => d.name === name);
    if (!domain) {
      notFound.push(name);
    } else if (domain.status === 'ACTIVE') {
      alreadyActive.push(name);
    } else if (domain.status === 'BANNED') {
      bannedList.push(name);
    } else {
      domain.status = 'ACTIVE';
      activated.push(name);
    }
  }

  ok(res, { activated, alreadyActive, banned: bannedList, notFound, errors: [] });
});

app.post('/api/domains/lookup', authenticateToken, (req, res) => {
  const { names } = req.body;
  const found = (names || [])
    .map((n: string) => domains.find((d) => d.name === n))
    .filter(Boolean)
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      geo: d.geo || null,
      buyerTag: d.buyerTag || null,
      offerName: d.offerName || null,
    }));
  const notFound = (names || []).filter((n: string) => !domains.find((d) => d.name === n));
  ok(res, { found, notFound });
});

app.post('/api/domains/lookup-by-ids', authenticateToken, (req, res) => {
  const { ids } = req.body;
  const result = (ids || [])
    .map((id: string) => domains.find((d) => d.id === id))
    .filter(Boolean)
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      palladiumCampaignId: d.palladiumCampaignId || null,
      assignedOperator: null,
    }));
  ok(res, result);
});

app.patch('/api/domains/:id/buyer-tag', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  domain.buyerTag = req.body.buyerTag;
  ok(res, domain);
});

app.patch('/api/domains/:id/geo', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  domain.geo = req.body.geo;
  ok(res, domain);
});

app.patch('/api/domains/:id/offer', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  domain.offerName = req.body.offerName;
  ok(res, domain);
});

app.patch('/api/domains/:id/palladium-geo', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  domain.palladiumCampaignGeo = JSON.stringify(req.body.countries);
  ok(res, domain);
});

app.post('/api/domains/:id/review', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  (domain as any).lastReviewedAt = new Date().toISOString();
  ok(res, domain);
});

app.post('/api/domains/bulk-review', authenticateToken, (req, res) => {
  const { domainIds } = req.body;
  const now = new Date().toISOString();
  let reviewed = 0;
  for (const id of domainIds || []) {
    const d = domains.find((dom) => dom.id === id);
    if (d) { (d as any).lastReviewedAt = now; reviewed++; }
  }
  ok(res, { reviewed, total: (domainIds || []).length });
});

app.post('/api/domains/:id/insert-tags', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  if (req.body.googleTag) { domain.googleTag = req.body.googleTag; domain.hasTag = true; }
  if (req.body.conversion) { domain.conversion = req.body.conversion; domain.hasConversion = true; }
  ok(res, { message: 'Tags inserted', domain });
});

app.post('/api/domains/:id/atomic-refresh', authenticateToken, (req, res) => {
  ok(res, { message: 'Cache purged successfully' });
});

app.post('/api/domains/campaign-stats', authenticateToken, (req, res) => {
  const { campaignIds } = req.body;
  const stats: Record<string, any> = {};
  for (const id of campaignIds || []) {
    stats[id] = {
      botTraffic: String(Math.floor(Math.random() * 100)),
      targetTraffic: String(Math.floor(Math.random() * 500)),
      botTotalTraffic: String(Math.floor(Math.random() * 200)),
      targetUniqueTraffic: String(Math.floor(Math.random() * 300)),
    };
  }
  res.json({ success: true, stats });
});

app.post('/api/domains/refresh-traffic', authenticateToken, (req, res) => {
  ok(res, { updated: domains.length, total: domains.length, message: 'Traffic stats refreshed' });
});

app.get('/api/domains/total-traffic', authenticateToken, (_req, res) => {
  ok(res, {
    totalTarget: domains.reduce((s, d) => s + (d.targetTraffic || 0), 0),
    totalTargetUnique: domains.reduce((s, d) => s + (d.targetUniqueTraffic || 0), 0),
    totalBotTotal: domains.reduce((s, d) => s + (d.botTotalTraffic || 0), 0),
    totalBot: domains.reduce((s, d) => s + (d.botTraffic || 0), 0),
    totalDomains: domains.length,
  });
});

app.patch('/api/domains/:id/assign-operator', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  (domain as any).assignedOperatorId = req.body.operatorId;
  ok(res, domain);
});

app.delete('/api/domains/campaigns/bulk', authenticateToken, (req, res) => {
  const { domainIds } = req.body;
  const deleted: any[] = [];
  for (const id of domainIds || []) {
    const d = domains.find((dom) => dom.id === id);
    if (d?.palladiumCampaignId) {
      deleted.push({ domainId: id, domainName: d.name, campaignId: d.palladiumCampaignId });
      d.palladiumCampaignId = undefined;
    }
  }
  ok(res, { deleted, errors: [], message: `${deleted.length} campaigns deleted` });
});

app.post('/api/domains/deploy-cloak-bulk', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'DEPLOY_CLOAK_BULK',
    status: 'running',
    serverId: servers[0]?.id || 'srv-1',
    payload: req.body,
    progress: 0,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  ok(res, { jobId, message: 'Deploy cloak bulk job created', totalDomains: req.body.domainIds?.length || 0, countries: req.body.countries });
});

app.post('/api/domains/deploy-domains', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'DEPLOY_DOMAINS',
    status: 'running',
    serverId: servers[0]?.id || 'srv-1',
    payload: req.body,
    progress: 0,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  ok(res, { jobId, message: 'Deploy domains job created', totalDomains: 0 });
});

app.post('/api/domains/bulk-update-offer-meta', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'BULK_UPDATE_OFFER_META',
    status: 'success',
    serverId: servers[0]?.id || 'srv-1',
    payload: req.body,
    result: { updated: req.body.domainIds?.length || 0 },
    progress: 100,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  ok(res, { jobId, message: 'Bulk update offer meta job created' });
});

app.post('/api/domains/scan-deployment-status', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'SCAN_DEPLOYMENT_STATUS',
    status: 'running',
    serverId: servers[0]?.id || 'srv-1',
    payload: {},
    progress: 0,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  ok(res, { jobId, message: 'Scan deployment status job created' });
});

app.post('/api/domains/discover', authenticateToken, (req, res) => {
  ok(res, { discovered: 0, message: 'Domain discovery complete (demo)' });
});

// Domain pool endpoints (stubs)
app.get('/api/domains/pool/stats', authenticateToken, (_req, res) => {
  ok(res, {
    totalAvailable: 10,
    com: { available: 5, price: 8.99 },
    org: { available: 3, price: 7.20 },
    other: { available: 2, price: 5.50 },
  });
});

app.post('/api/domains/pool/claim', authenticateToken, (req, res) => {
  ok(res, { claimedCount: req.body.count || 0, domains: [], remainingLimit: 50 });
});

app.get('/api/domains/pool/my-stats', authenticateToken, (_req, res) => {
  ok(res, {
    domainLimit: 100,
    totalClaimed: 5,
    remainingLimit: 95,
    activeDomains: 3,
    inactiveDomains: 2,
    bannedDomains: 0,
    totalCost: 44.95,
  });
});

app.get('/api/domains/pool/audit', authenticateToken, (_req, res) => {
  ok(res, { items: [], total: 0, page: 1, pageSize: 50 });
});

app.get('/api/domains/pool/domains', authenticateToken, (_req, res) => {
  ok(res, { items: [], total: 0, page: 1, pageSize: 50 });
});

app.get('/api/domains/pool/available', authenticateToken, (_req, res) => {
  ok(res, { items: [], total: 0, page: 1, pageSize: 50 });
});

app.post('/api/domains/pool/add', authenticateToken, (req, res) => {
  ok(res, { addedCount: req.body.domainIds?.length || 0, requestedCount: req.body.domainIds?.length || 0 });
});

app.post('/api/domains/pool/remove', authenticateToken, (req, res) => {
  ok(res, { removedCount: req.body.domainIds?.length || 0, requestedCount: req.body.domainIds?.length || 0 });
});

app.get('/api/domains/pool/pending', authenticateToken, (_req, res) => {
  ok(res, { items: [], total: 0, page: 1, pageSize: 50, zonePricing: {} });
});

app.post('/api/domains/pool/approve', authenticateToken, (req, res) => {
  ok(res, { approvedCount: req.body.domainIds?.length || 0 });
});

app.patch('/api/domains/pool/pending/:id/price', authenticateToken, (req, res) => {
  const domain = domains.find((d) => d.id === req.params.id);
  if (domain) (domain as any).customPrice = req.body.price;
  ok(res, domain || {});
});

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
app.get('/api/jobs', authenticateToken, (req, res) => {
  let filtered = [...jobs];
  const status = req.query.status as string;
  const kind = req.query.kind as string;
  const serverId = req.query.serverId as string;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  if (status) filtered = filtered.filter((j) => j.status === status);
  if (kind) filtered = filtered.filter((j) => j.kind === kind);
  if (serverId) filtered = filtered.filter((j) => j.serverId === serverId);

  // Sort newest first
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const items = filtered.slice(offset, offset + limit).map((j) => ({
    ...j,
    server: servers.find((s) => s.id === j.serverId)
      ? (() => { const { passwordOrKey, ...s } = servers.find((s) => s.id === j.serverId)!; return s; })()
      : undefined,
    domain: j.domainId ? domains.find((d) => d.id === j.domainId) : undefined,
    createdBy: users.find((u) => u.id === j.createdById),
  }));

  ok(res, { jobs: items, total, limit, offset });
});

app.get('/api/jobs/queue/diagnostics', authenticateToken, (_req, res) => {
  ok(res, {
    memoryStats: { queuedJobs: 0, runningJobs: 0, maxConcurrentJobs: 3, maxSSHJobs: 5, jobTimeoutMinutes: 30 },
    memoryQueuedJobIds: [],
    memoryRunningJobIds: [],
    dbActiveJobs: [],
    dbQueuedJobs: [],
    stuckJobs: [],
    mismatchedJobs: [],
    recommendations: [],
  });
});

app.get('/api/jobs/:id', authenticateToken, (req, res) => {
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  ok(res, {
    ...job,
    server: servers.find((s) => s.id === job.serverId)
      ? (() => { const { passwordOrKey, ...s } = servers.find((s) => s.id === job.serverId)!; return s; })()
      : undefined,
    domain: job.domainId ? domains.find((d) => d.id === job.domainId) : undefined,
    createdBy: users.find((u) => u.id === job.createdById),
  });
});

app.post('/api/jobs/:id/cancel', authenticateToken, (req, res) => {
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.status = 'cancelled';
  job.finishedAt = new Date().toISOString();
  ok(res, { jobId: job.id, status: 'cancelled', message: 'Job cancelled' });
});

app.post('/api/jobs/:id/force-fail', authenticateToken, (req, res) => {
  const job = jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const prev = job.status;
  job.status = 'failed';
  job.finishedAt = new Date().toISOString();
  ok(res, { jobId: job.id, previousStatus: prev, newStatus: 'failed', message: 'Job force-failed' });
});

app.post('/api/jobs/queue/re-enqueue-all', authenticateToken, (_req, res) => {
  ok(res, { totalOrphaned: 0, enqueued: 0, failed: 0, message: 'No orphaned jobs found' });
});

app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
  const idx = jobs.findIndex((j) => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Job not found' });
  jobs.splice(idx, 1);
  ok(res, { message: 'Job deleted' });
});

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------
app.get('/api/offers', authenticateToken, (_req, res) => {
  ok(res, offers);
});

app.get('/api/offers/:id', authenticateToken, (req, res) => {
  const offer = offers.find((o) => o.id === req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  ok(res, offer);
});

app.post('/api/offers', authenticateToken, (req, res) => {
  const offer = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body,
  };
  offers.push(offer);
  ok(res, offer, 201);
});

app.patch('/api/offers/:id', authenticateToken, (req, res) => {
  const idx = offers.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Offer not found' });
  Object.assign(offers[idx], req.body, { updatedAt: new Date().toISOString() });
  ok(res, offers[idx]);
});

app.delete('/api/offers/:id', authenticateToken, (req, res) => {
  const idx = offers.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Offer not found' });
  offers.splice(idx, 1);
  ok(res, { message: 'Offer deleted' });
});

app.get('/api/offers/:id/files', authenticateToken, (_req, res) => {
  ok(res, [
    { name: 'index.php', size: 2048, modifiedAt: new Date().toISOString() },
    { name: 'style.css', size: 512, modifiedAt: new Date().toISOString() },
    { name: 'script.js', size: 1024, modifiedAt: new Date().toISOString() },
  ]);
});

app.get('/api/offers/:id/files/*', authenticateToken, (req, res) => {
  const filename = req.params[0] || 'index.php';
  ok(res, {
    filename,
    content: `<?php\n// Demo file: ${filename}\necho "Hello from offer";\n?>`,
    size: 64,
    modifiedAt: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Users (ADMIN only)
// ---------------------------------------------------------------------------
app.get('/api/users', authenticateToken, requireAdmin, (_req, res) => {
  const safe = users.map(({ passwordHash, ...rest }: any) => rest);
  ok(res, safe);
});

app.get('/api/users/operators', authenticateToken, (_req, res) => {
  const operators = users
    .filter((u) => u.role === 'OPERATOR')
    .map(({ passwordHash, ...rest }: any) => rest);
  ok(res, operators);
});

app.get('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, ...safe } = user as any;
  ok(res, safe);
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const user = {
    id: generateId(),
    role: 'OPERATOR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...req.body,
    passwordHash: 'hashed-' + (req.body.password || 'password'),
  };
  delete user.password;
  users.push(user);
  const { passwordHash, ...safe } = user as any;
  ok(res, safe, 201);
});

app.patch('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const updates = { ...req.body, updatedAt: new Date().toISOString() };
  if (updates.password) {
    updates.passwordHash = 'hashed-' + updates.password;
    delete updates.password;
  }
  Object.assign(users[idx], updates);
  const { passwordHash, ...safe } = users[idx] as any;
  ok(res, safe);
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users.splice(idx, 1);
  ok(res, { message: 'User deleted' });
});

// Financial stats (admin)
app.get('/api/users/operators/stats', authenticateToken, requireAdmin, (_req, res) => {
  ok(res, {
    operators: [],
    totals: { totalOperators: 0, totalClaimed: 0, totalActive: 0, totalInactive: 0, totalBanned: 0, totalCost: 0 },
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
app.get('/api/settings', authenticateToken, (_req, res) => {
  ok(res, settings);
});

app.get('/api/settings/maintenance-status', (_req, res) => {
  res.json({ maintenanceMode: false });
});

app.patch('/api/settings/:key', authenticateToken, requireAdmin, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  (settings as any)[key] = value;
  ok(res, { key, value });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
app.get('/api/notifications', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const userNotifications = notifications.filter(
    (n) => n.userId === user.id || n.userId === null,
  );
  ok(res, userNotifications);
});

app.patch('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const notification = notifications.find((n) => n.id === req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  notification.read = true;
  ok(res, notification);
});

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
app.get('/api/audit', authenticateToken, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const total = audits.length;
  const start = (page - 1) * limit;
  const items = audits.slice(start, start + limit);
  ok(res, { items, total, page, pageSize: limit });
});

// ---------------------------------------------------------------------------
// Whites (stubs)
// ---------------------------------------------------------------------------
app.get('/api/whites', authenticateToken, (_req, res) => {
  ok(res, [
    { name: 'white-default', path: '/var/data/panel/whites/white-default', createdAt: new Date().toISOString(), fileCount: 5 },
  ]);
});

app.post('/api/whites/upload', authenticateToken, (_req, res) => {
  ok(res, { whiteFolder: 'white-upload-' + generateId(), path: '/var/data/panel/whites/white-upload', fileCount: 1 });
});

app.delete('/api/whites/:name', authenticateToken, (_req, res) => {
  ok(res, { message: 'White deleted' });
});

// ---------------------------------------------------------------------------
// Scripts (stub)
// ---------------------------------------------------------------------------
app.post('/api/scripts/:serverId/run', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const jobId = generateId();
  jobs.push({
    id: jobId,
    kind: 'SCRIPT_RUN',
    status: 'running',
    serverId: req.params.serverId,
    payload: req.body,
    progress: 0,
    attempt: 0,
    maxAttempts: 3,
    createdById: user.id,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  ok(res, { jobId });
});

// ---------------------------------------------------------------------------
// Palladium (stubs)
// ---------------------------------------------------------------------------
app.get('/api/palladium/profile', authenticateToken, (_req, res) => {
  ok(res, {
    success: true,
    profile: {
      userId: 1,
      email: 'demo@example.com',
      registered: '2025-01-01',
      payment: 'active',
      daysPassed: '365',
      paymentPlan: 'Pro',
      companies: 50,
      clicks: 12500,
      companyLimit: 100,
      selectedTimeZone: 'UTC',
      selectedTimeZoneLocal: 'UTC',
      isActive: true,
      paidExpiration: '2027-01-01',
      telegram: '@demo',
      isTeamUser: false,
      isTeamUserEditAllow: false,
    },
    keySource: 'global',
  });
});

app.get('/api/palladium/campaigns', authenticateToken, (_req, res) => {
  ok(res, []);
});

// ---------------------------------------------------------------------------
// Check Nodes (stubs)
// ---------------------------------------------------------------------------
app.get('/api/check-nodes', authenticateToken, (_req, res) => {
  ok(res, []);
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/api/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// HTTP + WebSocket Server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  // Parse jobId from URL: /ws/job/:id
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathParts = url.pathname.split('/');
  // Expected path: /ws/job/<jobId>
  const jobId = pathParts.length >= 4 && pathParts[1] === 'ws' && pathParts[2] === 'job'
    ? pathParts[3]
    : 'unknown';

  const logMessages = [
    `[INFO] Starting job ${jobId}...`,
    `[INFO] Connecting to server via SSH...`,
    `[INFO] Connected. Executing deployment...`,
    `[INFO] Copying files (12 files)...`,
    `[INFO] Deployment complete. Verifying...`,
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      return;
    }

    if (index < logMessages.length) {
      ws.send(
        JSON.stringify({
          type: 'log',
          data: { type: 'stdout', content: logMessages[index], ts: Date.now() },
          ts: Date.now(),
        }),
      );
      index++;
    } else {
      // Send completion status
      ws.send(
        JSON.stringify({
          type: 'status',
          data: { status: 'success', exitCode: 0, ts: Date.now() },
          ts: Date.now(),
        }),
      );
      clearInterval(interval);
    }
  }, 600);
});

const PORT = parseInt(process.env.PORT || '3001', 10);

server.listen(PORT, () => {
  console.log(`Mock API running on http://localhost:${PORT}`);
});
