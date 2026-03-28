/**
 * 子代理
 * 负责处理特定任务
 */

import { BaseAgent, type AgentConfig, AgentState } from "./BaseAgent.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 子代理配置
 */
export interface SubAgentConfig extends AgentConfig {
  taskType: string;
  capabilities: string[];
}

/**
 * 子代理类
 */
export class SubAgent extends BaseAgent {
  private taskType: string;
  private capabilities: string[];

  constructor(config: SubAgentConfig) {
    super(config);
    this.taskType = config.taskType;
    this.capabilities = config.capabilities || [];
  }

  /**
   * 获取任务类型
   */
  getTaskType(): string {
    return this.taskType;
  }

  /**
   * 获取能力列表
   */
  getCapabilities(): string[] {
    return [...this.capabilities];
  }

  /**
   * 检查是否具备某个能力
   */
  hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * 添加能力
   */
  addCapability(capability: string): void {
    if (!this.capabilities.includes(capability)) {
      this.capabilities.push(capability);
      this.logger.debug(`Capability added: ${capability}`);
    }
  }

  /**
   * 移除能力
   */
  removeCapability(capability: string): boolean {
    const index = this.capabilities.indexOf(capability);
    if (index > -1) {
      this.capabilities.splice(index, 1);
      this.logger.debug(`Capability removed: ${capability}`);
      return true;
    }
    return false;
  }

  /**
   * 验证输入
   */
  protected validateInput(input: any): boolean {
    if (!input || typeof input !== "object") {
      return false;
    }

    // 检查必需的字段
    if (!input.task || !input.task.type) {
      return false;
    }

    // 检查任务类型是否匹配
    if (input.task.type !== this.taskType) {
      return false;
    }

    return true;
  }

  /**
   * 处理任务（子类可以重写此方法）
   */
  protected async processTask(input: any): Promise<any> {
    // 默认实现：查找并执行对应的技能
    const skillName = input.task.action;
    if (!skillName) {
      throw new AppError("Task action is required", ErrorCode.INVALID_INPUT, 400);
    }

    return this.executeSkill(skillName, input);
  }

  /**
   * 执行子代理
   */
  async execute(input: any): Promise<any> {
    this.context.state = AgentState.RUNNING;
    this.context.lastExecutedAt = new Date();
    this.context.executionCount++;

    this.logger.info(`SubAgent execution started: ${this.config.name}`);

    try {
      // 验证输入
      if (!this.validateInput(input)) {
        throw new AppError("Invalid input for SubAgent", ErrorCode.INVALID_INPUT, 400, { input });
      }

      // 处理任务
      const result = await this.processTask(input);

      this.context.state = AgentState.COMPLETED;
      this.logger.info(`SubAgent execution completed: ${this.config.name}`);

      return {
        success: true,
        result,
        agent: this.config.name,
        taskType: this.taskType,
      };
    } catch (error) {
      this.context.state = AgentState.FAILED;
      this.logger.error(`SubAgent execution failed: ${this.config.name}`, error);
      throw error;
    }
  }

  /**
   * 转换为 JSON
   */
  toJSON() {
    return {
      ...super.toJSON(),
      taskType: this.taskType,
      capabilities: this.capabilities,
    };
  }
}

export default SubAgent;
