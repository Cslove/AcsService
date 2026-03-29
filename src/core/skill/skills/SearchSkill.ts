/**
 * SearchSkill 搜索技能
 * 支持多种搜索引擎和搜索类型
 */

import BaseSkill from "../BaseSkill.js";
import type { SkillConfig, SkillInput, SkillOutput } from "../Skill.js";
import { SkillType } from "../Skill.js";

/**
 * 搜索引擎类型
 */
export enum SearchEngine {
  GOOGLE = "google",
  BING = "bing",
  BAIDU = "baidu",
  DUCKDUCKGO = "duckduckgo",
}

/**
 * 搜索类型
 */
export enum SearchType {
  WEB = "web",
  NEWS = "news",
  IMAGES = "images",
  VIDEOS = "videos",
}

/**
 * SearchSkill 配置接口
 */
export interface SearchSkillConfig extends SkillConfig {
  type: SkillType;
  defaultEngine?: SearchEngine;
  defaultSearchType?: SearchType;
  maxResults?: number;
  apiKey?: string;
}

/**
 * SearchSkill 搜索技能实现
 */
export class SearchSkill extends BaseSkill {
  private defaultEngine: SearchEngine;
  private defaultSearchType: SearchType;
  private maxResults: number;
  private apiKey?: string;

  constructor(config: SearchSkillConfig) {
    super(config);
    this.defaultEngine = config.defaultEngine || SearchEngine.GOOGLE;
    this.defaultSearchType = config.defaultSearchType || SearchType.WEB;
    this.maxResults = config.maxResults || 10;
    this.apiKey = config.apiKey;
  }

  /**
   * 执行搜索的内部逻辑
   */
  protected async executeInternal(input: SkillInput): Promise<SkillOutput> {
    const query = input.query as string;
    const engine = (input.engine as SearchEngine) || this.defaultEngine;
    const searchType = (input.searchType as SearchType) || this.defaultSearchType;
    const maxResults = (input.maxResults as number) || this.maxResults;

    this.log.info(`Executing search: query="${query}", engine=${engine}, type=${searchType}`);

    try {
      // 模拟搜索结果（实际实现中应调用搜索引擎 API）
      const results = await this.performSearch(query, engine, searchType, maxResults);

      this.log.info(`Search completed: found ${results.length} results`);

      return {
        success: true,
        data: {
          query,
          engine,
          searchType,
          results,
          totalResults: results.length,
        },
      };
    } catch (error) {
      this.log.error(`Search failed: ${error}`);
      throw error;
    }
  }

  /**
   * 执行实际的搜索操作
   * TODO: 集成真实的搜索引擎 API
   */
  private async performSearch(
    query: string,
    engine: SearchEngine,
    searchType: SearchType,
    maxResults: number,
  ): Promise<
    Array<{
      title: string;
      url: string;
      snippet: string;
      publishedDate?: string;
    }>
  > {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 返回模拟结果
    return [
      {
        title: `Result 1 for "${query}"`,
        url: `https://example.com/1`,
        snippet: `This is a simulated search result for the query "${query}"`,
      },
      {
        title: `Result 2 for "${query}"`,
        url: `https://example.com/2`,
        snippet: `Another simulated search result for the query "${query}"`,
      },
      {
        title: `Result 3 for "${query}"`,
        url: `https://example.com/3`,
        snippet: `Yet another simulated search result for the query "${query}"`,
      },
    ].slice(0, maxResults);
  }

  /**
   * 获取默认搜索引擎
   */
  getDefaultEngine(): SearchEngine {
    return this.defaultEngine;
  }

  /**
   * 设置默认搜索引擎
   */
  setDefaultEngine(engine: SearchEngine): void {
    this.defaultEngine = engine;
    this.log.debug(`Default engine set to: ${engine}`);
  }

  /**
   * 获取默认搜索类型
   */
  getDefaultSearchType(): SearchType {
    return this.defaultSearchType;
  }

  /**
   * 设置默认搜索类型
   */
  setDefaultSearchType(searchType: SearchType): void {
    this.defaultSearchType = searchType;
    this.log.debug(`Default search type set to: ${searchType}`);
  }

  /**
   * 获取最大结果数
   */
  getMaxResults(): number {
    return this.maxResults;
  }

  /**
   * 设置最大结果数
   */
  setMaxResults(maxResults: number): void {
    if (maxResults <= 0) {
      throw new Error("Max results must be greater than 0");
    }
    this.maxResults = maxResults;
    this.log.debug(`Max results set to: ${maxResults}`);
  }
}

/**
 * 创建 SearchSkill 的工厂函数
 */
export function createSearchSkill(config?: Partial<SearchSkillConfig>): SearchSkill {
  return new SearchSkill({
    id: config?.id || "search",
    name: config?.name || "Search",
    description:
      config?.description || "Search the web for information using various search engines",
    type: config?.type || SkillType.SEARCH,
    version: config?.version || "1.0.0",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "The search query",
        required: true,
      },
      {
        name: "engine",
        type: "string",
        description: "The search engine to use",
        required: false,
        enum: Object.values(SearchEngine),
      },
      {
        name: "searchType",
        type: "string",
        description: "The type of search to perform",
        required: false,
        enum: Object.values(SearchType),
      },
      {
        name: "maxResults",
        type: "number",
        description: "Maximum number of results to return",
        required: false,
      },
    ],
    timeout: config?.timeout || 30000,
    metadata: config?.metadata || {},
    defaultEngine: config?.defaultEngine,
    defaultSearchType: config?.defaultSearchType,
    maxResults: config?.maxResults,
    apiKey: config?.apiKey,
  });
}

export default SearchSkill;
