/**
 * BaseSkill 抽象基类
 * 定义技能的基本结构和执行逻辑
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import type {
  SkillConfig,
  SkillContext,
  SkillInput,
  SkillOutput,
  SkillState,
  ToolCallDefinition,
} from "./Skill.js";

/**
 * BaseSkill 抽象基类
 * 所有技能都应继承此类
 */
export abstract class BaseSkill {
  protected config: SkillConfig;
  protected context: SkillContext;
  protected log: ReturnType<typeof logger.withContext>;

  constructor(config: SkillConfig) {
    this.config = {
      timeout: 30000,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...config,
    };

    this.context = {
      state: "idle" as SkillState,
      executionCount: 0,
      createdAt: this.config.createdAt!,
      updatedAt: this.config.updatedAt!,
    };

    this.log = logger.withContext({ component: "Skill", skillId: this.config.id });
    this.log.debug(`Skill created: ${this.config.name}`);
  }

  /**
   * 获取技能 ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 获取技能名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取技能描述
   */
  getDescription(): string {
    return this.config.description;
  }

  /**
   * 获取技能类型
   */
  getType(): string {
    return this.config.type;
  }

  /**
   * 获取技能版本
   */
  getVersion(): string {
    return this.config.version;
  }

  /**
   * 获取技能参数
   */
  getParameters(): SkillConfig["parameters"] {
    return this.config.parameters;
  }

  /**
   * 获取技能状态
   */
  getState(): SkillState {
    return this.context.state;
  }

  /**
   * 获取技能上下文
   */
  getContext(): SkillContext {
    return { ...this.context };
  }

  /**
   * 获取技能元数据
   */
  getMetadata(): Record<string, any> {
    return { ...this.config.metadata };
  }

  /**
   * 设置技能元数据
   */
  setMetadata(metadata: Record<string, any>): void {
    this.config.metadata = metadata;
    this.updateTimestamp();
    this.log.debug("Metadata updated");
  }

