/**
 * ContentCreationWorkflow
 * 内容创建流程
 * 平台适配流程
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import {
  ContentGenerationService,
  PlatformType,
  ContentType,
} from "../services/ContentGenerationService.js";

/**
 * 内容创建配置接口
 */
export interface ContentCreationConfig {
  sourceContent: string;
  targetPlatforms: PlatformType[];
  formats: ContentType[];
  templateId?: string;
  templateVariables?: Record<string, any>;
  enableAIGeneration?: boolean;
  aiPrompt?: string;
}

/**
 * 内容创建结果接口
 */
export interface ContentCreationResult {
  platform: PlatformType;
  format: ContentType;
  content: string;
  success: boolean;
  error?: string;
  creationTime: number;
  metadata?: Record<string, any>;
}

/**
 * 平台适配配置接口
 */
export interface PlatformAdaptationConfig {
  platform: PlatformType;
  maxLength?: number;
  enableFormatting?: boolean;
  customRules?: Record<string, any>;
}

/**
 * 内容创建工作流类
 */
export class ContentCreationWorkflow {
  private contentService: ContentGenerationService;
  private log: ReturnType<typeof logger.withContext>;
  private creationHistory: ContentCreationResult[] = [];

  constructor(contentService?: ContentGenerationService) {
    this.contentService = contentService || new ContentGenerationService();
    this.log = logger.withContext({ component: "ContentCreationWorkflow" });
    this.log.debug("ContentCreationWorkflow initialized");
  }

