import {
  MemoryCache,
  type MemoryCacheOptions,
  type CacheStats as MemoryCacheStats,
} from "./MemoryCache.js";
import { FileCache, type FileCacheOptions } from "./FileCache.js";

export interface CacheManagerOptions {
  memory?: MemoryCacheOptions;
  file?: FileCacheOptions;
}

export interface CacheStats {
  memory: MemoryCacheStats;
  file: {
    size: number;
    count: number;
    totalSize: number;
  };
}

export class CacheManager<T extends Record<string, any> = any> {
  private memoryCache: MemoryCache<T>;
  private fileCache: FileCache<T>;

  constructor(options: CacheManagerOptions = {}) {
    this.memoryCache = new MemoryCache(options.memory);
    this.fileCache = new FileCache(options.file);
  }

  /**
   * 读穿透：先从内存缓存读取，如果没有则从文件缓存读取，并更新内存缓存
   */
  async get(key: string): Promise<T | null> {
    // 先从内存缓存读取
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      return memoryValue;
    }

    // 从文件缓存读取
    const fileValue = await this.fileCache.get(key);
    if (fileValue !== null) {
      // 更新内存缓存
      this.memoryCache.set(key, fileValue);
      return fileValue;
    }

    return null;
  }

  /**
   * 写穿透：同时写入内存缓存和文件缓存
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    // 写入内存缓存
    this.memoryCache.set(key, value, ttl);

    // 写入文件缓存
    await this.fileCache.set(key, value, ttl);
  }

  /**
   * 检查缓存是否存在（仅检查内存缓存，提高性能）
   */
  has(key: string): boolean {
    return this.memoryCache.has(key);
  }

  /**
   * 删除缓存（同时删除内存缓存和文件缓存）
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.fileCache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.fileCache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<CacheStats> {
    const memoryStats = this.memoryCache.getStats();
    const fileStats = await this.fileCache.getStats();

    return {
      memory: memoryStats,
      file: fileStats,
    };
  }

  /**
   * 刷新缓存：从文件缓存重新加载到内存缓存
   */
  async refresh(key: string): Promise<void> {
    // 从内存缓存删除
    this.memoryCache.delete(key);

    // 从文件缓存重新加载
    const fileValue = await this.fileCache.get(key);
    if (fileValue !== null) {
      this.memoryCache.set(key, fileValue);
    }
  }

  /**
   * 预热缓存：批量加载到内存缓存
   */
  async warmup(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.refresh(key);
    }
  }

  /**
   * 重置内存缓存统计
   */
  resetStats(): void {
    this.memoryCache.resetStats();
  }
}
