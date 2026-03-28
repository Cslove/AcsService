/**
 * MessageBuilder
 * 消息构建器和格式化工具
 */

import {
  Message,
  MessageType,
  MessageContentType,
  type MessageContent,
  type MessageConfig,
} from "./Message.js";
import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 消息构建器接口
 */
export interface MessageBuilderOptions {
  id?: string;
  type?: MessageType;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * MessageBuilder 类
 * 用于构建和格式化消息
 */
export class MessageBuilder {
  private id: string;
  private type: MessageType;
  private contents: MessageContent[] = [];
  private sessionId?: string;
  private userId?: string;
  private metadata: Record<string, any> = {};
  private log: ReturnType<typeof logger.withContext>;

  constructor(options: MessageBuilderOptions = {}) {
    this.id = options.id || this.generateId();
    this.type = options.type || MessageType.USER;
    this.sessionId = options.sessionId;
    this.userId = options.userId;
    this.metadata = options.metadata || {};

    this.log = logger.withContext({ component: "MessageBuilder", messageId: this.id });
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置消息 ID
   */
  setId(id: string): MessageBuilder {
    this.id = id;
    return this;
  }

  /**
   * 设置消息类型
   */
  setType(type: MessageType): MessageBuilder {
    this.type = type;
    return this;
  }

  /**
   * 设置会话 ID
   */
  setSessionId(sessionId: string): MessageBuilder {
    this.sessionId = sessionId;
    return this;
  }

  /**
   * 设置用户 ID
   */
  setUserId(userId: string): MessageBuilder {
    this.userId = userId;
    return this;
  }

  /**
   * 添加文本内容
   */
  addText(text: string, metadata?: Record<string, any>): MessageBuilder {
    this.contents.push({
      type: MessageContentType.TEXT,
      data: text,
      metadata,
    });
    return this;
  }

  /**
   * 添加 Markdown 内容
   */
  addMarkdown(markdown: string, metadata?: Record<string, any>): MessageBuilder {
    this.contents.push({
      type: MessageContentType.MARKDOWN,
      data: markdown,
      metadata,
    });
    return this;
  }

  /**
   * 添加代码内容
   */
  addCode(code: string, language: string, metadata?: Record<string, any>): MessageBuilder {
    this.contents.push({
      type: MessageContentType.CODE,
      data: {
        code,
        language,
      },
      metadata,
    });
    return this;
  }

  /**
   * 添加 JSON 内容
   */
  addJson(data: any, metadata?: Record<string, any>): MessageBuilder {
    this.contents.push({
      type: MessageContentType.JSON,
      data,
      metadata,
    });
    return this;
  }

  /**
   * 添加图片内容
   */
  addImage(url: string, caption?: string, metadata?: Record<string, any>): MessageBuilder {
    this.contents.push({
      type: MessageContentType.IMAGE,
      data: {
        url,
        caption,
      },
      metadata,
    });
    return this;
  }

  /**
   * 添加音频内容
   */
  addAudio(url: string, duration?: number, metadata?: Record<string, any>): MessageBuilder {
    this.contents.push({
      type: MessageContentType.AUDIO,
      data: {
        url,
        duration,
      },
      metadata,
    });
    return this;
  }

  /**
   * 添加视频内容
   */
  addVideo(url: string, duration?: number, metadata?: Record<string, any>): MessageBuilder {
    this.contents.push({
      type: MessageContentType.VIDEO,
      data: {
        url,
        duration,
      },
      metadata,
    });
    return this;
  }

  /**
   * 添加文件内容
   */
  addFile(
    url: string,
    filename: string,
    size?: number,
    metadata?: Record<string, any>,
  ): MessageBuilder {
    this.contents.push({
      type: MessageContentType.FILE,
      data: {
        url,
        filename,
        size,
      },
      metadata,
    });
    return this;
  }

  /**
   * 添加自定义内容
   */
  addContent(content: MessageContent): MessageBuilder {
    this.contents.push(content);
    return this;
  }

  /**
   * 设置元数据
   */
  setMetadata(metadata: Record<string, any>): MessageBuilder {
    this.metadata = metadata;
    return this;
  }

  /**
   * 更新元数据
   */
  updateMetadata(key: string, value: any): MessageBuilder {
    this.metadata[key] = value;
    return this;
  }

  /**
   * 清空内容
   */
  clearContent(): MessageBuilder {
    this.contents = [];
    return this;
  }

  /**
   * 构建消息
   */
  build(): Message {
    if (this.contents.length === 0) {
      throw new AppError("Message must have at least one content", ErrorCode.INVALID_INPUT, 400);
    }

    const config: MessageConfig = {
      id: this.id,
      type: this.type,
      content: this.contents.length === 1 ? this.contents[0] : this.contents,
      sessionId: this.sessionId,
      userId: this.userId,
      metadata: this.metadata,
    };

    const message = new Message(config);
    this.log.debug(`Message built: ${this.id}`);
    return message;
  }

  /**
   * 格式化文本为 Markdown
   */
  static formatMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, "**$1**")
      .replace(/\*(.+?)\*/g, "*$1*")
      .replace(/`(.+?)`/g, "`$1`")
      .replace(/```(.+?)```/gs, "```$1```");
  }

