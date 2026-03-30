import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { TaskType, TaskPriority } from "@/application/services/TaskService.js";
import taskRoutes from "@/api/routes/task.js";

describe("Task Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/tasks", taskRoutes);
  });

  describe("POST /tasks", () => {
    it("应该成功创建任务", async () => {
      const res = await app.request("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "task-1",
          type: TaskType.CONTENT_GENERATION,
          name: "Generate Content",
          priority: TaskPriority.NORMAL,
          userId: "user-1",
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("id", "task-1");
      expect(json.data).toHaveProperty("status", "pending");
    });

    it("应该在缺少必填字段时返回错误", async () => {
      const res = await app.request("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "task-2",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
    });
  });

  describe("GET /tasks", () => {
    it("应该成功获取所有任务", async () => {
      // 先创建任务
      await app.request("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "task-get-1",
          type: TaskType.CONTENT_GENERATION,
          name: "Task 1",
          priority: TaskPriority.NORMAL,
        }),
      });

      const res = await app.request("/tasks");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.count).toBeGreaterThan(0);
    });

    it("应该支持按状态筛选", async () => {
      const res = await app.request("/tasks?status=pending");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("应该支持按用户 ID 筛选", async () => {
      const res = await app.request("/tasks?userId=user-1");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("GET /tasks/:taskId", () => {
    it("应该成功获取任务详情", async () => {
      // 先创建任务
      await app.request("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "task-detail-1",
          type: TaskType.CONTENT_GENERATION,
          name: "Task Detail",
          priority: TaskPriority.NORMAL,
        }),
      });

      const res = await app.request("/tasks/task-detail-1");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("id", "task-detail-1");
    });

    it("应该在任务不存在时返回错误", async () => {
      const res = await app.request("/tasks/non-existent");

      expect(res.status).toBe(404);
      const json = await res.json();

      expect(json.success).toBe(false);
    });
  });

  describe("POST /tasks/:taskId/cancel", () => {
    it("应该成功取消任务", async () => {
      // 先创建任务
      await app.request("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "task-cancel-1",
          type: TaskType.CONTENT_GENERATION,
          name: "Task to Cancel",
          priority: TaskPriority.NORMAL,
        }),
      });

      const res = await app.request("/tasks/task-cancel-1/cancel", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json).toHaveProperty("message");
    });
  });

  describe("DELETE /tasks/:taskId", () => {
    it("应该成功删除任务", async () => {
      // 先创建任务
      await app.request("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "task-delete-1",
          type: TaskType.CONTENT_GENERATION,
          name: "Task to Delete",
          priority: TaskPriority.NORMAL,
        }),
      });

      const res = await app.request("/tasks/task-delete-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json).toHaveProperty("message");
    });
  });
});
