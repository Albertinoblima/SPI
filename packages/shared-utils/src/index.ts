// Shared Utils - Barrel export
export {
  formatDate,
  formatDateTime,
  isExpired,
  daysBetween,
} from './date-utils';

export {
  truncateText,
  slugify,
  formatPercentage,
  formatNumber,
  generateLocalId,
} from './format-utils';

export {
  getMethodologyHint,
  getZ,
  calcInterviews,
  localityIsInfinite,
} from './sampling-utils';

export * from './planning';

// Security utilities (Fase 2)
export {
  checkRateLimit,
  checkRateLimitDistributed,
  adminRateLimitKey,
} from './security/rate-limiter';
export type { RateLimitResult } from './security/rate-limiter';
export { logAdminAction } from './security/audit';
export { checkIdempotency, storeIdempotencyResult } from './security/idempotency';

// Server-only client (with next/headers) is NOT exported from barrel to avoid client bundle issues.
// Use direct subpath or web re-export.
export {
  createSupabaseAdminClient,
  createAuditedSupabaseAdminClient,
} from './supabase/admin-client';
