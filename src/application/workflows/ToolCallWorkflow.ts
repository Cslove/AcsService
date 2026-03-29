/**
 * ToolCallWorkflow
 * Tool Call 循环流程
 * 并行工具调用
 * 错误处理和重试
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 工具调用配置接口
 */
export interface ToolCallConfig {
  toolId: string;
  parameters: Record<string, any>;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * 工具调用结果接口
 */
export interface ToolCallResult {
  toolId: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  retryCount: number;
}

/**
 * 工作流配置接口
 */
export interface WorkflowConfig {
  maxConcurrentCalls?: number;
  defaultTimeout?: number;
  defaultRetryCount?: number;
  defaultRetryDelay?: number;
  enableParallel?: boolean;
}

/**
 * 工具调用工作流类
 */
export class ToolCallWorkflow {
  private config: Required<WorkflowConfig>;
  private log: ReturnType<typeof logger.withContext>;
  private callHistory: Map<string, ToolCallResult[]> = new Map();

  constructor(config: WorkflowConfig = {}) {
    this.config = {
      maxConcurrentCalls: 5,
      defaultTimeout: 30000,
      defaultRetryCount: 3,
      defaultRetryDelay: 1000,
      enableParallel: true,
      ...config,
    };

    this.log = logger.withContext({ component: "ToolCallWorkflow" });
    this.log.debug(`ToolCallWorkflow initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * 执行单个工具调用
   */
  async executeToolCall(
    toolId: string,
    parameters: Record<string, any>,
    executor: (params: Record<string, any>) => Promise<any>,
  ): Promise<ToolCallResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = this.config.defaultRetryCount;
    const retryDelay = this.config.defaultRetryDelay;

    while (retryCount <= maxRetries) {
      try {
        this.log.info(
          `Executing tool call: ${toolId} (attempt ${retryCount + 1}/${maxRetries + 1})`,
        );

        const data = await Promise.race([
          executor(parameters),
          this.createTimeout(this.config.defaultTimeout),
        ]);

        const executionTime = Date.now() - startTime;
        const result: ToolCallResult = {
          toolId,
          success: true,
          data,
          executionTime,
          retryCount,
        };

        this.recordResult(toolId, result);
        this.log.info(`Tool call succeeded: ${toolId} (execution time: ${executionTime}ms)`);

        return result;
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (retryCount <= maxRetries) {
          this.log.warn(
            `Tool call failed, retrying: ${toolId} (attempt ${retryCount}/${maxRetries})`,
            { error: errorMessage },
          );
          await this.sleep(retryDelay * retryCount);
        } else {
          const executionTime = Date.now() - startTime;
          const result: ToolCallResult = {
            toolId,
            success: false,
            error: errorMessage,
            executionTime,
            retryCount,
          };

          this.recordResult(toolId, result);
          this.log.error(`Tool call failed: ${toolId}`, { error: errorMessage });

          return result;
        }
      }
    }

    throw new AppError(
      `Tool call failed after ${maxRetries} retries: ${toolId}`,
      ErrorCode.AGENT_EXECUTION_ERROR,
      500,
    );
  }

  /**
   * 并行执行多个工具调用
   */
  async executeParallelToolCalls(
    calls: ToolCallConfig[],
    executor: (toolId: string, params: Record<string, any>) => Promise<any>,
  ): Promise<ToolCallResult[]> {
    if (!this.config.enableParallel) {
      return this.executeSequentialToolCalls(calls, executor);
    }

    this.log.info(`Executing ${calls.length} tool calls in parallel`);

    const batchSize = this.config.maxConcurrentCalls;
    const results: ToolCallResult[] = [];

    for (let i = 0; i < calls.length; i += batchSize) {
      const batch = calls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((call) =>
          this.executeToolCall(call.toolId, call.parameters, (params) =>
            executor(call.toolId, params),
          ),
        ),
      );
      results.push(...batchResults);
    }

    const successCount = results.filter((r) => r.success).length;
    this.log.info(`Parallel execution completed: ${successCount}/${results.length} succeeded`);

    return results;
  }

  /**
   * 顺序执行多个工具调用
   */
  async executeSequentialToolCalls(
    calls: ToolCallConfig[],
    executor: (toolId: string, params: Record<string, any>) => Promise<any>,
  ): Promise<ToolCallResult[]> {
    this.log.info(`Executing ${calls.length} tool calls sequentially`);

    const results: ToolCallResult[] = [];

    for (const call of calls) {
      const result = await this.executeToolCall(call.toolId, call.parameters, (params) =>
        executor(call.toolId, params),
      );
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    this.log.info(`Sequential execution completed: ${successCount}/${results.length} succeeded`);

    return results;
  }

  /**
   * 执行工具调用循环
   */
  async executeToolCallLoop<T>(
    initialInput: T,
    condition: (result: ToolCallResult, input: T) => boolean,
    executor: (input: T) => Promise<ToolCallResult>,
    maxIterations: number = 10,
  ): Promise<ToolCallResult[]> {
    this.log.info(`Starting tool call loop (max iterations: ${maxIterations})`);

    const results: ToolCallResult[] = [];
    let currentInput = initialInput;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      this.log.debug(`Tool call loop iteration: ${iteration}/${maxIterations}`);

      const result = await executor(currentInput);
      results.push(result);

      if (!condition(result, currentInput)) {
        this.log.info(`Tool call loop terminated at iteration ${iteration}`);
        break;
      }

      // 更新输入（这里假设结果包含下一个输入）
      if (result.data && typeof result.data === "object" && "nextInput" in result.data) {
        currentInput = result.data.nextInput as T;
      }
    }

    if (iteration >= maxIterations) {
      this.log.warn(`Tool call loop reached maximum iterations: ${maxIterations}`);
    }

    return results;
  }

  /**
   * 获取工具调用历史
   */
  getCallHistory(toolId?: string): ToolCallResult[] {
    if (toolId) {
      return this.callHistory.get(toolId) || [];
    }
    return Array.from(this.callHistory.values()).flat();
  }

  /**
   * 清除调用历史
   */
  clearCallHistory(toolId?: string): void {
    if (toolId) {
      this.callHistory.delete(toolId);
    } else {
      this.callHistory.clear();
    }
    this.log.debug(`Call history cleared${toolId ? ` for tool: ${toolId}` : ""}`);
  }

  /**
   * 获取统计信息
   */
  getStats(toolId?: string): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageExecutionTime: number;
  } {
    const history = toolId
      ? this.callHistory.get(toolId) || []
      : Array.from(this.callHistory.values()).flat();
    const totalCalls = history.length;
    const successfulCalls = history.filter((r) => r.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const averageExecutionTime =
      totalCalls > 0 ? history.reduce((sum, r) => sum + r.executionTime, 0) / totalCalls : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageExecutionTime,
    };
  }

  /**
   * 记录结果
   */
  private recordResult(toolId: string, result: ToolCallResult): void {
    if (!this.callHistory.has(toolId)) {
      this.callHistory.set(toolId, []);
    }
    this.callHistory.get(toolId)!.push(result);
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AppError(`Tool call timeout after ${ms}ms`, ErrorCode.TIMEOUT, 408));
      }, ms);
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.clearCallHistory();
    this.log.debug("ToolCallWorkflow cleaned up");
  }
}
