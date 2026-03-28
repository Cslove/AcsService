/**
 * Task 单元测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Task,
  TaskState,
  TaskPriority,
  type TaskConfig,
  type TaskExecutor as TaskExecutorFn,
  type TaskInput,
  type TaskOutput,
} from "@/core/task/Task.js";

describe("Task", () => {
  let mockExecutor: TaskExecutorFn;
  let taskConfig: TaskConfig;
  let taskInput: TaskInput;

  beforeEach(() => {
    mockExecutor = vi.fn(async (input: TaskInput): Promise<TaskOutput> => {
      return {
        success: true,
        data: { result: "test result", input },
      };
    });

    taskConfig = {
      id: "task-1",
      name: "Test Task",
      description: "A test task",
      priority: TaskPriority.NORMAL,
      timeout: 5000,
      maxRetries: 3,
      metadata: { key: "value" },
    };

    taskInput = { test: "input" };
  });

  describe("构造函数", () => {
    it("应该正确创建任务实例", () => {
      const task = new Task(taskConfig, mockExecutor, taskInput);

      expect(task.getId()).toBe("task-1");
      expect(task.getName()).toBe("Test Task");
      expect(task.getDescription()).toBe("A test task");
      expect(task.getPriority()).toBe(TaskPriority.NORMAL);
      expect(task.getTimeout()).toBe(5000);
      expect(task.getMaxRetries()).toBe(3);
      expect(task.getState()).toBe(TaskState.PENDING);
      expect(task.getRetryCount()).toBe(0);
      expect(task.getInput()).toEqual(taskInput);
      expect(task.getMetadata()).toEqual({ key: "value" });
    });

    it("应该使用默认值", () => {
      const config: TaskConfig = {
        id: "task-2",
        name: "Test Task 2",
      };

      const task = new Task(config, mockExecutor);

      expect(task.getPriority()).toBe(TaskPriority.NORMAL);
      expect(task.getTimeout()).toBe(30000);
      expect(task.getMaxRetries()).toBe(3);
    });
  });

  describe("任务状态", () => {
    it("应该正确检查任务状态", () => {
      const task = new Task(taskConfig, mockExecutor);

      expect(task.isPending()).toBe(true);
      expect(task.isRunning()).toBe(false);
      expect(task.isPaused()).toBe(false);
      expect(task.isCompleted()).toBe(false);
      expect(task.isFailed()).toBe(false);
      expect(task.isCancelled()).toBe(false);
      expect(task.isFinished()).toBe(false);
    });

    it("应该正确设置任务状态", async () => {
      const task = new Task(taskConfig, mockExecutor);

      await task.start();
      expect(task.isCompleted()).toBe(true);
      expect(task.isFinished()).toBe(true);
    });
  });

  describe("任务执行", () => {
    it("应该成功执行任务", async () => {
      const slowExecutor = vi.fn(async (): Promise<TaskOutput> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { success: true, data: { result: "test result", input: taskInput } };
      });

      const task = new Task(taskConfig, slowExecutor, taskInput);

      const result = await task.start();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        result: "test result",
        input: taskInput,
      });
      expect(task.getState()).toBe(TaskState.COMPLETED);
      expect(task.getOutput()).toEqual(result);
      expect(task.getDuration()).toBeGreaterThanOrEqual(0);
    });

    it("应该处理任务执行失败", async () => {
      const errorExecutor = vi.fn(async (): Promise<TaskOutput> => {
        throw new Error("Task execution failed");
      });

      const task = new Task(taskConfig, errorExecutor);

      await expect(task.start()).rejects.toThrow("Task execution failed");
      expect(task.getState()).toBe(TaskState.FAILED);
      // 自动重试 3 次后失败，所以 retryCount 应该是 3
      expect(task.getRetryCount()).toBe(3);
    });

    it("应该支持任务重试", async () => {
      let attempt = 0;
      const retryExecutor = vi.fn(async (): Promise<TaskOutput> => {
        attempt++;
        if (attempt < 3) {
          throw new Error("Temporary failure");
        }
        return { success: true, data: { attempt } };
      });

      const task = new Task(taskConfig, retryExecutor);

      // 第一次执行会自动重试直到成功
      const result = await task.start();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ attempt: 3 });
      expect(task.getState()).toBe(TaskState.COMPLETED);
      // 自动重试了 2 次
      expect(task.getRetryCount()).toBe(2);
    });

    it("应该在超过最大重试次数后失败", async () => {
      const alwaysFailExecutor = vi.fn(async (): Promise<TaskOutput> => {
        throw new Error("Always fails");
      });

      const task = new Task(taskConfig, alwaysFailExecutor);

      await expect(task.start()).rejects.toThrow("Always fails");
      expect(task.getState()).toBe(TaskState.FAILED);
      // 自动重试 3 次后失败
      expect(task.getRetryCount()).toBe(3);

      // 再次尝试应该失败（因为任务状态是 FAILED，不能再次 start）
      await expect(task.start()).rejects.toThrow();
    });

    it("应该处理任务超时", async () => {
      const slowExecutor = vi.fn(
        async (): Promise<TaskOutput> =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true, data: {} });
            }, 10000);
          }),
      );

      const config = { ...taskConfig, timeout: 100 };
      const task = new Task(config, slowExecutor);

      await expect(task.start()).rejects.toThrow("Task timeout after 100ms");
      expect(task.getState()).toBe(TaskState.FAILED);
    });
  });

  describe("任务控制", () => {
    it("应该暂停任务", async () => {
      const slowExecutor = vi.fn(
        async (): Promise<TaskOutput> =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true, data: {} });
            }, 1000);
          }),
      );

      const task = new Task(taskConfig, slowExecutor);

      // 先开始任务
      const startPromise = task.start();

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 10));

      task.pause();

      expect(task.isPaused()).toBe(true);

      // 清理
      task.cancel();
      await startPromise.catch(() => {});
    });

    it("应该恢复暂停的任务", async () => {
      const slowExecutor = vi.fn(
        async (): Promise<TaskOutput> =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true, data: {} });
            }, 1000);
          }),
      );

      const task = new Task(taskConfig, slowExecutor);

      // 先开始任务
      const startPromise = task.start();

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 10));

      task.pause();
      expect(task.isPaused()).toBe(true);

      task.resume();
      expect(task.getState()).toBe(TaskState.RUNNING);

      // 清理
      task.cancel();
      await startPromise.catch(() => {});
    });

    it("应该取消任务", () => {
      const task = new Task(taskConfig, mockExecutor);

      task.cancel();

      expect(task.isCancelled()).toBe(true);
      expect(task.isFinished()).toBe(true);
      expect(task.getEndTime()).toBeDefined();
    });

    it("应该重置任务", async () => {
      const failExecutor = vi.fn(async (): Promise<TaskOutput> => {
        throw new Error("Failed");
      });

      const task = new Task(taskConfig, failExecutor);

      await expect(task.start()).rejects.toThrow();
      expect(task.getState()).toBe(TaskState.FAILED);
      // 自动重试 3 次后失败
      expect(task.getRetryCount()).toBe(3);

      task.reset();

      expect(task.getState()).toBe(TaskState.PENDING);
      expect(task.getRetryCount()).toBe(0);
      expect(task.getOutput()).toBeUndefined();
    });
  });

  describe("元数据管理", () => {
    it("应该设置元数据", () => {
      const task = new Task(taskConfig, mockExecutor);

      task.setMetadata({ newKey: "newValue" });

      expect(task.getMetadata()).toEqual({ newKey: "newValue" });
    });

    it("应该更新元数据", () => {
      const task = new Task(taskConfig, mockExecutor);

      task.updateMetadata("key1", "value1");
      task.updateMetadata("key2", "value2");

      expect(task.getMetadata()).toEqual({
        key: "value",
        key1: "value1",
        key2: "value2",
      });
    });
  });

  describe("状态转换错误", () => {
    it("不能从非 PENDING 或 FAILED 状态开始任务", async () => {
      const task = new Task(taskConfig, mockExecutor);

      await task.start();

      await expect(task.start()).rejects.toThrow();
    });

    it("不能暂停非 RUNNING 状态的任务", () => {
      const task = new Task(taskConfig, mockExecutor);

      expect(() => task.pause()).toThrow();
    });

    it("不能恢复非 PAUSED 状态的任务", () => {
      const task = new Task(taskConfig, mockExecutor);

      expect(() => task.resume()).toThrow();
    });

    it("不能取消已完成或已取消的任务", async () => {
      const task = new Task(taskConfig, mockExecutor);

      await task.start();

      expect(() => task.cancel()).toThrow();
    });

    it("不能重置 RUNNING 或 PAUSED 状态的任务", async () => {
      const task = new Task(taskConfig, mockExecutor);

      const startPromise = task.start();
      task.pause();

      expect(() => task.reset()).toThrow();

      // 清理
      task.cancel();
      await startPromise.catch(() => {});
    });
  });

  describe("序列化", () => {
    it("应该正确转换为 JSON", async () => {
      const slowExecutor = vi.fn(async (): Promise<TaskOutput> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { success: true, data: { result: "test result", input: taskInput } };
      });

      const task = new Task(taskConfig, slowExecutor, taskInput);
      await task.start();

      const json = task.toJSON();

      expect(json.id).toBe("task-1");
      expect(json.name).toBe("Test Task");
      expect(json.description).toBe("A test task");
      expect(json.priority).toBe(TaskPriority.NORMAL);
      expect(json.state).toBe(TaskState.COMPLETED);
      expect(json.result).toBeDefined();
      expect(json.retryCount).toBe(0);
      expect(json.createdAt).toBeDefined();
      expect(json.updatedAt).toBeDefined();
      expect(json.startTime).toBeDefined();
      expect(json.endTime).toBeDefined();
      expect(json.duration).toBeGreaterThanOrEqual(0);
    });

    it("应该从 JSON 创建任务", async () => {
      const originalTask = new Task(taskConfig, mockExecutor, taskInput);
      await originalTask.start();

      const json = originalTask.toJSON();
      const restoredTask = Task.fromJSON(json, mockExecutor, taskInput);

      expect(restoredTask.getId()).toBe(originalTask.getId());
      expect(restoredTask.getName()).toBe(originalTask.getName());
      expect(restoredTask.getState()).toBe(originalTask.getState());
      expect(restoredTask.getRetryCount()).toBe(originalTask.getRetryCount());
      expect(restoredTask.getDuration()).toBe(originalTask.getDuration());
    });
  });

  describe("时间戳", () => {
    it("应该正确记录时间戳", async () => {
      const beforeCreate = Date.now();
      const task = new Task(taskConfig, mockExecutor);
      const afterCreate = Date.now();

      expect(task.getCreatedAt().getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(task.getCreatedAt().getTime()).toBeLessThanOrEqual(afterCreate);

      const beforeStart = Date.now();
      await task.start();
      const afterStart = Date.now();

      expect(task.getStartTime()!.getTime()).toBeGreaterThanOrEqual(beforeStart);
      expect(task.getStartTime()!.getTime()).toBeLessThanOrEqual(afterStart);
      expect(task.getEndTime()!.getTime()).toBeGreaterThanOrEqual(beforeStart);
      expect(task.getEndTime()!.getTime()).toBeLessThanOrEqual(afterStart);
    });
  });

  describe("清理", () => {
    it("应该清理任务资源", async () => {
      const task = new Task(taskConfig, mockExecutor);

      await task.start();
      expect(task.getOutput()).toBeDefined();

      task.cleanup();
      expect(task.getOutput()).toBeUndefined();
    });
  });
});
