/**
 * DataSyncScheduler
 * 数据同步调度器
 * 定时同步数据和刷新缓存
 */

import cron from "node-cron";
import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 同步任务类型
 */
export enum SyncTaskType {
  DATA_SYNC = "data_sync",
  CACHE_REFRESH = "cache_refresh",
  CLEANUP = "cleanup",
  TOPIC_COLLECTION = "topic_collection",
}

/**
 * 同步任务配置接口
 */
export interface SyncTaskConfig {
  id: string;
  type: SyncTaskType;
  cronExpression: string;
  enabled?: boolean;
  description?: string;
}

/**
 * 同步任务信息接口
 */
export interface SyncTaskInfo {
  id: string;
  type: SyncTaskType;
  cronExpression: string;
  status: "idle" | "running" | "completed" | "failed";
  enabled: boolean;
  description?: string;
  lastExecution?: Date;
  nextExecution?: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * 同步执行器类型
 */
export type SyncExecutor = () => Promise<void>;

/**
 * DataSyncScheduler 类
 * 管理数据同步任务
 */
export class DataSyncScheduler {
  private log: ReturnType<typeof logger.withContext>;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private taskInfo: Map<string, SyncTaskInfo> = new Map();
  private executors: Map<SyncTaskType, SyncExecutor> = new Map();
  private defaultTasks: SyncTaskConfig[] = [
    {
      id: "data-sync-hourly",
      type: SyncTaskType.DATA_SYNC,
      cronExpression: "0 * * * *", // 每小时执行一次
      enabled: true,
      description: "Hourly data synchronization",
    },
    {
      id: "topic-collection-hourly",
      type: SyncTaskType.TOPIC_COLLECTION,
      cronExpression: "0 * * * *", // 每小时执行一次
      enabled: true,
      description: "Hourly topic collection from various sources",
    },
    {
      id: "cache-refresh-daily",
      type: SyncTaskType.CACHE_REFRESH,
      cronExpression: "0 2 * * *", // 每天凌晨2点执行
      enabled: true,
      description: "Daily cache refresh",
    },
    {
      id: "cleanup-weekly",
      type: SyncTaskType.CLEANUP,
      cronExpression: "0 3 * * 0", // 每周日凌晨3点执行
      enabled: true,
      description: "Weekly cleanup",
    },
  ];

  constructor() {
    this.log = logger.withContext({ component: "DataSyncScheduler" });
    this.log.debug("DataSyncScheduler initialized");
  }

  /**
   * 注册同步执行器
   */
  registerExecutor(type: SyncTaskType, executor: SyncExecutor): void {
    this.executors.set(type, executor);
    this.log.info(`Executor registered for type: ${type}`);
  }

  /**
   * 添加同步任务
   */
  addSyncTask(config: SyncTaskConfig): void {
    if (this.tasks.has(config.id)) {
      throw new AppError(`Task already exists: ${config.id}`, ErrorCode.INVALID_INPUT, 409);
    }

    const task = cron.schedule(
      config.cronExpression,
      async () => {
        await this.executeSyncTask(config.id);
      },
      {
        timezone: "Asia/Shanghai",
      },
    );

    task.stop();

    this.tasks.set(config.id, task);
    this.taskInfo.set(config.id, {
      id: config.id,
      type: config.type,
      cronExpression: config.cronExpression,
      status: "idle",
      enabled: config.enabled ?? true,
      description: config.description,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    this.log.info(`Sync task added: ${config.id} with cron: ${config.cronExpression}`);
  }

  /**
   * 移除同步任务
   */
  removeSyncTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    task.stop();
    this.tasks.delete(taskId);
    this.taskInfo.delete(taskId);

    this.log.info(`Sync task removed: ${taskId}`);
  }

  /**
   * 启动同步任务
   */
  startSyncTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    const info = this.taskInfo.get(taskId);

    if (!task || !info) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    task.start();
    info.enabled = true;
    this.taskInfo.set(taskId, info);

    this.log.info(`Sync task started: ${taskId}`);
  }

  /**
   * 停止同步任务
   */
  stopSyncTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    const info = this.taskInfo.get(taskId);

    if (!task || !info) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    task.stop();
    info.enabled = false;
    this.taskInfo.set(taskId, info);

