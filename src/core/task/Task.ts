/**
 * Task 模型
 * 定义任务的基本结构和状态机
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 任务状态枚举
 */
export enum TaskState {
  PENDING = "pending",
  RUNNING = "running",
  PAUSED = "paused",
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
 * 任务配置接口
 */
export interface TaskConfig {
  id: string;
  name: string;
  description?: string;
  priority?: TaskPriority;
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 任务上下文接口
 */
export interface TaskContext {
  state: TaskState;
  result?: any;
  error?: Error;
  retryCount: number;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 任务输入接口
 */
export interface TaskInput {
  [key: string]: any;
}

/**
 * 任务输出接口
 */
export interface TaskOutput {
  success: boolean;
  data?: any;
  error?: Error;
}

/**
 * 任务执行函数类型
 */
export type TaskExecutor = (input: TaskInput) => Promise<TaskOutput>;

/**
 * Task 类
 * 管理任务的状态和执行
 */
export class Task {
  private config: TaskConfig;
  private context: TaskContext;
  private executor: TaskExecutor;
  private input: TaskInput;
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: TaskConfig, executor: TaskExecutor, input: TaskInput = {}) {
    this.config = {
      priority: TaskPriority.NORMAL,
      timeout: 30000,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...config,
    };

    this.context = {
      state: TaskState.PENDING,
      retryCount: 0,
      createdAt: this.config.createdAt!,
      updatedAt: this.config.updatedAt!,
    };

    this.executor = executor;
    this.input = input;

    this.log = logger.withContext({ component: "Task", taskId: this.config.id });
    this.log.debug(`Task created: ${this.config.name}`);
  }

  /**
   * 获取任务 ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 获取任务名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取任务描述
   */
  getDescription(): string {
    return this.config.description || "";
  }

  /**
   * 获取任务优先级
   */
  getPriority(): TaskPriority {
    return this.config.priority!;
  }

  /**
   * 获取任务超时时间
   */
  getTimeout(): number {
    return this.config.timeout!;
  }

  /**
   * 获取最大重试次数
   */
  getMaxRetries(): number {
    return this.config.maxRetries!;
  }

  /**
   * 获取任务状态
   */
  getState(): TaskState {
    return this.context.state;
  }

  /**
   * 获取任务上下文
   */
  getContext(): TaskContext {
    return { ...this.context };
  }

  /**
   * 获取任务输入
   */
  getInput(): TaskInput {
    return { ...this.input };
  }

  /**
   * 获取任务输出
   */
  getOutput(): TaskOutput | undefined {
    if (!this.context.result) {
      return undefined;
    }
    return this.context.result;
  }

  /**
   * 获取重试次数
   */
  getRetryCount(): number {
    return this.context.retryCount;
  }

  /**
   * 获取任务元数据
   */
  getMetadata(): Record<string, any> {
    return { ...this.config.metadata };
  }

  /**
   * 设置任务元数据
   */
  setMetadata(metadata: Record<string, any>): void {
    this.config.metadata = metadata;
    this.updateTimestamp();
    this.log.debug("Metadata updated");
  }

  /**
   * 更新任务元数据
   */
  updateMetadata(key: string, value: any): void {
    if (!this.config.metadata) {
      this.config.metadata = {};
    }
    this.config.metadata[key] = value;
    this.updateTimestamp();
    this.log.debug(`Metadata updated: ${key}`);
  }

