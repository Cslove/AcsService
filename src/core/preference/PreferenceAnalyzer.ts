/**
 * PreferenceAnalyzer 品味分析器
 * 从对话中提取和分析用户品味偏好
 */

import { logger } from "@/shared/utils/logger.js";
import { Message, MessageType } from "@/core/message/Message.js";
import { Preference, PreferenceType, PreferenceStrength } from "./Preference.js";

/**
 * 偏好模式接口
 */
interface PreferencePattern {
  regex: RegExp;
  type: PreferenceType;
  extractValue: (match: RegExpMatchArray) => string;
  defaultStrength: PreferenceStrength;
}

/**
 * 分析结果接口
 */
export interface AnalysisResult {
  tags: Array<{
    name: string;
    type: PreferenceType;
    value: string;
    strength: PreferenceStrength;
    confidence: number;
  }>;
  analyzedMessages: number;
  foundPatterns: number;
}

/**
 * PreferenceAnalyzer 类
 * 从对话中提取和分析用户品味偏好
 */
export class PreferenceAnalyzer {
  private patterns: PreferencePattern[];
  private log: ReturnType<typeof logger.withContext>;

  constructor() {
    this.patterns = this.initializePatterns();
    this.log = logger.withContext({ component: "PreferenceAnalyzer" });
    this.log.debug("PreferenceAnalyzer initialized");
  }

  /**
   * 分析消息列表，提取偏好
   */
  analyze(messages: Message[], userId: string): Preference {
    const preference = new Preference({ userId });
    let analyzedMessages = 0;
    let foundPatterns = 0;

    for (const message of messages) {
      // 只分析用户消息
      if (message.getType() !== MessageType.USER) {
        continue;
      }

      analyzedMessages++;

      const text = message.getText();
      if (!text || text.trim().length === 0) {
        continue;
      }

      // 分析文本中的偏好模式
      const result = this.analyzeText(text);

      for (const tag of result.tags) {
        preference.addTag({
          name: tag.name,
          type: tag.type,
          value: tag.value,
          strength: tag.strength,
          confidence: tag.confidence,
        });
        foundPatterns++;
      }
    }

    this.log.info(
      `Analysis completed: ${analyzedMessages} messages, ${foundPatterns} patterns found`,
    );

    return preference;
  }

  /**
   * 分析单条文本，提取偏好
   */
  analyzeText(text: string): AnalysisResult {
    const tags: AnalysisResult["tags"] = [];
    let foundPatterns = 0;

    for (const pattern of this.patterns) {
      const matches = text.matchAll(pattern.regex);

      for (const match of matches) {
        const value = pattern.extractValue(match);
        const confidence = this.calculateConfidence(match, text);

        tags.push({
          name: this.generateTagName(pattern.type, value),
          type: pattern.type,
          value,
          strength: pattern.defaultStrength,
          confidence,
        });

        foundPatterns++;
      }
    }

    return {
      tags,
      analyzedMessages: 1,
      foundPatterns,
    };
  }

  /**
   * 分析单条消息
   */
  analyzeMessage(message: Message): AnalysisResult {
    if (message.getType() !== MessageType.USER) {
      return {
        tags: [],
        analyzedMessages: 0,
        foundPatterns: 0,
      };
    }

    const text = message.getText();
    if (!text || text.trim().length === 0) {
      return {
        tags: [],
        analyzedMessages: 1,
        foundPatterns: 0,
      };
    }

    return this.analyzeText(text);
  }

  /**
   * 增量更新偏好
   */
  updatePreference(preference: Preference, newMessages: Message[]): Preference {
    for (const message of newMessages) {
      const result = this.analyzeMessage(message);

      for (const tag of result.tags) {
        // 检查是否已存在相似标签
        const existingTags = preference.getTagsByName(tag.name);

        if (existingTags.length > 0) {
          // 更新现有标签
          const existingTag = existingTags[0];
          preference.updateTag(existingTag.id, {
            strength: Math.min(
              PreferenceStrength.VERY_STRONG,
              existingTag.strength + 1,
            ) as PreferenceStrength,
            confidence: Math.min(1, existingTag.confidence + 0.1),
          });
        } else {
          // 添加新标签
          preference.addTag(tag);
        }
      }
    }

    this.log.debug(`Preference updated with ${newMessages.length} messages`);

    return preference;
  }

