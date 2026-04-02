/**
 * TopicSourceAdapter 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BaseTopicSourceAdapter,
  TopicSourceAdapterManager,
  type RawTopic,
} from "@/infrastructure/sources/TopicSourceAdapter.js";

describe("BaseTopicSourceAdapter", () => {
  class TestAdapter extends BaseTopicSourceAdapter {
    public readonly name = "test";
    public readonly url = "https://test.com";
    public readonly enabled = true;

    private shouldFail = false;
    private mockTopics: RawTopic[] = [
      {
        title: "Test Topic 1",
        score: 0.9,
        categories: ["test"],
        url: "https://test.com/1",
      },
      {
        title: "Test Topic 2",
        score: 0.7,
        categories: ["test"],
        url: "https://test.com/2",
      },
    ];

    protected async doFetchTopics(): Promise<RawTopic[]> {
      if (this.shouldFail) {
        throw new Error("Fetch failed");
      }
      return this.mockTopics;
    }

    public setShouldFail(shouldFail: boolean): void {
      this.shouldFail = shouldFail;
    }

    public setMockTopics(topics: RawTopic[]): void {
      this.mockTopics = topics;
    }
  }

  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchTopics", () => {
    it("应该成功抓取话题", async () => {
      const topics = await adapter.fetchTopics();

      expect(topics).toHaveLength(2);
      expect(topics[0].title).toBe("Test Topic 1");
      expect(topics[1].title).toBe("Test Topic 2");
    });

    it("应该在失败后重试", async () => {
      adapter.setShouldFail(true);
      adapter.setMockTopics([
        {
          title: "Retry Topic",
          score: 0.8,
          categories: ["test"],
        },
      ]);

      // 第一次失败，第二次成功
      adapter.setShouldFail(false);
      adapter.setMockTopics([
        {
          title: "Retry Topic",
          score: 0.8,
          categories: ["test"],
        },
      ]);

      const topics = await adapter.fetchTopics();

      expect(topics).toHaveLength(1);
    });
  });

  describe("normalizeTopic", () => {
    it("应该正确标准化话题", () => {
      const rawTopic: RawTopic = {
        title: "Test Topic",
        score: 0.85,
        categories: ["test", "category"],
        url: "https://test.com/topic",
        metadata: { extra: "data" },
      };

      const normalized = adapter.normalizeTopic(rawTopic);

      expect(normalized.id).toBeDefined();
      expect(normalized.title).toBe("Test Topic");
      expect(normalized.description).toBe("Test Topic");
      expect(normalized.source).toBe("test");
      expect(normalized.url).toBe("https://test.com/topic");
      expect(normalized.score).toBe(0.85);
      expect(normalized.categories).toEqual(["test", "category"]);
      expect(normalized.createdAt).toBeInstanceOf(Date);
    });

    it("应该限制分数在 0-1 之间", () => {
      const rawTopicHigh: RawTopic = {
        title: "High Score Topic",
        score: 1.5,
      };

      const normalizedHigh = adapter.normalizeTopic(rawTopicHigh);
      expect(normalizedHigh.score).toBe(1.0);

      const rawTopicLow: RawTopic = {
        title: "Low Score Topic",
        score: -0.5,
      };

      const normalizedLow = adapter.normalizeTopic(rawTopicLow);
      expect(normalizedLow.score).toBe(0.0);
    });

    it("应该使用默认分数 0.5", () => {
      const rawTopic: RawTopic = {
        title: "No Score Topic",
      };

      const normalized = adapter.normalizeTopic(rawTopic);
      expect(normalized.score).toBe(0.5);
    });
  });

  describe("filterTopics", () => {
    it("应该过滤低分话题", () => {
      const topics: RawTopic[] = [
        { title: "High Score", score: 0.9 },
        { title: "Medium Score", score: 0.6 },
        { title: "Low Score", score: 0.3 },
      ];

      const filtered = adapter["filterTopics"](topics);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((t) => adapter["calculateScore"](t) >= 0.5)).toBe(true);
    });
  });

  describe("limitTopics", () => {
    it("应该限制话题数量", () => {
      const topics: RawTopic[] = Array.from({ length: 30 }, (_, i) => ({
        title: `Topic ${i}`,
        score: 0.8,
      }));

      const limited = adapter["limitTopics"](topics);

      expect(limited.length).toBeLessThanOrEqual(20);
    });
  });
});

describe("TopicSourceAdapterManager", () => {
  let manager: TopicSourceAdapterManager;
  let mockAdapter: any;

  beforeEach(() => {
    manager = new TopicSourceAdapterManager();
    mockAdapter = {
      name: "mock",
      url: "https://mock.com",
      enabled: true,
      fetchTopics: vi.fn(),
      normalizeTopic: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("应该成功注册适配器", () => {
      manager.register(mockAdapter);

      expect(manager.get("mock")).toBe(mockAdapter);
    });
  });

  describe("get", () => {
    it("应该返回已注册的适配器", () => {
      manager.register(mockAdapter);

      const adapter = manager.get("mock");

      expect(adapter).toBe(mockAdapter);
    });

    it("应该返回 undefined 当适配器不存在", () => {
      const adapter = manager.get("non-existent");

      expect(adapter).toBeUndefined();
    });
  });

  describe("getEnabledAdapters", () => {
    it("应该返回所有启用的适配器", () => {
      const enabledAdapter = { ...mockAdapter, name: "enabled", enabled: true };
      const disabledAdapter = { ...mockAdapter, name: "disabled", enabled: false };

      manager.register(enabledAdapter);
      manager.register(disabledAdapter);

      const enabledAdapters = manager.getEnabledAdapters();

      expect(enabledAdapters).toHaveLength(1);
      expect(enabledAdapters[0].name).toBe("enabled");
    });
  });

  describe("unregister", () => {
    it("应该成功移除适配器", () => {
      manager.register(mockAdapter);
      manager.unregister("mock");

      expect(manager.get("mock")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("应该返回所有适配器", () => {
      const adapter1 = { ...mockAdapter, name: "adapter1" };
      const adapter2 = { ...mockAdapter, name: "adapter2" };

      manager.register(adapter1);
      manager.register(adapter2);

      const all = manager.getAll();

      expect(all).toHaveLength(2);
    });
  });
});
