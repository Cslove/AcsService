/**
 * TaskExecutor 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TaskExecutor } from "@/core/task/TaskExecutor.js";
import {
  Task,
  type TaskConfig,
  type TaskExecutor as TaskExecutorFn,
  type TaskInput,
  type TaskOutput,
} from "@/core/task/Task.js";

describe("TaskExecutor", () => {
  let taskExecutor: TaskExecutor;
  let mockExecutor: TaskExecutorFn;

  beforeEach(() => {
    mockExecutor = vi.fn(async (input: TaskInput): Promise<TaskOutput> => {
      return {
        success: true,
        data: { result: "test result", input },
      };
    });

    taskExecutor = new TaskExecutor({
      maxParallelTasks: 2,
      failFast: false,
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await taskExecutor.cleanup();
  });

  describe("构造函数", () => {
    it("应该正确创建任务执行器实例", () => {
      const executor = new TaskExecutor({
        maxParallelTasks: 5,
        failFast: true,
        timeout: 10000,
      });

      const config = executor.getConfig();
      expect(config.maxParallelTasks).toBe(5);
      expect(config.failFast).toBe(true);
      expect(config.timeout).toBe(10000);
    });

    it("应该使用默认配置", () => {
      const executor = new TaskExecutor();

      const config = executor.getConfig();
      expect(config.maxParallelTasks).toBe(10);
      expect(config.failFast).toBe(false);
      expect(config.timeout).toBe(30000);
    });
  });

  describe("执行单个任务", () => {
    it("应该成功执行任务", async () => {
      const slowExecutor = vi.fn(async (): Promise<TaskOutput> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { success: true, data: { test: "result" } };
      });

      const taskConfig: TaskConfig = {
        id: "task-1",
        name: "Test Task",
      };

      const task = new Task(taskConfig, slowExecutor, { test: "input" });

      const result = await taskExecutor.execute(task);

      expect(result.taskId).toBe("task-1");
      expect(result.taskName).toBe("Test Task");
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("应该处理任务执行失败", async () => {
      const failExecutor = vi.fn(async (): Promise<TaskOutput> => {
        throw new Error("Task failed");
      });

      const task = new Task({ id: "task-1", name: "Fail Task" }, failExecutor);

      const result = await taskExecutor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Task failed");
    });

    it("应该处理已完成的任务", async () => {
      const task = new Task({ id: "task-1", name: "Test Task" }, mockExecutor);
      await task.start();

      const result = await taskExecutor.execute(task);

      expect(result.success).toBe(true);
    });

    it("不能执行正在运行的任务", async () => {
      const slowExecutor = vi.fn(
        async (): Promise<TaskOutput> =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true, data: {} });
            }, 1000);
          }),
      );

      const task = new Task({ id: "task-1", name: "Slow Task" }, slowExecutor);
      const startPromise = task.start();

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 10));

      // TaskExecutor.execute 会检查任务是否已经在执行中
      const result = await taskExecutor.execute(task);

      // 任务应该返回错误结果（因为任务已经在执行中）
      expect(result.success).toBe(false);

      // 清理
      task.cancel();
      await startPromise.catch(() => {});
    });
  });

  describe("并行执行", () => {
    it("应该成功并行执行多个任务", async () => {
      const slowExecutor = vi.fn(async (): Promise<TaskOutput> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { success: true, data: {} };
      });

      const tasks = [
        new Task({ id: "task-1", name: "Task 1" }, slowExecutor),
        new Task({ id: "task-2", name: "Task 2" }, slowExecutor),
        new Task({ id: "task-3", name: "Task 3" }, slowExecutor),
      ];

      const result = await taskExecutor.executeParallel(tasks);

      expect(result.totalTasks).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results.length).toBe(3);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });
    it("应该处理部分任务失败", async () => {
      const failExecutor = vi.fn(async (): Promise<TaskOutput> => {
        throw new Error("Task failed");
      });

      const tasks = [
        new Task({ id: "task-1", name: "Success Task" }, mockExecutor),
        new Task({ id: "task-2", name: "Fail Task" }, failExecutor),
        new Task({ id: "task-3", name: "Success Task 2" }, mockExecutor),
      ];

      const result = await taskExecutor.executeParallel(tasks);

      expect(result.totalTasks).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    it("应该在 failFast 模式下快速失败", async () => {
      const failExecutor = vi.fn(async (): Promise<TaskOutput> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("Task failed");
      });

      const successExecutor = vi.fn(async (): Promise<TaskOutput> => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, data: {} };
      });

      const tasks = [
        new Task({ id: "task-1", name: "Fail Task" }, failExecutor),
        new Task({ id: "task-2", name: "Success Task" }, successExecutor),
        new Task({ id: "task-3", name: "Success Task 2" }, successExecutor),
      ];

      const executor = new TaskExecutor({ failFast: true });
      const result = await executor.executeParallel(tasks);

      expect(result.totalTasks).toBe(3);
      // 在 failFast 模式下，第一个任务失败后会取消其他任务
      // 但由于并行执行，其他任务可能已经开始执行并完成
      // 所以 successCount 可能大于 0
      expect(result.failureCount).toBeGreaterThanOrEqual(1);
      // 确保至少有一个任务失败
      expect(result.results.some((r) => !r.success)).toBe(true);
    });

    it("应该控制并发执行数量", async () => {
      let concurrentCount = 0;
      let maxConcurrentCount = 0;

      const concurrentExecutor = vi.fn(async (): Promise<TaskOutput> => {
        concurrentCount++;
        maxConcurrentCount = Math.max(maxConcurrentCount, concurrentCount);
        await new Promise((resolve) => setTimeout(resolve, 50));
        concurrentCount--;
        return { success: true, data: {} };
      });

      const tasks = Array.from(
        { length: 5 },
        (_, i) => new Task({ id: `task-${i}`, name: `Task ${i}` }, concurrentExecutor),
      );

      const executor = new TaskExecutor({ maxParallelTasks: 2 });
      await executor.executeParallel(tasks);

      expect(maxConcurrentCount).toBeLessThanOrEqual(2);
    });

    it("应该处理空任务列表", async () => {
      const result = await taskExecutor.executeParallel([]);

      expect(result.totalTasks).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe("串行执行", () => {
    it("应该成功串行执行多个任务", async () => {
      const tasks = [
        new Task({ id: "task-1", name: "Task 1" }, mockExecutor),
        new Task({ id: "task-2", name: "Task 2" }, mockExecutor),
        new Task({ id: "task-3", name: "Task 3" }, mockExecutor),
      ];

      const result = await taskExecutor.executeSequential(tasks);

      expect(result.totalTasks).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.results.length).toBe(3);
    });

    it("应该在 failFast 模式下快速失败", async () => {
      const failExecutor = vi.fn(async (): Promise<TaskOutput> => {
        throw new Error("Task failed");
      });

      const tasks = [
        new Task({ id: "task-1", name: "Success Task" }, mockExecutor),
        new Task({ id: "task-2", name: "Fail Task" }, failExecutor),
        new Task({ id: "task-3", name: "Success Task 2" }, mockExecutor),
      ];

      const executor = new TaskExecutor({ failFast: true });
      const result = await executor.executeSequential(tasks);

      expect(result.totalTasks).toBe(3);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results.length).toBe(2);
    });

    it("应该处理空任务列表", async () => {
      const result = await taskExecutor.executeSequential([]);

      expect(result.totalTasks).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe("依赖执行", () => {
    it("应该按依赖顺序执行任务", async () => {
      const executionOrder: string[] = [];

      const orderExecutor = vi.fn(async (input: TaskInput): Promise<TaskOutput> => {
        executionOrder.push(input.taskId);
        return { success: true, data: {} };
      });

      const tasks = [
        new Task({ id: "task-1", name: "Task 1" }, orderExecutor, { taskId: "task-1" }),
        new Task({ id: "task-2", name: "Task 2" }, orderExecutor, { taskId: "task-2" }),
        new Task({ id: "task-3", name: "Task 3" }, orderExecutor, { taskId: "task-3" }),
      ];

      const dependencies = new Map([
        ["task-2", ["task-1"]],
        ["task-3", ["task-1", "task-2"]],
      ]);

      await taskExecutor.executeWithDependencies(tasks, dependencies);

      expect(executionOrder).toEqual(["task-1", "task-2", "task-3"]);
    });

    it("应该检测循环依赖", async () => {
      const tasks = [
        new Task({ id: "task-1", name: "Task 1" }, mockExecutor),
        new Task({ id: "task-2", name: "Task 2" }, mockExecutor),
      ];

      const dependencies = new Map([
        ["task-1", ["task-2"]],
        ["task-2", ["task-1"]],
      ]);

      await expect(taskExecutor.executeWithDependencies(tasks, dependencies)).rejects.toThrow(
        "Circular dependency",
      );
    });

    it("应该在 failFast 模式下快速失败", async () => {
      const failExecutor = vi.fn(async (): Promise<TaskOutput> => {
        throw new Error("Task failed");
      });

      const tasks = [
        new Task({ id: "task-1", name: "Success Task" }, mockExecutor),
        new Task({ id: "task-2", name: "Fail Task" }, failExecutor),
        new Task({ id: "task-3", name: "Success Task 2" }, mockExecutor),
      ];

      const dependencies = new Map([
        ["task-2", ["task-1"]],
        ["task-3", ["task-2"]],
      ]);

      const executor = new TaskExecutor({ failFast: true });
      const result = await executor.executeWithDependencies(tasks, dependencies);

      expect(result.totalTasks).toBe(3);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
    });
  });

  describe("配置管理", () => {
    it("应该获取配置", () => {
      const config = taskExecutor.getConfig();
      expect(config.maxParallelTasks).toBe(2);
      expect(config.failFast).toBe(false);
      expect(config.timeout).toBe(5000);
    });

    it("应该更新配置", () => {
      taskExecutor.updateConfig({
        maxParallelTasks: 10,
        failFast: true,
      });

      const config = taskExecutor.getConfig();
      expect(config.maxParallelTasks).toBe(10);
      expect(config.failFast).toBe(true);
    });
  });

  describe("执行状态", () => {
    it("应该返回正在执行的任务数量", async () => {
      const slowExecutor = vi.fn(
        async (): Promise<TaskOutput> =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true, data: {} });
            }, 100);
          }),
      );

      const tasks = [
        new Task({ id: "task-1", name: "Task 1" }, slowExecutor),
        new Task({ id: "task-2", name: "Task 2" }, slowExecutor),
      ];

      const executePromise = taskExecutor.executeParallel(tasks);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(taskExecutor.getActiveExecutionCount()).toBeGreaterThan(0);

      await executePromise;
    });

    it("应该取消所有正在执行的任务", async () => {
      const slowExecutor = vi.fn(
        async (): Promise<TaskOutput> =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true, data: {} });
            }, 1000);
          }),
      );

      const tasks = [
        new Task({ id: "task-1", name: "Task 1" }, slowExecutor),
        new Task({ id: "task-2", name: "Task 2" }, slowExecutor),
      ];

      const executePromise = taskExecutor.executeParallel(tasks);

      await new Promise((resolve) => setTimeout(resolve, 10));

      taskExecutor.cancelAll();

      await executePromise;
    });
  });

  describe("序列化", () => {
    it("应该正确转换为 JSON", () => {
      const json = taskExecutor.toJSON();

      expect(json.config).toBeDefined();
      expect(json.activeExecutionCount).toBe(0);
    });
  });

  describe("清理", () => {
    it("应该清理资源", async () => {
      const executor = new TaskExecutor();
      await executor.cleanup();
      expect(executor.getActiveExecutionCount()).toBe(0);
    });
  });
});
