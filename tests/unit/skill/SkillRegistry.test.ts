/**
 * SkillRegistry 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SkillRegistry, skillRegistry } from "@/core/skill/SkillRegistry.js";
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
    return {
      success: true,
      data: { input },
    };
  }
}

describe("SkillRegistry", () => {
  let registry: SkillRegistry;
  let skill1: BaseSkill;
  let skill2: BaseSkill;

  beforeEach(() => {
    // 使用单例实例
    registry = skillRegistry;

    skill1 = new TestSkill({
      id: "skill-1",
      name: "Skill 1",
      description: "First test skill",
      type: SkillType.CUSTOM,
      version: "1.0.0",
      parameters: [],
    });

    skill2 = new TestSkill({
      id: "skill-2",
      name: "Skill 2",
      description: "Second test skill",
      type: SkillType.CUSTOM,
      version: "1.0.0",
      parameters: [],
    });
  });

  afterEach(() => {
    registry.clear();
  });

  describe("getInstance", () => {
    it("应该返回单例实例", () => {
      const instance1 = SkillRegistry.getInstance();
      const instance2 = SkillRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("register", () => {
    it("应该注册技能", () => {
      registry.register(skill1);

      expect(registry.has("skill-1")).toBe(true);
      expect(registry.getCount()).toBe(1);
    });

    it("应该在注册重复技能时抛出错误", () => {
      registry.register(skill1);

      expect(() => registry.register(skill1)).toThrow("Skill already registered");
    });

    it("应该按类型索引技能", () => {
      registry.register(skill1);
      registry.register(skill2);

      const testSkills = registry.getByType(SkillType.CUSTOM);

      expect(testSkills).toHaveLength(2);
      expect(testSkills.map((s) => s.getId())).toEqual(["skill-1", "skill-2"]);
    });
  });

  describe("registerBatch", () => {
    it("应该批量注册多个技能", () => {
      registry.registerBatch([skill1, skill2]);

      expect(registry.getCount()).toBe(2);
      expect(registry.has("skill-1")).toBe(true);
      expect(registry.has("skill-2")).toBe(true);
    });
  });

  describe("unregister", () => {
    it("应该注销技能", () => {
      registry.register(skill1);
      expect(registry.has("skill-1")).toBe(true);

      registry.unregister("skill-1");

      expect(registry.has("skill-1")).toBe(false);
      expect(registry.getCount()).toBe(0);
    });

    it("应该在注销不存在的技能时抛出错误", () => {
      expect(() => registry.unregister("non-existent")).toThrow("Skill not found");
    });

    it("应该从类型索引中移除技能", () => {
      registry.register(skill1);
      registry.register(skill2);

      registry.unregister("skill-1");

      const testSkills = registry.getByType(SkillType.CUSTOM);

      expect(testSkills).toHaveLength(1);
      expect(testSkills[0].getId()).toBe("skill-2");
    });
  });

  describe("get", () => {
    it("应该获取已注册的技能", () => {
      registry.register(skill1);

      const retrievedSkill = registry.get("skill-1");

      expect(retrievedSkill).toBe(skill1);
    });

    it("应该在获取不存在的技能时抛出错误", () => {
      expect(() => registry.get("non-existent")).toThrow("Skill not found");
    });
  });

  describe("has", () => {
    it("应该对已注册的技能返回 true", () => {
      registry.register(skill1);

      expect(registry.has("skill-1")).toBe(true);
    });

    it("应该对不存在的技能返回 false", () => {
      expect(registry.has("non-existent")).toBe(false);
    });
  });

  describe("getAll", () => {
    it("应该返回所有已注册的技能", () => {
      registry.register(skill1);
      registry.register(skill2);

      const allSkills = registry.getAll();

      expect(allSkills).toHaveLength(2);
      expect(allSkills).toContain(skill1);
      expect(allSkills).toContain(skill2);
    });

    it("应该在没有注册技能时返回空数组", () => {
      const allSkills = registry.getAll();

      expect(allSkills).toEqual([]);
    });
  });

  describe("searchByName", () => {
    it("应该按名称搜索技能", () => {
      registry.register(skill1);
      registry.register(skill2);

      const results = registry.searchByName("Skill");

      expect(results).toHaveLength(2);
    });

    it("应该不区分大小写", () => {
      registry.register(skill1);

      const results = registry.searchByName("skill 1");

      expect(results).toHaveLength(1);
      expect(results[0].getId()).toBe("skill-1");
    });

    it("应该在无匹配时返回空数组", () => {
      registry.register(skill1);

      const results = registry.searchByName("non-existent");

      expect(results).toEqual([]);
    });
  });

  describe("searchByDescription", () => {
    it("应该按描述搜索技能", () => {
      registry.register(skill1);
      registry.register(skill2);

      const results = registry.searchByDescription("test");

      expect(results).toHaveLength(2);
    });

    it("应该不区分大小写", () => {
      registry.register(skill1);

      const results = registry.searchByDescription("TEST");

      expect(results).toHaveLength(1);
    });
  });

  describe("getAllIds", () => {
    it("应该返回所有技能 ID", () => {
      registry.register(skill1);
      registry.register(skill2);

      const ids = registry.getAllIds();

      expect(ids).toEqual(["skill-1", "skill-2"]);
    });

    it("应该在没有注册技能时返回空数组", () => {
      const ids = registry.getAllIds();

      expect(ids).toEqual([]);
    });
  });

  describe("getAllTypes", () => {
    it("应该返回所有技能类型", () => {
      const skill3 = new TestSkill({
        id: "skill-3",
        name: "Skill 3",
        description: "Third test skill",
        type: SkillType.TOOL_CALL,
        version: "1.0.0",
        parameters: [],
      });

      registry.register(skill1);
      registry.register(skill2);
      registry.register(skill3);

      const types = registry.getAllTypes();

      expect(types).toContain(SkillType.CUSTOM);
      expect(types).toContain(SkillType.TOOL_CALL);
    });
  });

  describe("getCount", () => {
    it("应该返回正确的计数", () => {
      expect(registry.getCount()).toBe(0);

      registry.register(skill1);

      expect(registry.getCount()).toBe(1);

      registry.register(skill2);

      expect(registry.getCount()).toBe(2);
    });
  });

  describe("clear", () => {
    it("应该清除所有技能", () => {
      registry.register(skill1);
      registry.register(skill2);

      registry.clear();

      expect(registry.getCount()).toBe(0);
      expect(registry.has("skill-1")).toBe(false);
      expect(registry.has("skill-2")).toBe(false);
    });
  });

  describe("getAllToolCalls", () => {
    it("应该返回所有技能的工具调用定义", () => {
      registry.register(skill1);
      registry.register(skill2);

      const toolCalls = registry.getAllToolCalls();

      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].type).toBe("function");
      expect(toolCalls[1].type).toBe("function");
    });
  });

  describe("getToolCall", () => {
    it("应该返回技能的工具调用定义", () => {
      registry.register(skill1);

      const toolCall = registry.getToolCall("skill-1");

      expect(toolCall).toBeDefined();
      expect(toolCall!.function.name).toBe("skill-1");
    });

    it("应该对不存在的技能返回 undefined", () => {
      const toolCall = registry.getToolCall("non-existent");

      expect(toolCall).toBeUndefined();
    });
  });

  describe("exportAll", () => {
    it("应该导出所有技能", () => {
      registry.register(skill1);
      registry.register(skill2);

      const exported = registry.exportAll();

      expect(exported).toHaveLength(2);
      expect(exported[0].id).toBe("skill-1");
      expect(exported[1].id).toBe("skill-2");
    });
  });

  describe("export", () => {
    it("应该导出特定技能", () => {
      registry.register(skill1);

      const exported = registry.export("skill-1");

      expect(exported.id).toBe("skill-1");
    });
  });

  describe("getStats", () => {
    it("应该返回正确的统计信息", async () => {
      registry.register(skill1);
      registry.register(skill2);

      // Execute skill1
      await skill1.execute({});

      const stats = registry.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byType[SkillType.CUSTOM]).toBe(2);
      expect(stats.idle).toBe(1);
      expect(stats.completed).toBe(1);
    });
  });

  describe("resetAll", () => {
    it("应该重置所有技能", async () => {
      registry.register(skill1);
      registry.register(skill2);

      await skill1.execute({});

      expect(skill1.getState()).toBe("completed");

      registry.resetAll();

      expect(skill1.getState()).toBe("idle");
      expect(skill2.getState()).toBe("idle");
    });
  });

  describe("getHealthStatus", () => {
    it("应该为所有技能返回健康状态", () => {
      registry.register(skill1);
      registry.register(skill2);

      const health = registry.getHealthStatus();

      expect(health.healthy).toBe(2);
      expect(health.unhealthy).toBe(0);
      expect(health.details).toHaveLength(2);
      expect(health.details[0].isHealthy).toBe(true);
    });

    it("应该识别不健康的技能", async () => {
      // 创建一个会失败的技能
      class FailingTestSkill extends BaseSkill {
        constructor(config: SkillConfig) {
          super(config);
        }

        protected async executeInternal(_input: SkillInput): Promise<SkillOutput> {
          throw new Error("Test error");
        }
      }

      const failingSkill = new FailingTestSkill({
        id: "failing-skill",
        name: "Failing Skill",
        description: "A skill that fails",
        type: SkillType.CUSTOM,
        version: "1.0.0",
        parameters: [],
      });

      registry.register(skill1);
      registry.register(failingSkill);

      await failingSkill.execute({});

      const health = registry.getHealthStatus();

      expect(health.healthy).toBe(1);
      expect(health.unhealthy).toBe(1);
      expect(health.details[1].isHealthy).toBe(false);
    });
  });
});
