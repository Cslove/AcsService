/**
 * DataAnalysisSkill 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DataAnalysisSkill,
  createDataAnalysisSkill,
  AnalysisType,
  DataFormat,
  VisualizationType,
} from "@/core/skill/skills/DataAnalysisSkill.js";
import { SkillType } from "@/core/skill/Skill.js";

describe("DataAnalysisSkill", () => {
  let skill: DataAnalysisSkill;

  beforeEach(() => {
    skill = createDataAnalysisSkill({
      id: "test-data-analysis",
      name: "Test Data Analysis",
      description: "Test data analysis skill",
      type: SkillType.DATA_ANALYSIS,
    });
  });

  describe("constructor", () => {
    it("应该使用默认值创建数据分析技能", () => {
      expect(skill.getId()).toBe("test-data-analysis");
      expect(skill.getDefaultAnalysisType()).toBe(AnalysisType.STATISTICAL);
      expect(skill.getDefaultVisualization()).toBe(VisualizationType.SUMMARY);
      expect(skill.getMaxDataPoints()).toBe(1000);
    });

    it("应该使用自定义值创建数据分析技能", () => {
      const customSkill = createDataAnalysisSkill({
        id: "custom-data-analysis",
        name: "Custom Data Analysis",
        description: "Custom data analysis skill",
        type: SkillType.DATA_ANALYSIS,
        defaultAnalysisType: AnalysisType.TREND,
        defaultVisualization: VisualizationType.CHART,
        maxDataPoints: 500,
      });

      expect(customSkill.getDefaultAnalysisType()).toBe(AnalysisType.TREND);
      expect(customSkill.getDefaultVisualization()).toBe(VisualizationType.CHART);
      expect(customSkill.getMaxDataPoints()).toBe(500);
    });
  });

  describe("execute", () => {
    it("应该分析 JSON 数据", async () => {
      const data = [
        { name: "Alice", age: 25, score: 85 },
        { name: "Bob", age: 30, score: 90 },
        { name: "Charlie", age: 35, score: 78 },
      ];

      const result = await skill.execute({
        data,
        dataFormat: DataFormat.JSON,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.dataPointCount).toBe(3);
      expect(result.data.analysisResult).toBeDefined();
    });

    it("应该分析 CSV 数据", async () => {
      const csvData = "name,age,score\nAlice,25,85\nBob,30,90\nCharlie,35,78";

      const result = await skill.execute({
        data: csvData,
        dataFormat: DataFormat.CSV,
      });

      expect(result.success).toBe(true);
      expect(result.data.dataPointCount).toBe(3);
    });

    it("应该分析数组数据", async () => {
      const data = [10, 20, 30, 40, 50];

      const result = await skill.execute({
        data,
        dataFormat: DataFormat.ARRAY,
      });

      expect(result.success).toBe(true);
      expect(result.data.dataPointCount).toBe(5);
    });

    it("应该执行统计分析", async () => {
      const data = [{ value: 10 }, { value: 20 }, { value: 30 }, { value: 40 }, { value: 50 }];

      const result = await skill.execute({
        data,
        analysisType: AnalysisType.STATISTICAL,
      });

      expect(result.success).toBe(true);
      expect(result.data.analysisResult.statistics).toBeDefined();
      expect(result.data.analysisResult.statistics.value).toBeDefined();
    });

    it("应该执行趋势分析", async () => {
      const data = [{ value: 10 }, { value: 20 }, { value: 30 }, { value: 40 }, { value: 50 }];

      const result = await skill.execute({
        data,
        analysisType: AnalysisType.TREND,
      });

      expect(result.success).toBe(true);
      expect(result.data.analysisResult.trend).toBeDefined();
      expect(result.data.analysisResult.trend.value).toBeDefined();
    });

    it("应该执行对比分析", async () => {
      const data = [
        { field1: 10, field2: 20 },
        { field1: 15, field2: 25 },
        { field1: 20, field2: 30 },
      ];

      const result = await skill.execute({
        data,
        analysisType: AnalysisType.COMPARISON,
      });

      expect(result.success).toBe(true);
      expect(result.data.analysisResult.comparison).toBeDefined();
    });

    it("应该执行相关性分析", async () => {
      const data = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
        { x: 4, y: 8 },
      ];

      const result = await skill.execute({
        data,
        analysisType: AnalysisType.CORRELATION,
      });

      expect(result.success).toBe(true);
      expect(result.data.analysisResult.correlation).toBeDefined();
    });

    it("应该执行汇总分析", async () => {
      const data = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
      ];

      const result = await skill.execute({
        data,
        analysisType: AnalysisType.SUMMARY,
      });

      expect(result.success).toBe(true);
      expect(result.data.analysisResult.summary).toBeDefined();
    });

    it("应该生成表格可视化", async () => {
      const data = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
      ];

      const result = await skill.execute({
        data,
        visualizationType: VisualizationType.TABLE,
      });

      expect(result.success).toBe(true);
      expect(result.data.visualization.type).toBe("table");
      expect(result.data.visualization.headers).toBeDefined();
      expect(result.data.visualization.rows).toBeDefined();
    });

    it("应该生成图表可视化", async () => {
      const data = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
      ];

      const result = await skill.execute({
        data,
        visualizationType: VisualizationType.CHART,
      });

      expect(result.success).toBe(true);
      expect(result.data.visualization.type).toBe("chart");
    });

    it("应该不生成可视化", async () => {
      const data = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
      ];

      const result = await skill.execute({
        data,
        visualizationType: VisualizationType.NONE,
      });

      expect(result.success).toBe(true);
      expect(result.data.visualization).toBeNull();
    });

    it("应该限制数据点到 maxDataPoints", async () => {
      const data = Array.from({ length: 2000 }, (_, i) => ({ value: i }));

      const result = await skill.execute({
        data,
      });

      expect(result.success).toBe(true);
      expect(result.data.dataPointCount).toBe(1000);
    });

    it("应该包含自定义指标", async () => {
      const data = [{ value: 10 }, { value: 20 }, { value: 30 }];

      const result = await skill.execute({
        data,
        customMetrics: ["metric1", "metric2"],
      });

      expect(result.success).toBe(true);
      expect(result.data.analysisResult.customMetrics).toBeDefined();
      expect(result.data.analysisResult.customMetrics.metric1).toBeDefined();
    });

    it("应该在缺少数据时失败", async () => {
      await expect(skill.execute({})).rejects.toThrow("Missing required parameter: data");
    });

    it("应该优雅地处理无效的 CSV 数据", async () => {
      const result = await skill.execute({
        data: "invalid,csv,data",
        dataFormat: DataFormat.CSV,
      });

      // CSV parser is lenient and will parse any comma-separated data
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("应该生成汇总文本", async () => {
      const data = [{ value: 10 }, { value: 20 }, { value: 30 }];

      const result = await skill.execute({
        data,
        analysisType: AnalysisType.STATISTICAL,
      });

      expect(result.success).toBe(true);
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.length).toBeGreaterThan(0);
    });
  });

  describe("setters", () => {
    it("应该设置默认分析类型", () => {
      skill.setDefaultAnalysisType(AnalysisType.CORRELATION);

      expect(skill.getDefaultAnalysisType()).toBe(AnalysisType.CORRELATION);
    });

    it("应该设置默认可视化类型", () => {
      skill.setDefaultVisualization(VisualizationType.TABLE);

      expect(skill.getDefaultVisualization()).toBe(VisualizationType.TABLE);
    });

    it("应该设置最大数据点数", () => {
      skill.setMaxDataPoints(500);

      expect(skill.getMaxDataPoints()).toBe(500);
    });

    it("应该在最大数据点数无效时抛出错误", () => {
      expect(() => skill.setMaxDataPoints(0)).toThrow("Max data points must be greater than 0");
      expect(() => skill.setMaxDataPoints(-1)).toThrow("Max data points must be greater than 0");
    });
  });

  describe("toToolCall", () => {
    it("应该转换为工具调用定义", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.type).toBe("function");
      expect(toolCall.function.name).toBe("test-data-analysis");
      expect(toolCall.function.parameters.properties.data).toBeDefined();
      expect(toolCall.function.parameters.properties.analysisType).toBeDefined();
      expect(toolCall.function.parameters.properties.dataFormat).toBeDefined();
      expect(toolCall.function.parameters.properties.visualizationType).toBeDefined();
      expect(toolCall.function.parameters.properties.customMetrics).toBeDefined();
    });

    it("应该包含分析类型的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.analysisType.enum).toEqual(
        Object.values(AnalysisType),
      );
    });

    it("应该包含数据格式的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.dataFormat.enum).toEqual(
        Object.values(DataFormat),
      );
    });

    it("应该包含可视化类型的枚举值", () => {
      const toolCall = skill.toToolCall();

      expect(toolCall.function.parameters.properties.visualizationType.enum).toEqual(
        Object.values(VisualizationType),
      );
    });
  });
});
