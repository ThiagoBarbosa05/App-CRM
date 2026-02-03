import { cache, cacheKeys } from "./redis";

/**
 * Cache invalidation service for Bling orders
 * 
 * This service provides methods to invalidate caches when data changes
 */
export const cacheInvalidation = {
  /**
   * Invalidate all statistics caches
   * Call this when new orders are created or updated
   */
  async invalidateAllStatistics(): Promise<void> {
    console.log("[CacheInvalidation] Invalidating all statistics caches");
    const deletedCount = await cache.delPattern(cacheKeys.allStats());
    console.log(`[CacheInvalidation] Deleted ${deletedCount} statistics cache keys`);
  },

  /**
   * Invalidate all filter caches
   * Call this when new sellers, stores, situations, or payment methods are added
   */
  async invalidateAllFilters(): Promise<void> {
    console.log("[CacheInvalidation] Invalidating all filter caches");
    const deletedCount = await cache.delPattern(cacheKeys.allFilters());
    console.log(`[CacheInvalidation] Deleted ${deletedCount} filter cache keys`);
  },

  /**
   * Invalidate all caches (statistics + filters)
   * Use this for major data changes
   */
  async invalidateAll(): Promise<void> {
    console.log("[CacheInvalidation] Invalidating all caches");
    await Promise.all([
      this.invalidateAllStatistics(),
      this.invalidateAllFilters(),
    ]);
  },

  /**
   * Invalidate specific seller-related caches
   */
  async invalidateSellerCaches(): Promise<void> {
    console.log("[CacheInvalidation] Invalidating seller caches");
    await cache.del(cacheKeys.availableSellers());
    // Also invalidate top sellers stats that might be affected
    await cache.delPattern("bling:stats:top-sellers:*");
  },

  /**
   * Invalidate specific store-related caches
   */
  async invalidateStoreCaches(): Promise<void> {
    console.log("[CacheInvalidation] Invalidating store caches");
    await cache.del(cacheKeys.availableStores());
  },

  /**
   * Invalidate specific situation-related caches
   */
  async invalidateSituationCaches(): Promise<void> {
    console.log("[CacheInvalidation] Invalidating situation caches");
    await cache.del(cacheKeys.availableSituations());
  },

  /**
   * Invalidate specific payment method-related caches
   */
  async invalidatePaymentMethodCaches(): Promise<void> {
    console.log("[CacheInvalidation] Invalidating payment method caches");
    await cache.del(cacheKeys.availablePaymentMethods());
  },
};

/**
 * Middleware to automatically invalidate caches after order mutations
 * This can be added to webhook endpoints or order creation/update endpoints
 */
export function invalidateCachesAfterOrderMutation() {
  // Invalidate all statistics and filter caches after order changes
  // Run in background (don't await) to not block the request
  cacheInvalidation.invalidateAll().catch((error) => {
    console.error("[CacheInvalidation] Error invalidating caches:", error);
  });
}
