/**
 * 微博热搜适配器
 * 从微博热搜榜单抓取热门话题
 */

import { BaseTopicSourceAdapter, type RawTopic } from "./TopicSourceAdapter.js";
import { logger } from "@/shared/utils/logger.js";

export class WeiboHotSearchAdapter extends BaseTopicSourceAdapter {
  public readonly name = "weibo";
  public readonly url = "https://s.weibo.com/top/summary";
  public readonly enabled = true;

  /**
   * 抓取微博热搜数据
   */
  protected async doFetchTopics(): Promise<RawTopic[]> {
    // 注意：这里是一个模拟实现
    // 在实际生产环境中，需要使用 HTTP 客户端抓取真实数据
    // 由于微博需要处理反爬机制，这里返回模拟数据用于演示

    const mockTopics = [
      {
        title: "今日热点新闻",
        score: 0.95,
        categories: ["热点", "新闻"],
        url: "https://s.weibo.com/weibo?q=%E4%BB%8A%E6%97%A5%E7%83%AD%E7%82%B9%E6%96%B0%E9%97%BB",
      },
      {
        title: "科技前沿动态",
        score: 0.88,
        categories: ["科技", "前沿"],
        url: "https://s.weibo.com/weibo?q=%E7%A7%91%E6%8A%80%E5%89%8D%E6%B2%BF%E5%8A%A8%E6%80%81",
      },
      {
        title: "娱乐圈新鲜事",
        score: 0.82,
        categories: ["娱乐", "明星"],
        url: "https://s.weibo.com/weibo?q=%E5%A8%B1%E4%B9%90%E5%9C%88%E6%96%B0%E9%B2%9C%E4%BA%8B",
      },
      {
        title: "体育赛事精彩瞬间",
        score: 0.75,
        categories: ["体育", "赛事"],
        url: "https://s.weibo.com/weibo?q=%E4%BD%93%E8%82%B2%E8%B5%9B%E4%BA%8B%E7%B2%BE%E5%BD%A9%E7%9E%AC%E9%97%B4",
      },
      {
        title: "生活小技巧分享",
        score: 0.68,
        categories: ["生活", "技巧"],
        url: "https://s.weibo.com/weibo?q=%E7%94%9F%E6%B4%BB%E5%B0%8F%E6%8A%80%E5%B7%A7%E5%88%86%E4%BA%AB",
      },
    ];

    logger.debug(`Fetched ${mockTopics.length} topics from Weibo`);
    return this.filterTopics(this.limitTopics(mockTopics));
  }
}
