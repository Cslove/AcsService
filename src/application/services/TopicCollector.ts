/**
 * 话题收集服务
 * 管理多个话题源适配器，定时抓取各平台热搜数据
 */

import type { Topic } from "@/shared/types/index.js";
import { logger } from "@/shared/utils/logger.js";
import { CacheManager } from "@/infrastructure/storage/cache/CacheManager.js";
import {
  TopicSourceAdapterManager,
  type ITopicSourceAdapter,
} from "@/infrastructure/sources/TopicSourceAdapter.js";
import { TOPIC_COLLECTION_CONFIG } from "@/shared/constants/index.js";
import { PushService } from "./PushService.js";

export class TopicCollector {
  private adapterManager: TopicSourceAdapterManager;
  private cacheManager: CacheManager<{ topics: Topic[]; timestamp: number }>;
  private pushService: PushService;
  private initialized: boolean = false;

  constructor(
    pushService: PushService,
    cacheManager?: CacheManager<{ topics: Topic[]; timestamp: number }>,
  ) {
    this.pushService = pushService;
    this.adapterManager = new TopicSourceAdapterManager();
    this.cacheManager =
      cacheManager ||
      new CacheManager<{ topics: Topic[]; timestamp: number }>({
        memory: {
          maxSize: 100,
          maxAge: TOPIC_COLLECTION_CONFIG.REFRESH_INTERVAL / 1000,
        },
      });
  }

  /**
   * 初始化（注册默认适配器）
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.registerDefaultAdapters();
    this.initialized = true;
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 注册默认适配器
   */
  private async registerDefaultAdapters(): Promise<void> {
    const { WeiboHotSearchAdapter } =
      await import("@/infrastructure/sources/WeiboHotSearchAdapter.js");
    const { ZhihuHotListAdapter } = await import("@/infrastructure/sources/ZhihuHotListAdapter.js");
    const { ToutiaoHotNewsAdapter } =
      await import("@/infrastructure/sources/ToutiaoHotNewsAdapter.js");

    this.adapterManager.register(new WeiboHotSearchAdapter());
    this.adapterManager.register(new ZhihuHotListAdapter());
    this.adapterManager.register(new ToutiaoHotNewsAdapter());

    logger.info("Registered default topic source adapters");
  }

  /**
   * 注册自定义适配器
   */
  public registerAdapter(adapter: ITopicSourceAdapter): void {
    this.adapterManager.register(adapter);
  }

  /**
   * 从所有启用的源收集话题
   */
  public async collectTopics(): Promise<Topic[]> {
    await this.ensureInitialized();
    logger.info("Starting topic collection from all sources");

    const enabledAdapters = this.adapterManager.getEnabledAdapters();
    const allTopics: Topic[] = [];

    // 并发抓取所有源
    const collectionPromises = enabledAdapters.map(async (adapter) => {
      try {
        logger.info(`Collecting topics from ${adapter.name}`);
        const rawTopics = await adapter.fetchTopics();
        const normalizedTopics = rawTopics.map((rawTopic) => adapter.normalizeTopic(rawTopic));
        logger.info(`Collected ${normalizedTopics.length} topics from ${adapter.name}`);
        return normalizedTopics;
      } catch (error) {
        logger.error(`Failed to collect topics from ${adapter.name}`, error);
        return [];
      }
    });

    const results = await Promise.all(collectionPromises);

    // 合并所有话题
    results.forEach((topics) => {
      allTopics.push(...topics);
    });

    // 数据清洗和去重
    const cleanedTopics = this.cleanAndDeduplicateTopics(allTopics);

    // 缓存结果
    await this.cacheResults(cleanedTopics);

    // 添加到话题池
    for (const topic of cleanedTopics) {
      try {
        this.pushService.addTopic(this.convertToPushServiceTopic(topic));
      } catch (error) {
        logger.error(`Failed to add topic to pool: ${topic.title}`, error);
      }
    }

    logger.info(`Topic collection completed. Total topics: ${cleanedTopics.length}`);
    return cleanedTopics;
  }

  /**
   * 从指定源收集话题
   */
  public async collectFromSource(sourceName: string): Promise<Topic[]> {
    await this.ensureInitialized();
    logger.info(`Collecting topics from source: ${sourceName}`);

    const adapter = this.adapterManager.get(sourceName);
    if (!adapter) {
      logger.warn(`Adapter not found for source: ${sourceName}`);
      return [];
    }

    try {
      const rawTopics = await adapter.fetchTopics();
      const normalizedTopics = rawTopics.map((rawTopic) => adapter.normalizeTopic(rawTopic));

      logger.info(`Collected ${normalizedTopics.length} topics from ${sourceName}`);
      return normalizedTopics;
    } catch (error) {
      logger.error(`Failed to collect topics from ${sourceName}`, error);
      return [];
    }
  }

  /**
   * 数据清洗和去重
   */
  private cleanAndDeduplicateTopics(topics: Topic[]): Topic[] {
    const topicMap = new Map<string, Topic>();

    for (const topic of topics) {
      // 使用标题作为去重键（可以改进为更智能的去重逻辑）
      const key = this.normalizeTitle(topic.title);

      // 如果已存在，保留分数更高的
      if (topicMap.has(key)) {
        const existing = topicMap.get(key)!;
        if (topic.score > existing.score) {
          topicMap.set(key, topic);
        }
      } else {
        topicMap.set(key, topic);
      }
    }

    const deduplicated = Array.from(topicMap.values());

    logger.debug(`Deduplicated topics: ${topics.length} -> ${deduplicated.length}`);

    return deduplicated;
  }

  /**
   * 标准化标题用于去重
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^\w\u4e00-\u9fa5]/g, "");
  }

  /**
   * 缓存抓取结果
   */
  private async cacheResults(topics: Topic[]): Promise<void> {
    const cacheKey = "topics:latest";
    const cacheValue = {
      topics,
      timestamp: Date.now(),
    };

    await this.cacheManager.set(
      cacheKey,
      cacheValue,
      TOPIC_COLLECTION_CONFIG.REFRESH_INTERVAL / 1000,
    );

    logger.debug(`Cached ${topics.length} topics`);
  }

  /**
   * 获取缓存的话题
   */
  public async getCachedTopics(): Promise<Topic[]> {
    await this.ensureInitialized();
    const cacheKey = "topics:latest";
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      logger.debug(`Retrieved ${cached.topics.length} topics from cache`);
      return cached.topics;
    }

    return [];
  }

  /**
   * 获取所有注册的适配器
   */
  public async getRegisteredAdapters(): Promise<ITopicSourceAdapter[]> {
    await this.ensureInitialized();
    return this.adapterManager.getAll();
  }

  /**
   * 获取启用的适配器
   */
  public async getEnabledAdapters(): Promise<ITopicSourceAdapter[]> {
    await this.ensureInitialized();
    return this.adapterManager.getEnabledAdapters();
  }

  /**
   * 将共享类型的 Topic 转换为 PushService 的 Topic
   */
  private convertToPushServiceTopic(topic: Topic): {
    id: string;
    title: string;
    content: string;
    source: string;
    category: string;
    tags: string[];
    priority: number;
    relevanceScore: number;
    createdAt: Date;
  } {
    return {
      id: topic.id,
      title: topic.title,
      content: topic.description || topic.title,
      source: topic.source,
      category: topic.categories[0] || "general",
      tags: topic.categories,
      priority: Math.floor(topic.score * 10),
      relevanceScore: topic.score,
      createdAt: topic.createdAt,
    };
  }
}
