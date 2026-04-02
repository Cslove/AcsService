/**
 * TopicCollector 调试测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TopicCollector } from "@/application/services/TopicCollector.js";
import { PushService } from "@/application/services/PushService.js";
import { MemoryCache } from "@/infrastructure/storage/cache/MemoryCache.js";
import type { Topic } from "@/shared/types/index.js";

describe("TopicCollector Debug", () => {
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

  describe("调试 collectTopics", () => {
    it("应该能完成收集流程", async () => {
      console.log("1. 开始初始化");
      await collector.initialize();
      console.log("2. 初始化完成");

      console.log("3. 开始收集话题");
      const topics = await collector.collectTopics();
      console.log(`4. 收集完成，共 ${topics.length} 个话题`);

      expect(topics.length).toBeGreaterThan(0);
    }, 10000);

    it("应该能从单个源收集", async () => {
      console.log("1. 开始初始化");
      await collector.initialize();
      console.log("2. 初始化完成");

      console.log("3. 开始从 weibo 收集");
      const topics = await collector.collectFromSource("weibo");
      console.log(`4. 收集完成，共 ${topics.length} 个话题`);

      expect(topics.length).toBeGreaterThan(0);
    }, 10000);
  });
});
