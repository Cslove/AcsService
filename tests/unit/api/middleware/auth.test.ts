import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { auth, optionalAuth, requirePermission } from "@/api/middleware/auth.js";
import { errorHandler } from "@/api/middleware/errorHandler.js";
import { ErrorCode, AppError } from "@/shared/utils/errorHandler.js";

describe("Auth Middleware", () => {
  let app: Hono<{ Variables: { userId: string } }>;

  beforeEach(() => {
    app = new Hono();
  });

  describe("auth 中间件", () => {
    it("应该从 Authorization header 中提取 userId", async () => {
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

      app.use("/test", auth);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: {
          Authorization: "Bearer test-user-id",
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.userId).toBe("test-user-id");
    });

    it("应该从 query 参数中提取 userId", async () => {
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

      app.use("/test", auth);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test?userId=test-user-id");

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.userId).toBe("test-user-id");
    });

    it("应该从 X-User-Id header 中提取 userId", async () => {
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

      app.use("/test", auth);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: {
          "X-User-Id": "test-user-id",
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.userId).toBe("test-user-id");
    });

    it("当没有提供 userId 时应该返回 401 错误", async () => {
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

      app.use("/test", auth);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(401);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(json.error.message).toContain("Unauthorized");
    });

    it("应该正确处理非 Bearer token", async () => {
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

      app.use("/test", auth);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") });
      });

      const res = await app.request("/test", {
        headers: {
          Authorization: "InvalidToken test-user-id",
        },
      });

      expect(res.status).toBe(401);
      const json = await res.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });
  describe("optionalAuth 中间件", () => {
    it("当提供 userId 时应该设置到上下文中", async () => {
      app.use("/test", optionalAuth);
      app.use("/test", errorHandler);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") || "guest" });
      });

      const res = await app.request("/test?userId=test-user");

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.userId).toBe("test-user");
    });

    it("当没有提供 userId 时应该继续执行", async () => {
      app.use("/test", optionalAuth);
      app.use("/test", errorHandler);
      app.get("/test", (c) => {
        return c.json({ userId: c.get("userId") || "guest" });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.userId).toBe("guest");
    });
  });

  describe("requirePermission 中间件", () => {
    it("当用户已认证时应该通过权限检查", async () => {
      app.use("/test", auth);
      app.use("/test", requirePermission("read:conversations"));
      app.use("/test", errorHandler);
      app.get("/test", (c) => {
        return c.json({ success: true });
      });

      const res = await app.request("/test", {
        headers: {
          Authorization: "Bearer test-user",
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("当用户未认证时应该返回 401 错误", async () => {
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

      app.use("/test", requirePermission("read:conversations"));
      app.get("/test", (c) => {
        return c.json({ success: true });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(401);
    });
  });
});
