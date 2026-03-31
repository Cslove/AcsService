/**
 * SSE Routes
 * Server-Sent Events 实时推送路由
 */

import { Hono } from "hono";
import { z } from "zod";
import { sseController } from "@/api/controllers/SSEController.js";
import { logger } from "@/shared/utils/logger.js";

const sseRoutes = new Hono();

// 请求参数验证 schema
const sseQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  sessionId: z.string().optional(),
});

/**
 * GET /api/sse - 建立 SSE 连接
 *
 * 查询参数：
 * - userId: 用户 ID（必需）
 * - sessionId: 会话 ID（可选，用于过滤特定会话的事件）
 */
sseRoutes.get("/", async (c) => {
  try {
    // 验证查询参数
    const query = c.req.query();
    const validatedData = sseQuerySchema.parse(query);

    const { userId, sessionId } = validatedData;

    // 创建 SSE 流
    const stream = new ReadableStream({
      start: async (controller) => {
        // 创建模拟的写入接口
        const streamWriter = {
          write: (chunk: string | Uint8Array) => {
            try {
              controller.enqueue(
                typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk,
              );
            } catch (error) {
              logger.error("Error writing SSE chunk", { error });
              controller.error(error);
            }
          },
        };

        // 订阅 SSE 连接
        const connectionId = sseController.subscribe(userId, sessionId, streamWriter);

        // 发送初始连接事件
        const connectedEvent = `event: connected\ndata: ${JSON.stringify({
          connectionId,
          message: "SSE connection established",
          timestamp: Date.now(),
        })}\n\n`;

        controller.enqueue(new TextEncoder().encode(connectedEvent));

        // 处理客户端断开连接
        c.req.raw.signal?.addEventListener("abort", () => {
          sseController.unsubscribe(connectionId);
          logger.info("SSE client disconnected", { connectionId, userId });
          controller.close();
        });
      },
    });

    // 返回 SSE 流式响应
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Invalid query parameters",
            details: error.issues,
          },
        },
        400,
      );
    }

    // 连接数超限错误
    if (error instanceof Error && error.message.includes("Maximum connections")) {
      return c.json(
        {
          success: false,
          error: {
            code: "CONNECTION_LIMIT_EXCEEDED",
            message: error.message,
          },
        },
        429,
      );
    }

    logger.error("Error establishing SSE connection", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to establish SSE connection",
        },
      },
      500,
    );
  }
});

/**
 * GET /api/sse/stats - 获取 SSE 连接统计信息
 */
sseRoutes.get("/stats", (c) => {
  const stats = sseController.getStats();

  return c.json({
    success: true,
    data: {
      totalConnections: stats.totalConnections,
      activeConnections: sseController.getActiveConnectionCount(),
      connectionsByUser: Object.fromEntries(stats.connectionsByUser),
      totalMessagesSent: stats.totalMessagesSent,
    },
  });
});

export default sseRoutes;
