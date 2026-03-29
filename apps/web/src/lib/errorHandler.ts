import { toast } from 'sonner';
import i18n from '@/i18n';

/**
 * API Error structure returned from backend
 */
export interface ApiError {
  success: false;
  error: string | {
    requestId?: string;
    code?: string;
    message: string;
    stage?: string;
    domainId?: string;
    serverId?: string;
    details?: Record<string, any>;
  };
}

/**
 * Context for error toasts
 */
export interface ErrorContext {
  domain?: string;
  server?: string;
  operation?: string;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  ok: boolean;
  domainId?: string;
  domainName?: string;
  error?: string | { code?: string; message: string };
  atomic?: { ok: boolean; error?: string };
  cf?: { ok: boolean; error?: string };
}

/**
 * Get human-readable message for error code using i18n
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  ECONNREFUSED: 'errors.ECONNREFUSED',
  ETIMEDOUT: 'errors.ETIMEDOUT',
  ENOTFOUND: 'errors.ENOTFOUND',
  EHOSTUNREACH: 'errors.EHOSTUNREACH',
  EAUTH: 'errors.EAUTH',
  EACCES: 'errors.EACCES',
  EPERM: 'errors.EPERM',
  ENOENT: 'errors.ENOENT',
  EEXIST: 'errors.EEXIST',
  EISDIR: 'errors.EISDIR',
  ENOTDIR: 'errors.ENOTDIR',
  CF_AUTH_FAILED: 'errors.CF_AUTH_FAILED',
  CF_AUTH_MISSING: 'errors.CF_AUTH_MISSING',
  CF_ZONE_NOT_FOUND: 'errors.CF_ZONE_NOT_FOUND',
  CF_RATE_LIMIT: 'errors.CF_RATE_LIMIT',
  CF_API_ERROR: 'errors.CF_API_ERROR',
  INVALID_DOMAIN: 'errors.INVALID_DOMAIN',
  INVALID_BUYER_TAG: 'errors.INVALID_BUYER_TAG',
  DOMAIN_NOT_FOUND: 'errors.DOMAIN_NOT_FOUND',
  SERVER_NOT_FOUND: 'errors.SERVER_NOT_FOUND',
  DNS_ERROR: 'errors.DNS_ERROR',
  TIMEOUT: 'errors.TIMEOUT',
  CONNECTION_REFUSED: 'errors.CONNECTION_REFUSED',
  TLS_ERROR: 'errors.TLS_ERROR',
  HTTP_4XX: 'errors.HTTP_4XX',
  HTTP_5XX: 'errors.HTTP_5XX',
  EXPECT_MISMATCH: 'errors.EXPECT_MISMATCH',
  SSRF_BLOCKED: 'errors.SSRF_BLOCKED',
  INVALID_URL: 'errors.INVALID_URL',
  UNKNOWN: 'errors.UNKNOWN',
};

/**
 * Extract error message from various error formats
 */
