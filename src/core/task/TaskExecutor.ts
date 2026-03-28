/**
 * TaskExecutor
 * 任务执行器，支持并行执行和任务编排
 */

import { Task, type TaskOutput } from "./Task.js";
import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 任务执行配置接口
 */
export interface ExecutionConfig {
  maxParallelTasks?: number;
  failFast?: boolean;
  timeout?: number;
}

/**
 * 任务执行结果接口
 */
export interface ExecutionResult {
  taskId: string;
  taskName: string;
  success: boolean;
  output?: TaskOutput;
  error?: Error;
  duration?: number;
}

/**
 * 批量执行结果接口
 */
export interface BatchExecutionResult {
  totalTasks: number;
  successCount: number;
  failureCount: number;
  results: ExecutionResult[];
  totalDuration: number;
}

/**
 * TaskExecutor 类
 * 支持并行执行和任务编排
 */
export class TaskExecutor {
  private config: Required<ExecutionConfig>;
  private log: ReturnType<typeof logger.withContext>;
  private activeExecutions: Map<string, Promise<ExecutionResult>> = new Map();

  constructor(config: ExecutionConfig = {}) {
    this.config = {
      maxParallelTasks: 10,
      failFast: false,
      timeout: 30000,
      ...config,
    };

    this.log = logger.withContext({ component: "TaskExecutor" });
    this.log.debug("TaskExecutor initialized");
  }

