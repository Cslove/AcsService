/**
 * BaseSkill 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import BaseSkill from "@/core/skill/BaseSkill.js";
import type { SkillConfig, SkillInput, SkillOutput } from "@/core/skill/Skill.js";
import { SkillType } from "@/core/skill/Skill.js";

/**
 * 创建测试用的 Skill 子类
 */
class TestSkill extends BaseSkill {
  constructor(config: SkillConfig) {
    super(config);
  }

  protected async executeInternal(input: SkillInput): Promise<SkillOutput> {
    // 模拟执行
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      data: {
        input,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * 创建会失败的 Skill 子类
 */
class FailingSkill extends BaseSkill {
  constructor(config: SkillConfig) {
    super(config);
  }

  protected async executeInternal(_input: SkillInput): Promise<SkillOutput> {
    throw new Error("Test error");
  }
}

describe("BaseSkill", () => {
  let skill: TestSkill;
  let config: SkillConfig;

  beforeEach(() => {
    config = {
      id: "test-skill",
      name: "Test Skill",
      description: "A test skill for unit testing",
      type: SkillType.CUSTOM,
      version: "1.0.0",
      parameters: [
        {
          name: "testParam",
          type: "string",
          description: "A test parameter",
          required: true,
        },
        {
          name: "optionalParam",
          type: "number",
          description: "An optional parameter",
          required: false,
        },
      ],
      timeout: 5000,
      metadata: {
        key: "value",
      },
    };

    skill = new TestSkill(config);
  });

  describe("constructor", () => {
    it("应该使用正确的配置创建技能", () => {
      expect(skill.getId()).toBe("test-skill");
      expect(skill.getName()).toBe("Test Skill");
      expect(skill.getDescription()).toBe("A test skill for unit testing");
      expect(skill.getType()).toBe("custom");
      expect(skill.getVersion()).toBe("1.0.0");
    });

    it("应该使用空闲状态初始化", () => {
      expect(skill.getState()).toBe("idle");
      expect(skill.isIdle()).toBe(true);
      expect(skill.isRunning()).toBe(false);
    });

    it("应该正确设置元数据", () => {
      expect(skill.getMetadata()).toEqual({ key: "value" });
    });
  });

  describe("execute", () => {
    it("应该使用有效输入成功执行", async () => {
      const input: SkillInput = {
        testParam: "test value",
      };

      const result = await skill.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(skill.getState()).toBe("completed");
      expect(skill.isCompleted()).toBe(true);
    });

    it("应该处理可选参数", async () => {
      const input: SkillInput = {
        testParam: "test value",
        optionalParam: 42,
      };

      const result = await skill.execute(input);

      expect(result.success).toBe(true);
    });

    it("应该在缺少必需参数时失败", async () => {
      const input: SkillInput = {};

      await expect(skill.execute(input)).rejects.toThrow("Missing required parameter");
    });

    it("应该在参数类型无效时失败", async () => {
      const input: SkillInput = {
        testParam: 123, // Should be string
      };

      await expect(skill.execute(input)).rejects.toThrow("Invalid parameter type");
    });

    it("应该在枚举值无效时失败", async () => {
      const skillWithEnum = new TestSkill({
        ...config,
        parameters: [
          {
            name: "enumParam",
            type: "string",
            description: "Enum parameter",
            required: true,
            enum: ["value1", "value2"],
          },
        ],
      });

      const input: SkillInput = {
        enumParam: "invalid",
      };

      await expect(skillWithEnum.execute(input)).rejects.toThrow("Invalid value for enumParam");
    });

    it("应该在配置的超时时间后超时", async () => {
      new TestSkill({
        ...config,
        timeout: 100,
      });

      // 通过继承覆盖 executeInternal 方法
      class SlowSkill extends TestSkill {
        protected async executeInternal(_input: SkillInput): Promise<SkillOutput> {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return { success: true, data: {} };
        }
      }

      const input: SkillInput = {
        testParam: "test",
      };

      const result = await new SlowSkill({
        ...config,
        timeout: 100,
      }).execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("应该优雅地处理执行错误", async () => {
      const failingSkill = new FailingSkill(config);

      const input: SkillInput = {
        testParam: "test",
      };

      const result = await failingSkill.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("应该更新执行计数", async () => {
      const input: SkillInput = {
        testParam: "test",
      };

      expect(skill.getExecutionCount()).toBe(0);

      await skill.execute(input);

      expect(skill.getExecutionCount()).toBe(1);
    });

    it("应该记录执行持续时间", async () => {
      const input: SkillInput = {
        testParam: "test",
      };

      await skill.execute(input);

      const duration = skill.getDuration();
      expect(duration).toBeDefined();
      expect(duration!).toBeGreaterThan(0);
    });
  });

  describe("cancel", () => {
    it("应该取消正在运行的技能", async () => {
      const input: SkillInput = {
        testParam: "test",
      };

      // Start execution in background
      skill.execute(input);

      // Cancel immediately
      skill.cancel();

      expect(skill.getState()).toBe("cancelled");
      expect(skill.isCancelled()).toBe(true);
    });

    it("不应该取消空闲状态的技能", () => {
      expect(() => skill.cancel()).toThrow("Cannot cancel skill in state: idle");
    });

    it("不应该取消已完成的技能", async () => {
      const input: SkillInput = {
        testParam: "test",
      };

      await skill.execute(input);

      expect(() => skill.cancel()).toThrow("Cannot cancel skill in state: completed");
    });
  });

  describe("reset", () => {
    it("应该重置已完成的技能", async () => {
      const input: SkillInput = {
        testParam: "test",
      };

      await skill.execute(input);
      expect(skill.getState()).toBe("completed");

      skill.reset();

      expect(skill.getState()).toBe("idle");
      expect(skill.getDuration()).toBeUndefined();
    });

    it("不应该重置正在运行的技能", async () => {
      const input: SkillInput = {
        testParam: "test",
      };

      // Start execution in background
      skill.execute(input);

      expect(() => skill.reset()).toThrow("Cannot reset skill in running state");
    });
  });

  describe("metadata", () => {
    it("应该设置元数据", () => {
      skill.setMetadata({ newKey: "newValue" });

      expect(skill.getMetadata()).toEqual({ newKey: "newValue" });
    });

    it("应该更新元数据", () => {
      skill.updateMetadata("newKey", "newValue");

      expect(skill.getMetadata()).toEqual({ key: "value", newKey: "newValue" });
    });
  });

  describe("toToolCall", () => {
    it("应该转换为工具调用定义", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.type).toBe("function");
      expect(toolCall.function.name).toBe("test-skill");
      expect(toolCall.function.description).toBe("A test skill for unit testing");
      expect(toolCall.function.parameters.type).toBe("object");
      expect(toolCall.function.parameters.properties).toBeDefined();
      expect(toolCall.function.parameters.required).toEqual(["testParam"]);
    });

    it("应该在工具调用中包含枚举值", () => {
      const skillWithEnum = new TestSkill({
        ...config,
        parameters: [
          {
            name: "enumParam",
            type: "string",
            description: "Enum parameter",
            required: true,
            enum: ["value1", "value2"],
          },
        ],
      });

      const toolCall = skillWithEnum.toToolCall();

      expect(toolCall.function.parameters.properties.enumParam.enum).toEqual(["value1", "value2"]);
    });
  });

  describe("toJSON and fromJSON", () => {
    it("应该序列化为 JSON", () => {
      const json = skill.toJSON();

      expect(json.id).toBe("test-skill");
      expect(json.name).toBe("Test Skill");
      expect(json.state).toBe("idle");
      expect(json.executionCount).toBe(0);
    });

    it("应该从 JSON 反序列化", () => {
      const json = skill.toJSON();
      const deserializedSkill = BaseSkill.fromJSON(json, TestSkill);

      expect(deserializedSkill.getId()).toBe("test-skill");
      expect(deserializedSkill.getName()).toBe("Test Skill");
      expect(deserializedSkill.getState()).toBe("idle");
    });

    it("应该在反序列化后保持状态", async () => {
      const input: SkillInput = {
        testParam: "test",
      };

      await skill.execute(input);

      const json = skill.toJSON();
      const deserializedSkill = BaseSkill.fromJSON(json, TestSkill);

      expect(deserializedSkill.getState()).toBe("completed");
      expect(deserializedSkill.getExecutionCount()).toBe(1);
      expect(deserializedSkill.getDuration()).toBeDefined();
    });
  });

  describe("timestamps", () => {
    it("应该有创建时间戳", () => {
      const createdAt = skill.getCreatedAt();

      expect(createdAt).toBeInstanceOf(Date);
      expect(createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("应该在元数据更改时更新时间戳", async () => {
      const oldUpdatedAt = skill.getUpdatedAt();

      await new Promise((resolve) => setTimeout(resolve, 10));

      skill.setMetadata({ newKey: "newValue" });

      const newUpdatedAt = skill.getUpdatedAt();

      expect(newUpdatedAt.getTime()).toBeGreaterThan(oldUpdatedAt.getTime());
    });
  });

  describe("cleanup", () => {
    it("应该清理资源", () => {
      expect(() => skill.cleanup()).not.toThrow();
    });
  });
});
