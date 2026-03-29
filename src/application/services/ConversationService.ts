/**
 * ConversationService
 * 对话管理服务
 * 整合 Session、Message、Agent
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import { Session, SessionState } from "@/core/session/Session.js";
import { SessionManager } from "@/core/session/SessionManager.js";
import { Message } from "@/core/message/Message.js";
import { MainAgent, type MainAgentConfig } from "@/core/agent/MainAgent.js";
import { SubAgent } from "@/core/agent/SubAgent.js";
import { PreferenceManager } from "@/core/preference/PreferenceManager.js";
import { PreferenceAnalyzer } from "@/core/preference/PreferenceAnalyzer.js";

/**
 * 对话配置接口
 */
export interface ConversationConfig {
  sessionId: string;
  userId: string;
  title?: string;
  agentConfig?: MainAgentConfig;
}

/**
 * 对话消息接口
 */
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, any>;
}

/**
 * 对话响应接口
 */
export interface ConversationResponse {
  sessionId: string;
  messageId: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * ConversationService 类
 * 对话管理服务
 */
export class ConversationService {
  private sessionManager: SessionManager;
  private agents: Map<string, MainAgent> = new Map();
  private preferenceManager: PreferenceManager;
  private preferenceAnalyzer: PreferenceAnalyzer;
  private log: ReturnType<typeof logger.withContext>;

  constructor() {
    this.sessionManager = new SessionManager();
    this.preferenceManager = new PreferenceManager();
    this.preferenceAnalyzer = new PreferenceAnalyzer();
    this.log = logger.withContext({ component: "ConversationService" });
    this.log.debug("ConversationService initialized");
  }

  /**
   * 创建新对话
   */
  async createConversation(config: ConversationConfig): Promise<Session> {
    this.log.debug(`Creating conversation: ${config.sessionId}`);

    // 创建 Session
    const session = this.sessionManager.createSession({
      id: config.sessionId,
      userId: config.userId,
      title: config.title,
    });

    // 创建并注册 MainAgent
    const agent = new MainAgent({
      name: `agent-${config.sessionId}`,
      description: `Agent for conversation ${config.sessionId}`,
      ...config.agentConfig,
    });

    this.agents.set(config.sessionId, agent);
    this.log.info(`Conversation created: ${config.sessionId}`);

    return session;
  }

