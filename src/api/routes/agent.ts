/**
 * Agent Routes
 * Agent 和技能相关 API 路由
 */

import { Hono } from "hono";
import { z } from "zod";
import { AgentFactory, AgentType } from "@/core/agent/AgentFactory.js";
import { MainAgent } from "@/core/agent/MainAgent.js";
import { SkillRegistry } from "@/core/skill/SkillRegistry.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { logger } from "@/shared/utils/logger.js";

const agentRoutes = new Hono();

const skillRegistry = SkillRegistry.getInstance();

// 请求体验证 schema
const createAgentSchema = z.object({
  type: z.nativeEnum(AgentType),
  name: z.string().min(1),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

const registerSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string(),
  config: z.record(z.string(), z.any()).optional(),
});

// GET /api/agents - 获取所有 Agent
agentRoutes.get("/", async (c) => {
  try {
    const agents = AgentFactory.getAllAgents();

    return c.json({
      success: true,
      data: agents,
      count: agents.length,
    });
  } catch (error) {
    logger.error("Error getting agents", error);
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

// GET /api/agents/stats - 获取 Agent 统计（必须在 /:agentName 之前定义）
agentRoutes.get("/stats", async (c) => {
  try {
    const stats = AgentFactory.getStats();

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error getting agent stats", error);
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

// GET /api/skills - 获取所有技能（必须在 /:agentName 之前定义）
agentRoutes.get("/skills", async (c) => {
  try {
    const skills = skillRegistry.getAll();

    return c.json({
      success: true,
      data: skills.map((skill) => ({
        id: skill.getId(),
        name: skill.getName(),
        description: skill.getDescription(),
        type: skill.getType(),
      })),
      count: skills.length,
    });
  } catch (error) {
    logger.error("Error getting skills", error);
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

// GET /api/agents/:agentName - 获取指定 Agent
agentRoutes.get("/:agentName", async (c) => {
  try {
    const agentName = c.req.param("agentName");
    const agent = AgentFactory.getAgent(agentName);

    if (!agent) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Agent not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        name: agent.getName(),
        description: agent.getDescription(),
        type: agent instanceof MainAgent ? AgentType.MAIN : AgentType.SUB,
      },
    });
  } catch (error) {
    logger.error("Error getting agent", error);
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

// POST /api/agents - 创建 Agent
agentRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createAgentSchema.parse(body);

    const agent = AgentFactory.createAgent({
      type: validatedData.type,
      config: {
        name: validatedData.name,
        description: validatedData.description,
        ...validatedData.config,
      },
    });

    return c.json(
      {
        success: true,
        data: {
          name: agent.getName(),
          description: agent.getDescription(),
          type: agent instanceof MainAgent ? AgentType.MAIN : AgentType.SUB,
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

    logger.error("Error creating agent", error);
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

// DELETE /api/agents/:agentName - 删除 Agent
agentRoutes.delete("/:agentName", async (c) => {
  try {
    const agentName = c.req.param("agentName");
    const removed = AgentFactory.removeAgent(agentName);

    if (!removed) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Agent not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      message: "Agent removed successfully",
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

    logger.error("Error removing agent", error);
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

// GET /api/skills - 获取所有技能（必须在 /:agentName 之前定义）
agentRoutes.get("/skills", async (c) => {
  try {
    const skills = skillRegistry.getAll();

    return c.json({
      success: true,
      data: skills.map((skill) => ({
        id: skill.getId(),
        name: skill.getName(),
        description: skill.getDescription(),
        type: skill.getType(),
      })),
      count: skills.length,
    });
  } catch (error) {
    logger.error("Error getting skills", error);
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

// GET /api/skills/:skillId - 获取指定技能
agentRoutes.get("/skills/:skillId", async (c) => {
  try {
    const skillId = c.req.param("skillId");
    const skill = skillRegistry.get(skillId);

    if (!skill) {
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Skill not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        id: skill.getId(),
        name: skill.getName(),
        description: skill.getDescription(),
        type: skill.getType(),
      },
    });
  } catch (error) {
    logger.error("Error getting skill", error);
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

// POST /api/skills - 注册技能
agentRoutes.post("/skills", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = registerSkillSchema.parse(body);

    // 创建一个简单的技能对象用于注册
    const skill = {
      getId: () => validatedData.id,
      getName: () => validatedData.name,
      getDescription: () => validatedData.description || "",
      getType: () => validatedData.type,
      execute: async () => ({ success: true }),
      cleanup: () => {},
    };

    skillRegistry.register(skill as any);

    return c.json(
      {
        success: true,
        message: "Skill registered successfully",
        data: {
          id: validatedData.id,
          name: validatedData.name,
          type: validatedData.type,
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

    logger.error("Error registering skill", error);
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

// DELETE /api/skills/:skillId - 注销技能
agentRoutes.delete("/skills/:skillId", async (c) => {
  try {
    const skillId = c.req.param("skillId");
    skillRegistry.unregister(skillId);

    return c.json({
      success: true,
      message: "Skill unregistered successfully",
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

    logger.error("Error unregistering skill", error);
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

export default agentRoutes;
