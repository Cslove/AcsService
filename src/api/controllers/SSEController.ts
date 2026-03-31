/**
 * SSE Controller
 * 管理 SSE 连接、事件订阅和推送
 */

import { eventBus } from "@/infrastructure/events/EventBus.js";
import { EventType, type SSEEvent } from "@/shared/types/index.js";
import { logger } from "@/shared/utils/logger.js";
import { v4 as uuidv4 } from "uuid";

/**
 * SSE 连接配置
 */
const SSE_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30秒心跳间隔
  MAX_CONNECTIONS_PER_USER: 5, // 每个用户最大连接数
  CONNECTION_TIMEOUT: 60000, // 60秒连接超时
  RECONNECT_DELAY: 5000, // 5秒重连延迟
};

/**
 * SSE 连接接口
 */
export interface SSEConnection {
  connectionId: string;
  userId: string;
  sessionId?: string;
  response: any; // Hono Response 对象
  createdAt: number;
  lastActivityAt: number;
  heartbeatTimer: NodeJS.Timeout;
  timeoutTimer: NodeJS.Timeout;
  listenerIds: string[];
}

/**
 * 连接统计信息
 */
export interface ConnectionStats {
  totalConnections: number;
  connectionsByUser: Map<string, number>;
  totalMessagesSent: number;
}

/**
 * SSE 控制器类
 */
export class SSEController {
  private connections: Map<string, SSEConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private stats: ConnectionStats = {
    totalConnections: 0,
    connectionsByUser: new Map(),
    totalMessagesSent: 0,
  };

  /**
   * 订阅 SSE 事件
   * @param userId 用户 ID
   * @param sessionId 会话 ID（可选）
   * @param response Hono Response 对象
   * @returns 连接 ID
   */
  subscribe(userId: string, sessionId: string | undefined, response: any): string {
    // 检查用户连接数限制
    const userConnIds = this.userConnections.get(userId) || new Set();
    if (userConnIds.size >= SSE_CONFIG.MAX_CONNECTIONS_PER_USER) {
      throw new Error(
        `Maximum connections (${SSE_CONFIG.MAX_CONNECTIONS_PER_USER}) reached for user ${userId}`,
      );
    }

    const connectionId = uuidv4();
    const now = Date.now();

    // 创建连接对象
    const connection: SSEConnection = {
      connectionId,
      userId,
      sessionId,
      response,
      createdAt: now,
      lastActivityAt: now,
      heartbeatTimer: this.startHeartbeat(connectionId),
      timeoutTimer: this.startTimeoutCheck(connectionId),
      listenerIds: [],
    };

    // 存储连接
    this.connections.set(connectionId, connection);

    // 更新用户连接映射
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // 更新统计信息
    this.stats.totalConnections++;
    this.stats.connectionsByUser.set(userId, (this.stats.connectionsByUser.get(userId) || 0) + 1);

    // 订阅 EventBus 事件
    this.subscribeToEvents(connectionId, userId, sessionId);

    logger.info("SSE connection established", {
      connectionId,
      userId,
      sessionId,
    });

    return connectionId;
  }

  /**
   * 取消订阅并关闭连接
   * @param connectionId 连接 ID
   */
  unsubscribe(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn("SSE connection not found", { connectionId });
      return;
    }

    // 清除定时器
    clearInterval(connection.heartbeatTimer);
    clearTimeout(connection.timeoutTimer);

    // 取消 EventBus 事件订阅
    for (const listenerId of connection.listenerIds) {
      eventBus.off(listenerId);
    }

    // 移除连接
    this.connections.delete(connectionId);

