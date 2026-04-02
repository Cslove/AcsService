/**
 * TopicCollector 诊断测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TopicCollector } from "@/application/services/TopicCollector.js";
import { PushService } from "@/application/services/PushService.js";
import { MemoryCache } from "@/infrastructure/storage/cache/MemoryCache.js";
import type { Topic } from "@/shared/types/index.js";

describe("TopicCollector Diagnostic", () => {
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

  describe("诊断测试", () => {
    it("步骤1: 初始化", async () => {
      console.log("步骤1: 开始初始化");
      await collector.initialize();
      console.log("步骤1: 初始化完成");
      expect(true).toBe(true);
    });

    it("步骤2: 从单个源收集", async () => {
      console.log("步骤2: 开始从 weibo 收集");
      await collector.initialize();
      const topics = await collector.collectFromSource("weibo");
      console.log(`步骤2: 收集完成，共 ${topics.length} 个话题`);
      expect(topics.length).toBeGreaterThan(0);
    });

    it("步骤3: 检查话题 ID", async () => {
      console.log("步骤3: 检查话题 ID");
      await collector.initialize();
      const topics = await collector.collectFromSource("weibo");
      console.log(
        `步骤3: 话题 ID 列表:`,
        topics.map((t) => t.id),
      );
      const uniqueIds = new Set(topics.map((t) => t.id));
      console.log(`步骤3: 唯一 ID 数量: ${uniqueIds.size}, 总话题数: ${topics.length}`);
      expect(uniqueIds.size).toBe(topics.length);
    });

    it("步骤4: 检查添加到 PushService", async () => {
      console.log("步骤4: 检查添加到 PushService");
      await collector.initialize();
      const topics = await collector.collectFromSource("weibo");
      console.log(`步骤4: 准备添加 ${topics.length} 个话题到 PushService`);

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        console.log(`步骤4: 添加话题 ${i + 1}/${topics.length}: ${topic.title}`);
        try {
          const converted = (collector as any).convertToPushServiceTopic(topic);
          pushService.addTopic(converted);
          console.log(`步骤4: 话题 ${i + 1} 添加成功`);
        } catch (error) {
          console.error(`步骤4: 话题 ${i + 1} 添加失败:`, error);
          throw error;
        }
      }

      console.log(`步骤4: 所有话题添加完成`);
      expect(pushService.getAllTopics().length).toBe(topics.length);
    });

    it("步骤5: 完整收集流程", async () => {
      console.log("步骤5: 开始完整收集流程");
      await collector.initialize();
      console.log("步骤5: 初始化完成，开始收集");

      const topics = await collector.collectTopics();
      console.log(`步骤5: 收集完成，共 ${topics.length} 个话题`);

      expect(topics.length).toBeGreaterThan(0);
    }, 10000);
  });
});
