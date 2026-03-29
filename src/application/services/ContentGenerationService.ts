/**
 * ContentGenerationService
 * 内容生成服务
 * 多平台适配
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 平台类型枚举
 */
export enum PlatformType {
  WECHAT = "wechat",
  DINGTALK = "dingtalk",
  FEISHU = "feishu",
  EMAIL = "email",
  WEB = "web",
  CUSTOM = "custom",
}

/**
 * 内容类型枚举
 */
export enum ContentType {
  TEXT = "text",
  MARKDOWN = "markdown",
  HTML = "html",
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  FILE = "file",
}

/**
 * 内容格式接口
 */
export interface ContentFormat {
  type: ContentType;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * 平台配置接口
 */
export interface PlatformConfig {
  type: PlatformType;
  name: string;
  supportedFormats: ContentType[];
  maxLength?: number;
  customSettings?: Record<string, any>;
}

/**
 * 内容生成配置接口
 */
export interface GenerationConfig {
  platform: PlatformType;
  content: string;
  format?: ContentType;
  style?: string;
  tone?: string;
  metadata?: Record<string, any>;
}

/**
 * 生成结果接口
 */
export interface GenerationResult {
  success: boolean;
  content: ContentFormat;
  platform: PlatformType;
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * 模板接口
 */
export interface Template {
  id: string;
  name: string;
  platform: PlatformType;
  content: string;
  variables: string[];
}

/**
 * ContentGenerationService 类
 * 内容生成服务
 */
export class ContentGenerationService {
  private platforms: Map<PlatformType, PlatformConfig> = new Map();
  private templates: Map<string, Template> = new Map();
  private log: ReturnType<typeof logger.withContext>;

  constructor() {
    this.initializePlatforms();
    this.log = logger.withContext({ component: "ContentGenerationService" });
    this.log.debug("ContentGenerationService initialized");
  }

  /**
   * 初始化平台配置
   */
  private initializePlatforms(): void {
    // 微信平台
    this.platforms.set(PlatformType.WECHAT, {
      type: PlatformType.WECHAT,
      name: "WeChat",
      supportedFormats: [ContentType.TEXT, ContentType.MARKDOWN, ContentType.IMAGE],
      maxLength: 2000,
    });

    // 钉钉平台
    this.platforms.set(PlatformType.DINGTALK, {
      type: PlatformType.DINGTALK,
      name: "DingTalk",
      supportedFormats: [ContentType.TEXT, ContentType.MARKDOWN, ContentType.IMAGE],
      maxLength: 5000,
    });

    // 飞书平台
    this.platforms.set(PlatformType.FEISHU, {
      type: PlatformType.FEISHU,
      name: "Feishu",
      supportedFormats: [
        ContentType.TEXT,
        ContentType.MARKDOWN,
        ContentType.HTML,
        ContentType.IMAGE,
      ],
      maxLength: 10000,
    });

    // 邮件平台
    this.platforms.set(PlatformType.EMAIL, {
      type: PlatformType.EMAIL,
      name: "Email",
      supportedFormats: [ContentType.TEXT, ContentType.HTML, ContentType.IMAGE, ContentType.FILE],
      maxLength: 100000,
    });

    // Web 平台
    this.platforms.set(PlatformType.WEB, {
      type: PlatformType.WEB,
      name: "Web",
      supportedFormats: [
        ContentType.TEXT,
        ContentType.MARKDOWN,
        ContentType.HTML,
        ContentType.IMAGE,
        ContentType.VIDEO,
        ContentType.AUDIO,
      ],
    });
  }

  /**
   * 注册平台
   */
  registerPlatform(config: PlatformConfig): void {
    this.platforms.set(config.type, config);
    this.log.debug(`Platform registered: ${config.name}`);
  }

  /**
   * 获取平台配置
   */
  private getPlatformConfig(platform: PlatformType): PlatformConfig {
    const config = this.platforms.get(platform);
    if (!config) {
      throw new AppError(`Platform ${platform} not found`, ErrorCode.NOT_FOUND, 404);
    }
    return config;
  }

  /**
   * 获取平台配置（公共方法）
   */
  getPlatform(platform: PlatformType): PlatformConfig | undefined {
    return this.platforms.get(platform);
  }

  /**
   * 获取平台支持的格式列表
   */
  getSupportedFormats(platform: PlatformType): ContentType[] {
    const config = this.getPlatformConfig(platform);
    return config.supportedFormats;
  }
  /**
   * 获取所有平台
   */
  getAllPlatforms(): PlatformConfig[] {
    return Array.from(this.platforms.values());
  }

