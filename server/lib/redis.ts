import Redis from "ioredis";

/**
 * Redis client configuration
 *
 * This client is used for caching frequently accessed data
 * to improve performance and reduce database load.
 */

let redis: Redis | null = null;

/**
 * Get or create Redis client
 * Returns null if Redis is not configured (development fallback)
 */
export function getRedisClient(): Redis | null {
  // If Redis is already initialized, return it
  if (redis) {
    return redis;
  }

  // Check if Redis URL is configured
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn("[Redis] REDIS_URL not configured. Caching disabled.");
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });

    redis.on("error", (error) => {
      console.error("[Redis] Connection error:", error.message);
    });

    redis.on("close", () => {
      console.warn("[Redis] Connection closed");
    });

    return redis;
  } catch (error) {
    console.error("[Redis] Failed to initialize:", error);
    return null;
  }
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Redis] Error getting key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set value in cache with TTL (in seconds)
   */
  async set(key: string, value: any, ttl: number): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Redis] Error setting key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] Error deleting key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    const client = getRedisClient();
    if (!client) return 0;

    try {
      const keys = await client.keys(pattern);
      if (keys.length === 0) return 0;
      return await client.del(...keys);
    } catch (error) {
      console.error(`[Redis] Error deleting pattern ${pattern}:`, error);
      return 0;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Error checking key ${key}:`, error);
      return false;
    }
  },
};

/**
 * Cache key generators for Bling orders
 */
export const cacheKeys = {
  salesStatistics: (
    startDate: string,
    endDate: string,
    accountId?: string,
    contactType?: string,
  ) =>
    `bling:stats:sales:${startDate}:${endDate}:${accountId || "all"}:${contactType || "all"}`,

  salesComparison: (
    startDate: string,
    endDate: string,
    accountId?: string,
    contactType?: string,
  ) =>
    `bling:stats:comparison:${startDate}:${endDate}:${accountId || "all"}:${contactType || "all"}`,

  salesEvolution: (
    startDate: string,
    endDate: string,
    groupBy: string,
    accountId?: string,
    contactType?: string,
  ) =>
    `bling:stats:evolution:${startDate}:${endDate}:${groupBy}:${accountId || "all"}:${contactType || "all"}`,

  topSellers: (
    startDate: string,
    endDate: string,
    limit: number,
    contactType?: string,
  ) =>
    `bling:stats:top-sellers:${startDate}:${endDate}:${limit}:${contactType || "all"}`,

  topProducts: (
    startDate: string,
    endDate: string,
    limit: number,
    contactType?: string,
  ) =>
    `bling:stats:top-products:${startDate}:${endDate}:${limit}:${contactType || "all"}`,

  availableSellers: () => `bling:filters:sellers`,

  availableStores: () => `bling:filters:stores`,

  availableSituations: () => `bling:filters:situations`,

  availablePaymentMethods: () => `bling:filters:payment-methods`,

  cashbackStatistics: (startDate: string, endDate: string) =>
    `bling:stats:cashback:${startDate}:${endDate}`,

  // Pattern to invalidate all stats caches
  allStats: () => `bling:stats:*`,

  // Pattern to invalidate all filter caches
  allFilters: () => `bling:filters:*`,
};

/**
 * Default TTLs (in seconds)
 */
export const cacheTTL = {
  statistics: 5 * 60, // 5 minutes
  filters: 30 * 60, // 30 minutes
  evolution: 10 * 60, // 10 minutes
};
