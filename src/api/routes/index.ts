/**
 * API 路由入口
 * 集成所有 API 路由模块
 */

import { Hono } from "hono";
import { logger } from "@/shared/utils/logger.js";

const apiRoutes = new Hono();

// API 根路径
apiRoutes.get("/", (c) => {
  return c.json({
    version: "1.0.0",
    endpoints: {
      conversations: "/api/conversations",
      tasks: "/api/tasks",
      content: "/api/content",
      push: "/api/push",
      preferences: "/api/preferences",
      agents: "/api/agents",
      skills: "/api/skills",
    },
  });
});

// API 健康检查
apiRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// TODO: 在后续步骤中集成具体的路由模块
// import conversationRoutes from "./conversation.js";
// import taskRoutes from "./task.js";
// import contentRoutes from "./content.js";
// import pushRoutes from "./push.js";
// import preferenceRoutes from "./preference.js";
// import agentRoutes from "./agent.js";
//
// apiRoutes.route("/conversations", conversationRoutes);
// apiRoutes.route("/tasks", taskRoutes);
// apiRoutes.route("/content", contentRoutes);
// apiRoutes.route("/push", pushRoutes);
// apiRoutes.route("/preferences", preferenceRoutes);
// apiRoutes.route("/agents", agentRoutes);

logger.info("API routes initialized");

export default apiRoutes;
