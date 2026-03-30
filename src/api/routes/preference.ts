/**
 * Preference Routes
 * 用户偏好相关 API 路由
 */

import { Hono } from "hono";
import { z } from "zod";
import { PreferenceManager } from "@/core/preference/PreferenceManager.js";
import { Message } from "@/core/message/Message.js";
import { PreferenceType, PreferenceStrength } from "@/core/preference/Preference.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

const preferenceRoutes = new Hono();

const preferenceManager = new PreferenceManager();

// 请求体验证 schema
const updatePreferenceSchema = z.object({
  interests: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  tone: z.string().optional(),
  style: z.string().optional(),
  frequency: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const analyzeMessagesSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
      metadata: z.record(z.string(), z.any()).optional(),
    }),
  ),
});

// GET /api/preferences/:userId - 获取用户偏好
preferenceRoutes.get("/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const preference = await preferenceManager.getPreference(userId);

    return c.json({
      success: true,
      data: preference.toJSON(),
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

    logger.error("Error getting preference", error);
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

// PUT /api/preferences/:userId - 更新用户偏好
preferenceRoutes.put("/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const validatedData = updatePreferenceSchema.parse(body);

    const preference = await preferenceManager.getPreference(userId);

    // 使用标签系统更新偏好
    if (validatedData.interests) {
      // 清除现有的兴趣标签
      preference.removeTagsByType(PreferenceType.CONTENT);
      // 添加新的兴趣标签
      for (const interest of validatedData.interests) {
        preference.addTag({
          name: interest,
          type: PreferenceType.CONTENT,
          value: interest,
          strength: PreferenceStrength.NORMAL,
          confidence: 0.8,
        });
      }
    }

    if (validatedData.topics) {
      // 清除现有的话题标签
      preference.removeTagsByType(PreferenceType.CUSTOM);
      // 添加新的话题标签
      for (const topic of validatedData.topics) {
        preference.addTag({
          name: topic,
          type: PreferenceType.CUSTOM,
          value: topic,
          strength: PreferenceStrength.NORMAL,
          confidence: 0.8,
        });
      }
    }

    if (validatedData.tone) {
      // 清除现有的语气标签
      preference.removeTagsByType(PreferenceType.TONE);
      // 添加新的语气标签
      preference.addTag({
        name: validatedData.tone,
        type: PreferenceType.TONE,
        value: validatedData.tone,
        strength: PreferenceStrength.NORMAL,
        confidence: 0.9,
      });
    }

    if (validatedData.style) {
      // 清除现有的风格标签
      preference.removeTagsByType(PreferenceType.STYLE);
      // 添加新的风格标签
      preference.addTag({
        name: validatedData.style,
        type: PreferenceType.STYLE,
        value: validatedData.style,
        strength: PreferenceStrength.NORMAL,
        confidence: 0.9,
      });
    }

    if (validatedData.frequency) {
      // 使用元数据存储频率
      preference.updateMetadata("frequency", validatedData.frequency);
    }

    if (validatedData.metadata) {
      // 合并元数据
      const currentMetadata = preference.getMetadata();
      preference.setMetadata({
        ...currentMetadata,
        ...validatedData.metadata,
      });
    }

    await preferenceManager.savePreference(userId, preference);

    return c.json({
      success: true,
      data: preference.toJSON(),
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

    logger.error("Error updating preference", error);
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

// POST /api/preferences/:userId/analyze - 从消息分析并更新偏好
preferenceRoutes.post("/:userId/analyze", async (c) => {
  try {
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const validatedData = analyzeMessagesSchema.parse(body);

    const messages = validatedData.messages.map((msg) => {
      const message = Message.createUserMessage(msg.id, msg.content, userId);
      if (msg.metadata) {
        message.setMetadata(msg.metadata);
      }
      return message;
    });

    const updatedPreference = await preferenceManager.updateFromMessages(userId, messages);

    return c.json({
      success: true,
      data: updatedPreference.toJSON(),
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

    logger.error("Error analyzing messages", error);
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

// DELETE /api/preferences/:userId - 删除用户偏好
preferenceRoutes.delete("/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    await preferenceManager.deletePreference(userId);

    return c.json({
      success: true,
      message: "Preference deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting preference", error);
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

export default preferenceRoutes;
