/**
 * PushService
 * 推送服务
 * 话题收集和过滤
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 话题接口
 */
export interface Topic {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  priority: number;
  relevanceScore: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * 推送配置接口
 */
export interface PushConfig {
  userId: string;
  topics: string[];
  channels: string[];
  filters: TopicFilter[];
  schedule?: PushSchedule;
}

/**
 * 话题过滤器接口
 */
export interface TopicFilter {
  type: "category" | "tag" | "keyword" | "relevance" | "custom";
  value: string | string[] | ((topic: Topic) => boolean);
  operator?: "include" | "exclude" | "equals" | "contains" | "greater" | "less";
}

/**
 * 推送调度接口
 */
export interface PushSchedule {
  type: "immediate" | "scheduled" | "digest";
  time?: Date;
  frequency?: "daily" | "weekly" | "monthly";
  timezone?: string;
}

/**
 * 推送结果接口
 */
export interface PushResult {
  success: boolean;
  topicId: string;
  userId: string;
  channel: string;
  timestamp: Date;
  error?: string;
}

/**
 * PushService 配置接口
 */
export interface PushServiceConfig {
  maxTopics?: number;
  maxRelevanceScore?: number;
  defaultChannels?: string[];
}

/**
 * PushService 类
 * 推送服务
 */
export class PushService {
  private topics: Map<string, Topic> = new Map();
  private pushConfigs: Map<string, PushConfig> = new Map();
  private pushHistory: PushResult[] = [];
  private config: Required<PushServiceConfig>;
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: PushServiceConfig = {}) {
    this.config = {
      maxTopics: 1000,
      maxRelevanceScore: 1.0,
      defaultChannels: ["web", "email"],
      ...config,
    };

    this.log = logger.withContext({ component: "PushService" });
    this.log.debug(`PushService initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * 添加话题
   */
  addTopic(topic: Topic): void {
    // 检查话题数量限制
    if (this.topics.size >= this.config.maxTopics) {
      throw new AppError(
        `Maximum topics limit reached: ${this.config.maxTopics}`,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        400,
      );
    }

    // 检查话题 ID 是否已存在
    if (this.topics.has(topic.id)) {
      throw new AppError(
        `Topic with id "${topic.id}" already exists`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    // 验证相关性分数
    if (topic.relevanceScore > this.config.maxRelevanceScore) {
      this.log.warn(
        `Topic relevance score exceeds limit: ${topic.relevanceScore} > ${this.config.maxRelevanceScore}`,
      );
      topic.relevanceScore = this.config.maxRelevanceScore;
    }

    this.topics.set(topic.id, topic);
    this.log.info(`Topic added: ${topic.id} (relevance: ${topic.relevanceScore})`);
  }

  /**
   * 批量添加话题
   */
  addTopics(topics: Topic[]): void {
    for (const topic of topics) {
      try {
        this.addTopic(topic);
      } catch (error) {
        this.log.error(`Failed to add topic: ${topic.id}`, error);
      }
    }
  }

  /**
   * 获取话题
   */
  getTopic(topicId: string): Topic | undefined {
    return this.topics.get(topicId);
  }

  /**
   * 获取所有话题
   */
  getAllTopics(): Topic[] {
    return Array.from(this.topics.values());
  }

  /**
   * 按类别获取话题
   */
  getTopicsByCategory(category: string): Topic[] {
    return Array.from(this.topics.values()).filter((topic) => topic.category === category);
  }

  /**
   * 按标签获取话题
   */
  getTopicsByTag(tag: string): Topic[] {
    return Array.from(this.topics.values()).filter((topic) => topic.tags.includes(tag));
  }

  /**
   * 按来源获取话题
   */
  getTopicsBySource(source: string): Topic[] {
    return Array.from(this.topics.values()).filter((topic) => topic.source === source);
  }

  /**
   * 获取高相关性话题
   */
  getHighRelevanceTopics(minScore: number = 0.7): Topic[] {
    return Array.from(this.topics.values()).filter((topic) => topic.relevanceScore >= minScore);
  }

  /**
   * 获取热门话题
   */
  getTrendingTopics(limit: number = 10): Topic[] {
    return Array.from(this.topics.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * 过滤话题
   */
  filterTopics(topics: Topic[], filters: TopicFilter[]): Topic[] {
    return topics.filter((topic) => {
      return filters.every((filter) => this.applyFilter(topic, filter));
    });
  }

  /**
   * 应用过滤器
   */
  private applyFilter(topic: Topic, filter: TopicFilter): boolean {
    const operator = filter.operator || "include";

    switch (filter.type) {
      case "category":
        if (typeof filter.value === "function") {
          return filter.value(topic);
        }
        return this.compareValue(topic.category, filter.value as string | string[], operator);

      case "tag":
        if (typeof filter.value === "function") {
          return filter.value(topic);
        }
        if (typeof filter.value === "string") {
          return operator === "include"
            ? topic.tags.includes(filter.value)
            : !topic.tags.includes(filter.value);
        }
        return false;

      case "keyword":
        if (typeof filter.value === "function") {
          return filter.value(topic);
        }
        if (typeof filter.value === "string") {
          const keywords = filter.value.toLowerCase();
          const content = topic.content.toLowerCase();
          const title = topic.title.toLowerCase();
          return operator === "contains"
            ? content.includes(keywords) || title.includes(keywords)
            : !content.includes(keywords) && !title.includes(keywords);
        }
        return false;

      case "relevance":
        if (typeof filter.value === "function") {
          return filter.value(topic);
        }
        if (typeof filter.value === "number") {
          return operator === "greater"
            ? topic.relevanceScore > filter.value
            : operator === "less"
              ? topic.relevanceScore < filter.value
              : topic.relevanceScore === filter.value;
        }
        return false;

      case "custom":
        if (typeof filter.value === "function") {
          return filter.value(topic);
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * 比较值
   */
  private compareValue(actual: string, expected: string | string[], operator: string): boolean {
    if (Array.isArray(expected)) {
      return operator === "include" ? expected.includes(actual) : !expected.includes(actual);
    }

    switch (operator) {
      case "equals":
        return actual === expected;
      case "contains":
        return actual.includes(expected);
      case "include":
        return actual === expected;
      case "exclude":
        return actual !== expected;
      default:
        return actual === expected;
    }
  }

  /**
   * 创建推送配置
   */
  createPushConfig(config: PushConfig): void {
    this.pushConfigs.set(config.userId, config);
    this.log.debug(`Push config created for user: ${config.userId}`);
  }

  /**
   * 获取推送配置
   */
  getPushConfig(userId: string): PushConfig | undefined {
    return this.pushConfigs.get(userId);
  }

  /**
   * 更新推送配置
   */
  updatePushConfig(userId: string, updates: Partial<PushConfig>): void {
    const config = this.pushConfigs.get(userId);
    if (!config) {
      throw new AppError(`Push config not found for user: ${userId}`, ErrorCode.NOT_FOUND, 404);
    }

    Object.assign(config, updates);
    this.log.debug(`Push config updated for user: ${userId}`);
  }

  /**
   * 删除推送配置
   */
  deletePushConfig(userId: string): boolean {
    return this.pushConfigs.delete(userId);
  }

  /**
   * 为用户推送话题
   */
  async pushTopicsToUser(userId: string): Promise<PushResult[]> {
    const config = this.pushConfigs.get(userId);
    if (!config) {
      throw new AppError(`Push config not found for user: ${userId}`, ErrorCode.NOT_FOUND, 404);
    }

    const results: PushResult[] = [];

    // 获取指定话题
    const topics: Topic[] = [];
    for (const topicId of config.topics) {
      const topic = this.topics.get(topicId);
      if (topic) {
        topics.push(topic);
      }
    }

    // 应用过滤器
    const filteredTopics = this.filterTopics(topics, config.filters);

    // 推送到各个渠道
    for (const topic of filteredTopics) {
      for (const channel of config.channels) {
        try {
          const result = await this.pushToChannel(topic, userId, channel);
          results.push(result);
        } catch (error) {
          this.log.error(`Failed to push topic ${topic.id} to channel ${channel}`, error);
          results.push({
            success: false,
            topicId: topic.id,
            userId,
            channel,
            timestamp: new Date(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.log.info(`Pushed ${results.length} topics to user: ${userId}`);
    return results;
  }

  /**
   * 推送到指定渠道
   */
  private async pushToChannel(topic: Topic, userId: string, channel: string): Promise<PushResult> {
    // 这里可以实现具体的推送逻辑
    // 目前只是模拟推送
    this.log.debug(`Pushing topic ${topic.id} to channel ${channel} for user ${userId}`);

    const result: PushResult = {
      success: true,
      topicId: topic.id,
      userId,
      channel,
      timestamp: new Date(),
    };

    this.pushHistory.push(result);

    return result;
  }

  /**
   * 批量推送话题
   */
  async batchPushTopics(userIds: string[]): Promise<Map<string, PushResult[]>> {
    const results = new Map<string, PushResult[]>();

    for (const userId of userIds) {
      try {
        const userResults = await this.pushTopicsToUser(userId);
        results.set(userId, userResults);
      } catch (error) {
        this.log.error(`Failed to push topics to user: ${userId}`, error);
      }
    }

    return results;
  }

  /**
   * 获取推送历史
   */
  getPushHistory(userId?: string): PushResult[] {
    if (userId) {
      return this.pushHistory.filter((result) => result.userId === userId);
    }
    return [...this.pushHistory];
  }

  /**
   * 获取推送统计
   */
  getPushStats(): {
    totalPushes: number;
    successfulPushes: number;
    failedPushes: number;
    pushesByChannel: Record<string, number>;
    pushesByUser: Record<string, number>;
  } {
    const pushesByChannel: Record<string, number> = {};
    const pushesByUser: Record<string, number> = {};

    for (const result of this.pushHistory) {
      pushesByChannel[result.channel] = (pushesByChannel[result.channel] || 0) + 1;
      pushesByUser[result.userId] = (pushesByUser[result.userId] || 0) + 1;
    }

    return {
      totalPushes: this.pushHistory.length,
      successfulPushes: this.pushHistory.filter((r) => r.success).length,
      failedPushes: this.pushHistory.filter((r) => !r.success).length,
      pushesByChannel,
      pushesByUser,
    };
  }

  /**
   * 获取话题统计
   */
  getTopicStats(): {
    totalTopics: number;
    topicsByCategory: Record<string, number>;
    topicsBySource: Record<string, number>;
    averageRelevanceScore: number;
  } {
    const topics = Array.from(this.topics.values());
    const topicsByCategory: Record<string, number> = {};
    const topicsBySource: Record<string, number> = {};
    let totalRelevanceScore = 0;

    for (const topic of topics) {
      topicsByCategory[topic.category] = (topicsByCategory[topic.category] || 0) + 1;
      topicsBySource[topic.source] = (topicsBySource[topic.source] || 0) + 1;
      totalRelevanceScore += topic.relevanceScore;
    }

    return {
      totalTopics: topics.length,
      topicsByCategory,
      topicsBySource,
      averageRelevanceScore: topics.length > 0 ? totalRelevanceScore / topics.length : 0,
    };
  }

  /**
   * 删除话题
   */
  deleteTopic(topicId: string): boolean {
    return this.topics.delete(topicId);
  }

  /**
   * 清空所有话题
   */
  clearAllTopics(): void {
    this.topics.clear();
    this.log.info("All topics cleared");
  }

  /**
   * 清空推送历史
   */
  clearPushHistory(): void {
    this.pushHistory = [];
    this.log.info("Push history cleared");
  }

  /**
   * 获取配置
   */
  getConfig(): Required<PushServiceConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<PushServiceConfig>): void {
    Object.assign(this.config, updates);
    this.log.debug(`Config updated: ${JSON.stringify(updates)}`);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.topics.clear();
    this.pushConfigs.clear();
    this.pushHistory = [];
    this.log.debug("PushService cleaned up");
  }
}

export default PushService;
