/**
 * DataAnalysisSkill 数据分析技能
 * 支持多种数据分析类型和可视化
 */

import BaseSkill from "../BaseSkill.js";
import type { SkillConfig, SkillInput, SkillOutput } from "../Skill.js";
import { SkillType } from "../Skill.js";

/**
 * 数据分析类型
 */
export enum AnalysisType {
  STATISTICAL = "statistical",
  TREND = "trend",
  COMPARISON = "comparison",
  CORRELATION = "correlation",
  SUMMARY = "summary",
}

/**
 * 数据格式
 */
export enum DataFormat {
  JSON = "json",
  CSV = "csv",
  ARRAY = "array",
}

/**
 * 可视化类型
 */
export enum VisualizationType {
  CHART = "chart",
  TABLE = "table",
  SUMMARY = "summary",
  NONE = "none",
}

/**
 * DataAnalysisSkill 配置接口
 */
export interface DataAnalysisSkillConfig extends SkillConfig {
  type: SkillType;
  defaultAnalysisType?: AnalysisType;
  defaultVisualization?: VisualizationType;
  maxDataPoints?: number;
}

/**
 * DataAnalysisSkill 数据分析技能实现
 */
export class DataAnalysisSkill extends BaseSkill {
  private defaultAnalysisType: AnalysisType;
  private defaultVisualization: VisualizationType;
  private maxDataPoints: number;

  constructor(config: DataAnalysisSkillConfig) {
    super(config);
    this.defaultAnalysisType = config.defaultAnalysisType || AnalysisType.STATISTICAL;
    this.defaultVisualization = config.defaultVisualization || VisualizationType.SUMMARY;
    this.maxDataPoints = config.maxDataPoints || 1000;
  }

  /**
   * 执行数据分析的内部逻辑
   */
  protected async executeInternal(input: SkillInput): Promise<SkillOutput> {
    const data = input.data as any;
    const analysisType = (input.analysisType as AnalysisType) || this.defaultAnalysisType;
    const visualizationType =
      (input.visualizationType as VisualizationType) || this.defaultVisualization;
    const dataFormat = (input.dataFormat as DataFormat) || DataFormat.JSON;
    const customMetrics = (input.customMetrics as string[]) || [];

    this.log.info(
      `Analyzing data: type=${analysisType}, format=${dataFormat}, visualization=${visualizationType}`,
    );

    try {
      // 解析数据
      const parsedData = this.parseData(data, dataFormat);

      // 检查数据点数量
      if (parsedData.length > this.maxDataPoints) {
        this.log.warn(
          `Data exceeds max points: ${parsedData.length} > ${this.maxDataPoints}, truncating`,
        );
        parsedData.length = this.maxDataPoints;
      }

      // 执行分析
      const analysisResult = await this.analyzeData(parsedData, analysisType, customMetrics);

      // 生成可视化
      const visualization = this.generateVisualization(
        parsedData,
        analysisResult,
        visualizationType,
      );

      this.log.info(`Data analysis completed: ${parsedData.length} data points`);

      return {
        success: true,
        data: {
          analysisType,
          dataFormat,
          dataPointCount: parsedData.length,
          analysisResult,
          visualization,
          summary: this.generateSummary(analysisResult),
        },
      };
    } catch (error) {
      this.log.error(`Data analysis failed: ${error}`);
      throw error;
    }
  }

  /**
   * 解析数据
   */
  private parseData(data: any, format: DataFormat): any[] {
    if (format === DataFormat.ARRAY) {
      if (!Array.isArray(data)) {
        throw new Error("Data must be an array for format 'array'");
      }
      return data;
    }

    if (format === DataFormat.JSON) {
      if (typeof data === "string") {
        return JSON.parse(data);
      }
      if (Array.isArray(data)) {
        return data;
      }
      if (typeof data === "object" && data !== null) {
        return [data];
      }
      throw new Error("Invalid JSON data format");
    }

    if (format === DataFormat.CSV) {
      if (typeof data !== "string") {
        throw new Error("Data must be a string for format 'csv'");
      }
      return this.parseCSV(data);
    }

    throw new Error(`Unsupported data format: ${format}`);
  }

