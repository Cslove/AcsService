/**
 * SearchSkill 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SearchSkill,
  createSearchSkill,
  SearchEngine,
  SearchType,
} from "@/core/skill/skills/SearchSkill.js";
import { SkillType } from "@/core/skill/Skill.js";

describe("SearchSkill", () => {
  let skill: SearchSkill;

  beforeEach(() => {
    skill = createSearchSkill({
      id: "test-search",
      name: "Test Search",
      description: "Test search skill",
      type: SkillType.SEARCH,
    });
  });

  describe("constructor", () => {
    it("应该使用默认值创建搜索技能", () => {
      expect(skill.getId()).toBe("test-search");
      expect(skill.getDefaultEngine()).toBe(SearchEngine.GOOGLE);
      expect(skill.getDefaultSearchType()).toBe(SearchType.WEB);
      expect(skill.getMaxResults()).toBe(10);
    });

    it("应该使用自定义值创建搜索技能", () => {
      const customSkill = createSearchSkill({
        id: "custom-search",
        name: "Custom Search",
        description: "Custom search skill",
        type: SkillType.SEARCH,
        defaultEngine: SearchEngine.BAIDU,
        defaultSearchType: SearchType.NEWS,
        maxResults: 20,
      });

      expect(customSkill.getDefaultEngine()).toBe(SearchEngine.BAIDU);
      expect(customSkill.getDefaultSearchType()).toBe(SearchType.NEWS);
      expect(customSkill.getMaxResults()).toBe(20);
    });
  });

  describe("execute", () => {
    it("应该使用查询执行搜索", async () => {
      const result = await skill.execute({
        query: "test query",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.query).toBe("test query");
      expect(result.data.results).toBeInstanceOf(Array);
    });

    it("应该使用自定义搜索引擎", async () => {
      const result = await skill.execute({
        query: "test query",
        engine: SearchEngine.BING,
      });

      expect(result.success).toBe(true);
      expect(result.data.engine).toBe(SearchEngine.BING);
    });

    it("应该使用自定义搜索类型", async () => {
      const result = await skill.execute({
        query: "test query",
        searchType: SearchType.IMAGES,
      });

      expect(result.success).toBe(true);
      expect(result.data.searchType).toBe(SearchType.IMAGES);
    });

    it("应该限制结果数量到 maxResults", async () => {
      const result = await skill.execute({
        query: "test query",
        maxResults: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data.results.length).toBeLessThanOrEqual(2);
    });

    it("应该在缺少查询时失败", async () => {
      await expect(skill.execute({})).rejects.toThrow("Missing required parameter: query");
    });
  });

  describe("setters", () => {
    it("应该设置默认搜索引擎", () => {
      skill.setDefaultEngine(SearchEngine.DUCKDUCKGO);

      expect(skill.getDefaultEngine()).toBe(SearchEngine.DUCKDUCKGO);
    });

    it("应该设置默认搜索类型", () => {
      skill.setDefaultSearchType(SearchType.VIDEOS);

      expect(skill.getDefaultSearchType()).toBe(SearchType.VIDEOS);
    });

    it("应该设置最大结果数", () => {
      skill.setMaxResults(50);

      expect(skill.getMaxResults()).toBe(50);
    });

    it("应该在最大结果数无效时抛出错误", () => {
      expect(() => skill.setMaxResults(0)).toThrow("Max results must be greater than 0");
      expect(() => skill.setMaxResults(-1)).toThrow("Max results must be greater than 0");
    });
  });

  describe("toToolCall", () => {
    it("应该转换为工具调用定义", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.type).toBe("function");
      expect(toolCall.function.name).toBe("test-search");
      expect(toolCall.function.parameters.properties.query).toBeDefined();
      expect(toolCall.function.parameters.properties.engine).toBeDefined();
      expect(toolCall.function.parameters.properties.searchType).toBeDefined();
      expect(toolCall.function.parameters.properties.maxResults).toBeDefined();
    });

    it("应该包含搜索引擎的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.engine.enum).toEqual(
        Object.values(SearchEngine),
      );
    });

    it("应该包含搜索类型的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.searchType.enum).toEqual(
        Object.values(SearchType),
      );
    });
  });
});