  /**
   * 更新技能元数据
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
   * 执行技能（带超时控制）
   */
  async execute(input: SkillInput): Promise<SkillOutput> {
    if (this.context.state !== ("idle" as SkillState)) {
      throw new AppError(
        `Cannot execute skill in state: ${this.context.state}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    // 在执行前验证输入参数
    this.validateInput(input);

    this.setState("running" as SkillState);
    this.context.startTime = new Date();
    this.updateTimestamp();

    this.log.info(`Skill execution started: ${this.config.name}`);

    try {
      // 执行技能，带超时控制
      const output = await Promise.race([
        this.executeInternal(input),
        new Promise<SkillOutput>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Skill timeout after ${this.config.timeout}ms`)),
            this.config.timeout,
          ),
        ),
      ]);

      this.context.endTime = new Date();
      this.context.duration = this.context.endTime.getTime() - this.context.startTime!.getTime();

      if (output.success) {
        this.setState("completed" as SkillState);
        this.log.info(`Skill executed successfully: ${this.config.name}`);
      } else {
        throw output.error || new Error("Skill execution failed");
      }

      return output;
    } catch (error) {
      this.context.endTime = new Date();
      this.context.duration = this.context.endTime.getTime() - this.context.startTime!.getTime();

      this.setState("failed" as SkillState);
      this.log.error(`Skill execution failed: ${this.config.name}`, error);

      return {
        success: false,
        error: error as Error,
      };
    } finally {
      this.context.executionCount++;
      this.context.lastExecutionTime = new Date();
      this.updateTimestamp();
    }
  }

  /**
   * 取消技能执行
   */
  cancel(): void {
    if (
      this.context.state === ("idle" as SkillState) ||
      this.context.state === ("completed" as SkillState)
    ) {
      throw new AppError(
        `Cannot cancel skill in state: ${this.context.state}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    this.setState("cancelled" as SkillState);
    this.context.endTime = new Date();
    if (this.context.startTime) {
      this.context.duration = this.context.endTime.getTime() - this.context.startTime.getTime();
    }

    this.log.info(`Skill cancelled: ${this.config.name}`);
  }

  /**
   * 重置技能状态
   */
  reset(): void {
    if (this.context.state === ("running" as SkillState)) {
      throw new AppError(`Cannot reset skill in running state`, ErrorCode.INVALID_INPUT, 400);
    }

    this.context.state = "idle" as SkillState;
    this.context.startTime = undefined;
    this.context.endTime = undefined;
    this.context.duration = undefined;
    this.updateTimestamp();

    this.log.debug(`Skill reset: ${this.config.name}`);
  }

  /**
   * 转换为 Tool Call 定义
   * 用于大模型工具调用
   */
  toToolCall(): ToolCallDefinition {
    const properties: Record<string, any> = {};

    for (const param of this.config.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };

      if (param.enum) {
        properties[param.name].enum = param.enum;
      }
    }

    const required = this.config.parameters.filter((p) => p.required).map((p) => p.name);

    return {
      type: "function",
      function: {
        name: this.config.id,
        description: this.config.description,
        parameters: {
          type: "object",
          properties,
          required,
        },
      },
    };
  }

  /**
   * 验证输入参数
   */
  protected validateInput(input: SkillInput): void {
    for (const param of this.config.parameters) {
      if (param.required && input[param.name] === undefined) {
        throw new AppError(
          `Missing required parameter: ${param.name}`,
          ErrorCode.INVALID_INPUT,
          400,
        );
      }

      if (input[param.name] !== undefined) {
        const value = input[param.name];
        const actualType = Array.isArray(value) ? "array" : typeof value;

        // Skip type validation for "any" type
        if (param.type !== "any" && actualType !== param.type) {
          throw new AppError(
            `Invalid parameter type for ${param.name}: expected ${param.type}, got ${actualType}`,
            ErrorCode.INVALID_INPUT,
            400,
          );
        }

        if (param.enum && !param.enum.includes(value)) {
          throw new AppError(
            `Invalid value for ${param.name}: must be one of ${param.enum.join(", ")}`,
            ErrorCode.INVALID_INPUT,
            400,
          );
        }
      }
    }
  }

  /**
   * 抽象方法：执行技能的内部逻辑
   * 子类必须实现此方法
   */
  protected abstract executeInternal(input: SkillInput): Promise<SkillOutput>;

  /**
   * 设置技能状态
   */
  private setState(state: SkillState): void {
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
   * 检查技能是否空闲
   */
  isIdle(): boolean {
    return this.context.state === ("idle" as SkillState);
  }

  /**
   * 检查技能是否正在运行
   */
  isRunning(): boolean {
    return this.context.state === ("running" as SkillState);
  }

  /**
   * 检查技能是否已完成
   */
  isCompleted(): boolean {
    return this.context.state === ("completed" as SkillState);
  }

  /**
   * 检查技能是否失败
   */
  isFailed(): boolean {
    return this.context.state === ("failed" as SkillState);
  }

  /**
   * 检查技能是否已取消
   */
  isCancelled(): boolean {
    return this.context.state === ("cancelled" as SkillState);
  }

  /**
   * 获取执行时长
   */
  getDuration(): number | undefined {
    return this.context.duration;
  }

  /**
   * 获取执行次数
   */
  getExecutionCount(): number {
    return this.context.executionCount;
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
      type: this.config.type,
      version: this.config.version,
      parameters: this.config.parameters,
      timeout: this.config.timeout,
      metadata: this.config.metadata,
      state: this.context.state,
      executionCount: this.context.executionCount,
      duration: this.context.duration,
      createdAt: this.context.createdAt.toISOString(),
      updatedAt: this.context.updatedAt.toISOString(),
      startTime: this.context.startTime?.toISOString(),
      endTime: this.context.endTime?.toISOString(),
    };
  }

  /**
   * 从 JSON 创建 Skill
   */
  static fromJSON<T extends BaseSkill>(json: any, skillClass: new (config: any) => T): T {
    const config: SkillConfig = {
      id: json.id,
      name: json.name,
      description: json.description,
      type: json.type,
      version: json.version,
      parameters: json.parameters,
      timeout: json.timeout,
      metadata: json.metadata,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
    };

    const skill = new skillClass(config);

    // 恢复状态
    skill.context.state = json.state;
    skill.context.executionCount = json.executionCount;
    skill.context.duration = json.duration;
    skill.context.startTime = json.startTime ? new Date(json.startTime) : undefined;
    skill.context.endTime = json.endTime ? new Date(json.endTime) : undefined;

    return skill;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.log.debug(`Skill cleaned up: ${this.config.name}`);
  }
}

export default BaseSkill;
