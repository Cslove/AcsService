/**
 * ContentGenerationSkill 内容生成技能
 * 支持多种平台和内容类型的生成
 */

import BaseSkill from "../BaseSkill.js";
import type { SkillConfig, SkillInput, SkillOutput } from "../Skill.js";
import { SkillType } from "../Skill.js";

/**
 * 内容平台类型
 */
export enum ContentPlatform {
  TOUTIAO = "toutiao",
  WECHAT = "wechat",
  WEIBO = "weibo",
  XIAOHONGSHU = "xiaohongshu",
  GENERIC = "generic",
}

/**
 * 内容类型
 */
export enum ContentType {
  ARTICLE = "article",
  SHORT_POST = "short_post",
  CAPTION = "caption",
  THREAD = "thread",
}

/**
 * 内容风格
 */
export enum ContentStyle {
  PROFESSIONAL = "professional",
  CASUAL = "casual",
  HUMOROUS = "humorous",
  FORMAL = "formal",
  STORYTELLING = "storytelling",
}

/**
 * ContentGenerationSkill 配置接口
 */
export interface ContentGenerationSkillConfig extends SkillConfig {
  type: SkillType;
  defaultPlatform?: ContentPlatform;
  defaultStyle?: ContentStyle;
  maxWords?: number;
  llmProvider?: string;
}

/**
 * ContentGenerationSkill 内容生成技能实现
 */
export class ContentGenerationSkill extends BaseSkill {
  private defaultPlatform: ContentPlatform;
  private defaultStyle: ContentStyle;
  private maxWords: number;
  private llmProvider?: string;

  constructor(config: ContentGenerationSkillConfig) {
    super(config);
    this.defaultPlatform = config.defaultPlatform || ContentPlatform.GENERIC;
    this.defaultStyle = config.defaultStyle || ContentStyle.PROFESSIONAL;
    this.maxWords = config.maxWords || 1000;
    this.llmProvider = config.llmProvider;
  }