  /**
   * 初始化偏好模式
   */
  private initializePatterns(): PreferencePattern[] {
    return [
      // 内容偏好
      {
        regex: /(?:我喜欢|我偏爱|我喜欢看|我爱看|我喜欢听)\s*(.+?)(?:的|，|。|$)/gi,
        type: PreferenceType.CONTENT,
        extractValue: (match) => match[1].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },
      {
        regex: /(?:我对|我感兴趣|我关注)\s*(.+?)(?:感兴趣|感兴趣|感兴趣|，|。|$)/gi,
        type: PreferenceType.CONTENT,
        extractValue: (match) => match[1].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },

      // 风格偏好
      {
        regex: /(?:我喜欢|偏爱|偏好)\s*(.+?)(?:风格|样式|风格|，|。|$)/gi,
        type: PreferenceType.STYLE,
        extractValue: (match) => match[1].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },
      {
        regex: /(?:简洁|详细|正式|随意|幽默|严肃|专业|通俗)\s*(?:风格|语气|风格)/gi,
        type: PreferenceType.STYLE,
        extractValue: (match) => match[0].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },

      // 语气偏好
      {
        regex: /(?:请|麻烦|帮我)\s*(.+?)(?:语气|方式|，|。|$)/gi,
        type: PreferenceType.TONE,
        extractValue: (match) => match[1].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },
      {
        regex: /(?:友好|礼貌|直接|委婉|温和|严厉)\s*(?:语气|态度|，|。|$)/gi,
        type: PreferenceType.TONE,
        extractValue: (match) => match[0].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },

      // 格式偏好
      {
        regex: /(?:用|以)\s*(.+?)(?:格式|格式|形式|，|。|$)/gi,
        type: PreferenceType.FORMAT,
        extractValue: (match) => match[1].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },
      {
        regex: /(?:表格|列表|段落|要点|编号)\s*(?:形式|格式|，|。|$)/gi,
        type: PreferenceType.FORMAT,
        extractValue: (match) => match[0].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },

      // 语言偏好
      {
        regex: /(?:用|请用|讲)\s*(.+?)(?:语言|语种|，|。|$)/gi,
        type: PreferenceType.LANGUAGE,
        extractValue: (match) => match[1].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },
      {
        regex: /(?:中文|英文|日文|韩文|法文|德文|西班牙语|法语|英语)\s*(?:语言|语种|，|。|$)/gi,
        type: PreferenceType.LANGUAGE,
        extractValue: (match) => match[0].trim(),
        defaultStrength: PreferenceStrength.NORMAL,
      },

      // 自定义偏好（更强烈的表达）
      {
        regex: /(?:我非常|我特别|我最)\s*(喜欢|偏爱|热爱|爱好)\s*(.+?)(?:，|。|$)/gi,
        type: PreferenceType.CUSTOM,
        extractValue: (match) => match[2].trim(),
        defaultStrength: PreferenceStrength.STRONG,
      },
      {
        regex: /(?:千万别|不要|避免)\s*(.+?)(?:，|。|$)/gi,
        type: PreferenceType.CUSTOM,
        extractValue: (match) => `避免${match[1].trim()}`,
        defaultStrength: PreferenceStrength.STRONG,
      },
    ];
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(match: RegExpMatchArray, text: string): number {
    let confidence = 0.5; // 基础置信度

    // 匹配长度越长，置信度越高
    const matchLength = match[0].length;
    confidence += Math.min(0.2, matchLength / 100);

    // 检查上下文关键词
    const contextKeywords = ["喜欢", "偏爱", "热爱", "最爱", "特别", "非常"];
    const hasContextKeyword = contextKeywords.some((keyword) => text.includes(keyword));
    if (hasContextKeyword) {
      confidence += 0.1;
    }

    // 检查重复提及
    const pattern = match[0];
    const occurrences = (text.match(new RegExp(pattern, "gi")) || []).length;
    if (occurrences > 1) {
      confidence += Math.min(0.2, (occurrences - 1) * 0.1);
    }

    return Math.min(1, confidence);
  }

  /**
   * 生成标签名称
   */
  private generateTagName(type: PreferenceType, value: string): string {
    const typeNames: Record<PreferenceType, string> = {
      [PreferenceType.CONTENT]: "内容",
      [PreferenceType.STYLE]: "风格",
      [PreferenceType.TONE]: "语气",
      [PreferenceType.FORMAT]: "格式",
      [PreferenceType.LANGUAGE]: "语言",
      [PreferenceType.CUSTOM]: "自定义",
    };

    return `${typeNames[type]}_${value}`;
  }

  /**
   * 添加自定义模式
   */
  addPattern(pattern: PreferencePattern): void {
    this.patterns.push(pattern);
    this.log.debug(`Custom pattern added: ${pattern.type}`);
  }

  /**
   * 清除所有模式
   */
  clearPatterns(): void {
    this.patterns = [];
    this.log.debug("All patterns cleared");
  }

  /**
   * 重置为默认模式
   */
  resetPatterns(): void {
    this.patterns = this.initializePatterns();
    this.log.debug("Patterns reset to defaults");
  }

  /**
   * 获取所有模式
   */
  getPatterns(): PreferencePattern[] {
    return [...this.patterns];
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.log.debug("PreferenceAnalyzer cleaned up");
  }
}

export default PreferenceAnalyzer;
