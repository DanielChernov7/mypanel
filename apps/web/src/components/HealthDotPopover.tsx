import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { countryCodeToFlag } from '@/lib/utils';
import type { HealthCheckResult, HealthCheckNodeResult, HealthStatus } from '@server-panel/types';

function getHealthDotColor(status?: string) {
  switch (status) {
    case 'HEALTHY': return 'bg-green-500';
    case 'WARNING': return 'bg-yellow-500';
    case 'CRITICAL': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

export function HealthDotPopover({
  domainId,
  healthStatus,
  dnsBlockedCountries,
}: {
  domainId: string;
  healthStatus?: string;
  dnsBlockedCountries?: string | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; direction: 'bottom' | 'top' }>({ top: 0, left: 0, direction: 'bottom' });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  const { data: health, isLoading } = useQuery({
    queryKey: ['domain-health', domainId],
    queryFn: () => api.getDomainHealth(domainId),
    enabled: open,
    staleTime: 60_000,
  });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const direction = spaceBelow < 320 ? 'top' as const : 'bottom' as const;
    const popoverWidth = 288; // w-72 = 18rem = 288px

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    // Keep within viewport
    if (left < 8) left = 8;
    if (left + popoverWidth > window.innerWidth - 8) left = window.innerWidth - popoverWidth - 8;

    setCoords({
      top: direction === 'bottom' ? rect.bottom + 8 : rect.top - 8,
      left,
      direction,
    });
  }, []);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on scroll (parent containers)
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [open]);

  const handleEnter = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(true), 200);
  };

  const handleLeave = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(false), 300);
  };

  const r = health as HealthCheckResult | null | undefined;
  const allNodes = r?.nodeResults as HealthCheckNodeResult[] | undefined;
  const checkHostNodes = allNodes?.filter(n => !n.isCustomNode) || [];
  const customNodes = allNodes?.filter(n => n.isCustomNode) || [];

  // Summary line parts
  const checkHostOk = checkHostNodes.filter(n => n.success).length;
  const customOk = customNodes.filter(n => n.success).length;
  const customAvg = customNodes.length > 0
    ? Math.round(customNodes.filter(n => n.success && n.responseTimeMs).reduce((s, n) => s + (n.responseTimeMs || 0), 0) / Math.max(customNodes.filter(n => n.success && n.responseTimeMs).length, 1))
    : null;

  return (
    <div className="relative inline-flex items-center justify-center">
      <span
        ref={triggerRef}
        className={`h-3 w-3 rounded-full inline-block cursor-pointer ${getHealthDotColor(healthStatus)}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      />

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-72 rounded-lg border border-gray-700 bg-gray-900 shadow-xl p-3"
          style={{
            top: coords.direction === 'bottom' ? coords.top : undefined,
            bottom: coords.direction === 'top' ? window.innerHeight - coords.top : undefined,
            left: coords.left,
          }}
          onMouseEnter={() => clearTimeout(hoverTimer.current)}
          onMouseLeave={handleLeave}
        >
          {/* No health data at all */}
          {!healthStatus || healthStatus === 'UNKNOWN' ? (
            <p className="text-xs text-gray-500">{t('domains.healthUnknown')}</p>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              {t('common.loading')}
            </div>
          ) : !r ? (
            <p className="text-xs text-gray-500">{t('domains.healthUnknown')}</p>
          ) : (
            <div className="space-y-2">
              {/* Summary */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={r.healthStatus as HealthStatus} t={t} />
                <span className="text-xs text-gray-400">
                  {checkHostOk}/{checkHostNodes.length} OK
                  {customNodes.length > 0 && (
                    <> + {customOk}/{customNodes.length} custom</>
                  )}
                </span>
                {r.avgResponseTimeMs != null && (
                  <span className="text-xs text-gray-500">
                    ~{r.avgResponseTimeMs}ms
                  </span>
                )}
              </div>

              {/* DNS blocked countries */}
              {dnsBlockedCountries && (
                <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1">
                  {t('domains.healthBlockedIn', { countries: dnsBlockedCountries.replace(/,/g, ', ') })}
                </div>
              )}

              {/* check-host.net node grid */}
              {checkHostNodes.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                  {checkHostNodes.map((node) => (
                    <NodeItem key={node.nodeId} node={node} t={t} />
                  ))}
                </div>
              )}

              {/* Custom nodes section */}
              {customNodes.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
                    <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wide">Custom Nodes</span>
                    {customAvg != null && (
                      <span className="text-[10px] text-gray-500">~{customAvg}ms</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {customNodes.map((node) => (
                      <NodeItem key={node.nodeId} node={node} t={t} isCustom />
                    ))}
                  </div>
                </>
              )}

              {/* Issues */}
              {r.issues && r.issues.length > 0 && (
                <div className="text-xs text-red-400 space-y-0.5">
                  {r.issues.slice(0, 3).map((issue, i) => (
                    <div key={i} className="truncate">- {issue}</div>
                  ))}
                  {r.issues.length > 3 && (
                    <div className="text-gray-500">+{r.issues.length - 3} more</div>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div className="text-[10px] text-gray-600 pt-1 border-t border-gray-800">
                {new Date(r.checkedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: HealthStatus; t: (key: string) => string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    HEALTHY: { label: t('components.healthCheck.healthy'), cls: 'text-green-400 bg-green-500/10 border-green-500/30' },
    WARNING: { label: t('components.healthCheck.warning'), cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
    CRITICAL: { label: t('components.healthCheck.critical'), cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
    UNKNOWN: { label: t('components.healthCheck.unknown'), cls: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
  };
  const c = cfg[status] || cfg.UNKNOWN;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${c.cls}`}>
      {c.label}
    </span>
  );
}

function NodeItem({ node, t, isCustom }: { node: HealthCheckNodeResult; t: (key: string) => string; isCustom?: boolean }) {
  const flag = node.countryCode && node.countryCode !== 'unknown'
    ? countryCodeToFlag(node.countryCode.toUpperCase())
    : '';

  const borderClass = isCustom
    ? (node.success ? 'border-blue-700/50 bg-blue-900/15' : 'border-red-700/50 bg-red-900/20')
    : (node.success ? 'border-gray-700/50 bg-gray-800/30' : 'border-red-700/50 bg-red-900/20');

  return (
    <div className={`rounded border px-1.5 py-1 text-[11px] ${borderClass}`}>
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${node.success ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-white truncate">
          {flag} {isCustom && node.customNodeName ? node.customNodeName : (node.city || node.country)}
        </span>
      </div>
      <div className="text-gray-500 truncate">
        {node.success ? (
          <>{node.httpStatus} &middot; {node.responseTimeMs}ms</>
        ) : (
          <span className="text-red-400">{node.error || t('components.healthCheck.failed')}</span>
        )}
      </div>
    </div>
  );
}
