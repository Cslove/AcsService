import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubAgent, type SubAgentConfig } from "@/core/agent/SubAgent.js";
import { AgentState } from "@/core/agent/BaseAgent.js";
import { AppError } from "@/shared/utils/errorHandler.js";

describe("SubAgent", () => {
  let subAgent: SubAgent;

  beforeEach(() => {
    const config: SubAgentConfig = {
      name: "test-sub-agent",
      description: "Test sub-agent for unit testing",
      taskType: "test-type",
      capabilities: ["process", "analyze"],
    };

    subAgent = new SubAgent(config);

    // 添加测试技能
    subAgent.addSkill({
      name: "process",
      description: "Process task",
      execute: async (input) => ({ processed: true, data: input }),
    });

    subAgent.addSkill({
      name: "analyze",
      description: "Analyze task",
      execute: async (input) => ({ analyzed: true, data: input }),
    });
  });

  afterEach(async () => {
    await subAgent.cleanup();
  });

  describe("基本功能", () => {
    it("应该正确创建 SubAgent", () => {
      expect(subAgent.getName()).toBe("test-sub-agent");
      expect(subAgent.getDescription()).toBe("Test sub-agent for unit testing");
      expect(subAgent.getTaskType()).toBe("test-type");
      expect(subAgent.getState()).toBe(AgentState.IDLE);
    });

    it("应该正确返回能力列表", () => {
      const capabilities = subAgent.getCapabilities();
      expect(capabilities).toEqual(["process", "analyze"]);
    });
  });

  describe("能力管理", () => {
    it("应该正确检查能力", () => {
      expect(subAgent.hasCapability("process")).toBe(true);
      expect(subAgent.hasCapability("analyze")).toBe(true);
      expect(subAgent.hasCapability("non-existent")).toBe(false);
    });

    it("应该成功添加能力", () => {
      subAgent.addCapability("transform");
      expect(subAgent.hasCapability("transform")).toBe(true);
      expect(subAgent.getCapabilities()).toHaveLength(3);
    });

    it("应该拒绝添加重复的能力", () => {
      subAgent.addCapability("process");
      expect(subAgent.getCapabilities()).toHaveLength(2);
    });

    it("应该成功移除能力", () => {
      expect(subAgent.removeCapability("process")).toBe(true);
      expect(subAgent.hasCapability("process")).toBe(false);
      expect(subAgent.getCapabilities()).toHaveLength(1);
    });

    it("应该返回 false 当移除不存在的能力", () => {
      expect(subAgent.removeCapability("non-existent")).toBe(false);
    });
  });

  describe("输入验证", () => {
    it("应该验证有效的输入", () => {
      const validInput = {
        task: {
          type: "test-type",
          action: "process",
        },
      };

      expect(subAgent["validateInput"](validInput)).toBe(true);
    });

    it("应该拒绝无效的输入（空对象）", () => {
      expect(subAgent["validateInput"](null)).toBe(false);
      expect(subAgent["validateInput"](undefined)).toBe(false);
    });

    it("应该拒绝无效的输入（非对象）", () => {
      expect(subAgent["validateInput"]("string")).toBe(false);
      expect(subAgent["validateInput"](123)).toBe(false);
    });

    it("应该拒绝缺少 task 字段的输入", () => {
      const invalidInput = {
        action: "process",
      };

      expect(subAgent["validateInput"](invalidInput)).toBe(false);
    });

    it("应该拒绝任务类型不匹配的输入", () => {
      const invalidInput = {
        task: {
          type: "wrong-type",
          action: "process",
        },
      };

      expect(subAgent["validateInput"](invalidInput)).toBe(false);
    });
  });

  describe("执行功能", () => {
    it("应该成功执行任务", async () => {
      const input = {
        task: {
          type: "test-type",
          action: "process",
        },
      };

      const result = await subAgent.execute(input);

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ processed: true, data: input });
      expect(result.agent).toBe("test-sub-agent");
      expect(result.taskType).toBe("test-type");
      expect(subAgent.getState()).toBe(AgentState.COMPLETED);
      expect(subAgent.getContext().executionCount).toBe(1);
    });

    it("应该执行不同的技能", async () => {
      const input = {
        task: {
          type: "test-type",
          action: "analyze",
        },
      };

      const result = await subAgent.execute(input);

      expect(result.result).toEqual({ analyzed: true, data: input });
    });

    it("应该处理无效输入", async () => {
      const invalidInput = {
        task: {
          type: "wrong-type",
          action: "process",
        },
      };

      await expect(subAgent.execute(invalidInput)).rejects.toThrow(AppError);
      expect(subAgent.getState()).toBe(AgentState.FAILED);
    });

    it("应该处理缺少 action 的输入", async () => {
      const invalidInput = {
        task: {
          type: "test-type",
        },
      };

      await expect(subAgent.execute(invalidInput)).rejects.toThrow(AppError);
    });

    it("应该处理技能执行失败", async () => {
      subAgent.addSkill({
        name: "fail",
        description: "Fail skill",
        execute: async () => {
          throw new Error("Skill execution failed");
        },
      });

      const input = {
        task: {
          type: "test-type",
          action: "fail",
        },
      };

      await expect(subAgent.execute(input)).rejects.toThrow();
      expect(subAgent.getState()).toBe(AgentState.FAILED);
    });
  });

  describe("JSON 序列化", () => {
    it("应该正确转换为 JSON", () => {
      const json = subAgent.toJSON();

      expect(json).toEqual({
        name: "test-sub-agent",
        description: "Test sub-agent for unit testing",
        state: AgentState.IDLE,
        skills: ["process", "analyze"],
        metadata: {},
        createdAt: subAgent.getContext().createdAt,
        lastExecutedAt: undefined,
        executionCount: 0,
        taskType: "test-type",
        capabilities: ["process", "analyze"],
      });
    });
  });

  describe("清理功能", () => {
    it("应该成功清理资源", async () => {
      subAgent.setMetadata("key", "value");

      await subAgent.cleanup();

      expect(subAgent.getSkills()).toHaveLength(0);
      expect(subAgent.getMetadata("key")).toBeUndefined();
      expect(subAgent.getState()).toBe(AgentState.IDLE);
    });
  });
});
