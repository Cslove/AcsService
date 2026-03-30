import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import pushRoutes from "@/api/routes/push.js";

describe("Push Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/push", pushRoutes);
  });

  describe("POST /push/topics", () => {
    it("应该成功添加话题", async () => {
      const res = await app.request("/push/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "topic-1",
          title: "Test Topic",
          content: "This is a test topic",
          source: "test",
          category: "general",
          tags: ["test", "topic"],
          priority: 1,
          relevanceScore: 0.8,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("id", "topic-1");
    });

    it("应该在缺少必填字段时返回错误", async () => {
      const res = await app.request("/push/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "topic-2",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
    });
  });

  describe("POST /push/topics/batch", () => {
    it("应该成功批量添加话题", async () => {
      const res = await app.request("/push/topics/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topics: [
            {
              id: "topic-batch-1",
              title: "Batch Topic 1",
              content: "Content 1",
              source: "test",
              category: "general",
              tags: ["test"],
              priority: 1,
              relevanceScore: 0.7,
            },
            {
              id: "topic-batch-2",
              title: "Batch Topic 2",
              content: "Content 2",
              source: "test",
              category: "general",
              tags: ["test"],
              priority: 1,
              relevanceScore: 0.8,
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("count", 2);
    });
  });

  describe("GET /push/topics/trending", () => {
    it("应该成功获取热门话题", async () => {
      const res = await app.request("/push/topics/trending?limit=5");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe("GET /push/topics/high-relevance", () => {
    it("应该成功获取高相关性话题", async () => {
      const res = await app.request("/push/topics/high-relevance?minScore=0.7");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });
});
