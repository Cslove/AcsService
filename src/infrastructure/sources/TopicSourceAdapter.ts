/**
 * 话题源适配器接口
 * 定义从不同平台抓取热门话题的统一接口
 */

import type { Topic } from "@/shared/types/index.js";
import { logger } from "@/shared/utils/logger.js";
import { retryAsync } from "@/shared/utils/retry.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { TOPIC_COLLECTION_CONFIG } from "@/shared/constants/index.js";

/**
 * 标准化的话题数据结构
 */
export interface RawTopic {
  title: string;
  url?: string;
  score?: number;
  categories?: string[];
  metadata?: Record<string, any>;
}

/**
 * 话题源适配器接口
 */
export interface ITopicSourceAdapter {
  /**
   * 获取适配器名称
   */
  readonly name: string;

  /**
   * 获取源 URL
   */
  readonly url: string;

  /**
   * 是否启用
   */
  readonly enabled: boolean;

  /**
   * 抓取原始话题数据
   */
  fetchTopics(): Promise<RawTopic[]>;

  /**
   * 将原始数据转换为标准 Topic 格式
   */
  normalizeTopic(rawTopic: RawTopic): Topic;
}

/**
 * 抽象话题源适配器基类
 */
export abstract class BaseTopicSourceAdapter implements ITopicSourceAdapter {
  public abstract readonly name: string;
  public abstract readonly url: string;
  public abstract readonly enabled: boolean;

  /**
   * 重试配置
   */
  protected readonly retryConfig = {
    maxAttempts: 3, // 最多重试3次
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  };

  /**
   * 抓取话题数据（带重试机制）
   */
  public async fetchTopics(): Promise<RawTopic[]> {
    logger.info(`Fetching topics from ${this.name}`, { url: this.url });

    try {
      const topics = await retryAsync(() => this.doFetchTopics(), {
        ...this.retryConfig,
        shouldRetry: (error: Error) => this.shouldRetry(error),
        onRetry: (error, attempt) => {
          logger.warn(`Retry attempt ${attempt} for ${this.name}`, {
            error: error.message,
          });
        },
      });

      logger.info(`Successfully fetched ${topics.length} topics from ${this.name}`);
      return topics;
    } catch (error) {
      const appError =
        AppError instanceof Error
          ? error
          : new AppError(
              `Failed to fetch topics from ${this.name}`,
              ErrorCode.INTERNAL_ERROR,
              500,
              { originalError: String(error) },
            );
      logger.error(`Error fetching topics from ${this.name}`, appError);
      throw appError;
    }
  }

  /**
   * 实际抓取逻辑（由子类实现）
   */
  protected abstract doFetchTopics(): Promise<RawTopic[]>;

  /**
   * 标准化话题数据
   */
  public normalizeTopic(rawTopic: RawTopic): Topic {
    return {
      id: this.generateTopicId(rawTopic),
      title: rawTopic.title,
      description: rawTopic.title, // 默认使用标题作为描述
      source: this.name,
      url: rawTopic.url,
      score: this.calculateScore(rawTopic),
      categories: rawTopic.categories || [],
      createdAt: new Date(),
    };
  }

  /**
   * 生成话题 ID
   */
  protected generateTopicId(rawTopic: RawTopic): string {
    const baseId = `${this.name}-${rawTopic.title}`;
    return Buffer.from(baseId).toString("base64").substring(0, 32);
  }

  /**
   * 计算话题分数
   */
  protected calculateScore(rawTopic: RawTopic): number {
    if (rawTopic.score !== undefined) {
      return Math.min(Math.max(rawTopic.score, 0), 1);
    }
    return 0.5; // 默认分数
  }

  /**
   * 判断是否应该重试
   */
  protected shouldRetry(error: Error): boolean {
    const retryableErrors = ["ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "timeout", "network"];
    return retryableErrors.some((keyword) =>
      error.message.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  /**
   * 过滤低质量话题
   */
  protected filterTopics(topics: RawTopic[]): RawTopic[] {
    return topics.filter((topic) => {
      const score = this.calculateScore(topic);
      return score >= TOPIC_COLLECTION_CONFIG.MIN_SCORE_THRESHOLD;
    });
  }

  /**
   * 限制话题数量
   */
  protected limitTopics(topics: RawTopic[]): RawTopic[] {
    return topics.slice(0, TOPIC_COLLECTION_CONFIG.MAX_TOPICS_PER_SOURCE);
  }
}

/**
 * 话题源适配器管理器
 */
export class TopicSourceAdapterManager {
  private adapters: Map<string, ITopicSourceAdapter> = new Map();

  /**
   * 注册适配器
   */
  public register(adapter: ITopicSourceAdapter): void {
    this.adapters.set(adapter.name, adapter);
    logger.info(`Registered topic source adapter: ${adapter.name}`);
  }

  /**
   * 获取适配器
   */
  public get(name: string): ITopicSourceAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * 获取所有启用的适配器
   */
  public getEnabledAdapters(): ITopicSourceAdapter[] {
    return Array.from(this.adapters.values()).filter((adapter) => adapter.enabled);
  }

  /**
   * 移除适配器
   */
  public unregister(name: string): void {
    this.adapters.delete(name);
    logger.info(`Unregistered topic source adapter: ${name}`);
  }

  /**
   * 获取所有适配器
   */
  public getAll(): ITopicSourceAdapter[] {
    return Array.from(this.adapters.values());
  }
}