    this.log.info(`Sync task stopped: ${taskId}`);
  }

  /**
   * 获取任务信息
   */
  getTaskInfo(taskId: string): SyncTaskInfo | undefined {
    return this.taskInfo.get(taskId);
  }

  /**
   * 获取所有任务信息
   */
  getAllTasks(): SyncTaskInfo[] {
    return Array.from(this.taskInfo.values());
  }

  /**
   * 获取指定类型的任务
   */
  getTasksByType(type: SyncTaskType): SyncTaskInfo[] {
    return Array.from(this.taskInfo.values()).filter((t) => t.type === type);
  }

  /**
   * 获取已启用的任务
   */
  getEnabledTasks(): SyncTaskInfo[] {
    return Array.from(this.taskInfo.values()).filter((t) => t.enabled);
  }

  /**
   * 启动所有默认任务
   */
  startAllDefaultTasks(): void {
    this.defaultTasks.forEach((config) => {
      try {
        this.addSyncTask(config);
        if (config.enabled) {
          this.startSyncTask(config.id);
        }
      } catch (error) {
        this.log.error(`Failed to start default task: ${config.id}`, { error });
      }
    });
    this.log.info("All default sync tasks started");
  }

  /**
   * 停止所有任务
   */
  stopAllTasks(): void {
    this.tasks.forEach((task, taskId) => {
      task.stop();
      const info = this.taskInfo.get(taskId);
      if (info) {
        info.enabled = false;
        this.taskInfo.set(taskId, info);
      }
      this.log.debug(`Task stopped: ${taskId}`);
    });
    this.log.info("All sync tasks stopped");
  }

  /**
   * 清理所有任务
   */
  cleanup(): void {
    this.stopAllTasks();
    this.tasks.clear();
    this.taskInfo.clear();
    this.executors.clear();
    this.log.info("Data sync scheduler cleaned up");
  }

  /**
   * 手动执行任务
   */
  async executeTaskManually(taskId: string): Promise<void> {
    const info = this.taskInfo.get(taskId);
    if (!info) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    await this.executeSyncTask(taskId);
  }

  /**
   * 执行同步任务
   */
  private async executeSyncTask(taskId: string): Promise<void> {
    const info = this.taskInfo.get(taskId);
    if (!info) {
      this.log.error(`Task info not found: ${taskId}`);
      return;
    }

    if (!info.enabled) {
      this.log.debug(`Task is disabled: ${taskId}`);
      return;
    }

    try {
      this.log.info(`Executing sync task: ${taskId}`);
      info.status = "running";
      info.lastExecution = new Date();
      info.executionCount++;
      this.taskInfo.set(taskId, info);

      const executor = this.executors.get(info.type);
      if (!executor) {
        throw new AppError(
          `No executor registered for type: ${info.type}`,
          ErrorCode.NOT_FOUND,
          404,
        );
      }

      await executor();

      info.status = "completed";
      info.successCount++;
      this.log.info(`Sync task completed: ${taskId}`);
    } catch (error) {
      info.status = "failed";
      info.failureCount++;
      this.log.error(`Sync task failed: ${taskId}`, { error });
      throw new AppError(
        `Sync task execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.AGENT_EXECUTION_ERROR,
        500,
      );
    } finally {
      this.taskInfo.set(taskId, info);
    }
  }

  /**
   * 检查任务是否已存在
   */
  hasTask(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * 获取任务数量
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalTasks: number;
    enabledTasks: number;
    disabledTasks: number;
    runningTasks: number;
    totalExecutions: number;
    successRate: number;
  } {
    const tasks = Array.from(this.taskInfo.values());
    const enabledTasks = tasks.filter((t) => t.enabled).length;
    const runningTasks = tasks.filter((t) => t.status === "running").length;
    const totalExecutions = tasks.reduce((sum, t) => sum + t.executionCount, 0);
    const successCount = tasks.reduce((sum, t) => sum + t.successCount, 0);
    const successRate = totalExecutions > 0 ? successCount / totalExecutions : 0;

    return {
      totalTasks: tasks.length,
      enabledTasks,
      disabledTasks: tasks.length - enabledTasks,
      runningTasks,
      totalExecutions,
      successRate,
    };
  }
}