  /**
   * 创建内容
   */
  async createContent(config: ContentCreationConfig): Promise<ContentCreationResult[]> {
    this.log.info(`Starting content creation for ${config.targetPlatforms.length} platforms`);

    const results: ContentCreationResult[] = [];

    for (const platform of config.targetPlatforms) {
      for (const format of config.formats) {
        const result = await this.createContentForPlatform(platform, format, config);
        results.push(result);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    this.log.info(`Content creation completed: ${successCount}/${results.length} succeeded`);

    return results;
  }

  /**
   * 为特定平台创建内容
   */
  private async createContentForPlatform(
    platform: PlatformType,
    format: ContentType,
    config: ContentCreationConfig,
  ): Promise<ContentCreationResult> {
    const startTime = Date.now();

    try {
      this.log.info(`Creating content for platform: ${platform}, format: ${format}`);

      let content: string;

      if (config.templateId) {
        // 使用模板生成
        const templateResult = await this.contentService.generateFromTemplate(
          config.templateId,
          config.templateVariables || {},
        );
        content = templateResult.content.content;
      } else if (config.enableAIGeneration && config.aiPrompt) {
        // 使用 AI 生成
        content = await this.generateWithAI(platform, format, config);
      } else {
        // 直接生成
        const result = await this.contentService.generateContent({
          platform,
          format,
          content: config.sourceContent,
        });
        content = result.content.content;
      }

      // 平台适配
      const adaptedContent = await this.adaptForPlatform(platform, content, {
        platform,
      });

      const creationTime = Date.now() - startTime;
      const result: ContentCreationResult = {
        platform,
        format,
        content: adaptedContent,
        success: true,
        creationTime,
      };

      this.recordResult(result);
      this.log.info(`Content created successfully for ${platform} (${creationTime}ms)`);

      return result;
    } catch (error) {
      const creationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: ContentCreationResult = {
        platform,
        format,
        content: "",
        success: false,
        error: errorMessage,
        creationTime,
      };

      this.recordResult(result);
      this.log.error(`Content creation failed for ${platform}`, { error: errorMessage });

      return result;
    }
  }

  /**
   * 使用 AI 生成内容
   */
  private async generateWithAI(
    platform: PlatformType,
    format: ContentType,
    config: ContentCreationConfig,
  ): Promise<string> {
    this.log.debug(`AI generation for ${platform} with prompt: ${config.aiPrompt}`);

    // 构建完整的 AI 提示（预留，实际使用时可以传入 LLM）
    // const fullPrompt = `
    // 平台要求: ${platform}
    // 内容格式: ${format}
    // 用户提示: ${config.aiPrompt}
    //
    // 原始内容:
    // ${config.sourceContent}
    //
    // 请根据以上要求生成适合的内容。
    // `.trim();

    try {
      // 这里可以集成 LLM 服务
      // 暂时使用简单的文本处理模拟 AI 生成
      let generatedContent = config.sourceContent;

      // 根据平台和格式进行简单的内容增强
      if (platform === PlatformType.WECHAT) {
        generatedContent = this.enhanceForWeChat(generatedContent, config.aiPrompt || "");
      } else if (platform === PlatformType.DINGTALK) {
        generatedContent = this.enhanceForDingTalk(generatedContent, config.aiPrompt || "");
      } else if (platform === PlatformType.EMAIL) {
        generatedContent = this.enhanceForEmail(generatedContent, config.aiPrompt || "");
      }

      this.log.info(`AI generation completed for ${platform}`);
      return generatedContent;
    } catch (error) {
      this.log.error(`AI generation failed for ${platform}`, { error });
      throw new AppError(
        `AI generation failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.AGENT_EXECUTION_ERROR,
        500,
      );
    }
  }

  /**
   * 为微信平台增强内容
   */
  private enhanceForWeChat(content: string, prompt: string): string {
    let enhanced = content;

    // 添加表情符号（如果提示中要求）
    if (prompt.includes("emoji") || prompt.includes("表情")) {
      enhanced = enhanced.replace(/。/g, "😊。").replace(/！/g, "✨！");
    }

    // 添加分段（如果提示中要求）
    if (prompt.includes("分段") || prompt.includes("段落")) {
      enhanced = enhanced.replace(/([。！？])/g, "$1\n\n");
    }

    return enhanced;
  }

  /**
   * 为钉钉平台增强内容
   */
  private enhanceForDingTalk(content: string, prompt: string): string {
    let enhanced = content;

    // 添加标题（如果提示中要求）
    if (prompt.includes("标题") || prompt.includes("title")) {
      enhanced = `## ${content.split("\n")[0]}\n\n${content.substring(content.indexOf("\n") + 1)}`;
    }

    // 添加列表（如果提示中要求）
    if (prompt.includes("列表") || prompt.includes("list")) {
      enhanced = enhanced.replace(/^(\d+\.)/gm, "- $1");
    }

    return enhanced;
  }

  /**
   * 为邮件平台增强内容
   */
  private enhanceForEmail(content: string, prompt: string): string {
    let enhanced = content;

    // 添加问候语（如果提示中要求）
    if (prompt.includes("问候") || prompt.includes("greeting")) {
      enhanced = `您好！\n\n${enhanced}`;
    }

    // 添加结束语（如果提示中要求）
    if (prompt.includes("结束语") || prompt.includes("closing")) {
      enhanced = `${enhanced}\n\n祝好！`;
    }

    return enhanced;
  }

  /**
   * 平台适配
   */
  async adaptForPlatform(
    platform: PlatformType,
    content: string,
    adaptationConfig: PlatformAdaptationConfig,
  ): Promise<string> {
    this.log.debug(`Adapting content for platform: ${platform}`);

    let adaptedContent = content;

    // 应用长度限制
    if (adaptationConfig.maxLength) {
      adaptedContent = this.truncateContent(adaptedContent, adaptationConfig.maxLength);
    }

    // 应用格式化
    if (adaptationConfig.enableFormatting) {
      adaptedContent = this.formatContent(adaptedContent, platform);
    }

    // 应用自定义规则
    if (adaptationConfig.customRules) {
      adaptedContent = this.applyCustomRules(adaptedContent, adaptationConfig.customRules);
    }

    return adaptedContent;
  }

  /**
   * 批量创建内容
   */
  async createBatchContent(configs: ContentCreationConfig[]): Promise<ContentCreationResult[]> {
    this.log.info(`Starting batch content creation for ${configs.length} configs`);

    const allResults: ContentCreationResult[] = [];

    for (const config of configs) {
      const results = await this.createContent(config);
      allResults.push(...results);
    }

    const successCount = allResults.filter((r) => r.success).length;
    this.log.info(
      `Batch content creation completed: ${successCount}/${allResults.length} succeeded`,
    );

    return allResults;
  }

  /**
   * 获取创建历史
   */
  getCreationHistory(platform?: PlatformType): ContentCreationResult[] {
    if (platform) {
      return this.creationHistory.filter((r) => r.platform === platform);
    }
    return [...this.creationHistory];
  }

  /**
   * 获取统计信息
   */
  getStats(platform?: PlatformType): {
    totalCreations: number;
    successfulCreations: number;
    failedCreations: number;
    averageCreationTime: number;
    byPlatform: Record<string, number>;
    byFormat: Record<string, number>;
  } {
    const history = platform
      ? this.creationHistory.filter((r) => r.platform === platform)
      : this.creationHistory;

    const totalCreations = history.length;
    const successfulCreations = history.filter((r) => r.success).length;
    const failedCreations = totalCreations - successfulCreations;
    const averageCreationTime =
      totalCreations > 0 ? history.reduce((sum, r) => sum + r.creationTime, 0) / totalCreations : 0;

    const byPlatform: Record<string, number> = {};
    const byFormat: Record<string, number> = {};

    history.forEach((result) => {
      byPlatform[result.platform] = (byPlatform[result.platform] || 0) + 1;
      byFormat[result.format] = (byFormat[result.format] || 0) + 1;
    });

    return {
      totalCreations,
      successfulCreations,
      failedCreations,
      averageCreationTime,
      byPlatform,
      byFormat,
    };
  }

  /**
   * 记录结果
   */
  private recordResult(result: ContentCreationResult): void {
    this.creationHistory.push(result);
  }

  /**
   * 截断内容
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength - 3) + "...";
  }

  /**
   * 格式化内容
   */
  private formatContent(content: string, platform: PlatformType): string {
    // 根据平台进行格式化
    switch (platform) {
      case PlatformType.WECHAT:
        // 微信格式化
        return content.replace(/\n{3,}/g, "\n\n");
      case PlatformType.DINGTALK:
        // 钉钉格式化
        return content.replace(/\n/g, "\n\n");
      case PlatformType.FEISHU:
        // 飞书格式化
        return content;
      case PlatformType.EMAIL:
        // 邮件格式化
        return content.replace(/\n/g, "<br>");
      default:
        return content;
    }
  }

  /**
   * 应用自定义规则
   */
  private applyCustomRules(content: string, rules: Record<string, any>): string {
    let result = content;

    // 应用替换规则
    if (rules.replacements && Array.isArray(rules.replacements)) {
      rules.replacements.forEach((rule: any) => {
        result = result.replace(new RegExp(rule.pattern, "g"), rule.replacement);
      });
    }

    // 应用前缀/后缀
    if (rules.prefix) {
      result = rules.prefix + result;
    }
    if (rules.suffix) {
      result = result + rules.suffix;
    }

    return result;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.creationHistory = [];
    this.log.debug("ContentCreationWorkflow cleaned up");
  }
}
