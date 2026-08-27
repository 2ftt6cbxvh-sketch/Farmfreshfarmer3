/**
 * In-memory high-performance cache layer for FarmFreshFarmer API.
 * Provides microsecond responses for public endpoints (products, categories, settings, hero)
 * with instant tag-based invalidation upon admin mutations.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class FastMemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  /**
   * Get value from cache if present and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  /**
   * Set value in cache with TTL (seconds) and associated tags for invalidation
   */
  set<T>(key: string, value: T, ttlSeconds: number = 60, tags: string[] = []): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      tags,
    });
  }

  /**
   * Get cached value or execute producer function and cache result
   */
  async getOrSet<T>(key: string, producer: () => Promise<T>, ttlSeconds: number = 60, tags: string[] = []): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await producer();
    this.set(key, fresh, ttlSeconds, tags);
    return fresh;
  }

  /**
   * Invalidate specific key
   */
  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate all cache entries associated with any of the given tags
   */
  invalidateTags(tags: string[]): void {
    const tagSet = new Set(tags);
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.some((t) => tagSet.has(t))) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Invalidate by key prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.store.clear();
  }
}

export const apiCache = new FastMemoryCache();
