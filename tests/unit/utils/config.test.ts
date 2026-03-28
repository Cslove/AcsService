import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadConfig,
  getConfig,
  reloadConfig,
  validateConfig,
  type GitHubConfig,
  type LLMConfig,
  type ServerConfig,
  type CacheConfig,
  type SSEConfig,
  type TaskConfig,
  type PushConfig,
  type LogConfig,
} from "@/shared/config/index.js";

describe("config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 重置环境变量
    process.env = { ...originalEnv };
    // 设置必需的环境变量
    process.env.GITHUB_TOKEN = "test_github_token";
    process.env.GITHUB_REPO_OWNER = "test_owner";
    process.env.GITHUB_REPO_NAME = "test_repo";
    process.env.DEEPSEEK_API_KEY = "test_deepseek_key";
    process.env.QWEN_API_KEY = "test_qwen_key";
    // 清除配置实例
    vi.clearAllMocks();
  });

  describe("loadConfig", () => {
    it("应该从环境变量加载配置", () => {
      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.github.token).toBe("test_github_token");
      expect(config.github.owner).toBe("test_owner");
      expect(config.github.repo).toBe("test_repo");
    });

    it("应该使用默认值", () => {
      const config = loadConfig();

      expect(config.github.branch).toBe("main");
      expect(config.github.basePath).toBe("data");
      expect(config.server.port).toBe(3000);
      // 在测试环境中，NODE_ENV默认为"test"
      expect(config.server.nodeEnv).toBe("test");
    });

    it("应该正确解析LLM配置", () => {
      const config = loadConfig();

      expect(config.llm.deepseek).toBeDefined();
      expect(config.llm.deepseek?.apiKey).toBe("test_deepseek_key");
      expect(config.llm.qwen).toBeDefined();
      expect(config.llm.qwen?.apiKey).toBe("test_qwen_key");
    });

    it("应该处理可选的LLM提供商", () => {
      delete process.env.KIMI_API_KEY;
      delete process.env.GLM_API_KEY;

      const config = loadConfig();

      expect(config.llm.kimi).toBeUndefined();
      expect(config.llm.glm).toBeUndefined();
    });

    it("应该正确解析缓存配置", () => {
      const config = loadConfig();

      expect(config.cache.maxSize).toBe(1000);
      expect(config.cache.ttl).toBe(3600);
      expect(config.cache.memoryMaxSize).toBe(500);
      expect(config.cache.memoryTtl).toBe(1800);
    });

    it("应该正确解析SSE配置", () => {
      const config = loadConfig();

      expect(config.sse.heartbeatInterval).toBe(30000);
      expect(config.sse.connectionTimeout).toBe(60000);
      expect(config.sse.maxConnectionsPerUser).toBe(5);
    });

    it("应该正确解析任务配置", () => {
      const config = loadConfig();

      expect(config.task.defaultTimeout).toBe(300000);
      expect(config.task.maxConcurrentTasks).toBe(10);
      expect(config.task.taskQueueSize).toBe(100);
    });

    it("应该正确解析推送配置", () => {
      const config = loadConfig();

      expect(config.push.morningStart).toBe(7);
      expect(config.push.morningEnd).toBe(9);
      expect(config.push.noonStart).toBe(12);
      expect(config.push.noonEnd).toBe(14);
      expect(config.push.eveningStart).toBe(18);
      expect(config.push.eveningEnd).toBe(21);
    });

    it("应该正确解析日志配置", () => {
      const config = loadConfig();

      expect(config.log.level).toBe("info");
      expect(config.log.maxLogSize).toBe(10485760);
      expect(config.log.logRetentionDays).toBe(30);
    });

    it("应该支持自定义环境变量", () => {
      process.env.PORT = "8080";
      process.env.NODE_ENV = "production";
      process.env.LOG_LEVEL = "debug";

      const config = loadConfig();

      expect(config.server.port).toBe(8080);
      expect(config.server.nodeEnv).toBe("production");
      expect(config.log.level).toBe("debug");
    });
  });

  describe("getConfig", () => {
    it("应该返回配置实例（单例模式）", () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });

    it("应该在第一次调用时加载配置", () => {
      const config = getConfig();

      expect(config).toBeDefined();
      expect(config.github.token).toBe("test_github_token");
    });
  });

  describe("reloadConfig", () => {
    it("应该重新加载配置", () => {
      const config1 = getConfig();

      // 修改环境变量
      process.env.PORT = "9999";
      const config2 = reloadConfig();

      expect(config1).not.toBe(config2);
      expect(config2.server.port).toBe(9999);
    });
  });

  describe("validateConfig", () => {
    it("应该验证有效的配置", () => {
      const validConfig = loadConfig();
      const result = validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("应该拒绝无效的配置", () => {
      const invalidConfig = {
        github: {
          token: "", // 无效：空字符串
          owner: "test",
          repo: "test",
        },
      } as any;

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("应该拒绝缺少必需字段的配置", () => {
      const invalidConfig = {
        github: {
          owner: "test",
          repo: "test",
          // 缺少 token
        },
      } as any;

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("应该验证端口为正整数", () => {
      const invalidConfig = loadConfig();
      (invalidConfig as any).server.port = -1;

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
    });

    it("应该验证nodeEnv为有效值", () => {
      const invalidConfig = loadConfig();
      (invalidConfig as any).server.nodeEnv = "invalid";

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
    });

    it("应该验证defaultProvider为有效值", () => {
      const invalidConfig = loadConfig();
      (invalidConfig as any).llm.defaultProvider = "invalid";

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
    });
  });

  describe("配置类型", () => {
    it("应该正确推断GitHubConfig类型", () => {
      const config: GitHubConfig = {
        token: "test",
        owner: "test",
        repo: "test",
        branch: "main",
        basePath: "data",
      };

      expect(config.token).toBe("test");
    });

    it("应该正确推断LLMConfig类型", () => {
      const config: LLMConfig = {
        deepseek: {
          apiKey: "test",
          baseURL: "https://api.test.com",
          model: "test-model",
        },
        defaultProvider: "deepseek",
        defaultModel: "deepseek-chat",
      };

      expect(config.defaultProvider).toBe("deepseek");
    });

    it("应该正确推断ServerConfig类型", () => {
      const config: ServerConfig = {
        port: 3000,
        nodeEnv: "development",
      };

      expect(config.port).toBe(3000);
    });

    it("应该正确推断CacheConfig类型", () => {
      const config: CacheConfig = {
        maxSize: 1000,
        ttl: 3600,
        memoryMaxSize: 500,
        memoryTtl: 1800,
        fileMaxSize: 10000,
        fileTtl: 7200,
      };

      expect(config.maxSize).toBe(1000);
    });

    it("应该正确推断SSEConfig类型", () => {
      const config: SSEConfig = {
        heartbeatInterval: 30000,
        connectionTimeout: 60000,
        maxConnectionsPerUser: 5,
        reconnectDelay: 5000,
        maxReconnectAttempts: 10,
      };

      expect(config.heartbeatInterval).toBe(30000);
    });

    it("应该正确推断TaskConfig类型", () => {
      const config: TaskConfig = {
        defaultTimeout: 300000,
        maxConcurrentTasks: 10,
        taskQueueSize: 100,
        retryDelay: 2000,
        maxRetries: 3,
      };

      expect(config.defaultTimeout).toBe(300000);
    });

    it("应该正确推断PushConfig类型", () => {
      const config: PushConfig = {
        morningStart: 7,
        morningEnd: 9,
        noonStart: 12,
        noonEnd: 14,
        eveningStart: 18,
        eveningEnd: 21,
        topicSuggestionCount: 5,
        topicRefreshInterval: 3600000,
      };

      expect(config.morningStart).toBe(7);
    });

    it("应该正确推断LogConfig类型", () => {
      const config: LogConfig = {
        level: "info",
        maxLogSize: 10485760,
        logRetentionDays: 30,
      };

      expect(config.level).toBe("info");
    });
  });
});
