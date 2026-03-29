/**
 * PushScheduler
 * 定时推送调度器
 * 使用 node-cron 实现定时推送任务
 */

import cron from "node-cron";
import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { PushWorkflow } from "../workflows/PushWorkflow.js";
import type { TopicGenerationConfig } from "../workflows/PushWorkflow.js";

/**
 * 推送时间配置接口
 */
export interface PushTimeConfig {
  morning?: string; // 早推送时间，格式: "HH:mm"，如 "08:00"
  noon?: string; // 午推送时间，格式: "HH:mm"，如 "12:00"
  evening?: string; // 晚推送时间，格式: "HH:mm"，如 "18:00"
}

/**
 * 推送任务配置接口
 */
export interface PushTaskConfig {
  userId: string;
  topicConfig: TopicGenerationConfig;
  timeConfig?: PushTimeConfig;
}

/**
 * 推送任务信息接口
 */
export interface PushTaskInfo {
  id: string;
  userId: string;
  scheduledTime: string;
  cronExpression: string;
  status: "scheduled" | "running" | "completed" | "failed";
  lastExecution?: Date;
  nextExecution?: Date;
}

/**
 * PushScheduler 类
 * 管理定时推送任务
 */
export class PushScheduler {
  private pushWorkflow: PushWorkflow;
  private log: ReturnType<typeof logger.withContext>;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private taskInfo: Map<string, PushTaskInfo> = new Map();
  private defaultTimeConfig: PushTimeConfig = {
    morning: "08:00",
    noon: "12:00",
    evening: "18:00",
  };

  constructor(pushWorkflow?: PushWorkflow) {
    this.pushWorkflow = pushWorkflow || new PushWorkflow();
    this.log = logger.withContext({ component: "PushScheduler" });
    this.log.debug("PushScheduler initialized");
  }

  /**
   * 添加推送任务
   */
  addPushTask(config: PushTaskConfig): string {
    const taskId = `push-${config.userId}-${Date.now()}`;
    const timeConfig = { ...this.defaultTimeConfig, ...config.timeConfig };

    // 为每个时间段创建任务
    const timeSlots = this.getTimeSlots(timeConfig);
    timeSlots.forEach((slot) => {
      const slotTaskId = `${taskId}-${slot.name}`;
      const cronExpression = this.timeToCronExpression(slot.time);

      const task = cron.schedule(
        cronExpression,
        async () => {
          await this.executePushTask(slotTaskId, config.userId, config.topicConfig);
        },
        {
          timezone: "Asia/Shanghai",
        },
      );

      this.tasks.set(slotTaskId, task);
      this.taskInfo.set(slotTaskId, {
        id: slotTaskId,
        userId: config.userId,
        scheduledTime: slot.time,
        cronExpression,
        status: "scheduled",
      });

      this.log.info(`Push task scheduled: ${slotTaskId} at ${slot.time}`);
    });

    return taskId;
  }

  /**
   * 启动推送任务
   */
  startPushTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    task.start();
    const info = this.taskInfo.get(taskId);
    if (info) {
      info.status = "scheduled";
      this.taskInfo.set(taskId, info);
    }

    this.log.info(`Push task started: ${taskId}`);
  }

  /**
   * 停止推送任务
   */
  stopPushTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    task.stop();
    const info = this.taskInfo.get(taskId);
    if (info) {
      info.status = "scheduled";
      this.taskInfo.set(taskId, info);
    }

    this.log.info(`Push task stopped: ${taskId}`);
  }

  /**
   * 移除推送任务
   */
  removePushTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError(`Task not found: ${taskId}`, ErrorCode.NOT_FOUND, 404);
    }

    task.stop();
    this.tasks.delete(taskId);
    this.taskInfo.delete(taskId);

    this.log.info(`Push task removed: ${taskId}`);
  }

  /**
   * 获取任务信息
   */
  getTaskInfo(taskId: string): PushTaskInfo | undefined {
    return this.taskInfo.get(taskId);
  }

  /**
   * 获取所有任务信息
   */
  getAllTasks(): PushTaskInfo[] {
    return Array.from(this.taskInfo.values());
  }

  /**
   * 获取用户的所有任务
   */
  getUserTasks(userId: string): PushTaskInfo[] {
    return Array.from(this.taskInfo.values()).filter((t) => t.userId === userId);
  }

  /**
   * 停止所有任务
   */
  stopAllTasks(): void {
    this.tasks.forEach((task, taskId) => {
      task.stop();
      this.log.debug(`Task stopped: ${taskId}`);
    });
    this.log.info("All push tasks stopped");
  }

  /**
   * 清理所有任务
   */
  cleanup(): void {
    this.stopAllTasks();
    this.tasks.clear();
    this.taskInfo.clear();
    this.log.info("Push scheduler cleaned up");
  }

  /**
   * 执行推送任务
   */
  private async executePushTask(
    taskId: string,
    userId: string,
    topicConfig: TopicGenerationConfig,
  ): Promise<void> {
    const info = this.taskInfo.get(taskId);
    if (!info) {
      this.log.error(`Task info not found: ${taskId}`);
      return;
    }

    try {
      this.log.info(`Executing push task: ${taskId} for user: ${userId}`);
      info.status = "running";
      info.lastExecution = new Date();
      this.taskInfo.set(taskId, info);

      const result = await this.pushWorkflow.executePushWorkflow(userId, topicConfig);

      if (result.success) {
        info.status = "completed";
        this.log.info(`Push task completed: ${taskId}`);
      } else {
        info.status = "failed";
        this.log.error(`Push task failed: ${taskId}`, { error: result.error });
      }
    } catch (error) {
      info.status = "failed";
      this.log.error(`Push task error: ${taskId}`, { error });
      throw new AppError(
        `Push task execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.AGENT_EXECUTION_ERROR,
        500,
      );
    } finally {
      this.taskInfo.set(taskId, info);
    }
  }

  /**
   * 获取时间段
   */
  private getTimeSlots(timeConfig: PushTimeConfig): Array<{ name: string; time: string }> {
    const slots: Array<{ name: string; time: string }> = [];

    if (timeConfig.morning) {
      slots.push({ name: "morning", time: timeConfig.morning });
    }
    if (timeConfig.noon) {
      slots.push({ name: "noon", time: timeConfig.noon });
    }
    if (timeConfig.evening) {
      slots.push({ name: "evening", time: timeConfig.evening });
    }

    return slots;
  }

  /**
   * 将时间转换为 cron 表达式
   */
  private timeToCronExpression(time: string): string {
    const [hours, minutes] = time.split(":").map(Number);
    return `${minutes} ${hours} * * *`;
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
}
