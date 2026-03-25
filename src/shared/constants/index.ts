import { Platform } from "@/shared/types/index.js";

// ============================================================================
// 应用配置常量
// ============================================================================

export const APP_CONFIG = {
  DEFAULT_PORT: 3000,
  DEFAULT_NODE_ENV: "development",
} as const;

// ============================================================================
// 缓存配置常量
// ============================================================================

export const CACHE_CONFIG = {
  DEFAULT_MAX_SIZE: 1000,
  DEFAULT_TTL: 3600, // 1 hour
  MEMORY_CACHE_MAX_SIZE: 500,
  MEMORY_CACHE_TTL: 1800, // 30 minutes
  FILE_CACHE_MAX_SIZE: 10000,
  FILE_CACHE_TTL: 7200, // 2 hours
} as const;

// ============================================================================
// GitHub 存储配置常量
// ============================================================================

export const GITHUB_CONFIG = {
  DEFAULT_BRANCH: "main",
  DATA_DIR: "data",
  USERS_DIR: "users",
  SYSTEM_DIR: "system",
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// ============================================================================
// LLM 配置常量
// ============================================================================

export const LLM_CONFIG = {
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2000,
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  STREAM_CHUNK_SIZE: 100,
} as const;

export const MODEL_PROVIDERS = {
  DEEPSEEK: "deepseek",
  KIMI: "kimi",
  QWEN: "qwen",
  GLM: "glm",
} as const;

export const MODEL_NAMES = {
  [MODEL_PROVIDERS.DEEPSEEK]: {
    DEFAULT: "deepseek-chat",
    FAST: "deepseek-coder",
  },
  [MODEL_PROVIDERS.KIMI]: {
    DEFAULT: "moonshot-v1-8k",
    FAST: "moonshot-v1-32k",
  },
  [MODEL_PROVIDERS.QWEN]: {
    DEFAULT: "qwen-turbo",
    FAST: "qwen-plus",
  },
  [MODEL_PROVIDERS.GLM]: {
    DEFAULT: "glm-4",
    FAST: "glm-3-turbo",
  },
} as const;

// ============================================================================
// SSE 配置常量
// ============================================================================

export const SSE_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 60000, // 1 minute
  MAX_CONNECTIONS_PER_USER: 5,
  RECONNECT_DELAY: 5000, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 10,
} as const;

// ============================================================================
// 任务配置常量
// ============================================================================

export const TASK_CONFIG = {
  DEFAULT_TIMEOUT: 300000, // 5 minutes
  MAX_CONCURRENT_TASKS: 10,
  TASK_QUEUE_SIZE: 100,
  RETRY_DELAY: 2000,
  MAX_RETRIES: 3,
} as const;

// ============================================================================
// 推送配置常量
// ============================================================================

export const PUSH_CONFIG = {
  MORNING_START: 7, // 7:00
  MORNING_END: 9, // 9:00
  NOON_START: 12, // 12:00
  NOON_END: 14, // 14:00
  EVENING_START: 18, // 18:00
  EVENING_END: 21, // 21:00
  TOPIC_SUGGESTION_COUNT: 5,
  TOPIC_REFRESH_INTERVAL: 3600000, // 1 hour
} as const;

// ============================================================================
// 平台配置常量
// ============================================================================

export const PLATFORM_CONFIG = {
  [Platform.TOUTIAO]: {
    maxCharacters: 2000,
    supportedFormats: ["article", "post"],
    tags: ["头条", "热点", "推荐"],
  },
  [Platform.WECHAT]: {
    maxCharacters: 5000,
    supportedFormats: ["article"],
    tags: ["原创", "精选"],
  },
  [Platform.WEIBO]: {
    maxCharacters: 140,
    supportedFormats: ["post", "tweet"],
    tags: ["微博", "热门"],
  },
  [Platform.XIAOHONGSHU]: {
    maxCharacters: 1000,
    supportedFormats: ["post", "caption"],
    tags: ["种草", "推荐"],
  },
} as const;

// ============================================================================
// 日志配置常量
// ============================================================================

export const LOG_CONFIG = {
  LEVELS: {
    ERROR: "error",
    WARN: "warn",
    INFO: "info",
    DEBUG: "debug",
  },
  DEFAULT_LEVEL: "info",
  MAX_LOG_SIZE: 10485760, // 10MB
  LOG_RETENTION_DAYS: 30,
} as const;

// ============================================================================
// 事件优先级常量
// ============================================================================

export const EVENT_PRIORITY = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
} as const;

// ============================================================================
// 工具调用配置常量
// ============================================================================

export const TOOL_CALL_CONFIG = {
  MAX_PARALLEL_CALLS: 5,
  TOOL_TIMEOUT: 10000, // 10 seconds
  MAX_TOOL_CALL_RETRIES: 2,
} as const;

// ============================================================================
// 内容生成配置常量
// ============================================================================

export const CONTENT_GENERATION_CONFIG = {
  DEFAULT_MIN_LENGTH: 500,
  DEFAULT_MAX_LENGTH: 2000,
  MAX_GENERATION_TIME: 60000, // 1 minute
  QUALITY_THRESHOLD: 0.7,
} as const;

// ============================================================================
// 话题收集配置常量
// ============================================================================

export const TOPIC_COLLECTION_CONFIG = {
  MAX_TOPICS_PER_SOURCE: 20,
  MIN_SCORE_THRESHOLD: 0.5,
  REFRESH_INTERVAL: 3600000, // 1 hour
  TOPIC_SOURCES: [
    {
      name: "weibo",
      url: "https://s.weibo.com/top/summary",
      enabled: true,
    },
    {
      name: "zhihu",
      url: "https://www.zhihu.com/hot",
      enabled: true,
    },
  ],
} as const;

// ============================================================================
// 用户偏好配置常量
// ============================================================================

export const PREFERENCE_CONFIG = {
  MIN_TAG_WEIGHT: 0.1,
  MAX_TAG_WEIGHT: 1.0,
  DEFAULT_TAG_WEIGHT: 0.5,
  MAX_INTERESTS: 20,
  MAX_TOPICS: 10,
  DECAY_FACTOR: 0.95, // Daily decay factor
} as const;

// ============================================================================
// 错误消息常量
// ============================================================================

export const ERROR_MESSAGES = {
  INVALID_INPUT: "Invalid input provided",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Access forbidden",
  NOT_FOUND: "Resource not found",
  INTERNAL_ERROR: "Internal server error",
  RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
  TIMEOUT: "Request timeout",
  INVALID_TOKEN: "Invalid authentication token",
  MISSING_REQUIRED_FIELD: "Missing required field",
} as const;

// ============================================================================
// 成功消息常量
// ============================================================================

export const SUCCESS_MESSAGES = {
  CREATED: "Resource created successfully",
  UPDATED: "Resource updated successfully",
  DELETED: "Resource deleted successfully",
  COMPLETED: "Task completed successfully",
} as const;

// ============================================================================
// 验证规则常量
// ============================================================================

export const VALIDATION_RULES = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_USERNAME_LENGTH: 50,
  MIN_USERNAME_LENGTH: 3,
  MAX_TITLE_LENGTH: 200,
  MIN_TITLE_LENGTH: 5,
  MAX_DESCRIPTION_LENGTH: 1000,
} as const;

// ============================================================================
// 其他常量
// ============================================================================

export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60000,
  HOUR: 3600000,
  DAY: 86400000,
  WEEK: 604800000,
  MONTH: 2592000000,
} as const;

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const;
