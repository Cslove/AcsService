import type { EventType } from '@/shared/types/index.js';

/**
 * 事件数据结构定义
 */

// ============================================================================
// 模型相关事件数据
// ============================================================================

export interface ModelStreamStartData {
  sessionId: string;
  messageId: string;
  model: string;
}

export interface ModelStreamChunkData {
  sessionId: string;
  messageId: string;
  chunk: string;
  delta?: string;
}

export interface ModelStreamEndData {
  sessionId: string;
  messageId: string;
  finishReason?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface ModelErrorData {
  sessionId: string;
  messageId: string;
  error: string;
  code?: string;
}

// ============================================================================
// 会话相关事件数据
// ============================================================================

export interface SessionCreatedData {
  session: {
    id: string;
    userId: string;
    agentId: string;
    createdAt: Date;
  };
}

export interface SessionUpdatedData {
  sessionId: string;
  updates: {
    metadata?: Record<string, any>;
    updatedAt: Date;
  };
}

export interface SessionDeletedData {
  sessionId: string;
  userId: string;
}

// ============================================================================
// 消息相关事件数据
// ============================================================================

export interface MessageCreatedData {
  message: {
    id: string;
    sessionId: string;
    role: string;
    content: any[];
    timestamp: Date;
  };
}

export interface MessageUpdatedData {
  messageId: string;
  sessionId: string;
  updates: {
    content?: any[];
    metadata?: Record<string, any>;
    updatedAt: Date;
  };
}

// ============================================================================
// 任务相关事件数据
// ============================================================================

export interface TaskCreatedData {
  task: {
    id: string;
    type: string;
    status: string;
    title: string;
    agentId: string;
    createdAt: Date;
  };
}

export interface TaskUpdatedData {
  taskId: string;
  updates: {
    status?: string;
    output?: any;
    error?: string;
    updatedAt: Date;
  };
}

export interface TaskCompletedData {
  taskId: string;
  result: any;
  completedAt: Date;
}

export interface TaskFailedData {
  taskId: string;
  error: string;
  failedAt: Date;
}

// ============================================================================
// Agent 相关事件数据
// ============================================================================

export interface AgentCreatedData {
  agent: {
    id: string;
    type: string;
    state: string;
    createdAt: Date;
  };
}

export interface AgentUpdatedData {
  agentId: string;
  updates: {
    state?: string;
    capabilities?: string[];
    updatedAt: Date;
  };
}

export interface AgentStateChangedData {
  agentId: string;
  oldState: string;
  newState: string;
  changedAt: Date;
}

// ============================================================================
// 推送相关事件数据
// ============================================================================

export interface PushNotificationData {
  userId: string;
  type: 'morning' | 'noon' | 'evening';
  title: string;
  content: string;
  topics: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  sentAt: Date;
}

export interface TopicSuggestionData {
  userId: string;
  topics: Array<{
    id: string;
    title: string;
    description: string;
    score: number;
    categories: string[];
  }>;
  generatedAt: Date;
}

// ============================================================================
// 系统相关事件数据
// ============================================================================

export interface ErrorData {
  message: string;
  code?: string;
  stack?: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export interface WarningData {
  message: string;
  code?: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export interface InfoData {
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

// ============================================================================
// 事件数据类型映射
// ============================================================================

export type EventDataMap = {
  [EventType.MODEL_STREAM_START]: ModelStreamStartData;
  [EventType.MODEL_STREAM_CHUNK]: ModelStreamChunkData;
  [EventType.MODEL_STREAM_END]: ModelStreamEndData;
  [EventType.MODEL_ERROR]: ModelErrorData;
  
  [EventType.SESSION_CREATED]: SessionCreatedData;
  [EventType.SESSION_UPDATED]: SessionUpdatedData;
  [EventType.SESSION_DELETED]: SessionDeletedData;
  
  [EventType.MESSAGE_CREATED]: MessageCreatedData;
  [EventType.MESSAGE_UPDATED]: MessageUpdatedData;
  
  [EventType.TASK_CREATED]: TaskCreatedData;
  [EventType.TASK_UPDATED]: TaskUpdatedData;
  [EventType.TASK_COMPLETED]: TaskCompletedData;
  [EventType.TASK_FAILED]: TaskFailedData;
  
  [EventType.AGENT_CREATED]: AgentCreatedData;
  [EventType.AGENT_UPDATED]: AgentUpdatedData;
  [EventType.AGENT_STATE_CHANGED]: AgentStateChangedData;
  
  [EventType.PUSH_NOTIFICATION]: PushNotificationData;
  [EventType.TOPIC_SUGGESTION]: TopicSuggestionData;
  
  [EventType.ERROR]: ErrorData;
  [EventType.WARNING]: WarningData;
  [EventType.INFO]: InfoData;
};

/**
 * 获取事件类型对应的数据类型
 */
export type GetEventData<T extends EventType> = EventDataMap[T];

/**
 * 创建事件数据的辅助函数
 */
export function createEventData<T extends EventType>(
  eventType: T,
  data: EventDataMap[T]
): { type: T; data: EventDataMap[T]; timestamp: number } {
  return {
    type: eventType,
    data,
    timestamp: Date.now(),
  };
}
