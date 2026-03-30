/**
 * 日志中间件
 * 记录请求和响应日志
 */

import type { Context, Next } from "hono";
import { logger } from "@/shared/utils/logger.js";

/**
 * 请求日志中间件
 */
export const requestLogger = async (c: Context, next: Next) => {
  const startTime = Date.now();

  const requestLogger = logger.withContext({
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("User-Agent"),
    ip: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "unknown",
  });

  requestLogger.info("Incoming request");

  await next();

  const duration = Date.now() - startTime;
  const statusCode = c.res.status;

  const responseLogger = logger.withContext({
    method: c.req.method,
    path: c.req.path,
    statusCode,
    duration,
    userId: c.get("userId"),
  });

  if (statusCode >= 500) {
    responseLogger.error("Request completed with server error");
  } else if (statusCode >= 400) {
    responseLogger.warn("Request completed with client error");
  } else {
    responseLogger.info("Request completed successfully");
  }
};

/**
 * 错误日志中间件
 */
export const errorLogger = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    logger.error("Request error", error, {
      method: c.req.method,
      path: c.req.path,
      userId: c.get("userId"),
    });
    throw error;
  }
};

export default requestLogger;
