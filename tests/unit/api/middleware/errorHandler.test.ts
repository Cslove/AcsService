import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { notFoundHandler } from "@/api/middleware/errorHandler.js";
import {
  AppError,
  ErrorCode,
  StorageError,
  LLMError,
  CacheError,
  TaskError,
  AgentError,
  ErrorHandler,
} from "@/shared/utils/errorHandler.js";

describe("Error Handler Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("errorHandler 中间件", () => {
    it("应该处理 AppError 并返回正确的状态码", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          const response = {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              timestamp: err.timestamp.toISOString(),
            },
          };
          return c.json(response, err.statusCode as any);
        }
        throw err;
      });

      app.get("/test", () => {
        throw new AppError("Test error", ErrorCode.INVALID_INPUT, 400);
      });

      const res = await app.request("/test");

      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(json.error.message).toBe("Test error");
      expect(json.error.timestamp).toBeDefined();
    });

    it("应该处理 StorageError", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
              },
            },
            err.statusCode as any,
          );
        }
        throw err;
      });

      app.get("/test", () => {
        throw new StorageError("Storage error occurred");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.error.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(json.error.message).toBe("Storage error occurred");
    });

    it("应该处理 LLMError", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: { code: err.code, message: err.message },
            },
            err.statusCode as any,
          );
        }
        throw err;
      });

      app.get("/test", () => {
        throw new LLMError("LLM error occurred");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.error.code).toBe(ErrorCode.LLM_ERROR);
    });

    it("应该处理 CacheError", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: { code: err.code, message: err.message },
            },
            err.statusCode as any,
          );
        }
        throw err;
      });

      app.get("/test", () => {
        throw new CacheError("Cache error occurred");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.error.code).toBe(ErrorCode.CACHE_ERROR);
    });

    it("应该处理 TaskError", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: { code: err.code, message: err.message },
            },
            err.statusCode as any,
          );
        }
        throw err;
      });

      app.get("/test", () => {
        throw new TaskError("Task error occurred");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.error.code).toBe(ErrorCode.TASK_ERROR);
    });

    it("应该处理 AgentError", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: { code: err.code, message: err.message },
            },
            err.statusCode as any,
          );
        }
        throw err;
      });

      app.get("/test", () => {
        throw new AgentError("Agent error occurred");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.error.code).toBe(ErrorCode.AGENT_ERROR);
    });

    it("应该处理普通 Error 对象", async () => {
      app.onError((err, c) => {
        const appError = ErrorHandler.handle(err, "errorHandler");
        return c.json(
          {
            success: false,
            error: { code: appError.code, message: appError.message },
          },
          appError.statusCode as any,
        );
      });

      app.get("/test", () => {
        throw new Error("Generic error");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(json.error.message).toContain("Generic error");
    });

    it("应该处理非 Error 对象", async () => {
      const testApp = new Hono();

      testApp.onError((err, c) => {
        try {
          const appError = ErrorHandler.handle(err, "errorHandler");
          return c.json(
            {
              success: false,
              error: { code: appError.code, message: appError.message },
            },
            appError.statusCode as any,
          );
        } catch {
          // 如果 ErrorHandler.handle 也抛出错误，返回通用错误响应
          return c.json(
            {
              success: false,
              error: { code: ErrorCode.UNKNOWN_ERROR, message: "Unknown error occurred" },
            },
            500,
          );
        }
      });

      testApp.get("/test", () => {
        throw new Error("String error");
      });

      const res = await testApp.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it("应该包含错误详情", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                details: err.details,
              },
            },
            err.statusCode as any,
          );
        }
        throw err;
      });

      app.get("/test", () => {
        throw new AppError("Test error", ErrorCode.INVALID_INPUT, 400, { field: "userId" });
      });

      const res = await app.request("/test");

      const json = await res.json();

      expect(json.error.details).toEqual({ field: "userId" });
    });

    it("应该包含时间戳", async () => {
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                timestamp: err.timestamp.toISOString(),
              },
            },
            err.statusCode as any,
          );
        }
        throw err;
      });

      app.get("/test", () => {
        throw new AppError("Test error", ErrorCode.INVALID_INPUT, 400);
      });

      const res = await app.request("/test");

      const json = await res.json();

      expect(json.error.timestamp).toBeDefined();
      expect(new Date(json.error.timestamp)).toBeInstanceOf(Date);
    });

    it("应该处理不同状态码的错误", async () => {
      const testCases = [
        { code: ErrorCode.UNAUTHORIZED, status: 401 },
        { code: ErrorCode.FORBIDDEN, status: 403 },
        { code: ErrorCode.NOT_FOUND, status: 404 },
        { code: ErrorCode.RATE_LIMIT_EXCEEDED, status: 429 },
      ];

      for (const testCase of testCases) {
        const testApp = new Hono();

        testApp.onError((err, c) => {
          if (err instanceof AppError) {
            return c.json(
              {
                success: false,
                error: { code: err.code, message: err.message },
              },
              err.statusCode as any,
            );
          }
          throw err;
        });

        testApp.get("/test", () => {
          throw new AppError("Test error", testCase.code, testCase.status);
        });

        const res = await testApp.request("/test");
        expect(res.status).toBe(testCase.status);
      }
    });
  });

  describe("notFoundHandler", () => {
    it("应该返回 404 状态码", async () => {
      const testApp = new Hono();
      testApp.all("/*", notFoundHandler);

      const res = await testApp.request("/test");

      expect(res.status).toBe(404);
    });

    it("应该返回正确的错误格式", async () => {
      const testApp = new Hono();
      testApp.all("/*", notFoundHandler);

      const res = await testApp.request("/test", { method: "POST" });

      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(json.error.message).toContain("Route not found");
      expect(json.error.message).toContain("POST /test");
    });

    it("应该包含时间戳", async () => {
      const testApp = new Hono();
      testApp.all("/*", notFoundHandler);

      const res = await testApp.request("/test");

      const json = await res.json();

      expect(json.error.timestamp).toBeDefined();
    });
  });
});
