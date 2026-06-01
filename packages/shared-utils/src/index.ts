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

// Note: Server-only Supabase clients are NOT re-exported from the main barrel
// to avoid pulling next/headers into client bundles.
// Import directly:
// import { createSupabaseServerClient } from '@political-research/shared-utils/supabase/server-client';
// (or from the web's @/lib/supabase/server re-export for convenience)
