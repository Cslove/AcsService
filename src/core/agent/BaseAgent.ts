/**
 * Agent 抽象基类
 * 定义 Agent 的核心接口和通用功能
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * Agent 状态枚举
 */
export enum AgentState {
  IDLE = "idle",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * Agent 配置接口
 */
export interface AgentConfig {
  name: string;
  description?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * 技能接口
 */
export interface Skill {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  state: AgentState;
  skills: Map<string, Skill>;
  metadata: Map<string, any>;
  createdAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
}

/**
 * Agent 抽象基类
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context: AgentContext;
  protected logger: ReturnType<typeof logger.withContext>;

  constructor(config: AgentConfig) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };

    this.context = {
      state: AgentState.IDLE,
      skills: new Map(),
      metadata: new Map(),
      createdAt: new Date(),
      executionCount: 0,
    };

    this.logger = logger.withContext({ agent: this.config.name });
  }

  /**
   * 获取 Agent 名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取 Agent 描述
   */
  getDescription(): string {
    return this.config.description || "";
  }

  /**
   * 获取 Agent 状态
   */
  getState(): AgentState {
    return this.context.state;
  }

  /**
   * 获取 Agent 上下文
   */
  getContext(): AgentContext {
    return { ...this.context };
  }

  /**
   * 添加技能
   */
  addSkill(skill: Skill): void {
    if (this.context.skills.has(skill.name)) {
      throw new AppError(`Skill "${skill.name}" already exists`, ErrorCode.INVALID_INPUT, 400);
    }

    this.context.skills.set(skill.name, skill);
    this.logger.debug(`Skill added: ${skill.name}`);
  }

  /**
   * 移除技能
   */
  removeSkill(skillName: string): boolean {
    const removed = this.context.skills.delete(skillName);
    if (removed) {
      this.logger.debug(`Skill removed: ${skillName}`);
    }
    return removed;
  }

  /**
   * 获取技能
   */
  getSkill(skillName: string): Skill | undefined {
    return this.context.skills.get(skillName);
  }

  /**
   * 获取所有技能
   */
  getSkills(): Skill[] {
    return Array.from(this.context.skills.values());
  }

  /**
   * 设置元数据
   */
  setMetadata(key: string, value: any): void {
    this.context.metadata.set(key, value);
  }

  /**
   * 获取元数据
   */
  getMetadata(key: string): any {
    return this.context.metadata.get(key);
  }

  /**
   * 执行技能
   */
  async executeSkill(skillName: string, input: any): Promise<any> {
    const skill = this.context.skills.get(skillName);
    if (!skill) {
      throw new AppError(`Skill "${skillName}" not found`, ErrorCode.AGENT_NOT_FOUND, 404);
    }

    this.logger.debug(`Executing skill: ${skillName}`);
    return skill.execute(input);
  }

  /**
   * 执行 Agent（抽象方法，子类必须实现）
   */
  abstract execute(input: any): Promise<any>;

  /**
   * 重置 Agent 状态
   */
  reset(): void {
    this.context.state = AgentState.IDLE;
    this.context.lastExecutedAt = undefined;
    this.context.executionCount = 0;
    this.logger.debug("Agent reset");
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.context.skills.clear();
    this.context.metadata.clear();
    this.context.state = AgentState.IDLE;
    this.logger.debug("Agent cleaned up");
  }

  /**
   * 转换为 JSON
   */
  toJSON() {
    return {
      name: this.config.name,
      description: this.config.description,
      state: this.context.state,
      skills: Array.from(this.context.skills.keys()),
      metadata: Object.fromEntries(this.context.metadata),
      createdAt: this.context.createdAt,
      lastExecutedAt: this.context.lastExecutedAt,
      executionCount: this.context.executionCount,
    };
  }
}

export default BaseAgent;
