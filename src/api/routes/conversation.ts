/**
 * Conversation Routes
 * 对话相关 API 路由
 */

import { Hono } from "hono";
import { z } from "zod";
import { ConversationService } from "@/application/services/ConversationService.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

const conversationRoutes = new Hono();

const conversationService = new ConversationService();

// 请求体验证 schema
const createConversationSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

// POST /api/conversations - 创建新对话
conversationRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createConversationSchema.parse(body);

    const session = await conversationService.createConversation(validatedData);

    return c.json(
      {
        success: true,
        data: {
          id: session.getId(),
          userId: session.getUserId(),
          title: session.getTitle(),
          state: session.getState(),
          messageCount: session.getMessageCount(),
          createdAt: session.getCreatedAt(),
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.INVALID_INPUT,
            message: "Invalid request body",
            details: error.issues,
          },
        },
        400,
      );
    }

    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.statusCode as any,
      );
    }

    logger.error("Error creating conversation", error);
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      },
      500,
    );
  }
});

// POST /api/conversations/:sessionId/messages - 发送消息
conversationRoutes.post("/:sessionId/messages", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const body = await c.req.json();
    const validatedData = sendMessageSchema.parse(body);

    const userId = c.req.header("X-User-Id") || "default-user";

    const response = await conversationService.sendMessage(
      sessionId,
      validatedData.content,
      userId,
      validatedData.metadata,
    );

    return c.json({
      success: true,
      data: response,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.INVALID_INPUT,
            message: "Invalid request body",
            details: error.issues,
          },
        },
        400,
      );
    }

    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.statusCode as any,
      );
    }

    logger.error("Error sending message", error);
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      },
      500,
    );
  }
});

// GET /api/conversations/:sessionId/history - 获取对话历史
conversationRoutes.get("/:sessionId/history", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const messages = conversationService.getConversationHistory(sessionId);

    return c.json({
      success: true,
      data: messages.map((msg) => msg.toJSON()),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.statusCode as any,
      );
    }

    logger.error("Error getting conversation history", error);
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      },
      500,
    );
  }
});

// GET /api/conversations/:sessionId/summary - 获取对话摘要
conversationRoutes.get("/:sessionId/summary", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const summary = conversationService.getConversationSummary(sessionId);

    return c.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.statusCode as any,
      );
    }

    logger.error("Error getting conversation summary", error);
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      },
      500,
    );
  }
});

// POST /api/conversations/:sessionId/pause - 暂停对话
conversationRoutes.post("/:sessionId/pause", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const session = conversationService.pauseConversation(sessionId);

    return c.json({
      success: true,
      data: {
        id: session.getId(),
        state: session.getState(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.statusCode as any,
      );
    }

    logger.error("Error pausing conversation", error);
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      },
      500,
    );
  }
});

// POST /api/conversations/:sessionId/resume - 恢复对话
conversationRoutes.post("/:sessionId/resume", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const session = conversationService.resumeConversation(sessionId);

    return c.json({
      success: true,
      data: {
        id: session.getId(),
        state: session.getState(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.statusCode as any,
      );
    }

    logger.error("Error resuming conversation", error);
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      },
      500,
    );
  }
});

// DELETE /api/conversations/:sessionId - 删除对话
conversationRoutes.delete("/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const deleted = conversationService.deleteConversation(sessionId);

    if (!deleted) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Conversation not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting conversation", error);
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Internal server error",
        },
      },
      500,
    );
  }
});

export default conversationRoutes;
