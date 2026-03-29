/**
 * PushWorkflow
 * 推送流程
 * 话题生成和筛选
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { PushService, type Topic, type PushResult } from "../services/PushService.js";

/**
 * 话题生成配置接口
 */
export interface TopicGenerationConfig {
  source: string;
  count: number;
  category?: string;
  tags?: string[];
  minRelevanceScore?: number;
  enableAIGeneration?: boolean;
  aiPrompt?: string;
}

/**
 * 话题筛选配置接口
 */
export interface TopicFilterConfig {
  maxTopics?: number;
  minRelevanceScore?: number;
  categories?: string[];
  tags?: string[];
  keywords?: string[];
  customFilter?: (topic: Topic) => boolean;
}

/**
 * 推送工作流配置接口
 */
export interface PushWorkflowConfig {
  enableTopicGeneration?: boolean;
  enableTopicFiltering?: boolean;
  enableAIGeneration?: boolean;
  defaultMaxTopics?: number;
  defaultMinRelevanceScore?: number;
}

/**
 * 推送工作流结果接口
 */
export interface PushWorkflowResult {
  generatedTopics: Topic[];
  filteredTopics: Topic[];
  pushedResults: PushResult[];
  totalExecutionTime: number;
  success: boolean;
  error?: string;
}

/**
 * 推送工作流类
 */
export class PushWorkflow {
  private pushService: PushService;
  private config: Required<PushWorkflowConfig>;
  private log: ReturnType<typeof logger.withContext>;
  private workflowHistory: PushWorkflowResult[] = [];

