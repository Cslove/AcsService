/**
 * 配置管理模块
 * 统一管理所有配置
 */

import { z } from "zod";

// ============================================================================
// GitHub 配置
// ============================================================================

const GitHubConfigSchema = z.object({
  token: z.string().min(1, "GitHub token is required"),
  owner: z.string().min(1, "GitHub owner is required"),
  repo: z.string().min(1, "GitHub repo is required"),
  branch: z.string().default("main"),
  basePath: z.string().default("data"),
});

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

// ============================================================================
// LLM 配置
// ============================================================================

const LLMProviderConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseURL: z.string().url(),
  model: z.string().default("default"),
});

const LLMConfigSchema = z.object({
  deepseek: LLMProviderConfigSchema.optional(),
  kimi: LLMProviderConfigSchema.optional(),
  qwen: LLMProviderConfigSchema.optional(),
  glm: LLMProviderConfigSchema.optional(),
  defaultProvider: z.enum(["deepseek", "kimi", "qwen", "glm"]).default("deepseek"),
  defaultModel: z.string().default("deepseek-chat"),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// ============================================================================
// 服务配置
// ============================================================================

const ServerConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// ============================================================================
// 缓存配置
// ============================================================================

const CacheConfigSchema = z.object({
  maxSize: z.number().int().positive().default(1000),
  ttl: z.number().int().positive().default(3600),
  memoryMaxSize: z.number().int().positive().default(500),
  memoryTtl: z.number().int().positive().default(1800),
  fileMaxSize: z.number().int().positive().default(10000),
  fileTtl: z.number().int().positive().default(7200),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

// ============================================================================
// SSE 配置
// ============================================================================

const SSEConfigSchema = z.object({
  heartbeatInterval: z.number().int().positive().default(30000),
  connectionTimeout: z.number().int().positive().default(60000),
  maxConnectionsPerUser: z.number().int().positive().default(5),
  reconnectDelay: z.number().int().positive().default(5000),
  maxReconnectAttempts: z.number().int().positive().default(10),
});

export type SSEConfig = z.infer<typeof SSEConfigSchema>;

// ============================================================================
// 任务配置
// ============================================================================

const TaskConfigSchema = z.object({
  defaultTimeout: z.number().int().positive().default(300000),
  maxConcurrentTasks: z.number().int().positive().default(10),
  taskQueueSize: z.number().int().positive().default(100),
  retryDelay: z.number().int().positive().default(2000),
  maxRetries: z.number().int().positive().default(3),
});

export type TaskConfig = z.infer<typeof TaskConfigSchema>;

// ============================================================================
// 推送配置
// ============================================================================

const PushConfigSchema = z.object({
  morningStart: z.number().int().min(0).max(23).default(7),
  morningEnd: z.number().int().min(0).max(23).default(9),
  noonStart: z.number().int().min(0).max(23).default(12),
  noonEnd: z.number().int().min(0).max(23).default(14),
  eveningStart: z.number().int().min(0).max(23).default(18),
  eveningEnd: z.number().int().min(0).max(23).default(21),
  topicSuggestionCount: z.number().int().positive().default(5),
  topicRefreshInterval: z.number().int().positive().default(3600000),
});

export type PushConfig = z.infer<typeof PushConfigSchema>;

// ============================================================================
// 日志配置
// ============================================================================

const LogConfigSchema = z.object({
  level: z.enum(["error", "warn", "info", "debug"]).default("info"),
  maxLogSize: z.number().int().positive().default(10485760),
  logRetentionDays: z.number().int().positive().default(30),
});

export type LogConfig = z.infer<typeof LogConfigSchema>;

// ============================================================================
// 完整应用配置
// ============================================================================

const AppConfigSchema = z.object({
  github: GitHubConfigSchema,
  llm: LLMConfigSchema,
  server: ServerConfigSchema,
  cache: CacheConfigSchema,
  sse: SSEConfigSchema,
  task: TaskConfigSchema,
  push: PushConfigSchema,
  log: LogConfigSchema,
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// ============================================================================
// 配置加载函数
// ============================================================================

/**
 * 从环境变量加载配置
 */
export function loadConfig(): AppConfig {
  const config = {
    github: {
      token: process.env.GITHUB_TOKEN || "",
      owner: process.env.GITHUB_REPO_OWNER || "",
      repo: process.env.GITHUB_REPO_NAME || "",
      branch: process.env.GITHUB_BRANCH || "main",
      basePath: process.env.GITHUB_BASE_PATH || "data",
    },
    llm: {
      deepseek: process.env.DEEPSEEK_API_KEY
        ? {
            apiKey: process.env.DEEPSEEK_API_KEY,
            baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
            model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
          }
        : undefined,
      kimi: process.env.KIMI_API_KEY
        ? {
            apiKey: process.env.KIMI_API_KEY,
            baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
            model: process.env.KIMI_MODEL || "moonshot-v1-8k",
          }
        : undefined,
      qwen: process.env.QWEN_API_KEY
        ? {
            apiKey: process.env.QWEN_API_KEY,
            baseURL:
              process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
            model: process.env.QWEN_MODEL || "qwen-turbo",
          }
        : undefined,
      glm: process.env.GLM_API_KEY
        ? {
            apiKey: process.env.GLM_API_KEY,
            baseURL: process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
            model: process.env.GLM_MODEL || "glm-4",
          }
        : undefined,
      defaultProvider: (process.env.DEFAULT_MODEL_PROVIDER as any) || "deepseek",
      defaultModel: process.env.DEFAULT_MODEL_NAME || "deepseek-chat",
    },
    server: {
      port: parseInt(process.env.PORT || "3000", 10),
      nodeEnv: (process.env.NODE_ENV as any) || "development",
    },
    cache: {
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || "1000", 10),
      ttl: parseInt(process.env.CACHE_TTL || "3600", 10),
      memoryMaxSize: parseInt(process.env.CACHE_MEMORY_MAX_SIZE || "500", 10),
      memoryTtl: parseInt(process.env.CACHE_MEMORY_TTL || "1800", 10),
      fileMaxSize: parseInt(process.env.CACHE_FILE_MAX_SIZE || "10000", 10),
      fileTtl: parseInt(process.env.CACHE_FILE_TTL || "7200", 10),
    },
    sse: {
      heartbeatInterval: parseInt(process.env.SSE_HEARTBEAT_INTERVAL || "30000", 10),
      connectionTimeout: parseInt(process.env.SSE_CONNECTION_TIMEOUT || "60000", 10),
      maxConnectionsPerUser: parseInt(process.env.SSE_MAX_CONNECTIONS_PER_USER || "5", 10),
      reconnectDelay: parseInt(process.env.SSE_RECONNECT_DELAY || "5000", 10),
      maxReconnectAttempts: parseInt(process.env.SSE_MAX_RECONNECT_ATTEMPTS || "10", 10),
    },
    task: {
      defaultTimeout: parseInt(process.env.TASK_DEFAULT_TIMEOUT || "300000", 10),
      maxConcurrentTasks: parseInt(process.env.TASK_MAX_CONCURRENT_TASKS || "10", 10),
      taskQueueSize: parseInt(process.env.TASK_QUEUE_SIZE || "100", 10),
      retryDelay: parseInt(process.env.TASK_RETRY_DELAY || "2000", 10),
      maxRetries: parseInt(process.env.TASK_MAX_RETRIES || "3", 10),
    },
    push: {
      morningStart: parseInt(process.env.PUSH_MORNING_START || "7", 10),
      morningEnd: parseInt(process.env.PUSH_MORNING_END || "9", 10),
      noonStart: parseInt(process.env.PUSH_NOON_START || "12", 10),
      noonEnd: parseInt(process.env.PUSH_NOON_END || "14", 10),
      eveningStart: parseInt(process.env.PUSH_EVENING_START || "18", 10),
      eveningEnd: parseInt(process.env.PUSH_EVENING_END || "21", 10),
      topicSuggestionCount: parseInt(process.env.PUSH_TOPIC_SUGGESTION_COUNT || "5", 10),
      topicRefreshInterval: parseInt(process.env.PUSH_TOPIC_REFRESH_INTERVAL || "3600000", 10),
    },
    log: {
      level: (process.env.LOG_LEVEL as any) || "info",
      maxLogSize: parseInt(process.env.LOG_MAX_SIZE || "10485760", 10),
      logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || "30", 10),
    },
  };

  return AppConfigSchema.parse(config);
}

/**
 * 获取配置（单例模式）
 */
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * 重新加载配置
 */
export function reloadConfig(): AppConfig {
  configInstance = loadConfig();
  return configInstance;
}

/**
 * 验证配置
 */
export function validateConfig(config: unknown): { valid: boolean; errors?: z.ZodError } {
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    return { valid: false, errors: result.error };
  }
  return { valid: true };
}

export default {
  loadConfig,
  getConfig,
  reloadConfig,
  validateConfig,
};
