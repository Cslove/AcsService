/**
 * TaskService
 * 任务管理服务
 * 任务创建和调度
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * 任务优先级枚举
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

/**
 * 任务类型枚举
 */
export enum TaskType {
  CONTENT_GENERATION = "content_generation",
  DATA_ANALYSIS = "data_analysis",
  NOTIFICATION = "notification",
  MAINTENANCE = "maintenance",
  CUSTOM = "custom",
}

/**
 * 任务配置接口
 */
export interface TaskConfig {
  id: string;
  type: TaskType;
  name: string;
  description?: string;
  priority: TaskPriority;
  userId?: string;
  sessionId?: string;
  payload?: Record<string, any>;
  scheduledAt?: Date;
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

/**
 * 任务执行结果接口
 */
export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

/**
 * 任务接口
 */
export interface Task {
  id: string;
  config: TaskConfig;
  status: TaskStatus;
  result?: TaskResult;
  retryCount: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  nextRetryAt?: Date;
}

/**
 * TaskService 配置接口
 */
export interface TaskServiceConfig {
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
  defaultMaxRetries?: number;
  taskQueueSize?: number;
}

/**
 * TaskService 类
 * 任务管理服务
 */
export class TaskService {
  private tasks: Map<string, Task> = new Map();
  private taskQueue: string[] = [];
  private runningTasks: Set<string> = new Set();
  private config: Required<TaskServiceConfig>;
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: TaskServiceConfig = {}) {
    this.config = {
      maxConcurrentTasks: 10,
      defaultTimeout: 30000,
      defaultMaxRetries: 3,
      taskQueueSize: 1000,
      ...config,
    };

    this.log = logger.withContext({ component: "TaskService" });
    this.log.debug(`TaskService initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * 创建任务
   */
  createTask(config: TaskConfig): Task {
    // 检查任务队列大小限制
    if (this.tasks.size >= this.config.taskQueueSize) {
      throw new AppError(
        `Task queue size limit reached: ${this.config.taskQueueSize}`,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        400,
      );
    }

    // 检查任务 ID 是否已存在
    if (this.tasks.has(config.id)) {
      throw new AppError(
        `Task with id "${config.id}" already exists`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    const task: Task = {
      id: config.id,
      config: {
        timeout: this.config.defaultTimeout,
        maxRetries: this.config.defaultMaxRetries,
        ...config,
      },
      status: TaskStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task.id);

    this.log.info(`Task created: ${task.id} (type: ${config.type})`);

    return task;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 按状态获取任务
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter((task) => task.status === status);
  }

  /**
   * 按用户 ID 获取任务
   */
  getTasksByUserId(userId: string): Task[] {
    return Array.from(this.tasks.values()).filter((task) => task.config.userId === userId);
  }

  /**
   * 按会话 ID 获取任务
   */
  getTasksBySessionId(sessionId: string): Task[] {
    return Array.from(this.tasks.values()).filter((task) => task.config.sessionId === sessionId);
  }

  /**
   * 按类型获取任务
   */
  getTasksByType(type: TaskType): Task[] {
    return Array.from(this.tasks.values()).filter((task) => task.config.type === type);
  }

  /**
   * 获取待执行任务
   */
  getPendingTasks(): Task[] {
    return this.getTasksByStatus(TaskStatus.PENDING);
  }

  /**
   * 获取运行中任务
   */
  getRunningTasks(): Task[] {
    return this.getTasksByStatus(TaskStatus.RUNNING);
  }

  /**
   * 获取已完成任务
   */
  getCompletedTasks(): Task[] {
    return this.getTasksByStatus(TaskStatus.COMPLETED);
  }

  /**
   * 获取失败任务
   */
  getFailedTasks(): Task[] {
    return this.getTasksByStatus(TaskStatus.FAILED);
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: string, executor: (payload: any) => Promise<any>): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new AppError(`Task is not in pending state: ${taskId}`, ErrorCode.INVALID_INPUT, 400);
    }

    // 检查并发任务限制
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      throw new AppError(
        `Maximum concurrent tasks reached: ${this.config.maxConcurrentTasks}`,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        400,
      );
    }

    // 更新任务状态
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    this.runningTasks.add(taskId);

    this.log.info(`Task started: ${taskId}`);

    const startTime = Date.now();

    try {
      // 执行任务
      const data = await Promise.race([
        executor(task.config.payload || {}),
        this.createTimeout(task.config.timeout || this.config.defaultTimeout),
      ]);

      const executionTime = Date.now() - startTime;

      // 更新任务结果
      task.result = {
        success: true,
        data,
        executionTime,
        timestamp: new Date(),
      };
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();

      this.runningTasks.delete(taskId);
      this.log.info(`Task completed: ${taskId} (execution time: ${executionTime}ms)`);

      return task.result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 检查是否可以重试
      const maxRetries = task.config.maxRetries || this.config.defaultMaxRetries;
      if (task.retryCount < maxRetries) {
        task.retryCount++;
        task.status = TaskStatus.PENDING;
        task.nextRetryAt = new Date(Date.now() + 5000 * task.retryCount); // 指数退避

        this.runningTasks.delete(taskId);
        this.log.warn(
          `Task failed, will retry: ${taskId} (retry ${task.retryCount}/${maxRetries})`,
          { error },
        );

        // 重新加入队列
        this.taskQueue.push(taskId);

        throw new AppError(
          `Task execution failed, will retry: ${taskId}`,
          ErrorCode.TASK_ERROR,
          500,
          { originalError: error, retryCount: task.retryCount },
        );
      }

      // 任务失败
      task.result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        timestamp: new Date(),
      };
      task.status = TaskStatus.FAILED;
      task.completedAt = new Date();

      this.runningTasks.delete(taskId);
      this.log.error(`Task failed: ${taskId}`, { error });

      return task.result;
    }
  }

  /**
   * 批量执行任务
   */
  async executeTasks(
    taskIds: string[],
    executor: (payload: any) => Promise<any>,
  ): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();

    for (const taskId of taskIds) {
      try {
        const result = await this.executeTask(taskId, executor);
        results.set(taskId, result);
      } catch (error) {
        this.log.error(`Failed to execute task: ${taskId}`, error);
      }
    }

    return results;
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === TaskStatus.RUNNING) {
      throw new AppError(`Cannot cancel running task: ${taskId}`, ErrorCode.INVALID_INPUT, 400);
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      throw new AppError(
        `Cannot cancel completed or failed task: ${taskId}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date();

    // 从队列中移除
    const queueIndex = this.taskQueue.indexOf(taskId);
    if (queueIndex > -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    this.log.info(`Task cancelled: ${taskId}`);
    return true;
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === TaskStatus.RUNNING) {
      throw new AppError(`Cannot delete running task: ${taskId}`, ErrorCode.INVALID_INPUT, 400);
    }

    this.tasks.delete(taskId);

    // 从队列中移除
    const queueIndex = this.taskQueue.indexOf(taskId);
    if (queueIndex > -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    this.log.info(`Task deleted: ${taskId}`);
    return true;
  }

  /**
   * 获取任务统计
   */
  getStats(): {
    totalTasks: number;
    pendingTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
    cancelledTasks: number;
  } {
    const tasks = Array.from(this.tasks.values());

    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.status === TaskStatus.PENDING).length,
      runningTasks: tasks.filter((t) => t.status === TaskStatus.RUNNING).length,
      completedTasks: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      failedTasks: tasks.filter((t) => t.status === TaskStatus.FAILED).length,
      cancelledTasks: tasks.filter((t) => t.status === TaskStatus.CANCELLED).length,
    };
  }