  constructor(pushService?: PushService, config: PushWorkflowConfig = {}) {
    this.pushService = pushService || new PushService();
    this.config = {
      enableTopicGeneration: true,
      enableTopicFiltering: true,
      enableAIGeneration: false,
      defaultMaxTopics: 10,
      defaultMinRelevanceScore: 0.6,
      ...config,
    };

    this.log = logger.withContext({ component: "PushWorkflow" });
    this.log.debug(`PushWorkflow initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * 执行完整的推送工作流
   */
  async executePushWorkflow(
    userId: string,
    topicGenerationConfig: TopicGenerationConfig,
    filterConfig?: TopicFilterConfig,
  ): Promise<PushWorkflowResult> {
    const startTime = Date.now();

    try {
      this.log.info(`Starting push workflow for user: ${userId}`);

      // 1. 生成话题
      let generatedTopics: Topic[] = [];
      if (this.config.enableTopicGeneration) {
        generatedTopics = await this.generateTopics(topicGenerationConfig);
        this.log.info(`Generated ${generatedTopics.length} topics`);
      }

      // 2. 筛选话题
      let filteredTopics: Topic[] = [...generatedTopics];
      if (this.config.enableTopicFiltering && filterConfig) {
        filteredTopics = await this.filterTopics(generatedTopics, filterConfig);
        this.log.info(`Filtered to ${filteredTopics.length} topics`);
      }

      // 3. 推送话题
      let pushedResults: PushResult[] = [];
      if (filteredTopics.length > 0) {
        pushedResults = await this.pushTopicsToUser(userId, filteredTopics);
        const successCount = pushedResults.filter((r) => r.success).length;
        this.log.info(`Pushed ${successCount}/${pushedResults.length} topics to user: ${userId}`);
      }

      const totalExecutionTime = Date.now() - startTime;
      const result: PushWorkflowResult = {
        generatedTopics,
        filteredTopics,
        pushedResults,
        totalExecutionTime,
        success: true,
      };

      this.recordResult(result);
      this.log.info(`Push workflow completed for user: ${userId} (${totalExecutionTime}ms)`);

      return result;
    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: PushWorkflowResult = {
        generatedTopics: [],
        filteredTopics: [],
        pushedResults: [],
        totalExecutionTime,
        success: false,
        error: errorMessage,
      };

      this.recordResult(result);
      this.log.error(`Push workflow failed for user: ${userId}`, { error: errorMessage });

      throw new AppError(
        `Push workflow failed: ${errorMessage}`,
        ErrorCode.AGENT_EXECUTION_ERROR,
        500,
      );
    }
  }

  /**
   * 生成话题
   */
  async generateTopics(config: TopicGenerationConfig): Promise<Topic[]> {
    this.log.info(`Generating ${config.count} topics from source: ${config.source}`);

    const topics: Topic[] = [];

    if (config.enableAIGeneration && config.aiPrompt) {
      // 使用 AI 生成话题
      const aiTopics = await this.generateTopicsWithAI(config);
      topics.push(...aiTopics);
    } else {
      // 使用规则生成话题
      const ruleTopics = await this.generateTopicsWithRules(config);
      topics.push(...ruleTopics);
    }

    // 添加话题到推送服务
    for (const topic of topics) {
      this.pushService.addTopic(topic);
    }

    this.log.info(`Generated ${topics.length} topics`);
    return topics;
  }

  /**
   * 使用 AI 生成话题
   */
  private async generateTopicsWithAI(config: TopicGenerationConfig): Promise<Topic[]> {
    this.log.debug(`AI topic generation with prompt: ${config.aiPrompt}`);

    try {
      // 这里可以集成 LLM 服务
      // 暂时使用智能规则模拟 AI 生成
      const topics: Topic[] = [];
      const baseContent = config.source;
      const prompt = config.aiPrompt || "";

      // 分析源内容，提取关键信息
      const keywords = this.extractKeywords(baseContent);
      const sentences = this.splitIntoSentences(baseContent);

      // 生成多个话题
      for (let i = 0; i < config.count; i++) {
        // 根据提示词和索引选择不同的生成策略
        let title: string;
        let content: string;
        let relevanceScore: number;

        if (i === 0) {
          // 第一个话题：摘要
          title = `${baseContent.substring(0, 30)}...`;
          content = this.generateSummary(baseContent);
          relevanceScore = 0.9;
        } else if (i < sentences.length) {
          // 后续话题：基于句子
          title = `${keywords[i % keywords.length]}相关话题`;
          content = sentences[i % sentences.length];
          relevanceScore = 0.7 + Math.random() * 0.2;
        } else {
          // 额外话题：基于关键词
          title = `${keywords[i % keywords.length]}深度解析`;
          content = `关于${keywords[i % keywords.length]}的详细分析：${baseContent.substring(0, 50)}...`;
          relevanceScore = 0.6 + Math.random() * 0.2;
        }

        // 根据提示词调整内容
        if (prompt.includes("简短") || prompt.includes("short")) {
          content = content.substring(0, 100) + "...";
        } else if (prompt.includes("详细") || prompt.includes("detail")) {
          content = `${content}\n\n详细说明：${baseContent}`;
        }

        const topic: Topic = {
          id: `topic-${Date.now()}-${i}`,
          title,
          content,
          source: config.source,
          category: config.category || "ai-generated",
          tags: [...(config.tags || ["ai", "generated"]), keywords[i % keywords.length]],
          priority: Math.floor(Math.random() * 10) + 1,
          relevanceScore,
          createdAt: new Date(),
          metadata: {
            aiGenerated: true,
            prompt: config.aiPrompt,
            keywords: keywords.slice(0, 3),
          },
        };
        topics.push(topic);
      }

      return topics;
    } catch (error) {
      this.log.error("AI topic generation failed", { error });
      throw new AppError(
        `AI topic generation failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.AGENT_EXECUTION_ERROR,
        500,
      );
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    // 简单的关键词提取逻辑
    const words = content
      .split(/[\s,，.。!！?？;；:：]/)
      .filter((word) => word.length > 1)
      .slice(0, 10);
    return words;
  }

  /**
   * 分割成句子
   */
  private splitIntoSentences(content: string): string[] {
    // 简单的句子分割逻辑
    return content.split(/[.。!！?？]/).filter((sentence) => sentence.trim().length > 0);
  }

  /**
   * 生成摘要
   */
  private generateSummary(content: string): string {
    // 简单的摘要生成逻辑
    const sentences = this.splitIntoSentences(content);
    if (sentences.length <= 2) {
      return content;
    }
    return sentences.slice(0, 2).join("。") + "。";
  }

  /**
   * 使用规则生成话题
   */
  private async generateTopicsWithRules(config: TopicGenerationConfig): Promise<Topic[]> {
    this.log.debug("Rule-based topic generation");

    const topics: Topic[] = [];
    const baseContent = config.source;

    // 生成多个话题
    for (let i = 0; i < config.count; i++) {
      const topic: Topic = {
        id: `topic-${Date.now()}-${i}`,
        title: `${baseContent.substring(0, 20)}... (${i + 1})`,
        content: `${baseContent} - Rule generated content ${i + 1}`,
        source: config.source,
        category: config.category || "rule-generated",
        tags: config.tags || ["rule", "generated"],
        priority: Math.floor(Math.random() * 10) + 1,
        relevanceScore: Math.random() * 0.5 + 0.5, // 0.5-1.0
        createdAt: new Date(),
      };
      topics.push(topic);
    }

    return topics;
  }

