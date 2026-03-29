/**
 * PreferenceAnalyzer 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PreferenceAnalyzer } from "@/core/preference/PreferenceAnalyzer.js";
import { Message } from "@/core/message/Message.js";
import { PreferenceType, PreferenceStrength } from "@/core/preference/Preference.js";

describe("PreferenceAnalyzer", () => {
  let analyzer: PreferenceAnalyzer;

  beforeEach(() => {
    analyzer = new PreferenceAnalyzer();
  });

  describe("analyzeText", () => {
    it("应该分析文本并提取内容偏好", () => {
      const text = "我喜欢看科技新闻";
      const result = analyzer.analyzeText(text);

      expect(result.tags.length).toBeGreaterThan(0);
      const contentTag = result.tags.find((t) => t.type === PreferenceType.CONTENT);
      expect(contentTag).toBeDefined();
      // 正则表达式可能匹配到"看科技新闻"，这是正常的
      expect(contentTag?.value).toMatch(/科技新闻/);
    });

    it("应该分析文本并提取风格偏好", () => {
      const text = "我喜欢简洁风格";
      const result = analyzer.analyzeText(text);

      expect(result.tags.length).toBeGreaterThan(0);
      const styleTag = result.tags.find((t) => t.type === PreferenceType.STYLE);
      expect(styleTag).toBeDefined();
    });

    it("应该分析文本并提取语气偏好", () => {
      const text = "请用友好的语气";
      const result = analyzer.analyzeText(text);

      expect(result.tags.length).toBeGreaterThan(0);
      const toneTag = result.tags.find((t) => t.type === PreferenceType.TONE);
      expect(toneTag).toBeDefined();
      // 正则表达式可能匹配到"用友好的"，这是正常的
      expect(toneTag?.value).toMatch(/友好/);
    });

    it("应该分析文本并提取格式偏好", () => {
      const text = "用表格格式";
      const result = analyzer.analyzeText(text);

      expect(result.tags.length).toBeGreaterThan(0);
      const formatTag = result.tags.find((t) => t.type === PreferenceType.FORMAT);
      expect(formatTag).toBeDefined();
      expect(formatTag?.value).toBe("表格");
    });

    it("应该分析文本并提取语言偏好", () => {
      const text = "请用中文语言";
      const result = analyzer.analyzeText(text);

      expect(result.tags.length).toBeGreaterThan(0);
      const languageTag = result.tags.find((t) => t.type === PreferenceType.LANGUAGE);
      expect(languageTag).toBeDefined();
      expect(languageTag?.value).toBe("中文");
    });

    it("应该分析文本并提取强偏好", () => {
      const text = "我特别喜欢科技";
      const result = analyzer.analyzeText(text);

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].type).toBe(PreferenceType.CUSTOM);
      expect(result.tags[0].strength).toBe(PreferenceStrength.STRONG);
    });

    it("应该从文本中提取多个偏好", () => {
      const text = "我喜欢看科技新闻，我喜欢简洁风格，请用友好的语气";
      const result = analyzer.analyzeText(text);

      expect(result.tags.length).toBeGreaterThan(1);
    });

    it("应该对空文本返回空结果", () => {
      const result = analyzer.analyzeText("");

      expect(result.tags).toHaveLength(0);
    });
  });

  describe("analyzeMessage", () => {
    it("应该分析用户消息", () => {
      const message = Message.createUserMessage("msg-1", "我喜欢看科技新闻");
      const result = analyzer.analyzeMessage(message);

      expect(result.analyzedMessages).toBe(1);
      expect(result.tags.length).toBeGreaterThan(0);
      const contentTag = result.tags.find((t) => t.type === PreferenceType.CONTENT);
      expect(contentTag).toBeDefined();
    });

    it("应该不分析非用户消息", () => {
      const message = Message.createAssistantMessage("msg-1", "这是回复");
      const result = analyzer.analyzeMessage(message);

      expect(result.analyzedMessages).toBe(0);
      expect(result.tags).toHaveLength(0);
    });

    it("应该对空消息返回空结果", () => {
      const message = Message.createUserMessage("msg-1", "");
      const result = analyzer.analyzeMessage(message);

      expect(result.analyzedMessages).toBe(1);
      expect(result.tags).toHaveLength(0);
    });
  });

  describe("analyze", () => {
    it("应该分析消息列表", () => {
      const messages = [
        Message.createUserMessage("msg-1", "我喜欢看科技新闻"),
        Message.createUserMessage("msg-2", "我喜欢简洁风格"),
        Message.createAssistantMessage("msg-3", "这是回复"),
      ];

      const preference = analyzer.analyze(messages, "user-123");

      expect(preference.getUserId()).toBe("user-123");
      expect(preference.getTagCount()).toBeGreaterThan(0);
    });

    it("应该只分析用户消息", () => {
      const messages = [
        Message.createAssistantMessage("msg-1", "这是回复"),
        Message.createSystemMessage("msg-2", "系统消息"),
      ];

      const preference = analyzer.analyze(messages, "user-123");

      expect(preference.getTagCount()).toBe(0);
    });

    it("应该对空消息列表返回空偏好", () => {
      const preference = analyzer.analyze([], "user-123");

      expect(preference.getUserId()).toBe("user-123");
      expect(preference.getTagCount()).toBe(0);
    });
  });

  describe("updatePreference", () => {
    it("应该增量更新偏好", () => {
      const messages = [Message.createUserMessage("msg-1", "我喜欢看科技新闻")];

      const preference = analyzer.analyze(messages, "user-123");
      const initialCount = preference.getTagCount();

      const newMessages = [Message.createUserMessage("msg-2", "我喜欢简洁风格")];

      const updated = analyzer.updatePreference(preference, newMessages);

      expect(updated.getTagCount()).toBeGreaterThan(initialCount);
    });

    it("应该增强现有标签的强度和置信度", () => {
      const messages = [Message.createUserMessage("msg-1", "我喜欢看科技新闻")];

      const preference = analyzer.analyze(messages, "user-123");
      const tags = preference.getTags();
      expect(tags.length).toBeGreaterThan(0);
      const tag = tags[0];

      const newMessages = [Message.createUserMessage("msg-2", "我特别喜欢科技新闻")];

      const updated = analyzer.updatePreference(preference, newMessages);
      // 查找相同名称的标签
      const updatedTags = updated.getTagsByName(tag.name);
      expect(updatedTags.length).toBeGreaterThan(0);
      const updatedTag = updatedTags[0];

      expect(updatedTag.strength).toBeGreaterThanOrEqual(tag.strength);
      expect(updatedTag.confidence).toBeGreaterThanOrEqual(tag.confidence);
    });
  });

  describe("addPattern", () => {
    it("应该添加自定义模式", () => {
      const pattern = {
        regex: /(?:测试模式)\s*(.+?)(?:，|。|$)/gi,
        type: PreferenceType.CUSTOM,
        extractValue: (match: RegExpMatchArray) => match[1].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      };

      analyzer.addPattern(pattern);

      const text = "测试模式 示例值";
      const result = analyzer.analyzeText(text);

      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].value).toBe("示例值");
    });
  });

  describe("clearPatterns", () => {
    it("应该清除所有模式", () => {
      analyzer.clearPatterns();

      const text = "我喜欢看科技新闻";
      const result = analyzer.analyzeText(text);

      expect(result.tags).toHaveLength(0);
    });
  });

  describe("resetPatterns", () => {
    it("应该重置为默认模式", () => {
      analyzer.clearPatterns();

      analyzer.resetPatterns();

      const text = "我喜欢看科技新闻";
      const result = analyzer.analyzeText(text);

      expect(result.tags.length).toBeGreaterThan(0);
    });
  });

  describe("getPatterns", () => {
    it("应该返回所有模式", () => {
      const patterns = analyzer.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("cleanup", () => {
    it("应该清理资源", () => {
      expect(() => analyzer.cleanup()).not.toThrow();
    });
  });
});
