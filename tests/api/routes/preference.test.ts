import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import preferenceRoutes from "@/api/routes/preference.js";

describe("Preference Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/preferences", preferenceRoutes);
  });

  describe("GET /preferences/:userId", () => {
    it("应该成功获取用户偏好", async () => {
      const res = await app.request("/preferences/user-1");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("tags");
      expect(json.data).toHaveProperty("userId");
    });
  });

  describe("PUT /preferences/:userId", () => {
    it("应该成功更新用户偏好", async () => {
      const res = await app.request("/preferences/user-1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interests: ["technology", "ai"],
          tone: "casual",
          style: "concise",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("tags");
      expect(json.data.tags).toBeInstanceOf(Array);
    });
  });

  describe("POST /preferences/:userId/analyze", () => {
    it("应该成功从消息分析偏好", async () => {
      const res = await app.request("/preferences/user-1/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "I love technology and AI",
            },
            {
              id: "msg-2",
              role: "assistant",
              content: "That's great!",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("tags");
    });
  });

  describe("DELETE /preferences/:userId", () => {
    it("应该成功删除用户偏好", async () => {
      const res = await app.request("/preferences/user-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json).toHaveProperty("message");
    });
  });
});