  /**
   * 生成内容
   */
  async generateContent(config: GenerationConfig): Promise<GenerationResult> {
    this.log.debug(`Generating content for platform: ${config.platform}`);

    const platform = this.platforms.get(config.platform);
    if (!platform) {
      throw new AppError(`Platform not supported: ${config.platform}`, ErrorCode.NOT_FOUND, 404);
    }

    try {
      // 确定内容格式
      const format = config.format || ContentType.TEXT;

      // 检查平台是否支持该格式
      if (!platform.supportedFormats.includes(format)) {
        throw new AppError(
          `Platform ${platform.name} does not support format: ${format}`,
          ErrorCode.INVALID_INPUT,
          400,
        );
      }

      // 转换内容格式
      const contentFormat = await this.transformContent(config.content, format, platform);

      // 检查内容长度
      if (platform.maxLength && contentFormat.content.length > platform.maxLength) {
        this.log.warn(
          `Content length exceeds limit for platform ${platform.name}: ${contentFormat.content.length} > ${platform.maxLength}`,
        );
        contentFormat.content = contentFormat.content.substring(0, platform.maxLength);
      }

      const result: GenerationResult = {
        success: true,
        content: contentFormat,
        platform: config.platform,
        metadata: config.metadata,
      };

      this.log.info(`Content generated for platform: ${config.platform}`);
      return result;
    } catch (error) {
      this.log.error(`Content generation failed for platform: ${config.platform}`, error);

      return {
        success: false,
        content: {
          type: ContentType.TEXT,
          content: "",
        },
        platform: config.platform,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 批量生成内容
   */
  async generateContents(configs: GenerationConfig[]): Promise<Map<string, GenerationResult>> {
    const results = new Map<string, GenerationResult>();

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const key = `${config.platform}-${i}`;
      const result = await this.generateContent(config);
      results.set(key, result);
    }

    return results;
  }

  /**
   * 转换内容格式
   */
  private async transformContent(
    content: string,
    format: ContentType,
    _platform: PlatformConfig,
  ): Promise<ContentFormat> {
    switch (format) {
      case ContentType.TEXT:
        return {
          type: ContentType.TEXT,
          content: this.toPlainText(content),
        };

      case ContentType.MARKDOWN:
        return {
          type: ContentType.MARKDOWN,
          content: this.toMarkdown(content),
        };

      case ContentType.HTML:
        return {
          type: ContentType.HTML,
          content: this.toHTML(content),
        };

      default:
        return {
          type: ContentType.TEXT,
          content,
        };
    }
  }

  /**
   * 转换为纯文本
   */
  private toPlainText(content: string): string {
    // 移除 Markdown 语法
    return content
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      .replace(/!\[(.+?)\]\(.+?\)/g, "$1")
      .trim();
  }

  /**
   * 转换为 Markdown
   */
  private toMarkdown(content: string): string {
    // 如果已经是 Markdown，直接返回
    if (content.includes("#") || content.includes("**") || content.includes("*")) {
      return content;
    }

    // 简单的文本转 Markdown
    return content;
  }

  /**
   * 转换为 HTML
   */
  private toHTML(content: string): string {
    let html = content;

    // 标题
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");

    // 粗体
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // 斜体
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // 代码
    html = html.replace(/`(.+?)`/g, "<code>$1</code>");
    html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

    // 链接
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    // 图片
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">');

    // 段落
    html = html.replace(/\n\n/g, "</p><p>");
    html = `<p>${html}</p>`;

    return html;
  }

  /**
   * 创建模板
   */
  createTemplate(template: Template): void {
    if (this.templates.has(template.id)) {
      throw new AppError(
        `Template with id "${template.id}" already exists`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    this.templates.set(template.id, template);
    this.log.debug(`Template created: ${template.id}`);
  }

  /**
   * 获取模板
   */
  getTemplate(templateId: string): Template | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * 按平台获取模板
   */
  getTemplatesByPlatform(platform: PlatformType): Template[] {
    return Array.from(this.templates.values()).filter((t) => t.platform === platform);
  }

  /**
   * 使用模板生成内容
   */
  async generateFromTemplate(
    templateId: string,
    variables: Record<string, string>,
  ): Promise<GenerationResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new AppError(`Template not found: ${templateId}`, ErrorCode.NOT_FOUND, 404);
    }

    // 替换变量
    let content = template.content;
    for (const variable of template.variables) {
      const value = variables[variable];
      if (value === undefined) {
        throw new AppError(`Variable "${variable}" not provided`, ErrorCode.INVALID_INPUT, 400);
      }
      content = content.replace(new RegExp(`\\{\\{${variable}\\}\\}`, "g"), value);
    }

    return this.generateContent({
      platform: template.platform,
      content,
      metadata: { templateId },
    });
  }

  /**
   * 删除模板
   */
  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * 验证内容
   */
  validateContent(
    platform: PlatformType,
    content: string,
  ): {
    valid: boolean;
    errors: string[];
  } {
    const config = this.platforms.get(platform);
    if (!config) {
      return {
        valid: false,
        errors: [`Platform not supported: ${platform}`],
      };
    }

    const errors: string[] = [];

    // 检查内容长度
    if (config.maxLength && content.length > config.maxLength) {
      errors.push(`Content length exceeds limit: ${content.length} > ${config.maxLength}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalPlatforms: number;
    totalTemplates: number;
    platformsByType: Record<string, number>;
  } {
    const platformsByType: Record<string, number> = {};

    for (const [type] of this.platforms) {
      platformsByType[type] = (platformsByType[type] || 0) + 1;
    }

    return {
      totalPlatforms: this.platforms.size,
      totalTemplates: this.templates.size,
      platformsByType,
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.platforms.clear();
    this.templates.clear();
    this.log.debug("ContentGenerationService cleaned up");
  }
}

export default ContentGenerationService;
