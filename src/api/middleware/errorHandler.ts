/**
 * 全局错误处理中间件
 * 统一处理所有错误并返回标准化响应
 */

import type { Context, Next } from "hono";
import { AppError, ErrorHandler, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

/**
 * 错误响应格式
 */
interface ErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details?: any;
    timestamp: string;
  };
}

/**
 * 创建错误响应
 */
function createErrorResponse(error: AppError): ErrorResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp.toISOString(),
    },
  };
}

/**
 * 全局错误处理中间件
 */
export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    let appError: AppError;

    // 处理 AppError 及其子类
    if (error instanceof AppError) {
      appError = error;
    } else {
      // 处理其他类型的错误
      appError = ErrorHandler.handle(error, "errorHandler");
    }

    try {
      const response = createErrorResponse(appError);
      return new Response(JSON.stringify(response), {
        status: appError.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // 如果 JSON.stringify 失败，返回简单的错误响应
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: appError.code,
            message: appError.message,
            timestamp: appError.timestamp.toISOString(),
          },
        }),
        {
          status: appError.statusCode,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }
};

/**
 * 404 错误处理
 */
export const notFoundHandler = (c: Context) => {
  const path = c.req.path;
  const method = c.req.method;

  logger.warn("Route not found", { path, method, userId: c.get("userId") });

  const error = new AppError(`Route not found: ${method} ${path}`, ErrorCode.NOT_FOUND, 404);

  const response = createErrorResponse(error);
  return new Response(JSON.stringify(response), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};

export default errorHandler;