  /**
   * 解析 CSV 数据
   */
  private parseCSV(csv: string): any[] {
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());
    const result: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: any = {};
      for (let j = 0; j < headers.length; j++) {
        // 尝试转换为数字
        const numValue = Number(values[j]);
        row[headers[j]] = isNaN(numValue) ? values[j] : numValue;
      }
      result.push(row);
    }

    return result;
  }

  /**
   * 分析数据
   */
  private async analyzeData(
    data: any[],
    analysisType: AnalysisType,
    customMetrics: string[],
  ): Promise<any> {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 300));

    const result: any = {
      type: analysisType,
      timestamp: new Date().toISOString(),
    };

    switch (analysisType) {
      case AnalysisType.STATISTICAL:
        result.statistics = this.calculateStatistics(data);
        break;

      case AnalysisType.TREND:
        result.trend = this.calculateTrend(data);
        break;

      case AnalysisType.COMPARISON:
        result.comparison = this.calculateComparison(data);
        break;

      case AnalysisType.CORRELATION:
        result.correlation = this.calculateCorrelation(data);
        break;

      case AnalysisType.SUMMARY:
        result.summary = this.calculateSummary(data);
        break;

      default:
        throw new Error(`Unsupported analysis type: ${analysisType}`);
    }

    // 添加自定义指标
    if (customMetrics.length > 0) {
      result.customMetrics = this.calculateCustomMetrics(data, customMetrics);
    }

    return result;
  }

  /**
   * 计算统计指标
   */
  private calculateStatistics(data: any[]): any {
    const numericFields = this.getNumericFields(data);
    const statistics: any = {};

    for (const field of numericFields) {
      const values = data.map((d) => d[field]).filter((v) => typeof v === "number");
      if (values.length === 0) continue;

      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const median =
        values.length % 2 === 0
          ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
          : sorted[Math.floor(values.length / 2)];

      statistics[field] = {
        count: values.length,
        sum,
        mean,
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        range: sorted[sorted.length - 1] - sorted[0],
      };
    }

    return statistics;
  }

  /**
   * 计算趋势
   */
  private calculateTrend(data: any[]): any {
    const numericFields = this.getNumericFields(data);
    const trend: any = {};

    for (const field of numericFields) {
      const values = data
        .map((d, i) => ({ index: i, value: d[field] }))
        .filter((v) => typeof v.value === "number");

      if (values.length < 2) continue;

      // 简单线性回归计算趋势
      const n = values.length;
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0;

      for (const { index, value } of values) {
        sumX += index;
        sumY += value;
        sumXY += index * value;
        sumX2 += index * index;
      }

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      trend[field] = {
        slope,
        intercept,
        direction: slope > 0 ? "increasing" : slope < 0 ? "decreasing" : "stable",
        confidence: Math.min(Math.abs(slope) * 10, 1),
      };
    }

    return trend;
  }

  /**
   * 计算比较
   */
  private calculateComparison(data: any[]): any {
    const numericFields = this.getNumericFields(data);
    const comparison: any = {};

    if (numericFields.length >= 2) {
      const field1 = numericFields[0];
      const field2 = numericFields[1];

      const values1 = data.map((d) => d[field1]).filter((v) => typeof v === "number");
      const values2 = data.map((d) => d[field2]).filter((v) => typeof v === "number");

      const avg1 = values1.reduce((a, b) => a + b, 0) / values1.length;
      const avg2 = values2.reduce((a, b) => a + b, 0) / values2.length;

      comparison.comparison = {
        fields: [field1, field2],
        averages: [avg1, avg2],
        difference: avg2 - avg1,
        ratio: avg1 !== 0 ? avg2 / avg1 : null,
      };
    }

    return comparison;
  }

  /**
   * 计算相关性
   */
  private calculateCorrelation(data: any[]): any {
    const numericFields = this.getNumericFields(data);
    const correlation: any = {};

    if (numericFields.length >= 2) {
      const field1 = numericFields[0];
      const field2 = numericFields[1];

      const pairs = data
        .map((d) => ({ x: d[field1], y: d[field2] }))
        .filter((p) => typeof p.x === "number" && typeof p.y === "number");

      if (pairs.length > 1) {
        const n = pairs.length;
        let sumX = 0,
          sumY = 0,
          sumXY = 0,
          sumX2 = 0,
          sumY2 = 0;

        for (const { x, y } of pairs) {
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumX2 += x * x;
          sumY2 += y * y;
        }

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const coefficient = denominator !== 0 ? numerator / denominator : 0;

        correlation.correlation = {
          fields: [field1, field2],
          coefficient,
          strength:
            Math.abs(coefficient) > 0.7
              ? "strong"
              : Math.abs(coefficient) > 0.3
                ? "moderate"
                : "weak",
          direction: coefficient > 0 ? "positive" : coefficient < 0 ? "negative" : "none",
        };
      }
    }

    return correlation;
  }

  /**
   * 计算摘要
   */
  private calculateSummary(data: any[]): any {
    return {
      totalRecords: data.length,
      fields: Object.keys(data[0] || {}),
      sampleData: data.slice(0, 3),
    };
  }

  /**
   * 计算自定义指标
   */
  private calculateCustomMetrics(data: any[], metrics: string[]): any {
    const customMetrics: any = {};

    for (const metric of metrics) {
      // 这里可以根据实际需求实现自定义指标计算
      customMetrics[metric] = `Custom metric "${metric}" calculated`;
    }

    return customMetrics;
  }

  /**
   * 获取数值字段
   */
  private getNumericFields(data: any[]): string[] {
    if (data.length === 0) return [];

    const sample = data[0];
    return Object.keys(sample).filter((key) => typeof sample[key] === "number");
  }

  /**
   * 生成可视化
   */
  private generateVisualization(data: any[], analysisResult: any, type: VisualizationType): any {
    switch (type) {
      case VisualizationType.TABLE:
        return {
          type: "table",
          headers: Object.keys(data[0] || {}),
          rows: data.slice(0, 10),
        };

      case VisualizationType.CHART:
        return {
          type: "chart",
          data: data.slice(0, 20),
          analysis: analysisResult,
        };

      case VisualizationType.SUMMARY:
        return {
          type: "summary",
          analysis: analysisResult,
        };

      case VisualizationType.NONE:
        return null;

      default:
        throw new Error(`Unsupported visualization type: ${type}`);
    }
  }

  /**
   * 生成摘要文本
   */
  private generateSummary(analysisResult: any): string {
    const summaries: string[] = [];

    if (analysisResult.statistics) {
      summaries.push("Statistical analysis completed successfully.");
    }

    if (analysisResult.trend) {
      const trends = Object.entries(analysisResult.trend).map(
        ([field, t]: [string, any]) => `${field}: ${t.direction}`,
      );
      summaries.push(`Trends: ${trends.join(", ")}.`);
    }

    if (analysisResult.correlation) {
      summaries.push("Correlation analysis completed.");
    }

    return summaries.join(" ") || "Analysis completed.";
  }

  /**
   * 获取默认分析类型
   */
  getDefaultAnalysisType(): AnalysisType {
    return this.defaultAnalysisType;
  }

  /**
   * 设置默认分析类型
   */
  setDefaultAnalysisType(type: AnalysisType): void {
    this.defaultAnalysisType = type;
    this.log.debug(`Default analysis type set to: ${type}`);
  }

  /**
   * 获取默认可视化类型
   */
  getDefaultVisualization(): VisualizationType {
    return this.defaultVisualization;
  }

  /**
   * 设置默认可视化类型
   */
  setDefaultVisualization(type: VisualizationType): void {
    this.defaultVisualization = type;
    this.log.debug(`Default visualization type set to: ${type}`);
  }

  /**
   * 获取最大数据点数
   */
  getMaxDataPoints(): number {
    return this.maxDataPoints;
  }

  /**
   * 设置最大数据点数
   */
  setMaxDataPoints(maxDataPoints: number): void {
    if (maxDataPoints <= 0) {
      throw new Error("Max data points must be greater than 0");
    }
    this.maxDataPoints = maxDataPoints;
    this.log.debug(`Max data points set to: ${maxDataPoints}`);
  }
}

