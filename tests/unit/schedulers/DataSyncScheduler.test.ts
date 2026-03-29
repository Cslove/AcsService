import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DataSyncScheduler,
  SyncTaskType,
  type SyncTaskConfig,
} from "@/application/schedulers/DataSyncScheduler.js";

describe("DataSyncScheduler", () => {
  let scheduler: DataSyncScheduler;

  beforeEach(() => {
    scheduler = new DataSyncScheduler();
  });

  afterEach(() => {
    scheduler.cleanup();
  });

  describe("registerExecutor", () => {
    it("应该成功注册执行器", () => {
      const executor = vi.fn().mockResolvedValue(undefined);

      scheduler.registerExecutor(SyncTaskType.DATA_SYNC, executor);

      expect(() => scheduler.startAllDefaultTasks()).not.toThrow();
    });

    it("应该允许注册多个执行器", () => {
      const executor1 = vi.fn().mockResolvedValue(undefined);
      const executor2 = vi.fn().mockResolvedValue(undefined);

      scheduler.registerExecutor(SyncTaskType.DATA_SYNC, executor1);
      scheduler.registerExecutor(SyncTaskType.CACHE_REFRESH, executor2);

      expect(() => scheduler.startAllDefaultTasks()).not.toThrow();
    });
  });

  describe("addSyncTask", () => {
    it("应该成功添加同步任务", () => {
      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: true,
        description: "Test task",
      };

      expect(() => scheduler.addSyncTask(config)).not.toThrow();
      expect(scheduler.hasTask("test-task")).toBe(true);
      expect(scheduler.getTaskCount()).toBe(1);
    });

    it("应该抛出错误当任务已存在", () => {
      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
      };

      scheduler.addSyncTask(config);

      expect(() => scheduler.addSyncTask(config)).toThrow();
    });
  });

  describe("removeSyncTask", () => {
    it("应该成功移除同步任务", () => {
      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
      };

      scheduler.addSyncTask(config);
      scheduler.removeSyncTask("test-task");

      expect(scheduler.hasTask("test-task")).toBe(false);
      expect(scheduler.getTaskInfo("test-task")).toBeUndefined();
    });

    it("应该抛出错误当任务不存在", () => {
      expect(() => scheduler.removeSyncTask("non-existent")).toThrow();
    });
  });

  describe("startSyncTask", () => {
    it("应该成功启动同步任务", () => {
      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: false,
      };

      scheduler.addSyncTask(config);
      scheduler.startSyncTask("test-task");

      const info = scheduler.getTaskInfo("test-task");
      expect(info?.enabled).toBe(true);
    });

    it("应该抛出错误当任务不存在", () => {
      expect(() => scheduler.startSyncTask("non-existent")).toThrow();
    });
  });

  describe("stopSyncTask", () => {
    it("应该成功停止同步任务", () => {
      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: true,
      };

      scheduler.addSyncTask(config);
      scheduler.stopSyncTask("test-task");

      const info = scheduler.getTaskInfo("test-task");
      expect(info?.enabled).toBe(false);
    });

    it("应该抛出错误当任务不存在", () => {
      expect(() => scheduler.stopSyncTask("non-existent")).toThrow();
    });
  });

  describe("getTaskInfo", () => {
    it("应该返回任务信息", () => {
      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: true,
        description: "Test task",
      };

      scheduler.addSyncTask(config);

      const info = scheduler.getTaskInfo("test-task");

      expect(info).toBeDefined();
      expect(info?.id).toBe("test-task");
      expect(info?.type).toBe(SyncTaskType.DATA_SYNC);
      expect(info?.cronExpression).toBe("0 * * * *");
      expect(info?.enabled).toBe(true);
      expect(info?.description).toBe("Test task");
      expect(info?.status).toBe("idle");
    });

    it("应该返回 undefined 当任务不存在", () => {
      const info = scheduler.getTaskInfo("non-existent");
      expect(info).toBeUndefined();
    });
  });

  describe("getAllTasks", () => {
    it("应该返回所有任务", () => {
      const config1: SyncTaskConfig = {
        id: "task-1",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
      };

      const config2: SyncTaskConfig = {
        id: "task-2",
        type: SyncTaskType.CACHE_REFRESH,
        cronExpression: "0 2 * * *",
      };

      scheduler.addSyncTask(config1);
      scheduler.addSyncTask(config2);

      const tasks = scheduler.getAllTasks();

      expect(tasks).toHaveLength(2);
    });
  });

  describe("getTasksByType", () => {
    it("应该返回指定类型的任务", () => {
      const config1: SyncTaskConfig = {
        id: "task-1",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
      };

      const config2: SyncTaskConfig = {
        id: "task-2",
        type: SyncTaskType.CACHE_REFRESH,
        cronExpression: "0 2 * * *",
      };

      const config3: SyncTaskConfig = {
        id: "task-3",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 3 * * *",
      };

      scheduler.addSyncTask(config1);
      scheduler.addSyncTask(config2);
      scheduler.addSyncTask(config3);

      const dataSyncTasks = scheduler.getTasksByType(SyncTaskType.DATA_SYNC);
      const cacheRefreshTasks = scheduler.getTasksByType(SyncTaskType.CACHE_REFRESH);

      expect(dataSyncTasks).toHaveLength(2);
      expect(cacheRefreshTasks).toHaveLength(1);
      expect(dataSyncTasks.every((t) => t.type === SyncTaskType.DATA_SYNC)).toBe(true);
    });
  });

  describe("getEnabledTasks", () => {
    it("应该返回已启用的任务", () => {
      const config1: SyncTaskConfig = {
        id: "task-1",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: true,
      };

      const config2: SyncTaskConfig = {
        id: "task-2",
        type: SyncTaskType.CACHE_REFRESH,
        cronExpression: "0 2 * * *",
        enabled: false,
      };

      scheduler.addSyncTask(config1);
      scheduler.addSyncTask(config2);

      const enabledTasks = scheduler.getEnabledTasks();

      expect(enabledTasks).toHaveLength(1);
      expect(enabledTasks[0].id).toBe("task-1");
    });
  });

  describe("startAllDefaultTasks", () => {
    it("应该启动所有默认任务", () => {
      scheduler.registerExecutor(SyncTaskType.DATA_SYNC, vi.fn().mockResolvedValue(undefined));
      scheduler.registerExecutor(SyncTaskType.CACHE_REFRESH, vi.fn().mockResolvedValue(undefined));
      scheduler.registerExecutor(SyncTaskType.CLEANUP, vi.fn().mockResolvedValue(undefined));

      scheduler.startAllDefaultTasks();

      expect(scheduler.getTaskCount()).toBe(3);
      expect(scheduler.getEnabledTasks()).toHaveLength(3);
    });
  });

  describe("stopAllTasks", () => {
    it("应该停止所有任务", () => {
      const config1: SyncTaskConfig = {
        id: "task-1",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: true,
      };

      const config2: SyncTaskConfig = {
        id: "task-2",
        type: SyncTaskType.CACHE_REFRESH,
        cronExpression: "0 2 * * *",
        enabled: true,
      };

      scheduler.addSyncTask(config1);
      scheduler.addSyncTask(config2);

      scheduler.stopAllTasks();

      const tasks = scheduler.getAllTasks();
      expect(tasks.every((t) => !t.enabled)).toBe(true);
    });
  });

  describe("executeTaskManually", () => {
    it("应该手动执行任务", async () => {
      const executor = vi.fn().mockResolvedValue(undefined);
      scheduler.registerExecutor(SyncTaskType.DATA_SYNC, executor);

      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: true,
      };

      scheduler.addSyncTask(config);

      await scheduler.executeTaskManually("test-task");

      expect(executor).toHaveBeenCalledTimes(1);

      const info = scheduler.getTaskInfo("test-task");
      expect(info?.executionCount).toBe(1);
      expect(info?.successCount).toBe(1);
    });

    it("应该抛出错误当任务不存在", async () => {
      await expect(scheduler.executeTaskManually("non-existent")).rejects.toThrow();
    });
  });

  describe("hasTask", () => {
    it("应该返回 true 当任务存在", () => {
      const config: SyncTaskConfig = {
        id: "test-task",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
      };

      scheduler.addSyncTask(config);

      expect(scheduler.hasTask("test-task")).toBe(true);
    });

    it("应该返回 false 当任务不存在", () => {
      expect(scheduler.hasTask("non-existent")).toBe(false);
    });
  });

  describe("getTaskCount", () => {
    it("应该返回任务数量", () => {
      const config1: SyncTaskConfig = {
        id: "task-1",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
      };

      const config2: SyncTaskConfig = {
        id: "task-2",
        type: SyncTaskType.CACHE_REFRESH,
        cronExpression: "0 2 * * *",
      };

      scheduler.addSyncTask(config1);
      scheduler.addSyncTask(config2);

      expect(scheduler.getTaskCount()).toBe(2);
    });
  });

  describe("getStats", () => {
    it("应该返回统计信息", () => {
      const config1: SyncTaskConfig = {
        id: "task-1",
        type: SyncTaskType.DATA_SYNC,
        cronExpression: "0 * * * *",
        enabled: true,
      };

      const config2: SyncTaskConfig = {
        id: "task-2",
        type: SyncTaskType.CACHE_REFRESH,
        cronExpression: "0 2 * * *",
        enabled: false,
      };

      scheduler.addSyncTask(config1);
      scheduler.addSyncTask(config2);

      const stats = scheduler.getStats();

      expect(stats.totalTasks).toBe(2);
      expect(stats.enabledTasks).toBe(1);
      expect(stats.disabledTasks).toBe(1);
      expect(stats.runningTasks).toBe(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });
});
