import { LRUCache } from "lru-cache";

export interface MemoryCacheOptions {
  maxSize?: number;
  maxAge?: number;
  updateAgeOnGet?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

export class MemoryCache<T extends Record<string, any> = any> {
  private cache: LRUCache<string, T>;
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: MemoryCacheOptions = {}) {
    this.cache = new LRUCache<string, T>({
      max: options.maxSize ?? 1000,
      ttl: options.maxAge ?? 1000 * 60 * 5, // 默认 5 分钟
      updateAgeOnGet: options.updateAgeOnGet ?? true,
    });
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
    } else {
      this.misses++;
    }
    return value;
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, { ttl });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