  /**
   * 执行内容生成的内部逻辑
   */
  protected async executeInternal(input: SkillInput): Promise<SkillOutput> {
    const topic = input.topic as string;
    const platform = (input.platform as ContentPlatform) || this.defaultPlatform;
    const style = (input.style as ContentStyle) || this.defaultStyle;
    const contentType = (input.contentType as ContentType) || ContentType.ARTICLE;
    const maxWords = (input.maxWords as number) || this.maxWords;
    const preference = (input.preference as Record<string, any>) || {};

    this.log.info(
      `Generating content: topic="${topic}", platform=${platform}, style=${style}, type=${contentType}`,
    );

    try {
      // 生成内容
      const content = await this.generateContent(
        topic,
        platform,
        style,
        contentType,
        maxWords,
        preference,
      );

      this.log.info(`Content generated successfully: ${content.length} characters`);

      return {
        success: true,
        data: {
          topic,
          platform,
          style,
          contentType,
          content,
          wordCount: content.split(/\s+/).length,
          characterCount: content.length,
        },
      };
    } catch (error) {
      this.log.error(`Content generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * 生成实际内容
   * TODO: 集成大模型 API 进行内容生成
   */
  private async generateContent(
    topic: string,
    platform: ContentPlatform,
    style: ContentStyle,
    contentType: ContentType,
    maxWords: number,
    _preference: Record<string, any>,
  ): Promise<string> {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 根据平台和风格生成模拟内容
    const platformPrefix = this.getPlatformPrefix(platform);
    const stylePrefix = this.getStylePrefix(style);
    const typePrefix = this.getTypePrefix(contentType);

    // 模拟内容
    const content = `${platformPrefix}\n\n${stylePrefix}\n\n${typePrefix}\n\nHere is a generated piece of content about "${topic}" for ${platform} platform in ${style} style.\n\nThis content is tailored to match the user's preferences and the platform's requirements. It includes engaging language, appropriate formatting, and relevant information.\n\nThe content generation process considers various factors such as the target audience, platform guidelines, and the user's personal taste preferences to create high-quality, engaging content.`;

    // 根据最大字数截断
    const words = content.split(/\s+/);
    if (words.length > maxWords) {
      return words.slice(0, maxWords).join(" ") + "...";
    }

    return content;
  }

  /**
   * 获取平台前缀
   */
  private getPlatformPrefix(platform: ContentPlatform): string {
    const prefixes: Record<ContentPlatform, string> = {
      [ContentPlatform.TOUTIAO]: "【今日头条】",
      [ContentPlatform.WECHAT]: "【微信公众号】",
      [ContentPlatform.WEIBO]: "【微博】",
      [ContentPlatform.XIAOHONGSHU]: "【小红书】",
      [ContentPlatform.GENERIC]: "【通用内容】",
    };
    return prefixes[platform];
  }

  /**
   * 获取风格前缀
   */
  private getStylePrefix(style: ContentStyle): string {
    const prefixes: Record<ContentStyle, string> = {
      [ContentStyle.PROFESSIONAL]: "风格：专业严谨",
      [ContentStyle.CASUAL]: "风格：轻松随意",
      [ContentStyle.HUMOROUS]: "风格：幽默风趣",
      [ContentStyle.FORMAL]: "风格：正式规范",
      [ContentStyle.STORYTELLING]: "风格：叙事性强",
    };
    return prefixes[style];
  }

  /**
   * 获取类型前缀
   */
  private getTypePrefix(contentType: ContentType): string {
    const prefixes: Record<ContentType, string> = {
      [ContentType.ARTICLE]: "类型：文章",
      [ContentType.SHORT_POST]: "类型：短帖",
      [ContentType.CAPTION]: "类型：配文",
      [ContentType.THREAD]: "类型：话题串",
    };
    return prefixes[contentType];
  }

  /**
   * 获取默认平台
   */
  getDefaultPlatform(): ContentPlatform {
    return this.defaultPlatform;
  }

  /**
   * 设置默认平台
   */
  setDefaultPlatform(platform: ContentPlatform): void {
    this.defaultPlatform = platform;
    this.log.debug(`Default platform set to: ${platform}`);
  }

  /**
   * 获取默认风格
   */
  getDefaultStyle(): ContentStyle {
    return this.defaultStyle;
  }

  /**
   * 设置默认风格
   */
  setDefaultStyle(style: ContentStyle): void {
    this.defaultStyle = style;
    this.log.debug(`Default style set to: ${style}`);
  }

  /**
   * 获取最大字数
   */
  getMaxWords(): number {
    return this.maxWords;
  }

  /**
   * 设置最大字数
   */
  setMaxWords(maxWords: number): void {
    if (maxWords <= 0) {
      throw new Error("Max words must be greater than 0");
    }
    this.maxWords = maxWords;
    this.log.debug(`Max words set to: ${maxWords}`);
  }
}

/**
 * 创建 ContentGenerationSkill 的工厂函数
 */
export function createContentGenerationSkill(
  config?: Partial<ContentGenerationSkillConfig>,
): ContentGenerationSkill {
  return new ContentGenerationSkill({
    id: config?.id || "content_generation",
    name: config?.name || "Content Generation",
    description:
      config?.description || "Generate content for various platforms with different styles",
    type: config?.type || SkillType.CONTENT_GENERATION,
    version: config?.version || "1.0.0",
    parameters: [
      {
        name: "topic",
        type: "string",
        description: "The topic to generate content about",
        required: true,
      },
      {
        name: "platform",
        type: "string",
        description: "The target platform for the content",
        required: false,
        enum: Object.values(ContentPlatform),
      },
      {
        name: "style",
        type: "string",
        description: "The writing style for the content",
        required: false,
        enum: Object.values(ContentStyle),
      },
      {
        name: "contentType",
        type: "string",
        description: "The type of content to generate",
        required: false,
        enum: Object.values(ContentType),
      },
      {
        name: "maxWords",
        type: "number",
        description: "Maximum number of words in the content",
        required: false,
      },
      {
        name: "preference",
        type: "object",
        description: "User preferences for content generation",
        required: false,
      },
    ],
    timeout: config?.timeout || 60000,
    metadata: config?.metadata || {},
    defaultPlatform: config?.defaultPlatform,
    defaultStyle: config?.defaultStyle,
    maxWords: config?.maxWords,
    llmProvider: config?.llmProvider,
  });
}

export default ContentGenerationSkill;