    // 更新用户连接映射
    const userConnIds = this.userConnections.get(connection.userId);
    if (userConnIds) {
      userConnIds.delete(connectionId);
      if (userConnIds.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // 更新统计信息
    this.stats.connectionsByUser.set(
      connection.userId,
      Math.max(0, (this.stats.connectionsByUser.get(connection.userId) || 0) - 1),
    );

    logger.info("SSE connection closed", {
      connectionId,
      userId: connection.userId,
    });
  }

  /**
   * 向指定连接发送事件
   */
  private sendEvent(connection: SSEConnection, event: SSEEvent): void {
    try {
      const data = JSON.stringify(event);
      const message = `event: ${event.type}\ndata: ${data}\n\n`;

      // 写入响应流
      connection.response.write(message);

      // 更新活动时间和统计
      connection.lastActivityAt = Date.now();
      this.stats.totalMessagesSent++;
    } catch (error) {
      logger.error("Failed to send SSE event", {
        connectionId: connection.connectionId,
        error,
      });
      // 发送失败，关闭连接
      this.unsubscribe(connection.connectionId);
    }
  }

  /**
   * 向所有连接广播事件
   */
  broadcast(event: SSEEvent): void {
    for (const connection of this.connections.values()) {
      this.sendEvent(connection, event);
    }
  }

  /**
   * 向指定用户推送事件
   */
  sendToUser(userId: string, event: SSEEvent): void {
    const userConnIds = this.userConnections.get(userId);
    if (!userConnIds) return;

    for (const connectionId of userConnIds) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        this.sendEvent(connection, event);
      }
    }
  }

  /**
   * 向指定会话推送事件
   */
  sendToSession(sessionId: string, event: SSEEvent): void {
    for (const connection of this.connections.values()) {
      if (connection.sessionId === sessionId) {
        this.sendEvent(connection, event);
      }
    }
  }

  /**
   * 获取连接统计信息
   */
  getStats(): ConnectionStats {
    return {
      ...this.stats,
      connectionsByUser: new Map(this.stats.connectionsByUser),
    };
  }

  /**
   * 获取活跃连接数
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 关闭所有连接（用于优雅关闭）
   */
  closeAll(): void {
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      this.unsubscribe(connectionId);
    }
    logger.info("All SSE connections closed");
  }

  /**
   * 订阅 EventBus 事件
   */
  private subscribeToEvents(
    connectionId: string,
    userId: string,
    sessionId: string | undefined,
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // 需要监听的所有事件类型
    const eventsToSubscribe: EventType[] = [
      EventType.MODEL_STREAM_START,
      EventType.MODEL_STREAM_CHUNK,
      EventType.MODEL_STREAM_END,
      EventType.MODEL_ERROR,
      EventType.SESSION_CREATED,
      EventType.SESSION_UPDATED,
      EventType.SESSION_DELETED,
      EventType.MESSAGE_CREATED,
      EventType.MESSAGE_UPDATED,
      EventType.TASK_CREATED,
      EventType.TASK_UPDATED,
      EventType.TASK_COMPLETED,
      EventType.TASK_FAILED,
      EventType.AGENT_CREATED,
      EventType.AGENT_UPDATED,
      EventType.AGENT_STATE_CHANGED,
      EventType.PUSH_NOTIFICATION,
      EventType.TOPIC_SUGGESTION,
      EventType.ERROR,
      EventType.WARNING,
      EventType.INFO,
    ];

    // 为每个事件类型创建监听器
    for (const eventType of eventsToSubscribe) {
      const listenerId = eventBus.on(
        eventType,
        (data: any) => {
          const sseEvent: SSEEvent = {
            type: eventType,
            data,
            timestamp: Date.now(),
            eventId: uuidv4(),
          };

          // 根据连接范围过滤事件
          if (sessionId && data?.sessionId && data.sessionId !== sessionId) {
            return; // 会话不匹配，跳过
          }

          this.sendEvent(connection, sseEvent);
        },
        {
          namespace: `sse:${connectionId}`,
          priority: 0,
        },
      );

      connection.listenerIds.push(listenerId);
    }
  }

  /**
   * 启动心跳机制
   */
  private startHeartbeat(connectionId: string): NodeJS.Timeout {
    return setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      try {
        // 发送 SSE 注释作为心跳
        connection.response.write(": heartbeat\n\n");
        connection.lastActivityAt = Date.now();
      } catch (error) {
        logger.warn("Failed to send heartbeat", { connectionId, error });
        this.unsubscribe(connectionId);
      }
    }, SSE_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * 启动超时检查
   */
  private startTimeoutCheck(connectionId: string): NodeJS.Timeout {
    return setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      const now = Date.now();
      if (now - connection.lastActivityAt > SSE_CONFIG.CONNECTION_TIMEOUT) {
        logger.warn("SSE connection timeout", { connectionId });
        this.unsubscribe(connectionId);
      }
    }, SSE_CONFIG.CONNECTION_TIMEOUT);
  }
}

// 创建全局 SSE 控制器实例
export const sseController = new SSEController();
