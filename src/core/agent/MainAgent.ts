/**
 * 主代理
 * 负责品味分析和子代理协调
 */

import { BaseAgent, type AgentConfig, AgentState } from "./BaseAgent.js";
import { AppError, ErrorCode } from "../../shared/utils/errorHandler.js";

/**
 * 品味分析结果接口
 */
export interface TasteAnalysisResult {
  style: string[];
  preferences: string[];
  tags: string[];
  confidence: number;
}

/**
 * 子代理任务接口
 */
export interface SubAgentTask {
  id: string;
  type: string;
  input: any;
  priority: number;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
  error?: string;
}

/**
 * 主代理配置
 */
export interface MainAgentConfig extends AgentConfig {
  maxConcurrentTasks?: number;
  taskTimeout?: number;
}

/**
 * 主代理类
 */
export class MainAgent extends BaseAgent {
  private subAgents: Map<string, BaseAgent>;
  private taskQueue: SubAgentTask[];
  private maxConcurrentTasks: number;
  private taskTimeout: number;

  constructor(config: MainAgentConfig) {
    super(config);
    this.subAgents = new Map();
    this.taskQueue = [];
    this.maxConcurrentTasks = config.maxConcurrentTasks || 3;
    this.taskTimeout = config.taskTimeout || 30000;
  }

  /**
   * 注册子代理
   */
  registerSubAgent(agent: BaseAgent): void {
    if (this.subAgents.has(agent.getName())) {
      throw new AppError(
        `SubAgent "${agent.getName()}" already registered`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    this.subAgents.set(agent.getName(), agent);
    this.logger.info(`SubAgent registered: ${agent.getName()}`);
  }

  /**
   * 注销子代理
   */
  unregisterSubAgent(agentName: string): boolean {
    const removed = this.subAgents.delete(agentName);
    if (removed) {
      this.logger.info(`SubAgent unregistered: ${agentName}`);
    }
    return removed;
  }

  /**
   * 获取子代理
   */
  getSubAgent(agentName: string): BaseAgent | undefined {
    return this.subAgents.get(agentName);
  }

  /**
   * 获取所有子代理
   */
  getSubAgents(): BaseAgent[] {
    return Array.from(this.subAgents.values());
  }

  /**
   * 分析品味
   */
  async analyzeTaste(_input: any): Promise<TasteAnalysisResult> {
    this.logger.debug("Starting taste analysis");

    try {
      // 这里可以实现具体的品味分析逻辑
      // 目前返回一个模拟结果
      const result: TasteAnalysisResult = {
        style: ["modern", "minimalist"],
        preferences: ["clean", "organized"],
        tags: ["design", "productivity"],
        confidence: 0.85,
      };

      this.logger.info("Taste analysis completed", { result });
      return result;
    } catch (error) {
      this.logger.error("Taste analysis failed", error);
      throw new AppError("Taste analysis failed", ErrorCode.AGENT_EXECUTION_ERROR, 500, {
        originalError: error,
      });
    }
  }

  /**
   * 添加任务到队列
   */
  addTask(task: Omit<SubAgentTask, "status">): void {
    const fullTask: SubAgentTask = {
      ...task,
      status: "pending",
    };

    this.taskQueue.push(fullTask);
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    this.logger.debug(`Task added to queue: ${task.id}`);
  }

  /**
   * 协调子代理执行任务
   */
  async coordinateTasks(): Promise<void> {
    this.logger.debug("Coordinating sub-agent tasks");

    const runningTasks: Promise<void>[] = [];
    const pendingTasks = this.taskQueue.filter((t) => t.status === "pending");

    for (const task of pendingTasks) {
      if (runningTasks.length >= this.maxConcurrentTasks) {
        break;
      }

      const taskPromise = this.executeTask(task);
      runningTasks.push(taskPromise);
    }

    await Promise.all(runningTasks);
    this.logger.debug("Task coordination completed");
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: SubAgentTask): Promise<void> {
    const agent = this.subAgents.get(task.type);
    if (!agent) {
      task.status = "failed";
      task.error = `SubAgent "${task.type}" not found`;
      this.logger.error(`Task failed: ${task.id}`, { error: task.error });
      return;
    }

    task.status = "running";
    this.logger.debug(`Executing task: ${task.id}`);

    try {
      const result = await Promise.race([
        agent.execute(task.input),
        this.createTimeout(this.taskTimeout),
      ]);

      task.status = "completed";
      task.result = result;
      this.logger.debug(`Task completed: ${task.id}`);
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Task failed: ${task.id}`, { error: task.error });
    }
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
   * 获取任务队列状态
   */
  getTaskQueueStatus(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    return {
      total: this.taskQueue.length,
      pending: this.taskQueue.filter((t) => t.status === "pending").length,
      running: this.taskQueue.filter((t) => t.status === "running").length,
      completed: this.taskQueue.filter((t) => t.status === "completed").length,
      failed: this.taskQueue.filter((t) => t.status === "failed").length,
    };
  }

  /**
   * 清空任务队列
   */
  clearTaskQueue(): void {
    this.taskQueue = [];
    this.logger.debug("Task queue cleared");
  }

  /**
   * 执行主代理
   */
  async execute(input: any): Promise<any> {
    this.context.state = AgentState.RUNNING;
    this.context.lastExecutedAt = new Date();
    this.context.executionCount++;

    this.logger.info("MainAgent execution started");

    try {
      // 分析品味
      const tasteAnalysis = await this.analyzeTaste(input);

      // 协调子代理任务
      await this.coordinateTasks();

      this.context.state = AgentState.COMPLETED;
      this.logger.info("MainAgent execution completed");

      return {
        tasteAnalysis,
        taskQueue: this.getTaskQueueStatus(),
      };
    } catch (error) {
      this.context.state = AgentState.FAILED;
      this.logger.error("MainAgent execution failed", error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清理所有子代理
    for (const [name, agent] of this.subAgents) {
      try {
        await agent.cleanup();
      } catch (error) {
        this.logger.error(`Failed to cleanup sub-agent: ${name}`, error);
      }
    }

    this.subAgents.clear();
    this.taskQueue = [];

    await super.cleanup();
    this.logger.debug("MainAgent cleaned up");
  }
}

export default MainAgent;
