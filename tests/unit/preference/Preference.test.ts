/**
 * Preference 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Preference, PreferenceType, PreferenceStrength } from "@/core/preference/Preference.js";

describe("Preference", () => {
  let preference: Preference;
  const userId = "test-user-123";

  beforeEach(() => {
    preference = new Preference({ userId });
  });

  describe("constructor", () => {
    it("应该使用用户 ID 创建偏好", () => {
      expect(preference.getUserId()).toBe(userId);
    });

    it("应该初始化为空标签", () => {
      expect(preference.getTagCount()).toBe(0);
    });

    it("应该从配置初始化标签", () => {
      const tags = [
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
      ];

      const prefWithTags = new Preference({ userId, tags });
      expect(prefWithTags.getTagCount()).toBe(1);
    });
  });

  describe("addTag", () => {
    it("应该添加新标签", () => {
      const tag = preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      expect(tag.id).toBeDefined();
      expect(tag.name).toBe("内容_科技");
      expect(preference.getTagCount()).toBe(1);
    });

    it("应该为每个标签生成唯一 ID", () => {
      const tag1 = preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const tag2 = preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      expect(tag1.id).not.toBe(tag2.id);
    });
  });

  describe("getTags", () => {
    it("应该返回所有标签", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      preference.addTag({
        name: "风格_简洁",
        type: PreferenceType.STYLE,
        value: "简洁",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.7,
      });

      const tags = preference.getTags();
      expect(tags).toHaveLength(2);
    });

    it("应该根据类型返回标签", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      preference.addTag({
        name: "风格_简洁",
        type: PreferenceType.STYLE,
        value: "简洁",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.7,
      });

      const contentTags = preference.getTagsByType(PreferenceType.CONTENT);
      expect(contentTags).toHaveLength(1);
      expect(contentTags[0].type).toBe(PreferenceType.CONTENT);
    });
  });

  describe("updateTag", () => {
    it("应该更新现有标签", () => {
      const tag = preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const updated = preference.updateTag(tag.id, {
        strength: PreferenceStrength.STRONG,
        confidence: 0.9,
      });

      expect(updated).not.toBeNull();
      expect(updated?.strength).toBe(PreferenceStrength.STRONG);
      expect(updated?.confidence).toBe(0.9);
    });

    it("应该对不存在的标签返回 null", () => {
      const updated = preference.updateTag("non-existent-id", {
        strength: PreferenceStrength.STRONG,
      });

      expect(updated).toBeNull();
    });
  });

  describe("removeTag", () => {
    it("应该删除标签", () => {
      const tag = preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const removed = preference.removeTag(tag.id);

      expect(removed).toBe(true);
      expect(preference.getTagCount()).toBe(0);
    });

    it("应该对不存在的标签返回 false", () => {
      const removed = preference.removeTag("non-existent-id");
      expect(removed).toBe(false);
    });
  });

  describe("removeTagsByName", () => {
    it("应该根据名称删除标签", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.7,
      });

      const count = preference.removeTagsByName("内容_科技");

      expect(count).toBe(2);
      expect(preference.getTagCount()).toBe(0);
    });
  });

  describe("removeTagsByType", () => {
    it("应该根据类型删除标签", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      preference.addTag({
        name: "内容_体育",
        type: PreferenceType.CONTENT,
        value: "体育",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.7,
      });

      preference.addTag({
        name: "风格_简洁",
        type: PreferenceType.STYLE,
        value: "简洁",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.9,
      });

      const count = preference.removeTagsByType(PreferenceType.CONTENT);

      expect(count).toBe(2);
      expect(preference.getTagCount()).toBe(1);
    });
  });

  describe("getHighConfidenceTags", () => {
    it("应该返回高置信度标签", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      preference.addTag({
        name: "内容_体育",
        type: PreferenceType.CONTENT,
        value: "体育",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.6,
      });

      const highConfidenceTags = preference.getHighConfidenceTags();

      expect(highConfidenceTags).toHaveLength(1);
      expect(highConfidenceTags[0].name).toBe("内容_科技");
    });
  });

  describe("getStrongPreferenceTags", () => {
    it("应该返回强偏好标签", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.STRONG,
        confidence: 0.8,
      });

      preference.addTag({
        name: "内容_体育",
        type: PreferenceType.CONTENT,
        value: "体育",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.7,
      });

      const strongTags = preference.getStrongPreferenceTags();

      expect(strongTags).toHaveLength(1);
      expect(strongTags[0].name).toBe("内容_科技");
    });
  });

  describe("searchTags", () => {
    it("应该搜索标签", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      preference.addTag({
        name: "风格_简洁",
        type: PreferenceType.STYLE,
        value: "简洁",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.7,
      });

      const results = preference.searchTags("科技");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("内容_科技");
    });
  });

  describe("merge", () => {
    it("应该合并偏好", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const otherPreference = new Preference({ userId });
      otherPreference.addTag({
        name: "内容_体育",
        type: PreferenceType.CONTENT,
        value: "体育",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.7,
      });

      preference.merge(otherPreference);

      expect(preference.getTagCount()).toBe(2);
    });

    it("应该更新现有标签的强度和置信度", () => {
      const tag = preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.6,
      });

      const otherPreference = new Preference({ userId });
      otherPreference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.STRONG,
        confidence: 0.9,
      });

      preference.merge(otherPreference);

      const updatedTag = preference.getTagById(tag.id);
      expect(updatedTag?.strength).toBe(PreferenceStrength.STRONG);
      expect(updatedTag?.confidence).toBe(0.9);
    });
  });

  describe("toJSON and fromJSON", () => {
    it("应该序列化为 JSON", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const json = preference.toJSON();

      expect(json.userId).toBe(userId);
      expect(json.tags).toHaveLength(1);
      expect(json.tagCount).toBe(1);
    });

    it("应该从 JSON 反序列化", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const json = preference.toJSON();
      const deserialized = Preference.fromJSON(json);

      expect(deserialized.getUserId()).toBe(userId);
      expect(deserialized.getTagCount()).toBe(1);
    });
  });

  describe("metadata", () => {
    it("应该设置和获取元数据", () => {
      preference.setMetadata({ key: "value" });
      expect(preference.getMetadata()).toEqual({ key: "value" });
    });

    it("应该更新元数据", () => {
      preference.updateMetadata("key", "value");
      expect(preference.getMetadata()).toEqual({ key: "value" });
    });
  });

  describe("clone", () => {
    it("应该克隆偏好", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      const cloned = preference.clone();

      expect(cloned.getUserId()).toBe(userId);
      expect(cloned.getTagCount()).toBe(1);
      expect(cloned).not.toBe(preference);
    });
  });

  describe("cleanup", () => {
    it("应该清理资源", () => {
      preference.addTag({
        name: "内容_科技",
        type: PreferenceType.CONTENT,
        value: "科技",
        strength: PreferenceStrength.NORMAL,
        confidence: 0.8,
      });

      preference.cleanup();

      expect(preference.getTagCount()).toBe(0);
    });
  });
});