function extractErrorMessage(error: any): { code: string; message: string; requestId?: string } {
  // Handle string errors
  if (typeof error === 'string') {
    return { code: 'UNKNOWN', message: error };
  }

  // Handle ApiError format
  if (error?.error) {
    if (typeof error.error === 'string') {
      return { code: 'UNKNOWN', message: error.error };
    }

    return {
      code: error.error.code || 'UNKNOWN',
      message: error.error.message || 'Unknown error',
      requestId: error.error.requestId,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Check if it's an axios/fetch error with response data
    if ('response' in error && typeof error.response === 'object') {
      const response = error.response as any;
      if (response?.data?.error) {
        if (typeof response.data.error === 'string') {
          return { code: 'UNKNOWN', message: response.data.error };
        }
        return {
          code: response.data.error.code || 'UNKNOWN',
          message: response.data.error.message || response.data.error,
          requestId: response.data.error.requestId,
        };
      }
    }

    return { code: 'UNKNOWN', message: error.message };
  }

  // Fallback
  return { code: 'UNKNOWN', message: i18n.t('errors.unexpectedOccurred') };
}

/**
 * Get translated message for error code
 */
function getErrorCodeMessage(code: string): string {
  const key = ERROR_CODE_KEYS[code] || ERROR_CODE_KEYS.UNKNOWN;
  return i18n.t(key);
}

/**
 * Show error toast for a single operation
 */
export function showActionErrorToast(
  action: string,
  error: any,
  context?: ErrorContext
): void {
  try {
    const { code, message, requestId } = extractErrorMessage(error);
    const codeMessage = getErrorCodeMessage(code);

    // Build context string
    const contextParts: string[] = [];
    if (context?.domain) contextParts.push(context.domain);
    if (context?.server) contextParts.push(context.server);
    const contextStr = contextParts.length > 0 ? `${contextParts.join(' • ')} — ` : '';

    // Build error message
    const errorMsg = code !== 'UNKNOWN'
      ? `${contextStr}${code}: ${codeMessage}`
      : `${contextStr}${message}`;

    // Show toast
    toast.error(i18n.t('errors.failed', { action }), {
      description: errorMsg,
      duration: 6000, // 6 seconds for errors
      action: requestId ? {
        label: i18n.t('errors.requestIdLabel'),
        onClick: () => {
          navigator.clipboard.writeText(requestId);
          toast.success(i18n.t('errors.requestIdCopied'));
        },
      } : undefined,
    });
  } catch (err) {
    // Fail-safe: if error handling crashes, show basic toast
    console.error('Error handler failed:', err);
    toast.error(i18n.t('errors.failed', { action }), {
      description: i18n.t('errors.unexpectedError'),
    });
  }
}

/**
 * Show summary toast for bulk operations
 */
export function showBulkOperationSummary(
  action: string,
  results: BulkOperationResult[],
  options?: {
    showSuccessToast?: boolean;
    showFailedDomains?: boolean;
  }
): void {
  try {
    const successCount = results.filter(r => r.ok).length;
    const failedCount = results.filter(r => !r.ok).length;
    const partialCount = results.filter(r =>
      r.atomic?.ok && !r.cf?.ok
    ).length;

    const total = results.length;

    // Collect failed domain names
    const failedDomains = results
      .filter(r => !r.ok)
      .map(r => r.domainName || r.domainId || 'unknown')
      .slice(0, 3); // Limit to first 3

    if (failedCount === 0 && partialCount === 0) {
      // All succeeded
      if (options?.showSuccessToast !== false) {
        toast.success(i18n.t('errors.bulkCompleted', { action }), {
          description: i18n.t('errors.allProcessed', { count: total }),
        });
      }
    } else if (failedCount === total) {
      // All failed
      toast.error(i18n.t('errors.failed', { action }), {
        description: i18n.t('errors.allFailed', { count: total }),
      });
    } else {
      // Mixed results
      const partialMsg = partialCount > 0 ? `, ${partialCount} partial` : '';
      let description = i18n.t('errors.succeededFailedPartial', { success: successCount, failed: failedCount }) + partialMsg;

      if (options?.showFailedDomains !== false && failedDomains.length > 0) {
        const failedList = failedDomains.join(', ');
        const moreText = failedCount > 3 ? ` ${i18n.t('errors.andMore', { count: failedCount - 3 })}` : '';
        description += `\n${i18n.t('errors.failedList', { list: failedList })}${moreText}`;
      }

      toast.warning(i18n.t('errors.completedWithErrors', { action }), {
        description,
        duration: 8000, // 8 seconds for summaries with errors
      });
    }
  } catch (err) {
    // Fail-safe
    console.error('Bulk summary handler failed:', err);
    toast.info(i18n.t('errors.bulkCompleted', { action }), {
      description: i18n.t('errors.seeDetails'),
    });
  }
}

/**
 * Show error for individual item during bulk operation
 * (Rate-limited to avoid spam)
 */
let lastItemErrorTime = 0;
const ITEM_ERROR_THROTTLE_MS = 2000; // Max one item error toast per 2 seconds

export function showBulkItemError(
  action: string,
  domainName: string,
  error: any,
  options?: {
    throttle?: boolean;
  }
): void {
  try {
    // Throttle to avoid spam
    if (options?.throttle !== false) {
      const now = Date.now();
      if (now - lastItemErrorTime < ITEM_ERROR_THROTTLE_MS) {
        return; // Skip this toast
      }
      lastItemErrorTime = now;
    }

    const { code, message } = extractErrorMessage(error);
    const codeMessage = getErrorCodeMessage(code);

    const errorMsg = code !== 'UNKNOWN'
      ? `${domainName} — ${code}: ${codeMessage}`
      : `${domainName} — ${message}`;

    toast.error(i18n.t('errors.failed', { action }), {
      description: errorMsg,
      duration: 4000, // Shorter duration for item errors
    });
  } catch (err) {
    // Fail-safe: silent failure for item errors during bulk ops
    console.error('Bulk item error handler failed:', err);
  }
}

/**
 * Extract partial success details (for Hard Refresh)
 */
export function analyzePartialSuccess(result: BulkOperationResult): {
  isPartial: boolean;
  atomicOk: boolean;
  cfOk: boolean;
  message: string;
} {
  const atomicOk = result.atomic?.ok ?? false;
  const cfOk = result.cf?.ok ?? false;
  const isPartial = atomicOk && !cfOk;

  let message = '';
  if (isPartial) {
    const cfError = typeof result.cf?.error === 'string'
      ? result.cf.error
      : (result.cf?.error as any)?.message || 'Unknown CF error';
    message = i18n.t('errors.atomicSucceededCfFailed', { error: cfError });
  }

  return { isPartial, atomicOk, cfOk, message };
}
