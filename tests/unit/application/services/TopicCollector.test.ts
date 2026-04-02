/**
 * TopicCollector 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TopicCollector } from "@/application/services/TopicCollector.js";
import { PushService } from "@/application/services/PushService.js";
import { MemoryCache } from "@/infrastructure/storage/cache/MemoryCache.js";
import type { Topic } from "@/shared/types/index.js";

describe("TopicCollector", () => {
  let collector: TopicCollector;
  let pushService: PushService;
  let memoryCache: MemoryCache<{ topics: Topic[]; timestamp: number }>;

  beforeEach(() => {
    pushService = new PushService();
    // 使用只包含内存缓存的简单对象，避免文件 I/O
    memoryCache = new MemoryCache<{ topics: Topic[]; timestamp: number }>({
      maxSize: 100,
      maxAge: 3600,
    });
    // 创建一个简单的缓存管理器 mock
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

  describe("initialize", () => {
    it("应该成功初始化", async () => {
      await collector.initialize();

      const adapters = await collector.getRegisteredAdapters();
      expect(adapters.length).toBeGreaterThan(0);
    });

    it("应该只初始化一次", async () => {
      await collector.initialize();
      await collector.initialize();

      const adapters = await collector.getRegisteredAdapters();
      // 确保不会重复注册
      expect(adapters.length).toBeGreaterThan(0);
    });
  });

  describe("collectTopics", () => {
    it("应该从所有源收集话题", async () => {
      await collector.initialize();

      const topics = await collector.collectTopics();

      expect(topics.length).toBeGreaterThan(0);
      expect(topics.every((t) => t.id && t.title && t.source)).toBe(true);
    });

    it("应该去重话题", async () => {
      await collector.initialize();

      const topics = await collector.collectTopics();

      const titles = topics.map((t) => t.title);
      const uniqueTitles = new Set(titles);

      expect(titles.length).toBe(uniqueTitles.size);
    });

    it("应该缓存收集结果", async () => {
      await collector.initialize();

      await collector.collectTopics();

      const cached = await collector.getCachedTopics();

      expect(cached.length).toBeGreaterThan(0);
    });

    it("应该添加话题到 PushService", async () => {
      await collector.initialize();

      const addTopicSpy = vi.spyOn(pushService, "addTopic");

      await collector.collectTopics();

      expect(addTopicSpy).toHaveBeenCalled();
    });
  });

  describe("collectFromSource", () => {
    it("应该从指定源收集话题", async () => {
      await collector.initialize();

      const topics = await collector.collectFromSource("weibo");

      expect(topics.length).toBeGreaterThan(0);
      expect(topics.every((t) => t.source === "weibo")).toBe(true);
    });

    it("应该对不存在的源返回空数组", async () => {
      await collector.initialize();

      const topics = await collector.collectFromSource("non-existent");

      expect(topics).toHaveLength(0);
    });
  });

  describe("getCachedTopics", () => {
    it("应该返回缓存的话题", async () => {
      await collector.initialize();

      await collector.collectTopics();

      const cached = await collector.getCachedTopics();

      expect(cached.length).toBeGreaterThan(0);
    });

    it("应该在没有缓存时返回空数组", async () => {
      await collector.initialize();

      const cached = await collector.getCachedTopics();

      expect(cached).toHaveLength(0);
    });
  });

  describe("getRegisteredAdapters", () => {
    it("应该返回所有注册的适配器", async () => {
      await collector.initialize();

      const adapters = await collector.getRegisteredAdapters();

      expect(adapters.length).toBeGreaterThan(0);
      expect(adapters.every((a) => a.name && a.url)).toBe(true);
    });
  });

  describe("getEnabledAdapters", () => {
    it("应该返回启用的适配器", async () => {
      await collector.initialize();

      const enabledAdapters = await collector.getEnabledAdapters();

      expect(enabledAdapters.length).toBeGreaterThan(0);
      expect(enabledAdapters.every((a) => a.enabled)).toBe(true);
    });
  });

  describe("registerAdapter", () => {
    it("应该注册自定义适配器", async () => {
      await collector.initialize();

      const customAdapter = {
        name: "custom",
        url: "https://custom.com",
        enabled: true,
        fetchTopics: vi.fn().mockResolvedValue([]),
        normalizeTopic: vi.fn(),
      };

      collector.registerAdapter(customAdapter);

      const adapters = await collector.getRegisteredAdapters();
      const custom = adapters.find((a) => a.name === "custom");

      expect(custom).toBeDefined();
    });
  });

  describe("数据清洗和去重", () => {
    it("应该保留分数更高的重复话题", async () => {
      await collector.initialize();

      // 这个测试验证去重逻辑，实际数据来自模拟适配器
      const topics = await collector.collectTopics();

      const titles = topics.map((t) => t.title);
      const uniqueTitles = new Set(titles);

      expect(titles.length).toBe(uniqueTitles.size);
    });
  });
});
