import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import conversationRoutes from "@/api/routes/conversation.js";

describe("Conversation Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/conversations", conversationRoutes);
  });

  describe("POST /conversations", () => {
    it("应该成功创建对话", async () => {
      const res = await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-1",
          userId: "user-1",
          title: "Test Conversation",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("id");
      expect(json.data).toHaveProperty("userId", "user-1");
      expect(json.data).toHaveProperty("title", "Test Conversation");
    });

    it("应该在缺少必填字段时返回错误", async () => {
      const res = await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-2",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
    });
  });

  describe("POST /conversations/:sessionId/messages", () => {
    it("应该成功发送消息", async () => {
      // 先创建对话
      await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-msg-1",
          userId: "user-1",
          title: "Test Conversation",
        }),
      });

      const res = await app.request("/conversations/test-session-msg-1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "user-1",
        },
        body: JSON.stringify({
          content: "Hello, how are you?",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("sessionId", "test-session-msg-1");
      expect(json.data).toHaveProperty("content");
    });

    it("应该在对话不存在时返回错误", async () => {
      const res = await app.request("/conversations/non-existent/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "user-1",
        },
        body: JSON.stringify({
          content: "Hello",
        }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();

      expect(json.success).toBe(false);
    });
  });

  describe("GET /conversations/:sessionId/history", () => {
    it("应该成功获取对话历史", async () => {
      // 先创建对话并发送消息
      await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-history-1",
          userId: "user-1",
          title: "Test Conversation",
        }),
      });

      await app.request("/conversations/test-session-history-1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "user-1",
        },
        body: JSON.stringify({
          content: "Hello",
        }),
      });

      const res = await app.request("/conversations/test-session-history-1/history");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("GET /conversations/:sessionId/summary", () => {
    it("应该成功获取对话摘要", async () => {
      // 先创建对话
      await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-summary-1",
          userId: "user-1",
          title: "Test Conversation",
        }),
      });

      const res = await app.request("/conversations/test-session-summary-1/summary");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("id");
      expect(json.data).toHaveProperty("userId");
      expect(json.data).toHaveProperty("title");
    });
  });

  describe("POST /conversations/:sessionId/pause", () => {
    it("应该成功暂停对话", async () => {
      // 先创建对话
      await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-pause-1",
          userId: "user-1",
          title: "Test Conversation",
        }),
      });

      const res = await app.request("/conversations/test-session-pause-1/pause", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("state");
    });
  });

  describe("POST /conversations/:sessionId/resume", () => {
    it("应该成功恢复对话", async () => {
      // 先创建对话
      await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-resume-1",
          userId: "user-1",
          title: "Test Conversation",
        }),
      });

      // 先暂停对话
      await app.request("/conversations/test-session-resume-1/pause", {
        method: "POST",
      });

      // 然后恢复对话
      const res = await app.request("/conversations/test-session-resume-1/resume", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("state");
    });
  });

  describe("DELETE /conversations/:sessionId", () => {
    it("应该成功删除对话", async () => {
      // 先创建对话
      await app.request("/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "test-session-delete-1",
          userId: "user-1",
          title: "Test Conversation",
        }),
      });

      const res = await app.request("/conversations/test-session-delete-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json).toHaveProperty("message");
    });
  });
});
