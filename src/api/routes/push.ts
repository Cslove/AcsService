/**
 * Push Routes
 * 推送服务相关 API 路由
 */

import { Hono } from "hono";
import { z } from "zod";
import { PushService } from "@/application/services/PushService.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

const pushRoutes = new Hono();

const pushService = new PushService();

// 请求体验证 schema
const addTopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
  priority: z.number(),
  relevanceScore: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

const batchAddTopicsSchema = z.object({
  topics: z.array(addTopicSchema),
});

const filterTopicsSchema = z.object({
  topics: z.array(z.string()),
  filters: z.array(
    z.object({
      type: z.enum(["category", "tag", "keyword", "relevance", "custom"]),
      value: z.union([z.string(), z.array(z.string()), z.any()]),
      operator: z.enum(["include", "exclude", "equals", "contains", "greater", "less"]).optional(),
    }),
  ),
  channels: z.array(z.string()).optional(),
});

const pushTopicsToUserSchema = z.object({
  topics: z.array(z.string()),
  channels: z.array(z.string()).optional(),
  filters: z.array(
    z.object({
      type: z.enum(["category", "tag", "keyword", "relevance", "custom"]),
      value: z.union([z.string(), z.array(z.string()), z.any()]),
      operator: z.enum(["include", "exclude", "equals", "contains", "greater", "less"]).optional(),
    }),
  ),
});

// POST /api/push/topics - 添加话题
pushRoutes.post("/topics", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = addTopicSchema.parse(body);

    pushService.addTopic({
      ...validatedData,
      createdAt: new Date(),
    });

    return c.json(
      {
        success: true,
        message: "Topic added successfully",
        data: validatedData,
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

    logger.error("Error adding topic", error);
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

// POST /api/push/topics/batch - 批量添加话题
pushRoutes.post("/topics/batch", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = batchAddTopicsSchema.parse(body);

    const topicsWithTimestamp = validatedData.topics.map((topic) => ({
      ...topic,
      createdAt: new Date(),
    }));

    pushService.addTopics(topicsWithTimestamp);

    return c.json(
      {
        success: true,
        message: "Topics added successfully",
        data: {
          count: topicsWithTimestamp.length,
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

    logger.error("Error batch adding topics", error);
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

// POST /api/push/filter - 过滤话题
pushRoutes.post("/filter", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = filterTopicsSchema.parse(body);

    // 获取指定话题
    const topicObjects = validatedData.topics
      .map((topicId) => pushService.getTopic(topicId))
      .filter((topic): topic is NonNullable<typeof topic> => topic !== undefined);

    const filteredTopics = pushService.filterTopics(topicObjects, validatedData.filters);

    return c.json({
      success: true,
      data: filteredTopics,
      count: filteredTopics.length,
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

    logger.error("Error filtering topics", error);
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

// POST /api/push/users/:userId/topics - 推送话题到用户
pushRoutes.post("/users/:userId/topics", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const validatedData = pushTopicsToUserSchema.parse(body);

    // 创建推送配置
    pushService.createPushConfig({
      userId,
      topics: validatedData.topics,
      channels: validatedData.channels || pushService.getConfig().defaultChannels,
      filters: validatedData.filters,
    });

    const results = await pushService.pushTopicsToUser(userId);

    return c.json({
      success: true,
      data: results,
      count: results.length,
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

    logger.error("Error pushing topics to user", error);
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

// GET /api/push/topics/trending - 获取热门话题
pushRoutes.get("/topics/trending", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "10", 10);
    const topics = pushService.getTrendingTopics(limit);

    return c.json({
      success: true,
      data: topics,
      count: topics.length,
    });
  } catch (error) {
    logger.error("Error getting trending topics", error);
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

// GET /api/push/topics/high-relevance - 获取高相关性话题
pushRoutes.get("/topics/high-relevance", async (c) => {
  try {
    const minScore = parseFloat(c.req.query("minScore") || "0.7");
    const topics = pushService.getHighRelevanceTopics(minScore);

    return c.json({
      success: true,
      data: topics,
      count: topics.length,
    });
  } catch (error) {
    logger.error("Error getting high relevance topics", error);
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

export default pushRoutes;
