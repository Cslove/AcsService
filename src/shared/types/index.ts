// ============================================================================
// Agent 相关类型
// ============================================================================

export enum AgentType {
  MAIN = "main",
  SUB = "sub",
}

export enum AgentState {
  CREATED = "created",
  ACTIVE = "active",
  PAUSED = "paused",
  TERMINATED = "terminated",
}

export interface BaseAgent {
  id: string;
  type: AgentType;
  state: AgentState;
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MainAgent extends BaseAgent {
  type: AgentType.MAIN;
  preference: UserPreference;
  conversationHistory: Message[];
}

export interface SubAgent extends BaseAgent {
  type: AgentType.SUB;
  parentId: string;
  task: Task;
}

// ============================================================================
// Session 和 Message 相关类型
// ============================================================================

export interface Session {
  id: string;
  userId: string;
  agentId: string;
  messages: Message[];
  metadata: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionMetadata {
  title?: string;
  tags?: string[];
  [key: string]: any;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: MessageContent[];
  parts: Part[];
  timestamp: Date;
  metadata?: MessageMetadata;
}

export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
}

export type MessageContent = TextContent | ToolCallContent | ToolResultContent;

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolCallContent {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  parameters: Record<string, any>;
}

export interface ToolResultContent {
  type: "tool_result";
  toolCallId: string;
  result: any;
  isError?: boolean;
}

export interface Part {
  id: string;
  type: PartType;
  content: any;
  metadata?: PartMetadata;
}

export enum PartType {
  TEXT = "text",
  IMAGE = "image",
  CODE = "code",
  TOOL_CALL = "tool_call",
  TOOL_RESULT = "tool_result",
}

export interface PartMetadata {
  [key: string]: any;
}

export interface MessageMetadata {
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  [key: string]: any;
}

// ============================================================================
// Task 相关类型
// ============================================================================

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  description: string;
  input: any;
  output?: any;
  error?: string;
  agentId: string;
  subTasks?: SubTask[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export enum TaskType {
  IMMEDIATE = "immediate",
  SCHEDULED = "scheduled",
  SUB = "sub",
}

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface SubTask {
  id: string;
  parentTaskId: string;
  status: TaskStatus;
  title: string;
  description: string;
  input: any;
  output?: any;
  error?: string;
  agentId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Skill 相关类型
// ============================================================================

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  parameters: SkillParameter[];
  execute: (params: Record<string, any>) => Promise<SkillResult>;
}

export enum SkillCategory {
  SEARCH = "search",
  CONTENT_GENERATION = "content_generation",
  DATA_ANALYSIS = "data_analysis",
  PLATFORM_PUBLISH = "platform_publish",
  UTILITY = "utility",
}

export interface SkillParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
}

export interface SkillResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ToolCallDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

// ============================================================================
// Preference 相关类型
// ============================================================================

export interface UserPreference {
  id: string;
  userId: string;
  tags: PreferenceTag[];
  interests: string[];
  style: WritingStyle;
  topics: string[];
  metadata: PreferenceMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferenceTag {
  name: string;
  weight: number;
  category: string;
}

export interface WritingStyle {
  tone: Tone;
  length: Length;
  format: Format;
  language: string;
}

export enum Tone {
  FORMAL = "formal",
  CASUAL = "casual",
  HUMOROUS = "humorous",
  PROFESSIONAL = "professional",
  FRIENDLY = "friendly",
}

export enum Length {
  SHORT = "short",
  MEDIUM = "medium",
  LONG = "long",
}

export enum Format {
  ARTICLE = "article",
  POST = "post",
  TWEET = "tweet",
  CAPTION = "caption",
}

export interface PreferenceMetadata {
  [key: string]: any;
}

// ============================================================================
// SSE 事件相关类型
// ============================================================================

export interface SSEEvent {
  type: EventType;
  data: any;
  timestamp: number;
  eventId: string;
}

export enum EventType {
  // 模型相关事件
  MODEL_STREAM_START = "model_stream_start",
  MODEL_STREAM_CHUNK = "model_stream_chunk",
  MODEL_STREAM_END = "model_stream_end",
  MODEL_ERROR = "model_error",

  // 会话相关事件
  SESSION_CREATED = "session_created",
  SESSION_UPDATED = "session_updated",
  SESSION_DELETED = "session_deleted",

  // 消息相关事件
  MESSAGE_CREATED = "message_created",
  MESSAGE_UPDATED = "message_updated",

  // 任务相关事件
  TASK_CREATED = "task_created",
  TASK_UPDATED = "task_updated",
  TASK_COMPLETED = "task_completed",
  TASK_FAILED = "task_failed",

  // Agent 相关事件
  AGENT_CREATED = "agent_created",
  AGENT_UPDATED = "agent_updated",
  AGENT_STATE_CHANGED = "agent_state_changed",

  // 推送相关事件
  PUSH_NOTIFICATION = "push_notification",
  TOPIC_SUGGESTION = "topic_suggestion",

  // 系统相关事件
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

// ============================================================================
// LLM 相关类型
// ============================================================================

export interface ChatParams {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    toolCalls?: ToolCallContent[];
  }>;
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolCallDefinition[];
  stream?: boolean;
}

export interface ChatChunk {
  content: string;
  delta?: string;
  toolCalls?: ToolCallContent[];
  finishReason?: string;
}

export interface LLMProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
}

// ============================================================================
// 平台相关类型
// ============================================================================

export enum Platform {
  TOUTIAO = "toutiao",
  WECHAT = "wechat",
  WEIBO = "weibo",
  XIAOHONGSHU = "xiaohongshu",
}

export interface PlatformConfig {
  platform: Platform;
  maxCharacters?: number;
  supportedFormats?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface GeneratedContent {
  platform: Platform;
  title: string;
  content: string;
  tags: string[];
  metadata?: Record<string, any>;
}

// ============================================================================
// 话题相关类型
// ============================================================================

export interface Topic {
  id: string;
  title: string;
  description: string;
  source: string;
  url?: string;
  score: number;
  categories: string[];
  createdAt: Date;
}

export interface TopicSource {
  name: string;
  url: string;
  enabled: boolean;
}

// ============================================================================
// 其他类型
// ============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
