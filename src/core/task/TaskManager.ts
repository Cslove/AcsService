/**
 * TaskManager
 * 任务管理器，负责任务队列管理、任务调度和任务持久化
 */

import { Task, type TaskConfig, type TaskExecutor, type TaskInput } from "./Task.js";
import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 任务管理器配置接口
 */
export interface TaskManagerConfig {
  maxConcurrentTasks?: number;
  maxQueueSize?: number;
  persistEnabled?: boolean;
  persistPath?: string;
}

/**
 * 任务统计信息接口
 */
export interface TaskStatistics {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
}

/**
 * TaskManager 类
 * 管理任务队列和任务调度
 */
export class TaskManager {
  private config: Required<TaskManagerConfig>;
  private tasks: Map<string, Task> = new Map();
  private queue: Task[] = [];
  private runningTasks: Set<string> = new Set();
  private log: ReturnType<typeof logger.withContext>;
  private schedulerInterval?: NodeJS.Timeout;

  constructor(config: TaskManagerConfig = {}) {
    this.config = {
      maxConcurrentTasks: 5,
      maxQueueSize: 100,
      persistEnabled: false,
      persistPath: "./tasks.json",
      ...config,
    };

    this.log = logger.withContext({ component: "TaskManager" });
    this.log.debug("TaskManager initialized");

    // 启动调度器
    this.startScheduler();
  }

  /**
   * 创建并添加任务
   */
  createTask(config: TaskConfig, executor: TaskExecutor, input: TaskInput = {}): Task {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new AppError("Task queue is full", ErrorCode.TASK_ERROR, 400);
    }

    const task = new Task(config, executor, input);
    this.tasks.set(task.getId(), task);

    // 根据优先级添加到队列
    this.addToQueue(task);

