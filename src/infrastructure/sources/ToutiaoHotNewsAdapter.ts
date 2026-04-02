/**
 * 今日头条热点适配器
 * 从今日头条热点新闻抓取热门话题
 */

import { BaseTopicSourceAdapter, type RawTopic } from "./TopicSourceAdapter.js";
import { logger } from "@/shared/utils/logger.js";

export class ToutiaoHotNewsAdapter extends BaseTopicSourceAdapter {
  public readonly name = "toutiao";
  public readonly url = "https://www.toutiao.com/hot-event/hot-board";
  public readonly enabled = true;

  /**
   * 抓取今日头条热点数据
   */
  protected async doFetchTopics(): Promise<RawTopic[]> {
    // 注意：这里是一个模拟实现
    // 在实际生产环境中，需要使用 HTTP 客户端抓取真实数据
    // 由于今日头条需要处理反爬机制，这里返回模拟数据用于演示

    const mockTopics = [
      {
        title: "全球科技新闻汇总",
        score: 0.9,
        categories: ["科技", "新闻", "全球"],
        url: "https://www.toutiao.com/search?keyword=%E7%A7%91%E6%8A%80",
      },
      {
        title: "国内经济形势分析",
        score: 0.83,
        categories: ["经济", "国内", "分析"],
        url: "https://www.toutiao.com/search?keyword=%E7%BB%8F%E6%B5%8E",
      },
      {
        title: "教育改革新政策",
        score: 0.76,
        categories: ["教育", "政策", "改革"],
        url: "https://www.toutiao.com/search?keyword=%E6%95%99%E8%82%B2",
      },
      {
        title: "环保与可持续发展",
        score: 0.7,
        categories: ["环保", "可持续", "发展"],
        url: "https://www.toutiao.com/search?keyword=%E7%8E%AF%E4%BF%9D",
      },
      {
        title: "文化传承与创新",
        score: 0.63,
        categories: ["文化", "传承", "创新"],
        url: "https://www.toutiao.com/search?keyword=%E6%96%87%E5%8C%96",
      },
    ];

    logger.debug(`Fetched ${mockTopics.length} topics from Toutiao`);
    return this.filterTopics(this.limitTopics(mockTopics));
  }
}
