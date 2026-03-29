/**
 * PreferenceManager 偏好管理器
 * 管理用户偏好的持久化和更新
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { Preference } from "./Preference.js";
import { PreferenceAnalyzer } from "./PreferenceAnalyzer.js";
import { Message } from "@/core/message/Message.js";

/**
 * 偏好存储接口
 */
export interface PreferenceStorage {
  save(userId: string, preference: Preference): Promise<void>;
  load(userId: string): Promise<Preference | null>;
  delete(userId: string): Promise<void>;
  exists(userId: string): Promise<boolean>;
}

/**
 * 内存存储实现（默认）
 */
class InMemoryStorage implements PreferenceStorage {
  private storage: Map<string, Preference> = new Map();

  async save(userId: string, preference: Preference): Promise<void> {
    this.storage.set(userId, preference.clone());
  }

  async load(userId: string): Promise<Preference | null> {
    const preference = this.storage.get(userId);
    return preference ? preference.clone() : null;
  }

  async delete(userId: string): Promise<void> {
    this.storage.delete(userId);
  }

  async exists(userId: string): Promise<boolean> {
    return this.storage.has(userId);
  }
}

/**
 * PreferenceManager 配置接口
 */
export interface PreferenceManagerConfig {
  storage?: PreferenceStorage;
  autoSave?: boolean;
  autoUpdate?: boolean;
  maxCacheSize?: number;
}

/**
 * PreferenceManager 类
 * 管理用户偏好的持久化和更新
 */
