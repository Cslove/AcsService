/**
 * ContentGenerationService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ContentGenerationService,
  PlatformType,
  ContentType,
} from "@/application/services/ContentGenerationService.js";

describe("ContentGenerationService", () => {
  let service: ContentGenerationService;

  beforeEach(() => {
    service = new ContentGenerationService();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe("generateContent", () => {
    it("应该为微信平台生成文本内容", async () => {
      const result = await service.generateContent({
        platform: PlatformType.WECHAT,
        content: "Hello, World!",
        format: ContentType.TEXT,
      });

      expect(result.success).toBe(true);
      expect(result.platform).toBe(PlatformType.WECHAT);
      expect(result.content.type).toBe(ContentType.TEXT);
      expect(result.content.content).toBe("Hello, World!");
    });

    it("应该为飞书平台生成 Markdown 内容", async () => {
      const result = await service.generateContent({
        platform: PlatformType.FEISHU,
        content: "# Title\n**Bold** text",
        format: ContentType.MARKDOWN,
      });

      expect(result.success).toBe(true);
      expect(result.content.type).toBe(ContentType.MARKDOWN);
      expect(result.content.content).toContain("# Title");
    });

    it("应该为邮件平台生成 HTML 内容", async () => {
      const result = await service.generateContent({
        platform: PlatformType.EMAIL,
        content: "# Title\n**Bold** text",
        format: ContentType.HTML,
      });

      expect(result.success).toBe(true);
      expect(result.content.type).toBe(ContentType.HTML);
      expect(result.content.content).toContain("<h1>");
    });

    it("应该拒绝不支持的格式", async () => {
      const result = await service.generateContent({
        platform: PlatformType.WECHAT,
        content: "Test",
        format: ContentType.VIDEO,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("应该截断超过长度限制的内容", async () => {
      const longContent = "a".repeat(3000);
      const result = await service.generateContent({
        platform: PlatformType.WECHAT,
        content: longContent,
        format: ContentType.TEXT,
      });

      expect(result.success).toBe(true);
      expect(result.content.content.length).toBeLessThanOrEqual(2000);
    });
  });

  describe("generateContents", () => {
    it("应该批量生成内容", async () => {
      const configs = [
        {
          platform: PlatformType.WECHAT,
          content: "Content 1",
          format: ContentType.TEXT,
        },
        {
          platform: PlatformType.DINGTALK,
          content: "Content 2",
          format: ContentType.MARKDOWN,
        },
      ];

      const results = await service.generateContents(configs);

      expect(results.size).toBe(2);
      expect(results.get("wechat-0")?.success).toBe(true);
      expect(results.get("dingtalk-1")?.success).toBe(true);
    });
  });

  describe("createTemplate", () => {
    it("应该创建模板", () => {
      const template = {
        id: "template-1",
        name: "Test Template",
        platform: PlatformType.WECHAT,
        content: "Hello {{name}}!",
        variables: ["name"],
      };

      service.createTemplate(template);

      const retrieved = service.getTemplate("template-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Test Template");
    });

    it("应该拒绝重复的模板 ID", () => {
      const template = {
        id: "template-1",
        name: "Test Template",
        platform: PlatformType.WECHAT,
        content: "Hello {{name}}!",
        variables: ["name"],
      };

      service.createTemplate(template);

      expect(() => {
        service.createTemplate(template);
      }).toThrow();
    });
  });

  describe("generateFromTemplate", () => {
    it("应该使用模板生成内容", async () => {
      const template = {
        id: "template-1",
        name: "Greeting Template",
        platform: PlatformType.WECHAT,
        content: "Hello {{name}}! Welcome to {{place}}.",
        variables: ["name", "place"],
      };

      service.createTemplate(template);

      const result = await service.generateFromTemplate("template-1", {
        name: "Alice",
        place: "Wonderland",
      });

      expect(result.success).toBe(true);
      expect(result.content.content).toBe("Hello Alice! Welcome to Wonderland.");
    });

    it("应该拒绝缺少变量的模板", async () => {
      const template = {
        id: "template-1",
        name: "Greeting Template",
        platform: PlatformType.WECHAT,
        content: "Hello {{name}}!",
        variables: ["name"],
      };

      service.createTemplate(template);

      await expect(service.generateFromTemplate("template-1", {})).rejects.toThrow();
    });
  });

  describe("getPlatform", () => {
    it("应该获取平台配置", () => {
      const platform = service.getPlatform(PlatformType.WECHAT);

      expect(platform).toBeDefined();
      expect(platform?.name).toBe("WeChat");
      expect(platform?.supportedFormats).toContain(ContentType.TEXT);
    });

    it("应该返回 undefined 对于不存在的平台", () => {
      const platform = service.getPlatform(PlatformType.CUSTOM);
      expect(platform).toBeUndefined();
    });
  });

  describe("getAllPlatforms", () => {
    it("应该获取所有平台", () => {
      const platforms = service.getAllPlatforms();

      expect(platforms.length).toBeGreaterThan(0);
      expect(platforms.some((p) => p.type === PlatformType.WECHAT)).toBe(true);
    });
  });

  describe("validateContent", () => {
    it("应该验证有效内容", () => {
      const validation = service.validateContent(PlatformType.WECHAT, "Hello");

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it("应该检测超过长度限制的内容", () => {
      const longContent = "a".repeat(3000);
      const validation = service.validateContent(PlatformType.WECHAT, longContent);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("getStats", () => {
    it("应该获取统计信息", () => {
      const stats = service.getStats();

      expect(stats.totalPlatforms).toBeGreaterThan(0);
      expect(stats.totalTemplates).toBe(0);
    });
  });
});
