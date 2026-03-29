/**
 * PushService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PushService } from "@/application/services/PushService.js";

describe("PushService", () => {
  let service: PushService;

  beforeEach(() => {
    service = new PushService();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe("addTopic", () => {
    it("应该添加话题", () => {
      const topic = {
        id: "topic-1",
        title: "Test Topic",
        content: "This is a test topic",
        source: "test",
        category: "tech",
        tags: ["test", "topic"],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      };

      service.addTopic(topic);

      const retrieved = service.getTopic("topic-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe("Test Topic");
    });

    it("应该拒绝重复的话题 ID", () => {
      const topic = {
        id: "topic-1",
        title: "Test Topic",
        content: "This is a test topic",
        source: "test",
        category: "tech",
        tags: ["test", "topic"],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      };

      service.addTopic(topic);

      expect(() => {
        service.addTopic(topic);
      }).toThrow();
    });

    it("应该限制相关性分数", () => {
      const topic = {
        id: "topic-1",
        title: "Test Topic",
        content: "This is a test topic",
        source: "test",
        category: "tech",
        tags: ["test", "topic"],
        priority: 1,
        relevanceScore: 1.5,
        createdAt: new Date(),
      };

      service.addTopic(topic);

      const retrieved = service.getTopic("topic-1");
      expect(retrieved?.relevanceScore).toBe(1.0);
    });
  });

  describe("addTopics", () => {
    it("应该批量添加话题", () => {
      const topics = [
        {
          id: "topic-1",
          title: "Topic 1",
          content: "Content 1",
          source: "test",
          category: "tech",
          tags: ["test"],
          priority: 1,
          relevanceScore: 0.8,
          createdAt: new Date(),
        },
        {
          id: "topic-2",
          title: "Topic 2",
          content: "Content 2",
          source: "test",
          category: "tech",
          tags: ["test"],
          priority: 1,
          relevanceScore: 0.7,
          createdAt: new Date(),
        },
      ];

      service.addTopics(topics);

      expect(service.getAllTopics().length).toBe(2);
    });
  });

  describe("getTopicsByCategory", () => {
    it("应该按类别获取话题", () => {
      service.addTopic({
        id: "topic-1",
        title: "Tech Topic",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      service.addTopic({
        id: "topic-2",
        title: "News Topic",
        content: "Content",
        source: "test",
        category: "news",
        tags: [],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      const techTopics = service.getTopicsByCategory("tech");

      expect(techTopics.length).toBe(1);
      expect(techTopics[0].category).toBe("tech");
    });
  });

  describe("getTopicsByTag", () => {
    it("应该按标签获取话题", () => {
      service.addTopic({
        id: "topic-1",
        title: "Topic 1",
        content: "Content",
        source: "test",
        category: "tech",
        tags: ["python", "programming"],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      service.addTopic({
        id: "topic-2",
        title: "Topic 2",
        content: "Content",
        source: "test",
        category: "tech",
        tags: ["javascript", "programming"],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      const pythonTopics = service.getTopicsByTag("python");

      expect(pythonTopics.length).toBe(1);
      expect(pythonTopics[0].tags).toContain("python");
    });
  });

  describe("getHighRelevanceTopics", () => {
    it("应该获取高相关性话题", () => {
      service.addTopic({
        id: "topic-1",
        title: "High Relevance",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.9,
        createdAt: new Date(),
      });

      service.addTopic({
        id: "topic-2",
        title: "Low Relevance",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.5,
        createdAt: new Date(),
      });

      const highRelevanceTopics = service.getHighRelevanceTopics(0.7);

      expect(highRelevanceTopics.length).toBe(1);
      expect(highRelevanceTopics[0].relevanceScore).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("getTrendingTopics", () => {
    it("应该获取热门话题", () => {
      service.addTopic({
        id: "topic-1",
        title: "Topic 1",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.9,
        createdAt: new Date(),
      });

      service.addTopic({
        id: "topic-2",
        title: "Topic 2",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.7,
        createdAt: new Date(),
      });

      service.addTopic({
        id: "topic-3",
        title: "Topic 3",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      const trendingTopics = service.getTrendingTopics(2);

      expect(trendingTopics.length).toBe(2);
      expect(trendingTopics[0].relevanceScore).toBeGreaterThanOrEqual(
        trendingTopics[1].relevanceScore,
      );
    });
  });

  describe("createPushConfig", () => {
    it("应该创建推送配置", () => {
      const config = {
        userId: "user-1",
        topics: ["topic-1"],
        channels: ["web"],
        filters: [],
      };

      service.createPushConfig(config);

      const retrieved = service.getPushConfig("user-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe("user-1");
    });
  });

  describe("pushTopicsToUser", () => {
    it("应该为用户推送话题", async () => {
      service.addTopic({
        id: "topic-1",
        title: "Test Topic",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      service.createPushConfig({
        userId: "user-1",
        topics: ["topic-1"],
        channels: ["web"],
        filters: [],
      });

      const results = await service.pushTopicsToUser("user-1");

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].topicId).toBe("topic-1");
    });

    it("应该对不存在的配置抛出错误", async () => {
      await expect(service.pushTopicsToUser("non-existent")).rejects.toThrow();
    });
  });

  describe("getPushStats", () => {
    it("应该获取推送统计", async () => {
      service.addTopic({
        id: "topic-1",
        title: "Test Topic",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      service.createPushConfig({
        userId: "user-1",
        topics: ["topic-1"],
        channels: ["web"],
        filters: [],
      });

      await service.pushTopicsToUser("user-1");

      const stats = service.getPushStats();

      expect(stats.totalPushes).toBe(1);
      expect(stats.successfulPushes).toBe(1);
    });
  });

  describe("getTopicStats", () => {
    it("应该获取话题统计", () => {
      service.addTopic({
        id: "topic-1",
        title: "Topic 1",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      service.addTopic({
        id: "topic-2",
        title: "Topic 2",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.6,
        createdAt: new Date(),
      });

      const stats = service.getTopicStats();

      expect(stats.totalTopics).toBe(2);
      expect(stats.topicsByCategory.tech).toBe(2);
      expect(stats.averageRelevanceScore).toBe(0.7);
    });
  });

  describe("deleteTopic", () => {
    it("应该删除话题", () => {
      service.addTopic({
        id: "topic-1",
        title: "Topic 1",
        content: "Content",
        source: "test",
        category: "tech",
        tags: [],
        priority: 1,
        relevanceScore: 0.8,
        createdAt: new Date(),
      });

      const deleted = service.deleteTopic("topic-1");

      expect(deleted).toBe(true);
      expect(service.getTopic("topic-1")).toBeUndefined();
    });
  });
});
