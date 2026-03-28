/**
 * Message 模型
 * 支持多种内容类型的消息
 */

import { logger } from "@/shared/utils/logger.js";

/**
 * 消息类型枚举
 */
export enum MessageType {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
  TOOL = "tool",
}

/**
 * 消息内容类型枚举
 */
export enum MessageContentType {
  TEXT = "text",
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
  FILE = "file",
  CODE = "code",
  MARKDOWN = "markdown",
  JSON = "json",
}

/**
 * 消息内容接口
 */
export interface MessageContent {
  type: MessageContentType;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * 消息配置接口
 */
export interface MessageConfig {
  id: string;
  type: MessageType;
  content: MessageContent | MessageContent[];
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Message 类
 * 支持多种内容类型的消息
 */
export class Message {
  private config: MessageConfig;
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: MessageConfig) {
    this.config = {
      timestamp: new Date(),
      ...config,
    };

    this.log = logger.withContext({ component: "Message", messageId: this.config.id });
    this.log.debug(`Message created: ${this.config.id} (type: ${this.config.type})`);
  }

  /**
   * 获取消息 ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 获取消息类型
   */
  getType(): MessageType {
    return this.config.type;
  }

  /**
   * 设置消息类型
   */
  setType(type: MessageType): void {
    this.config.type = type;
    this.log.debug(`Message type changed: ${type}`);
  }

  /**
   * 获取消息内容
   */
  getContent(): MessageContent | MessageContent[] {
    return this.config.content;
  }

  /**
   * 设置消息内容
   */
  setContent(content: MessageContent | MessageContent[]): void {
    this.config.content = content;
    this.log.debug(`Message content updated`);
  }

  /**
   * 获取文本内容
   */
  getText(): string {
    const content = this.config.content;
    if (!content) return "";

    if (Array.isArray(content)) {
      const textContent = content.find((c) => c.type === MessageContentType.TEXT);
      return textContent?.data || "";
    }

    return content.type === MessageContentType.TEXT ? content.data : "";
  }

  /**
   * 获取所有文本内容
   */
  getAllText(): string[] {
    const content = this.config.content;
    if (!content) return [];

    if (Array.isArray(content)) {
      return content.filter((c) => c.type === MessageContentType.TEXT).map((c) => c.data);
    }

    return content.type === MessageContentType.TEXT ? [content.data] : [];
  }

  /**
   * 获取指定类型的内容
   */
  getContentByType(type: MessageContentType): MessageContent[] {
    const content = this.config.content;
    if (!content) return [];

    if (Array.isArray(content)) {
      return content.filter((c) => c.type === type);
    }

    return content.type === type ? [content] : [];
  }

