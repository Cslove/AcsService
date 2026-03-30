import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { AgentType } from "@/core/agent/AgentFactory.js";
import agentRoutes from "@/api/routes/agent.js";

describe("Agent Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/agents", agentRoutes);
  });

  describe("GET /agents", () => {
    it("应该成功获取所有 Agent", async () => {
      const res = await app.request("/agents");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("POST /agents", () => {
    it("应该成功创建 Agent", async () => {
      const res = await app.request("/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: AgentType.MAIN,
          name: "test-agent-1",
          description: "Test Agent",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("name", "test-agent-1");
    });

    it("应该在缺少必填字段时返回错误", async () => {
      const res = await app.request("/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: AgentType.MAIN,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
    });
  });

  describe("GET /agents/:agentName", () => {
    it("应该成功获取指定 Agent", async () => {
      // 先创建 Agent
      await app.request("/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: AgentType.MAIN,
          name: "test-agent-detail",
          description: "Test Agent",
        }),
      });

      const res = await app.request("/agents/test-agent-detail");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("name", "test-agent-detail");
    });

    it("应该在 Agent 不存在时返回错误", async () => {
      const res = await app.request("/agents/non-existent");

      expect(res.status).toBe(404);
      const json = await res.json();

      expect(json.success).toBe(false);
    });
  });

  describe("DELETE /agents/:agentName", () => {
    it("应该成功删除 Agent", async () => {
      // 先创建 Agent
      await app.request("/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: AgentType.MAIN,
          name: "test-agent-delete",
          description: "Test Agent",
        }),
      });

      const res = await app.request("/agents/test-agent-delete", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json).toHaveProperty("message");
    });
  });

  describe("GET /agents/stats", () => {
    it("应该成功获取 Agent 统计", async () => {
      const res = await app.request("/agents/stats");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("total");
    });
  });

  describe("GET /agents/skills", () => {
    it("应该成功获取所有技能", async () => {
      const res = await app.request("/agents/skills");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("POST /agents/skills", () => {
    it("应该成功注册技能", async () => {
      const res = await app.request("/agents/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "skill-1",
          name: "Test Skill",
          type: "analysis",
          description: "Test skill description",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("id", "skill-1");
    });
  });
});