  /**
   * 执行单个任务
   */
  async execute(task: Task): Promise<ExecutionResult> {
    const taskId = task.getId();

    // 检查任务是否已经在执行中
    if (this.activeExecutions.has(taskId)) {
      throw new AppError(`Task is already executing: ${taskId}`, ErrorCode.INVALID_INPUT, 400);
    }

    const startTime = Date.now();

    try {
      const executionPromise = this.executeInternal(task);
      this.activeExecutions.set(taskId, executionPromise);

      const taskOutput = await executionPromise;
      const duration = Date.now() - startTime;

      this.log.info(`Task executed: ${task.getName()} (${duration}ms)`);

      return {
        taskId: task.getId(),
        taskName: task.getName(),
        success: taskOutput.success,
        output: taskOutput,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;

      this.log.error(`Task execution failed: ${task.getName()}`, error);

      return {
        taskId: task.getId(),
        taskName: task.getName(),
        success: false,
        error: err,
        duration,
      };
    } finally {
      this.activeExecutions.delete(taskId);
    }
  }

  /**
   * 内部执行方法
   */
  private async executeInternal(task: Task): Promise<TaskOutput> {
    // 检查任务状态
    if (task.isRunning() || task.isPaused()) {
      throw new AppError(
        `Task is already running or paused: ${task.getId()}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    // 如果任务已完成或已取消，直接返回结果
    if (task.isFinished()) {
      const output = task.getOutput();
      if (output) {
        return output;
      }
      throw new AppError(
        `Task is finished but has no output: ${task.getId()}`,
        ErrorCode.TASK_ERROR,
        500,
      );
    }

    // 执行任务
    return await task.start();
  }

  /**
   * 并行执行多个任务
   */
  async executeParallel(tasks: Task[]): Promise<BatchExecutionResult> {
    if (tasks.length === 0) {
      return {
        totalTasks: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        totalDuration: 0,
      };
    }

    const startTime = Date.now();
    const results: ExecutionResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let shouldStop = false;

    // 使用信号量控制并发数
    const semaphore = new Semaphore(this.config.maxParallelTasks);

    const executeWithSemaphore = async (task: Task): Promise<ExecutionResult> => {
      await semaphore.acquire();
      try {
        const result = await this.execute(task);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        return result;
      } finally {
        semaphore.release();
      }
    };

    try {
      if (this.config.failFast) {
        // 快速失败模式：任一任务失败则立即停止
        const executionPromises = tasks.map(async (task) => {
          if (shouldStop) {
            // 如果已经停止，取消任务
            if (task.isPending()) {
              try {
                task.cancel();
              } catch {
                // 忽略取消错误
              }
            }
            return null;
          }

          try {
            const result = await executeWithSemaphore(task);

            // 如果任务失败，标记停止并取消其他任务
            if (!result.success) {
              shouldStop = true;
              return result;
            }

            return result;
          } catch (error) {
            // 执行出错也标记停止
            shouldStop = true;
            return {
              taskId: task.getId(),
              taskName: task.getName(),
              success: false,
              error: error as Error,
            };
          }
        });

        // 等待所有任务完成或被取消
        const executionResults = await Promise.all(executionPromises);

        // 过滤掉被取消的任务（返回 null 的）
        for (const result of executionResults) {
          if (result) {
            results.push(result);
          }
        }
      } else {
        // 正常模式：执行所有任务
        const allResults = await Promise.all(tasks.map((task) => executeWithSemaphore(task)));
        results.push(...allResults);
      }
    } catch (error) {
      this.log.error("Parallel execution error", error);
      throw error;
    }

    const totalDuration = Date.now() - startTime;

    this.log.info(
      `Parallel execution completed: ${successCount}/${tasks.length} tasks succeeded (${totalDuration}ms)`,
    );

    return {
      totalTasks: tasks.length,
      successCount,
      failureCount,
      results,
      totalDuration,
    };
  }

  /**
   * 串行执行多个任务
   */
  async executeSequential(tasks: Task[]): Promise<BatchExecutionResult> {
    if (tasks.length === 0) {
      return {
        totalTasks: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        totalDuration: 0,
      };
    }

    const startTime = Date.now();
    const results: ExecutionResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const task of tasks) {
      try {
        const result = await this.execute(task);
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failureCount++;

          // 快速失败模式：任务失败则停止执行
          if (this.config.failFast) {
            // 取消所有剩余任务
            for (const remainingTask of tasks) {
              if (remainingTask.getId() !== task.getId() && remainingTask.isPending()) {
                try {
                  remainingTask.cancel();
                } catch (error) {
                  this.log.warn(`Failed to cancel task: ${remainingTask.getName()}`, { error });
                }
              }
            }
            break;
          }
        }
      } catch (error) {
        failureCount++;
        results.push({
          taskId: task.getId(),
          taskName: task.getName(),
          success: false,
          error: error as Error,
        });

        if (this.config.failFast) {
          break;
        }
      }
    }

    const totalDuration = Date.now() - startTime;

    this.log.info(
      `Sequential execution completed: ${successCount}/${tasks.length} tasks succeeded (${totalDuration}ms)`,
    );

    return {
      totalTasks: tasks.length,
      successCount,
      failureCount,
      results,
      totalDuration,
    };
  }

  /**
   * 执行任务依赖链
   */
  async executeWithDependencies(
    tasks: Task[],
    dependencies: Map<string, string[]>,
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    const results: ExecutionResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    const executedTasks = new Set<string>();

    // 拓扑排序执行
    while (executedTasks.size < tasks.length) {
      let progress = false;

      for (const task of tasks) {
        const taskId = task.getId();

        if (executedTasks.has(taskId)) {
          continue;
        }

        // 检查依赖是否都已执行
        const taskDeps = dependencies.get(taskId) || [];
        const allDepsExecuted = taskDeps.every((depId) => executedTasks.has(depId));

        if (!allDepsExecuted) {
          continue;
        }

        // 执行任务
        try {
          const result = await this.execute(task);
          results.push(result);

          if (result.success) {
            successCount++;
          } else {
            failureCount++;

            if (this.config.failFast) {
              // 取消所有剩余任务
              for (const remainingTask of tasks) {
                if (!executedTasks.has(remainingTask.getId())) {
                  try {
                    remainingTask.cancel();
                  } catch (error) {
                    this.log.warn(`Failed to cancel task: ${remainingTask.getName()}`, { error });
                  }
                }
              }
              return {
                totalTasks: tasks.length,
                successCount,
                failureCount,
                results,
                totalDuration: Date.now() - startTime,
              };
            }
          }

          executedTasks.add(taskId);
          progress = true;
        } catch (error) {
          failureCount++;
          results.push({
            taskId: task.getId(),
            taskName: task.getName(),
            success: false,
            error: error as Error,
          });

          if (this.config.failFast) {
            break;
          }

          executedTasks.add(taskId);
          progress = true;
        }
      }

      if (!progress) {
        // 检测到循环依赖
        throw new AppError(
          "Circular dependency detected in task execution",
          ErrorCode.TASK_ERROR,
          400,
        );
      }
    }

    const totalDuration = Date.now() - startTime;

    this.log.info(
      `Dependency execution completed: ${successCount}/${tasks.length} tasks succeeded (${totalDuration}ms)`,
    );

    return {
      totalTasks: tasks.length,
      successCount,
      failureCount,
      results,
      totalDuration,
    };
  }

  /**
   * 取消所有正在执行的任务
   */
  cancelAll(): void {
    for (const [taskId] of this.activeExecutions) {
      this.log.debug(`Cancelling execution: ${taskId}`);
    }
    this.activeExecutions.clear();
  }

  /**
   * 获取正在执行的任务数量
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * 获取配置
   */
  getConfig(): Required<ExecutionConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExecutionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this.log.debug("TaskExecutor config updated");
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.cancelAll();
    this.log.debug("TaskExecutor cleaned up");
  }

  /**
   * 转换为 JSON
   */
  toJSON(): any {
    return {
      config: this.config,
      activeExecutionCount: this.activeExecutions.size,
    };
  }
}

/**
 * 信号量类，用于控制并发数
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    const next = this.waitQueue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }
}

export default TaskExecutor;
