/**
 * Preference 模型
 * 管理用户品味偏好和标签系统
 */

import { logger } from "@/shared/utils/logger.js";

/**
 * 偏好类型枚举
 */
export enum PreferenceType {
  CONTENT = "content", // 内容偏好
  STYLE = "style", // 风格偏好
  TONE = "tone", // 语气偏好
  FORMAT = "format", // 格式偏好
  LANGUAGE = "language", // 语言偏好
  CUSTOM = "custom", // 自定义偏好
}

/**
 * 偏好强度枚举
 */
export enum PreferenceStrength {
  WEAK = 1,
  NORMAL = 2,
  STRONG = 3,
  VERY_STRONG = 4,
}

/**
 * 偏好标签接口
 */
export interface PreferenceTag {
  id: string;
  name: string;
  type: PreferenceType;
  value: string;
  strength: PreferenceStrength;
  confidence: number; // 0-1 之间的置信度
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 偏好配置接口
 */
export interface PreferenceConfig {
  userId: string;
  tags?: PreferenceTag[];
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 偏好上下文接口
 */
export interface PreferenceContext {
  tagCount: number;
  lastUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Preference 类
 * 管理用户品味偏好和标签系统
 */
export class Preference {
  private config: PreferenceConfig;
  private context: PreferenceContext;
  private tags: Map<string, PreferenceTag>;
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: PreferenceConfig) {
    this.config = {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...config,
    };

    this.tags = new Map();

    // 初始化标签
    if (this.config.tags) {
      for (const tag of this.config.tags) {
        this.tags.set(tag.id, tag);
      }
    }

    this.context = {
      tagCount: this.tags.size,
      lastUpdatedAt: null,
      createdAt: this.config.createdAt!,
      updatedAt: this.config.updatedAt!,
    };

    this.log = logger.withContext({ component: "Preference", userId: this.config.userId });
    this.log.debug(`Preference created for user: ${this.config.userId}`);
  }

  /**
   * 获取用户 ID
   */
  getUserId(): string {
    return this.config.userId;
  }

  /**
   * 获取所有标签
   */
  getTags(): PreferenceTag[] {
    return Array.from(this.tags.values());
  }

  /**
   * 根据类型获取标签
   */
  getTagsByType(type: PreferenceType): PreferenceTag[] {
    return this.getTags().filter((tag) => tag.type === type);
  }

  /**
   * 根据 ID 获取标签
   */
  getTagById(id: string): PreferenceTag | undefined {
    return this.tags.get(id);
  }

  /**
   * 根据名称获取标签
   */
  getTagsByName(name: string): PreferenceTag[] {
    return this.getTags().filter((tag) => tag.name === name);
  }

  /**
   * 添加标签
   */
  addTag(tag: Omit<PreferenceTag, "id" | "createdAt" | "updatedAt">): PreferenceTag {
    const id = this.generateTagId(tag.name, tag.type);
    const now = new Date();

    const newTag: PreferenceTag = {
      id,
      createdAt: now,
      updatedAt: now,
      ...tag,
    };

    this.tags.set(id, newTag);
    this.context.tagCount = this.tags.size;
    this.context.lastUpdatedAt = now;
    this.updateTimestamp();

    this.log.debug(`Tag added: ${tag.name} (type: ${tag.type})`);

    return newTag;
  }

  /**
   * 更新标签
   */
  updateTag(
    id: string,
    updates: Partial<Omit<PreferenceTag, "id" | "createdAt" | "updatedAt">>,
  ): PreferenceTag | null {
    const tag = this.tags.get(id);
    if (!tag) {
      this.log.warn(`Tag not found: ${id}`);
      return null;
    }

    const updatedTag: PreferenceTag = {
      ...tag,
      ...updates,
      updatedAt: new Date(),
    };

    this.tags.set(id, updatedTag);
    this.context.lastUpdatedAt = new Date();
    this.updateTimestamp();

    this.log.debug(`Tag updated: ${tag.name}`);

    return updatedTag;
  }

  /**
   * 删除标签
   */
  removeTag(id: string): boolean {
    const tag = this.tags.get(id);
    if (!tag) {
      this.log.warn(`Tag not found: ${id}`);
      return false;
    }

    this.tags.delete(id);
    this.context.tagCount = this.tags.size;
    this.context.lastUpdatedAt = new Date();
    this.updateTimestamp();

    this.log.debug(`Tag removed: ${tag.name}`);

    return true;
  }

  /**
   * 清空所有标签
   */
  clearTags(): void {
    this.tags.clear();
    this.context.tagCount = 0;
    this.context.lastUpdatedAt = new Date();
    this.updateTimestamp();

    this.log.debug("All tags cleared");
  }

  /**
   * 根据名称和类型删除标签
   */
  removeTagsByName(name: string): number {
    const tagsToRemove = this.getTagsByName(name);
    let count = 0;

    for (const tag of tagsToRemove) {
      this.tags.delete(tag.id);
      count++;
    }

    if (count > 0) {
      this.context.tagCount = this.tags.size;
      this.context.lastUpdatedAt = new Date();
      this.updateTimestamp();
      this.log.debug(`Removed ${count} tags with name: ${name}`);
    }

    return count;
  }

