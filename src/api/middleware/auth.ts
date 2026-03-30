/**
 * 认证中间件
 * 验证用户身份和权限
 */

import type { Context, Next } from "hono";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

/**
 * 从请求中提取用户 ID
 */
function extractUserId(c: Context): string | null {
  // 优先从 Authorization header 中获取
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    // TODO: 实现真实的 JWT 验证逻辑
    // 目前简化为直接使用 token 作为 userId
    return token;
  }

  // 其次从 query 参数中获取
  const userId = c.req.query("userId");
  if (userId) {
    return userId;
  }

  // 最后从 header 中获取
  const userIdHeader = c.req.header("X-User-Id");
  if (userIdHeader) {
    return userIdHeader;
  }

  return null;
}

/**
 * 认证中间件
 * 验证用户身份，将 userId 添加到上下文中
 */
export const auth = async (c: Context, next: Next) => {
  const userId = extractUserId(c);

  if (!userId) {
    logger.warn("Unauthorized request", {
      path: c.req.path,
      method: c.req.method,
    });
    throw new AppError("Unauthorized: User ID is required", ErrorCode.UNAUTHORIZED, 401);
  }

  // 将 userId 添加到上下文中
  c.set("userId", userId);

  logger.debug("User authenticated", { userId, path: c.req.path });

  await next();
};

/**
 * 可选认证中间件
 * 如果提供了 userId 则验证，否则继续
 */
export const optionalAuth = async (c: Context, next: Next) => {
  const userId = extractUserId(c);

  if (userId) {
    c.set("userId", userId);
    logger.debug("User optionally authenticated", { userId, path: c.req.path });
  }

  await next();
};

/**
 * 验证用户权限
 */
export const requirePermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");

    if (!userId) {
      throw new AppError("Unauthorized", ErrorCode.UNAUTHORIZED, 401);
    }

    // TODO: 实现真实的权限验证逻辑
    // 目前简化为所有用户都有所有权限
    logger.debug("Permission check passed", { userId, permission });

    await next();
  };
};

export default auth;
