/**
 * SessionManager
 * Session 生命周期管理和持久化
 */

import { Session, SessionState, type SessionConfig } from "./Session.js";
import { Message } from "@/core/message/Message.js";
import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";

/**
 * SessionManager 配置接口
 */
export interface SessionManagerConfig {
  maxSessions?: number;
  maxMessagesPerSession?: number;
  autoArchiveDays?: number;
  storageDir?: string;
}

/**
 * Session 统计信息接口
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  pausedSessions: number;
  closedSessions: number;
  archivedSessions: number;
  totalMessages: number;
}

/**
 * SessionManager 类
 * 管理 Session 的生命周期和持久化
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private config: Required<SessionManagerConfig>;
  private log: ReturnType<typeof logger.withContext>;

  constructor(config: SessionManagerConfig = {}) {
    this.config = {
      maxSessions: 1000,
      maxMessagesPerSession: 100,
      autoArchiveDays: 30,
      storageDir: "./sessions",
      ...config,
    };

    this.log = logger.withContext({ component: "SessionManager" });
    this.log.debug(`SessionManager initialized with config: ${JSON.stringify(this.config)}`);
  }

  /**
   * 创建新会话
   */
  createSession(config: SessionConfig): Session {
    // 检查会话数量限制
    if (this.sessions.size >= this.config.maxSessions) {
      throw new AppError(
        `Maximum number of sessions reached: ${this.config.maxSessions}`,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        400,
      );
    }

    // 检查是否已存在同名会话
    if (this.sessions.has(config.id)) {
      throw new AppError(
        `Session with id "${config.id}" already exists`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    // 创建会话
    const session = new Session({
      maxMessages: this.config.maxMessagesPerSession,
      ...config,
    });

    this.sessions.set(session.getId(), session);
    this.log.info(`Session created: ${session.getId()}`);

    return session;
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 检查会话是否存在
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 按状态获取会话
   */
  getSessionsByState(state: SessionState): Session[] {
    return Array.from(this.sessions.values()).filter((session) => session.getState() === state);
  }

  /**
   * 按用户 ID 获取会话
   */
  getSessionsByUserId(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter((session) => session.getUserId() === userId);
  }

  /**
   * 获取活跃会话
   */
  getActiveSessions(): Session[] {
    return this.getSessionsByState(SessionState.ACTIVE);
  }

  /**
   * 获取暂停的会话
   */
  getPausedSessions(): Session[] {
    return this.getSessionsByState(SessionState.PAUSED);
  }

  /**
   * 获取关闭的会话
   */
  getClosedSessions(): Session[] {
    return this.getSessionsByState(SessionState.CLOSED);
  }

  /**
   * 获取归档的会话
   */
  getArchivedSessions(): Session[] {
    return this.getSessionsByState(SessionState.ARCHIVED);
  }

  /**
   * 更新会话
   */
  updateSession(sessionId: string, updates: Partial<SessionConfig>): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    // 更新会话属性
    if (updates.title !== undefined) {
      session.setTitle(updates.title);
    }
    if (updates.metadata !== undefined) {
      session.setMetadata(updates.metadata);
    }

    this.log.debug(`Session updated: ${sessionId}`);
    return session;
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.cleanup();
    this.sessions.delete(sessionId);
    this.log.info(`Session deleted: ${sessionId}`);
    return true;
  }

  /**
   * 暂停会话
   */
  pauseSession(sessionId: string): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    session.pause();
    return session;
  }

  /**
   * 恢复会话
   */
  resumeSession(sessionId: string): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    session.resume();
    return session;
  }

  /**
   * 关闭会话
   */
  closeSession(sessionId: string): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    session.close();
    return session;
  }

  /**
   * 归档会话
   */
  archiveSession(sessionId: string): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    session.archive();
    return session;
  }

  /**
   * 向会话添加消息
   */
  addMessageToSession(sessionId: string, message: Message): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    session.addMessage(message);
    return session;
  }

  /**
   * 批量向会话添加消息
   */
  addMessagesToSession(sessionId: string, messages: Message[]): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    for (const message of messages) {
      session.addMessage(message);
    }

    return session;
  }

  /**
   * 清空会话消息
   */
  clearSessionMessages(sessionId: string): Session {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    session.clearMessages();
    return session;
  }

  /**
   * 获取会话统计信息
   */
  getStats(): SessionStats {
    const sessions = Array.from(this.sessions.values());
    const totalMessages = sessions.reduce((total, session) => total + session.getMessageCount(), 0);

    return {
      totalSessions: sessions.length,
      activeSessions: this.getActiveSessions().length,
      pausedSessions: this.getPausedSessions().length,
      closedSessions: this.getClosedSessions().length,
      archivedSessions: this.getArchivedSessions().length,
      totalMessages,
    };
  }

  /**
   * 清空所有会话
   */
  clearAllSessions(): void {
    for (const session of this.sessions.values()) {
      session.cleanup();
    }
    this.sessions.clear();
    this.log.info("All sessions cleared");
  }

  /**
   * 清空指定状态的会话
   */
  clearSessionsByState(state: SessionState): void {
    const toDelete = this.getSessionsByState(state);
    for (const session of toDelete) {
      session.cleanup();
      this.sessions.delete(session.getId());
    }
    this.log.info(`Cleared ${toDelete.length} sessions with state: ${state}`);
  }

  /**
   * 自动归档过期会话
   */
  archiveExpiredSessions(): number {
    const now = new Date();
    const expiredDays = this.config.autoArchiveDays;
    let archivedCount = 0;

    for (const session of this.sessions.values()) {
      if (
        session.isActive() &&
        session.getLastMessageAt() &&
        now.getTime() - session.getLastMessageAt()!.getTime() > expiredDays * 24 * 60 * 60 * 1000
      ) {
        try {
          session.archive();
          archivedCount++;
        } catch (error) {
          this.log.error(`Failed to archive session: ${session.getId()}`, error);
        }
      }
    }

    if (archivedCount > 0) {
      this.log.info(`Archived ${archivedCount} expired sessions`);
    }

    return archivedCount;
  }

  /**
   * 导出会话为 JSON
   */
  exportSession(sessionId: string): any {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    return session.toJSON();
  }

  /**
   * 导入会话
   */
  importSession(json: any): Session {
    const session = Session.fromJSON(json);

    // 检查是否已存在同名会话
    if (this.sessions.has(session.getId())) {
      throw new AppError(
        `Session with id "${session.getId()}" already exists`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    this.sessions.set(session.getId(), session);
    this.log.info(`Session imported: ${session.getId()}`);

    return session;
  }

  /**
   * 导出所有会话
   */
  exportAllSessions(): any[] {
    return Array.from(this.sessions.values()).map((session) => session.toJSON());
  }

  /**
   * 批量导入会话
   */
  importSessions(jsonArray: any[]): Session[] {
    const importedSessions: Session[] = [];

    for (const json of jsonArray) {
      try {
        const session = this.importSession(json);
        importedSessions.push(session);
      } catch (error) {
        this.log.error(`Failed to import session: ${json.id}`, error);
      }
    }

    this.log.info(`Imported ${importedSessions.length} sessions`);
    return importedSessions;
  }

  /**
   * 重置管理器
   */
  reset(): void {
    this.clearAllSessions();
    this.log.info("SessionManager reset");
  }

  /**
   * 获取配置
   */
  getConfig(): Required<SessionManagerConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SessionManagerConfig>): void {
    Object.assign(this.config, updates);
    this.log.debug(`Config updated: ${JSON.stringify(updates)}`);
  }
}
