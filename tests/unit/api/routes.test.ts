import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import apiRoutes from "@/api/routes/index.js";

describe("API Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/api", apiRoutes);
  });

  describe("GET /api", () => {
    it("应该返回 API 版本和端点列表", async () => {
      const res = await app.request("/api");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json).toHaveProperty("version", "1.0.0");
      expect(json).toHaveProperty("endpoints");
      expect(json.endpoints).toHaveProperty("conversations", "/api/conversations");
      expect(json.endpoints).toHaveProperty("tasks", "/api/tasks");
      expect(json.endpoints).toHaveProperty("content", "/api/content");
      expect(json.endpoints).toHaveProperty("push", "/api/push");
      expect(json.endpoints).toHaveProperty("preferences", "/api/preferences");
      expect(json.endpoints).toHaveProperty("agents", "/api/agents");
      expect(json.endpoints).toHaveProperty("skills", "/api/skills");
    });
  });

  describe("GET /api/health", () => {
    it("应该返回健康状态", async () => {
      const res = await app.request("/api/health");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json).toHaveProperty("status", "ok");
      expect(json).toHaveProperty("timestamp");
      expect(new Date(json.timestamp)).toBeInstanceOf(Date);
    });
  });
});