  /**
   * 清空所有任务
   */
  clearAllTasks(): void {
    const runningTasks = Array.from(this.runningTasks);
    if (runningTasks.length > 0) {
      throw new AppError(
        `Cannot clear tasks while ${runningTasks.length} tasks are running`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    this.tasks.clear();
    this.taskQueue = [];
    this.log.info("All tasks cleared");
  }

  /**
   * 清空指定状态的任务
   */
  clearTasksByStatus(status: TaskStatus): void {
    if (status === TaskStatus.RUNNING) {
      throw new AppError("Cannot clear running tasks", ErrorCode.INVALID_INPUT, 400);
    }

    const toDelete = this.getTasksByStatus(status);
    for (const task of toDelete) {
      this.tasks.delete(task.id);

      const queueIndex = this.taskQueue.indexOf(task.id);
      if (queueIndex > -1) {
        this.taskQueue.splice(queueIndex, 1);
      }
    }

    this.log.info(`Cleared ${toDelete.length} tasks with status: ${status}`);
  }

  /**
   * 获取配置
   */
  getConfig(): Required<TaskServiceConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<TaskServiceConfig>): void {
    Object.assign(this.config, updates);
    this.log.debug(`Config updated: ${JSON.stringify(updates)}`);
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AppError("Task timeout", ErrorCode.TASK_TIMEOUT, 408));
      }, ms);
    });
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 取消所有待执行的任务
    const pendingTasks = this.getPendingTasks();
    for (const task of pendingTasks) {
      this.cancelTask(task.id);
    }

    this.clearAllTasks();
    this.log.debug("TaskService cleaned up");
  }
}

export default TaskService;
