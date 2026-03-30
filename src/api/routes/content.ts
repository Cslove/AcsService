/**
 * Content Routes
 * 内容生成相关 API 路由
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  ContentGenerationService,
  PlatformType,
  ContentType,
} from "@/application/services/ContentGenerationService.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

const contentRoutes = new Hono();

const contentService = new ContentGenerationService();

// 请求体验证 schema
const generateContentSchema = z.object({
  platform: z.nativeEnum(PlatformType),
  content: z.string().min(1),
  format: z.nativeEnum(ContentType).optional(),
  style: z.string().optional(),
  tone: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const batchGenerateSchema = z.object({
  configs: z.array(generateContentSchema),
});

const transformContentSchema = z.object({
  content: z.string().min(1),
  fromFormat: z.nativeEnum(ContentType),
  toFormat: z.nativeEnum(ContentType),
  platform: z.nativeEnum(PlatformType),
});

const createTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  platform: z.nativeEnum(PlatformType),
  content: z.string().min(1),
  variables: z.array(z.string()),
});

// POST /api/content/generate - 生成内容
contentRoutes.post("/generate", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = generateContentSchema.parse(body);

    const result = await contentService.generateContent(validatedData);

    return c.json({
      success: true,
      data: result,
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

    logger.error("Error generating content", error);
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

// POST /api/content/batch-generate - 批量生成内容
contentRoutes.post("/batch-generate", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = batchGenerateSchema.parse(body);

    const results = await contentService.generateContents(validatedData.configs);

    return c.json({
      success: true,
      data: Array.from(results.entries()).map(([key, value]) => ({
        key,
        result: value,
      })),
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

    logger.error("Error batch generating content", error);
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

// POST /api/content/transform - 转换内容格式
contentRoutes.post("/transform", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = transformContentSchema.parse(body);

    const platformConfig = contentService.getPlatform(validatedData.platform);
    if (!platformConfig) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Platform not found",
          },
        },
        404,
      );
    }

    // 调用私有方法需要通过公共接口
    const result = await contentService.generateContent({
      platform: validatedData.platform,
      content: validatedData.content,
      format: validatedData.toFormat,
    });

    return c.json({
      success: true,
      data: result,
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

    logger.error("Error transforming content", error);
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

// POST /api/content/templates - 创建模板
contentRoutes.post("/templates", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createTemplateSchema.parse(body);

    contentService.createTemplate(validatedData);

    return c.json(
      {
        success: true,
        message: "Template created successfully",
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

    logger.error("Error creating template", error);
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

// POST /api/content/templates/:templateId/generate - 从模板生成内容
contentRoutes.post("/templates/:templateId/generate", async (c) => {
  try {
    const templateId = c.req.param("templateId");
    const body = await c.req.json();

    const result = await contentService.generateFromTemplate(templateId, body.variables || {});

    return c.json({
      success: true,
      data: result,
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

    logger.error("Error generating from template", error);
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

export default contentRoutes;
