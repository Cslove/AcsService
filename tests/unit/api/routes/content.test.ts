import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { PlatformType, ContentType } from "@/application/services/ContentGenerationService.js";
import contentRoutes from "@/api/routes/content.js";

describe("Content Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/content", contentRoutes);
  });

  describe("POST /content/generate", () => {
    it("应该成功生成内容", async () => {
      const res = await app.request("/content/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: PlatformType.WECHAT,
          content: "Hello World",
          format: ContentType.TEXT,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("content");
      expect(json.data).toHaveProperty("platform");
    });

    it("应该在缺少必填字段时返回错误", async () => {
      const res = await app.request("/content/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: PlatformType.WECHAT,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
    });
  });

  describe("POST /content/batch-generate", () => {
    it("应该成功批量生成内容", async () => {
      const res = await app.request("/content/batch-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          configs: [
            {
              platform: PlatformType.WECHAT,
              content: "Content 1",
            },
            {
              platform: PlatformType.DINGTALK,
              content: "Content 2",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("POST /content/transform", () => {
    it("应该成功转换内容格式", async () => {
      const res = await app.request("/content/transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "Hello World",
          fromFormat: ContentType.TEXT,
          toFormat: ContentType.MARKDOWN,
          platform: PlatformType.WECHAT,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("content");
    });
  });

  describe("POST /content/templates", () => {
    it("应该成功创建模板", async () => {
      const res = await app.request("/content/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "template-1",
          name: "Test Template",
          platform: PlatformType.WECHAT,
          content: "Hello {{name}}",
          variables: ["name"],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("id", "template-1");
    });
  });
});