  /**
   * 检查是否包含指定类型的内容
   */
  hasContentType(type: MessageContentType): boolean {
    return this.getContentByType(type).length > 0;
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string | undefined {
    return this.config.sessionId;
  }

  /**
   * 设置会话 ID
   */
  setSessionId(sessionId: string): void {
    this.config.sessionId = sessionId;
  }

  /**
   * 获取用户 ID
   */
  getUserId(): string | undefined {
    return this.config.userId;
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
    this.log.debug(`Metadata updated`);
  }

  /**
   * 更新元数据
   */
  updateMetadata(key: string, value: any): void {
    if (!this.config.metadata) {
      this.config.metadata = {};
    }
    this.config.metadata[key] = value;
    this.log.debug(`Metadata updated: ${key}`);
  }

  /**
   * 获取时间戳
   */
  getTimestamp(): Date {
    return this.config.timestamp!;
  }

  /**
   * 检查是否为用户消息
   */
  isUserMessage(): boolean {
    return this.config.type === MessageType.USER;
  }

  /**
   * 检查是否为助手消息
   */
  isAssistantMessage(): boolean {
    return this.config.type === MessageType.ASSISTANT;
  }

  /**
   * 检查是否为系统消息
   */
  isSystemMessage(): boolean {
    return this.config.type === MessageType.SYSTEM;
  }

  /**
   * 检查是否为工具消息
   */
  isToolMessage(): boolean {
    return this.config.type === MessageType.TOOL;
  }

  /**
   * 检查是否为文本消息
   */
  isTextMessage(): boolean {
    return this.hasContentType(MessageContentType.TEXT);
  }

  /**
   * 检查是否为多媒体消息
   */
  isMultimediaMessage(): boolean {
    const content = this.config.content;
    if (!content) return false;

    if (Array.isArray(content)) {
      return content.some(
        (c) => c.type !== MessageContentType.TEXT && c.type !== MessageContentType.MARKDOWN,
      );
    }

    return content.type !== MessageContentType.TEXT && content.type !== MessageContentType.MARKDOWN;
  }

  /**
   * 获取内容大小
   */
  getContentSize(): number {
    const content = this.config.content;
    if (!content) return 0;

    if (Array.isArray(content)) {
      return content.reduce((total, c) => {
        if (typeof c.data === "string") {
          return total + c.data.length;
        }
        return total + JSON.stringify(c.data).length;
      }, 0);
    }

    if (typeof content.data === "string") {
      return content.data.length;
    }

    return JSON.stringify(content.data).length;
  }

  /**
   * 转换为 JSON
   */
  toJSON(): any {
    return {
      id: this.config.id,
      type: this.config.type,
      content: this.config.content,
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      metadata: this.config.metadata,
      timestamp: this.config.timestamp?.toISOString(),
    };
  }

  /**
   * 从 JSON 创建 Message
   */
  static fromJSON(json: any): Message {
    const config: MessageConfig = {
      id: json.id,
      type: json.type,
      content: json.content,
      sessionId: json.sessionId,
      userId: json.userId,
      metadata: json.metadata,
      timestamp: json.timestamp ? new Date(json.timestamp) : undefined,
    };

    return new Message(config);
  }

  /**
   * 克隆消息
   */
  clone(): Message {
    return Message.fromJSON(this.toJSON());
  }

  /**
   * 创建用户消息
   */
  static createUserMessage(id: string, text: string, sessionId?: string): Message {
    return new Message({
      id,
      type: MessageType.USER,
      content: {
        type: MessageContentType.TEXT,
        data: text,
      },
      sessionId,
    });
  }

  /**
   * 创建助手消息
   */
  static createAssistantMessage(id: string, text: string, sessionId?: string): Message {
    return new Message({
      id,
      type: MessageType.ASSISTANT,
      content: {
        type: MessageContentType.TEXT,
        data: text,
      },
      sessionId,
    });
  }

  /**
   * 创建系统消息
   */
  static createSystemMessage(id: string, text: string): Message {
    return new Message({
      id,
      type: MessageType.SYSTEM,
      content: {
        type: MessageContentType.TEXT,
        data: text,
      },
    });
  }

  /**
   * 创建工具消息
   */
  static createToolMessage(id: string, toolName: string, result: any, sessionId?: string): Message {
    return new Message({
      id,
      type: MessageType.TOOL,
      content: {
        type: MessageContentType.JSON,
        data: {
          toolName,
          result,
        },
      },
      sessionId,
    });
  }

  /**
   * 创建 Markdown 消息
   */
  static createMarkdownMessage(
    id: string,
    markdown: string,
    type: MessageType = MessageType.ASSISTANT,
    sessionId?: string,
  ): Message {
    return new Message({
      id,
      type,
      content: {
        type: MessageContentType.MARKDOWN,
        data: markdown,
      },
      sessionId,
    });
  }

  /**
   * 创建代码消息
   */
  static createCodeMessage(
    id: string,
    code: string,
    language: string,
    type: MessageType = MessageType.ASSISTANT,
    sessionId?: string,
  ): Message {
    return new Message({
      id,
      type,
      content: {
        type: MessageContentType.CODE,
        data: {
          code,
          language,
        },
      },
      sessionId,
    });
  }

  /**
   * 创建图片消息
   */
  static createImageMessage(
    id: string,
    imageUrl: string,
    caption?: string,
    type: MessageType = MessageType.USER,
    sessionId?: string,
  ): Message {
    return new Message({
      id,
      type,
      content: {
        type: MessageContentType.IMAGE,
        data: {
          url: imageUrl,
          caption,
        },
      },
      sessionId,
    });
  }
}
