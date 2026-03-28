/**
 * Session 模型
 * 管理会话状态和消息列表
 */

import { Message, MessageType } from "@/core/message/Message.js";
import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * 会话状态枚举
 */
export enum SessionState {
  ACTIVE = "active",
  PAUSED = "paused",
  CLOSED = "closed",
  ARCHIVED = "archived",
}

/**
 * 会话配置接口
 */
export interface SessionConfig {
  id: string;
  userId?: string;
  title?: string;
  metadata?: Record<string, any>;
  maxMessages?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 会话上下文接口
 */
export interface SessionContext {
  state: SessionState;
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session 类
 * 管理会话状态和消息列表
 */
export class Session {
  private config: SessionConfig;
  private context: SessionContext;
  private messages: Message[] = [];
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: SessionConfig) {
    this.config = {
      maxMessages: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...config,
    };

    this.context = {
      state: SessionState.ACTIVE,
      messageCount: 0,
      lastMessageAt: null,
      createdAt: this.config.createdAt!,
      updatedAt: this.config.updatedAt!,
    };

    this.log = logger.withContext({ component: "Session", sessionId: this.config.id });
    this.log.debug(`Session created: ${this.config.id}`);
  }

  /**
   * 获取会话 ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 获取用户 ID
   */
  getUserId(): string | undefined {
    return this.config.userId;
  }

  /**
   * 获取会话标题
   */
  getTitle(): string {
    return this.config.title || `Session ${this.config.id}`;
  }

  /**
   * 设置会话标题
   */
  setTitle(title: string): void {
    this.config.title = title;
    this.updateTimestamp();
    this.log.debug(`Session title updated: ${title}`);
  }

  /**
   * 获取会话状态
   */
  getState(): SessionState {
    return this.context.state;
  }

  /**
   * 设置会话状态
   */
  setState(state: SessionState): void {
    this.context.state = state;
    this.updateTimestamp();
    this.log.debug(`Session state changed: ${state}`);
  }

  /**
   * 添加消息
   */
  addMessage(message: Message): void {
    if (this.context.state === SessionState.CLOSED) {
      throw new AppError("Cannot add message to closed session", ErrorCode.INVALID_INPUT, 400);
    }

    // 检查是否超过最大消息数限制，如果超过则移除最旧的消息
    if (this.config.maxMessages && this.messages.length >= this.config.maxMessages) {
      const removed = this.messages.shift();
      this.log.debug(
        `Removed oldest message: ${removed?.getId()} (limit: ${this.config.maxMessages})`,
      );
    }

    this.messages.push(message);
    this.context.messageCount = this.messages.length;
    this.context.lastMessageAt = new Date();
    this.updateTimestamp();

    this.log.debug(`Message added: ${message.getId()}`);
  }

  /**
   * 获取所有消息
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * 获取指定类型的消息
   */
  getMessagesByType(type: MessageType): Message[] {
    return this.messages.filter((msg) => msg.getType() === type);
  }

  /**
   * 获取最后一条消息
   */
  getLastMessage(): Message | null {
    return this.messages[this.messages.length - 1] || null;
  }

  /**
   * 获取消息数量
   */
  getMessageCount(): number {
    return this.context.messageCount;
  }

  /**
   * 清空消息列表
   */
  clearMessages(): void {
    this.messages = [];
    this.context.messageCount = 0;
    this.context.lastMessageAt = null;
    this.updateTimestamp();
    this.log.debug("Messages cleared");
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
   * 获取最后消息时间
   */
  getLastMessageAt(): Date | null {
    return this.context.lastMessageAt;
  }

  /**
   * 检查会话是否活跃
   */
  isActive(): boolean {
    return this.context.state === SessionState.ACTIVE;
  }

  /**
   * 检查会话是否已关闭
   */
  isClosed(): boolean {
    return this.context.state === SessionState.CLOSED;
  }

  /**
   * 检查会话是否已归档
   */
  isArchived(): boolean {
    return this.context.state === SessionState.ARCHIVED;
  }

  /**
   * 暂停会话
   */
  pause(): void {
    if (this.context.state !== SessionState.ACTIVE) {
      throw new AppError("Can only pause active session", ErrorCode.INVALID_INPUT, 400);
    }
    this.setState(SessionState.PAUSED);
  }

  /**
   * 恢复会话
   */
  resume(): void {
    if (this.context.state !== SessionState.PAUSED) {
      throw new AppError("Can only resume paused session", ErrorCode.INVALID_INPUT, 400);
    }
    this.setState(SessionState.ACTIVE);
  }

  /**
   * 关闭会话
   */
  close(): void {
    if (this.context.state === SessionState.CLOSED) {
      throw new AppError("Session is already closed", ErrorCode.INVALID_INPUT, 400);
    }
    this.setState(SessionState.CLOSED);
    this.log.info(`Session closed: ${this.config.id}`);
  }

  /**
   * 归档会话
   */
  archive(): void {
    if (this.context.state === SessionState.ARCHIVED) {
      throw new AppError("Session is already archived", ErrorCode.INVALID_INPUT, 400);
    }
    this.setState(SessionState.ARCHIVED);
    this.log.info(`Session archived: ${this.config.id}`);
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
      id: this.config.id,
      userId: this.config.userId,
      title: this.config.title,
      state: this.context.state,
      metadata: this.config.metadata,
      messageCount: this.context.messageCount,
      messages: this.messages.map((msg) => msg.toJSON()),
      createdAt: this.context.createdAt.toISOString(),
      updatedAt: this.context.updatedAt.toISOString(),
      lastMessageAt: this.context.lastMessageAt?.toISOString() || null,
    };
  }

  /**
   * 从 JSON 创建 Session
   */
  static fromJSON(json: any): Session {
    const config: SessionConfig = {
      id: json.id,
      userId: json.userId,
      title: json.title,
      metadata: json.metadata,
      maxMessages: json.maxMessages,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
    };

    const session = new Session(config);

    // 恢复状态
    session.context.state = json.state;
    session.context.messageCount = json.messageCount;
    session.context.lastMessageAt = json.lastMessageAt ? new Date(json.lastMessageAt) : null;

    // 恢复消息
    if (json.messages && Array.isArray(json.messages)) {
      session.messages = json.messages.map((msg: any) => Message.fromJSON(msg));
    }

    return session;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.clearMessages();
    this.log.debug(`Session cleaned up: ${this.config.id}`);
  }
}