  /**
   * 开始执行任务
   */
  async start(): Promise<TaskOutput> {
    if (this.context.state !== TaskState.PENDING && this.context.state !== TaskState.FAILED) {
      throw new AppError(
        `Cannot start task in state: ${this.context.state}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    // 使用循环代替递归，避免栈溢出
    while (this.context.retryCount <= this.config.maxRetries!) {
      this.setState(TaskState.RUNNING);
      this.context.startTime = new Date();
      this.updateTimestamp();

      this.log.info(`Task started: ${this.config.name}`);

      try {
        // 执行任务，带超时控制
        const output = await Promise.race([
          this.executor(this.input),
          new Promise<TaskOutput>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Task timeout after ${this.config.timeout}ms`)),
              this.config.timeout,
            ),
          ),
        ]);

        this.context.result = output;
        this.context.endTime = new Date();
        this.context.duration = this.context.endTime.getTime() - this.context.startTime!.getTime();

        if (output.success) {
          this.setState(TaskState.COMPLETED);
          this.log.info(`Task completed successfully: ${this.config.name}`);
          return output;
        } else {
          throw output.error || new Error("Task failed");
        }
      } catch (error) {
        this.context.error = error as Error;
        this.context.endTime = new Date();
        this.context.duration = this.context.endTime.getTime() - this.context.startTime!.getTime();

        // 检查是否可以重试
        if (this.context.retryCount < this.config.maxRetries!) {
          this.context.retryCount++;
          this.setState(TaskState.FAILED);
          this.log.warn(
            `Task failed, retrying (${this.context.retryCount}/${this.config.maxRetries}): ${this.config.name}`,
          );

          // 重置状态为 PENDING 以便重试
          this.context.state = TaskState.PENDING;
          this.context.startTime = undefined;
          this.context.endTime = undefined;
          this.context.duration = undefined;

          // 继续循环进行重试
          continue;
        } else {
          this.setState(TaskState.FAILED);
          this.log.error(
            `Task failed after ${this.config.maxRetries} retries: ${this.config.name}`,
            error,
          );
          throw error;
        }
      }
    }

    // 理论上不应该到达这里
    throw new AppError("Task execution failed unexpectedly", ErrorCode.TASK_ERROR, 500);
  }

  /**
   * 暂停任务
   */
  pause(): void {
    if (this.context.state !== TaskState.RUNNING) {
      throw new AppError(
        `Cannot pause task in state: ${this.context.state}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }
    this.setState(TaskState.PAUSED);
    this.log.debug(`Task paused: ${this.config.name}`);
  }

  /**
   * 恢复任务
   */
  resume(): void {
    if (this.context.state !== TaskState.PAUSED) {
      throw new AppError(
        `Cannot resume task in state: ${this.context.state}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }
    this.setState(TaskState.RUNNING);
    this.log.debug(`Task resumed: ${this.config.name}`);
  }

  /**
   * 取消任务
   */
  cancel(): void {
    if (this.context.state === TaskState.COMPLETED || this.context.state === TaskState.CANCELLED) {
      throw new AppError(
        `Cannot cancel task in state: ${this.context.state}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }
    this.setState(TaskState.CANCELLED);
    this.context.endTime = new Date();
    if (this.context.startTime) {
      this.context.duration = this.context.endTime.getTime() - this.context.startTime.getTime();
    }
    this.log.info(`Task cancelled: ${this.config.name}`);
  }

  /**
   * 重置任务状态
   */
  reset(): void {
    if (this.context.state === TaskState.RUNNING || this.context.state === TaskState.PAUSED) {
      throw new AppError(
        `Cannot reset task in state: ${this.context.state}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    this.context.state = TaskState.PENDING;
    this.context.result = undefined;
    this.context.error = undefined;
    this.context.retryCount = 0;
    this.context.startTime = undefined;
    this.context.endTime = undefined;
    this.context.duration = undefined;
    this.updateTimestamp();

    this.log.debug(`Task reset: ${this.config.name}`);
  }

  /**
   * 设置任务状态
   */
  private setState(state: TaskState): void {
    this.context.state = state;
    this.updateTimestamp();
  }

  /**
   * 更新时间戳
   */
  private updateTimestamp(): void {
    this.context.updatedAt = new Date();
  }

  /**
   * 检查任务是否待执行
   */
  isPending(): boolean {
    return this.context.state === TaskState.PENDING;
  }

  /**
   * 检查任务是否正在运行
   */
  isRunning(): boolean {
    return this.context.state === TaskState.RUNNING;
  }

  /**
   * 检查任务是否已暂停
   */
  isPaused(): boolean {
    return this.context.state === TaskState.PAUSED;
  }

  /**
   * 检查任务是否已完成
   */
  isCompleted(): boolean {
    return this.context.state === TaskState.COMPLETED;
  }

  /**
   * 检查任务是否已失败
   */
  isFailed(): boolean {
    return this.context.state === TaskState.FAILED;
  }

  /**
   * 检查任务是否已取消
   */
  isCancelled(): boolean {
    return this.context.state === TaskState.CANCELLED;
  }

  /**
   * 检查任务是否已完成（成功、失败或取消）
   */
  isFinished(): boolean {
    return (
      this.context.state === TaskState.COMPLETED ||
      this.context.state === TaskState.FAILED ||
      this.context.state === TaskState.CANCELLED
    );
  }

  /**
   * 获取任务执行时长
   */
  getDuration(): number | undefined {
    return this.context.duration;
  }

  /**
   * 获取创建时间
   */
  getCreatedAt(): Date {
    return this.context.createdAt;
  }

  /**
   * 获取更新时间
   */
  getUpdatedAt(): Date {
    return this.context.updatedAt;
  }

  /**
   * 获取开始时间
   */
  getStartTime(): Date | undefined {
    return this.context.startTime;
  }

  /**
   * 获取结束时间
   */
  getEndTime(): Date | undefined {
    return this.context.endTime;
  }

  /**
   * 转换为 JSON
   */
  toJSON(): any {
    return {
      id: this.config.id,
      name: this.config.name,
      description: this.config.description,
      priority: this.config.priority,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      metadata: this.config.metadata,
      state: this.context.state,
      result: this.context.result,
      error: this.context.error?.message,
      retryCount: this.context.retryCount,
      duration: this.context.duration,
      createdAt: this.context.createdAt.toISOString(),
      updatedAt: this.context.updatedAt.toISOString(),
      startTime: this.context.startTime?.toISOString(),
      endTime: this.context.endTime?.toISOString(),
    };
  }

  /**
   * 从 JSON 创建 Task
   */
  static fromJSON(json: any, executor: TaskExecutor, input: TaskInput = {}): Task {
    const config: TaskConfig = {
      id: json.id,
      name: json.name,
      description: json.description,
      priority: json.priority,
      timeout: json.timeout,
      maxRetries: json.maxRetries,
      metadata: json.metadata,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
    };

    const task = new Task(config, executor, input);

    // 恢复状态
    task.context.state = json.state;
    task.context.result = json.result;
    task.context.retryCount = json.retryCount;
    task.context.duration = json.duration;
    task.context.startTime = json.startTime ? new Date(json.startTime) : undefined;
    task.context.endTime = json.endTime ? new Date(json.endTime) : undefined;

    if (json.error) {
      task.context.error = new Error(json.error);
    }

    return task;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.context.result = undefined;
    this.context.error = undefined;
    this.log.debug(`Task cleaned up: ${this.config.name}`);
  }
}

export default Task;
