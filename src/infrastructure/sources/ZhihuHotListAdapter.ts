/**
 * 知乎热榜适配器
 * 从知乎热榜抓取热门话题
 */

import { BaseTopicSourceAdapter, type RawTopic } from "./TopicSourceAdapter.js";
import { logger } from "@/shared/utils/logger.js";

export class ZhihuHotListAdapter extends BaseTopicSourceAdapter {
  public readonly name = "zhihu";
  public readonly url = "https://www.zhihu.com/hot";
  public readonly enabled = true;

  /**
   * 抓取知乎热榜数据
   */
  protected async doFetchTopics(): Promise<RawTopic[]> {
    // 注意：这里是一个模拟实现
    // 在实际生产环境中，需要使用 HTTP 客户端抓取真实数据
    // 由于知乎需要处理反爬机制，这里返回模拟数据用于演示

    const mockTopics = [
      {
        title: "人工智能的最新发展趋势",
        score: 0.92,
        categories: ["科技", "AI", "人工智能"],
        url: "https://www.zhihu.com/search?q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD",
      },
      {
        title: "如何提高工作效率",
        score: 0.85,
        categories: ["职场", "效率", "方法"],
        url: "https://www.zhihu.com/search?q=%E5%B7%A5%E4%BD%9C%E6%95%88%E7%8E%87",
      },
      {
        title: "健康生活的十个习惯",
        score: 0.78,
        categories: ["健康", "生活", "养生"],
        url: "https://www.zhihu.com/search?q=%E5%81%A5%E5%BA%B7%E7%94%9F%E6%B4%BB",
      },
      {
        title: "编程学习路线推荐",
        score: 0.72,
        categories: ["技术", "编程", "学习"],
        url: "https://www.zhihu.com/search?q=%E7%BC%96%E7%A8%8B%E5%AD%A6%E4%B9%A0",
      },
      {
        title: "理财入门指南",
        score: 0.65,
        categories: ["理财", "金融", "投资"],
        url: "https://www.zhihu.com/search?q=%E7%90%86%E8%B4%A2%E5%85%A5%E9%97%A8",
      },
    ];

    logger.debug(`Fetched ${mockTopics.length} topics from Zhihu`);
    return this.filterTopics(this.limitTopics(mockTopics));
  }
}