/**
 * 创建 DataAnalysisSkill 的工厂函数
 */
export function createDataAnalysisSkill(
  config?: Partial<DataAnalysisSkillConfig>,
): DataAnalysisSkill {
  return new DataAnalysisSkill({
    id: config?.id || "data_analysis",
    name: config?.name || "Data Analysis",
    description: config?.description || "Analyze data and generate insights",
    type: config?.type || SkillType.DATA_ANALYSIS,
    version: config?.version || "1.0.0",
    parameters: [
      {
        name: "data",
        type: "any",
        description: "The data to analyze (JSON string, CSV string, array, or object)",
        required: true,
      },
      {
        name: "analysisType",
        type: "string",
        description: "The type of analysis to perform",
        required: false,
        enum: Object.values(AnalysisType),
      },
      {
        name: "dataFormat",
        type: "string",
        description: "The format of the input data",
        required: false,
        enum: Object.values(DataFormat),
      },
      {
        name: "visualizationType",
        type: "string",
        description: "The type of visualization to generate",
        required: false,
        enum: Object.values(VisualizationType),
      },
      {
        name: "customMetrics",
        type: "array",
        description: "Custom metrics to calculate",
        required: false,
      },
    ],
    timeout: config?.timeout || 30000,
    metadata: config?.metadata || {},
    defaultAnalysisType: config?.defaultAnalysisType,
    defaultVisualization: config?.defaultVisualization,
    maxDataPoints: config?.maxDataPoints,
  });
}

export default DataAnalysisSkill;