  /**
   * 格式化代码块
   */
  static formatCodeBlock(code: string, language: string): string {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  /**
   * 格式化链接
   */
  static formatLink(text: string, url: string): string {
    return `[${text}](${url})`;
  }

  /**
   * 格式化图片
   */
  static formatImage(alt: string, url: string): string {
    return `![${alt}](${url})`;
  }

  /**
   * 格式化引用
   */
  static formatQuote(text: string): string {
    return `> ${text}`;
  }

  /**
   * 格式化列表项
   */
  static formatListItem(item: string, ordered: boolean = false, index?: number): string {
    if (ordered) {
      return `${index || 1}. ${item}`;
    }
    return `- ${item}`;
  }

  /**
   * 格式化标题
   */
  static formatHeading(text: string, level: number = 1): string {
    const hashes = "#".repeat(Math.min(Math.max(level, 1), 6));
    return `${hashes} ${text}`;
  }

  /**
   * 格式化分割线
   */
  static formatHorizontalRule(): string {
    return "---";
  }

  /**
   * 格式化表格行
   */
  static formatTableRow(cells: string[], isHeader: boolean = false): string {
    const separator = isHeader ? "| " + cells.map(() => "---").join(" | ") + " |" : "";
    const row = "| " + cells.join(" | ") + " |";
    return isHeader ? `${row}\n${separator}` : row;
  }

  /**
   * 格式化 JSON 为可读字符串
   */
  static formatJson(data: any, indent: number = 2): string {
    return JSON.stringify(data, null, indent);
  }

  /**
   * 从文本创建用户消息
   */
  static createUserMessage(text: string, sessionId?: string): Message {
    return new MessageBuilder({
      type: MessageType.USER,
      sessionId,
    })
      .addText(text)
      .build();
  }

  /**
   * 从文本创建助手消息
   */
  static createAssistantMessage(text: string, sessionId?: string): Message {
    return new MessageBuilder({
      type: MessageType.ASSISTANT,
      sessionId,
    })
      .addText(text)
      .build();
  }

  /**
   * 从 Markdown 创建助手消息
   */
  static createMarkdownMessage(markdown: string, sessionId?: string): Message {
    return new MessageBuilder({
      type: MessageType.ASSISTANT,
      sessionId,
    })
      .addMarkdown(markdown)
      .build();
  }

  /**
   * 从代码创建助手消息
   */
  static createCodeMessage(code: string, language: string, sessionId?: string): Message {
    return new MessageBuilder({
      type: MessageType.ASSISTANT,
      sessionId,
    })
      .addCode(code, language)
      .build();
  }

  /**
   * 创建混合内容消息
   */
  static createMixedMessage(
    type: MessageType,
    contents: Array<{
      type: "text" | "markdown" | "code" | "image" | "json";
      data: any;
      language?: string;
    }>,
    sessionId?: string,
  ): Message {
    const builder = new MessageBuilder({
      type,
      sessionId,
    });

    for (const content of contents) {
      switch (content.type) {
        case "text":
          builder.addText(content.data);
          break;
        case "markdown":
          builder.addMarkdown(content.data);
          break;
        case "code":
          builder.addCode(content.data, content.language || "text");
          break;
        case "image":
          builder.addImage(content.data);
          break;
        case "json":
          builder.addJson(content.data);
          break;
      }
    }

    return builder.build();
  }

  /**
   * 合并多个消息
   */
  static mergeMessages(messages: Message[], type: MessageType = MessageType.ASSISTANT): Message {
    if (messages.length === 0) {
      throw new AppError("Cannot merge empty messages", ErrorCode.INVALID_INPUT, 400);
    }

    const builder = new MessageBuilder({
      type,
      sessionId: messages[0].getSessionId(),
    });

    for (const message of messages) {
      const content = message.getContent();
      if (Array.isArray(content)) {
        for (const c of content) {
          builder.addContent(c);
        }
      } else {
        builder.addContent(content);
      }
    }

    return builder.build();
  }

  /**
   * 将消息转换为纯文本
   */
  static toPlainText(message: Message): string {
    const content = message.getContent();
    if (!content) return "";

    if (Array.isArray(content)) {
      return content
        .map((c) => {
          switch (c.type) {
            case MessageContentType.TEXT:
            case MessageContentType.MARKDOWN:
              return c.data;
            case MessageContentType.CODE:
              return c.data.code || "";
            case MessageContentType.JSON:
              return JSON.stringify(c.data, null, 2);
            case MessageContentType.IMAGE:
              return `[Image: ${c.data.caption || c.data.url}]`;
            case MessageContentType.AUDIO:
              return `[Audio: ${c.data.url}]`;
            case MessageContentType.VIDEO:
              return `[Video: ${c.data.url}]`;
            case MessageContentType.FILE:
              return `[File: ${c.data.filename || c.data.url}]`;
            default:
              return "";
          }
        })
        .join("\n\n");
    }

    switch (content.type) {
      case MessageContentType.TEXT:
      case MessageContentType.MARKDOWN:
        return content.data;
      case MessageContentType.CODE:
        return content.data.code || "";
      case MessageContentType.JSON:
        return JSON.stringify(content.data, null, 2);
      case MessageContentType.IMAGE:
        return `[Image: ${content.data.caption || content.data.url}]`;
      case MessageContentType.AUDIO:
        return `[Audio: ${content.data.url}]`;
      case MessageContentType.VIDEO:
        return `[Video: ${content.data.url}]`;
      case MessageContentType.FILE:
        return `[File: ${content.data.filename || content.data.url}]`;
      default:
        return "";
    }
  }

  /**
   * 将消息转换为 Markdown
   */
  static toMarkdown(message: Message): string {
    const content = message.getContent();
    if (!content) return "";

    if (Array.isArray(content)) {
      return content
        .map((c) => {
          switch (c.type) {
            case MessageContentType.TEXT:
              return c.data;
            case MessageContentType.MARKDOWN:
              return c.data;
            case MessageContentType.CODE:
              return MessageBuilder.formatCodeBlock(c.data.code, c.data.language || "text");
            case MessageContentType.JSON:
              return "```json\n" + JSON.stringify(c.data, null, 2) + "\n```";
            case MessageContentType.IMAGE:
              return MessageBuilder.formatImage(c.data.caption || "Image", c.data.url);
            case MessageContentType.AUDIO:
              return `[Audio](${c.data.url})`;
            case MessageContentType.VIDEO:
              return `[Video](${c.data.url})`;
            case MessageContentType.FILE:
              return `[${c.data.filename || "File"}](${c.data.url})`;
            default:
              return "";
          }
        })
        .join("\n\n");
    }

    switch (content.type) {
      case MessageContentType.TEXT:
        return content.data;
      case MessageContentType.MARKDOWN:
        return content.data;
      case MessageContentType.CODE:
        return MessageBuilder.formatCodeBlock(content.data.code, content.data.language || "text");
      case MessageContentType.JSON:
        return "```json\n" + JSON.stringify(content.data, null, 2) + "\n```";
      case MessageContentType.IMAGE:
        return MessageBuilder.formatImage(content.data.caption || "Image", content.data.url);
      case MessageContentType.AUDIO:
        return `[Audio](${content.data.url})`;
      case MessageContentType.VIDEO:
        return `[Video](${content.data.url})`;
      case MessageContentType.FILE:
        return `[${content.data.filename || "File"}](${content.data.url})`;
      default:
        return "";
    }
  }
}
