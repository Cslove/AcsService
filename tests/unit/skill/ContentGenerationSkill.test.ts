/**
 * ContentGenerationSkill 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ContentGenerationSkill,
  createContentGenerationSkill,
  ContentPlatform,
  ContentType,
  ContentStyle,
} from "@/core/skill/skills/ContentGenerationSkill.js";
import { SkillType } from "@/core/skill/Skill.js";

describe("ContentGenerationSkill", () => {
  let skill: ContentGenerationSkill;

  beforeEach(() => {
    skill = createContentGenerationSkill({
      id: "test-content-gen",
      name: "Test Content Generation",
      description: "Test content generation skill",
      type: SkillType.CONTENT_GENERATION,
    });
  });

  describe("constructor", () => {
    it("should create a content generation skill with default values", () => {
      expect(skill.getId()).toBe("test-content-gen");
      expect(skill.getDefaultPlatform()).toBe(ContentPlatform.GENERIC);
      expect(skill.getDefaultStyle()).toBe(ContentStyle.PROFESSIONAL);
      expect(skill.getMaxWords()).toBe(1000);
    });

    it("should create a content generation skill with custom values", () => {
      const customSkill = createContentGenerationSkill({
        id: "custom-content-gen",
        name: "Custom Content Generation",
        description: "Custom content generation skill",
        type: SkillType.CONTENT_GENERATION,
        defaultPlatform: ContentPlatform.WECHAT,
        defaultStyle: ContentStyle.CASUAL,
        maxWords: 500,
      });

      expect(customSkill.getDefaultPlatform()).toBe(ContentPlatform.WECHAT);
      expect(customSkill.getDefaultStyle()).toBe(ContentStyle.CASUAL);
      expect(customSkill.getMaxWords()).toBe(500);
    });
  });

  describe("execute", () => {
    it("应该根据主题生成内容", async () => {
      const result = await skill.execute({
        topic: "Artificial Intelligence",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.topic).toBe("Artificial Intelligence");
      expect(result.data.content).toBeDefined();
      expect(result.data.content.length).toBeGreaterThan(0);
    });

    it("应该使用自定义平台", async () => {
      const result = await skill.execute({
        topic: "AI",
        platform: ContentPlatform.WEIBO,
      });

      expect(result.success).toBe(true);
      expect(result.data.platform).toBe(ContentPlatform.WEIBO);
      expect(result.data.content).toContain("【微博】");
    });

    it("应该使用自定义风格", async () => {
      const result = await skill.execute({
        topic: "AI",
        style: ContentStyle.HUMOROUS,
      });

      expect(result.success).toBe(true);
      expect(result.data.style).toBe(ContentStyle.HUMOROUS);
      expect(result.data.content).toContain("风格：幽默风趣");
    });

    it("应该使用自定义内容类型", async () => {
      const result = await skill.execute({
        topic: "AI",
        contentType: ContentType.SHORT_POST,
      });

      expect(result.success).toBe(true);
      expect(result.data.contentType).toBe(ContentType.SHORT_POST);
      expect(result.data.content).toContain("类型：短帖");
    });

    it("应该限制内容字数到 maxWords", async () => {
      const result = await skill.execute({
        topic: "AI",
        maxWords: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.wordCount).toBeLessThanOrEqual(10);
    });

    it("应该包含用户偏好", async () => {
      const result = await skill.execute({
        topic: "AI",
        preference: {
          tone: "friendly",
          keywords: ["innovation", "future"],
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBeDefined();
    });

    it("应该在缺少主题时失败", async () => {
      await expect(skill.execute({})).rejects.toThrow("Missing required parameter: topic");
    });

    it("应该计算字数", async () => {
      const result = await skill.execute({
        topic: "AI",
      });

      expect(result.success).toBe(true);
      expect(result.data.wordCount).toBeGreaterThan(0);
    });

    it("应该计算字符数", async () => {
      const result = await skill.execute({
        topic: "AI",
      });

      expect(result.success).toBe(true);
      expect(result.data.characterCount).toBeGreaterThan(0);
    });
  });

  describe("setters", () => {
    it("应该设置默认平台", () => {
      skill.setDefaultPlatform(ContentPlatform.XIAOHONGSHU);

      expect(skill.getDefaultPlatform()).toBe(ContentPlatform.XIAOHONGSHU);
    });

    it("应该设置默认风格", () => {
      skill.setDefaultStyle(ContentStyle.STORYTELLING);

      expect(skill.getDefaultStyle()).toBe(ContentStyle.STORYTELLING);
    });

    it("应该设置最大字数", () => {
      skill.setMaxWords(2000);

      expect(skill.getMaxWords()).toBe(2000);
    });

    it("应该在最大字数无效时抛出错误", () => {
      expect(() => skill.setMaxWords(0)).toThrow("Max words must be greater than 0");
      expect(() => skill.setMaxWords(-1)).toThrow("Max words must be greater than 0");
    });
  });

  describe("toToolCall", () => {
    it("应该转换为工具调用定义", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.type).toBe("function");
      expect(toolCall.function.name).toBe("test-content-gen");
      expect(toolCall.function.parameters.properties.topic).toBeDefined();
      expect(toolCall.function.parameters.properties.platform).toBeDefined();
      expect(toolCall.function.parameters.properties.style).toBeDefined();
      expect(toolCall.function.parameters.properties.contentType).toBeDefined();
      expect(toolCall.function.parameters.properties.maxWords).toBeDefined();
      expect(toolCall.function.parameters.properties.preference).toBeDefined();
    });

    it("应该包含平台的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.platform.enum).toEqual(
        Object.values(ContentPlatform),
      );
    });

    it("应该包含风格的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.style.enum).toEqual(
        Object.values(ContentStyle),
      );
    });

    it("应该包含内容类型的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.contentType.enum).toEqual(
        Object.values(ContentType),
      );
    });
  });
});
