import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentFactory, AgentType } from "@/core/agent/AgentFactory.js";
import { MainAgent, type MainAgentConfig } from "@/core/agent/MainAgent.js";
import { SubAgent, type SubAgentConfig } from "@/core/agent/SubAgent.js";

describe("AgentFactory", () => {
  beforeEach(() => {
    // 每个测试前重置工厂状态
    AgentFactory.reset();
  });

  afterEach(async () => {
    // 每个测试后清理所有 agent
    await AgentFactory.clearAll();
  });

  describe("创建 Agent", () => {
    it("应该成功创建 MainAgent", () => {
      const config: MainAgentConfig = {
        name: "main-agent",
        description: "Test main agent",
        maxConcurrentTasks: 3,
      };

      const agent = AgentFactory.createMainAgent(config);

      expect(agent).toBeInstanceOf(MainAgent);
      expect(agent.getName()).toBe("main-agent");
      expect(AgentFactory.hasAgent("main-agent")).toBe(true);
    });

    it("应该成功创建 SubAgent", () => {
      const config: SubAgentConfig = {
        name: "sub-agent",
        description: "Test sub agent",
        taskType: "test-type",
        capabilities: ["process"],
      };

      const agent = AgentFactory.createSubAgent(config);

      expect(agent).toBeInstanceOf(SubAgent);
      expect(agent.getName()).toBe("sub-agent");
      expect(AgentFactory.hasAgent("sub-agent")).toBe(true);
    });

    it("应该拒绝创建重复名称的 Agent", () => {
      const config: MainAgentConfig = {
        name: "main-agent",
        description: "Test main agent",
      };

      AgentFactory.createMainAgent(config);

      expect(() => {
        AgentFactory.createMainAgent(config);
      }).toThrow();
    });

    it("应该拒绝创建未知类型的 Agent", () => {
      const config: any = {
        type: "unknown-type",
        config: {
          name: "test-agent",
        },
      };

      expect(() => {
        AgentFactory.createAgent(config);
      }).toThrow();
    });

    it("应该批量创建 Agent", () => {
      const configs = [
        {
          type: AgentType.MAIN,
          config: {
            name: "main-1",
            description: "Main agent 1",
          },
        },
        {
          type: AgentType.SUB,
          config: {
            name: "sub-1",
            taskType: "type1",
            capabilities: [],
          },
        },
        {
          type: AgentType.SUB,
          config: {
            name: "sub-2",
            taskType: "type2",
            capabilities: [],
          },
        },
      ];

      const agents = AgentFactory.createAgents(configs);

      expect(agents).toHaveLength(3);
      expect(AgentFactory.getAllAgents()).toHaveLength(3);
    });
  });

  describe("获取 Agent", () => {
    it("应该成功获取已注册的 Agent", () => {
      const config: MainAgentConfig = {
        name: "main-agent",
        description: "Test main agent",
      };

      const createdAgent = AgentFactory.createMainAgent(config);
      const retrievedAgent = AgentFactory.getAgent("main-agent");

      expect(retrievedAgent).toBe(createdAgent);
    });

    it("应该返回 undefined 当获取不存在的 Agent", () => {
      const agent = AgentFactory.getAgent("non-existent");
      expect(agent).toBeUndefined();
    });

    it("应该成功获取所有 Agent", () => {
      AgentFactory.createMainAgent({
        name: "main-1",
        description: "Main 1",
      });

      AgentFactory.createSubAgent({
        name: "sub-1",
        taskType: "type1",
        capabilities: [],
      });

      const agents = AgentFactory.getAllAgents();

      expect(agents).toHaveLength(2);
      expect(agents.map((a) => a.getName())).toEqual(["main-1", "sub-1"]);
    });
  });

  describe("检查 Agent", () => {
    it("应该正确检查 Agent 是否存在", () => {
      expect(AgentFactory.hasAgent("non-existent")).toBe(false);

      AgentFactory.createMainAgent({
        name: "main-agent",
        description: "Test main agent",
      });

      expect(AgentFactory.hasAgent("main-agent")).toBe(true);
    });
  });

  describe("移除 Agent", () => {
    it("应该成功移除 Agent", async () => {
      const config: MainAgentConfig = {
        name: "main-agent",
        description: "Test main agent",
      };

      AgentFactory.createMainAgent(config);

      const removed = await AgentFactory.removeAgent("main-agent");

      expect(removed).toBe(true);
      expect(AgentFactory.hasAgent("main-agent")).toBe(false);
    });

    it("应该返回 false 当移除不存在的 Agent", async () => {
      const removed = await AgentFactory.removeAgent("non-existent");
      expect(removed).toBe(false);
    });

    it("应该清理 Agent 资源", async () => {
      const config: MainAgentConfig = {
        name: "main-agent",
        description: "Test main agent",
      };

      const agent = AgentFactory.createMainAgent(config);
      agent.setMetadata("key", "value");

      await AgentFactory.removeAgent("main-agent");

      expect(AgentFactory.hasAgent("main-agent")).toBe(false);
    });
  });

  describe("清空所有 Agent", () => {
    it("应该成功清空所有 Agent", async () => {
      AgentFactory.createMainAgent({
        name: "main-1",
        description: "Main 1",
      });

      AgentFactory.createSubAgent({
        name: "sub-1",
        taskType: "type1",
        capabilities: [],
      });

      AgentFactory.createSubAgent({
        name: "sub-2",
        taskType: "type2",
        capabilities: [],
      });

      expect(AgentFactory.getAllAgents()).toHaveLength(3);

      await AgentFactory.clearAll();

      expect(AgentFactory.getAllAgents()).toHaveLength(0);
    });
  });

  describe("统计信息", () => {
    it("应该正确返回统计信息", () => {
      AgentFactory.createMainAgent({
        name: "main-1",
        description: "Main 1",
      });

      AgentFactory.createSubAgent({
        name: "sub-1",
        taskType: "type1",
        capabilities: [],
      });

      AgentFactory.createSubAgent({
        name: "sub-2",
        taskType: "type2",
        capabilities: [],
      });

      const stats = AgentFactory.getStats();

      expect(stats.total).toBe(3);
      expect(stats.mainAgents).toBe(1);
      expect(stats.subAgents).toBe(2);
      expect(stats.byName).toEqual({
        "main-1": AgentType.MAIN,
        "sub-1": AgentType.SUB,
        "sub-2": AgentType.SUB,
      });
    });

    it("应该返回空统计信息当没有 Agent", () => {
      const stats = AgentFactory.getStats();

      expect(stats.total).toBe(0);
      expect(stats.mainAgents).toBe(0);
      expect(stats.subAgents).toBe(0);
      expect(stats.byName).toEqual({});
    });
  });

  describe("重置功能", () => {
    it("应该成功重置工厂状态", () => {
      AgentFactory.createMainAgent({
        name: "main-agent",
        description: "Test main agent",
      });

      expect(AgentFactory.getAllAgents()).toHaveLength(1);

      AgentFactory.reset();

      expect(AgentFactory.getAllAgents()).toHaveLength(0);
    });
  });
});