    this.log.debug(`Task created and added to queue: ${task.getName()}`);
    return task;
  }

  /**
   * 添加任务到队列（按优先级排序）
   */
  private addToQueue(task: Task): void {
    // 找到合适的插入位置
    let insertIndex = 0;
    for (let i = 0; i < this.queue.length; i++) {
      if (task.getPriority() > this.queue[i].getPriority()) {
        break;
      }
      insertIndex = i + 1;
    }
    this.queue.splice(insertIndex, 0, task);
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
   * 获取待执行的任务
   */
  getPendingTasks(): Task[] {
    return this.getAllTasks().filter((task) => task.isPending());
  }

  /**
   * 获取正在运行的任务
   */
  getRunningTasks(): Task[] {
    return this.getAllTasks().filter((task) => task.isRunning());
  }

  /**
   * 获取已完成的任务
   */
  getCompletedTasks(): Task[] {
    return this.getAllTasks().filter((task) => task.isCompleted());
  }

  /**
   * 获取失败的任务
   */
  getFailedTasks(): Task[] {
    return this.getAllTasks().filter((task) => task.isFailed());
  }

  /**
   * 获取已取消的任务
   */
  getCancelledTasks(): Task[] {
    return this.getAllTasks().filter((task) => task.isCancelled());
  }

  /**
   * 获取任务统计信息
   */
  getStatistics(): TaskStatistics {
    const allTasks = this.getAllTasks();
    return {
      totalTasks: allTasks.length,
      pendingTasks: allTasks.filter((t) => t.isPending()).length,
      runningTasks: allTasks.filter((t) => t.isRunning()).length,
      completedTasks: allTasks.filter((t) => t.isCompleted()).length,
      failedTasks: allTasks.filter((t) => t.isFailed()).length,
      cancelledTasks: allTasks.filter((t) => t.isCancelled()).length,
    };
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.TASK_ERROR, 404);
    }
    task.pause();
    this.log.debug(`Task paused: ${task.getName()}`);
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.TASK_ERROR, 404);
    }
    task.resume();
    this.log.debug(`Task resumed: ${task.getName()}`);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.TASK_ERROR, 404);
    }
    task.cancel();

    // 从队列中移除
    const queueIndex = this.queue.findIndex((t) => t.getId() === taskId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    this.log.debug(`Task cancelled: ${task.getName()}`);
  }

  /**
   * 重置任务
   */
  resetTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.TASK_ERROR, 404);
    }
    task.reset();

    // 重新添加到队列
    this.addToQueue(task);

    this.log.debug(`Task reset: ${task.getName()}`);
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.TASK_ERROR, 404);
    }

    if (task.isRunning()) {
      throw new AppError("Cannot delete running task", ErrorCode.INVALID_INPUT, 400);
    }

    // 从队列中移除
    const queueIndex = this.queue.findIndex((t) => t.getId() === taskId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    this.tasks.delete(taskId);
    task.cleanup();

    this.log.debug(`Task deleted: ${task.getName()}`);
  }

  /**
   * 清空所有任务
   */
  clearAllTasks(): void {
    // 取消所有正在运行的任务
    for (const taskId of this.runningTasks) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.cancel();
      }
    }

    // 清空队列
    this.queue = [];
    this.runningTasks.clear();

    // 清理所有任务
    for (const task of this.tasks.values()) {
      task.cleanup();
    }

    this.tasks.clear();

    this.log.debug("All tasks cleared");
  }

  /**
   * 清空已完成的任务
   */
  clearCompletedTasks(): void {
    for (const task of this.tasks.values()) {
      if (task.isFinished()) {
        this.deleteTask(task.getId());
      }
    }

    this.log.debug("Completed tasks cleared");
  }

  /**
   * 启动调度器
   */
  private startScheduler(): void {
    if (this.schedulerInterval) {
      return;
    }

    this.schedulerInterval = setInterval(() => {
      this.schedule();
    }, 100);

    this.log.debug("Task scheduler started");
  }

  /**
   * 停止调度器
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
      this.log.debug("Task scheduler stopped");
    }
  }

  /**
   * 调度任务
   */
  private async schedule(): Promise<void> {
    // 检查是否还有并发任务可用
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    // 从队列中获取下一个待执行的任务
    while (this.queue.length > 0 && this.runningTasks.size < this.config.maxConcurrentTasks) {
      const task = this.queue.shift();
      if (!task) {
        break;
      }

      // 检查任务是否可以执行
      if (!task.isPending() && !task.isFailed()) {
        continue;
      }

      // 开始执行任务
      this.runningTasks.add(task.getId());
      this.executeTask(task).catch((error) => {
        this.log.error(`Task execution error: ${task.getName()}`, error);
      });
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: Task): Promise<void> {
    try {
      await task.start();
      this.log.info(`Task completed: ${task.getName()}`);
    } catch (error) {
      this.log.error(`Task failed: ${task.getName()}`, error);

      // 如果任务失败且还可以重试，重新加入队列
      if (task.isFailed() && task.getRetryCount() < task.getMaxRetries()) {
        this.addToQueue(task);
      }
    } finally {
      this.runningTasks.delete(task.getId());
    }
  }

  /**
   * 持久化任务
   */
  async persist(): Promise<void> {
    if (!this.config.persistEnabled) {
      return;
    }

    const tasksData = Array.from(this.tasks.values()).map((task) => task.toJSON());
    // 这里应该实现实际的持久化逻辑，例如写入文件或数据库
    // 暂时只记录日志
    this.log.debug(`Persisted ${tasksData.length} tasks`);
  }

  /**
   * 从持久化恢复任务
   */
  async restore(): Promise<void> {
    if (!this.config.persistEnabled) {
      return;
    }

    // 这里应该实现实际的恢复逻辑，例如从文件或数据库读取
    // 暂时只记录日志
    this.log.debug("Restored tasks from persistence");
  }

  /**
   * 获取配置
   */
  getConfig(): Required<TaskManagerConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TaskManagerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this.log.debug("TaskManager config updated");
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * 获取运行中的任务数量
   */
  getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.stopScheduler();
    this.clearAllTasks();
    this.log.debug("TaskManager cleaned up");
  }

  /**
   * 转换为 JSON
   */
  toJSON(): any {
    return {
      config: this.config,
      statistics: this.getStatistics(),
      queueLength: this.queue.length,
      runningTaskCount: this.runningTasks.size,
    };
  }
}

export default TaskManager;
