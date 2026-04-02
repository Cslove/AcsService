/**
 * TopicCollector 简化测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TopicCollector } from "@/application/services/TopicCollector.js";
import { PushService } from "@/application/services/PushService.js";
import { MemoryCache } from "@/infrastructure/storage/cache/MemoryCache.js";
import type { Topic } from "@/shared/types/index.js";

describe("TopicCollector Simple", () => {
  let collector: TopicCollector;
  let pushService: PushService;
  let memoryCache: MemoryCache<{ topics: Topic[]; timestamp: number }>;

  beforeEach(() => {
    pushService = new PushService();
    memoryCache = new MemoryCache<{ topics: Topic[]; timestamp: number }>({
      maxSize: 100,
      maxAge: 3600,
    });
    const mockCacheManager = {
      get: async (key: string) => memoryCache.get(key) || null,
      set: async (key: string, value: any, ttl?: number) => memoryCache.set(key, value, ttl),
      has: (key: string) => memoryCache.has(key),
      delete: (key: string) => memoryCache.delete(key),
      clear: () => memoryCache.clear(),
    };
    collector = new TopicCollector(pushService, mockCacheManager as any);
  });

  afterEach(async () => {
    pushService.cleanup();
    memoryCache.clear();
    vi.clearAllMocks();
  });

  describe("简化测试", () => {
    it("应该能初始化", async () => {
      await collector.initialize();
      expect(true).toBe(true);
    });

    it("应该能从单个源收集", async () => {
      await collector.initialize();
      const topics = await collector.collectFromSource("weibo");
      expect(topics.length).toBeGreaterThan(0);
    });

    it("应该能从所有源收集", async () => {
      await collector.initialize();
      const topics = await collector.collectTopics();
      expect(topics.length).toBeGreaterThan(0);
    }, 10000);
  });
});