export class PreferenceManager {
  private config: PreferenceManagerConfig;
  private analyzer: PreferenceAnalyzer;
  private storage: PreferenceStorage;
  private cache: Map<string, Preference> = new Map();
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: PreferenceManagerConfig = {}) {
    this.config = {
      autoSave: true,
      autoUpdate: true,
      maxCacheSize: 100,
      ...config,
    };

    this.storage = this.config.storage || new InMemoryStorage();
    this.analyzer = new PreferenceAnalyzer();

    this.log = logger.withContext({ component: "PreferenceManager" });
    this.log.debug("PreferenceManager initialized");
  }

  /**
   * 获取用户偏好
   */
  async getPreference(userId: string): Promise<Preference> {
    // 先检查缓存
    if (this.cache.has(userId)) {
      this.log.debug(`Preference loaded from cache: ${userId}`);
      return this.cache.get(userId)!.clone();
    }

    // 从存储加载
    const preference = await this.storage.load(userId);

    if (preference) {
      // 添加到缓存
      this.addToCache(userId, preference);
      this.log.debug(`Preference loaded from storage: ${userId}`);
      return preference.clone();
    }

    // 创建新偏好
    const newPreference = new Preference({ userId });
    if (this.config.autoSave) {
      await this.storage.save(userId, newPreference);
    }
    this.addToCache(userId, newPreference);

    this.log.debug(`New preference created: ${userId}`);

    return newPreference.clone();
  }

  /**
   * 更新用户偏好
   */
  async updatePreference(userId: string, updates: Partial<Preference>): Promise<Preference> {
    const preference = await this.getPreference(userId);

    // 合并更新
    if (updates.getTags && updates.getTags().length > 0) {
      const tags = updates.getTags();
      for (const tag of tags) {
        const existingTag = preference.getTagById(tag.id);
        if (existingTag) {
          preference.updateTag(tag.id, tag);
        } else {
          preference.addTag(tag);
        }
      }
    }

    if (updates.getMetadata) {
      const metadata = updates.getMetadata();
      preference.setMetadata(metadata);
    }

    // 保存更新
    if (this.config.autoSave) {
      await this.storage.save(userId, preference);
    }
    this.addToCache(userId, preference);

    this.log.debug(`Preference updated: ${userId}`);

    return preference.clone();
  }

  /**
   * 从消息列表更新偏好
   */
  async updateFromMessages(userId: string, messages: Message[]): Promise<Preference> {
    const preference = await this.getPreference(userId);

    // 使用分析器分析消息
    this.analyzer.updatePreference(preference, messages);

    // 保存更新
    if (this.config.autoSave) {
      await this.storage.save(userId, preference);
    }
    this.addToCache(userId, preference);

    this.log.debug(`Preference updated from ${messages.length} messages: ${userId}`);

    return preference.clone();
  }

  /**
   * 保存用户偏好
   */
  async savePreference(userId: string, preference: Preference): Promise<void> {
    if (preference.getUserId() !== userId) {
      throw new AppError(
        `Preference userId does not match: expected ${userId}, got ${preference.getUserId()}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    await this.storage.save(userId, preference);
    this.addToCache(userId, preference);

    this.log.debug(`Preference saved: ${userId}`);
  }

  /**
   * 删除用户偏好
   */
  async deletePreference(userId: string): Promise<void> {
    await this.storage.delete(userId);
    this.cache.delete(userId);

    this.log.debug(`Preference deleted: ${userId}`);
  }

  /**
   * 检查用户偏好是否存在
   */
  async hasPreference(userId: string): Promise<boolean> {
    // 先检查缓存
    if (this.cache.has(userId)) {
      return true;
    }

    // 检查存储
    return await this.storage.exists(userId);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.log.debug("Cache cleared");
  }

  /**
   * 清除指定用户的缓存
   */
  clearUserCache(userId: string): void {
    this.cache.delete(userId);
    this.log.debug(`User cache cleared: ${userId}`);
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * 获取所有缓存的用户 ID
   */
  getCachedUserIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 批量获取用户偏好
   */
  async getPreferences(userIds: string[]): Promise<Map<string, Preference>> {
    const result = new Map<string, Preference>();

    for (const userId of userIds) {
      const preference = await this.getPreference(userId);
      result.set(userId, preference);
    }

    return result;
  }

  /**
   * 批量更新用户偏好
   */
  async updatePreferences(updates: Map<string, Partial<Preference>>): Promise<void> {
    const promises = Array.from(updates.entries()).map(([userId, update]) =>
      this.updatePreference(userId, update),
    );

    await Promise.all(promises);

    this.log.debug(`Batch updated ${updates.size} preferences`);
  }

  /**
   * 合并偏好
   */
  async mergePreferences(userId: string, sourcePreference: Preference): Promise<Preference> {
    const targetPreference = await this.getPreference(userId);

    targetPreference.merge(sourcePreference);

    if (this.config.autoSave) {
      await this.storage.save(userId, targetPreference);
    }
    this.addToCache(userId, targetPreference);

    this.log.debug(`Preferences merged: ${userId}`);

    return targetPreference.clone();
  }

  /**
   * 导出偏好
   */
  async exportPreference(userId: string): Promise<any> {
    // 清除缓存以确保获取最新数据
    this.clearUserCache(userId);
    const preference = await this.getPreference(userId);
    return preference.toJSON();
  }

  /**
   * 导入偏好
   */
  async importPreference(userId: string, data: any): Promise<Preference> {
    const preference = Preference.fromJSON(data);

    if (preference.getUserId() !== userId) {
      throw new AppError(
        `Imported preference userId does not match: expected ${userId}, got ${preference.getUserId()}`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    if (this.config.autoSave) {
      await this.storage.save(userId, preference);
    }
    this.addToCache(userId, preference);

    this.log.debug(`Preference imported: ${userId}`);

    return preference.clone();
  }

  /**
   * 获取分析器
   */
  getAnalyzer(): PreferenceAnalyzer {
    return this.analyzer;
  }

  /**
   * 设置存储
   */
  setStorage(storage: PreferenceStorage): void {
    this.storage = storage;
    this.log.debug("Storage updated");
  }

  /**
   * 获取存储
   */
  getStorage(): PreferenceStorage {
    return this.storage;
  }

  /**
   * 添加到缓存
   */
  private addToCache(userId: string, preference: Preference): void {
    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxCacheSize!) {
      // 移除最旧的缓存项
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(userId, preference.clone());
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.clearCache();
    this.analyzer.cleanup();
    this.log.debug("PreferenceManager cleaned up");
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalCached: number;
    totalStored: number;
    cacheSize: number;
  }> {
    // 计算存储的总数（对于内存存储）
    let totalStored = 0;
    if (this.storage instanceof InMemoryStorage) {
      totalStored = this.cache.size;
    }

    return {
      totalCached: this.cache.size,
      totalStored,
      cacheSize: this.cache.size,
    };
  }
}

export default PreferenceManager;