  /**
   * 获取对话
   */
  getConversation(sessionId: string): Session | undefined {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * 发送消息
   */
  async sendMessage(
    sessionId: string,
    content: string,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<ConversationResponse> {
    this.log.debug(`Sending message to session: ${sessionId}`);

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    if (!session.isActive()) {
      throw new AppError(`Session is not active: ${sessionId}`, ErrorCode.INVALID_INPUT, 400);
    }

    // 创建用户消息
    const userMessageId = `msg-${Date.now()}-user`;
    const userMessage = Message.createUserMessage(userMessageId, content, sessionId);
    if (metadata) {
      userMessage.setMetadata(metadata);
    }

    // 添加到会话
    session.addMessage(userMessage);

    // 分析用户偏好
    const preference = await this.preferenceManager.getPreference(userId);
    const updatedPreference = this.preferenceAnalyzer.updatePreference(preference, [userMessage]);
    await this.preferenceManager.savePreference(userId, updatedPreference);

    // 获取 Agent 并执行
    const agent = this.agents.get(sessionId);
    if (!agent) {
      throw new AppError(`Agent not found for session: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    // 执行 Agent 生成回复
    const agentResult = await agent.execute({
      session: session.toJSON(),
      userMessage: userMessage.toJSON(),
      preference: updatedPreference.toJSON(),
    });

    // 创建助手消息
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage = Message.createAssistantMessage(
      assistantMessageId,
      agentResult.response || "I'm sorry, I couldn't generate a response.",
      sessionId,
    );

    session.addMessage(assistantMessage);

    const response: ConversationResponse = {
      sessionId,
      messageId: assistantMessageId,
      content: assistantMessage.getText(),
      metadata: agentResult.metadata,
    };

    this.log.info(`Message sent to session: ${sessionId}`);
    return response;
  }

  /**
   * 批量发送消息
   */
  async sendMessages(
    sessionId: string,
    messages: ConversationMessage[],
    userId: string,
  ): Promise<ConversationResponse[]> {
    this.log.debug(`Sending ${messages.length} messages to session: ${sessionId}`);

    const responses: ConversationResponse[] = [];

    for (const message of messages) {
      const response = await this.sendMessage(sessionId, message.content, userId, message.metadata);
      responses.push(response);
    }

    return responses;
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(sessionId: string): Message[] {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    return session.getMessages();
  }

  /**
   * 获取对话摘要
   */
  getConversationSummary(sessionId: string): {
    id: string;
    userId: string;
    title: string;
    state: SessionState;
    messageCount: number;
    lastMessageAt: Date | null;
    createdAt: Date;
  } {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new AppError(`Session not found: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    return {
      id: session.getId(),
      userId: session.getUserId() || "",
      title: session.getTitle(),
      state: session.getState(),
      messageCount: session.getMessageCount(),
      lastMessageAt: session.getLastMessageAt(),
      createdAt: session.getCreatedAt(),
    };
  }

  /**
   * 暂停对话
   */
  pauseConversation(sessionId: string): Session {
    const session = this.sessionManager.pauseSession(sessionId);
    this.log.info(`Conversation paused: ${sessionId}`);
    return session;
  }

  /**
   * 恢复对话
   */
  resumeConversation(sessionId: string): Session {
    const session = this.sessionManager.resumeSession(sessionId);
    this.log.info(`Conversation resumed: ${sessionId}`);
    return session;
  }

  /**
   * 关闭对话
   */
  closeConversation(sessionId: string): Session {
    const session = this.sessionManager.closeSession(sessionId);

    // 清理 Agent
    const agent = this.agents.get(sessionId);
    if (agent) {
      agent.cleanup();
      this.agents.delete(sessionId);
    }

    this.log.info(`Conversation closed: ${sessionId}`);
    return session;
  }

  /**
   * 删除对话
   */
  deleteConversation(sessionId: string): boolean {
    // 清理 Agent
    const agent = this.agents.get(sessionId);
    if (agent) {
      agent.cleanup();
      this.agents.delete(sessionId);
    }

    // 删除 Session
    return this.sessionManager.deleteSession(sessionId);
  }

  /**
   * 获取用户的所有对话
   */
  getUserConversations(userId: string): Session[] {
    return this.sessionManager.getSessionsByUserId(userId);
  }

  /**
   * 获取活跃对话
   */
  getActiveConversations(): Session[] {
    return this.sessionManager.getActiveSessions();
  }

  /**
   * 注册子代理
   */
  registerSubAgent(sessionId: string, agent: SubAgent): void {
    const mainAgent = this.agents.get(sessionId);
    if (!mainAgent) {
      throw new AppError(`MainAgent not found for session: ${sessionId}`, ErrorCode.NOT_FOUND, 404);
    }

    mainAgent.registerSubAgent(agent);
    this.log.info(`SubAgent registered for session: ${sessionId}`);
  }

  /**
   * 获取对话统计
   */
  getStats(): {
    totalConversations: number;
    activeConversations: number;
    pausedConversations: number;
    closedConversations: number;
    totalMessages: number;
  } {
    const stats = this.sessionManager.getStats();

    return {
      totalConversations: stats.totalSessions,
      activeConversations: stats.activeSessions,
      pausedConversations: stats.pausedSessions,
      closedConversations: stats.closedSessions,
      totalMessages: stats.totalMessages,
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清理所有 Agent
    for (const agent of this.agents.values()) {
      await agent.cleanup();
    }
    this.agents.clear();

    // 清理 SessionManager
    this.sessionManager.clearAllSessions();

    // 清理 PreferenceManager
    this.preferenceManager.cleanup();

    this.log.debug("ConversationService cleaned up");
  }
}

export default ConversationService;
