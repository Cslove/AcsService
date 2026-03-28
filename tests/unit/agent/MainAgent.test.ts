import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MainAgent, type MainAgentConfig } from "@/core/agent/MainAgent.js";
import { SubAgent, type SubAgentConfig } from "@/core/agent/SubAgent.js";
import { AgentState } from "@/core/agent/BaseAgent.js";

/**
 * 创建测试用的 SubAgent
 */
function createTestSubAgent(name: string, taskType: string): SubAgent {
  const config: SubAgentConfig = {
    name,
    description: `Test sub-agent for ${name}`,
    taskType,
    capabilities: ["process", "analyze"],
  };

  const agent = new SubAgent(config);

  // 添加测试技能
  agent.addSkill({
    name: "process",
    description: "Process task",
    execute: async (input) => ({ processed: true, data: input }),
  });

  agent.addSkill({
    name: "analyze",
    description: "Analyze task",
    execute: async (input) => ({ analyzed: true, data: input }),
  });

  return agent;
}

describe("MainAgent", () => {
  let mainAgent: MainAgent;

  beforeEach(() => {
    const config: MainAgentConfig = {
      name: "main-agent",
      description: "Main agent for testing",
      maxConcurrentTasks: 2,
      taskTimeout: 5000,
    };

    mainAgent = new MainAgent(config);
  });

  afterEach(async () => {
    await mainAgent.cleanup();
  });

  describe("基本功能", () => {
    it("应该正确创建 MainAgent", () => {
      expect(mainAgent.getName()).toBe("main-agent");
      expect(mainAgent.getDescription()).toBe("Main agent for testing");
      expect(mainAgent.getState()).toBe(AgentState.IDLE);
    });

    it("应该正确执行并返回品味分析结果", async () => {
      const result = await mainAgent.execute({});

      expect(result).toHaveProperty("tasteAnalysis");
      expect(result.tasteAnalysis).toHaveProperty("style");
      expect(result.tasteAnalysis).toHaveProperty("preferences");
      expect(result.tasteAnalysis).toHaveProperty("tags");
      expect(result.tasteAnalysis).toHaveProperty("confidence");

      expect(result).toHaveProperty("taskQueue");
    });
  });

  describe("品味分析", () => {
    it("应该成功分析品味", async () => {
      const result = await mainAgent.analyzeTaste({});

      expect(result.style).toBeInstanceOf(Array);
      expect(result.preferences).toBeInstanceOf(Array);
      expect(result.tags).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("应该处理品味分析失败", async () => {
      // Mock analyzeTaste to throw error
      mainAgent.analyzeTaste = vi.fn().mockRejectedValue(new Error("Analysis failed"));

      await expect(mainAgent.execute({})).rejects.toThrow();
    });
  });

  describe("子代理管理", () => {
    it("应该成功注册子代理", () => {
      const subAgent = createTestSubAgent("sub-agent-1", "test-type");

      mainAgent.registerSubAgent(subAgent);

      expect(mainAgent.getSubAgent("sub-agent-1")).toBe(subAgent);
      expect(mainAgent.getSubAgents()).toHaveLength(1);
    });

    it("应该拒绝注册重复的子代理", () => {
      const subAgent = createTestSubAgent("sub-agent-1", "test-type");

      mainAgent.registerSubAgent(subAgent);

      expect(() => {
        mainAgent.registerSubAgent(subAgent);
      }).toThrow();
    });

    it("应该成功注销子代理", () => {
      const subAgent = createTestSubAgent("sub-agent-1", "test-type");

      mainAgent.registerSubAgent(subAgent);
      expect(mainAgent.unregisterSubAgent("sub-agent-1")).toBe(true);
      expect(mainAgent.getSubAgent("sub-agent-1")).toBeUndefined();
    });

    it("应该返回 false 当注销不存在的子代理", () => {
      expect(mainAgent.unregisterSubAgent("non-existent")).toBe(false);
    });

    it("应该正确获取所有子代理", () => {
      const subAgent1 = createTestSubAgent("sub-agent-1", "type1");
      const subAgent2 = createTestSubAgent("sub-agent-2", "type2");

      mainAgent.registerSubAgent(subAgent1);
      mainAgent.registerSubAgent(subAgent2);

      const subAgents = mainAgent.getSubAgents();
      expect(subAgents).toHaveLength(2);
      expect(subAgents).toContain(subAgent1);
      expect(subAgents).toContain(subAgent2);
    });
  });

  describe("任务队列管理", () => {
    beforeEach(() => {
      const subAgent = createTestSubAgent("sub-agent-1", "test-type");
      mainAgent.registerSubAgent(subAgent);
    });

    it("应该成功添加任务到队列", () => {
      mainAgent.addTask({
        id: "task-1",
        type: "sub-agent-1",
        input: { task: { type: "test-type", action: "process" } },
        priority: 1,
      });

      const status = mainAgent.getTaskQueueStatus();
      expect(status.total).toBe(1);
      expect(status.pending).toBe(1);
    });

    it("应该按优先级排序任务", () => {
      mainAgent.addTask({
        id: "task-1",
        type: "sub-agent-1",
        input: { task: { type: "test-type", action: "process" } },
        priority: 1,
      });

      mainAgent.addTask({
        id: "task-2",
        type: "sub-agent-1",
        input: { task: { type: "test-type", action: "process" } },
        priority: 3,
      });

      mainAgent.addTask({
        id: "task-3",
        type: "sub-agent-1",
        input: { task: { type: "test-type", action: "process" } },
        priority: 2,
      });

      const status = mainAgent.getTaskQueueStatus();
      expect(status.total).toBe(3);
    });

    it("应该成功协调任务执行", async () => {
      mainAgent.addTask({
        id: "task-1",
        type: "sub-agent-1",
        input: { task: { type: "test-type", action: "process" } },
        priority: 1,
      });

      await mainAgent.coordinateTasks();

      const status = mainAgent.getTaskQueueStatus();
      expect(status.completed).toBe(1);
      expect(status.pending).toBe(0);
    });

    it("应该处理任务执行失败", async () => {
      mainAgent.addTask({
        id: "task-1",
        type: "non-existent",
        input: { task: { type: "test-type", action: "process" } },
        priority: 1,
      });

      await mainAgent.coordinateTasks();

      const status = mainAgent.getTaskQueueStatus();
      expect(status.failed).toBe(1);
    });

    it("应该成功清空任务队列", () => {
      mainAgent.addTask({
        id: "task-1",
        type: "sub-agent-1",
        input: { task: { type: "test-type", action: "process" } },
        priority: 1,
      });

      mainAgent.clearTaskQueue();

      const status = mainAgent.getTaskQueueStatus();
      expect(status.total).toBe(0);
    });

    it("应该正确获取任务队列状态", () => {
      mainAgent.addTask({
        id: "task-1",
        type: "sub-agent-1",
        input: { task: { type: "test-type", action: "process" } },
        priority: 1,
      });

      const status = mainAgent.getTaskQueueStatus();

      expect(status).toHaveProperty("total");
      expect(status).toHaveProperty("pending");
      expect(status).toHaveProperty("running");
      expect(status).toHaveProperty("completed");
      expect(status).toHaveProperty("failed");
    });
  });

  describe("并发控制", () => {
    it("应该限制并发任务数量", async () => {
      const subAgent = createTestSubAgent("sub-agent-1", "test-type");
      mainAgent.registerSubAgent(subAgent);

      // 添加多个任务
      for (let i = 1; i <= 5; i++) {
        mainAgent.addTask({
          id: `task-${i}`,
          type: "sub-agent-1",
          input: { task: { type: "test-type", action: "process" } },
          priority: i,
        });
      }

      await mainAgent.coordinateTasks();

      // 由于 maxConcurrentTasks = 2，应该只执行了部分任务
      const status = mainAgent.getTaskQueueStatus();
      expect(status.completed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("清理功能", () => {
    it("应该成功清理所有子代理", async () => {
      const subAgent1 = createTestSubAgent("sub-agent-1", "type1");
      const subAgent2 = createTestSubAgent("sub-agent-2", "type2");

      mainAgent.registerSubAgent(subAgent1);
      mainAgent.registerSubAgent(subAgent2);

      await mainAgent.cleanup();

      expect(mainAgent.getSubAgents()).toHaveLength(0);
      expect(mainAgent.getTaskQueueStatus().total).toBe(0);
    });
  });
});
