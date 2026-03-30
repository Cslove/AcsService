/**
 * AcsService - AI Assistant Service
 * 基于 Hono 的 Node.js SSE 服务器
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { cors } from "hono/cors";
import { logger } from "@/shared/utils/logger.js";
import { initEnvironment } from "@/shared/config/envValidator.js";
import { getConfig } from "@/shared/config/index.js";
import { ErrorHandler } from "@/shared/utils/errorHandler.js";
import apiRoutes from "@/api/routes/index.js";
import { requestLogger, errorLogger } from "@/api/middleware/logger.js";
import { errorHandler, notFoundHandler } from "@/api/middleware/errorHandler.js";
function initializeApp(): void {
  try {
    initEnvironment();

    // 加载配置
    const config = getConfig();
    logger.info("Application configuration loaded", {
      port: config.server.port,
      nodeEnv: config.server.nodeEnv,
    });
  } catch (error) {
    logger.error("Failed to initialize application", error);
    process.exit(1);
  }
}

function createApp(): Hono {
  const app = new Hono();

  // 添加中间件
  app.use("*", cors());
  app.use("*", honoLogger());
  app.use("*", errorLogger);
  app.use("*", requestLogger);
  app.use("*", errorHandler);

  // 健康检查端点
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // 根路径
  app.get("/", (c) => {
    return c.json({
      name: "AcsService",
      description: "AI Assistant Service",
      version: "1.0.0",
      status: "running",
    });
  });

  // API 路由
  app.route("/api", apiRoutes);

  // SSE 路由（将在后续阶段实现）
  // app.route("/sse", sseRoutes);

  // 404 处理
  app.notFound(notFoundHandler);

  return app;
}

function setupGracefulShutdown(server: any): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // 停止接受新连接
    server.close(async (err: any) => {
      if (err) {
        logger.error("Error closing server", err);
        process.exit(1);
      }

      logger.info("Server closed successfully");

      // 清理资源（将在后续阶段实现）
      // await cleanupResources();

      logger.info("Application shutdown complete");
      process.exit(0);
    });

    // 强制关闭超时
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 30000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // 捕获未处理的异常
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled rejection", { reason, promise });
    process.exit(1);
  });
}

async function main(): Promise<void> {
  try {
    initializeApp();

    const app = createApp();
    const config = getConfig();

    const server = serve(
      {
        fetch: app.fetch,
        port: config.server.port,
        hostname: "0.0.0.0",
      },
      (info) => {
        logger.info(`Server is running on http://localhost:${info.port}`);
        logger.info(`Environment: ${config.server.nodeEnv}`);
        logger.info(`Press Ctrl+C to stop the server`);
      },
    );

    // 设置优雅关闭
    setupGracefulShutdown(server);
  } catch (error) {
    const appError = ErrorHandler.handle(error, "main");
    logger.error("Failed to start application", appError);
    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  logger.error("Fatal error in main", error);
  process.exit(1);
});