  /**
   * 筛选话题
   */
  async filterTopics(topics: Topic[], config: TopicFilterConfig): Promise<Topic[]> {
    this.log.info(`Filtering ${topics.length} topics`);

    let filtered = [...topics];

    // 按数量筛选
    const maxTopics = config.maxTopics || this.config.defaultMaxTopics;
    if (filtered.length > maxTopics) {
      // 按相关性分数排序
      filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
      filtered = filtered.slice(0, maxTopics);
    }

    // 按相关性分数筛选
    const minRelevanceScore = config.minRelevanceScore || this.config.defaultMinRelevanceScore;
    filtered = filtered.filter((topic) => topic.relevanceScore >= minRelevanceScore);

    // 按类别筛选
    if (config.categories && config.categories.length > 0) {
      filtered = filtered.filter((topic) => config.categories!.includes(topic.category));
    }

    // 按标签筛选
    if (config.tags && config.tags.length > 0) {
      filtered = filtered.filter((topic) => topic.tags.some((tag) => config.tags!.includes(tag)));
    }

    // 按关键词筛选
    if (config.keywords && config.keywords.length > 0) {
      filtered = filtered.filter((topic) =>
        config.keywords!.some(
          (keyword) =>
            topic.title.toLowerCase().includes(keyword.toLowerCase()) ||
            topic.content.toLowerCase().includes(keyword.toLowerCase()),
        ),
      );
    }

    // 自定义筛选
    if (config.customFilter) {
      filtered = filtered.filter(config.customFilter);
    }

    this.log.info(`Filtered to ${filtered.length} topics`);
    return filtered;
  }

  /**
   * 推送话题给用户
   */
  async pushTopicsToUser(userId: string, topics: Topic[]): Promise<PushResult[]> {
    this.log.info(`Pushing ${topics.length} topics to user: ${userId}`);

    const results: PushResult[] = [];
    const successfullyAddedTopics: Topic[] = [];

    for (const topic of topics) {
      try {
        // 将话题添加到推送服务
        this.pushService.addTopic(topic);
        successfullyAddedTopics.push(topic);
      } catch (error) {
        const errorResult: PushResult = {
          success: false,
          topicId: topic.id,
          userId,
          channel: "unknown",
          timestamp: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(errorResult);
        continue;
      }
    }

    // 推送该用户的所有话题
    if (successfullyAddedTopics.length > 0) {
      try {
        const userResults = await this.pushService.pushTopicsToUser(userId);
        results.push(...userResults);
      } catch (error) {
        this.log.error(`Failed to push topics to user: ${userId}`, { error });
      }
    }

    return results;
  }

  /**
   * 获取工作流历史
   */
  getWorkflowHistory(): PushWorkflowResult[] {
    return [...this.workflowHistory];
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalWorkflows: number;
    successfulWorkflows: number;
    failedWorkflows: number;
    averageExecutionTime: number;
    totalTopicsGenerated: number;
    totalTopicsPushed: number;
  } {
    const totalWorkflows = this.workflowHistory.length;
    const successfulWorkflows = this.workflowHistory.filter((r) => r.success).length;
    const failedWorkflows = totalWorkflows - successfulWorkflows;
    const averageExecutionTime =
      totalWorkflows > 0
        ? this.workflowHistory.reduce((sum, r) => sum + r.totalExecutionTime, 0) / totalWorkflows
        : 0;
    const totalTopicsGenerated = this.workflowHistory.reduce(
      (sum, r) => sum + r.generatedTopics.length,
      0,
    );
    const totalTopicsPushed = this.workflowHistory.reduce(
      (sum, r) => sum + r.pushedResults.filter((p) => p.success).length,
      0,
    );

    return {
      totalWorkflows,
      successfulWorkflows,
      failedWorkflows,
      averageExecutionTime,
      totalTopicsGenerated,
      totalTopicsPushed,
    };
  }

  /**
   * 记录结果
   */
  private recordResult(result: PushWorkflowResult): void {
    this.workflowHistory.push(result);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.workflowHistory = [];
    this.log.debug("PushWorkflow cleaned up");
  }
}
