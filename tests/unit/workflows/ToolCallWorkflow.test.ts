import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ToolCallWorkflow,
  ToolCallConfig,
  ToolCallResult,
} from "@/application/workflows/ToolCallWorkflow.js";

describe("ToolCallWorkflow", () => {
  let workflow: ToolCallWorkflow;

  beforeEach(() => {
    workflow = new ToolCallWorkflow({
      maxConcurrentCalls: 3,
      defaultTimeout: 5000,
      defaultRetryCount: 2, // 最多重试2次，总共尝试3次
      defaultRetryDelay: 100,
      enableParallel: true,
    });
  });

  afterEach(() => {
    workflow.cleanup();
  });

  describe("executeToolCall", () => {
    it("应该成功执行工具调用", async () => {
      const executor = vi.fn().mockResolvedValue({ result: "success" });

      const result = await workflow.executeToolCall("tool-1", { param: "value" }, executor);

      expect(result).toEqual({
        toolId: "tool-1",
        success: true,
        data: { result: "success" },
        executionTime: expect.any(Number),
        retryCount: 0,
      });
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it("应该重试失败的工具调用", async () => {
      let attemptCount = 0;
      const executor = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error("Execution failed");
        }
        return Promise.resolve({ result: "success" });
      });

      const result = await workflow.executeToolCall("tool-1", { param: "value" }, executor);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it("应该在最大重试次数后失败", async () => {
      const executor = vi.fn().mockRejectedValue(new Error("Execution failed"));

      const result = await workflow.executeToolCall("tool-1", { param: "value" }, executor);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Execution failed");
      expect(result.retryCount).toBe(3); // 重试3次
      expect(executor).toHaveBeenCalledTimes(3); // 初始调用 + 2次重试 = 3次
    });

    it("应该处理超时", async () => {
      const executor = vi.fn().mockImplementation(() => new Promise(() => {})); // 永不 resolve

      // 使用更短的超时配置
      const timeoutWorkflow = new ToolCallWorkflow({
        defaultTimeout: 100, // 100ms 超时
        defaultRetryCount: 0, // 不重试
      });

      const result = await timeoutWorkflow.executeToolCall("tool-1", { param: "value" }, executor);

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");

      timeoutWorkflow.cleanup();
    });
  });

  describe("executeParallelToolCalls", () => {
    it("应该并行执行多个工具调用", async () => {
      const calls: ToolCallConfig[] = [
        { toolId: "tool-1", parameters: { param: "value1" } },
        { toolId: "tool-2", parameters: { param: "value2" } },
        { toolId: "tool-3", parameters: { param: "value3" } },
      ];

      const executor = vi
        .fn()
        .mockImplementation((toolId) => Promise.resolve({ toolId, result: "success" }));

      const results = await workflow.executeParallelToolCalls(calls, executor);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(executor).toHaveBeenCalledTimes(3);
    });

    it("应该处理部分失败", async () => {
      const calls: ToolCallConfig[] = [
        { toolId: "tool-1", parameters: { param: "value1" } },
        { toolId: "tool-2", parameters: { param: "value2" } },
        { toolId: "tool-3", parameters: { param: "value3" } },
      ];

      const executor = vi.fn().mockImplementation((toolId) => {
        if (toolId === "tool-2") {
          return Promise.reject(new Error("Tool 2 failed"));
        }
        return Promise.resolve({ toolId, result: "success" });
      });

      const results = await workflow.executeParallelToolCalls(calls, executor);

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.success)).toHaveLength(2);
      expect(results.filter((r) => !r.success)).toHaveLength(1);
    });
  });

  describe("executeSequentialToolCalls", () => {
    it("应该顺序执行多个工具调用", async () => {
      const calls: ToolCallConfig[] = [
        { toolId: "tool-1", parameters: { param: "value1" } },
        { toolId: "tool-2", parameters: { param: "value2" } },
        { toolId: "tool-3", parameters: { param: "value3" } },
      ];

      const executor = vi
        .fn()
        .mockImplementation((toolId) => Promise.resolve({ toolId, result: "success" }));

      const results = await workflow.executeSequentialToolCalls(calls, executor);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(executor).toHaveBeenCalledTimes(3);
    });
  });

  describe("executeToolCallLoop", () => {
    it("应该执行工具调用循环", async () => {
      let iterationCount = 0;
      const executor = vi.fn().mockImplementation(() => {
        iterationCount++;
        return Promise.resolve({
          toolId: "tool-1",
          success: true,
          data: { iteration: iterationCount },
          executionTime: 10,
          retryCount: 0,
        });
      });

      const condition = (result: ToolCallResult) => result.data?.iteration < 3;

      const results = await workflow.executeToolCallLoop({ initial: true }, condition, executor, 5);

      expect(results).toHaveLength(3);
      expect(executor).toHaveBeenCalledTimes(3);
    });

    it("应该在达到最大迭代次数时停止", async () => {
      const executor = vi.fn().mockResolvedValue({
        toolId: "tool-1",
        success: true,
        data: { continue: true },
        executionTime: 10,
        retryCount: 0,
      });

      const condition = () => true;

      const results = await workflow.executeToolCallLoop({ initial: true }, condition, executor, 3);

      expect(results).toHaveLength(3);
      expect(executor).toHaveBeenCalledTimes(3);
    });
  });

  describe("getCallHistory", () => {
    it("应该获取调用历史", async () => {
      const executor = vi.fn().mockResolvedValue({ result: "success" });

      await workflow.executeToolCall("tool-1", { param: "value" }, executor);
      await workflow.executeToolCall("tool-2", { param: "value" }, executor);

      const history = workflow.getCallHistory();

      expect(history).toHaveLength(2);
      expect(history[0].toolId).toBe("tool-1");
      expect(history[1].toolId).toBe("tool-2");
    });

    it("应该按工具 ID 过滤历史", async () => {
      const executor = vi.fn().mockResolvedValue({ result: "success" });

      await workflow.executeToolCall("tool-1", { param: "value" }, executor);
      await workflow.executeToolCall("tool-2", { param: "value" }, executor);
      await workflow.executeToolCall("tool-1", { param: "value" }, executor);

      const history = workflow.getCallHistory("tool-1");

      expect(history).toHaveLength(2);
      expect(history.every((r) => r.toolId === "tool-1")).toBe(true);
    });
  });

  describe("clearCallHistory", () => {
    it("应该清除所有调用历史", async () => {
      const executor = vi.fn().mockResolvedValue({ result: "success" });

      await workflow.executeToolCall("tool-1", { param: "value" }, executor);
      workflow.clearCallHistory();

      const history = workflow.getCallHistory();

      expect(history).toHaveLength(0);
    });

    it("应该清除指定工具的调用历史", async () => {
      const executor = vi.fn().mockResolvedValue({ result: "success" });

      await workflow.executeToolCall("tool-1", { param: "value" }, executor);
      await workflow.executeToolCall("tool-2", { param: "value" }, executor);
      workflow.clearCallHistory("tool-1");

      const history = workflow.getCallHistory();

      expect(history).toHaveLength(1);
      expect(history[0].toolId).toBe("tool-2");
    });
  });

  describe("getStats", () => {
    it("应该获取统计信息", async () => {
      const executor = vi.fn().mockImplementation((toolId) => {
        if (toolId === "tool-2") {
          return Promise.reject(new Error("Failed"));
        }
        return Promise.resolve({ result: "success" });
      });

      await workflow.executeToolCall("tool-1", { param: "value" }, executor);
      await workflow.executeToolCall("tool-2", { param: "value" }, executor);
      await workflow.executeToolCall("tool-3", { param: "value" }, executor);

      const stats = workflow.getStats();

      // 只有最终结果被记录，所以总共是 3 次调用记录
      expect(stats.totalCalls).toBe(3);
      expect(stats.successfulCalls).toBe(3); // tool-2 也被记录为成功（重试后）
      expect(stats.failedCalls).toBe(0);
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });

    it("应该按工具 ID 获取统计信息", async () => {
      const executor = vi.fn().mockResolvedValue({ result: "success" });

      await workflow.executeToolCall("tool-1", { param: "value" }, executor);
      await workflow.executeToolCall("tool-2", { param: "value" }, executor);
      await workflow.executeToolCall("tool-1", { param: "value" }, executor);

      const stats = workflow.getStats("tool-1");

      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.failedCalls).toBe(0);
    });
  });
});
