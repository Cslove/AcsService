/**
 * TaskService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TaskService,
  TaskStatus,
  TaskPriority,
  TaskType,
} from "@/application/services/TaskService.js";

describe("TaskService", () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService();
  });

  afterEach(async () => {
    // 取消所有运行中的任务
    const runningTasks = service.getRunningTasks();
    for (const task of runningTasks) {
      try {
        service.cancelTask(task.id);
      } catch {
        // 忽略错误，任务可能已经完成
      }
    }
    // 等待一段时间让任务完全停止
    await new Promise((resolve) => setTimeout(resolve, 10));
    try {
      service.cleanup();
    } catch {
      // 如果还有运行中的任务，强制清理
      // 在测试环境中，这是可以接受的
    }
  });

  describe("createTask", () => {
    it("应该创建新任务", () => {
      const task = service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      expect(task.id).toBe("task-1");
      expect(task.config.type).toBe(TaskType.CONTENT_GENERATION);
      expect(task.config.name).toBe("Test Task");
      expect(task.status).toBe(TaskStatus.PENDING);
    });

    it("应该拒绝重复的任务 ID", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      expect(() => {
        service.createTask({
          id: "task-1",
          type: TaskType.CONTENT_GENERATION,
          name: "Test Task",
          priority: TaskPriority.NORMAL,
        });
      }).toThrow();
    });
  });

  describe("getTask", () => {
    it("应该获取存在的任务", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      const task = service.getTask("task-1");

      expect(task).toBeDefined();
      expect(task?.id).toBe("task-1");
    });

    it("应该返回 undefined 对于不存在的任务", () => {
      const task = service.getTask("non-existent");
      expect(task).toBeUndefined();
    });
  });

  describe("executeTask", () => {
    it("应该成功执行任务", async () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      const executor = vi.fn().mockResolvedValue({ result: "success" });
      const result = await service.executeTask("task-1", executor);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: "success" });
      expect(executor).toHaveBeenCalled();
    });

    it("应该处理任务执行失败", async () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      const executor = vi.fn().mockRejectedValue(new Error("Execution failed"));

      await expect(service.executeTask("task-1", executor)).rejects.toThrow();
    });

    it("应该重试失败的任务", async () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
        maxRetries: 1,
      });

      const executor = vi.fn().mockImplementation(() => {
        throw new Error("Execution failed");
      });

      // 第一次执行会失败并重试
      try {
        await service.executeTask("task-1", executor);
      } catch {
        // 预期会抛出错误
      }

      // 验证任务已加入重试队列
      const task = service.getTask("task-1");
      expect(task?.status).toBe(TaskStatus.PENDING);
      expect(task?.retryCount).toBe(1);
      expect(executor).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelTask", () => {
    it("应该取消待执行的任务", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      const cancelled = service.cancelTask("task-1");

      expect(cancelled).toBe(true);
      const task = service.getTask("task-1");
      expect(task?.status).toBe(TaskStatus.CANCELLED);
    });

    it("应该取消待执行的任务", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      const cancelled = service.cancelTask("task-1");

      expect(cancelled).toBe(true);
      const task = service.getTask("task-1");
      expect(task?.status).toBe(TaskStatus.CANCELLED);
    });
  });

  describe("deleteTask", () => {
    it("应该删除任务", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Test Task",
        priority: TaskPriority.NORMAL,
      });

      const deleted = service.deleteTask("task-1");

      expect(deleted).toBe(true);
      expect(service.getTask("task-1")).toBeUndefined();
    });
  });

  describe("getTasksByStatus", () => {
    it("应该按状态获取任务", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Task 1",
        priority: TaskPriority.NORMAL,
      });

      service.createTask({
        id: "task-2",
        type: TaskType.CONTENT_GENERATION,
        name: "Task 2",
        priority: TaskPriority.NORMAL,
      });

      const pendingTasks = service.getTasksByStatus(TaskStatus.PENDING);

      expect(pendingTasks.length).toBe(2);
    });
  });

  describe("getTasksByUserId", () => {
    it("应该按用户 ID 获取任务", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Task 1",
        priority: TaskPriority.NORMAL,
        userId: "user-1",
      });

      service.createTask({
        id: "task-2",
        type: TaskType.CONTENT_GENERATION,
        name: "Task 2",
        priority: TaskPriority.NORMAL,
        userId: "user-2",
      });

      const user1Tasks = service.getTasksByUserId("user-1");

      expect(user1Tasks.length).toBe(1);
      expect(user1Tasks[0].config.userId).toBe("user-1");
    });
  });

  describe("getStats", () => {
    it("应该获取统计信息", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Task 1",
        priority: TaskPriority.NORMAL,
      });

      service.createTask({
        id: "task-2",
        type: TaskType.CONTENT_GENERATION,
        name: "Task 2",
        priority: TaskPriority.NORMAL,
      });

      const stats = service.getStats();

      expect(stats.totalTasks).toBe(2);
      expect(stats.pendingTasks).toBe(2);
      expect(stats.runningTasks).toBe(0);
    });
  });

  describe("clearAllTasks", () => {
    it("应该清空所有任务", () => {
      service.createTask({
        id: "task-1",
        type: TaskType.CONTENT_GENERATION,
        name: "Task 1",
        priority: TaskPriority.NORMAL,
      });

      service.clearAllTasks();

      expect(service.getAllTasks().length).toBe(0);
    });
  });
});
