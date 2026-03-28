import { describe, it, expect } from "vitest";
import {
  ErrorHandler,
  AppError,
  StorageError,
  LLMError,
  CacheError,
  TaskError,
  AgentError,
  ErrorCode,
} from "@/shared/utils/errorHandler.js";

describe("ErrorHandler", () => {
  describe("错误类型", () => {
    it("应该创建AppError", () => {
      const error = new AppError("Test error", ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.name).toBe("AppError");
    });

    it("应该创建StorageError", () => {
      const error = new StorageError("Storage failed");
      expect(error.message).toBe("Storage failed");
      expect(error.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(error.name).toBe("StorageError");
    });

    it("应该创建LLMError", () => {
      const error = new LLMError("LLM failed");
      expect(error.message).toBe("LLM failed");
      expect(error.code).toBe(ErrorCode.LLM_ERROR);
      expect(error.name).toBe("LLMError");
    });

    it("应该创建CacheError", () => {
      const error = new CacheError("Cache failed");
      expect(error.message).toBe("Cache failed");
      expect(error.code).toBe(ErrorCode.CACHE_ERROR);
      expect(error.name).toBe("CacheError");
    });

    it("应该创建TaskError", () => {
      const error = new TaskError("Task failed");
      expect(error.message).toBe("Task failed");
      expect(error.code).toBe(ErrorCode.TASK_ERROR);
      expect(error.name).toBe("TaskError");
    });

    it("应该创建AgentError", () => {
      const error = new AgentError("Agent failed");
      expect(error.message).toBe("Agent failed");
      expect(error.code).toBe(ErrorCode.AGENT_ERROR);
      expect(error.name).toBe("AgentError");
    });
  });

  describe("错误包装", () => {
    it("应该包装普通错误", () => {
      const originalError = new Error("Original error");
      const wrappedError = ErrorHandler.handle(originalError, "test operation");

      expect(wrappedError).toBeInstanceOf(AppError);
      expect(wrappedError.message).toContain("test operation");
      expect(wrappedError.message).toContain("Original error");
    });

    it("应该包装AppError", () => {
      const originalError = new AppError("App error", ErrorCode.INTERNAL_ERROR);
      const wrappedError = ErrorHandler.handle(originalError, "test operation");

      expect(wrappedError).toBe(originalError);
    });

    it("应该包装字符串错误", () => {
      const wrappedError = ErrorHandler.handle("String error", "test operation");

      expect(wrappedError).toBeInstanceOf(AppError);
      expect(wrappedError.message).toContain("test operation");
      expect(wrappedError.message).toContain("Unknown error");
    });

    it("应该包装未知错误", () => {
      const wrappedError = ErrorHandler.handle(null, "test operation");

      expect(wrappedError).toBeInstanceOf(AppError);
      expect(wrappedError.message).toContain("test operation");
      expect(wrappedError.message).toContain("Unknown error");
    });

    it("应该保留原始错误信息", () => {
      const originalError = new Error("Original error");
      const wrappedError = ErrorHandler.handle(originalError, "test operation");

      expect(wrappedError.details?.stack).toBeDefined();
      expect(wrappedError.message).toContain("test operation");
      expect(wrappedError.message).toContain("Original error");
    });
  });

  describe("重试判断", () => {
    it("应该判断错误是否可重试", () => {
      const retryableError = new AppError("Rate limit", ErrorCode.LLM_RATE_LIMIT);
      expect(ErrorHandler.isRetryable(retryableError)).toBe(true);

      const nonRetryableError = new AppError("Validation failed", ErrorCode.INVALID_INPUT);
      expect(ErrorHandler.isRetryable(nonRetryableError)).toBe(false);
    });

    it("应该判断网络错误可重试", () => {
      const error = new AppError("Network error", ErrorCode.STORAGE_ERROR);
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it("应该判断超时错误可重试", () => {
      const error = new AppError("Timeout", ErrorCode.TIMEOUT);
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it("应该判断验证错误不可重试", () => {
      const error = new AppError("Invalid input", ErrorCode.INVALID_INPUT);
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it("应该判断未授权错误不可重试", () => {
      const error = new AppError("Unauthorized", ErrorCode.UNAUTHORIZED);
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });
  });

  describe("错误上下文", () => {
    it("应该添加错误上下文", () => {
      const error = new AppError("Test error", ErrorCode.INTERNAL_ERROR, 500, { userId: "123" });
      expect(error.details).toEqual({ userId: "123" });
    });

    it("应该合并多个上下文", () => {
      const error = new AppError("Test error", ErrorCode.INTERNAL_ERROR, 500, {
        sessionId: "456",
        userId: "123",
      });
      expect(error.details).toEqual({
        sessionId: "456",
        userId: "123",
      });
    });
  });

  describe("错误堆栈", () => {
    it("应该保留错误堆栈", () => {
      const originalError = new Error("Original error");
      const wrappedError = ErrorHandler.handle(originalError, "test");

      expect(wrappedError.stack).toBeDefined();
      expect(wrappedError.stack).toContain("Original error");
    });
  });

  describe("ErrorCode枚举", () => {
    it("应该包含所有预期的错误代码", () => {
      expect(ErrorCode.INTERNAL_ERROR).toBe(1005);
      expect(ErrorCode.INVALID_INPUT).toBe(1001);
      expect(ErrorCode.NOT_FOUND).toBe(1004);
      expect(ErrorCode.UNAUTHORIZED).toBe(1002);
      expect(ErrorCode.FORBIDDEN).toBe(1003);
      expect(ErrorCode.TIMEOUT).toBe(1007);
      expect(ErrorCode.STORAGE_ERROR).toBe(2000);
      expect(ErrorCode.STORAGE_READ_ERROR).toBe(2001);
      expect(ErrorCode.STORAGE_WRITE_ERROR).toBe(2002);
      expect(ErrorCode.STORAGE_DELETE_ERROR).toBe(2003);
      expect(ErrorCode.STORAGE_CONFLICT).toBe(2004);
      expect(ErrorCode.LLM_ERROR).toBe(3000);
      expect(ErrorCode.LLM_API_ERROR).toBe(3001);
      expect(ErrorCode.LLM_TIMEOUT).toBe(3002);
      expect(ErrorCode.LLM_RATE_LIMIT).toBe(3003);
      expect(ErrorCode.LLM_INVALID_RESPONSE).toBe(3004);
      expect(ErrorCode.CACHE_ERROR).toBe(4000);
      expect(ErrorCode.CACHE_MISS).toBe(4001);
      expect(ErrorCode.CACHE_WRITE_ERROR).toBe(4002);
      expect(ErrorCode.TASK_ERROR).toBe(5000);
      expect(ErrorCode.TASK_TIMEOUT).toBe(5001);
      expect(ErrorCode.TASK_CANCELLED).toBe(5002);
      expect(ErrorCode.TASK_FAILED).toBe(5003);
      expect(ErrorCode.AGENT_ERROR).toBe(6000);
      expect(ErrorCode.AGENT_NOT_FOUND).toBe(6001);
      expect(ErrorCode.AGENT_EXECUTION_ERROR).toBe(6002);
    });
  });
});
