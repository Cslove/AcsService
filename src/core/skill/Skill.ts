/**
 * Skill 类型定义
 * 定义技能相关的类型和接口
 */

/**
 * 技能状态枚举
 */
export enum SkillState {
  IDLE = "idle",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * 技能类型枚举
 */
export enum SkillType {
  SEARCH = "search",
  CONTENT_GENERATION = "content_generation",
  DATA_ANALYSIS = "data_analysis",
  TOOL_CALL = "tool_call",
  CUSTOM = "custom",
}

/**
 * 技能参数定义
 */
export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "any";
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
}

/**
 * 技能配置接口
 */
export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  version: string;
  parameters: SkillParameter[];
  timeout?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 技能执行上下文接口
 */
export interface SkillContext {
  state: SkillState;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  executionCount: number;
  lastExecutionTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 技能输入接口
 */
export interface SkillInput {
  [key: string]: any;
}

/**
 * 技能输出接口
 */
export interface SkillOutput {
  success: boolean;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * 技能执行函数类型
 */
export type SkillExecutor = (input: SkillInput) => Promise<SkillOutput>;

/**
 * Tool Call 定义接口
 */
export interface ToolCallDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: any[];
        }
      >;
      required: string[];
    };
  };
}
