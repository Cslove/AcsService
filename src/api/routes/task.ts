/**
 * Task Routes
 * 任务相关 API 路由
 */

import { Hono } from "hono";
import { z } from "zod";
import { TaskService, TaskType, TaskPriority } from "@/application/services/TaskService.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

const taskRoutes = new Hono();

const taskService = new TaskService();

// 请求体验证 schema
const createTaskSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(TaskType),
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.nativeEnum(TaskPriority),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
  scheduledAt: z.string().optional(),
  timeout: z.number().optional(),
  maxRetries: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// POST /api/tasks - 创建任务
taskRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createTaskSchema.parse(body);

    const taskConfig = {
      ...validatedData,
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined,
    };

    const task = taskService.createTask(taskConfig);

    return c.json(
      {
        success: true,
        data: task,
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

    logger.error("Error creating task", error);
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

// POST /api/tasks/:taskId/execute - 执行任务
taskRoutes.post("/:taskId/execute", async (c) => {
  try {
    const taskId = c.req.param("taskId");

    // 简单的执行器函数，实际应用中应该从注册的执行器中获取
    const executor = async (payload: any) => {
      return { executed: true, payload };
    };

    const result = await taskService.executeTask(taskId, executor);

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

    logger.error("Error executing task", error);
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

// GET /api/tasks - 获取任务列表（支持筛选）
taskRoutes.get("/", async (c) => {
  try {
    const status = c.req.query("status");
    const userId = c.req.query("userId");
    const sessionId = c.req.query("sessionId");
    const type = c.req.query("type");

    let tasks = taskService.getAllTasks();

    if (status) {
      tasks = taskService.getTasksByStatus(status as any);
    }

    if (userId) {
      tasks = taskService.getTasksByUserId(userId);
    }

    if (sessionId) {
      tasks = taskService.getTasksBySessionId(sessionId);
    }

    if (type) {
      tasks = taskService.getTasksByType(type as any);
    }

    return c.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    logger.error("Error getting tasks", error);
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

// GET /api/tasks/:taskId - 获取任务详情
taskRoutes.get("/:taskId", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const task = taskService.getTask(taskId);

    if (!task) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Task not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error("Error getting task", error);
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

// POST /api/tasks/:taskId/cancel - 取消任务
taskRoutes.post("/:taskId/cancel", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const cancelled = taskService.cancelTask(taskId);

    if (!cancelled) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Task not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      message: "Task cancelled successfully",
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

    logger.error("Error cancelling task", error);
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

// DELETE /api/tasks/:taskId - 删除任务
taskRoutes.delete("/:taskId", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const deleted = taskService.deleteTask(taskId);

    if (!deleted) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Task not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      message: "Task deleted successfully",
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

    logger.error("Error deleting task", error);
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

export default taskRoutes;
