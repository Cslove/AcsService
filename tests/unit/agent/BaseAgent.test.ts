import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BaseAgent, AgentState, type Skill } from "@/core/agent/BaseAgent.js";
import { AppError } from "@/shared/utils/errorHandler.js";

/**
 * 测试用的具体 Agent 实现
 */
class TestAgent extends BaseAgent {
  private executeResult: any;

  constructor(config: any, executeResult: any = "success") {
    super(config);
    this.executeResult = executeResult;
  }

  async execute(input: any): Promise<any> {
    this.context.state = AgentState.RUNNING;
    this.context.lastExecutedAt = new Date();
    this.context.executionCount++;

    try {
      if (input?.shouldFail) {
        throw new AppError("Execution failed", 6000);
      }

      this.context.state = AgentState.COMPLETED;
      return this.executeResult;
    } catch (error) {
      this.context.state = AgentState.FAILED;
      throw error;
    }
  }

  setExecuteResult(result: any): void {
    this.executeResult = result;
  }
}

describe("BaseAgent", () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent({
      name: "test-agent",
      description: "Test agent for unit testing",
      maxRetries: 3,
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await agent.cleanup();
  });

  describe("基本功能", () => {
    it("应该正确创建 Agent", () => {
      expect(agent.getName()).toBe("test-agent");
      expect(agent.getDescription()).toBe("Test agent for unit testing");
      expect(agent.getState()).toBe(AgentState.IDLE);
    });

    it("应该返回正确的上下文", () => {
      const context = agent.getContext();
      expect(context.state).toBe(AgentState.IDLE);
      expect(context.skills).toBeInstanceOf(Map);
      expect(context.metadata).toBeInstanceOf(Map);
      expect(context.createdAt).toBeInstanceOf(Date);
      expect(context.executionCount).toBe(0);
    });
  });

  describe("技能管理", () => {
    it("应该成功添加技能", () => {
      const skill: Skill = {
        name: "test-skill",
        description: "Test skill",
        execute: async (input) => ({ result: input }),
      };

      agent.addSkill(skill);
      expect(agent.getSkill("test-skill")).toBe(skill);
      expect(agent.getSkills()).toHaveLength(1);
    });

    it("应该拒绝添加重复的技能", () => {
      const skill: Skill = {
        name: "test-skill",
        description: "Test skill",
        execute: async (input) => ({ result: input }),
      };

      agent.addSkill(skill);

      expect(() => {
        agent.addSkill(skill);
      }).toThrow(AppError);
    });

    it("应该成功移除技能", () => {
      const skill: Skill = {
        name: "test-skill",
        description: "Test skill",
        execute: async (input) => ({ result: input }),
      };

      agent.addSkill(skill);
      expect(agent.removeSkill("test-skill")).toBe(true);
      expect(agent.getSkill("test-skill")).toBeUndefined();
    });

    it("应该返回 undefined 当移除不存在的技能", () => {
      expect(agent.removeSkill("non-existent")).toBe(false);
    });

    it("应该成功执行技能", async () => {
      const skill: Skill = {
        name: "test-skill",
        description: "Test skill",
        execute: async (input) => ({ result: input }),
      };

      agent.addSkill(skill);
      const result = await agent.executeSkill("test-skill", "test-input");
      expect(result).toEqual({ result: "test-input" });
    });

    it("应该抛出错误当执行不存在的技能", async () => {
      await expect(agent.executeSkill("non-existent", "input")).rejects.toThrow(AppError);
    });
  });

  describe("元数据管理", () => {
    it("应该成功设置和获取元数据", () => {
      agent.setMetadata("key1", "value1");
      agent.setMetadata("key2", { nested: "value" });

      expect(agent.getMetadata("key1")).toBe("value1");
      expect(agent.getMetadata("key2")).toEqual({ nested: "value" });
    });

    it("应该返回 undefined 当获取不存在的元数据", () => {
      expect(agent.getMetadata("non-existent")).toBeUndefined();
    });
  });

  describe("状态管理", () => {
    it("应该正确更新执行状态", async () => {
      expect(agent.getState()).toBe(AgentState.IDLE);

      await agent.execute({});

      expect(agent.getState()).toBe(AgentState.COMPLETED);
      expect(agent.getContext().executionCount).toBe(1);
      expect(agent.getContext().lastExecutedAt).toBeInstanceOf(Date);
    });

    it("应该正确处理执行失败", async () => {
      await expect(agent.execute({ shouldFail: true })).rejects.toThrow(AppError);
      expect(agent.getState()).toBe(AgentState.FAILED);
    });

    it("应该正确重置状态", async () => {
      await agent.execute({});

      agent.reset();

      expect(agent.getState()).toBe(AgentState.IDLE);
      expect(agent.getContext().executionCount).toBe(0);
      expect(agent.getContext().lastExecutedAt).toBeUndefined();
    });
  });

  describe("清理功能", () => {
    it("应该成功清理资源", async () => {
      const skill: Skill = {
        name: "test-skill",
        description: "Test skill",
        execute: async (input) => ({ result: input }),
      };

      agent.addSkill(skill);
      agent.setMetadata("key", "value");

      await agent.cleanup();

      expect(agent.getSkills()).toHaveLength(0);
      expect(agent.getMetadata("key")).toBeUndefined();
      expect(agent.getState()).toBe(AgentState.IDLE);
    });
  });

  describe("JSON 序列化", () => {
    it("应该正确转换为 JSON", () => {
      const skill: Skill = {
        name: "test-skill",
        description: "Test skill",
        execute: async (input) => ({ result: input }),
      };

      agent.addSkill(skill);
      agent.setMetadata("key", "value");

      const json = agent.toJSON();

      expect(json).toEqual({
        name: "test-agent",
        description: "Test agent for unit testing",
        state: AgentState.IDLE,
        skills: ["test-skill"],
        metadata: { key: "value" },
        createdAt: agent.getContext().createdAt,
        lastExecutedAt: undefined,
        executionCount: 0,
      });
    });
  });
});
