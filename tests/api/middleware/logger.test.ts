import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { requestLogger, errorLogger } from "@/api/middleware/logger.js";
import { ErrorHandler } from "@/shared/utils/errorHandler.js";

describe("Logger Middleware", () => {
  let app: Hono<{ Variables: { userId: string } }>;

  beforeEach(() => {
    app = new Hono();
  });

  describe("requestLogger 中间件", () => {
    it("应该成功处理请求并返回正确响应", async () => {
      app.use("/test", requestLogger);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("应该处理 404 状态码", async () => {
      app.use("/test", requestLogger);
      app.get("/test", (c) => {
        return c.json({ error: "Not found" }, 404);
      });

      const res = await app.request("/test");

      expect(res.status).toBe(404);
    });

    it("应该处理 500 状态码", async () => {
      app.use("/test", requestLogger);
      app.get("/test", (c) => {
        return c.json({ error: "Internal error" }, 500);
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
    });

    it("应该能够处理包含 userId 的请求", async () => {
      app.use("/test", (c, next) => {
        c.set("userId", "test-user");
        return next();
      });
      app.use("/test", requestLogger);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("errorLogger 中间件", () => {
    it("应该捕获错误并重新抛出，由 errorHandler 处理", async () => {
      app.onError((err, c) => {
        const appError = ErrorHandler.handle(err, "errorLogger");
        return c.json(
          {
            success: false,
            error: { code: appError.code, message: appError.message },
          },
          appError.statusCode as any,
        );
      });

      app.use("/test", errorLogger);
      app.get("/test", () => {
        throw new Error("Test error");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("应该记录错误信息并返回标准错误响应", async () => {
      app.onError((err, c) => {
        const appError = ErrorHandler.handle(err, "errorLogger");
        return c.json(
          {
            success: false,
            error: { code: appError.code, message: appError.message },
          },
          appError.statusCode as any,
        );
      });

      app.use("/test", errorLogger);
      app.get("/test", () => {
        throw new Error("Test error message");
      });

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      expect(json.error.message).toContain("Test error message");
    });
  });
});