  /**
   * 根据类型删除标签
   */
  removeTagsByType(type: PreferenceType): number {
    const tagsToRemove = this.getTagsByType(type);
    let count = 0;

    for (const tag of tagsToRemove) {
      this.tags.delete(tag.id);
      count++;
    }

    if (count > 0) {
      this.context.tagCount = this.tags.size;
      this.context.lastUpdatedAt = new Date();
      this.updateTimestamp();
      this.log.debug(`Removed ${count} tags with type: ${type}`);
    }

    return count;
  }

  /**
   * 获取标签数量
   */
  getTagCount(): number {
    return this.context.tagCount;
  }

  /**
   * 获取指定类型的标签数量
   */
  getTagCountByType(type: PreferenceType): number {
    return this.getTagsByType(type).length;
  }

  /**
   * 获取元数据
   */
  getMetadata(): Record<string, any> {
    return { ...this.config.metadata };
  }

  /**
   * 设置元数据
   */
  setMetadata(metadata: Record<string, any>): void {
    this.config.metadata = metadata;
    this.updateTimestamp();
    this.log.debug("Metadata updated");
  }

  /**
   * 更新元数据
   */
  updateMetadata(key: string, value: any): void {
    if (!this.config.metadata) {
      this.config.metadata = {};
    }
    this.config.metadata[key] = value;
    this.updateTimestamp();
    this.log.debug(`Metadata updated: ${key}`);
  }

  /**
   * 获取创建时间
   */
  getCreatedAt(): Date {
    return this.context.createdAt;
  }

  /**
   * 获取更新时间
   */
  getUpdatedAt(): Date {
    return this.context.updatedAt;
  }

  /**
   * 获取最后标签更新时间
   */
  getLastTagUpdatedAt(): Date | null {
    return this.context.lastUpdatedAt;
  }

  /**
   * 合并偏好
   */
  merge(otherPreference: Preference): void {
    if (otherPreference.getUserId() !== this.config.userId) {
      this.log.warn(`Cannot merge preference from different user: ${otherPreference.getUserId()}`);
      return;
    }

    const otherTags = otherPreference.getTags();
    for (const otherTag of otherTags) {
      // 按名称查找现有标签
      const existingTags = this.getTagsByName(otherTag.name);

      if (existingTags.length > 0) {
        // 更新现有标签，保留更高的强度和置信度
        const existingTag = existingTags[0];
        this.updateTag(existingTag.id, {
          strength: Math.max(existingTag.strength, otherTag.strength),
          confidence: Math.max(existingTag.confidence, otherTag.confidence),
          metadata: { ...existingTag.metadata, ...otherTag.metadata },
        });
      } else {
        // 添加新标签
        this.addTag(otherTag);
      }
    }

    this.log.debug(`Merged ${otherTags.length} tags from other preference`);
  }

  /**
   * 搜索标签
   */
  searchTags(query: string): PreferenceTag[] {
    const lowerQuery = query.toLowerCase();
    return this.getTags().filter(
      (tag) =>
        tag.name.toLowerCase().includes(lowerQuery) || tag.value.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * 获取高置信度标签（置信度 >= 0.7）
   */
  getHighConfidenceTags(): PreferenceTag[] {
    return this.getTags().filter((tag) => tag.confidence >= 0.7);
  }

  /**
   * 获取强偏好标签（强度 >= STRONG）
   */
  getStrongPreferenceTags(): PreferenceTag[] {
    return this.getTags().filter(
      (tag) =>
        tag.strength === PreferenceStrength.STRONG ||
        tag.strength === PreferenceStrength.VERY_STRONG,
    );
  }

  /**
   * 生成标签 ID
   */
  private generateTagId(name: string, type: PreferenceType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${type}_${name}_${timestamp}_${random}`.toLowerCase().replace(/\s+/g, "_");
  }

  /**
   * 更新时间戳
   */
  private updateTimestamp(): void {
    this.context.updatedAt = new Date();
  }

  /**
   * 转换为 JSON
   */
  toJSON(): any {
    return {
      userId: this.config.userId,
      tags: this.getTags(),
      metadata: this.config.metadata,
      tagCount: this.context.tagCount,
      lastUpdatedAt: this.context.lastUpdatedAt?.toISOString() || null,
      createdAt: this.context.createdAt.toISOString(),
      updatedAt: this.context.updatedAt.toISOString(),
    };
  }

  /**
   * 从 JSON 创建 Preference
   */
  static fromJSON(json: any): Preference {
    const config: PreferenceConfig = {
      userId: json.userId,
      tags: json.tags,
      metadata: json.metadata,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
    };

    return new Preference(config);
  }

  /**
   * 克隆偏好
   */
  clone(): Preference {
    return Preference.fromJSON(this.toJSON());
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.clearTags();
    this.log.debug(`Preference cleaned up for user: ${this.config.userId}`);
  }
}

export default Preference;
