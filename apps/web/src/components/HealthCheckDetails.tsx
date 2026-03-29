import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { countryCodeToFlag } from '@/lib/utils';
import type { HealthCheckResult, HealthCheckNodeResult, HealthStatus } from '@server-panel/types';

function HealthBadge({ status }: { status: HealthStatus }) {
  const { t } = useTranslation();
  const config: Record<HealthStatus, { label: string; className: string }> = {
    HEALTHY: { label: t('components.healthCheck.healthy'), className: 'bg-green-500/10 text-green-400 border-green-500/30' },
    WARNING: { label: t('components.healthCheck.warning'), className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    CRITICAL: { label: t('components.healthCheck.critical'), className: 'bg-red-500/10 text-red-400 border-red-500/30' },
    UNKNOWN: { label: t('components.healthCheck.unknown'), className: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  };

  const c = config[status] || config.UNKNOWN;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c.className}`}>
      {c.label}
    </span>
  );
}

function NodeCard({ node, t }: { node: HealthCheckNodeResult; t: (key: string) => string }) {
  const flag = node.countryCode && node.countryCode !== 'unknown'
    ? countryCodeToFlag(node.countryCode.toUpperCase())
    : '';

  return (
    <div className="rounded-md border border-gray-700 bg-gray-800/50 p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`h-2 w-2 rounded-full inline-block flex-shrink-0 ${
            node.success ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-xs font-medium text-white truncate">
          {flag} {node.city || node.country}
        </span>
      </div>
      <div className="text-xs text-gray-400">
        {node.success ? (
          <>
            HTTP {node.httpStatus} &middot; {node.responseTimeMs}ms
          </>
        ) : (
          <span className="text-red-400 truncate block">{node.error || t('components.healthCheck.failed')}</span>
        )}
      </div>
    </div>
  );
}

export function HealthCheckDetails({ domainId }: { domainId: string }) {
  const { t } = useTranslation();
  const { data: health, isLoading } = useQuery({
    queryKey: ['domain-health', domainId],
    queryFn: () => api.getDomainHealth(domainId),
  });

  if (isLoading) {
    return <p className="text-sm text-gray-500">{t('components.healthCheck.loadingHealthData')}</p>;
  }

  if (!health) {
    return <p className="text-sm text-gray-500">{t('components.healthCheck.noHealthData')}</p>;
  }

  const r = health as HealthCheckResult;
  const nodes = (r.nodeResults || []) as HealthCheckNodeResult[];
  const successRate = r.totalNodes > 0 ? Math.round((r.successNodes / r.totalNodes) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <HealthBadge status={r.healthStatus as HealthStatus} />
        <span className="text-gray-400">
          {t('components.healthCheck.nodesOk', { success: r.successNodes, total: r.totalNodes, percent: successRate })}
        </span>
        {r.avgResponseTimeMs !== null && r.avgResponseTimeMs !== undefined && (
          <span className="text-gray-400">
            {t('components.healthCheck.avg', { ms: r.avgResponseTimeMs })}
          </span>
        )}
      </div>

      {/* Node results grid */}
      {nodes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {nodes.map((node) => (
            <NodeCard key={node.nodeId} node={node} t={t} />
          ))}
        </div>
      )}

      {/* Issues section */}
      {r.issues && r.issues.length > 0 && (
        <div className="rounded-md border border-red-700/50 bg-red-900/20 p-3">
          <p className="text-xs font-medium text-red-400 mb-1">{t('components.healthCheck.issues')}</p>
          <ul className="text-xs text-red-300 space-y-0.5">
            {r.issues.map((issue: string, i: number) => (
              <li key={i}>- {issue}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {t('components.healthCheck.lastCheck')} {new Date(r.checkedAt).toLocaleString()}
      </p>
    </div>
  );
}
