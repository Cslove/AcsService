/**
 * PreferenceManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PreferenceManager } from "@/core/preference/PreferenceManager.js";
import { Preference, PreferenceType, PreferenceStrength } from "@/core/preference/Preference.js";
import { Message } from "@/core/message/Message.js";

describe("PreferenceManager", () => {
  let manager: PreferenceManager;
  const userId = "test-user-123";

  beforeEach(() => {
    manager = new PreferenceManager();
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("constructor", () => {
    it("应该使用默认配置创建管理器", () => {
      expect(manager).toBeDefined();
    });

    it("应该使用自定义配置创建管理器", () => {
      const customManager = new PreferenceManager({
        autoSave: false,
        autoUpdate: false,
        maxCacheSize: 50,
      });

      expect(customManager).toBeDefined();
    });
  });

  describe("getPreference", () => {
    it("应该为用户创建新偏好", async () => {
      const preference = await manager.getPreference(userId);

      expect(preference.getUserId()).toBe(userId);
      expect(preference.getTagCount()).toBe(0);
    });

    it("应该返回缓存的偏好", async () => {
      const preference1 = await manager.getPreference(userId);
      preference1.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const preference2 = await manager.getPreference(userId);

      expect(preference2.getTagCount()).toBe(0);
    });

    it("应该从存储加载偏好", async () => {
      const preference1 = await manager.getPreference(userId);
      preference1.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      await manager.savePreference(userId, preference1);

      // 清除缓存
      manager.clearUserCache(userId);

      const preference2 = await manager.getPreference(userId);

      expect(preference2.getTagCount()).toBe(1);
    });
  });

  describe("updatePreference", () => {
    it("应该更新用户偏好", async () => {
      const updatedPreference = await manager.updatePreference(userId, {
        getTags: () => [
          {
            id: "tag-1",
            name: "内容_科技",
            type: PreferenceType.CONTENT,
            value: "科技",
            strength: PreferenceStrength.NORMAL,
            confidence: 0.8,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as any);

      expect(updatedPreference.getTagCount()).toBe(1);
    });

    it("应该添加新标签到现有偏好", async () => {
      const preference = await manager.getPreference(userId);
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      await manager.savePreference(userId, preference);

      const updated = await manager.updatePreference(userId, {
        getTags: () => [
          {
            id: "tag-2",
            name: "风格_简洁",
            type: PreferenceType.STYLE,
            value: "简洁",
            strength: PreferenceStrength.NORMAL,
            confidence: 0.7,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as any);

      expect(updated.getTagCount()).toBe(2);
    });
  });

  describe("updateFromMessages", () => {
    it("应该从消息列表更新偏好", async () => {
      const messages = [
        Message.createUserMessage("msg-1", "我喜欢看科技新闻"),
        Message.createUserMessage("msg-2", "我喜欢简洁风格"),
      ];

      const preference = await manager.updateFromMessages(userId, messages);

      expect(preference.getUserId()).toBe(userId);
      expect(preference.getTagCount()).toBeGreaterThan(0);
    });

    it("应该增量更新现有偏好", async () => {
      const initialMessages = [Message.createUserMessage("msg-1", "我喜欢看科技新闻")];

      await manager.updateFromMessages(userId, initialMessages);

      const newMessages = [Message.createUserMessage("msg-2", "我喜欢简洁风格")];

      const updated = await manager.updateFromMessages(userId, newMessages);

      expect(updated.getTagCount()).toBeGreaterThan(1);
    });
  });

  describe("savePreference", () => {
    it("应该保存用户偏好", async () => {
      const preference = new Preference({ userId });
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      await manager.savePreference(userId, preference);

      const loaded = await manager.getPreference(userId);

      expect(loaded.getTagCount()).toBe(1);
    });

    it("应该在用户 ID 不匹配时抛出错误", async () => {
      const preference = new Preference({ userId: "other-user" });

      await expect(manager.savePreference(userId, preference)).rejects.toThrow();
    });
  });

  describe("deletePreference", () => {
    it("应该删除用户偏好", async () => {
      await manager.deletePreference(userId);

      const exists = await manager.hasPreference(userId);

      expect(exists).toBe(false);
    });
  });

  describe("hasPreference", () => {
    it("应该检查偏好是否存在", async () => {
      const exists1 = await manager.hasPreference(userId);
      expect(exists1).toBe(false);

      await manager.getPreference(userId);

      const exists2 = await manager.hasPreference(userId);
      expect(exists2).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("应该清除所有缓存", async () => {
      await manager.getPreference(userId);
      await manager.getPreference("user-456");

      expect(manager.getCacheSize()).toBe(2);

      manager.clearCache();

      expect(manager.getCacheSize()).toBe(0);
    });

    it("应该清除指定用户的缓存", async () => {
      await manager.getPreference(userId);
      await manager.getPreference("user-456");

      manager.clearUserCache(userId);

      expect(manager.getCacheSize()).toBe(1);
    });
  });

  describe("getCacheSize", () => {
    it("应该返回缓存大小", async () => {
      expect(manager.getCacheSize()).toBe(0);

      await manager.getPreference(userId);

      expect(manager.getCacheSize()).toBe(1);
    });
  });

  describe("getCachedUserIds", () => {
    it("应该返回所有缓存的用户 ID", async () => {
      await manager.getPreference(userId);
      await manager.getPreference("user-456");

      const ids = manager.getCachedUserIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain(userId);
      expect(ids).toContain("user-456");
    });
  });

  describe("getPreferences", () => {
    it("应该批量获取用户偏好", async () => {
      const userIds = [userId, "user-456", "user-789"];

      const preferences = await manager.getPreferences(userIds);

      expect(preferences.size).toBe(3);
      expect(preferences.get(userId)).toBeDefined();
      expect(preferences.get("user-456")).toBeDefined();
      expect(preferences.get("user-789")).toBeDefined();
    });
  });

  describe("mergePreferences", () => {
    it("应该合并偏好", async () => {
      const sourcePreference = new Preference({ userId });
      sourcePreference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const merged = await manager.mergePreferences(userId, sourcePreference);

      expect(merged.getTagCount()).toBe(1);
    });
  });

  describe("exportPreference", () => {
    it("应该导出偏好", async () => {
      const preference = await manager.getPreference(userId);
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      await manager.savePreference(userId, preference);

      const exported = await manager.exportPreference(userId);

      expect(exported.userId).toBe(userId);
      expect(exported.tags).toHaveLength(1);
    });
  });

  describe("importPreference", () => {
    it("应该导入偏好", async () => {
      const data = {
        userId,
        tags: [
          {
            id: "tag-1",
            name: "内容_科技",
            type: PreferenceType.CONTENT,
            value: "科技",
            strength: PreferenceStrength.NORMAL,
            confidence: 0.8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        metadata: {},
        tagCount: 1,
        lastUpdatedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const imported = await manager.importPreference(userId, data);

      expect(imported.getUserId()).toBe(userId);
      expect(imported.getTagCount()).toBe(1);
    });

    it("应该在用户 ID 不匹配时抛出错误", async () => {
      const data = {
        userId: "other-user",
        tags: [],
        metadata: {},
        tagCount: 0,
        lastUpdatedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(manager.importPreference(userId, data)).rejects.toThrow();
    });
  });

  describe("getAnalyzer", () => {
    it("应该返回分析器", () => {
      const analyzer = manager.getAnalyzer();

      expect(analyzer).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("应该返回统计信息", async () => {
      await manager.getPreference(userId);

      const stats = await manager.getStats();

      expect(stats.totalCached).toBe(1);
    });
  });

  describe("cleanup", () => {
    it("应该清理资源", async () => {
      await manager.getPreference(userId);

      await manager.cleanup();

      expect(manager.getCacheSize()).toBe(0);
    });
  });
});
